"""Ordinary review freshness and read-only native-attempt reconciliation."""

import importlib
import json
import subprocess
from pathlib import Path

import pytest

from .test_reliability import setup
from .test_transition import _seed_review


def test_ordinary_show_reports_changed_protocol_without_rewriting_completion(tmp_path: Path, capsys) -> None:
    project, writer, cli = setup(tmp_path)
    _seed_review(project, "challenge-findings-requirements.json")
    path = project / "00-session-state.json"
    state = writer.read_state(path)
    state["steps"]["1"].update(status="complete", completed="original-completion")
    writer.write_state("synthetic", state)
    before = path.read_bytes()
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    first = json.loads(capsys.readouterr().out)
    assert first["session"]["effective_reviews"]["1"]["status"] == "current"
    assert first["session"]["gate_readiness"]["step-1-complete"]["permission_granted"] is False
    protocol = tmp_path / ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md"
    protocol.write_text(protocol.read_text() + "\nChanged guidance\n")
    assert cli.main(["show", "synthetic", "--json"]) == 0
    changed = json.loads(capsys.readouterr().out)
    assert changed["session"]["effective_reviews"]["1"]["status"] == "invalid"
    assert "protocol_sha" in changed["session"]["effective_reviews"]["1"]["error"]
    assert changed["session"]["gate_readiness"]["step-1-complete"]["status"] == "blocked"
    assert changed["session"]["steps"]["1"]["completed"] == "original-completion"
    assert path.read_bytes() == before
    assert "4" not in changed["session"]["effective_reviews"]


def test_reconcile_reports_missing_and_incomplete_attempts_without_inventing_history(tmp_path: Path, capsys) -> None:
    project, _, cli = setup(tmp_path)
    capture = tmp_path / "events.jsonl"
    events = []
    for index in range(2):
        events.append(
            {
                "type": "tool.execution_start",
                "timestamp": "native-dispatch",
                "data": {
                    "toolName": "task",
                    "toolCallId": f"call-{index}",
                    "arguments": {
                        "agent_type": "challenger-review-subagent",
                        "prompt": "APEX_REVIEW\n"
                        + json.dumps(
                            {
                                "project_name": "synthetic",
                                "step": "2",
                                "request_id": f"review-{index}",
                            }
                        ),
                    },
                },
            }
        )
    events.append({"type": "tool.execution_complete", "data": {"toolCallId": "call-0", "success": True}})
    capture.write_text("\n".join(json.dumps(event) for event in events))
    before = (project / "00-session-state.json").read_bytes()
    capsys.readouterr()
    assert cli.main(["review-audit", "synthetic", "2", "--reconcile-events", str(capture), "--json"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["read_only"] is True
    assert [request["task_outcome"] for request in report["requests"]] == ["completed", "unknown"]
    assert all(request["gap"] for request in report["requests"])
    assert all(request["publication_status"] == "not_established_by_task_completion" for request in report["requests"])
    assert (project / "00-session-state.json").read_bytes() == before
    audit = importlib.import_module("apex_recall.commands.review_audit")
    attempts = [{"id": "review-0", "step": "2", "kind": "invocation", "outcome": "started"}]
    assert audit.reconcile_events(capture, attempts, "synthetic", "2")["requests"][0]["gap"] is True
    attempts = [
        {
            "id": "review-0",
            "step": "2",
            "kind": "invocation",
            "outcome": "started",
            "recorded_at": "2026-01-01T00:01:00Z",
        },
        {"id": "review-0", "step": "2", "kind": "invocation", "outcome": "completed"},
    ]
    events[0]["timestamp"] = "2026-01-01T00:00:00Z"
    capture.write_text("\n".join(json.dumps(event) for event in events))
    retrospective = audit.reconcile_events(capture, attempts, "synthetic", "2")["requests"][0]
    assert retrospective["start_timing"] == "retrospective"
    assert retrospective["gap"] is True
    events.append(events[0])
    capture.write_text("\n".join(json.dumps(event) for event in events))
    with pytest.raises(ValueError, match="duplicate native"):
        audit.reconcile_events(capture, attempts, "synthetic", "2")


def test_reconcile_includes_unmatched_empty_output_retries_but_not_repairs(tmp_path: Path) -> None:
    setup(tmp_path)
    capture = tmp_path / "empty-events.jsonl"
    capture.write_text("")
    attempts = [
        {"id": "original", "step": "2", "kind": "invocation", "outcome": "completed"},
        {"id": "retry", "step": "2", "kind": "empty-output-retry", "outcome": "started"},
        {"id": "repair", "step": "2", "kind": "repair", "outcome": "started"},
        {"id": "other-step", "step": "1", "kind": "empty-output-retry", "outcome": "started"},
    ]
    audit = importlib.import_module("apex_recall.commands.review_audit")
    assert audit.reconcile_events(capture, attempts, "synthetic", "2")["ledger_without_native_dispatch"] == [
        "original",
        "retry",
    ]


def test_completed_empty_output_allows_one_identical_retry_without_rewriting_outcome(tmp_path: Path) -> None:
    project, writer, cli = setup(tmp_path)

    def record(identity: str, outcome: str, *extra: str, digest: str = "a" * 64) -> int:
        return cli.main(
            [
                "review-audit",
                "synthetic",
                "2",
                "--attempt-id",
                identity,
                "--attempt-kind",
                "invocation" if identity == "original" else "empty-output-retry",
                "--input-digest",
                digest,
                "--attempt-outcome",
                outcome,
                *extra,
                "--json",
            ]
        )

    assert record("original", "started") == 0
    assert record("original", "completed", "--review-output", "empty") == 0
    path = project / "00-session-state.json"
    completed = writer.read_state(path)["review_attempts"][-1]
    assert completed["outcome"] == "completed"
    assert completed["review_output"] == "empty"
    assert record("retry-drift", "started", "--retry-of", "original", digest="b" * 64) == 1
    assert record("retry", "started", "--retry-of", "original") == 0
    assert record("retry", "completed", "--retry-of", "original", "--review-output", "empty") == 0
    before = path.read_bytes()
    assert record("retry-again", "started", "--retry-of", "original") == 1
    assert record("retry-chain", "started", "--retry-of", "retry") == 1
    assert record("original", "completed", "--review-output", "nonempty") == 1
    assert path.read_bytes() == before
    assert record("original", "completed", "--review-output", "empty") == 0
    assert path.read_bytes() == before


@pytest.mark.parametrize(
    "kind,outcome", [("invocation", "started"), ("invocation", "unknown"), ("repair", "completed")]
)
def test_review_output_cannot_be_claimed_for_unfinished_or_repair_attempts(
    tmp_path: Path,
    kind: str,
    outcome: str,
) -> None:
    project, _, cli = setup(tmp_path)
    command = [
        "review-audit",
        "synthetic",
        "2",
        "--attempt-id",
        "original",
        "--attempt-kind",
        kind,
        "--input-digest",
        "a" * 64,
    ]
    assert cli.main([*command, "--attempt-outcome", "started"]) == 0
    before = (project / "00-session-state.json").read_bytes()
    assert cli.main([*command, "--attempt-outcome", outcome, "--review-output", "empty"]) == 1
    assert (project / "00-session-state.json").read_bytes() == before


@pytest.mark.parametrize("review_output", [None, "unknown", "nonempty"])
def test_native_success_alone_does_not_authorize_empty_output_retry(
    tmp_path: Path,
    review_output: str | None,
) -> None:
    project, _, cli = setup(tmp_path)
    original = [
        "review-audit",
        "synthetic",
        "2",
        "--attempt-id",
        "original",
        "--attempt-kind",
        "invocation",
        "--input-digest",
        "a" * 64,
    ]
    assert cli.main([*original, "--attempt-outcome", "started"]) == 0
    extra = ["--review-output", review_output] if review_output else []
    assert cli.main([*original, "--attempt-outcome", "completed", *extra]) == 0
    before = (project / "00-session-state.json").read_bytes()
    assert (
        cli.main(
            [
                "review-audit",
                "synthetic",
                "2",
                "--attempt-id",
                "retry",
                "--attempt-kind",
                "empty-output-retry",
                "--input-digest",
                "a" * 64,
                "--attempt-outcome",
                "started",
                "--retry-of",
                "original",
            ]
        )
        == 1
    )
    assert (project / "00-session-state.json").read_bytes() == before


def test_failed_nonempty_output_does_not_qualify_for_empty_retry(tmp_path: Path) -> None:
    project, _, cli = setup(tmp_path)
    command = [
        "review-audit",
        "synthetic",
        "2",
        "--attempt-id",
        "original",
        "--attempt-kind",
        "invocation",
        "--input-digest",
        "a" * 64,
    ]
    assert cli.main([*command, "--attempt-outcome", "started"]) == 0
    assert cli.main([*command, "--attempt-outcome", "failed", "--review-output", "nonempty"]) == 0
    before = (project / "00-session-state.json").read_bytes()
    assert (
        cli.main(
            [
                "review-audit",
                "synthetic",
                "2",
                "--attempt-id",
                "retry",
                "--attempt-kind",
                "empty-output-retry",
                "--input-digest",
                "a" * 64,
                "--attempt-outcome",
                "started",
                "--retry-of",
                "original",
            ]
        )
        == 1
    )
    assert (project / "00-session-state.json").read_bytes() == before


@pytest.mark.parametrize("step", ["1", "2", "4"])
def test_audited_missing_review_completion_stays_explicit_in_show_and_handoff(
    tmp_path: Path,
    capsys,
    step: str,
) -> None:
    project, _, cli = setup(tmp_path)
    artifact = {"1": "01-requirements.md", "2": "02-architecture-assessment.md", "4": "04-implementation-plan.md"}[step]
    (project / artifact).write_text("# Synthetic artifact\n")
    assert (
        cli.main(
            [
                "complete-step",
                "synthetic",
                step,
                "--allow-missing-challenger",
                "--challenger-skip-reason",
                "Explicit synthetic missing-review exception",
                "--json",
            ]
        )
        == 0
    )
    path = project / "00-session-state.json"
    before = path.read_bytes()
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    shown = json.loads(capsys.readouterr().out)
    effective = shown["session"]["effective_reviews"][step]
    assert effective["status"] == "current"
    assert effective["review_skip"] is True
    assert effective["review_verdicts"] == []
    assert effective["skip_reasons"] == ["Explicit synthetic missing-review exception"]
    assert shown["session"]["gate_readiness"][f"step-{step}-complete"]["review_skip"] is True
    assert path.read_bytes() == before
    renderer = Path(__file__).resolve().parents[3] / "tools/scripts/render-session-handoff.mjs"
    rendered = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import fs from 'node:fs';const modulePath=process.argv[1];process.argv[1]='isolated-probe';"
            "const {renderHandoff}=await import(modulePath);"
            "console.log(renderHandoff(JSON.parse(fs.readFileSync(0,'utf8')),"
            "{owner:'03-Architect',operation:'orientation'}));",
            str(renderer),
        ],
        input=json.dumps(shown),
        text=True,
        capture_output=True,
    )
    assert rendered.returncode == 0, rendered.stderr
    assert "review intentionally skipped" in rendered.stdout
    assert "not review evidence" in rendered.stdout
    sidecar = {
        "1": "challenge-findings-requirements.json",
        "2": "challenge-findings-architecture.json",
        "4": "challenge-findings-plan.json",
    }[step]
    (project / sidecar).write_text("{}")
    assert cli.main(["show", "synthetic", "--json"]) == 0
    invalid = json.loads(capsys.readouterr().out)
    assert invalid["session"]["effective_reviews"][step]["status"] == "invalid"
    assert invalid["session"]["gate_readiness"][f"step-{step}-complete"]["status"] == "blocked"
    assert path.read_bytes() == before
