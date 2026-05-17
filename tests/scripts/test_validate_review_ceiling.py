"""Tests for tools/scripts/validate_review_ceiling.py."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "validate_review_ceiling.py"
ORCH = REPO_ROOT / ".github" / "agents" / "01-orchestrator.agent.md"
CHAL = REPO_ROOT / ".github" / "agents" / "10-challenger.agent.md"


def _load():
    spec = importlib.util.spec_from_file_location("validate_review_ceiling", SCRIPT)
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)  # type: ignore[union-attr]
    return m


def test_contract_pass_on_canonical_bodies():
    mod = _load()
    assert mod.check_ceiling_contract() == []


def test_contract_fails_when_table_removed(tmp_path, monkeypatch):
    mod = _load()
    # Stub orchestrator path with a broken copy
    broken = tmp_path / "orch.md"
    broken.write_text(ORCH.read_text().replace("Challenger-invocation ceiling", "(removed)"))
    monkeypatch.setattr(mod, "ORCHESTRATOR", broken)
    failures = mod.check_ceiling_contract()
    assert any("Challenger-invocation ceiling" in f for f in failures)


def test_budget_counts_challenger_invocations_per_step():
    mod = _load()
    log = REPO_ROOT / "logs" / "test04-01.json"
    if not log.exists():
        # Baseline log corpus not extracted on this machine — skip.
        return
    per_step, _ = mod.budget_check(log)
    # test04-01 has 25 challenger invocations across the multi-step session.
    total = sum(per_step.values())
    assert total >= 1, f"expected ≥1 challenger invocation in test04 log, got {total}"


def test_cli_contract_mode_passes():
    r = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def test_cli_strict_mode_signals_violation(tmp_path):
    # Build a minimal log with 3 challenger invocations in one step.
    log = {
        "resourceSpans": [
            {
                "resource": {},
                "scopeSpans": [
                    {
                        "spans": [
                            {"name": "turn_start:1", "startTimeUnixNano": "1", "endTimeUnixNano": "2"},
                            {"name": "challenger-review-subagent", "startTimeUnixNano": "3", "endTimeUnixNano": "4"},
                            {"name": "challenger-review-subagent", "startTimeUnixNano": "5", "endTimeUnixNano": "6"},
                            {"name": "challenger-review-subagent", "startTimeUnixNano": "7", "endTimeUnixNano": "8"},
                        ]
                    }
                ],
            }
        ]
    }
    import json as _json

    p = tmp_path / "log.json"
    p.write_text(_json.dumps(log))
    r = subprocess.run(
        [sys.executable, str(SCRIPT), "--budget", str(p), "--strict"],
        capture_output=True,
        text=True,
    )
    assert r.returncode == 1, f"expected 1, got {r.returncode}: {r.stdout} {r.stderr}"
