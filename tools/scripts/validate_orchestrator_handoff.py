#!/usr/bin/env python3
"""Validate SDK worker readiness, durable completion and separate human gates.

This is a source-contract lint, not runtime routing certification. Runtime
evidence is checked by verify-worker-ready.mjs before project execution.
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

REQUIRED_LINE = "verify-worker-ready.mjs"
ORCHESTRATOR_REQUIRED_FRAGMENTS = (
    "apex-recall show <project> --json",
    "00-handoff.md",
    "ask_user",
    "mode: background",
    "APEX_WORKER_HANDSHAKE",
    "MODEL_VERIFIED",
    "WORKER_READY_ACK",
    "WORKER_EXECUTE",
    "USER_INPUT_REQUIRED",
    "apex-recall transition --complete",
)


def _section(body: str, heading: str) -> str:
    match = re.search(rf"(?m)^## {re.escape(heading)}\n([\s\S]*?)(?=^## |\Z)", body)
    return match.group(1) if match else ""


def validate_orchestrator(agent_path: Path) -> list[str]:
    """Strict contract for 01-orchestrator.agent.md."""
    failures: list[str] = []
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]

    routing = _section(body, "Harness Routing")
    if REQUIRED_LINE not in routing:
        failures.append(f"missing worker readiness verifier in Harness Routing: {agent_path}")

    if "Gate-acceptance procedure" not in body and "Gate Acceptance" not in body:
        failures.append(
            f"missing Gate-acceptance procedure subsection in {agent_path}",
        )

    if "apex-recall checkpoint" not in body:
        failures.append(
            f"missing apex-recall checkpoint precondition in {agent_path}",
        )

    for frag in ORCHESTRATOR_REQUIRED_FRAGMENTS:
        if frag not in body:
            failures.append(
                f"missing SDK routing fragment in {agent_path}: {frag!r}",
            )

    if "Run `/clear`" in body or "handoff buttons only" in body:
        failures.append(f"retired Local routing requirement in {agent_path}")
    return failures


def validate_step_agent(agent_path: Path) -> list[str]:
    """Check tool-free readiness and recoverable, non-approving completion."""
    failures: list[str] = []
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]

    entry = _section(body, "Harness Entry")
    completion = _section(body, "Completion Handoff")
    for fragment in (
        "APEX_WORKER_HANDSHAKE",
        "WORKER_READY",
        "WORKER_READY_ACK",
        "WORKER_EXECUTE",
        "USER_INPUT_REQUIRED",
        "worker-readiness.md",
    ):
        if fragment not in entry:
            failures.append(f"{agent_path}: missing Harness Entry fragment {fragment!r}")
    for fragment in (
        "apex-recall checkpoint",
        "00-handoff.md",
        "STEP_COMPLETE",
        "USER_INPUT_REQUIRED",
        "ask_user",
        "not next-step approval",
    ):
        if fragment not in completion:
            failures.append(f"{agent_path}: missing Completion Handoff fragment {fragment!r}")
    if "Run `/clear`" in body:
        failures.append(f"{agent_path}: retired Local completion ritual")
    return failures


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
        print("✗ SDK worker/gate handoff contract check FAILED", file=sys.stderr)
        for _path, msgs in all_failures:
            for msg in msgs:
                print(f"  - {msg}", file=sys.stderr)
        print(
            "\nFix: restore the readiness, checkpoint and human-gate contract. See "
            ".github/skills/apex-workflow-engine/references/worker-readiness.md.",
            file=sys.stderr,
        )
        return 1

    print(f"✓ SDK worker/gate handoff contract present in {len(checked)} agent file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
