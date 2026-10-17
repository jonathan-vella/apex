"""Negative-test for validate_orchestrator_handoff.py."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "validate_orchestrator_handoff.py"
AGENT = REPO_ROOT / ".github" / "agents" / "01-orchestrator.agent.md"


def _load_module():
    spec = importlib.util.spec_from_file_location("validate_orchestrator_handoff", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def test_passes_on_canonical_agent():
    mod = _load_module()
    assert mod.validate_orchestrator(AGENT) == []


def test_fails_when_readiness_verifier_removed(tmp_path):
    mod = _load_module()
    body = AGENT.read_text()
    broken = body.replace(mod.REQUIRED_LINE, "Run /clear and reply to continue.")
    p = tmp_path / "broken.md"
    p.write_text(broken)
    failures = mod.validate_orchestrator(p)
    assert any("missing worker readiness verifier" in f for f in failures)


def test_fails_when_checkpoint_clause_removed(tmp_path):
    mod = _load_module()
    body = AGENT.read_text()
    broken = body.replace("apex-recall checkpoint", "(removed)")
    p = tmp_path / "01-orchestrator.agent.md"
    p.write_text(broken)
    failures = mod.validate_orchestrator(p)
    assert any("checkpoint precondition" in f for f in failures)


def test_cli_exit_codes(tmp_path):
    # Passing case
    r = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    assert r.returncode == 0, f"expected 0, got {r.returncode}: {r.stderr}"

    # Failing case
    mod = _load_module()
    body = AGENT.read_text()
    broken = body.replace(mod.REQUIRED_LINE, "paraphrased")
    p = tmp_path / "01-orchestrator.agent.md"
    p.write_text(broken)
    r2 = subprocess.run(
        [sys.executable, str(SCRIPT), str(p)],
        capture_output=True,
        text=True,
    )
    assert r2.returncode == 1, f"expected 1, got {r2.returncode}"
    assert "FAILED" in r2.stderr


@pytest.mark.parametrize(
    "fragment",
    [
        "HANDSHAKE_VERIFIED",
        "WORKER_READY_ACK",
        "WORKER_EXECUTE",
        "USER_INPUT_REQUIRED",
        "apex-recall transition --complete",
    ],
)
def test_missing_sdk_stage_blocks_source_validation(tmp_path, fragment):
    mod = _load_module()
    p = tmp_path / AGENT.name
    p.write_text(AGENT.read_text().replace(fragment, "(removed)"))
    assert any(fragment in failure for failure in mod.validate_orchestrator(p))


def test_all_steps_have_pending_and_complete_paths():
    mod = _load_module()
    for name in mod.STEP_AGENTS:
        assert mod.validate_step_agent(AGENT.parent / name) == [], name


def test_pending_contract_cannot_be_hidden_outside_completion_section(tmp_path):
    mod = _load_module()
    source = (AGENT.parent / "02-requirements.agent.md").read_text()
    start = source.index("## Completion Handoff")
    p = tmp_path / "step.agent.md"
    p.write_text(source[:start] + source[start:].replace("USER_INPUT_REQUIRED", "done"))
    assert any("Completion Handoff" in failure for failure in mod.validate_step_agent(p))
