"""Actionable delivery recovery must preserve authority, history and independent lenses."""

import importlib
import json
from pathlib import Path

from .test_practical import practical_project
from .test_reliability import setup
from .test_risk_gate import fixture as risk_fixture
from .test_transition import _seed_review


def practical_architecture(tmp_path, monkeypatch, *, stale=()):
    project, writer, cli, practical, record = practical_project(tmp_path)
    state_path = project / "00-session-state.json"
    data = writer.read_state(state_path)
    for step in ("1", "2", "3", "3_5", "4", "5", "6", "7"):
        data["steps"][step] = {"status": "pending"}
    for step in ("1", "2"):
        data["steps"][step] = {"status": "complete", "completed": "original-approval"}
    data["steps"]["3"]["status"] = "skipped"
    data["decisions"]["design_artifacts"] = "skip"
    practical.grant_phase(
        data,
        "2",
        {"request_id": "original-phase", "input_ids": [record["input_id"]], "environments": ["dev"]},
    )
    practical.sync_views("synthetic", data, "2")
    projection = practical.digest(practical.projection(data, "2"))
    writer.write_state("synthetic", data)
    cycles = {}
    for artifact, lens, sidecar in (
        ("02-architecture-assessment.md", "comprehensive", "challenge-findings-architecture.json"),
        ("03-des-cost-estimate.md", "cost-feasibility", "challenge-findings-cost-estimate.json"),
    ):
        _seed_review(project, sidecar)
        path = f"agent-output/synthetic/{artifact}"
        identity = practical.cycle_identity(
            {"step": "2", "artifact_path": path, "review_focus": lens, "pass_number": 1}
        )
        cycles[identity] = {
            "step": "2",
            "artifact": path,
            "lens": lens,
            "pass_number": 1,
            "canonical_path": f"agent-output/synthetic/{sidecar}",
            "initial_id": f"initial-{lens}",
            "projection": projection,
            "calls": 2,
            "max_calls": 2,
        }
    data = writer.read_state(state_path)
    data["decisions"]["review_cycles"] = cycles
    writer.write_state("synthetic", data)
    completion = importlib.import_module("apex_recall.commands.complete_step")

    def review_error(*args, review_paths=None, **kwargs):
        assert review_paths is not None and len(review_paths) == 1
        artifact = review_paths[0][0]
        return "Synthetic current-input drift" if artifact.name in stale else None

    # Strict validator behavior is integrated separately; these cases isolate routing and allowance ownership.
    monkeypatch.setattr(completion, "_challenger_findings_invalid", review_error)
    return project, writer, cli, practical, record


def handoff(cli, capsys):
    capsys.readouterr()
    assert cli.main(["handoff", "synthetic", "--json"]) == 0
    return json.loads(capsys.readouterr().out)


def test_stale_completed_prerequisite_is_not_ready_and_orientation_is_read_only(tmp_path: Path, capsys):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-requirements.json")
    state_path = project / "00-session-state.json"
    data = writer.read_state(state_path)
    data["steps"]["1"].update(status="complete", completed="historical-approval")
    data["steps"]["2"]["status"] = "in_progress"
    writer.write_state("synthetic", data)
    before = state_path.read_bytes()
    assert handoff(cli, capsys)["status"] == "READY"
    protocol = tmp_path / ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md"
    protocol.write_text(protocol.read_text() + "\nChanged review guidance\n")
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert result["next_owner"] == "03-Architect"
    assert result["next_action"]["kind"] == "recover_prerequisites"
    assert result["next_action"]["owner"] == "02-Requirements"
    assert result["permission_granted"] is False
    assert "protocol_sha" in json.dumps(result["blocked_prerequisites"])
    assert "complete the full Step" not in result["delegation_prompt"]
    assert state_path.read_bytes() == before


def test_exhausted_stale_lenses_request_one_managed_recovery_without_reset(tmp_path, monkeypatch, capsys):
    project, _, cli, _, _ = practical_architecture(
        tmp_path,
        monkeypatch,
        stale=("02-architecture-assessment.md", "03-des-cost-estimate.md"),
    )
    state = project / "00-session-state.json"
    before = state.read_bytes()
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert result["active_step"] == "3_5"
    assert result["next_action"]["kind"] == "authorize_recovery_work_package"
    assert result["next_action"]["owner"] == "01-Orchestrator"
    assert len(result["review_cycles"]) == 2
    assert all(cycle["extension_required_if_review_needed"] for cycle in result["review_cycles"])
    assert all(cycle["calls"] == cycle["max_calls"] == 2 for cycle in result["review_cycles"])
    assert state.read_bytes() == before


def test_current_exhausted_reviews_do_not_create_a_new_permission_question(tmp_path, monkeypatch, capsys):
    _, _, cli, _, _ = practical_architecture(tmp_path, monkeypatch)
    result = handoff(cli, capsys)
    assert result["status"] == "READY"
    assert result["next_action"]["kind"] == "continue_stage"
    assert all(not cycle["revalidation_needed"] for cycle in result["review_cycles"])
    assert all(not cycle["extension_required_if_review_needed"] for cycle in result["review_cycles"])
    assert result["permission_granted"] is False


def test_existing_bounded_extension_is_reused_without_another_budget_question(tmp_path, monkeypatch, capsys):
    project, writer, cli, practical, _ = practical_architecture(
        tmp_path, monkeypatch, stale=("02-architecture-assessment.md",)
    )
    state = project / "00-session-state.json"
    data = writer.read_state(state)
    identity, cycle = next(
        (identity, cycle)
        for identity, cycle in data["decisions"]["review_cycles"].items()
        if cycle["lens"] == "comprehensive"
    )
    practical.extend_cycle(
        data,
        {
            "cycle_id": identity,
            "max_calls": 4,
            "request_id": "actual-synthetic-extension-grant",
            "projection_sha256": practical.digest(practical.projection(data, "2")),
        },
    )
    writer.write_state("synthetic", data)
    before = state.read_bytes()
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert result["next_action"]["kind"] == "recover_prerequisites"
    extended = next(item for item in result["review_cycles"] if item["cycle_id"] == identity)
    assert extended["revalidation_needed"] is True
    assert extended["remaining_calls"] == 2
    assert extended["calls"] == cycle["calls"] == 2
    assert extended["extension_required_if_review_needed"] is False
    assert state.read_bytes() == before


def test_only_the_affected_lens_needs_review_recovery(tmp_path, monkeypatch, capsys):
    _, _, cli, _, _ = practical_architecture(
        tmp_path,
        monkeypatch,
        stale=("02-architecture-assessment.md",),
    )
    result = handoff(cli, capsys)
    extensions = [cycle["lens"] for cycle in result["review_cycles"] if cycle["extension_required_if_review_needed"]]
    assert extensions == ["comprehensive"]
    cost = next(review for review in result["reviews"] if review["artifact"].endswith("03-des-cost-estimate.md"))
    assert cost["status"] == "current"


def test_invalid_private_scope_does_not_hide_exhausted_cycles(tmp_path, monkeypatch, capsys):
    project, _, cli, _, _ = practical_architecture(tmp_path, monkeypatch, stale=("02-architecture-assessment.md",))
    sidecar = project / "challenge-findings-architecture.json"
    review = json.loads(sidecar.read_text())
    review["supporting_inputs"] = [
        {"path": "apex-private-policy://synthetic/unknown-scope/subscription-1.json", "sha256": "0" * 64}
    ]
    sidecar.write_text(json.dumps(review))
    state = project / "00-session-state.json"
    before = state.read_bytes()
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert result["next_action"]["kind"] == "authorize_recovery_work_package"
    assert len(result["review_cycles"]) == 2
    architecture = next(cycle for cycle in result["review_cycles"] if cycle["lens"] == "comprehensive")
    assert architecture["calls"] == architecture["max_calls"] == 2
    assert architecture["extension_required_if_review_needed"] is True
    assert any("private" in error["detail"].lower() for error in result["blocked_prerequisites"][0]["errors"])
    cost = next(cycle for cycle in result["review_cycles"] if cycle["lens"] == "cost-feasibility")
    assert cost["revalidation_needed"] is False
    assert state.read_bytes() == before


def test_review_selection_failure_still_reports_consumed_cycle_bounds(tmp_path, monkeypatch, capsys):
    project, _, cli, _, _ = practical_architecture(tmp_path, monkeypatch)
    completion = importlib.import_module("apex_recall.commands.complete_step")

    def invalid_selection(*args, **kwargs):
        raise ValueError("Selected review bytes changed; explicit owner resolution required")

    monkeypatch.setattr(completion, "_select_replacement_review", invalid_selection)
    state = project / "00-session-state.json"
    before = state.read_bytes()
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert result["next_action"]["kind"] == "authorize_recovery_work_package"
    assert len(result["review_cycles"]) == 2
    assert all(cycle["calls"] == cycle["max_calls"] == 2 for cycle in result["review_cycles"])
    assert "Selected review bytes changed" in json.dumps(result["blocked_prerequisites"])
    assert state.read_bytes() == before


def test_invalid_review_lens_cannot_hide_its_consumed_cycle(tmp_path, monkeypatch, capsys):
    project, _, cli, _, _ = practical_architecture(tmp_path, monkeypatch, stale=("02-architecture-assessment.md",))
    sidecar = project / "challenge-findings-architecture.json"
    review = json.loads(sidecar.read_text())
    review["review_focus"] = "invalid-lens"
    sidecar.write_text(json.dumps(review))
    result = handoff(cli, capsys)
    assert result["next_action"]["kind"] == "authorize_recovery_work_package"
    architecture = next(cycle for cycle in result["review_cycles"] if cycle["lens"] == "comprehensive")
    assert architecture["calls"] == architecture["max_calls"] == 2
    assert architecture["extension_required_if_review_needed"] is True
    cost = next(cycle for cycle in result["review_cycles"] if cycle["lens"] == "cost-feasibility")
    assert cost["revalidation_needed"] is False


def test_changed_projection_requires_owner_binding_even_with_remaining_calls(tmp_path, monkeypatch, capsys):
    project, writer, cli, practical, record = practical_architecture(tmp_path, monkeypatch)
    state = project / "00-session-state.json"
    data = writer.read_state(state)
    for identity in data["decisions"]["review_cycles"]:
        practical.extend_cycle(
            data,
            {
                "cycle_id": identity,
                "max_calls": 4,
                "request_id": "actual-original-scope-extension",
                "projection_sha256": practical.digest(practical.projection(data, "2")),
            },
        )
    practical.record_input(data, {**record, "value": "Changed actual owner choice", "request_id": "new-actual-answer"})
    practical.sync_views("synthetic", data, "2")
    writer.write_state("synthetic", data)
    before = state.read_bytes()
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert result["next_action"]["kind"] == "authorize_recovery_work_package"
    assert all(cycle["remaining_calls"] == 2 for cycle in result["review_cycles"])
    assert all(cycle["projection_changed"] for cycle in result["review_cycles"])
    assert all(cycle["extension_required_if_review_needed"] for cycle in result["review_cycles"])
    assert any(error["kind"] == "review-scope" for error in result["blocked_prerequisites"][0]["errors"])
    assert state.read_bytes() == before
    data = writer.read_state(state)
    for identity in data["decisions"]["review_cycles"]:
        practical.extend_cycle(
            data,
            {
                "cycle_id": identity,
                "max_calls": 5,
                "request_id": "actual-new-scope-revision-grant",
                "projection_sha256": practical.digest(practical.projection(data, "2")),
            },
        )
    writer.write_state("synthetic", data)
    result = handoff(cli, capsys)
    assert result["status"] == "READY"
    assert all(not cycle["projection_changed"] for cycle in result["review_cycles"])
    assert all(not cycle["extension_required_if_review_needed"] for cycle in result["review_cycles"])
    assert all(cycle["calls"] == 2 for cycle in result["review_cycles"])


def test_material_projection_drift_cannot_reuse_old_scope_or_renew_allowance(tmp_path, monkeypatch, capsys):
    project, writer, cli, practical, record = practical_architecture(tmp_path, monkeypatch)
    state = project / "00-session-state.json"
    data = writer.read_state(state)
    practical.record_input(data, {**record, "value": "Changed actual owner choice", "request_id": "new-actual-answer"})
    writer.write_state("synthetic", data)
    before = state.read_bytes()
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert any(error["kind"] == "assessment" for error in result["blocked_prerequisites"][0]["errors"])
    assert all(cycle["extension_required_if_review_needed"] for cycle in result["review_cycles"])
    assert state.read_bytes() == before


def test_handoff_does_not_invalidate_unrelated_older_steps(tmp_path, monkeypatch, capsys):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-governance-constraints-pass1.json")
    data = writer.read_state(project / "00-session-state.json")
    for step in ("1", "2", "3", "3_5"):
        data["steps"][step] = {"status": "complete"}
    data["steps"]["4"] = {"status": "in_progress"}
    writer.write_state("synthetic", data)
    result = handoff(cli, capsys)
    assert result["status"] == "READY"
    assert {review["step"] for review in result["reviews"]} == {"3_5"}


def test_blocked_plain_handoff_names_the_action_instead_of_repeating_resume(tmp_path, monkeypatch, capsys):
    practical_architecture(tmp_path, monkeypatch, stale=("02-architecture-assessment.md",))
    capsys.readouterr()
    assert importlib.import_module("apex_recall.__main__").main(["handoff", "synthetic"]) == 0
    text = capsys.readouterr().out
    assert "Prerequisite recovery required" in text
    assert "scope-matching recovery authority" in text
    assert "01-Orchestrator" in text
    assert "02-architecture-assessment.md" in text
    assert "Synthetic current-input drift" in text
    assert "/apex-workflow-start resume" not in text


def test_plain_handoff_prints_the_missing_review_artifact_and_reason(tmp_path, monkeypatch, capsys):
    project, _, cli, _, _ = practical_architecture(tmp_path, monkeypatch)
    (project / "challenge-findings-architecture.json").unlink()
    capsys.readouterr()
    assert cli.main(["handoff", "synthetic"]) == 0
    text = capsys.readouterr().out
    assert "02-architecture-assessment.md: Required review is missing" in text


def test_authorized_plan_exception_is_reused_without_closing_findings(tmp_path, monkeypatch, capsys):
    fixture = risk_fixture(tmp_path, monkeypatch)
    cli, project = fixture["cli"], fixture["project"]
    assert cli.main(["complete-step", "synthetic", "4", *fixture["flags"], "--json"]) == 0
    assert cli.main(["start-step", "synthetic", "5", "--json"]) == 0
    state = project / "00-session-state.json"
    before = state.read_bytes()
    review = project / "challenge-findings-plan.json"
    reviewed = review.read_bytes()
    result = handoff(cli, capsys)
    assert result["status"] == "READY"
    assert result["active_step"] == "5"
    assert result["permission_granted"] is False
    assert state.read_bytes() == before
    assert review.read_bytes() == reviewed
    assert json.loads(reviewed)["must_fix_count"] == 1


def test_plan_exception_does_not_hide_changed_supporting_inputs(tmp_path, monkeypatch, capsys):
    fixture = risk_fixture(tmp_path, monkeypatch)
    cli, project = fixture["cli"], fixture["project"]
    assert cli.main(["complete-step", "synthetic", "4", *fixture["flags"], "--json"]) == 0
    assert cli.main(["start-step", "synthetic", "5", "--json"]) == 0
    state = project / "00-session-state.json"
    before = state.read_bytes()
    supporting = project / "04-iac-contract.json"
    supporting.write_text(supporting.read_text() + "\n")
    result = handoff(cli, capsys)
    assert result["status"] == "BLOCKED"
    assert result["next_action"]["owner"] == "05-IaC Planner"
    assert result["blocked_prerequisites"][0]["errors"]
    assert state.read_bytes() == before
