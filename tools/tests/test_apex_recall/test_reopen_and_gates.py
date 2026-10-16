"""Tests for the reopen cascade, the Step 2 completion check and path-based review-attempt digests."""

from __future__ import annotations

import hashlib
import io
import json
import os
import sys
from pathlib import Path

import pytest

from apex_recall.__main__ import main
from apex_recall.reopen import DEPENDENTS

REPO = Path(__file__).resolve().parents[3]


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    (tmp_path / "agent-output").mkdir()
    (tmp_path / "tmp").mkdir()
    return tmp_path


def _run(workspace: Path, argv: list[str]) -> tuple[int, str]:
    old_cwd = os.getcwd()
    os.chdir(workspace)
    captured = io.StringIO()
    old_stdout, sys.stdout = sys.stdout, captured
    try:
        rc = main(argv)
    except SystemExit as error:
        rc = error.code or 0
    finally:
        sys.stdout = old_stdout
        os.chdir(old_cwd)
    return rc, captured.getvalue()


def _state(workspace: Path, project: str) -> dict:
    return json.loads((workspace / "agent-output" / project / "00-session-state.json").read_text())


def _finish(workspace: Path, project: str, steps: list[str]) -> None:
    for step in steps:
        assert _run(workspace, ["start-step", project, step, "--json"])[0] == 0
        assert _run(workspace, ["complete-step", project, step, "--json"])[0] == 0


@pytest.fixture
def approved(workspace: Path) -> Path:
    _run(workspace, ["init", "sp", "--json"])
    _finish(workspace, "sp", ["1", "2", "3_5", "4"])
    _run(workspace, ["decide", "sp", "--key", "plan_status", "--value", "APPROVED", "--step", "4", "--json"])
    return workspace


def test_reopening_a_step_marks_dependents_stale_and_supersedes_the_plan(approved: Path):
    rc, out = _run(approved, ["start-step", "sp", "2", "--force", "--json"])
    assert rc == 0
    payload = json.loads(out)
    assert payload["stale_steps"] == ["3_5", "4"]
    assert payload["plan_status"] == "SUPERSEDED"
    state = _state(approved, "sp")
    for step in ("3_5", "4"):
        entry = state["steps"][step]
        assert entry["status"] == "stale"
        assert entry["started"] is None and entry["completed"] is None
        assert entry["stale_because"] == "Step 2 was reopened"
        assert entry["previous_completed"]
    assert state["steps"]["3"]["status"] == "pending"
    assert state["steps"]["1"]["status"] == "complete"
    assert state["decisions"]["plan_status"] == "SUPERSEDED"
    assert any("Step 2 reopened" in entry["decision"] for entry in state["decision_log"])


def test_a_stale_step_cannot_start_until_its_predecessor_is_complete_again(approved: Path):
    _run(approved, ["start-step", "sp", "2", "--force", "--json"])
    rc, _ = _run(approved, ["start-step", "sp", "3_5", "--json"])
    assert rc == 2
    assert _run(approved, ["complete-step", "sp", "2", "--json"])[0] == 0
    rc, _ = _run(approved, ["start-step", "sp", "3_5", "--json"])
    assert rc == 0
    entry = _state(approved, "sp")["steps"]["3_5"]
    assert entry["status"] == "in_progress"
    assert not {"stale_since", "stale_because", "previous_completed"} & set(entry)


def test_transition_into_a_stale_step_clears_the_markers(approved: Path):
    _run(approved, ["start-step", "sp", "2", "--force", "--json"])
    _run(approved, ["complete-step", "sp", "2", "--json"])
    rc, _ = _run(approved, ["transition", "sp", "--from-step", "2", "--to-step", "3_5", "--json"])
    assert rc == 0
    entry = _state(approved, "sp")["steps"]["3_5"]
    assert entry["status"] == "in_progress"
    assert "stale_since" not in entry


def test_reopening_the_plan_step_supersedes_its_own_approval(approved: Path):
    rc, out = _run(approved, ["start-step", "sp", "4", "--force", "--json"])
    assert rc == 0
    assert json.loads(out)["plan_status"] == "SUPERSEDED"
    assert _state(approved, "sp")["steps"]["4"]["status"] == "in_progress"


def test_reopening_the_last_step_has_no_dependents(approved: Path):
    _finish(approved, "sp", ["5", "6", "7"])
    rc, out = _run(approved, ["start-step", "sp", "7", "--force", "--json"])
    assert rc == 0
    assert "stale_steps" not in json.loads(out)


def test_dependents_match_the_workflow_graph():
    nodes = json.loads((REPO / ".github/skills/apex-workflow-engine/templates/workflow-graph.json").read_text())[
        "nodes"
    ]
    key = {"step-5b": "5", "step-5t": "5", "step-6b": "6", "step-6t": "6"}

    def step_key(node_id: str) -> str | None:
        return key.get(node_id) or (node_id.removeprefix("step-") if node_id.startswith("step-") else None)

    def requires_closure(node_id: str) -> set[str]:
        found: set[str] = set()
        for parent in nodes[node_id].get("requires", []):
            found |= {parent} | requires_closure(parent)
        return found

    derived: dict[str, set[str]] = {step_key(n): set() for n in nodes if step_key(n)}
    for node_id in nodes:
        if not step_key(node_id):
            continue
        for ancestor in requires_closure(node_id):
            if step_key(ancestor) and step_key(ancestor) != step_key(node_id):
                derived[step_key(ancestor)].add(step_key(node_id))
    assert {step: set(values) for step, values in DEPENDENTS.items()} == derived


def test_step_2_refuses_scratch_files_even_with_a_challenger_skip(workspace: Path):
    _run(workspace, ["init", "sp", "--json"])
    _finish(workspace, "sp", ["1"])
    _run(workspace, ["start-step", "sp", "2", "--json"])
    project = workspace / "agent-output" / "sp"
    (project / "02-waf-research.tmp.md").write_text("scratch")
    rc, out = _run(workspace, ["complete-step", "sp", "2", "--json"])
    assert rc == 2
    assert json.loads(out)["error"] == "step2_residue"
    assert "_meta" in json.loads(out)["remediation"]
    rc, _ = _run(
        workspace, ["complete-step", "sp", "2", "--allow-missing-challenger", "--challenger-skip-reason", "x", "--json"]
    )
    assert rc == 2
    (project / "02-waf-research.tmp.md").unlink()
    assert _run(workspace, ["complete-step", "sp", "2", "--json"])[0] == 0


def test_step_2_refuses_failed_cost_estimates_until_archived(workspace: Path):
    _run(workspace, ["init", "sp", "--json"])
    _finish(workspace, "sp", ["1"])
    _run(workspace, ["start-step", "sp", "2", "--json"])
    project = workspace / "agent-output" / "sp"
    (project / "02-cost-estimate-rev2.json").write_text(json.dumps({"status": "FAILED"}))
    (project / "02-cost-estimate.json").write_text(json.dumps({"status": "COMPLETE"}))
    rc, out = _run(workspace, ["transition", "sp", "--from-step", "2", "--to-step", "3_5", "--complete", "--json"])
    assert rc == 2
    assert json.loads(out)["files"] == ["02-cost-estimate-rev2.json: cost estimate with status FAILED"]
    (project / "_meta").mkdir()
    (project / "02-cost-estimate-rev2.json").rename(project / "_meta" / "02-cost-estimate-rev2.json")
    rc, _ = _run(workspace, ["transition", "sp", "--from-step", "2", "--to-step", "3_5", "--complete", "--json"])
    assert rc == 0


def test_attempt_digest_comes_from_input_paths(workspace: Path):
    _run(workspace, ["init", "sp", "--json"])
    project = workspace / "agent-output" / "sp"
    (project / "04-implementation-plan.md").write_text("plan")
    (project / "04-iac-contract.json").write_text("{}")
    inputs = ["agent-output/sp/04-iac-contract.json", "agent-output/sp/04-implementation-plan.md"]
    arguments = ["review-audit", "sp", "4", "--attempt-id", "plan-1", "--attempt-kind", "invocation", "--json"]
    for path in inputs:
        arguments += ["--attempt-input", path]
    rc, out = _run(workspace, [*arguments, "--attempt-outcome", "started"])
    assert rc == 0
    started = json.loads(out)
    expected = hashlib.sha256(
        json.dumps(
            [
                ["agent-output/sp/04-iac-contract.json", hashlib.sha256(b"{}").hexdigest()],
                ["agent-output/sp/04-implementation-plan.md", hashlib.sha256(b"plan").hexdigest()],
            ],
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    assert started["input_digest"] == expected
    assert started["permission_granted_by_this_record"] is False
    assert started["authorization"] == "not_granted"
    rc, out = _run(workspace, [*arguments, "--attempt-outcome", "completed"])
    assert rc == 0
    assert json.loads(out)["input_digest"] == expected


def test_a_changed_input_cannot_finish_the_started_attempt(workspace: Path):
    _run(workspace, ["init", "sp", "--json"])
    project = workspace / "agent-output" / "sp"
    (project / "04-implementation-plan.md").write_text("plan")
    arguments = [
        "review-audit",
        "sp",
        "4",
        "--attempt-id",
        "plan-1",
        "--attempt-kind",
        "invocation",
        "--attempt-input",
        "agent-output/sp/04-implementation-plan.md",
        "--json",
    ]
    assert _run(workspace, [*arguments, "--attempt-outcome", "started"])[0] == 0
    (project / "04-implementation-plan.md").write_text("plan, edited during review")
    assert _run(workspace, [*arguments, "--attempt-outcome", "completed"])[0] == 1


def test_attempt_inputs_cannot_escape_the_workspace(workspace: Path):
    _run(workspace, ["init", "sp", "--json"])
    rc, _ = _run(
        workspace,
        [
            "review-audit",
            "sp",
            "4",
            "--attempt-id",
            "plan-1",
            "--attempt-kind",
            "invocation",
            "--attempt-input",
            "../outside.md",
            "--attempt-outcome",
            "started",
            "--json",
        ],
    )
    assert rc == 1
