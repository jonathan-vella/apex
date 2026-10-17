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
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AGENT = REPO_ROOT / ".github" / "agents" / "02-requirements.agent.md"

REQUIRED_HEADING = "P0 directive — batch independent questions (Plan 01 Phase 4)"

# Substring fragments that prove the numbered example is intact. Order
# does not matter, but all six headers must be present.
REQUIRED_HEADERS = (
    "project_name",
    "industry",
    "company_size",
    "region_pin",
    "compliance",
    "iac_tool",
)


def validate(agent_path: Path) -> list[str]:
    failures: list[str] = []
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]

    if REQUIRED_HEADING not in body:
        failures.append(
            f"{agent_path}: missing P0 directive heading\n  expected: {REQUIRED_HEADING!r}",
        )

    directive = body.partition(REQUIRED_HEADING)[2]
    match = re.search(r"```json\n(.*?)\n```", directive, re.DOTALL)
    if not match or "ask_user" not in directive:
        failures.append(
            f"{agent_path}: no ask_user example block found near the P0 directive",
        )
    else:
        try:
            example = json.loads(match.group(1))
            properties = example["requestedSchema"]["properties"]
            if not isinstance(properties, dict) or not isinstance(example.get("message"), str):
                raise ValueError("message and requestedSchema.properties are required")
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            failures.append(f"{agent_path}: invalid ask_user example: {exc}")
        else:
            missing = [key for key in REQUIRED_HEADERS if key not in properties]
            if missing:
                failures.append(
                    f"{agent_path}: ask_user example is missing required properties: {', '.join(missing)}",
                )
            invalid = [
                key
                for key, field in properties.items()
                if not isinstance(field, dict) or field.get("type") != "string" or not field.get("title")
            ]
            if invalid:
                failures.append(f"{agent_path}: untyped or untitled fields: {', '.join(invalid)}")
        if "questions[]" in directive:
            failures.append(
                f"{agent_path}: retired questions[] contract remains in the batching directive",
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
