"""Ordinary review freshness and read-only native-attempt reconciliation."""

import importlib
import json
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
