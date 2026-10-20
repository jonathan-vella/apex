#!/usr/bin/env python3
"""Evaluate captured SDK telemetry, not workflow approval or deployment success.

Use an explicit native events.jsonl path, or discover the newest session belonging
to this repository. Missing usage, execution/resume evidence or a closed capture
fails acceptance. Historical logs remain readable but cannot certify the cutover.
Persist normalized metrics only; never copy/convert raw logs or mutate project state.

Exit codes: 0 on all-pass, 1 on failure/unknown evidence/IO error, 2 on argument errors.
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
BASELINES_DIR = REPO_ROOT / "agent-output" / "_baselines"

# Acceptance targets — these match smoke-run.md "What to capture" /
# "Acceptance criteria" exactly. Keep this table in sync.
TARGETS: dict[str, dict[str, Any]] = {
    "askquestions_count": {
        # Captured-scope threshold; individual findings remain separate typed fields.
        "max": 20,
        "label": "ask_user count (captured scope)",
        "from": "totals.askquestions_count",
    },
    "max_input_per_call": {
        "max": 110_000,
        "label": "Max input tokens / call",
        "from": "totals.max_input_per_call",
        "soft": True,  # not in smoke-run.md acceptance list — informational
    },
    "native_log": {
        "expected": "copilot-sdk",
        "label": "Native SDK log",
        "from": "native_evidence.format",
    },
    "usage_complete": {
        "expected": True,
        "label": "Observed call usage complete",
        "from": "usage_coverage.complete",
    },
    "scope_closed": {
        "expected": True,
        "label": "Captured session closed",
        "from": "native_evidence.session_closed",
    },
    "incomplete_operations": {
        "max": 0,
        "label": "Unpaired/incomplete operations",
        "from": "native_evidence.incomplete_operations",
    },
    "usage_attribution": {
        "max": 0,
        "label": "Unattributed usage records",
        "from": "native_evidence.unattributed_usage",
    },
    "errors": {
        "max": 0,
        "label": "Non-benign errors",
        "from": "totals.error_spans_non_benign",
    },
    "worker_first_input": {
        "max": 45_000,
        "label": "First execution input / worker",
        "from": "_computed.max_first_execution_input_tokens",
    },
    "resume_recovery": {
        "expected": True,
        "label": "Resumed worker recall recovery",
        "from": "_computed.resume_recall_verified",
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
# Repository-scoped native discovery; no raw export
# ---------------------------------------------------------------------------


def find_live_debug_log() -> Path | None:
    """Return the newest native log belonging to this repository only."""
    profiler = _load_module(PROFILER, "profile_debug_log")
    candidates = profiler.discover_sdk_logs(REPO_ROOT)
    return candidates[-1] if candidates else None


def jsonl_to_otel(jsonl_path: Path) -> dict[str, Any]:
    """Compatibility wrapper for historical callers; never used for SDK acceptance."""
    profiler = _load_module(PROFILER, "profile_debug_log")
    spans = profiler.load_spans(jsonl_path)
    if any(span.get("_source_format") == "copilot-sdk" for span in spans):
        raise ValueError("profile native SDK logs directly, without OTel conversion")
    return {
        "resourceSpans": [{"scopeSpans": [{"spans": spans}]}],
        "copilotChat": {"source": "historical-jsonl", "sourceFile": str(jsonl_path)},
    }


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
    """Historical compatibility diagnostic only; never used for SDK acceptance.

    Infer legacy post-/clear signals, without claiming a native context boundary.

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
            except TypeError, ValueError:
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
            status = "UNKNOWN"
            detail = "required evidence missing"
        elif "max" in target:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                status = "FAIL"
                detail = "metric must be numeric"
            elif value > target["max"]:
                status = "FAIL"
                detail = f"{value} > target {target['max']}"
            elif isinstance(value, (int, float)):
                detail = f"{value} ≤ target {target['max']}"
        elif "expected" in target:
            if type(value) is not type(target["expected"]) or value != target["expected"]:
                status = "FAIL"
                detail = f"got {value!r}, expected {target['expected']!r}"
            else:
                detail = f"matches {target['expected']!r}"

        # Soft targets never fail the run unless --strict
        if status == "FAIL" and target.get("soft") and not strict:
            status = "WARN"

        if status in ("FAIL", "UNKNOWN"):
            all_pass = False
        if status == "WARN" and strict:
            all_pass = False

        rows.append({"key": key, "label": target["label"], "status": status, "value": value, "detail": detail})

    return rows, all_pass


def render_table(rows: list[dict[str, Any]]) -> str:
    glyph = {"PASS": "✓", "FAIL": "✗", "WARN": "!", "UNKNOWN": "?"}
    lines = [f"  {glyph[r['status']]:<2} {r['status']:<5} {r['label']:<38} {r['detail']}" for r in rows]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "log",
        nargs="?",
        type=Path,
        default=None,
        help="Native events.jsonl path; otherwise discover the newest repository-scoped session.",
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
        "--no-auto-discovery",
        "--no-auto-export",
        dest="no_auto_discovery",
        action="store_true",
        help="Require an explicit log path (--no-auto-export is a compatibility alias).",
    )
    args = parser.parse_args(argv)

    today_iso = date.today().isoformat()
    log_path = args.log
    if log_path is None and not args.no_auto_discovery:
        log_path = find_live_debug_log()
        if log_path is not None:
            print(f"# Selected repository-scoped native log: {log_path}")
    if log_path is None:
        print(
            "error: no explicit log or discoverable repository-scoped native session.\n"
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
        metrics = profiler.profile(spans)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    # Per-step challenger budget.
    try:
        metrics["_computed"] = profiler.sdk_execution_metrics(spans)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

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
    if out_path.resolve() == log_path.resolve():
        print("error: profiler output must not overwrite the source log", file=sys.stderr)
        return 1
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n")
    except OSError as exc:
        print(f"error: cannot save profiler output: {exc}", file=sys.stderr)
        return 1
    try:
        display = out_path.relative_to(REPO_ROOT)
    except ValueError:
        display = out_path
    print(f"\nSaved profiler output → {display}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
