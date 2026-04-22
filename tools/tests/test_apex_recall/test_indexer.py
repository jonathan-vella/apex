"""Tests for the apex-recall indexer."""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

import pytest

from apex_recall.indexer import (
    _walk_agent_output,
    classify_artifact,
    ensure_fresh,
    extract_step,
    init_db,
    reindex,
)


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """Create a minimal workspace with agent-output."""
    ao = tmp_path / "agent-output"
    ao.mkdir()

    # Project: test-project
    proj = ao / "test-project"
    proj.mkdir()

    # Session state
    session = {
        "schema_version": "3.0",
        "project": "test-project",
        "iac_tool": "Bicep",
        "region": "swedencentral",
        "branch": "main",
        "updated": "2026-04-01T12:00:00Z",
        "current_step": 2,
        "decisions": {
            "region": "swedencentral",
            "compliance": "GDPR",
            "budget": "medium",
            "architecture_pattern": "hub-spoke",
            "deployment_strategy": "phased",
        },
        "open_findings": ["finding-1"],
        "decision_log": [
            {
                "step": 1,
                "decision": "Use hub-spoke pattern",
                "rationale": "Isolates workloads",
                "timestamp": "2026-04-01T10:00:00Z",
            }
        ],
        "steps": {
            "1": {"status": "complete"},
            "2": {"status": "in_progress", "sub_step": "phase_2_waf"},
        },
    }
    (proj / "00-session-state.json").write_text(json.dumps(session))

    # Requirements markdown
    (proj / "01-requirements.md").write_text(
        "# Requirements\n\nDeploy a hub-spoke network with governance controls.\n"
    )

    # Architecture markdown
    (proj / "02-architecture-assessment.md").write_text(
        "# Architecture Assessment\n\n## WAF Pillars\nSecurity, Reliability, Cost.\n"
    )

    # Handoff markdown
    (proj / "00-handoff.md").write_text("# Handoff\n\nStep 2 in progress.\n")

    return tmp_path


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "tmp" / ".apex-recall.db"


class TestClassifyArtifact:
    def test_session_state(self):
        assert classify_artifact("00-session-state.json") == "session-state"

    def test_requirements(self):
        assert classify_artifact("01-requirements.md") == "requirements"

    def test_architecture(self):
        assert classify_artifact("02-architecture-assessment.md") == "architecture"

    def test_handoff(self):
        assert classify_artifact("00-handoff.md") == "handoff"

    def test_governance_json(self):
        assert classify_artifact("04-governance-constraints.json") == "governance-json"

    def test_governance_md(self):
        assert classify_artifact("04-governance-constraints.md") == "governance"

    def test_lessons_json(self):
        assert classify_artifact("09-lessons-learned.json") == "lessons-json"

    def test_unknown_json(self):
        assert classify_artifact("random.json") == "json"

    def test_unknown_md(self):
        assert classify_artifact("random.md") == "markdown"

    def test_unknown_other(self):
        assert classify_artifact("random.py") == "other"


class TestExtractStep:
    def test_step_01(self):
        assert extract_step("01-requirements.md") == "01"

    def test_step_02(self):
        assert extract_step("02-architecture-assessment.md") == "02"

    def test_no_step(self):
        assert extract_step("README.md") == ""


class TestInitDb:
    def test_creates_tables(self, db_path: Path):
        conn = init_db(db_path)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "artifacts" in tables
        assert "meta" in tables
        conn.close()

    def test_creates_parent_dirs(self, tmp_path: Path):
        dp = tmp_path / "deep" / "nested" / "db.sqlite"
        conn = init_db(dp)
        assert dp.exists()
        conn.close()


class TestWalkAgentOutput:
    def test_finds_artifacts(self, workspace: Path):
        ao = workspace / "agent-output"
        results = _walk_agent_output(ao)
        assert len(results) == 4
        projects = {r[0] for r in results}
        assert projects == {"test-project"}

    def test_empty_dir(self, tmp_path: Path):
        empty = tmp_path / "agent-output"
        empty.mkdir()
        assert _walk_agent_output(empty) == []

    def test_missing_dir(self, tmp_path: Path):
        assert _walk_agent_output(tmp_path / "nonexistent") == []


class TestReindex:
    def test_indexes_artifacts(self, workspace: Path, db_path: Path):
        ao = workspace / "agent-output"
        count = reindex(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        assert count == 4

        conn = sqlite3.connect(str(db_path))
        total = conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
        assert total == 4

        projects = conn.execute("SELECT DISTINCT project FROM artifacts").fetchall()
        assert len(projects) == 1
        assert projects[0][0] == "test-project"
        conn.close()

    def test_reindex_replaces_data(self, workspace: Path, db_path: Path):
        ao = workspace / "agent-output"
        reindex(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        # Add a new file and reindex
        (workspace / "agent-output" / "test-project" / "06-deployment-summary.md").write_text(
            "# Deployment Summary\n"
        )
        count = reindex(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        assert count == 5

    def test_empty_agent_output(self, tmp_path: Path):
        ao = tmp_path / "agent-output"
        ao.mkdir()
        dp = tmp_path / "tmp" / ".apex-recall.db"
        count = reindex(workspace_root=tmp_path, db_path=dp, agent_output_dir=ao)
        assert count == 0


class TestEnsureFresh:
    def test_creates_index_if_missing(self, workspace: Path, db_path: Path):
        ao = workspace / "agent-output"
        conn = ensure_fresh(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        total = conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
        assert total == 4
        conn.close()

    def test_skips_reindex_if_fresh(self, workspace: Path, db_path: Path):
        ao = workspace / "agent-output"
        # First ensure creates the index
        conn = ensure_fresh(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        conn.close()

        # Second call should not reindex (files haven't changed)
        conn = ensure_fresh(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        total = conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
        assert total == 4
        conn.close()

    def test_reindexes_if_stale(self, workspace: Path, db_path: Path):
        ao = workspace / "agent-output"
        conn = ensure_fresh(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        conn.close()

        # Touch a file to make index stale
        time.sleep(0.1)
        new_file = workspace / "agent-output" / "test-project" / "07-as-built.md"
        new_file.write_text("# As-Built\n")

        conn = ensure_fresh(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        total = conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
        assert total == 5
        conn.close()
