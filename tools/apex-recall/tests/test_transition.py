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

import importlib
import io
import json
import os
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


def _seed_project(root: Path, project: str, *, with_step_2_gating: bool = False,
                  with_sidecar: bool = False) -> Path:
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
        json.dumps(state), encoding="utf-8",
    )
    if with_step_2_gating:
        # Step 1 gating artifact for the challenger gate.
        (proj_dir / "01-requirements.md").write_text("# Requirements", encoding="utf-8")
    if with_sidecar:
        (proj_dir / "challenge-findings-requirements.json").write_text(
            json.dumps({"findings": []}), encoding="utf-8",
        )
    return proj_dir


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
        project="demo", step="2", from_step="2", to_step="3", complete=True,
        decision=["review_depth=deep"], json=True,
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
        (project_dir / sidecar).write_text('{"findings": []}', encoding="utf-8")
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
    (project_dir / "challenge-findings-architecture-pass1.json").write_text('{"findings": []}', encoding="utf-8")
    result, payload = _capture(module, args)
    assert result == 2
    assert payload["required_sidecar"].endswith("challenge-findings-cost-estimate.json")
    assert state_path.read_bytes() == before
    (project_dir / "challenge-findings-cost-estimate.json").write_text('{"findings": []}', encoding="utf-8")
    assert _capture(module, args)[0] == 0


@pytest.mark.parametrize("command", ["transition", "complete_step"])
@pytest.mark.parametrize("depth,sidecar", [
    ("default", "challenge-findings-plan.json"),
    ("deep", "challenge-findings-plan-pass1.json"),
])
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
    (project_dir / sidecar).write_text('{"findings": []}', encoding="utf-8")
    assert _capture(module, args)[0] == 0
