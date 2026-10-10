"""Step-order check: fresh projects cannot skip ahead; a human can override with a logged reason."""

import importlib
import json

import pytest

from .test_transition import _reimport_with_root, _seed_project, _seed_review

GATES = {
    "1": [("01-requirements.md", "challenge-findings-requirements.json")],
    "2": [
        ("02-architecture-assessment.md", "challenge-findings-architecture.json"),
        ("03-des-cost-estimate.md", "challenge-findings-cost-estimate.json"),
    ],
    "3_5": [("04-governance-constraints.md", "challenge-findings-governance-constraints-pass1.json")],
    "4": [("04-implementation-plan.md", "challenge-findings-plan.json")],
}


def fresh(tmp_path):
    root = tmp_path / "workspace"
    _reimport_with_root(root)
    project = _seed_project(root, "synthetic", in_order=True)
    for pairs in GATES.values():
        for artifact, sidecar in pairs:
            (project / artifact).write_text("# fixture\n")
            _seed_review(project, sidecar)
    return project, importlib.import_module("apex_recall.__main__")


@pytest.mark.parametrize(
    "command",
    [
        ["complete-step", "synthetic", "7"],
        ["complete-step", "synthetic", "6"],
        ["start-step", "synthetic", "5"],
        ["transition", "synthetic", "--from-step", "1", "--to-step", "4", "--complete"],
        ["transition", "synthetic", "--from-step", "1", "--to-step", "2"],
    ],
)
def test_fresh_project_cannot_skip_ahead_without_changing_state(tmp_path, command):
    project, cli = fresh(tmp_path)
    state = project / "00-session-state.json"
    before = state.read_bytes()
    assert cli.main([*command, "--json"]) == 2
    assert state.read_bytes() == before


def test_human_override_proceeds_and_is_logged(tmp_path, capsys):
    project, cli = fresh(tmp_path)
    state = project / "00-session-state.json"
    before = state.read_bytes()
    assert cli.main(["start-step", "synthetic", "5", "--allow-out-of-order", "  ", "--json"]) == 2
    assert state.read_bytes() == before
    assert cli.main(["start-step", "synthetic", "5", "--allow-out-of-order", "repairing generated code", "--json"]) == 0
    saved = json.loads(state.read_text())
    assert saved["steps"]["5"]["status"] == "in_progress"
    entry = saved["decisions"]["order_overrides"][0]
    assert entry["step"] == "5" and entry["reason"] == "repairing generated code"
    assert "Step 4 is not complete" in entry["problem"]


@pytest.mark.parametrize("track", ["Bicep", "Terraform"])
def test_normal_order_runs_through_every_step_and_replays(tmp_path, capsys, track):
    project, cli = fresh(tmp_path)
    assert cli.main(["decide", "synthetic", "--key", "iac_tool", "--value", track, "--json"]) == 0
    for source, target in (("1", "2"), ("2", "3_5"), ("3_5", "4"), ("4", "5"), ("5", "6"), ("6", "7")):
        assert (
            cli.main(["transition", "synthetic", "--from-step", source, "--to-step", target, "--complete", "--json"])
            == 0
        )
    assert cli.main(["complete-step", "synthetic", "7", "--json"]) == 0
    capsys.readouterr()
    assert cli.main(["complete-step", "synthetic", "7", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["outcome"] == "already_applied"
    saved = json.loads((project / "00-session-state.json").read_text())
    assert "order_overrides" not in saved["decisions"]
    assert saved["steps"]["3"]["status"] == "pending"


@pytest.mark.parametrize("via", ["complete-step", "transition"])
def test_replay_of_logged_skip_needs_no_flags_again(tmp_path, capsys, via):
    project, cli = fresh(tmp_path)
    for source, target in (("1", "2"), ("2", "3_5"), ("3_5", "4")):
        assert cli.main(["transition", "synthetic", "--from-step", source, "--to-step", target, "--complete"]) == 0
    (project / "challenge-findings-plan.json").unlink()
    skip = ["--allow-missing-challenger", "--challenger-skip-reason", "lab run, no reviewer"]
    command = (
        ["complete-step", "synthetic", "4"]
        if via == "complete-step"
        else ["transition", "synthetic", "--from-step", "4", "--to-step", "5", "--complete"]
    )
    assert cli.main([*command, *skip, "--json"]) == 0
    capsys.readouterr()
    assert cli.main([*command, "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["outcome"] == "already_applied"
    saved = json.loads((project / "00-session-state.json").read_text())
    assert len(saved["decisions"]["challenger_skip"]) == 1


def test_decide_keeps_reason_and_step_for_key_value_decisions(tmp_path):
    project, cli = fresh(tmp_path)
    assert (
        cli.main(
            [
                "decide",
                "synthetic",
                "--key",
                "plan_status",
                "--value",
                "APPROVED",
                "--rationale",
                "reviewed",
                "--step",
                "4",
                "--json",
            ]
        )
        == 0
    )
    saved = json.loads((project / "00-session-state.json").read_text())
    assert saved["decisions"]["plan_status"] == "APPROVED"
    assert saved["decision_log"][-1]["rationale"] == "reviewed"
    assert saved["decision_log"][-1]["step"] == "4"
