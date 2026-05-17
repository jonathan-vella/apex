#!/usr/bin/env python3
"""Plan 01 Phase 2b: challenger-loop ceiling guard.

Two modes:

  - default (`ceiling` check): a pre-action lint that asserts the
    canonical ceiling table and the three askQuestions option labels
    are present in 01-orchestrator.agent.md and 10-challenger.agent.md.
    Hard fail. Wired into `validate:agents` via `validate:_node`.

  - `--budget LOGFILE` (post-action check): parses an OTel debug log,
    counts `challenger-review-subagent` invocations per step (using
    `turn_start:N` markers as step boundaries), and reports whether
    any step exceeded the default-depth ceiling of 2. Informational
    only — exit 0 — unless `--strict` is set.

Usage:

    python3 tools/scripts/validate_review_ceiling.py
    python3 tools/scripts/validate_review_ceiling.py --budget logs/test04-01.json
    python3 tools/scripts/validate_review_ceiling.py --budget logs/test04-01.json --strict

Exit codes: 0 on pass, 1 on a lint failure (or `--strict` budget
violation), 2 on argparse / IO errors.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ORCHESTRATOR = REPO_ROOT / ".github" / "agents" / "01-orchestrator.agent.md"
CHALLENGER = REPO_ROOT / ".github" / "agents" / "10-challenger.agent.md"

# Ceiling-table evidence. The substrings are deliberately minimal so
# cosmetic wording around them stays free.
ORCHESTRATOR_REQUIRED = (
    "Challenger-invocation ceiling",
    "challenger_invocations_<step>",
    '"Accept findings"',
    '"Override ceiling"',
    '"Abort step"',
)

CHALLENGER_REQUIRED = (
    "Challenger-invocation ceiling",
    "challenger_invocations_<step>",
)

# Default-depth ceiling for the budget check.
DEFAULT_CEILING = 2


def check_ceiling_contract() -> list[str]:
    """Lint the orchestrator + challenger bodies for ceiling evidence."""
    failures: list[str] = []
    for path, required in (
        (ORCHESTRATOR, ORCHESTRATOR_REQUIRED),
        (CHALLENGER, CHALLENGER_REQUIRED),
    ):
        try:
            body = path.read_text()
        except OSError as exc:
            failures.append(f"cannot read {path}: {exc}")
            continue
        for frag in required:
            if frag not in body:
                failures.append(f"{path}: missing required substring: {frag!r}")
    return failures


def count_challenger_per_step(log_path: Path) -> dict[str, int]:
    """Count challenger-review-subagent invocations between turn_start:N markers."""
    try:
        raw = json.loads(log_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read OTel log {log_path}: {exc}") from exc

    spans: list[dict] = []
    for rs in raw.get("resourceSpans", []):
        for ss in rs.get("scopeSpans", []):
            spans.extend(ss.get("spans", []))

    # Linear scan: track current step from the most recent turn_start:N.
    counts: Counter[str] = Counter()
    current = "pre-step-0"
    for s in spans:
        name = s.get("name") or ""
        if name.startswith("turn_start:"):
            current = name.split(":", 1)[1]
            counts.setdefault(current, 0)
        elif name == "challenger-review-subagent":
            counts[current] += 1
    return dict(counts)


def budget_check(log_path: Path, *, ceiling: int = DEFAULT_CEILING) -> tuple[dict[str, int], list[str]]:
    """Return (per-step counts, list of violations)."""
    per_step = count_challenger_per_step(log_path)
    violations = [f"step {step}: {n} invocations > ceiling {ceiling}" for step, n in per_step.items() if n > ceiling]
    return per_step, violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--budget",
        type=Path,
        default=None,
        help="OTel log file to budget-check (post-action mode); skips contract lint",
    )
    parser.add_argument(
        "--ceiling",
        type=int,
        default=DEFAULT_CEILING,
        help=f"Per-step challenger ceiling (default: {DEFAULT_CEILING}, the default-depth value)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 on budget violations (default: warn only)",
    )
    args = parser.parse_args(argv)

    if args.budget is None:
        failures = check_ceiling_contract()
        if failures:
            print("✗ challenger-ceiling contract check FAILED", file=sys.stderr)
            for msg in failures:
                print(f"  - {msg}", file=sys.stderr)
            print(
                "\nFix: restore the 'Challenger-invocation ceiling' subsection "
                "in 01-orchestrator.agent.md and the matching note in "
                "10-challenger.agent.md.",
                file=sys.stderr,
            )
            return 1
        print("✓ challenger-ceiling contract present in orchestrator + challenger")
        return 0

    # Budget mode.
    try:
        per_step, violations = budget_check(args.budget, ceiling=args.ceiling)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"# challenger budget for {args.budget}")
    if not per_step:
        print("  no challenger invocations recorded")
    for step, n in sorted(per_step.items()):
        marker = " !!" if n > args.ceiling else ""
        print(f"  step {step}: {n}{marker}")
    if violations:
        print(f"\n⚠ {len(violations)} step(s) exceed the ceiling of {args.ceiling}:", file=sys.stderr)
        for v in violations:
            print(f"  - {v}", file=sys.stderr)
        return 1 if args.strict else 0
    print(f"\n✓ all steps within ceiling ({args.ceiling})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
