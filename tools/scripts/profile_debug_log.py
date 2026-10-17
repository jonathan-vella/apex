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
import hashlib
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


def _jsonl_record_to_span(rec: dict[str, Any]) -> dict[str, Any]:
    """Convert a VS Code Copilot Chat JSONL event record into an OTel-shaped span."""
    if not isinstance(rec, dict) or ("type" not in rec and "name" not in rec):
        raise ValueError("JSONL line is not a valid event object")

    raw_attrs = rec.get("attrs") if isinstance(rec.get("attrs"), dict) else {}
    rtype = str(rec.get("type") or "")
    rname = str(rec.get("name") or "")

    start_ns: str | None = None
    end_ns: str | None = None
    if isinstance(rec.get("ts"), (int, float)):
        s_ns = int(rec["ts"] * 1_000_000)
        dur_ms = int(rec.get("dur") or 0) if isinstance(rec.get("dur"), (int, float)) else 0
        start_ns = str(s_ns)
        end_ns = str(s_ns + max(0, dur_ms) * 1_000_000)

    attributes: list[dict[str, Any]] = []

    def add_attr(key: str, val: Any) -> None:
        if val is None:
            return
        if isinstance(val, bool):
            attributes.append({"key": key, "value": {"boolValue": val}})
        elif isinstance(val, int):
            attributes.append({"key": key, "value": {"intValue": val}})
        elif isinstance(val, float):
            attributes.append({"key": key, "value": {"doubleValue": val}})
        elif isinstance(val, str):
            attributes.append({"key": key, "value": {"stringValue": val}})
        else:
            attributes.append({"key": key, "value": {"stringValue": json.dumps(val)}})

    span_name = rname
    if rtype == "llm_request":
        model = raw_attrs.get("model") or (rname.split(":", 1)[1] if rname.startswith("chat:") else rname or "unknown")
        span_name = rname if rname.startswith("chat:") else f"chat:{model}"
        add_attr("gen_ai.operation.name", "chat")
        add_attr("gen_ai.request.model", str(model))
        add_attr("gen_ai.usage.input_tokens", raw_attrs.get("inputTokens"))
        add_attr("gen_ai.usage.output_tokens", raw_attrs.get("outputTokens"))
    elif rtype == "tool_call":
        add_attr("gen_ai.operation.name", "execute_tool")
        add_attr("gen_ai.tool.name", rname)
        args_val = raw_attrs.get("args")
        if args_val is not None:
            add_attr(
                "gen_ai.tool.call.arguments",
                args_val if isinstance(args_val, str) else json.dumps(args_val),
            )
        if raw_attrs.get("result") is not None:
            add_attr("gen_ai.tool.call.result", str(raw_attrs.get("result")))

    raw_status = rec.get("status")
    status_obj: dict[str, Any] = {}
    if isinstance(raw_status, dict):
        status_obj = raw_status
    elif raw_status in ("error", "failed", "ERROR", "FAILED") or raw_attrs.get("error"):
        status_obj = {
            "code": 2,
            "message": str(raw_attrs.get("error") or raw_attrs.get("message") or raw_status or "error"),
        }

    span: dict[str, Any] = {
        "name": span_name,
        "attributes": attributes,
        "status": status_obj,
    }
    if rec.get("tid"):
        span["traceId"] = str(rec["tid"])
    if rec.get("sid"):
        span["spanId"] = str(rec["sid"])
    if rec.get("pid"):
        span["parentSpanId"] = str(rec["pid"])
    if start_ns is not None:
        span["startTimeUnixNano"] = start_ns
    if end_ns is not None:
        span["endTimeUnixNano"] = end_ns
    if rtype == "subagent":
        span["_jsonl_subagent"] = str(raw_attrs.get("agentName") or rname or "(unknown)")
    return span


def load_spans(path: Path) -> list[dict[str, Any]]:
    """Read an OTel JSON or VS Code JSONL debug log file and return a flat list of spans.

    Raises ``ValueError`` on malformed input so the CLI can surface a
    clean diagnostic instead of a stack trace.
    """
    text = path.read_text(encoding="utf-8")
    stripped = text.strip()
    if not stripped:
        raise ValueError(f"{path}: empty log file")

    try:
        raw = json.loads(stripped)
    except json.JSONDecodeError as exc:
        lines = [line.strip() for line in stripped.splitlines() if line.strip()]
        if len(lines) <= 1 and path.suffix.lower() != ".jsonl":
            raise ValueError(f"{path}: not valid JSON ({exc.msg})") from exc
        spans: list[dict[str, Any]] = []
        for idx, line in enumerate(lines, start=1):
            try:
                rec = json.loads(line)
                spans.append(_jsonl_record_to_span(rec))
            except (json.JSONDecodeError, ValueError) as line_exc:
                raise ValueError(f"{path}:{idx}: invalid JSONL record ({line_exc})") from line_exc
        if not spans:
            raise ValueError(f"{path}: no spans found") from exc
        return spans

    if isinstance(raw, dict) and ("ts" in raw or "type" in raw) and "resourceSpans" not in raw:
        return [_jsonl_record_to_span(raw)]

    if not isinstance(raw, dict):
        raise ValueError(f"{path}: missing resourceSpans[]")

    resource_spans = raw.get("resourceSpans")
    if not isinstance(resource_spans, list) or not resource_spans:
        raise ValueError(f"{path}: missing resourceSpans[]")

    spans = []
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
    except KeyError, ValueError, TypeError:
        return 0.0
    return max(0.0, (end - start) / 1e9)


def _interval_union_s(intervals_ns: list[tuple[int, int]]) -> float:
    """Return merged non-overlapping duration in seconds from (start_ns, end_ns) pairs."""
    valid = sorted((s, e) for s, e in intervals_ns if e > s)
    if not valid:
        return 0.0
    total_ns = 0
    cur_s, cur_e = valid[0]
    for s, e in valid[1:]:
        if s <= cur_e:
            cur_e = max(cur_e, e)
        else:
            total_ns += cur_e - cur_s
            cur_s, cur_e = s, e
    total_ns += cur_e - cur_s
    return total_ns / 1e9


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


def _token_count(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, str) and value.isascii() and value.isdigit():
        return int(value)
    return None


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
        lambda: {"input": 0, "output": 0, "calls": 0, "input_samples": 0, "output_samples": 0},
    )
    input_buckets: Counter[str] = Counter()
    per_call_inputs: list[int] = []
    max_input_per_call = 0

    # Tool stats.
    tool_calls: Counter[str] = Counter()
    tool_payload_bytes: dict[str, int] = defaultdict(int)
    read_file_paths: Counter[str] = Counter()

    spans_by_id = {(span.get("traceId"), span.get("spanId")): span for span in spans if span.get("spanId")}
    delegation_spans = {
        identity
        for identity, span in spans_by_id.items()
        if _attrs(span).get("gen_ai.operation.name") == "execute_tool"
        and (_attrs(span).get("gen_ai.tool.name") or span.get("name")) == "runSubagent"
    }
    delegation_ancestors = set()
    for identity in delegation_spans:
        current = spans_by_id[identity]
        visited = set()
        while current.get("parentSpanId"):
            parent = (current.get("traceId"), current["parentSpanId"])
            if parent in visited or parent not in spans_by_id:
                break
            visited.add(parent)
            delegation_ancestors.add(parent)
            current = spans_by_id[parent]

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
    chat_intervals_ns: list[tuple[int, int]] = []
    tool_intervals_ns: list[tuple[int, int]] = []
    pricing_learn_calls = 0
    tool_stalls_over_60s = 0
    seen_spans: set[tuple[str, str]] = set()
    duplicate_exported_spans = 0

    for span in spans:
        identity = (span.get("traceId"), span.get("spanId"))
        if all(identity):
            if identity in seen_spans:
                duplicate_exported_spans += 1
                continue
            seen_spans.add(identity)
        name = span.get("name") or ""
        attrs = _attrs(span)

        # Track overall session bounds for wall-time reporting.
        span_bounds_ns: tuple[int, int] | None = None
        try:
            s = int(span["startTimeUnixNano"])
            e = int(span["endTimeUnixNano"])
            session_start = s if session_start is None else min(session_start, s)
            session_end = e if session_end is None else max(session_end, e)
            span_bounds_ns = (s, e)
        except KeyError, ValueError, TypeError:
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
            in_tok = _token_count(attrs.get("gen_ai.usage.input_tokens"))
            out_tok = _token_count(attrs.get("gen_ai.usage.output_tokens"))
            row = tokens_by_model[model]
            row["calls"] += 1
            if in_tok is not None:
                row["input"] += in_tok
                row["input_samples"] += 1
                input_buckets[_bucket(in_tok)] += 1
                per_call_inputs.append(in_tok)
                max_input_per_call = max(max_input_per_call, in_tok)
            if out_tok is not None:
                row["output"] += out_tok
                row["output_samples"] += 1
            agent_chat_wall += _duration_s(span)
            if span_bounds_ns is not None:
                chat_intervals_ns.append(span_bounds_ns)
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
            dur_s = _duration_s(span)
            if span_bounds_ns is not None and tname not in ("vscode_askQuestions", "runSubagent"):
                tool_intervals_ns.append(span_bounds_ns)
            if dur_s >= 60.0 and tname not in ("vscode_askQuestions", "runSubagent"):
                tool_stalls_over_60s += 1
            args_blob = str(attrs.get("gen_ai.tool.call.arguments", ""))
            result_blob = str(attrs.get("gen_ai.tool.call.result", ""))
            tool_payload_bytes[tname] += len(args_blob.encode("utf-8")) + len(result_blob.encode("utf-8"))
            if tname in ("mcp_azure_mcp_ser_pricing", "azure-mcp/pricing"):
                with contextlib.suppress(json.JSONDecodeError, TypeError):
                    parsed_args = json.loads(args_blob) if args_blob else {}
                    if isinstance(parsed_args, dict) and parsed_args.get("learn") is True:
                        pricing_learn_calls += 1
            if tname == "read_file":
                # Pull filePath out of the JSON arguments to map dupes.
                try:
                    args_obj = json.loads(args_blob) if args_blob else {}
                    fpath = args_obj.get("filePath") or "(unknown)"
                except json.JSONDecodeError, TypeError:
                    fpath = "(unparseable)"
                read_file_paths[fpath] += 1
            elif tname == "vscode_askQuestions":
                ask_durations.append(_duration_s(span))
                ask_in_phase += 1
            elif tname == "runSubagent":
                try:
                    arguments = json.loads(args_blob) if args_blob else {}
                    agent_name = arguments.get("agentName") if isinstance(arguments, dict) else None
                except json.JSONDecodeError, TypeError:
                    agent_name = None
                if not isinstance(agent_name, str) or not agent_name.strip():
                    agent_name = "(unknown)"
                duration = _duration_s(span)
                subagent_wall += duration
                subagent_calls.append({"name": agent_name, "duration_s": round(duration, 2)})
                continue

        # Subagent invocations.
        subagent_label = span.get("_jsonl_subagent") or (
            name if name in ("challenger-review-subagent", "execution_subagent", "cost-estimate-subagent") else None
        )
        if subagent_label:
            current = span
            visited = set()
            covered = identity in delegation_ancestors
            while not covered and current.get("parentSpanId"):
                parent = (current.get("traceId"), current["parentSpanId"])
                if parent in visited or parent not in spans_by_id:
                    break
                covered = parent in delegation_spans
                visited.add(parent)
                current = spans_by_id[parent]
            if covered:
                continue
            dur = _duration_s(span)
            subagent_wall += dur
            subagent_calls.append({"name": subagent_label, "duration_s": round(dur, 2)})

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
    input_samples = sum(row["input_samples"] for row in tokens_by_model.values())
    output_samples = sum(row["output_samples"] for row in tokens_by_model.values())
    avg_in = round(total_input / input_samples) if input_samples else 0
    if input_samples != total_calls or output_samples != total_calls:
        warnings.append("Token usage is incomplete: totals are observed lower bounds, not full-workflow cost evidence.")
    p50_in = int(median(per_call_inputs)) if per_call_inputs else 0
    session_wall = (session_end - session_start) / 1e9 if session_start and session_end else 0.0
    user_wait_wall = sum(ask_durations)

    # Build top-N readable lists from the wider counters.
    top_tool_payloads = sorted(
        ({"tool": t, "bytes": b} for t, b in tool_payload_bytes.items()),
        key=lambda r: r["bytes"],
        reverse=True,
    )[:10]
    duplicate_reads = [{"path": p, "count": c} for p, c in read_file_paths.most_common(20) if c > 1]

    return {
        "usage_coverage": {
            "input_samples": input_samples,
            "output_samples": output_samples,
            "chat_calls": total_calls,
            "complete": total_calls > 0 and input_samples == output_samples == total_calls,
            "duplicate_exported_spans": duplicate_exported_spans,
            "scope": "Observed chat spans only; missing child requests, cache billing and semantic parent rollups are not inferred.",
        },
        "totals": {
            "input_tokens": total_input,
            "output_tokens": total_output,
            "chat_calls": total_calls,
            "avg_input_per_call": avg_in,
            "p50_input_per_call": p50_in,
            "max_input_per_call": max_input_per_call,
            "askquestions_count": len(ask_durations),
            "subagent_invocations": len(subagent_calls),
            "challenger_invocations": sum(1 for c in subagent_calls if c["name"] == "challenger-review-subagent"),
            "error_spans_total": error_spans_raw_count,
            "error_spans_non_benign": len(error_spans),
            "pricing_learn_calls": pricing_learn_calls,
            "tool_stalls_over_60s": tool_stalls_over_60s,
        },
        "wall_time_s": {
            "session_total": round(session_wall, 1),
            "agent_chat": round(agent_chat_wall, 1),
            "agent_chat_union": round(_interval_union_s(chat_intervals_ns), 1),
            "tool_execution_union": round(_interval_union_s(tool_intervals_ns), 1),
            "subagent": round(subagent_wall, 1),
            "user_wait_askquestions": round(user_wait_wall, 1),
        },
        "tokens_by_model": {
            m: {
                "input": row["input"],
                "output": row["output"],
                "calls": row["calls"],
                "input_samples": row["input_samples"],
                "output_samples": row["output_samples"],
                "avg_input_per_call": round(row["input"] / row["input_samples"]) if row["input_samples"] else 0,
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
    lines.append("  Observed usage only; see usage_coverage in JSON before comparing complete workflows.")
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


def probe_evidence(spans: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize observed events without exporting instructions or tool payloads."""
    calls = []
    tools = []
    seen = {}
    duplicates = 0
    conflicts = 0
    for span in spans:
        identity = (span.get("traceId"), span.get("spanId"))
        if all(identity):
            fingerprint = hashlib.sha256(json.dumps(span, sort_keys=True).encode("utf-8")).hexdigest()
            if seen.get(identity) == fingerprint:
                duplicates += 1
                continue
            if identity in seen:
                conflicts += 1
            seen[identity] = fingerprint
        attributes = _attrs(span)
        operation = attributes.get("gen_ai.operation.name")
        timestamp = _token_count(span.get("startTimeUnixNano"))
        if operation == "chat":
            calls.append({"model": attributes.get("gen_ai.request.model"), "start_time_ns": timestamp})
        elif operation == "execute_tool":
            tools.append(
                {
                    "tool": attributes.get("gen_ai.tool.name") or span.get("name"),
                    "start_time_ns": timestamp,
                    "invocation_attribution": "unknown",
                }
            )
    first_chat = min((call["start_time_ns"] for call in calls if call["start_time_ns"] is not None), default=None)
    for tool in tools:
        start = tool["start_time_ns"]
        tool["before_first_model_request"] = (
            start < first_chat if start is not None and first_chat is not None else None
        )
    return {
        "model_requests": calls,
        "tool_events": tools,
        "duplicate_spans_omitted": duplicates,
        "conflicting_span_ids": conflicts,
        "prompt_response_source": "not extracted",
        "verdict": "requires review",
        "limitations": [
            "Timing does not establish whether a tool was invoked by the model or harness.",
            "Missing events do not prove export completeness or successful workflow enforcement.",
            "Model and tool names remain visible; review all output before sharing.",
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("log", type=Path, help="Path to OTel debug log JSON")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text")
    parser.add_argument("--probe-evidence", action="store_true", help="Emit payload-free probe evidence as JSON")
    parser.add_argument("--reviewed-prompt", type=Path, help="Separately supplied, manually redacted prompt text")
    parser.add_argument("--reviewed-response", type=Path, help="Separately supplied, manually redacted response text")
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
    if bool(args.reviewed_prompt) != bool(args.reviewed_response):
        parser.error("--reviewed-prompt and --reviewed-response must be supplied together")
    if args.reviewed_prompt and not args.probe_evidence:
        parser.error("reviewed text requires --probe-evidence")

    try:
        spans = load_spans(args.log)
        if args.probe_evidence:
            evidence = probe_evidence(spans)
            evidence["log_sha256"] = hashlib.sha256(args.log.read_bytes()).hexdigest()
            if args.reviewed_prompt:
                evidence["supplied_text"] = {
                    "source": "separately supplied; redaction and matching asserted by operator, not verified",
                    "prompt": args.reviewed_prompt.read_text(encoding="utf-8"),
                    "response": args.reviewed_response.read_text(encoding="utf-8"),
                }
            json.dump(evidence, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
            return 0
    except (OSError, ValueError) as exc:
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
