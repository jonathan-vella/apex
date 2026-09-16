"""Behavioral reliability checks using isolated state and real CLI dispatch."""

import hashlib
import importlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from .test_transition import _reimport_with_root, _seed_project, _seed_review


def setup(tmp_path):
    _reimport_with_root(tmp_path)
    project = _seed_project(tmp_path, "synthetic")
    writer = importlib.import_module("apex_recall.state_writer")
    cli = importlib.import_module("apex_recall.__main__")
    return project, writer, cli


def test_corrupt_primary_requires_explicit_recovery(tmp_path):
    project, writer, cli = setup(tmp_path)
    state = project / "00-session-state.json"
    state.with_suffix(".json.bak").write_bytes(state.read_bytes())
    state.write_text("{broken")
    with pytest.raises(ValueError, match="recovery"):
        writer.read_state(state)
    assert state.read_text() == "{broken"


def test_competing_writer_is_rejected_without_lost_update(tmp_path):
    project, writer, cli = setup(tmp_path)
    state = project / "00-session-state.json"
    first, second = writer.read_state(state), writer.read_state(state)
    first["decisions"]["owner"] = "first"
    writer.write_state("synthetic", first)
    committed = state.read_bytes()
    second["decisions"]["owner"] = "second"
    with pytest.raises(ValueError, match="conflict"):
        writer.write_state("synthetic", second)
    assert state.read_bytes() == committed


def test_index_failure_reports_committed_revision(tmp_path, monkeypatch, capsys):
    project, writer, cli = setup(tmp_path)

    def fail(*args, **kwargs):
        raise OSError("synthetic indexing failure")

    monkeypatch.setattr(writer, "_reindex_file", fail)
    assert cli.main(["decide", "synthetic", "--key", "region", "--value", "fixture", "--json"]) == 3
    result = json.loads(capsys.readouterr().out)
    assert result["outcome"] == "committed_but_index_stale"
    assert len(result["revision"]) == 64
    assert json.loads((project / "00-session-state.json").read_text())["decisions"]["region"] == "fixture"


@pytest.mark.parametrize("track", ["Bicep", "Terraform"])
def test_selected_review_survives_show_retry_and_rejects_drift(tmp_path, monkeypatch, capsys, track):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-plan.json")
    review_path = project / "challenge-findings-plan-pass2.json"
    review = _seed_review(project, review_path.name)
    review["pass_number"] = 2
    review_path.write_text(json.dumps(review))
    assert cli.main(["decide", "synthetic", "--key", "iac_tool", "--value", track, "--json"]) == 0
    assert (
        cli.main(
            [
                "complete-step",
                "synthetic",
                "4",
                "--plan-review",
                str(review_path),
                "--plan-review-reason",
                "authorized confirmation",
                "--json",
            ]
        )
        == 0
    )
    state = project / "00-session-state.json"
    before = state.read_bytes()
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["session"]["effective_reviews"]["4"]["status"] == "current"
    assert state.read_bytes() == before
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["outcome"] == "already_applied"
    assert state.read_bytes() == before
    (project / "04-implementation-plan.md").write_text("drift")
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 2
    assert state.read_bytes() == before


def test_repeat_transition_preserves_destination_progress(tmp_path, capsys):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-plan.json")
    command = ["transition", "synthetic", "--from-step", "4", "--to-step", "5", "--complete", "--json"]
    assert cli.main(command) == 0
    assert cli.main(["checkpoint", "synthetic", "5", "module-written", "--json"]) == 0
    state = project / "00-session-state.json"
    before = state.read_bytes()
    capsys.readouterr()
    assert cli.main(command) == 0
    assert json.loads(capsys.readouterr().out)["outcome"] == "already_applied"
    assert state.read_bytes() == before


def test_changed_input_during_validation_prevents_commit(tmp_path, monkeypatch):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-plan.json")
    complete = importlib.import_module("apex_recall.commands.complete_step")
    verify = complete._challenger_findings_invalid
    state = project / "00-session-state.json"
    before = state.read_bytes()

    def mutate(*args):
        result = verify(*args)
        (project / "04-implementation-plan.md").write_text("changed after validation")
        return result

    monkeypatch.setattr(complete, "_challenger_findings_invalid", mutate)
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 2
    assert state.read_bytes() == before


def test_explicit_recovery_preserves_corrupt_bytes_and_good_backup(tmp_path, capsys):
    project, writer, cli = setup(tmp_path)
    state = project / "00-session-state.json"
    backup = state.with_suffix(".json.bak")
    good = state.read_bytes()
    backup.write_bytes(good)
    state.write_text("{damaged")
    assert cli.main(["recover-state", "synthetic", "--reason", "approved test recovery", "--json"]) == 0
    result = json.loads(capsys.readouterr().out)
    from pathlib import Path

    assert Path(result["preserved_damaged_path"]).read_text() == "{damaged"
    assert backup.read_bytes() == good
    repaired = state.read_bytes()
    assert json.loads(repaired)["decision_log"][-1]["decision"] == "Explicit backup recovery"
    assert cli.main(["recover-state", "synthetic", "--reason", "not a rollback", "--json"]) == 1
    assert state.read_bytes() == repaired


def test_show_does_not_create_or_repair_index(tmp_path, capsys):
    project, writer, cli = setup(tmp_path)
    state = project / "00-session-state.json"
    data = writer.read_state(state)
    data["metadata"] = {"plan_lock": True}
    writer.write_state("synthetic", data)
    assert cli.main(["show", "synthetic", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["session"]["metadata"]["plan_lock"] is True
    assert not (tmp_path / "tmp/.apex-recall.db").exists()
    (project / "00-session-state.json").unlink()
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["state_status"] == "missing"


def test_noop_completion_still_checks_input_revision(tmp_path, monkeypatch):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-plan.json")
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 0
    complete = importlib.import_module("apex_recall.commands.complete_step")
    verify = complete._challenger_findings_invalid
    before = (project / "00-session-state.json").read_bytes()

    def mutate(*args):
        result = verify(*args)
        (project / "04-implementation-plan.md").write_text("drift after validation")
        return result

    monkeypatch.setattr(complete, "_challenger_findings_invalid", mutate)
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 2
    assert (project / "00-session-state.json").read_bytes() == before


def test_replayed_transition_cannot_restore_old_decision(tmp_path):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-plan.json")
    command = [
        "transition",
        "synthetic",
        "--from-step",
        "4",
        "--to-step",
        "5",
        "--complete",
        "--decision",
        "phase=original",
        "--json",
    ]
    assert cli.main(command) == 0
    assert cli.main(["decide", "synthetic", "--key", "phase", "--value", "later", "--json"]) == 0
    before = (project / "00-session-state.json").read_bytes()
    assert cli.main(command) != 0
    assert (project / "00-session-state.json").read_bytes() == before


def test_recovery_rejects_incomplete_backup(tmp_path):
    project, writer, cli = setup(tmp_path)
    state = project / "00-session-state.json"
    state.with_suffix(".json.bak").write_text('{"project":"synthetic"}')
    state.write_text("{}")
    assert cli.main(["recover-state", "synthetic", "--reason", "fixture", "--json"]) == 1
    assert state.read_text() == "{}"


def test_process_lock_contention_fails_without_state_mutation(tmp_path):
    project, writer, cli = setup(tmp_path)
    state = project / "00-session-state.json"
    before = state.read_bytes()
    with writer.project_write_lock(state):
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "apex_recall",
                "decide",
                "synthetic",
                "--key",
                "test",
                "--value",
                "second",
                "--json",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    assert result.returncode == 2, result.stdout + result.stderr
    assert json.loads(result.stdout)["outcome"] == "conflict"
    assert state.read_bytes() == before


def test_invalid_stored_selection_never_falls_back(tmp_path):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-plan.json")
    state = project / "00-session-state.json"
    data = json.loads(state.read_text())
    data["review_selections"] = {"4": None}
    state.write_text(json.dumps(data))
    before = state.read_bytes()
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) != 0
    assert state.read_bytes() == before


def test_supporting_input_drift_blocks_primary_unchanged_review(tmp_path):
    project, writer, cli = setup(tmp_path)
    sidecar = project / "challenge-findings-plan.json"
    review = _seed_review(project, sidecar.name)
    supporting = project / "contract.json"
    supporting.write_text('{"approved":"fixture"}')
    review["supporting_inputs"] = [{"path": str(supporting), "sha256": writer.file_revision(supporting)}]
    sidecar.write_text(json.dumps(review))
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 0
    before = (project / "00-session-state.json").read_bytes()
    supporting.write_text('{"approved":"changed"}')
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 2
    assert (project / "00-session-state.json").read_bytes() == before


def test_review_attempts_preserve_unknown_outcomes_and_retry_identity(tmp_path):
    project, writer, cli = setup(tmp_path)
    base = ["review-audit", "synthetic", "4", "--input-digest", "a" * 64, "--json"]
    attempt = [*base, "--attempt-id", "first", "--attempt-kind", "invocation"]
    assert cli.main([*attempt, "--attempt-outcome", "started"]) == 0
    state = project / "00-session-state.json"
    before = state.read_bytes()
    assert cli.main([*attempt, "--attempt-outcome", "started"]) == 0
    assert state.read_bytes() == before
    assert cli.main([*attempt, "--attempt-outcome", "unknown"]) == 0
    before = state.read_bytes()
    assert cli.main([*attempt, "--attempt-outcome", "completed"]) == 1
    retry = [
        *base,
        "--attempt-kind",
        "empty-output-retry",
        "--attempt-id",
        "retry",
        "--retry-of",
        "first",
        "--attempt-outcome",
        "started",
    ]
    assert cli.main(retry) == 1
    assert state.read_bytes() == before


def test_handoff_cli_preserves_file_without_explicit_revision(tmp_path):
    project, writer, cli = setup(tmp_path)
    script = Path(__file__).resolve().parents[3] / "tools/scripts/render-session-handoff.mjs"
    command = [
        "node",
        str(script),
        "--project",
        "synthetic",
        "--owner",
        "06b-Bicep CodeGen",
        "--operation",
        "code generation only",
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert "## Completed Steps" in result.stdout
    handoff = project / "00-handoff.md"
    handoff.write_text("User-owned notes\n")
    before = handoff.read_bytes()
    refused = subprocess.run([*command, "--write"], capture_output=True, text=True, check=False)
    assert refused.returncode == 1
    assert handoff.read_bytes() == before
    accepted = subprocess.run(
        [*command, "--write", "--expected-sha", hashlib.sha256(before).hexdigest()],
        capture_output=True,
        text=True,
        check=False,
    )
    assert accepted.returncode == 0, accepted.stderr
    assert len(handoff.read_text().splitlines()) < 60


@pytest.mark.parametrize("track", ["Bicep", "Terraform"])
def test_synthetic_lifecycle_preserves_review_and_operation_boundaries(tmp_path, capsys, track):
    project, writer, cli = setup(tmp_path)
    assert cli.main(["decide", "synthetic", "--key", "iac_tool", "--value", track, "--json"]) == 0
    gates = {
        "1": ["challenge-findings-requirements.json"],
        "2": ["challenge-findings-architecture.json", "challenge-findings-cost-estimate.json"],
        "3_5": ["challenge-findings-governance-constraints-pass1.json"],
        "4": ["challenge-findings-plan.json"],
    }
    for step in ("1", "2", "3_5", "4", "5", "6", "7"):
        assert cli.main(["start-step", "synthetic", step, "--json"]) == 0
        for filename in gates.get(step, []):
            _seed_review(project, filename)
        assert (
            cli.main(
                [
                    "decide",
                    "synthetic",
                    "--decision",
                    f"Synthetic approval fixture for step {step}",
                    "--rationale",
                    "Offline lifecycle only; no production authorization",
                    "--step",
                    step,
                    "--json",
                ]
            )
            == 0
        )
        assert cli.main(["complete-step", "synthetic", step, "--json"]) == 0
    assert cli.main(["finding", "synthetic", "--add", "Lesson: runtime deployment remains unverified", "--json"]) == 0
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    view = json.loads(capsys.readouterr().out)
    assert view["session"]["steps"]["7"]["status"] == "complete"
    assert "runtime deployment remains unverified" in view["session"]["open_findings"][-1]
    assert not (tmp_path / "infra").exists()


def test_supporting_directory_membership_change_prevents_commit(tmp_path, monkeypatch):
    project, writer, cli = setup(tmp_path)
    sidecar = project / "challenge-findings-plan.json"
    review = _seed_review(project, sidecar.name)
    evidence = project / "supporting"
    evidence.mkdir()
    (evidence / "one.txt").write_text("fixture")
    review["supporting_inputs"] = [{"path": str(evidence), "sha256": writer.file_revision(evidence)}]
    sidecar.write_text(json.dumps(review))
    complete = importlib.import_module("apex_recall.commands.complete_step")
    verify = complete._challenger_findings_invalid
    before = (project / "00-session-state.json").read_bytes()

    def mutate(*args):
        result = verify(*args)
        assert result is None
        (evidence / "two.txt").write_text("new member")
        return result

    monkeypatch.setattr(complete, "_challenger_findings_invalid", mutate)
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 2
    assert (project / "00-session-state.json").read_bytes() == before


def test_review_retry_cannot_chain_or_change_step(tmp_path):
    project, writer, cli = setup(tmp_path)

    def record(step, identity, kind, outcome, parent=None):
        command = [
            "review-audit",
            "synthetic",
            step,
            "--attempt-id",
            identity,
            "--attempt-kind",
            kind,
            "--input-digest",
            "a" * 64,
            "--attempt-outcome",
            outcome,
            "--json",
        ]
        if parent:
            command += ["--retry-of", parent]
        return cli.main(command)

    assert record("4", "original", "invocation", "started") == 0
    assert record("4", "original", "invocation", "failed") == 0
    assert record("3_5", "cross-step", "empty-output-retry", "started", "original") == 1
    assert record("4", "retry", "empty-output-retry", "started", "original") == 0
    assert record("4", "retry", "empty-output-retry", "failed", "original") == 0
    before = (project / "00-session-state.json").read_bytes()
    assert record("4", "retry-again", "empty-output-retry", "started", "retry") == 1
    assert record("4", "another", "empty-output-retry", "started", "original") == 1
    assert (project / "00-session-state.json").read_bytes() == before


@pytest.mark.parametrize(
    "step,kind,original,later,next_step",
    [
        (
            "3_5",
            "governance",
            "challenge-findings-governance-constraints-pass1.json",
            "challenge-findings-governance-constraints-pass3.json",
            "4",
        ),
        ("4", "plan", "challenge-findings-plan.json", "challenge-findings-plan-pass3.json", "5"),
    ],
)
def test_next_step_only_reuses_selection_without_recompleting(tmp_path, step, kind, original, later, next_step):
    project, writer, cli = setup(tmp_path)
    _seed_review(project, original)
    review = _seed_review(project, later)
    review["pass_number"] = 3
    (project / later).write_text(json.dumps(review))
    assert (
        cli.main(
            [
                "complete-step",
                "synthetic",
                step,
                f"--{kind}-review",
                str(project / later),
                f"--{kind}-review-reason",
                "Authorized fixture selection",
                "--json",
            ]
        )
        == 0
    )
    state = project / "00-session-state.json"
    before = json.loads(state.read_text())
    assert cli.main(["transition", "synthetic", "--from-step", step, "--to-step", next_step, "--json"]) == 0
    after = json.loads(state.read_text())
    assert after["steps"][step] == before["steps"][step]
    assert after["review_selections"] == before["review_selections"]
    assert after["decision_log"] == before["decision_log"]
    assert after["steps"][next_step]["status"] == "in_progress"
