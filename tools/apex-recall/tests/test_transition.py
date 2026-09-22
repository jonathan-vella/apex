"""Tests for `apex-recall transition` composite subcommand (#425, Wave 4).

The composite bundles `checkpoint` + N×`decide` + optional `complete-step` +
next-step `start-step` into ONE atomic write to `00-session-state.json`. It
must:

- Run the challenger-findings gate BEFORE any state mutation when `--complete`
  is set; refuse with exit 2 on missing sidecar.
- Honor `--allow-missing-challenger --challenger-skip-reason` for audited
  bypass and persist the skip in `decisions.challenger_skip[]`.
- Record decisions into the `decisions{}` map in the same write.
- Start the `to-step` with `status=in_progress` in the same write.
- Reject malformed `--decision key=value` pairs without mutating state.

Run with:
    cd tools/apex-recall && python -m pytest tests/test_transition.py
"""

from __future__ import annotations

import hashlib
import importlib
import io
import json
import os
import shutil
import subprocess
import sys
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

import pytest


def _reimport_with_root(root: Path):
    """Reimport apex_recall with APEX_ROOT pinned so writes land in `root`."""
    os.environ["APEX_ROOT"] = str(root)
    for mod in list(sys.modules):
        if mod.startswith("apex_recall"):
            del sys.modules[mod]
    return importlib.import_module("apex_recall.commands.transition")


def _seed_project(root: Path, project: str, *, with_step_2_gating: bool = False, with_sidecar: bool = False) -> Path:
    proj_dir = root / "agent-output" / project
    proj_dir.mkdir(parents=True, exist_ok=True)
    state = {
        "schema_version": "session-state-v3",
        "project": project,
        "current_step": 1,
        "steps": {
            "1": {"status": "in_progress", "started": "2026-05-21T19:00:00Z"},
            "2": {"status": "not_started"},
        },
        "decisions": {},
    }
    (proj_dir / "00-session-state.json").write_text(
        json.dumps(state),
        encoding="utf-8",
    )
    if with_step_2_gating:
        # Step 1 gating artifact for the challenger gate.
        (proj_dir / "01-requirements.md").write_text("# Requirements", encoding="utf-8")
    if with_sidecar:
        _seed_review(proj_dir, "challenge-findings-requirements.json")
    return proj_dir


def _seed_review(project: Path, sidecar: str) -> dict:
    root = project.parent.parent
    repo = Path(__file__).resolve().parents[3]
    for source in [
        ".github/agents/_subagents/challenger-review-subagent.agent.md",
        ".github/skills/apex-azure-defaults/references/adversarial-checklists.md",
        ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md",
    ]:
        target = root / source
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(repo / source, target)
    if not (root / "tools").exists():
        (root / "tools").symlink_to(repo / "tools", target_is_directory=True)
    if "requirements" in sidecar:
        artifact, kind, focus = "01-requirements.md", "requirements", "comprehensive"
    elif "cost-estimate" in sidecar:
        artifact, kind, focus = "03-des-cost-estimate.md", "cost-estimate", "cost-feasibility"
    elif "governance" in sidecar:
        artifact, kind, focus = "04-governance-constraints.md", "governance-constraints", "governance-reconciliation"
    elif "plan" in sidecar:
        artifact, kind, focus = "04-implementation-plan.md", "implementation-plan", "comprehensive"
    else:
        artifact, kind, focus = "02-architecture-assessment.md", "architecture", "comprehensive"
    if "pass1" in sidecar and kind in ("architecture", "implementation-plan"):
        focus = "security-governance"
    artifact_path = project / artifact
    if not artifact_path.exists():
        artifact_path.write_text("# Fixture artifact\n", encoding="utf-8")
    metadata = subprocess.run(
        ["node", str(repo / "tools/scripts/validate-challenger-findings.mjs"), "--metadata", str(artifact_path)],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    payload = {
        "schema_version": "1.0",
        "challenged_artifact": str(artifact_path),
        "artifact_type": kind,
        "review_focus": focus,
        "pass_number": 1,
        "risk_level": "low",
        "must_fix_count": 0,
        "should_fix_count": 0,
        "suggestion_count": 0,
        "findings": [],
        **json.loads(metadata.stdout),
    }
    (project / sidecar).write_text(json.dumps(payload), encoding="utf-8")
    return payload


def _capture(transition_mod, args: SimpleNamespace) -> tuple[int, dict]:
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = transition_mod.run(args)
    out = buf.getvalue().strip()
    payload = json.loads(out) if out else {}
    return rc, payload


def test_happy_path_no_gate_required(tmp_path):
    transition_mod = _reimport_with_root(tmp_path)
    _seed_project(tmp_path, "demo")
    args = SimpleNamespace(
        project="demo",
        from_step="1",
        to_step="2",
        decision=["iac_tool=bicep", "region=swedencentral"],
        complete=False,  # no gate
        allow_missing_challenger=False,
        challenger_skip_reason=None,
        json=True,
    )
    rc, payload = _capture(transition_mod, args)
    assert rc == 0
    assert payload["from_step"] == "1"
    assert payload["to_step"] == "2"
    assert payload["completed"] is False
    assert payload["decisions_recorded"] == ["iac_tool", "region"]

    # Verify single atomic write captured everything.
    state_path = tmp_path / "agent-output" / "demo" / "00-session-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert state["steps"]["1"]["status"] == "in_progress"  # not completed
    assert state["steps"]["2"]["status"] == "in_progress"  # to-step started
    assert state["decisions"]["iac_tool"] == "bicep"
    assert state["decisions"]["region"] == "swedencentral"
    assert state["current_step"] == 2


def test_complete_with_gating_artifact_and_sidecar_succeeds(tmp_path):
    transition_mod = _reimport_with_root(tmp_path)
    _seed_project(tmp_path, "demo", with_step_2_gating=True, with_sidecar=True)
    args = SimpleNamespace(
        project="demo",
        from_step="1",
        to_step="2",
        decision=None,
        complete=True,
        allow_missing_challenger=False,
        challenger_skip_reason=None,
        json=True,
    )
    rc, payload = _capture(transition_mod, args)
    assert rc == 0
    assert payload["completed"] is True

    state_path = tmp_path / "agent-output" / "demo" / "00-session-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert state["steps"]["1"]["status"] == "complete"
    assert state["steps"]["2"]["status"] == "in_progress"


def test_complete_blocked_when_sidecar_missing(tmp_path):
    transition_mod = _reimport_with_root(tmp_path)
    _seed_project(tmp_path, "demo", with_step_2_gating=True, with_sidecar=False)
    args = SimpleNamespace(
        project="demo",
        from_step="1",
        to_step="2",
        decision=None,
        complete=True,
        allow_missing_challenger=False,
        challenger_skip_reason=None,
        json=True,
    )
    rc, payload = _capture(transition_mod, args)
    assert rc == 2
    assert payload["error"] == "challenger_findings_missing"

    # Crucially: state must NOT have been mutated.
    state_path = tmp_path / "agent-output" / "demo" / "00-session-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert state["steps"]["1"]["status"] == "in_progress"
    assert state["steps"]["2"]["status"] == "not_started"


def test_exhausted_review_evidence_survives_reloaded_transition_attempts(tmp_path):
    project = _seed_project(tmp_path, "demo", with_step_2_gating=True, with_sidecar=False)
    failure_path = project / "_meta" / "challenger-failures.json"
    failure_path.parent.mkdir()
    failures = [
        {
            "timestamp": timestamp,
            "review_focus": "comprehensive",
            "output_path": "challenge-findings-requirements.json",
            "return_summary_verbatim": "No output",
            "output_file_size_bytes": 0,
            "last_error_message": "Missing findings payload",
        }
        for timestamp in ["2026-09-15T05:00:00Z", "2026-09-15T05:01:00Z"]
    ]
    failure_path.write_text(json.dumps(failures), encoding="utf-8")
    state_path = project / "00-session-state.json"
    original_state = state_path.read_bytes()
    original_failures = failure_path.read_bytes()
    args = SimpleNamespace(
        project="demo",
        from_step="1",
        to_step="2",
        decision=["iac_tool=terraform"],
        complete=True,
        allow_missing_challenger=False,
        challenger_skip_reason=None,
        json=True,
    )
    for _attempt in range(2):
        transition_mod = _reimport_with_root(tmp_path)
        status, payload = _capture(transition_mod, args)
        assert status == 2
        assert payload["error"] == "challenger_findings_missing"
        assert state_path.read_bytes() == original_state
        assert failure_path.read_bytes() == original_failures
        assert not (project / "challenge-findings-requirements.json").exists()


def test_complete_bypass_with_audit_reason(tmp_path):
    transition_mod = _reimport_with_root(tmp_path)
    _seed_project(tmp_path, "demo", with_step_2_gating=True, with_sidecar=False)
    args = SimpleNamespace(
        project="demo",
        from_step="1",
        to_step="2",
        decision=None,
        complete=True,
        allow_missing_challenger=True,
        challenger_skip_reason="time-boxed pilot — challenger run scheduled for next sprint",
        json=True,
    )
    rc, payload = _capture(transition_mod, args)
    assert rc == 0
    assert payload["challenger_skip_recorded"] is True

    state_path = tmp_path / "agent-output" / "demo" / "00-session-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    skips = state["decisions"]["challenger_skip"]
    assert len(skips) == 1
    assert skips[0]["step"] == "1"
    assert "time-boxed" in skips[0]["reason"]


def test_complete_bypass_without_reason_fails(tmp_path):
    transition_mod = _reimport_with_root(tmp_path)
    _seed_project(tmp_path, "demo", with_step_2_gating=True, with_sidecar=False)
    args = SimpleNamespace(
        project="demo",
        from_step="1",
        to_step="2",
        decision=None,
        complete=True,
        allow_missing_challenger=True,
        challenger_skip_reason=None,  # missing
        json=True,
    )
    rc, payload = _capture(transition_mod, args)
    assert rc == 2
    assert payload["error"] == "challenger_skip_reason_required"


def test_malformed_decision_rejected(tmp_path):
    transition_mod = _reimport_with_root(tmp_path)
    _seed_project(tmp_path, "demo")
    args = SimpleNamespace(
        project="demo",
        from_step="1",
        to_step="2",
        decision=["this-has-no-equals-sign"],
        complete=False,
        allow_missing_challenger=False,
        challenger_skip_reason=None,
        json=True,
    )
    rc, payload = _capture(transition_mod, args)
    assert rc == 1
    assert "expects key=value" in payload["error"]

    # State unchanged.
    state_path = tmp_path / "agent-output" / "demo" / "00-session-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert state["steps"]["2"]["status"] == "not_started"


@pytest.mark.parametrize("command", ["transition", "complete_step"])
@pytest.mark.parametrize("cost_findings", [None, "", "not-json"])
def test_step_two_requires_cost_review_without_mutating_history(tmp_path, command, cost_findings):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project_dir = _seed_project(tmp_path, "demo")
    (project_dir / "02-architecture-assessment.md").write_text("# Architecture", encoding="utf-8")
    (project_dir / "challenge-findings-architecture.json").write_text('{"findings": []}', encoding="utf-8")
    if cost_findings is not None:
        (project_dir / "challenge-findings-cost-estimate.json").write_text(cost_findings, encoding="utf-8")
    state_path = project_dir / "00-session-state.json"
    before = state_path.read_bytes()
    args = SimpleNamespace(
        project="demo",
        step="2",
        from_step="2",
        to_step="3",
        complete=True,
        decision=["review_depth=deep"],
        json=True,
    )
    result, payload = _capture(module, args)
    assert result == 2
    assert payload["required_sidecar"].endswith("challenge-findings-cost-estimate.json")
    assert state_path.read_bytes() == before


@pytest.mark.parametrize("command", ["transition", "complete_step"])
def test_step_two_completes_with_both_reviews(tmp_path, command):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project_dir = _seed_project(tmp_path, "demo")
    (project_dir / "03-des-cost-estimate.md").write_text("# Cost", encoding="utf-8")
    for sidecar in ["challenge-findings-architecture.json", "challenge-findings-cost-estimate.json"]:
        _seed_review(project_dir, sidecar)
    args = SimpleNamespace(project="demo", step="2", from_step="2", to_step="3", complete=True, json=True)
    result, _ = _capture(module, args)
    assert result == 0
    state = json.loads((project_dir / "00-session-state.json").read_text(encoding="utf-8"))
    assert state["steps"]["2"]["status"] == "complete"


def test_cost_only_output_still_requires_architecture_review(tmp_path):
    module = _reimport_with_root(tmp_path)
    project_dir = _seed_project(tmp_path, "demo")
    (project_dir / "03-des-cost-estimate.md").write_text("# Cost", encoding="utf-8")
    (project_dir / "challenge-findings-cost-estimate.json").write_text('{"findings": []}', encoding="utf-8")
    args = SimpleNamespace(project="demo", from_step="2", to_step="3", complete=True, json=True)
    result, payload = _capture(module, args)
    assert result == 2
    assert payload["required_sidecar"].endswith("challenge-findings-architecture.json")


@pytest.mark.parametrize("command", ["transition", "complete_step"])
def test_deep_review_uses_pass_one_but_still_requires_cost_review(tmp_path, command):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project_dir = _seed_project(tmp_path, "demo")
    state_path = project_dir / "00-session-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["decisions"]["review_depth"] = "deep"
    state["steps"]["2"]["status"] = "complete"
    state_path.write_text(json.dumps(state), encoding="utf-8")
    before = state_path.read_bytes()
    (project_dir / "02-architecture-assessment.md").write_text("# Architecture", encoding="utf-8")
    (project_dir / "challenge-findings-architecture.json").write_text('{"findings": []}', encoding="utf-8")
    args = SimpleNamespace(project="demo", step="2", from_step="2", to_step="3", complete=True, json=True)
    result, payload = _capture(module, args)
    assert result == 2
    assert payload["required_sidecar"].endswith("challenge-findings-architecture-pass1.json")
    _seed_review(project_dir, "challenge-findings-architecture-pass1.json")
    result, payload = _capture(module, args)
    assert result == 2
    assert payload["required_sidecar"].endswith("challenge-findings-cost-estimate.json")
    assert state_path.read_bytes() == before
    _seed_review(project_dir, "challenge-findings-cost-estimate.json")
    assert _capture(module, args)[0] == 0


@pytest.mark.parametrize("command", ["transition", "complete_step"])
@pytest.mark.parametrize(
    "depth,sidecar",
    [
        ("default", "challenge-findings-plan.json"),
        ("deep", "challenge-findings-plan-pass1.json"),
    ],
)
def test_plan_review_mode_preserves_atomic_completion(tmp_path, command, depth, sidecar):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project_dir = _seed_project(tmp_path, "demo")
    state_path = project_dir / "00-session-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["decisions"]["review_depth"] = depth
    state["steps"]["4"] = {"status": "in_progress"}
    state_path.write_text(json.dumps(state), encoding="utf-8")
    (project_dir / "04-implementation-plan.md").write_text("# Plan", encoding="utf-8")
    before = state_path.read_bytes()
    args = SimpleNamespace(project="demo", step="4", from_step="4", to_step="5", complete=True, json=True)
    result, payload = _capture(module, args)
    assert result == 2
    assert payload["required_sidecar"].endswith(sidecar)
    assert state_path.read_bytes() == before
    _seed_review(project_dir, sidecar)
    assert _capture(module, args)[0] == 0


@pytest.mark.parametrize("command", ["transition", "complete_step"])
@pytest.mark.parametrize(
    "defect",
    [
        "must_fix",
        "stale",
        "wrong_target",
        "wrong_focus",
        "wrong_hash",
        "malformed",
        "guidance_drift",
        "missing_validator",
        "wrong_pass",
        "blocked_verdict",
    ],
)
def test_governance_invalid_review_cannot_complete_or_bypass(tmp_path, command, defect):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project = _seed_project(tmp_path, "demo")
    sidecar = "challenge-findings-governance-constraints-pass1.json"
    review = _seed_review(project, sidecar)
    if defect == "must_fix":
        review["must_fix_count"] = 1
        review["findings"] = [{"severity": "must_fix"}]
        (project / "challenge-findings-governance-constraints-decisions.json").write_text(
            json.dumps({"decisions": [{"action": action} for action in ["accept", "reject", "defer"]]}),
            encoding="utf-8",
        )
    elif defect == "stale":
        (project / "04-governance-constraints.md").write_text("changed\n", encoding="utf-8")
    elif defect == "wrong_target":
        review["challenged_artifact"] = "somewhere-else.md"
    elif defect == "wrong_focus":
        review["review_focus"] = "comprehensive"
    elif defect == "wrong_hash":
        review["cache_inputs"]["artifact_hash"] = "0" * 64
    elif defect == "malformed":
        review = {"findings": []}
    elif defect == "guidance_drift":
        (tmp_path / ".github/skills/apex-azure-defaults/references/adversarial-checklists.md").write_text("changed\n")
    elif defect == "missing_validator":
        (tmp_path / "tools").unlink()
    elif defect == "wrong_pass":
        review["pass_number"] = 2
    elif defect == "blocked_verdict":
        review["overall_assessment"] = "BLOCKED"
    (project / sidecar).write_text(json.dumps(review), encoding="utf-8")
    state = project / "00-session-state.json"
    before = state.read_bytes()
    evidence_before = (project / sidecar).read_bytes()
    args = SimpleNamespace(
        project="demo",
        step="3_5",
        from_step="3_5",
        to_step="4",
        complete=True,
        decision=["region=changed"],
        json=True,
        allow_missing_challenger=True,
        challenger_skip_reason="must not bypass invalid review",
    )
    result, payload = _capture(module, args)
    assert result == 2
    assert payload["error"] == "challenger_findings_invalid"
    assert state.read_bytes() == before
    assert (project / sidecar).read_bytes() == evidence_before


@pytest.mark.parametrize("command", ["transition", "complete_step"])
def test_current_governance_review_allows_completion(tmp_path, command):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project = _seed_project(tmp_path, "demo")
    _seed_review(project, "challenge-findings-governance-constraints-pass1.json")
    args = SimpleNamespace(project="demo", step="3_5", from_step="3_5", to_step="4", complete=True, json=True)
    assert _capture(module, args)[0] == 0


@pytest.mark.parametrize("command", ["transition", "complete_step"])
def test_explicit_plan_replacement_preserves_history_and_records_selection(tmp_path, command):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project = _seed_project(tmp_path, "demo")
    original = project / "challenge-findings-plan.json"
    _seed_review(project, original.name)
    (project / "04-implementation-plan.md").write_text("# Corrected plan\n", encoding="utf-8")
    replacement = project / "challenge-findings-plan-pass2.json"
    review = _seed_review(project, replacement.name)
    review["pass_number"] = 2
    replacement.write_text(json.dumps(review), encoding="utf-8")
    original_bytes, replacement_bytes = original.read_bytes(), replacement.read_bytes()
    args = SimpleNamespace(project="demo", step="4", from_step="4", to_step="5", complete=True, json=True)
    assert _capture(module, args)[0] == 2
    args.plan_review = str(replacement.relative_to(tmp_path))
    args.plan_review_reason = "Explicit confirmation and recorded human approval"
    result, payload = _capture(module, args)
    assert result == 0, payload
    state = json.loads((project / "00-session-state.json").read_text(encoding="utf-8"))
    selection = state["decision_log"][-1]
    assert selection["decision"] == "Select Plan replacement review for completion"
    assert selection["step"] == "4"
    assert replacement.name in selection["rationale"]
    assert hashlib.sha256(replacement_bytes).hexdigest() in selection["rationale"]
    assert args.plan_review_reason in selection["rationale"]
    assert original.read_bytes() == original_bytes
    assert replacement.read_bytes() == replacement_bytes


@pytest.mark.parametrize("command", ["transition", "complete_step"])
def test_explicit_governance_replacement_preserves_history_and_records_selection(tmp_path, command):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project = _seed_project(tmp_path, "demo")
    original = project / "challenge-findings-governance-constraints-pass1.json"
    _seed_review(project, original.name)
    (project / "04-governance-constraints.md").write_text("# Corrected governance\n", encoding="utf-8")
    replacement = project / "challenge-findings-governance-constraints-pass3.json"
    review = _seed_review(project, replacement.name)
    review["pass_number"] = 3
    replacement.write_text(json.dumps(review), encoding="utf-8")
    original_bytes, replacement_bytes = original.read_bytes(), replacement.read_bytes()
    args = SimpleNamespace(project="demo", step="3_5", from_step="3_5", to_step="4", complete=True, json=True)
    assert _capture(module, args)[0] == 2
    args.governance_review = str(replacement)
    args.governance_review_reason = "Human-authorized verification of corrected inputs; completion separately approved"
    result, payload = _capture(module, args)
    assert result == 0, payload
    state = json.loads((project / "00-session-state.json").read_text(encoding="utf-8"))
    selection = state["decision_log"][-1]
    assert selection["decision"] == "Select Governance replacement review for completion"
    assert replacement.name in selection["rationale"]
    assert hashlib.sha256(replacement_bytes).hexdigest() in selection["rationale"]
    assert args.governance_review_reason in selection["rationale"]
    assert original.read_bytes() == original_bytes
    assert replacement.read_bytes() == replacement_bytes


@pytest.mark.parametrize("command", ["transition", "complete_step"])
@pytest.mark.parametrize("review_kind", ["governance", "plan"])
@pytest.mark.parametrize(
    "defect",
    [
        "missing_reason",
        "reason_only",
        "wrong_step",
        "missing_file",
        "outside_project",
        "symlink",
        "wrong_filename",
        "wrong_pass",
        "stale",
        "wrong_focus",
        "wrong_type",
        "wrong_target",
        "malformed",
        "must_fix",
        "missing_validator",
        "missing_original",
        "bypass",
        "wrong_hash",
        "blocked_verdict",
    ],
)
def test_selected_governance_review_fails_closed_without_mutation(tmp_path, command, defect, review_kind):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project = _seed_project(tmp_path, "demo")
    is_plan = review_kind == "plan"
    step = "4" if is_plan else "3_5"
    artifact = "04-implementation-plan.md" if is_plan else "04-governance-constraints.md"
    original = project / (
        "challenge-findings-plan.json" if is_plan else "challenge-findings-governance-constraints-pass1.json"
    )
    _seed_review(project, original.name)
    replacement = project / (
        "challenge-findings-plan-pass3.json" if is_plan else "challenge-findings-governance-constraints-pass3.json"
    )
    review = _seed_review(project, replacement.name)
    review["pass_number"] = 3
    args = SimpleNamespace(
        project="demo",
        step=step,
        from_step=step,
        to_step="5",
        complete=True,
        json=True,
    )
    setattr(args, f"{review_kind}_review", str(replacement))
    setattr(args, f"{review_kind}_review_reason", "Authorized replacement")
    if defect == "missing_reason":
        setattr(args, f"{review_kind}_review_reason", " ")
    elif defect == "reason_only":
        setattr(args, f"{review_kind}_review", None)
    elif defect == "wrong_step":
        args.step = args.from_step = "2"
    elif defect == "wrong_filename":
        replacement = project / "arbitrary-pass3.json"
        setattr(args, f"{review_kind}_review", str(replacement))
    elif defect == "outside_project":
        replacement = tmp_path / replacement.name
        setattr(args, f"{review_kind}_review", str(replacement))
    elif defect == "wrong_pass":
        review["pass_number"] = 2
    elif defect == "stale":
        (project / artifact).write_text("changed\n", encoding="utf-8")
    elif defect == "wrong_focus":
        review["review_focus"] = "security-governance" if is_plan else "comprehensive"
    elif defect == "wrong_type":
        review["artifact_type"] = "requirements"
    elif defect == "wrong_target":
        review["challenged_artifact"] = "other.md"
    elif defect == "must_fix":
        review["must_fix_count"] = 1
        review["findings"] = [{"severity": "must_fix"}]
    elif defect == "missing_validator":
        (tmp_path / "tools").unlink()
    elif defect == "missing_original":
        original.unlink()
    elif defect == "bypass":
        args.allow_missing_challenger = True
        args.challenger_skip_reason = "Must not bypass selected evidence"
    elif defect == "wrong_hash":
        review["cache_inputs"]["artifact_hash"] = "0" * 64
    elif defect == "blocked_verdict":
        review["overall_assessment"] = "BLOCKED"
    replacement.write_text("{" if defect == "malformed" else json.dumps(review), encoding="utf-8")
    if defect == "missing_file":
        replacement.unlink()
    elif defect == "symlink":
        target = project / "review-target.json"
        replacement.rename(target)
        replacement.symlink_to(target)
    before = {file: file.read_bytes() for file in project.iterdir() if file.is_file()}
    result, payload = _capture(module, args)
    assert result == 2, payload
    assert all(file.read_bytes() == content for file, content in before.items())


@pytest.mark.parametrize("review_kind", ["governance", "plan"])
def test_governance_selection_requires_completing_transition(tmp_path, review_kind):
    module = _reimport_with_root(tmp_path)
    project = _seed_project(tmp_path, "demo")
    is_plan = review_kind == "plan"
    _seed_review(
        project, "challenge-findings-plan.json" if is_plan else "challenge-findings-governance-constraints-pass1.json"
    )
    replacement = project / (
        "challenge-findings-plan-pass3.json" if is_plan else "challenge-findings-governance-constraints-pass3.json"
    )
    review = _seed_review(project, replacement.name)
    review["pass_number"] = 3
    replacement.write_text(json.dumps(review), encoding="utf-8")
    before = (project / "00-session-state.json").read_bytes()
    args = SimpleNamespace(
        project="demo",
        from_step="4" if is_plan else "3_5",
        to_step="4",
        complete=False,
        json=True,
    )
    setattr(args, f"{review_kind}_review", str(replacement))
    setattr(args, f"{review_kind}_review_reason", "Authorized replacement")
    assert _capture(module, args)[0] == 2
    assert (project / "00-session-state.json").read_bytes() == before


@pytest.mark.parametrize("command", ["complete-step", "transition"])
@pytest.mark.parametrize("review_kind", ["governance", "plan"])
def test_cli_parses_governance_review_selection(tmp_path, command, review_kind):
    _reimport_with_root(tmp_path)
    parser = importlib.import_module("apex_recall.__main__").build_parser()
    step_args = ["3_5"] if command == "complete-step" else ["--from-step", "3_5", "--to-step", "4", "--complete"]
    args = parser.parse_args(
        [
            command,
            "demo",
            *step_args,
            f"--{review_kind}-review",
            "agent-output/demo/review.json",
            f"--{review_kind}-review-reason",
            "Explicit authorization",
        ]
    )
    assert getattr(args, f"{review_kind}_review") == "agent-output/demo/review.json"
    assert getattr(args, f"{review_kind}_review_reason") == "Explicit authorization"


@pytest.mark.parametrize("command", ["transition", "complete_step"])
@pytest.mark.parametrize("defect", ["deep", "both_selectors", "wrong_governance_step"])
def test_plan_replacement_cannot_change_review_mode_or_mix_selectors(tmp_path, command, defect):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project = _seed_project(tmp_path, "demo")
    _seed_review(project, "challenge-findings-plan.json")
    replacement = project / "challenge-findings-plan-pass2.json"
    review = _seed_review(project, replacement.name)
    review["pass_number"] = 2
    replacement.write_text(json.dumps(review), encoding="utf-8")
    state_path = project / "00-session-state.json"
    args = SimpleNamespace(
        project="demo",
        step="4",
        from_step="4",
        to_step="5",
        complete=True,
        json=True,
        plan_review=str(replacement),
        plan_review_reason="Explicit confirmation",
    )
    if defect == "deep":
        state = json.loads(state_path.read_text(encoding="utf-8"))
        state["decisions"]["review_depth"] = "deep"
        state_path.write_text(json.dumps(state), encoding="utf-8")
    else:
        args.governance_review = str(replacement)
        args.governance_review_reason = "Wrong selector"
        if defect == "wrong_governance_step":
            args.plan_review = args.plan_review_reason = None
    before = state_path.read_bytes()
    assert _capture(module, args)[0] == 2
    assert state_path.read_bytes() == before


@pytest.mark.parametrize("command", ["transition", "complete_step"])
def test_should_fix_is_not_promoted_to_must_fix(tmp_path, command):
    _reimport_with_root(tmp_path)
    module = importlib.import_module(f"apex_recall.commands.{command}")
    project = _seed_project(tmp_path, "demo")
    name = "challenge-findings-governance-constraints-pass1.json"
    review = _seed_review(project, name)
    finding = {
        "category": "governance_gap",
        "claim": "Accepted residual risk",
        "artifact_section": "Risks",
        "severity": "should_fix",
        "evidence": "Fixture evidence",
        "impact": "Fixture impact",
        "traces_to": [],
    }
    finding["id"] = hashlib.sha256(b"governance_gap|Accepted residual risk|Risks").hexdigest()[:8]
    review["findings"] = [finding]
    review["should_fix_count"] = 1
    (project / name).write_text(json.dumps(review), encoding="utf-8")
    args = SimpleNamespace(project="demo", step="3_5", from_step="3_5", to_step="4", complete=True, json=True)
    assert _capture(module, args)[0] == 0
