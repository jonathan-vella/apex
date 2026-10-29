"""Behavioral checkpoints for practical scope, views and bounded review cycles."""

import copy
import importlib
import json
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from .test_reliability import setup
from .test_transition import _seed_review


def practical_project(tmp_path: Path):
    project, writer, cli = setup(tmp_path)
    module = importlib.import_module("apex_recall.practical")
    data = writer.read_state(project / "00-session-state.json")
    data["decisions"]["workflow_contract"] = module.CONTRACT
    record = {
        "input_id": "diagnostic_acceptance",
        "value": "DEV only; PROD residency unresolved",
        "environments": ["dev"],
        "owner": "platform-owner",
        "request_id": "human-scope",
    }
    module.record_input(data, record)
    module.grant_phase(
        data,
        "3_5",
        {
            "request_id": "human-phase",
            "input_ids": [record["input_id"]],
            "environments": ["dev"],
        },
    )
    writer.write_state("synthetic", data)
    return project, writer, cli, module, record


def test_authority_views_and_proceed_reject_partial_publication_and_material_drift(tmp_path: Path):
    project, writer, cli, module, record = practical_project(tmp_path)
    governance = project / "04-governance-constraints.json"
    governance.write_text(
        json.dumps({"findings": [{"effect": "deny"}], "discovery_metadata": {"signature": "original"}})
    )
    markdown = project / "04-governance-constraints.md"
    markdown.write_text("# Governance\n\n## Reconciliation\n")
    data = writer.read_state(project / "00-session-state.json")
    assert module.check_views
    with pytest.raises(ValueError, match="missing or stale"):
        module.check_views("synthetic", data, "3_5")
    module.sync_views("synthetic", data, "3_5")
    writer.write_state("synthetic", data)
    projected = json.loads(governance.read_text())
    assert projected["findings"] == [{"effect": "deny"}]
    assert projected["discovery_metadata"] == {"signature": "original"}
    assert projected["project_assessment"]["inputs"][record["input_id"]]["value"] == record["value"]
    data = writer.read_state(project / "00-session-state.json")
    module.check_views("synthetic", data, "3_5")
    assert "PROD residency unresolved" in markdown.read_text()
    markdown.write_text(markdown.read_text().replace("DEV only", "DEV and PROD"))
    with pytest.raises(ValueError, match="inconsistent"):
        module.check_views("synthetic", data, "3_5")
    module.sync_views("synthetic", data, "3_5")
    writer.write_state("synthetic", data)
    data = writer.read_state(project / "00-session-state.json")
    changed = {**record, "value": "Different decision", "request_id": "new-owner-response"}
    module.record_input(data, changed)
    with pytest.raises(ValueError, match="stale"):
        module.check_views("synthetic", data, "3_5")
    assert data["decision_log"][-1]["supersedes"]


@pytest.mark.parametrize(
    "field,value",
    [
        ("value", "PROD acceptance too"),
        ("environments", ["dev", "prod"]),
        ("owner", "different-owner"),
        ("request_id", "unobserved-request"),
    ],
)
def test_material_changes_cannot_be_disguised_as_mechanical_repairs(tmp_path: Path, field: str, value: object):
    _, _, _, module, record = practical_project(tmp_path)
    before = {"scope": record}
    after = copy.deepcopy(before)
    after["scope"][field] = value
    for repair in module.MECHANICAL_REPAIRS:
        with pytest.raises(ValueError, match="Material"):
            module.assert_routine(before, after, repair)
    module.assert_routine(before, before, "render")
    with pytest.raises(ValueError):
        module.assert_routine(before, before, "arbitrary-wording-change")


def test_core_synthetic_loop_removes_administrative_fields_not_material_decisions(tmp_path: Path):
    project, writer, _, module, _ = practical_project(tmp_path)
    # Same scenario: capture scope once, correct a derived record, retain final stage approval.
    before = [
        ["diagnostic_acceptance"],
        ["approve_json_sync"],
        ["approve_markdown_sync"],
        ["authorize_closure"],
        ["stage_approval"],
    ]
    data = writer.read_state(project / "00-session-state.json")
    module.sync_views("synthetic", data, "3_5")
    writer.write_state("synthetic", data)
    module.check_views("synthetic", writer.read_state(project / "00-session-state.json"), "3_5")
    proposed = [
        {"kind": "material", "input_id": "diagnostic_acceptance"},
        {
            "kind": "routine",
            "input_id": "approve_json_sync",
            "repair": "render",
            "protected_after": module.projection(data, "3_5"),
        },
        {
            "kind": "routine",
            "input_id": "approve_markdown_sync",
            "repair": "render",
            "protected_after": module.projection(data, "3_5"),
        },
        {"kind": "stage_approval", "input_id": "stage_approval"},
    ]
    generated = module.pending_questions(data, "3_5", proposed)
    # The scope decision already happened in both runs; include that same initial interaction.
    after = [["diagnostic_acceptance"], *[[item["input_id"]] for item in generated]]
    assert len(after) < len(before)
    assert sum(map(len, after)) < sum(map(len, before))
    assert set(sum(before, [])) - set(sum(after, [])) == {
        "approve_json_sync",
        "approve_markdown_sync",
        "authorize_closure",
    }
    assert after[0] == before[0] and after[-1] == before[-1]


def test_cycle_counts_failure_and_requires_explicit_extension_not_new_worker(tmp_path: Path, monkeypatch):
    project, writer, cli, module, _ = practical_project(tmp_path)
    data = writer.read_state(project / "00-session-state.json")
    module.sync_views("synthetic", data, "3_5")
    writer.write_state("synthetic", data)
    artifact = project / "artifact.md"
    artifact.write_text("Original")
    request = {
        "request_id": "initial",
        "step": "3_5",
        "project_name": "synthetic",
        "artifact_path": "agent-output/synthetic/artifact.md",
        "review_focus": "governance-reconciliation",
        "pass_number": 1,
        "output_path": "agent-output/synthetic/findings.json",
        "prior_findings": None,
        "supporting_inputs": [
            {
                "path": "agent-output/synthetic/assessment-step-3_5.json",
                "sha256": writer.file_revision(project / "assessment-step-3_5.json"),
            }
        ],
    }
    path = tmp_path / "request.json"
    path.write_text(json.dumps(request))
    # Request/provenance validation has real fixtures in test_record_review.mjs; this test isolates accounting.
    monkeypatch.setattr(
        module.subprocess, "run", Mock(return_value=SimpleNamespace(returncode=0, stdout="", stderr=""))
    )

    def audit(identity: str, outcome: str, *extra: str) -> int:
        request["request_id"] = identity
        path.write_text(json.dumps(request))
        return cli.main(
            [
                "review-audit",
                "synthetic",
                "3_5",
                "--attempt-kind",
                "invocation",
                "--review-request",
                str(path),
                "--attempt-outcome",
                outcome,
                *extra,
                "--json",
            ]
        )

    assert audit("initial", "started") == 0
    assert audit("initial", "failed") == 0
    request["prior_findings"] = []
    artifact.write_text("Routine correction")
    assert audit("closure", "started", "--closure-of", "initial") == 0
    assert audit("closure", "completed", "--closure-of", "initial", "--review-output", "nonempty") == 0
    closure_result = project / "closure-findings.json"
    closure_result.write_text(
        json.dumps(
            {
                "challenged_artifact": "agent-output/synthetic/artifact.md",
                "review_focus": "governance-reconciliation",
                "pass_number": 1,
                "overall_assessment": "APPROVED",
                "review_execution": {"request_id": "closure"},
            }
        )
    )
    request["output_path"] = "agent-output/synthetic/closure-findings.json"
    assert (
        audit(
            "closure",
            "completed",
            "--closure-of",
            "initial",
            "--review-output",
            "nonempty",
            "--review-result",
            str(closure_result),
        )
        == 0
    )
    assert audit("new-worker", "started", "--closure-of", "initial") == 1
    state = writer.read_state(project / "00-session-state.json")
    key = module.cycle_identity(request)
    assert state["decisions"]["review_cycles"][key]["calls"] == 2
    assert state["decisions"]["review_cycles"][key]["current_path"] == "closure-findings.json"
    module.extend_cycle(
        state,
        {
            "cycle_id": key,
            "max_calls": 3,
            "request_id": "explicit-owner-extension",
            "projection_sha256": module.digest(module.projection(state, "3_5")),
        },
    )
    writer.write_state("synthetic", state)
    assert audit("authorized-extra", "started", "--closure-of", "initial") == 0
    assert len(writer.read_state(project / "00-session-state.json")["review_attempts"]) == 5


def test_adoption_is_dry_run_until_owner_write_and_preserves_history(tmp_path: Path, capsys):
    project, writer, cli = setup(tmp_path)
    path = project / "00-session-state.json"
    before = path.read_bytes()
    assert cli.main(["decide", "synthetic", "--adopt-workflow", "practical-v1", "--dry-run", "--json"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["review_allowance_reset"] is False
    assert path.read_bytes() == before
    assert cli.main(["decide", "synthetic", "--adopt-workflow", "practical-v1", "--json"]) == 1
    capsys.readouterr()
    assert (
        cli.main(
            [
                "decide",
                "synthetic",
                "--adopt-workflow",
                "practical-v1",
                "--rationale",
                "Actual owner opt-in in synthetic test",
                "--json",
            ]
        )
        == 0
    )
    after = writer.read_state(path)
    assert after["steps"] == json.loads(before)["steps"]
    assert after["decisions"]["workflow_contract"] == "practical-v1"


def test_practical_needs_revision_is_not_approved_by_a_disposition(tmp_path: Path):
    project, _, _, _, _ = practical_project(tmp_path)
    document = _seed_review(project, "challenge-findings-requirements.json")
    document["overall_assessment"] = "NEEDS_REVISION"
    (project / "challenge-findings-requirements.json").write_text(json.dumps(document))
    completion = importlib.import_module("apex_recall.commands.complete_step")
    error = completion._challenger_findings_invalid("synthetic", "1")
    assert "requires revision" in error
    assert "disposition is not closure" in error


def test_practical_closure_receipt_with_zero_must_fix_is_gate_ready_without_mutating_verdict(tmp_path: Path):
    project, writer, _, _, _ = practical_project(tmp_path)
    document = _seed_review(project, "challenge-findings-plan-closure1.json")
    document["overall_assessment"] = "NEEDS_REVISION"
    document["should_fix_count"] = 1
    finding = {
        "severity": "should_fix",
        "category": "waf_blind_spot",
        "claim": "Non-blocking closure should_fix",
        "evidence": "Evidence",
        "impact": "Impact",
        "artifact_section": "Section",
        "traces_to": [],
    }
    import hashlib

    identity = f"{finding['category']}|{finding['claim']}|{finding['artifact_section']}"
    finding["id"] = hashlib.sha256(identity.encode()).hexdigest()[:8]
    document["findings"] = [finding]
    (project / "challenge-findings-plan-closure1.json").write_text(json.dumps(document))
    state = writer.read_state(project / "00-session-state.json")
    state["decisions"].setdefault("review_cycles", {})["plan-cycle"] = {
        "step": "4",
        "artifact": "agent-output/synthetic/04-implementation-plan.md",
        "lens": "comprehensive",
        "pass_number": 1,
        "canonical_path": "agent-output/synthetic/challenge-findings-plan.json",
        "current_path": "challenge-findings-plan-closure1.json",
        "initial_id": "plan-r1",
        "projection": "0" * 64,
        "calls": 2,
        "max_calls": 2,
    }
    writer.write_state("synthetic", state)
    completion = importlib.import_module("apex_recall.commands.complete_step")
    assert completion._challenger_findings_invalid("synthetic", "4") is None


def test_scoped_holds_preserve_prod_and_account_for_shared_dependencies(tmp_path: Path):
    project, writer, _, module, _ = practical_project(tmp_path)
    data = writer.read_state(project / "00-session-state.json")
    hold = {
        "input_id": "production_residency",
        "environments": ["prod"],
        "owner": "requirements-owner",
        "request_id": "human-prod-hold",
        "value": {"blocked_actions": ["plan-complete", "deploy"], "release_condition": "Verified EU target"},
    }
    module.record_input(data, hold)
    assert module.action_readiness(data, "plan-complete", ["dev"])["status"] == "current"
    assert module.action_readiness(data, "plan-complete", ["prod"])["status"] == "blocked"
    hold["value"]["shared_with"] = ["dev"]
    hold["request_id"] = "new-shared-dependency-response"
    module.record_input(data, hold)
    assert module.action_readiness(data, "plan-complete", ["dev"])["status"] == "blocked"
    assert module.action_readiness(data, "deploy", ["prod"])["permission_granted"] is False


def test_proceed_rechecks_view_revision_and_never_waives_stale_projection(tmp_path: Path, capsys):
    project, writer, cli, module, record = practical_project(tmp_path)
    data = writer.read_state(project / "00-session-state.json")
    module.sync_views("synthetic", data, "3_5")
    writer.write_state("synthetic", data)
    current = writer.read_state(project / "00-session-state.json")
    module.check_views("synthetic", current, "3_5")
    competitor = writer.read_state(project / "00-session-state.json")
    module.record_input(competitor, {**record, "value": "Changed scope intent", "request_id": "new-owner-response"})
    writer.write_state("synthetic", competitor)
    with pytest.raises(ValueError, match="conflict"):
        writer.check_state_revision(current, project / "00-session-state.json")
    before = (project / "00-session-state.json").read_bytes()
    assert cli.main(["complete-step", "synthetic", "3_5", "--json"]) == 2
    assert (project / "00-session-state.json").read_bytes() == before


def _feasibility_snapshot(tmp_path: Path, snapshot: Path, subscription: str) -> dict:
    source = Path(__file__).resolve().parents[3] / ".github/skills/apex-azure-governance-discovery/scripts"
    scripts = tmp_path / ".github/skills/apex-azure-governance-discovery/scripts"
    scripts.mkdir(parents=True, exist_ok=True)
    for name in ("discover.py", "render_governance.py"):
        shutil.copyfile(source / name, scripts / name)
    # Empty findings signature uses the same deterministic collector algorithm, not an invented approval.
    calculated = subprocess.run(
        [
            "python3",
            "-c",
            "import sys;sys.path.insert(0,sys.argv[1]);from render_governance import _completeness_signature;"
            "print(_completeness_signature([]))",
            str(scripts),
        ],
        text=True,
        capture_output=True,
        check=True,
    ).stdout.strip()
    envelope = {
        "schema_version": "governance-constraints-v1",
        "project": "synthetic",
        "subscription_id": subscription,
        "discovery_status": "COMPLETE",
        "findings": [],
        "discovery_options": {"include_defender_auto": True},
        "discovery_metadata": {
            "discovery_status": "COMPLETE",
            "discovered_at": datetime.now(UTC).isoformat(),
            "ttl_days": 7,
            "scope": {"subscription_id": subscription},
            "completeness_signature": calculated,
        },
    }
    snapshot.write_text(json.dumps(envelope))
    return envelope


def _read_scope(module, data: dict, scope: dict) -> None:
    module.record_input(
        data,
        {
            "input_id": "azure_read_scope",
            "value": {**scope, "policy_read_scope": "subscription-and-inherited"},
            "environments": ["dev"],
            "owner": "subscription-owner",
            "request_id": "read-scope-once",
        },
    )


def test_early_feasibility_reuses_scope_without_formal_governance_completion(tmp_path: Path):
    project, writer, _, module, _ = practical_project(tmp_path)
    data = writer.read_state(project / "00-session-state.json")
    _read_scope(module, data, {"subscription_id": "synthetic-subscription"})
    snapshot = project / "04-policy-feasibility.json"
    envelope = _feasibility_snapshot(tmp_path, snapshot, "synthetic-subscription")
    module.bind_feasibility("synthetic", data, snapshot)
    assert "snapshots" not in data["metadata"]["policy_feasibility"]
    assert module.check_feasibility("synthetic", data) == "current"
    assert module.check_feasibility("synthetic", data) == "current"
    assert data["steps"]["3_5"]["status"] != "complete"
    assert data["decision_log"][-1]["input_id"] == "azure_read_scope"
    envelope["discovery_options"]["include_defender_auto"] = False
    snapshot.write_text(json.dumps(envelope))
    with pytest.raises(ValueError, match="incomplete"):
        module.check_feasibility("synthetic", data)


def _multi_feasibility_project(tmp_path: Path):
    project, writer, _, module, _ = practical_project(tmp_path)
    data = writer.read_state(project / "00-session-state.json")
    _read_scope(module, data, {"subscription_ids": ["sub-a", "sub-b"]})
    snapshots = []
    for subscription in ("sub-a", "sub-b"):
        snapshot = project / f"04-policy-feasibility-{subscription}.json"
        _feasibility_snapshot(tmp_path, snapshot, subscription)
        snapshots.append(snapshot)
    index = project / "04-policy-feasibility.json"
    index.write_text(
        json.dumps(
            {
                "subscriptions": [
                    {"subscription_id": subscription, "path": snapshot.name}
                    for subscription, snapshot in zip(("sub-a", "sub-b"), snapshots, strict=True)
                ]
            }
        )
    )
    return project, writer, module, data, index, snapshots


def test_multi_subscription_feasibility_validates_every_snapshot_and_preserves_formal_gate(tmp_path: Path, monkeypatch):
    project, writer, module, data, index, snapshots = _multi_feasibility_project(tmp_path)
    offline = Mock(wraps=module.subprocess.run)
    monkeypatch.setattr(module.subprocess, "run", offline)
    module.bind_feasibility("synthetic", data, index)
    assert module.check_feasibility("synthetic", data) == "current"
    assert [call.args[0][call.args[0].index("--subscription") + 1] for call in offline.call_args_list] == [
        "sub-a",
        "sub-b",
        "sub-a",
        "sub-b",
    ]
    assert all("--validate-only" in call.args[0] for call in offline.call_args_list)
    binding = data["metadata"]["policy_feasibility"]
    assert binding["snapshots"] == {
        str(snapshot.relative_to(tmp_path)): writer.file_revision(snapshot) for snapshot in snapshots
    }
    assert all(snapshot in data.input_revisions for snapshot in [index, *snapshots])
    assert data["steps"]["3_5"]["status"] != "complete"
    assert data["decision_log"][-1]["input_id"] == "azure_read_scope"
    writer.write_state("synthetic", data)
    assert module.check_feasibility("synthetic", writer.read_state(project / "00-session-state.json")) == "current"


@pytest.mark.parametrize("broken_index", [0, 1])
@pytest.mark.parametrize("failure", ["missing", "stale", "failed", "partial", "scope", "signature"])
def test_multi_subscription_feasibility_blocks_any_missing_stale_or_failed_snapshot(
    tmp_path: Path, broken_index: int, failure: str
):
    _, _, module, data, index, snapshots = _multi_feasibility_project(tmp_path)
    module.bind_feasibility("synthetic", data, index)
    before = copy.deepcopy(data["metadata"]["policy_feasibility"])
    snapshot = snapshots[broken_index]
    envelope = json.loads(snapshot.read_text())
    if failure == "missing":
        snapshot.unlink()
    else:
        if failure == "stale":
            envelope["discovery_metadata"]["discovered_at"] = "2000-01-01T00:00:00+00:00"
        elif failure in ("failed", "partial"):
            envelope["discovery_status"] = failure.upper()
        elif failure == "scope":
            envelope["subscription_id"] = "different-subscription"
        else:
            envelope["discovery_metadata"]["completeness_signature"] = "invalid"
        snapshot.write_text(json.dumps(envelope))
    for operation in (module.check_feasibility, lambda project, state: module.bind_feasibility(project, state, index)):
        with pytest.raises(ValueError, match="missing|incomplete"):
            operation("synthetic", data)
        assert data["metadata"]["policy_feasibility"] == before


def test_multi_subscription_feasibility_hash_binds_children_and_requires_scope_refresh(tmp_path: Path):
    _, _, module, data, index, snapshots = _multi_feasibility_project(tmp_path)
    module.bind_feasibility("synthetic", data, index)
    snapshots[1].write_text(snapshots[1].read_text() + "\n")
    with pytest.raises(ValueError, match="subscription evidence changed"):
        module.check_feasibility("synthetic", data)
    module.bind_feasibility("synthetic", data, index)
    assert module.check_feasibility("synthetic", data) == "current"
    data["decisions"]["material_inputs"]["azure_read_scope"]["value"]["subscription_ids"].append("sub-c")
    with pytest.raises(ValueError, match="scope changed"):
        module.check_feasibility("synthetic", data)
    with pytest.raises(ValueError, match="cover exactly"):
        module.bind_feasibility("synthetic", data, index)


@pytest.mark.parametrize("failure", ["failed", "missing"])
def test_multi_subscription_feasibility_checks_remaining_subscriptions_after_validation_failure(
    tmp_path: Path, monkeypatch, failure: str
):
    _, _, module, data, index, snapshots = _multi_feasibility_project(tmp_path)
    if failure == "missing":
        snapshots[0].unlink()
    else:
        envelope = json.loads(snapshots[0].read_text())
        envelope["discovery_status"] = "FAILED"
        snapshots[0].write_text(json.dumps(envelope))
    offline = Mock(wraps=module.subprocess.run)
    monkeypatch.setattr(module.subprocess, "run", offline)
    with pytest.raises(ValueError, match="incomplete"):
        module.bind_feasibility("synthetic", data, index)
    assert [call.args[0][call.args[0].index("--subscription") + 1] for call in offline.call_args_list] == (
        ["sub-b"] if failure == "missing" else ["sub-a", "sub-b"]
    )
    assert "policy_feasibility" not in data.get("metadata", {})


@pytest.mark.parametrize(
    "scope",
    [
        {},
        {"subscription_ids": []},
        {"subscription_ids": "sub-a"},
        {"subscription_ids": ["sub-a", "SUB-A"]},
        {"subscription_ids": ["sub-a", ""]},
        {"subscription_ids": ["sub-a", None]},
        {"subscription_ids": ["sub-a", " sub-b"]},
        {"subscription_id": "sub-a", "subscription_ids": ["sub-a"]},
    ],
)
def test_feasibility_rejects_invalid_or_ambiguous_subscription_scope(tmp_path: Path, scope: dict):
    project, writer, _, module, _ = practical_project(tmp_path)
    data = writer.read_state(project / "00-session-state.json")
    _read_scope(module, data, scope)
    with pytest.raises(ValueError, match="subscription IDs"):
        module.bind_feasibility("synthetic", data, project / "nonexistent.json")
    assert "policy_feasibility" not in data.get("metadata", {})


@pytest.mark.parametrize("failure", ["missing", "extra", "duplicate", "shared", "absolute", "escape", "symlink"])
def test_multi_subscription_feasibility_rejects_incomplete_or_unsafe_index(tmp_path: Path, failure: str):
    _, _, module, data, index, snapshots = _multi_feasibility_project(tmp_path)
    document = json.loads(index.read_text())
    entries = document["subscriptions"]
    if failure == "missing":
        entries.pop()
    elif failure == "extra":
        entries.append({"subscription_id": "sub-c", "path": "sub-c.json"})
    elif failure == "duplicate":
        entries.append(entries[0])
    elif failure == "shared":
        entries[1]["path"] = entries[0]["path"]
    elif failure == "absolute":
        entries[1]["path"] = str(snapshots[1])
    elif failure == "escape":
        entries[1]["path"] = "../../../outside.json"
    else:
        link = index.parent / "symlink.json"
        link.symlink_to(snapshots[1])
        entries[1]["path"] = link.name
    index.write_text(json.dumps(document))
    with pytest.raises(ValueError, match="cover exactly|Duplicate|distinct|index-relative|workspace"):
        module.bind_feasibility("synthetic", data, index)
    assert "policy_feasibility" not in data.get("metadata", {})


def test_handoff_auto_selects_active_project_and_emits_deterministic_contract(tmp_path: Path, capsys):
    project, writer, cli, _, _ = practical_project(tmp_path)
    data = writer.read_state(project / "00-session-state.json")
    data["current_step"] = 4
    data["decisions"]["iac_tool"] = "bicep"
    data["decisions"]["design_artifacts"] = "skip"
    for k in ("5", "6", "7"):
        data["steps"][k]["status"] = "pending"
    data["steps"]["1"]["status"] = "complete"
    data["steps"]["2"]["status"] = "complete"
    data["steps"]["3_5"]["status"] = "complete"
    data["steps"]["4"]["status"] = "in_progress"
    data["steps"]["4"]["sub_step"] = "phase_iac_planner_handoff"
    (project / "01-requirements.md").write_text("# req")
    (project / "02-architecture-assessment.md").write_text("# arch")
    (project / "04-governance-constraints.json").write_text("{}")
    writer.write_state("synthetic", data)

    assert cli.main(["handoff", "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "READY"
    assert payload["project"] == "synthetic"
    assert payload["auto_selected"] is True
    assert payload["active_step"] == "4"
    assert payload["next_owner"] == "05-IaC Planner"
    assert payload["checkpoint"] == "phase_iac_planner_handoff"
    assert payload["resume_command"] == "/apex-workflow-start resume synthetic"
    assert "agent-output/synthetic/02-architecture-assessment.md" in payload["frozen_artifacts"]
