"""Tests for apex-recall write commands: init, start-step, checkpoint, complete-step, decide, finding, review-audit."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from apex_recall.__main__ import main
from apex_recall.state_writer import VALID_STEP_KEYS


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """Create a minimal workspace for write command tests."""
    ao = tmp_path / "agent-output"
    ao.mkdir()
    (tmp_path / "tmp").mkdir()
    return tmp_path


def _run(workspace: Path, argv: list[str]) -> tuple[int, str]:
    """Run CLI in workspace, capture stdout."""
    import io
    import sys

    old_cwd = os.getcwd()
    os.chdir(workspace)
    captured = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = captured
    try:
        rc = main(argv)
    except SystemExit as e:
        rc = e.code or 0
    finally:
        sys.stdout = old_stdout
        os.chdir(old_cwd)
    return rc, captured.getvalue()


# ── init ────────────────────────────────────────────────────────────────────


class TestInit:
    def test_creates_session_state(self, workspace: Path):
        rc, out = _run(workspace, ["init", "my-proj", "--json"])
        assert rc == 0
        data = json.loads(out)
        assert data["created"] is True
        assert data["project"] == "my-proj"

        state_path = workspace / "agent-output" / "my-proj" / "00-session-state.json"
        assert state_path.exists()
        state = json.loads(state_path.read_text())
        assert state["schema_version"] == "3.0"
        assert set(state["steps"].keys()) == {"1", "2", "3", "3_5", "4", "5", "6", "7"}

    def test_fails_if_exists(self, workspace: Path):
        _run(workspace, ["init", "my-proj", "--json"])
        rc, out = _run(workspace, ["init", "my-proj", "--json"])
        assert rc == 1
        assert "already exists" in json.loads(out).get("error", "")

    def test_force_overwrites(self, workspace: Path):
        _run(workspace, ["init", "my-proj", "--json"])
        rc, out = _run(workspace, ["init", "my-proj", "--force", "--json"])
        assert rc == 0
        assert json.loads(out)["created"] is True


# ── start-step ──────────────────────────────────────────────────────────────


class TestStartStep:
    def test_starts_step(self, workspace: Path):
        _run(workspace, ["init", "sp", "--json"])
        rc, out = _run(workspace, ["start-step", "sp", "1", "--json"])
        assert rc == 0
        data = json.loads(out)
        assert data["status"] == "in_progress"
        assert data["step"] == "1"

    def test_governance_step_3_5(self, workspace: Path):
        _run(workspace, ["init", "sp", "--json"])
        rc, out = _run(workspace, ["start-step", "sp", "3_5", "--json"])
        assert rc == 0
        assert json.loads(out)["step"] == "3_5"

    def test_invalid_step_key(self, workspace: Path):
        _run(workspace, ["init", "sp", "--json"])
        rc, out = _run(workspace, ["start-step", "sp", "99", "--json"])
        assert rc == 1

    def test_refuses_restart_without_force(self, workspace: Path):
        _run(workspace, ["init", "sp", "--json"])
        _run(workspace, ["start-step", "sp", "1", "--json"])
        _run(workspace, ["complete-step", "sp", "1", "--json"])
        rc, out = _run(workspace, ["start-step", "sp", "1", "--json"])
        assert rc == 1
        assert "already complete" in json.loads(out).get("error", "")

    def test_force_restarts_complete(self, workspace: Path):
        _run(workspace, ["init", "sp", "--json"])
        _run(workspace, ["start-step", "sp", "1", "--json"])
        _run(workspace, ["complete-step", "sp", "1", "--json"])
        rc, out = _run(workspace, ["start-step", "sp", "1", "--force", "--json"])
        assert rc == 0


# ── checkpoint ──────────────────────────────────────────────────────────────


class TestCheckpoint:
    def test_records_sub_step(self, workspace: Path):
        _run(workspace, ["init", "cp", "--json"])
        _run(workspace, ["start-step", "cp", "2", "--json"])
        rc, out = _run(workspace, ["checkpoint", "cp", "2", "phase_2_waf", "--json"])
        assert rc == 0
        data = json.loads(out)
        assert data["sub_step"] == "phase_2_waf"

    def test_appends_artifact(self, workspace: Path):
        _run(workspace, ["init", "cp", "--json"])
        _run(workspace, ["start-step", "cp", "1", "--json"])
        rc, out = _run(workspace, ["checkpoint", "cp", "1", "elicit", "--artifact", "01-requirements.md", "--json"])
        assert rc == 0
        state = json.loads((workspace / "agent-output" / "cp" / "00-session-state.json").read_text())
        assert "01-requirements.md" in state["steps"]["1"]["artifacts"]


# ── complete-step ───────────────────────────────────────────────────────────


class TestCompleteStep:
    def test_completes_step(self, workspace: Path):
        _run(workspace, ["init", "cs", "--json"])
        _run(workspace, ["start-step", "cs", "1", "--json"])
        rc, out = _run(workspace, ["complete-step", "cs", "1", "--json"])
        assert rc == 0
        data = json.loads(out)
        assert data["status"] == "complete"
        assert data["completed"] is not None


# ── decide ──────────────────────────────────────────────────────────────────


class TestDecide:
    def test_mode_a_key_value(self, workspace: Path):
        _run(workspace, ["init", "dc", "--json"])
        rc, out = _run(workspace, ["decide", "dc", "--key", "region", "--value", "westeurope", "--json"])
        assert rc == 0
        state = json.loads((workspace / "agent-output" / "dc" / "00-session-state.json").read_text())
        assert state["decisions"]["region"] == "westeurope"

    def test_mode_b_decision_log(self, workspace: Path):
        _run(workspace, ["init", "dc", "--json"])
        rc, out = _run(workspace, ["decide", "dc", "--decision", "Use hub-spoke", "--rationale", "Isolation", "--step", "2", "--json"])
        assert rc == 0
        data = json.loads(out)
        assert data["decision"] == "Use hub-spoke"
        state = json.loads((workspace / "agent-output" / "dc" / "00-session-state.json").read_text())
        assert len(state["decision_log"]) == 1
        assert state["decision_log"][0]["decision"] == "Use hub-spoke"

    def test_mode_conflict_error(self, workspace: Path):
        _run(workspace, ["init", "dc", "--json"])
        rc, out = _run(workspace, ["decide", "dc", "--key", "x", "--value", "y", "--decision", "z", "--json"])
        assert rc == 1
        assert "Cannot use both" in json.loads(out).get("error", "")

    def test_no_args_error(self, workspace: Path):
        _run(workspace, ["init", "dc", "--json"])
        rc, out = _run(workspace, ["decide", "dc", "--json"])
        assert rc == 1

    def test_decision_log_appends(self, workspace: Path):
        _run(workspace, ["init", "dc", "--json"])
        _run(workspace, ["decide", "dc", "--decision", "First", "--json"])
        _run(workspace, ["decide", "dc", "--decision", "Second", "--json"])
        state = json.loads((workspace / "agent-output" / "dc" / "00-session-state.json").read_text())
        assert len(state["decision_log"]) == 2


# ── finding ─────────────────────────────────────────────────────────────────


class TestFinding:
    def test_add_finding(self, workspace: Path):
        _run(workspace, ["init", "fn", "--json"])
        rc, out = _run(workspace, ["finding", "fn", "--add", "WAF: no DR plan", "--json"])
        assert rc == 0
        data = json.loads(out)
        assert data["action"] == "added"
        assert data["total"] == 1

    def test_remove_finding(self, workspace: Path):
        _run(workspace, ["init", "fn", "--json"])
        _run(workspace, ["finding", "fn", "--add", "WAF: no DR plan", "--json"])
        rc, out = _run(workspace, ["finding", "fn", "--remove", "WAF: no DR plan", "--json"])
        assert rc == 0
        data = json.loads(out)
        assert data["action"] == "removed"
        assert data["total"] == 0

    def test_remove_nonexistent(self, workspace: Path):
        _run(workspace, ["init", "fn", "--json"])
        rc, out = _run(workspace, ["finding", "fn", "--remove", "nope", "--json"])
        assert rc == 0
        assert json.loads(out)["action"] == "not_found"

    def test_idempotent_add(self, workspace: Path):
        _run(workspace, ["init", "fn", "--json"])
        _run(workspace, ["finding", "fn", "--add", "dup", "--json"])
        _run(workspace, ["finding", "fn", "--add", "dup", "--json"])
        state = json.loads((workspace / "agent-output" / "fn" / "00-session-state.json").read_text())
        assert state["open_findings"].count("dup") == 1


# ── review-audit ────────────────────────────────────────────────────────────


class TestReviewAudit:
    def test_creates_audit_entry(self, workspace: Path):
        _run(workspace, ["init", "ra", "--json"])
        rc, out = _run(workspace, [
            "review-audit", "ra", "2",
            "--complexity", "standard",
            "--passes-planned", "1",
            "--passes-executed", "1",
            "--model", "03-Architect",
            "--json",
        ])
        assert rc == 0
        data = json.loads(out)
        assert data["audit_key"] == "step_2"
        assert data["entry"]["complexity"] == "standard"
        assert data["entry"]["models_used"] == ["03-Architect"]

    def test_appends_models(self, workspace: Path):
        _run(workspace, ["init", "ra", "--json"])
        _run(workspace, ["review-audit", "ra", "2", "--model", "A", "--json"])
        _run(workspace, ["review-audit", "ra", "2", "--model", "B", "--json"])
        state = json.loads((workspace / "agent-output" / "ra" / "00-session-state.json").read_text())
        assert state["review_audit"]["step_2"]["models_used"] == ["A", "B"]

    def test_appends_skip(self, workspace: Path):
        _run(workspace, ["init", "ra", "--json"])
        _run(workspace, ["review-audit", "ra", "4", "--skip", "2", "--skip-reason", "Low complexity", "--json"])
        state = json.loads((workspace / "agent-output" / "ra" / "00-session-state.json").read_text())
        assert 2 in state["review_audit"]["step_4"]["skipped"]
        assert "Low complexity" in state["review_audit"]["step_4"]["skip_reasons"]

    def test_governance_step(self, workspace: Path):
        _run(workspace, ["init", "ra", "--json"])
        rc, out = _run(workspace, ["review-audit", "ra", "3_5", "--complexity", "complex", "--json"])
        assert rc == 0
        assert json.loads(out)["audit_key"] == "step_3_5"


# ── Atomic write + recovery ─────────────────────────────────────────────────


class TestAtomicWrite:
    def test_bak_created_on_second_write(self, workspace: Path):
        _run(workspace, ["init", "bak", "--json"])
        _run(workspace, ["start-step", "bak", "1", "--json"])
        bak = workspace / "agent-output" / "bak" / "00-session-state.json.bak"
        assert bak.exists()

    def test_corrupt_recovery_from_bak(self, workspace: Path):
        _run(workspace, ["init", "bak", "--json"])
        _run(workspace, ["start-step", "bak", "1", "--json"])
        # Corrupt the primary file
        primary = workspace / "agent-output" / "bak" / "00-session-state.json"
        primary.write_text("{bad json///")
        # Next command should recover from .bak
        rc, out = _run(workspace, ["complete-step", "bak", "1", "--json"])
        assert rc == 0
        assert json.loads(out)["status"] == "complete"

    def test_no_bak_no_primary_raises(self, workspace: Path):
        rc, out = _run(workspace, ["start-step", "ghost", "1", "--json"])
        assert rc == 1


# ── Schema migration ────────────────────────────────────────────────────────


class TestSchemaMigration:
    def test_v1_migrates_to_v3(self, workspace: Path):
        proj = workspace / "agent-output" / "old"
        proj.mkdir(parents=True)
        v1 = {"schema_version": "1.0", "project": "old", "current_step": 0, "steps": {"1": {"status": "pending"}}}
        (proj / "00-session-state.json").write_text(json.dumps(v1))
        rc, out = _run(workspace, ["start-step", "old", "1", "--json"])
        assert rc == 0
        state = json.loads((proj / "00-session-state.json").read_text())
        assert state["schema_version"] == "3.0"
        assert "decision_log" in state
        assert "review_audit" in state
        # All 8 step keys should exist after migration
        assert set(state["steps"].keys()) >= VALID_STEP_KEYS
