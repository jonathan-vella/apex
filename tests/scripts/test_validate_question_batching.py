"""Tests for tools/scripts/validate_question_batching.py."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "validate_question_batching.py"
AGENT = REPO_ROOT / ".github" / "agents" / "02-requirements.agent.md"


def _load():
    spec = importlib.util.spec_from_file_location("validate_question_batching", SCRIPT)
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)  # type: ignore[union-attr]
    return m


def test_passes_on_canonical_body():
    mod = _load()
    assert mod.validate(AGENT) == []


def test_fails_when_heading_removed(tmp_path):
    mod = _load()
    body = AGENT.read_text()
    broken = body.replace(mod.REQUIRED_HEADING, "(removed)")
    p = tmp_path / "broken.md"
    p.write_text(broken)
    failures = mod.validate(p)
    assert any("P0 directive heading" in f for f in failures)


def test_fails_when_example_header_removed(tmp_path):
    mod = _load()
    body = AGENT.read_text()
    # Remove a header from the example block
    broken = body.replace('"iac_tool"', '"NOT_iac_tool"')
    p = tmp_path / "broken.md"
    p.write_text(broken)
    failures = mod.validate(p)
    assert any("missing required headers" in f for f in failures)


def test_cli_pass_exits_0():
    r = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def test_cli_fail_exits_1(tmp_path):
    mod = _load()
    broken = AGENT.read_text().replace(mod.REQUIRED_HEADING, "(removed)")
    p = tmp_path / "broken.md"
    p.write_text(broken)
    r = subprocess.run(
        [sys.executable, str(SCRIPT), str(p)],
        capture_output=True,
        text=True,
    )
    assert r.returncode == 1
