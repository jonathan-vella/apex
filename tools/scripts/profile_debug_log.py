#!/usr/bin/env python3
"""Profile a Copilot Chat OTel debug log.

Extracts headline metrics used by the token-reduction workstream:

  - token totals per model (input + output)
  - per-call input-token distribution buckets
  - subagent wall-time aggregate + per-invocation list
  - tool-call payload sizes (top consumers)
  - duplicate file-read map (read_file path -> count)
  - hard error spans (status.code == 2) with non-benign filter
  - vscode_askQuestions count + per-call duration
  - session wall time, agent wall time (chat span sum), user-wait
    wall time (askQuestions duration sum)

Schema reference: VS Code Copilot Chat exports an OpenTelemetry
``resourceSpans`` array. Each chat call is a span named
``chat:<model>``; each tool invocation has ``gen_ai.operation.name ==
'execute_tool'`` with ``gen_ai.tool.name`` set.

Two informational warning checks (no exit-code impact):

  - ``--max-spans-between-clears N`` flags sessions exceeding ``N``
    chat spans without a SessionStart/Stop boundary (Phase 2a
    compliance signal).
  - ``--max-askquestions-per-phase N`` flags any contiguous run
    (between turn boundaries) exceeding ``N`` askQuestions calls
    (Phase 4 compliance signal).

Usage:

    python3 tools/scripts/profile_debug_log.py LOG.json [--json]
    python3 tools/scripts/profile_debug_log.py LOG.json --json > out.json

Exit codes: ``0`` on success, ``1`` on malformed/missing log,
``2`` on argparse error.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
from typing import Any

# OTel status codes: 0 = UNSET/OK (treated as OK), 1 = OK, 2 = ERROR.
# A subset of tool errors are routine ("not found" probes etc.) and
# would inflate the error count without indicating a real problem.
BENIGN_ERROR_FRAGMENTS = (
    "ENOENT",
    "no such file or directory",
)


def load_spans(path: Path) -> list[dict[str, Any]]:
    """Read the log file and return a flat list of spans.

    Raises ``ValueError`` on malformed input so the CLI can surface a
    clean diagnostic instead of a stack trace.
    """
    try:
        raw = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path}: not valid JSON ({exc.msg})") from exc

    resource_spans = raw.get("resourceSpans")
    if not isinstance(resource_spans, list) or not resource_spans:
        raise ValueError(f"{path}: missing resourceSpans[]")

    spans: list[dict[str, Any]] = []
    for rs in resource_spans:
        for ss in rs.get("scopeSpans", []):
            spans.extend(ss.get("spans", []))
    if not spans:
        raise ValueError(f"{path}: no spans found")
    return spans


def _attrs(span: dict[str, Any]) -> dict[str, Any]:
    """Flatten OTel attribute list into a plain dict.

    OTel encodes values inside a ``value`` wrapper keyed by type
    (``stringValue``, ``intValue``, etc.). Pull out the first non-null
    value to give downstream code a simple key/value dict.
    """
    out: dict[str, Any] = {}
    for a in span.get("attributes", []):
        key = a.get("key")
        if not key:
            continue
        v = a.get("value", {}) or {}
        for typed in ("stringValue", "intValue", "doubleValue", "boolValue"):
            if typed in v:
                # OTel JSON serialises intValue as a string in some
                # exporters; coerce when the key implies a number.
                val = v[typed]
                if typed == "intValue" and isinstance(val, str):
                    with contextlib.suppress(ValueError):
                        val = int(val)
                out[key] = val
                break
    return out


def _duration_s(span: dict[str, Any]) -> float:
    """Return span duration in seconds (0.0 if timestamps missing)."""
    try:
        start = int(span["startTimeUnixNano"])
        end = int(span["endTimeUnixNano"])
    except (KeyError, ValueError, TypeError):
        return 0.0
    return max(0.0, (end - start) / 1e9)


def _bucket(n: int) -> str:
    """Coarse histogram bucket for input-token distribution."""
    if n < 10_000:
        return "<10K"
    if n < 50_000:
        return "10K-50K"
    if n < 100_000:
        return "50K-100K"
    if n < 200_000:
        return "100K-200K"
    return ">=200K"


def _is_benign_error(span: dict[str, Any], attrs: dict[str, Any]) -> bool:
    """Drop errors that match the benign list (e.g. probe ENOENTs)."""
    msg = (span.get("status") or {}).get("message", "") or ""
    blob = msg + " " + str(attrs.get("gen_ai.tool.call.result", ""))[:500]
    return any(frag in blob for frag in BENIGN_ERROR_FRAGMENTS)


def profile(
    spans: list[dict[str, Any]],
    *,
    max_spans_between_clears: int = 50,
    max_askquestions_per_phase: int = 3,
) -> dict[str, Any]:
    """Compute the full metrics dictionary from a span list."""
    # Per-model token totals + per-call distribution.
    tokens_by_model: dict[str, dict[str, int]] = defaultdict(
        lambda: {"input": 0, "output": 0, "calls": 0},
    )
    input_buckets: Counter[str] = Counter()
    per_call_inputs: list[int] = []
    max_input_per_call = 0

    # Tool stats.
    tool_calls: Counter[str] = Counter()
    tool_payload_bytes: dict[str, int] = defaultdict(int)
    read_file_paths: Counter[str] = Counter()

    # Subagent stats.
    subagent_wall = 0.0
    subagent_calls: list[dict[str, Any]] = []

    # askQuestions stats.
    ask_durations: list[float] = []

    # Error stats. Track both raw count (status.code == 2) and the
    # non-benign filtered list so we can report the plan-target raw
    # number while keeping the useful filtered list for triage.
    error_spans: list[dict[str, Any]] = []
    error_spans_raw_count = 0

    # Inter-boundary span counters for compliance warnings.
    chat_since_boundary = 0
    inter_boundary_max = 0
    ask_in_phase = 0
    ask_per_phase_max = 0
    warnings: list[str] = []

    session_start: int | None = None
    session_end: int | None = None
    agent_chat_wall = 0.0

    for span in spans:
        name = span.get("name") or ""
        attrs = _attrs(span)

        # Track overall session bounds for wall-time reporting.
        try:
            s = int(span["startTimeUnixNano"])
            e = int(span["endTimeUnixNano"])
            session_start = s if session_start is None else min(session_start, s)
            session_end = e if session_end is None else max(session_end, e)
        except (KeyError, ValueError, TypeError):
            pass

        # Error spans (status.code == 2). Counted up front because the
        # remainder of the loop may `continue` for chat/boundary spans
        # before reaching this check.
        status = span.get("status") or {}
        if status.get("code") == 2:
            error_spans_raw_count += 1
            if not _is_benign_error(span, attrs):
                error_spans.append(
                    {
                        "span_name": name,
                        "tool": attrs.get("gen_ai.tool.name"),
                        "message": status.get("message", ""),
                    },
                )

        # Chat spans → token + per-model accounting.
        if name.startswith("chat:"):
            model = attrs.get("gen_ai.request.model") or name.split(":", 1)[1]
            try:
                in_tok = int(attrs.get("gen_ai.usage.input_tokens", 0))
                out_tok = int(attrs.get("gen_ai.usage.output_tokens", 0))
            except (TypeError, ValueError):
                in_tok = out_tok = 0
            row = tokens_by_model[model]
            row["input"] += in_tok
            row["output"] += out_tok
            row["calls"] += 1
            input_buckets[_bucket(in_tok)] += 1
            per_call_inputs.append(in_tok)
            max_input_per_call = max(max_input_per_call, in_tok)
            agent_chat_wall += _duration_s(span)
            chat_since_boundary += 1
            continue

        # SessionStart / Stop reset the inter-clear counter.
        if name in ("SessionStart", "Stop"):
            inter_boundary_max = max(inter_boundary_max, chat_since_boundary)
            chat_since_boundary = 0
            continue

        # turn_start:N is a per-step boundary for askQuestions counting.
        if name.startswith("turn_start:"):
            ask_per_phase_max = max(ask_per_phase_max, ask_in_phase)
            ask_in_phase = 0

        # Tool spans.
        if attrs.get("gen_ai.operation.name") == "execute_tool":
            tname = attrs.get("gen_ai.tool.name") or name
            tool_calls[tname] += 1
            args_blob = str(attrs.get("gen_ai.tool.call.arguments", ""))
            result_blob = str(attrs.get("gen_ai.tool.call.result", ""))
            tool_payload_bytes[tname] += len(args_blob) + len(result_blob)
            if tname == "read_file":
                # Pull filePath out of the JSON arguments to map dupes.
                try:
                    args_obj = json.loads(args_blob) if args_blob else {}
                    fpath = args_obj.get("filePath") or "(unknown)"
                except (json.JSONDecodeError, TypeError):
                    fpath = "(unparseable)"
                read_file_paths[fpath] += 1
            elif tname == "vscode_askQuestions":
                ask_durations.append(_duration_s(span))
                ask_in_phase += 1

        # Subagent invocations.
        if name in ("challenger-review-subagent", "execution_subagent"):
            dur = _duration_s(span)
            subagent_wall += dur
            subagent_calls.append({"name": name, "duration_s": round(dur, 2)})

    # Final inter-boundary check after the loop.
    inter_boundary_max = max(inter_boundary_max, chat_since_boundary)
    ask_per_phase_max = max(ask_per_phase_max, ask_in_phase)

    if inter_boundary_max > max_spans_between_clears:
        warnings.append(
            f"inter_boundary_chat_spans={inter_boundary_max} exceeds "
            f"threshold {max_spans_between_clears} (Phase 2a: /clear compliance)",
        )
    if ask_per_phase_max > max_askquestions_per_phase:
        warnings.append(
            f"max_askquestions_per_phase={ask_per_phase_max} exceeds "
            f"threshold {max_askquestions_per_phase} (Phase 4: batching compliance)",
        )

    total_input = sum(row["input"] for row in tokens_by_model.values())
    total_output = sum(row["output"] for row in tokens_by_model.values())
    total_calls = sum(row["calls"] for row in tokens_by_model.values())
    avg_in = round(total_input / total_calls) if total_calls else 0
    p50_in = int(median(per_call_inputs)) if per_call_inputs else 0
    session_wall = (session_end - session_start) / 1e9 if session_start and session_end else 0.0
    user_wait_wall = sum(ask_durations)

    # Build top-N readable lists from the wider counters.
    top_tool_payloads = sorted(
        ({"tool": t, "bytes": b} for t, b in tool_payload_bytes.items()),
        key=lambda r: r["bytes"],
        reverse=True,
    )[:10]
    duplicate_reads = [
        {"path": p, "count": c} for p, c in read_file_paths.most_common(20) if c > 1
    ]

    return {
        "totals": {
            "input_tokens": total_input,
            "output_tokens": total_output,
            "chat_calls": total_calls,
            "avg_input_per_call": avg_in,
            "p50_input_per_call": p50_in,
            "max_input_per_call": max_input_per_call,
            "askquestions_count": len(ask_durations),
            "subagent_invocations": len(subagent_calls),
            "challenger_invocations": sum(
                1 for c in subagent_calls if c["name"] == "challenger-review-subagent"
            ),
            "error_spans_total": error_spans_raw_count,
            "error_spans_non_benign": len(error_spans),
        },
        "wall_time_s": {
            "session_total": round(session_wall, 1),
            "agent_chat": round(agent_chat_wall, 1),
            "subagent": round(subagent_wall, 1),
            "user_wait_askquestions": round(user_wait_wall, 1),
        },
        "tokens_by_model": {
            m: {
                "input": row["input"],
                "output": row["output"],
                "calls": row["calls"],
                "avg_input_per_call": round(row["input"] / row["calls"]) if row["calls"] else 0,
            }
            for m, row in tokens_by_model.items()
        },
        "input_token_buckets": dict(input_buckets),
        "tool_call_counts": dict(tool_calls.most_common()),
        "top_tool_payloads": top_tool_payloads,
        "duplicate_reads": duplicate_reads,
        "subagent_calls": subagent_calls,
        "errors": error_spans,
        "warnings": warnings,
        "compliance_metrics": {
            "max_chat_spans_between_clears": inter_boundary_max,
            "max_askquestions_in_single_phase": ask_per_phase_max,
        },
    }


def render_text(metrics: dict[str, Any], path: Path) -> str:
    """Human-readable summary; the JSON form remains the source of truth."""
    lines: list[str] = []
    t = metrics["totals"]
    w = metrics["wall_time_s"]
    lines.append(f"# profile: {path}")
    lines.append("")
    lines.append("## Totals")
    lines.append(f"  input_tokens         : {t['input_tokens']:>12,}")
    lines.append(f"  output_tokens        : {t['output_tokens']:>12,}")
    lines.append(f"  chat_calls           : {t['chat_calls']:>12,}")
    lines.append(f"  avg_input_per_call   : {t['avg_input_per_call']:>12,}")
    lines.append(f"  p50_input_per_call   : {t['p50_input_per_call']:>12,}")
    lines.append(f"  max_input_per_call   : {t['max_input_per_call']:>12,}")
    lines.append(f"  askquestions         : {t['askquestions_count']:>12}")
    lines.append(f"  subagent_invocations : {t['subagent_invocations']:>12}")
    lines.append(f"  challenger_invokes   : {t['challenger_invocations']:>12}")
    lines.append(f"  errors (total)       : {t['error_spans_total']:>12}")
    lines.append(f"  errors (non-benign)  : {t['error_spans_non_benign']:>12}")
    lines.append("")
    lines.append("## Wall time (s)")
    for k, v in w.items():
        lines.append(f"  {k:<22}: {v:>10}")
    lines.append("")
    lines.append("## Tokens by model")
    for m, row in metrics["tokens_by_model"].items():
        lines.append(
            f"  {m:<22}: in={row['input']:>10,}  out={row['output']:>8,}  "
            f"calls={row['calls']:>4}  avg_in={row['avg_input_per_call']:>8,}",
        )
    lines.append("")
    lines.append("## Input-token buckets")
    for bucket, count in metrics["input_token_buckets"].items():
        lines.append(f"  {bucket:<10}: {count}")
    if metrics["duplicate_reads"]:
        lines.append("")
        lines.append("## Duplicate file reads")
        for entry in metrics["duplicate_reads"]:
            lines.append(f"  {entry['count']:>3}x  {entry['path']}")
    if metrics["errors"]:
        lines.append("")
        lines.append("## Errors (non-benign)")
        for e in metrics["errors"][:10]:
            lines.append(f"  {e['span_name']}  tool={e['tool']}  msg={e['message'][:80]}")
    if metrics["warnings"]:
        lines.append("")
        lines.append("## Warnings")
        for w_msg in metrics["warnings"]:
            lines.append(f"  ! {w_msg}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("log", type=Path, help="Path to OTel debug log JSON")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text")
    parser.add_argument(
        "--max-spans-between-clears",
        type=int,
        default=50,
        help="Warn when chat-span count between SessionStart/Stop exceeds N (default: 50)",
    )
    parser.add_argument(
        "--max-askquestions-per-phase",
        type=int,
        default=3,
        help="Warn when askQuestions count between turn_start:N markers exceeds N (default: 3)",
    )
    args = parser.parse_args(argv)

    try:
        spans = load_spans(args.log)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    metrics = profile(
        spans,
        max_spans_between_clears=args.max_spans_between_clears,
        max_askquestions_per_phase=args.max_askquestions_per_phase,
    )

    if args.json:
        json.dump(metrics, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        print(render_text(metrics, args.log))
    return 0


if __name__ == "__main__":
    sys.exit(main())
