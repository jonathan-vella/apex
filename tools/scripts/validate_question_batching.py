#!/usr/bin/env python3
"""Plan 01 Phase 4: question-batching contract guard.

Pre-action lint that asserts 02-requirements.agent.md retains the
P0 batching directive and the numbered 6-question example. Removing
or paraphrasing them is the most common path back to the N-times-per-
phase askQuestions anti-pattern.

Wired into:

    npm run validate:question-batching   (standalone)
    npm run validate:_node               (aggregate)

Exit codes: 0 on pass, 1 on missing-or-paraphrased contract.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AGENT = REPO_ROOT / ".github" / "agents" / "02-requirements.agent.md"

REQUIRED_HEADING = "P0 directive — batch independent questions (Plan 01 Phase 4)"

# Substring fragments that prove the numbered example is intact. Order
# does not matter, but all six headers must be present.
REQUIRED_HEADERS = (
    '"project_name"',
    '"industry"',
    '"company_size"',
    '"region_pin"',
    '"compliance"',
    '"iac_tool"',
)


def validate(agent_path: Path) -> list[str]:
    failures: list[str] = []
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]

    if REQUIRED_HEADING not in body:
        failures.append(
            f"{agent_path}: missing P0 directive heading\n"
            f"  expected: {REQUIRED_HEADING!r}",
        )

    # Confirm a single askQuestions call carries all six required
    # headers — guards against the directive surviving while the
    # example is mangled into separate calls.
    match = re.search(r"askQuestions\(\{[^}]*questions:\s*\[(.+?)\]\s*\}\)", body, re.DOTALL)
    if not match:
        failures.append(
            f"{agent_path}: no askQuestions example block found near the P0 directive",
        )
    else:
        example = match.group(1)
        missing = [h for h in REQUIRED_HEADERS if h not in example]
        if missing:
            failures.append(
                f"{agent_path}: askQuestions example is missing required headers: {', '.join(missing)}",
            )

    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "agent",
        nargs="?",
        type=Path,
        default=DEFAULT_AGENT,
        help="Path to 02-requirements.agent.md (default: workspace canonical path)",
    )
    args = parser.parse_args(argv)

    failures = validate(args.agent)
    if failures:
        print("✗ question-batching contract check FAILED", file=sys.stderr)
        for msg in failures:
            print(f"  - {msg}", file=sys.stderr)
        print(
            "\nFix: restore the 'P0 directive — batch independent questions' "
            "subsection at the top of Phase 1, with the 6-question numbered "
            "example. See plan 01 §Phase 4.",
            file=sys.stderr,
        )
        return 1

    print(f"✓ question-batching contract present in {args.agent.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
