"""Negative-test for validate_orchestrator_handoff.py."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
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
    assert mod.validate(AGENT) == []


def test_fails_when_resume_line_paraphrased(tmp_path):
    mod = _load_module()
    body = AGENT.read_text()
    broken = body.replace(mod.REQUIRED_LINE, "Run /clear and reply to continue.")
    p = tmp_path / "broken.md"
    p.write_text(broken)
    failures = mod.validate(p)
    assert any("missing verbatim resume line" in f for f in failures)


def test_fails_when_checkpoint_clause_removed(tmp_path):
    mod = _load_module()
    body = AGENT.read_text()
    broken = body.replace("apex-recall checkpoint", "(removed)")
    p = tmp_path / "broken.md"
    p.write_text(broken)
    failures = mod.validate(p)
    assert any("checkpoint precondition" in f for f in failures)


def test_cli_exit_codes(tmp_path):
    # Passing case
    r = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    assert r.returncode == 0, f"expected 0, got {r.returncode}: {r.stderr}"

    # Failing case
    mod = _load_module()
    body = AGENT.read_text()
    broken = body.replace(mod.REQUIRED_LINE, "paraphrased")
    p = tmp_path / "broken.md"
    p.write_text(broken)
    r2 = subprocess.run(
        [sys.executable, str(SCRIPT), str(p)],
        capture_output=True,
        text=True,
    )
    assert r2.returncode == 1, f"expected 1, got {r2.returncode}"
    assert "FAILED" in r2.stderr
