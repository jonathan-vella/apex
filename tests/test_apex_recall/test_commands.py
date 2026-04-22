"""Tests for the apex-recall CLI commands."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from apex_recall.__main__ import main
from apex_recall.indexer import reindex


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """Create a workspace with sample agent-output data."""
    ao = tmp_path / "agent-output"
    ao.mkdir()

    proj = ao / "demo-project"
    proj.mkdir()

    session = {
        "schema_version": "3.0",
        "project": "demo-project",
        "iac_tool": "Terraform",
        "region": "swedencentral",
        "branch": "main",
        "updated": "2026-04-20T15:00:00Z",
        "current_step": 4,
        "decisions": {
            "region": "swedencentral",
            "compliance": "ISO 27001",
            "budget": "high",
            "architecture_pattern": "microservices",
            "deployment_strategy": "blue-green",
            "complexity": "complex",
        },
        "open_findings": [],
        "decision_log": [
            {
                "step": 2,
                "decision": "Use AKS over App Service",
                "rationale": "Better scaling for microservices",
                "timestamp": "2026-04-20T10:00:00Z",
            }
        ],
        "steps": {"4": {"status": "in_progress"}},
    }
    (proj / "00-session-state.json").write_text(json.dumps(session))
    (proj / "01-requirements.md").write_text(
        "# Requirements\n\nBuild a microservices platform on AKS.\n"
    )
    (proj / "02-architecture-assessment.md").write_text(
        "# Architecture\n\nAKS with Istio service mesh.\n"
    )
    (proj / "04-implementation-plan.md").write_text(
        "# Implementation Plan\n\nPhase 1: AKS cluster. Phase 2: Service mesh.\n"
    )

    # Set up DB
    db_path = tmp_path / "tmp" / ".apex-recall.db"
    reindex(workspace_root=tmp_path, db_path=db_path, agent_output_dir=ao)

    return tmp_path


@pytest.fixture(autouse=True)
def patch_workspace(workspace: Path):
    """Patch config to use the test workspace."""
    with (
        patch("apex_recall.config.find_workspace_root", return_value=workspace),
        patch("apex_recall.indexer.get_db_path", return_value=workspace / "tmp" / ".apex-recall.db"),
        patch(
            "apex_recall.indexer.get_agent_output_dir",
            return_value=workspace / "agent-output",
        ),
    ):
        yield


class TestFilesCommand:
    def test_json_output(self, capsys):
        rc = main(["files", "--json", "--limit", "5"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert isinstance(data, list)
        assert len(data) == 4
        assert all("project" in r for r in data)

    def test_text_output(self, capsys):
        rc = main(["files", "--limit", "5"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "demo-project" in out


class TestSessionsCommand:
    def test_json_output(self, capsys):
        rc = main(["sessions", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert len(data) == 1
        assert data[0]["project"] == "demo-project"
        assert data[0]["current_step"] == 4
        assert data[0]["iac_tool"] == "Terraform"

    def test_text_output(self, capsys):
        rc = main(["sessions"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "demo-project" in out


class TestSearchCommand:
    def test_search_found(self, capsys):
        rc = main(["search", "microservices", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert len(data) > 0
        assert any("microservices" in r.get("snippet", "").lower() for r in data)

    def test_search_not_found(self, capsys):
        rc = main(["search", "xyznonexistent", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data == []

    def test_search_with_project_filter(self, capsys):
        rc = main(["search", "AKS", "--json", "--project", "demo-project"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert all(r["project"] == "demo-project" for r in data)


class TestShowCommand:
    def test_json_output(self, capsys):
        rc = main(["show", "demo-project", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["project"] == "demo-project"
        assert data["session"]["current_step"] == 4
        assert data["session"]["iac_tool"] == "Terraform"
        assert data["artifact_count"] == 4

    def test_nonexistent_project(self, capsys):
        rc = main(["show", "nonexistent", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["artifact_count"] == 0

    def test_text_output(self, capsys):
        rc = main(["show", "demo-project"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "demo-project" in out
        assert "Terraform" in out


class TestDecisionsCommand:
    def test_json_output(self, capsys):
        rc = main(["decisions", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert len(data) > 0
        # Should include both decisions object entries and decision_log entries
        sources = {d["source"] for d in data}
        assert "decisions" in sources
        assert "decision_log" in sources

    def test_project_filter(self, capsys):
        rc = main(["decisions", "--json", "--project", "demo-project"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert all(d["project"] == "demo-project" for d in data)


class TestReindexCommand:
    def test_json_output(self, capsys):
        rc = main(["reindex", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["reindexed"] is True
        assert data["artifacts"] == 4


class TestHealthCommand:
    def test_json_output(self, capsys):
        rc = main(["health", "--json"])
        assert rc == 0
        out = capsys.readouterr().out
        data = json.loads(out)
        assert data["db_exists"] is True
        assert data["schema_ok"] is True
        assert data["total_artifacts"] == 4
        assert data["total_projects"] == 1
        assert "demo-project" in data["projects"]

    def test_text_output(self, capsys):
        rc = main(["health"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Artifacts:" in out


class TestVersionAndHelp:
    def test_version(self, capsys):
        with pytest.raises(SystemExit) as exc_info:
            main(["--version"])
        assert exc_info.value.code == 0
        out = capsys.readouterr().out
        assert "0.2.0" in out

    def test_help(self, capsys):
        with pytest.raises(SystemExit) as exc_info:
            main(["--help"])
        assert exc_info.value.code == 0
        out = capsys.readouterr().out
        assert "apex-recall" in out

    def test_no_args_shows_help(self, capsys):
        rc = main([])
        assert rc == 0
        out = capsys.readouterr().out
        assert "apex-recall" in out


class TestEdgeCases:
    def test_malformed_json(self, workspace: Path):
        """Malformed session-state should not crash the indexer."""
        proj = workspace / "agent-output" / "bad-project"
        proj.mkdir()
        (proj / "00-session-state.json").write_text("{invalid json!!")

        db_path = workspace / "tmp" / ".apex-recall.db"
        ao = workspace / "agent-output"
        count = reindex(workspace_root=workspace, db_path=db_path, agent_output_dir=ao)
        # Should still index the file (content is stored as-is; parsing happens at query time)
        assert count >= 5  # 4 original + 1 malformed
