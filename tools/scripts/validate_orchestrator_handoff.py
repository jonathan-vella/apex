#!/usr/bin/env python3
"""Validate native interaction, durable completion and separate human gates.

The CLI name is a compatibility alias, not a requirement for UI handoffs.
This source lint does not certify runtime permissions or task continuation.
Exit codes: 0 on pass, 1 on missing/retired contracts, 2 on CLI errors.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = REPO_ROOT / ".github" / "agents"
DEFAULT_AGENT = AGENTS_DIR / "01-orchestrator.agent.md"

# Diagnostic and audit agents do not own a workflow-step completion.
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

RETIRED_CONTRACT = re.compile(
    r"\b(?:APEX_WORKER_HANDSHAKE|WORKER_READY(?:_ACK)?|WORKER_EXECUTE|HANDSHAKE_VERIFIED|READY_VERIFIED)\b"
    r"|verify-worker-ready\.mjs"
)
ORCHESTRATOR_REQUIRED_FRAGMENTS = (
    "00-handoff.md",
    "ask_user",
    "USER_INPUT_REQUIRED",
    "apex-recall transition",
    "apex-recall checkpoint",
)
STEP_REQUIRED_FRAGMENTS = (
    "apex-recall",
    "USER_INPUT_REQUIRED",
    "request_id",
    "phase",
    "message",
    "requestedSchema.properties",
    "ask_user",
)


def _validate(agent_path: Path, required: tuple[str, ...]) -> list[str]:
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]
    failures = [
        f"{agent_path}: missing native contract field {fragment!r}" for fragment in required if fragment not in body
    ]
    for match in RETIRED_CONTRACT.finditer(body):
        failures.append(f"{agent_path}: retired worker preflight contract {match.group()!r}")
    if re.search(r"(?m)^handoffs\s*:", body):
        failures.append(f"{agent_path}: production agents must omit UI handoffs")
    if "Run `/clear`" in body or "handoff buttons only" in body:
        failures.append(f"{agent_path}: retired Local routing requirement")
    return failures


def validate_orchestrator(agent_path: Path) -> list[str]:
    """Check native interaction and durable, separately approved transitions."""
    return _validate(agent_path, ORCHESTRATOR_REQUIRED_FRAGMENTS)


def validate_step_agent(agent_path: Path) -> list[str]:
    """Check pending input fields and recoverable, non-approving completion."""
    return _validate(agent_path, STEP_REQUIRED_FRAGMENTS)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "agent",
        nargs="?",
        type=Path,
        default=None,
        help=("Path to a specific agent file (default: scan orchestrator + all step agents listed in STEP_AGENTS)"),
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
        print("✗ native interaction/completion contract check FAILED", file=sys.stderr)
        for _path, msgs in all_failures:
            for msg in msgs:
                print(f"  - {msg}", file=sys.stderr)
        print(
            "\nFix: retain native question, checkpoint, completion and human-gate contracts; "
            "remove retired worker preflights and UI handoff metadata.",
            file=sys.stderr,
        )
        return 1

    print(f"✓ native interaction/completion contract present in {len(checked)} agent file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
