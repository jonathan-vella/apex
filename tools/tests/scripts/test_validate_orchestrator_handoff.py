"""Native interaction/completion source-contract regression tests."""

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
    spec.loader.exec_module(module)
    return module


def test_current_fleet_passes():
    mod = _load_module()
    assert mod.validate_orchestrator(AGENT) == []
    for name in mod.STEP_AGENTS:
        assert mod.validate_step_agent(AGENT.parent / name) == [], name


@pytest.mark.parametrize("kind", ["orchestrator", "step"])
def test_contract_does_not_require_ui_headings_or_worker_rituals(tmp_path, kind):
    mod = _load_module()
    required = mod.ORCHESTRATOR_REQUIRED_FRAGMENTS if kind == "orchestrator" else mod.STEP_REQUIRED_FRAGMENTS
    validate = mod.validate_orchestrator if kind == "orchestrator" else mod.validate_step_agent
    fixture = tmp_path / "native.agent.md"
    fixture.write_text("# Native\n\n" + "\n".join(required))
    assert validate(fixture) == []
    for fragment in required:
        fixture.write_text("\n".join(field for field in required if field != fragment))
        assert any(fragment in failure for failure in validate(fixture))


@pytest.mark.parametrize(
    "retired",
    [
        "APEX_WORKER_HANDSHAKE",
        "WORKER_READY",
        "WORKER_READY_ACK",
        "WORKER_EXECUTE",
        "HANDSHAKE_VERIFIED",
        "READY_VERIFIED",
        "verify-worker-ready.mjs",
        "handoffs: []",
        "Run `/clear`",
    ],
)
def test_retired_routing_contract_fails(tmp_path, retired):
    mod = _load_module()
    fixture = tmp_path / "01-orchestrator.agent.md"
    fixture.write_text("\n".join(mod.ORCHESTRATOR_REQUIRED_FRAGMENTS) + "\n" + retired)
    assert mod.validate_orchestrator(fixture)


def test_missing_file_is_a_failure(tmp_path):
    assert _load_module().validate_step_agent(tmp_path / "missing.agent.md")


def test_cli_exit_codes(tmp_path):
    passing = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    assert passing.returncode == 0, passing.stderr
    fixture = tmp_path / AGENT.name
    fixture.write_text("# Missing contracts")
    failing = subprocess.run([sys.executable, str(SCRIPT), str(fixture)], capture_output=True, text=True)
    assert failing.returncode == 1
    assert "FAILED" in failing.stderr
    invalid = subprocess.run([sys.executable, str(SCRIPT), "--invalid"], capture_output=True, text=True)
    assert invalid.returncode == 2
