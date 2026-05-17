#!/usr/bin/env python3
"""Plan 01 smoke-run verifier — one-shot acceptance check.

Replaces the manual "Capture + verify" step in
`tests/integration/smoke-run.md` (§4):

  1. Pick the OTel log (explicit path, or newest under ``logs/``).
  2. Run the profiler programmatically.
  3. Run the review-ceiling budget check programmatically.
  4. Evaluate every acceptance target from smoke-run.md and print a
     PASS/FAIL table.
  5. Save the profiler JSON under
     ``agent-output/_baselines/smoke-<date>.json`` for diff-vs-baseline
     tracking.

Exit codes: 0 on all-pass, 1 on any failure (or IO error), 2 on
argparse error.

The only manual step still required is the OTel export from the VS
Code Copilot Chat command palette — that data is owned by the chat
client, no agent or script can pull it without user action.

Usage::

    npm run smoke:verify -- logs/smoke-2026-05-17.json
    npm run smoke:verify                # auto-pick newest log under logs/
    npm run smoke:verify -- --strict    # also fail on warnings
"""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
PROFILER = REPO_ROOT / "tools" / "scripts" / "profile_debug_log.py"
CEILING = REPO_ROOT / "tools" / "scripts" / "validate_review_ceiling.py"
BASELINES_DIR = REPO_ROOT / "agent-output" / "_baselines"

# Acceptance targets — these match smoke-run.md "What to capture" /
# "Acceptance criteria" exactly. Keep this table in sync.
TARGETS: dict[str, dict[str, Any]] = {
    "askquestions_count": {
        # Bumped 10 → 20 (2026-05-17): the per-finding decision protocol
        # mandates one askQuestions per challenger finding (no multiSelect
        # batching). Multi-pass review flows legitimately exceed 10 prompts.
        # Keep in sync with tests/integration/smoke-run.md.
        "max": 20,
        "label": "askQuestions count (Step 1)",
        "from": "totals.askquestions_count",
    },
    "max_input_per_call": {
        "max": 110_000,
        "label": "Max input tokens / call",
        "from": "totals.max_input_per_call",
        "soft": True,  # not in smoke-run.md acceptance list — informational
    },
    "inter_clear_spans": {
        "max": 50,
        "label": "Inter-/clear chat-span max",
        "from": "compliance_metrics.max_chat_spans_between_clears",
    },
    "post_clear_first_input": {
        "max": 45_000,
        "label": "Post-/clear first input tokens",
        "from": "_computed.post_clear_first_input_tokens",
    },
    "post_clear_first_tool": {
        "expected": "apex-recall show",
        "label": "Post-/clear first tool call",
        "from": "_computed.post_clear_first_tool_signature",
    },
    "challenger_max_per_step": {
        "max": 2,
        "label": "Challenger invocations / step",
        "from": "_computed.challenger_max_per_step",
    },
}


def _load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


# ---------------------------------------------------------------------------
# Auto-export: discover + convert VS Code Copilot Chat live debug logs
# ---------------------------------------------------------------------------

# Live debug logs live in JSONL under VS Code's workspaceStorage. The
# command palette "Copilot: Export debug log" produces the OTel
# resourceSpans envelope this script already understands; the live
# JSONL is a different shape and needs translation before profiling.
LIVE_LOG_GLOB = "~/.vscode-server/data/User/workspaceStorage/*/GitHub.copilot-chat/debug-logs/*/main.jsonl"


def find_live_debug_log() -> Path | None:
    """Return the newest live ``main.jsonl`` across all workspace sessions."""
    import glob

    candidates = [Path(p) for p in glob.glob(str(Path(LIVE_LOG_GLOB).expanduser()))]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def _typed_attr(key: str, value: Any) -> dict[str, Any]:
    """Wrap a value in the OTel typed-attribute shape the profiler expects."""
    if isinstance(value, bool):
        wrap = {"boolValue": value}
    elif isinstance(value, int):
        wrap = {"intValue": value}
    elif isinstance(value, float):
        wrap = {"doubleValue": value}
    else:
        wrap = {"stringValue": str(value)}
    return {"key": key, "value": wrap}


# Subagent name normalisation: the live JSONL emits
# ``runSubagent-challenger-review-subagent`` as a ``child_session_ref``;
# the canonical OTel exports use bare ``challenger-review-subagent`` as
# the span name. The profiler + ceiling validator only look for the
# canonical name, so we strip the prefix on import.
_CANONICAL_SUBAGENT_NAMES = {
    "challenger-review-subagent",
    "execution_subagent",
}


def _normalize_span_name(rec: dict[str, Any]) -> str:
    """Map JSONL ``name`` → OTel span name where translations differ."""
    name = rec.get("name") or ""
    if rec.get("type") == "child_session_ref" and name.startswith("runSubagent-"):
        # runSubagent-challenger-review-subagent → challenger-review-subagent
        stripped = name[len("runSubagent-") :]
        if stripped in _CANONICAL_SUBAGENT_NAMES:
            return stripped
        # Otherwise treat as a generic execution subagent invocation so
        # the profiler still counts the subagent_invocations metric.
        return "execution_subagent"
    return name


def _build_otel_attrs(rec: dict[str, Any]) -> list[dict[str, Any]]:
    """Translate JSONL ``attrs`` into the gen_ai.* keys the profiler reads."""
    raw_attrs = rec.get("attrs") or {}
    # Some attr blobs are serialised as a Python-repr string (e.g.
    # ``"{'args': '{\\"operation\\":...}'}"``). json.loads can't parse
    # that; eval would be unsafe. Best-effort: only consume dict-shaped
    # attrs; otherwise emit a synthetic stringValue so the data still
    # appears in the OTel form for diagnostics.
    if isinstance(raw_attrs, str):
        try:
            raw_attrs = json.loads(raw_attrs)
        except json.JSONDecodeError:
            return [_typed_attr("copilot.raw_attrs", raw_attrs[:500])]
    if not isinstance(raw_attrs, dict):
        return []

    out: list[dict[str, Any]] = []
    rtype = rec.get("type") or ""

    if rtype == "llm_request":
        out.append(_typed_attr("gen_ai.operation.name", "chat"))
        if "model" in raw_attrs:
            out.append(_typed_attr("gen_ai.request.model", raw_attrs["model"]))
        if "inputTokens" in raw_attrs:
            with contextlib.suppress(TypeError, ValueError):
                out.append(_typed_attr("gen_ai.usage.input_tokens", int(raw_attrs["inputTokens"])))
        if "outputTokens" in raw_attrs:
            with contextlib.suppress(TypeError, ValueError):
                out.append(_typed_attr("gen_ai.usage.output_tokens", int(raw_attrs["outputTokens"])))
    elif rtype == "tool_call":
        out.append(_typed_attr("gen_ai.operation.name", "execute_tool"))
        out.append(_typed_attr("gen_ai.tool.name", rec.get("name") or ""))
        if "args" in raw_attrs:
            out.append(_typed_attr("gen_ai.tool.call.arguments", raw_attrs["args"]))
        if "result" in raw_attrs:
            out.append(_typed_attr("gen_ai.tool.call.result", raw_attrs["result"]))

    return out


def jsonl_to_otel(jsonl_path: Path) -> dict[str, Any]:
    """Convert a Copilot Chat live ``main.jsonl`` to the OTel envelope.

    The output matches the shape produced by VS Code's
    "Copilot: Export debug log" palette command, which is what
    ``profile_debug_log.py`` already parses. This lets us skip the
    manual export step entirely.
    """
    spans: list[dict[str, Any]] = []
    session_id: str | None = None
    with jsonl_path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if session_id is None:
                session_id = rec.get("sid")
            ts_ms = int(rec.get("ts", 0))
            dur_ms = int(rec.get("dur", 0))
            ts_ns = ts_ms * 1_000_000
            end_ns = (ts_ms + dur_ms) * 1_000_000
            status_code = 0 if rec.get("status") == "ok" else 2
            spans.append(
                {
                    "traceId": "",
                    "spanId": rec.get("spanId", ""),
                    "parentSpanId": rec.get("parentSpanId", ""),
                    "name": _normalize_span_name(rec),
                    "kind": 1,
                    "startTimeUnixNano": str(ts_ns),
                    "endTimeUnixNano": str(end_ns),
                    "attributes": _build_otel_attrs(rec),
                    "events": [],
                    "status": {"code": status_code},
                },
            )

    return {
        "resourceSpans": [
            {
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "vscode.copilotChat"}},
                        {"key": "copilot.source", "value": {"stringValue": "jsonl-import"}},
                    ],
                },
                "scopeSpans": [
                    {
                        "scope": {"name": "copilotChat.jsonl-import"},
                        "spans": spans,
                    },
                ],
            },
        ],
        "copilotChat": {
            "source": "jsonl",
            "sessionId": session_id,
            "sourceFile": str(jsonl_path),
        },
    }


def auto_export_log(date_iso: str | None = None) -> Path | None:
    """Locate the newest live JSONL, convert to OTel, save under logs/.

    Returns the path to the converted log on success, or ``None`` if
    no live debug log was discoverable.
    """
    src = find_live_debug_log()
    if src is None:
        return None
    iso = date_iso or date.today().isoformat()
    out_dir = REPO_ROOT / "logs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"smoke-{iso}.json"
    envelope = jsonl_to_otel(src)
    out_path.write_text(json.dumps(envelope, separators=(",", ":")) + "\n")
    return out_path


def find_newest_log() -> Path | None:
    """Return the newest .json log under ``logs/`` (excluding subfolders)."""
    logs_dir = REPO_ROOT / "logs"
    if not logs_dir.is_dir():
        return None
    candidates = [p for p in logs_dir.iterdir() if p.is_file() and p.suffix == ".json"]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def compute_post_clear_signals(spans: list[dict[str, Any]]) -> dict[str, Any]:
    """Detect the post-/clear boundary and extract the two first-call signals.

    The VS Code chat client emits a ``SessionStart`` span at the
    beginning of every chat session. A user-driven `/clear` followed
    by a new prompt therefore produces a second ``SessionStart``. We
    take the *last* ``SessionStart`` whose index > 0 as the post-clear
    boundary and return:

      - the input-token count of the first ``chat:*`` span after it,
      - the tool name + args signature of the first ``execute_tool``
        span after it (so the validator can confirm it was
        ``apex-recall show <project> --json``).

    Returns sentinel ``None`` values when no post-clear boundary
    exists — that case is reported as "no `/clear` seen" rather than a
    hard fail.
    """
    session_starts = [i for i, s in enumerate(spans) if (s.get("name") or "") == "SessionStart"]
    if len(session_starts) < 2:
        return {
            "post_clear_seen": False,
            "post_clear_first_input_tokens": None,
            "post_clear_first_tool_signature": None,
        }

    boundary = session_starts[-1]
    first_input: int | None = None
    first_tool: str | None = None

    for s in spans[boundary + 1 :]:
        name = s.get("name") or ""
        attrs = {a.get("key"): (a.get("value") or {}) for a in s.get("attributes", []) or []}

        def _scalar(key: str, _attrs: dict = attrs) -> Any:
            v = _attrs.get(key) or {}
            for typed in ("stringValue", "intValue", "doubleValue", "boolValue"):
                if typed in v:
                    val = v[typed]
                    if typed == "intValue" and isinstance(val, str):
                        with contextlib.suppress(ValueError):
                            val = int(val)
                    return val
            return None

        if first_input is None and name.startswith("chat:"):
            tok = _scalar("gen_ai.usage.input_tokens")
            try:
                first_input = int(tok) if tok is not None else None
            except (TypeError, ValueError):
                first_input = None
        if first_tool is None and _scalar("gen_ai.operation.name") == "execute_tool":
            tool_name = _scalar("gen_ai.tool.name") or name
            args = _scalar("gen_ai.tool.call.arguments") or ""
            # Compact signature so the report stays readable.
            first_tool = f"{tool_name}({str(args)[:120]})"

        if first_input is not None and first_tool is not None:
            break

    return {
        "post_clear_seen": True,
        "post_clear_first_input_tokens": first_input,
        "post_clear_first_tool_signature": first_tool,
    }


def _get_nested(d: dict, dotted: str) -> Any:
    cur: Any = d
    for part in dotted.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def evaluate(metrics: dict[str, Any], *, strict: bool = False) -> tuple[list[dict[str, Any]], bool]:
    """Return (rows, all_pass)."""
    rows: list[dict[str, Any]] = []
    all_pass = True

    for key, target in TARGETS.items():
        value = _get_nested(metrics, target["from"])
        status = "PASS"
        detail = ""

        if value is None:
            status = "SKIP"
            detail = "metric not present (e.g. no /clear in this log)"
        elif "max" in target:
            if isinstance(value, (int, float)) and value > target["max"]:
                status = "FAIL"
                detail = f"{value} > target {target['max']}"
            elif isinstance(value, (int, float)):
                detail = f"{value} ≤ target {target['max']}"
        elif "expected" in target:
            if not isinstance(value, str) or target["expected"] not in value:
                status = "FAIL"
                detail = f"got {value!r}, expected to contain {target['expected']!r}"
            else:
                detail = f"matches {target['expected']!r}"

        # Soft targets never fail the run unless --strict
        if status == "FAIL" and target.get("soft") and not strict:
            status = "WARN"

        if status == "FAIL":
            all_pass = False
        if status == "WARN" and strict:
            all_pass = False

        rows.append({"key": key, "label": target["label"], "status": status, "value": value, "detail": detail})

    return rows, all_pass


def render_table(rows: list[dict[str, Any]]) -> str:
    glyph = {"PASS": "✓", "FAIL": "✗", "WARN": "!", "SKIP": "·"}
    lines = [f"  {glyph[r['status']]:<2} {r['status']:<5} {r['label']:<38} {r['detail']}" for r in rows]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "log",
        nargs="?",
        type=Path,
        default=None,
        help="OTel log path. If omitted, auto-export the newest live JSONL "
        "debug log from VS Code Copilot Chat into logs/smoke-<date>.json.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat WARN rows as failures (exit 1)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Override profiler-output path (default: agent-output/_baselines/smoke-<date>.json)",
    )
    parser.add_argument(
        "--no-auto-export",
        action="store_true",
        help="Disable auto-export of the live JSONL debug log; require an explicit log path.",
    )
    args = parser.parse_args(argv)

    today_iso = date.today().isoformat()
    log_path = args.log
    if log_path is None and not args.no_auto_export:
        log_path = auto_export_log(today_iso)
        if log_path is not None:
            print(f"# Auto-exported live debug log → {log_path.relative_to(REPO_ROOT)}")
    if log_path is None:
        log_path = find_newest_log()
    if log_path is None:
        print(
            "error: no log path given, no live debug log auto-exportable, and "
            "no .json files under logs/.\n"
            "       Run a workflow session first, or pass an explicit log path.",
            file=sys.stderr,
        )
        return 1
    if not log_path.is_file():
        print(f"error: {log_path} does not exist", file=sys.stderr)
        return 1

    # Profile.
    profiler = _load_module(PROFILER, "profile_debug_log")
    try:
        spans = profiler.load_spans(log_path)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    metrics = profiler.profile(spans)

    # Per-step challenger budget.
    ceiling = _load_module(CEILING, "validate_review_ceiling")
    per_step = ceiling.count_challenger_per_step(log_path)
    max_per_step = max(per_step.values()) if per_step else 0

    # Post-/clear signals.
    post_clear = compute_post_clear_signals(spans)

    # Stitch everything into one report dict.
    metrics["_computed"] = {
        "challenger_per_step": per_step,
        "challenger_max_per_step": max_per_step,
        **post_clear,
    }

    rows, all_pass = evaluate(metrics, strict=args.strict)

    # Report.
    print(f"# Plan 01 smoke-verify — {log_path}")
    print()
    print(render_table(rows))
    print()
    verdict = "✅ ACCEPTANCE PASSED" if all_pass else "❌ ACCEPTANCE FAILED"
    print(verdict)

    # Persist.
    out_path = args.out or (BASELINES_DIR / f"smoke-{today_iso}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n")
    try:
        display = out_path.relative_to(REPO_ROOT)
    except ValueError:
        display = out_path
    print(f"\nSaved profiler output → {display}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
