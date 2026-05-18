#!/usr/bin/env python3
"""Validate the `/clear`-handoff contract across orchestrator + step agents.

Plan 01 Phase 2a (Gate-boundary `/clear` handoff) requires that the
orchestrator's Gate-acceptance procedure documents the verbatim resume
line. Phase 2c extends the contract to every user-facing step agent:
each must end its completion path with the same verbatim line so that
direct invocation (running a step agent on its own) still hands off
cleanly via the agent picker.

The line instructs the user to switch the VS Code chat agent picker
back to `01-Orchestrator` and send `resume <project>` — VS Code custom
agents are activated by selecting them in the picker, not by `@name`
chat-participant syntax. See
https://code.visualstudio.com/docs/copilot/customization/custom-agents.

The verbatim contract is the only token-reduction primitive that
actually drops main-agent input tokens, so the lint is hard-fail.

Wired into:

    npm run validate:agents       (via validate-agents.mjs)
    npm run validate:orchestrator-handoff   (standalone)
    lefthook pre-commit          (via artifact-validation hook)

Exit codes: 0 on pass, 1 on a missing-or-paraphrased contract,
2 on argparse / IO errors.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = REPO_ROOT / ".github" / "agents"
DEFAULT_AGENT = AGENTS_DIR / "01-orchestrator.agent.md"

# Step agents whose completion path must end with the verbatim resume
# line (covers direct-invocation flow). Excluded: 01-orchestrator (own
# stricter contract below), 10-challenger (subagent wrapper — no user
# gate), 09-diagnose / 11-context-optimizer (interactive/advisory —
# no step handoff), e2e-orchestrator (autonomous runner with its own
# contract).
STEP_AGENTS = (
    "02-requirements.agent.md",
    "03-architect.agent.md",
    "04-design.agent.md",
    "04g-governance.agent.md",
    "05-iac-planner.agent.md",
    "06b-bicep-codegen.agent.md",
    "06t-terraform-codegen.agent.md",
    "07b-bicep-deploy.agent.md",
    "07t-terraform-deploy.agent.md",
    "08-as-built.agent.md",
)

# Verbatim primary contract line. ``<project>`` and ``N+1`` are the
# placeholders that survive into the rendered chat; agents substitute
# them at runtime.
REQUIRED_LINE = (
    "Run `/clear`, then switch the chat agent picker to `01-Orchestrator` "
    "and send `resume <project>` to continue Step N+1."
)

# Supporting contract fragments that must appear at least once in the
# orchestrator file. These are deliberately small substrings so cosmetic
# re-wording around them does not break the lint.
ORCHESTRATOR_REQUIRED_FRAGMENTS = (
    "apex-recall show <project> --json",   # resume path first tool call
)


def validate_orchestrator(agent_path: Path) -> list[str]:
    """Strict contract for 01-orchestrator.agent.md."""
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

    if "Gate-acceptance procedure" not in body and "Gate Acceptance" not in body:
        failures.append(
            f"missing Gate-acceptance procedure subsection in {agent_path}",
        )

    if "apex-recall checkpoint" not in body:
        failures.append(
            f"missing apex-recall checkpoint precondition in {agent_path} — "
            "the user's /clear destroys any state not persisted via apex-recall",
        )

    for frag in ORCHESTRATOR_REQUIRED_FRAGMENTS:
        if frag not in body:
            failures.append(
                f"missing resume-path fragment in {agent_path}: {frag!r}",
            )

    return failures


def validate_step_agent(agent_path: Path) -> list[str]:
    """Lighter contract for step agents — verbatim line only.

    Orchestration logistics (Gate-acceptance procedure, apex-recall
    checkpoint, resume-path fragment) are the orchestrator's job. Step
    agents only need to terminate with the same verbatim handoff line
    so direct invocation still produces a `/clear`-safe transcript.
    """
    failures: list[str] = []
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]

    if REQUIRED_LINE not in body:
        failures.append(
            f"missing verbatim resume line in {agent_path}\n"
            f"  expected exactly: {REQUIRED_LINE}\n"
            f"  fix: append a `## Completion Handoff` section ending "
            f"with the line in a ```text fence",
        )

    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "agent",
        nargs="?",
        type=Path,
        default=None,
        help=(
            "Path to a specific agent file (default: scan orchestrator + all "
            "step agents listed in STEP_AGENTS)"
        ),
    )
    args = parser.parse_args(argv)

    all_failures: list[tuple[Path, list[str]]] = []
    checked: list[Path] = []

    if args.agent is not None:
        # Single-file mode: pick the right contract based on filename.
        path = args.agent
        checked.append(path)
        if path.name == "01-orchestrator.agent.md":
            failures = validate_orchestrator(path)
        else:
            failures = validate_step_agent(path)
        if failures:
            all_failures.append((path, failures))
    else:
        # Batch mode: orchestrator + every step agent.
        orch = DEFAULT_AGENT
        checked.append(orch)
        f = validate_orchestrator(orch)
        if f:
            all_failures.append((orch, f))
        for name in STEP_AGENTS:
            path = AGENTS_DIR / name
            checked.append(path)
            f = validate_step_agent(path)
            if f:
                all_failures.append((path, f))

    if all_failures:
        print("✗ orchestrator /clear-handoff contract check FAILED", file=sys.stderr)
        for path, msgs in all_failures:
            for msg in msgs:
                print(f"  - {msg}", file=sys.stderr)
        print(
            "\nFix: restore the verbatim resume line. See "
            ".github/skills/context-management/references/compression-templates.md "
            "for the contract.",
            file=sys.stderr,
        )
        return 1

    print(
        f"✓ orchestrator /clear-handoff contract present in {len(checked)} agent file(s)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
