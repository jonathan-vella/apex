#!/usr/bin/env python3
"""Validate the `/clear`-handoff contract in 01-orchestrator.agent.md.

Plan 01 Phase 2a (Gate-boundary `/clear` handoff) requires that the
orchestrator's Gate-acceptance procedure documents the verbatim resume
line. This script greps the agent body for that line and fails fast if
it has been removed or paraphrased.

The verbatim contract is the only token-reduction primitive that
actually drops main-agent input tokens, so the lint is hard-fail.

Wired into:

    npm run validate:agents       (via validate-agents.mjs)
    npm run validate:orchestrator-handoff   (standalone)

Exit codes: 0 on pass, 1 on a missing-or-paraphrased contract,
2 on argparse / IO errors.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AGENT = REPO_ROOT / ".github" / "agents" / "01-orchestrator.agent.md"

# Verbatim primary contract line. ``<project>`` and ``N+1`` are the
# placeholders that survive into the rendered chat; the orchestrator
# substitutes them at runtime.
REQUIRED_LINE = (
    "Run `/clear` then reply `@01-Orchestrator resume <project>` "
    "to continue Step N+1."
)

# Supporting contract fragments that must appear at least once. These
# are deliberately small substrings so cosmetic re-wording around them
# does not break the lint.
REQUIRED_FRAGMENTS = (
    "apex-recall show <project> --json",   # resume path first tool call
)


def validate(agent_path: Path) -> list[str]:
    """Return a list of failure messages (empty on success)."""
    failures: list[str] = []
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]

    if REQUIRED_LINE not in body:
        failures.append(
            f"missing verbatim resume line in {agent_path}\n"
            f"  expected exactly: {REQUIRED_LINE}",
        )

    # The "Gate-acceptance procedure" heading is the canonical anchor
    # for the contract. Check for either spelling.
    if "Gate-acceptance procedure" not in body and "Gate Acceptance" not in body:
        failures.append(
            f"missing Gate-acceptance procedure subsection in {agent_path}",
        )

    if "apex-recall checkpoint" not in body:
        failures.append(
            f"missing apex-recall checkpoint precondition in {agent_path} — "
            "the user's /clear destroys any state not persisted via apex-recall",
        )

    for frag in REQUIRED_FRAGMENTS:
        if frag not in body:
            failures.append(
                f"missing resume-path fragment in {agent_path}: {frag!r}",
            )

    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "agent",
        nargs="?",
        type=Path,
        default=DEFAULT_AGENT,
        help="Path to 01-orchestrator.agent.md (default: workspace canonical path)",
    )
    args = parser.parse_args(argv)

    failures = validate(args.agent)
    if failures:
        print("✗ orchestrator /clear-handoff contract check FAILED", file=sys.stderr)
        for msg in failures:
            print(f"  - {msg}", file=sys.stderr)
        print(
            "\nFix: restore the verbatim resume line in the Gate-acceptance "
            "procedure subsection. See "
            ".github/skills/context-management/references/compression-templates.md "
            "for the contract.",
            file=sys.stderr,
        )
        return 1

    print(f"✓ orchestrator /clear-handoff contract present in {args.agent.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
