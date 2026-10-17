"""Native SDK normalization and truthful smoke acceptance, without live project writes."""

from __future__ import annotations

import copy
import importlib.util
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools/scripts" / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def events():
    records = []

    def event(kind, data, agent=None):
        record = {
            "id": f"event-{len(records)}",
            "type": kind,
            "data": data,
            "timestamp": (datetime(2026, 10, 16, tzinfo=UTC) + timedelta(seconds=len(records))).isoformat(),
        }
        if agent:
            record["agentId"] = agent
        records.append(record)

    def tool(name, args, agent=None):
        call = f"tool-{len(records)}"
        event("tool.execution_start", {"toolCallId": call, "toolName": name, "arguments": args}, agent)
        event("tool.execution_complete", {"toolCallId": call, "success": True, "result": {"content": "ok"}}, agent)

    def execute(worker, step, parent=None, resume=False):
        envelope = {
            "request_id": f"execute-{len(records)}",
            "project": "sample",
            "step": step,
            "phase": "research",
            "review_depth": "default",
            "resume": resume,
        }
        tool("write_agent", {"agent_id": worker, "message": "WORKER_EXECUTE\n" + json.dumps(envelope)}, parent)
        call = f"api-{len(records)}"
        event("assistant.message", {"apiCallId": call, "model": "required-model"}, worker)
        event(
            "session.usage_record",
            {
                "usage": {
                    "apiCallId": call,
                    "model": "required-model",
                    "inputTokens": 45000,
                    "outputTokens": 100,
                    "cacheReadTokens": 500,
                    "cacheWriteTokens": 50,
                    "duration": 500,
                    "accounting": {"sourceSessionId": worker, "usageId": call},
                }
            },
            worker,
        )

    event("session.start", {"sessionId": "session", "context": {"gitRoot": str(ROOT)}})
    event("subagent.started", {"agentName": "03-Architect", "toolCallId": "start-main"}, "main")
    execute("main", "2", resume=True)
    tool("bash", {"command": "apex-recall show sample --json"}, "main")
    event(
        "subagent.started",
        {"agentName": "challenger-review-subagent", "parentId": "main", "toolCallId": "start-leaf"},
        "leaf",
    )
    execute("leaf", "2", parent="main")
    event("subagent.completed", {"toolCallId": "start-leaf"}, "leaf")
    event("subagent.completed", {"toolCallId": "start-main"}, "main")
    event("session.end", {"sessionId": "session"})
    return records


def metrics(events):
    profiler = load("profile_debug_log")
    spans = profiler.sdk_events_to_spans(events)
    result = profiler.profile(spans)
    result["_computed"] = profiler.sdk_execution_metrics(spans)
    return result


def test_native_scope_at_required_threshold_passes(events):
    report = metrics(events)
    rows, passed = load("smoke_verify").evaluate(report)
    assert passed, rows
    assert report["totals"]["input_tokens"] == 90000
    assert report["totals"]["subagent_invocations"] == 2
    assert report["usage_coverage"]["chat_calls"] == 2
    assert report["_computed"]["challenger_per_step"] == {"2": 1}
    assert report["_computed"]["resume_recall_verified"] is True


@pytest.mark.parametrize("model", [None, "hydrafusion-max", "future-runtime-model"])
@pytest.mark.parametrize("strict", [False, True])
def test_model_metadata_is_diagnostic_only(events, model, strict):
    for record in events:
        if record["type"] == "assistant.message":
            record["data"].pop("model", None)
            if model is not None:
                record["data"]["model"] = model
        elif record["type"] == "session.usage_record":
            usage = record["data"]["usage"]
            usage.pop("model", None)
            if model is not None:
                usage["model"] = model
    report = metrics(events)
    if model is None:
        assert report["native_evidence"]["unknown_models"] > 0
    rows, passed = load("smoke_verify").evaluate(report, strict=strict)
    assert passed, rows
    assert all(row["key"] != "known_models" for row in rows)


def test_parent_usage_forwarding_and_export_duplicates_are_not_added_twice(events):
    usage = copy.deepcopy(next(record for record in events if record["type"] == "session.usage_record"))
    usage["id"] = "forwarded-usage"
    usage.pop("agentId")
    events += [usage, copy.deepcopy(events[0])]
    report = metrics(events)
    assert report["totals"]["input_tokens"] == 90000
    assert report["native_evidence"]["duplicate_events"] == 1
    assert report["native_evidence"]["duplicate_usage_records"] == 1


def test_conflicting_usage_is_an_explicit_error(events):
    usage = copy.deepcopy(next(record for record in events if record["type"] == "session.usage_record"))
    usage["id"] = "conflict"
    usage["data"]["usage"]["inputTokens"] += 1
    events.append(usage)
    with pytest.raises(ValueError, match="conflicting authoritative usage"):
        metrics(events)


@pytest.mark.parametrize(
    "kind", ["assistant.message", "session.usage_record", "tool.execution_complete", "session.end"]
)
def test_missing_required_evidence_never_passes(events, kind):
    report = metrics([record for record in events if record["type"] != kind])
    assert not load("smoke_verify").evaluate(report)[1]


@pytest.mark.parametrize(
    "field,value",
    [
        ("totals.askquestions_count", 21),
        ("totals.askquestions_count", "0"),
        ("totals.askquestions_count", False),
        ("_computed.max_first_execution_input_tokens", 45001),
        ("_computed.challenger_max_per_step", 3),
        ("_computed.resume_recall_verified", None),
    ],
)
def test_exact_acceptance_limits_and_types(events, field, value):
    report = metrics(events)
    section, key = field.split(".")
    report[section][key] = value
    assert not load("smoke_verify").evaluate(report)[1]


def test_missing_metrics_are_unknown_not_passing_skips():
    rows, passed = load("smoke_verify").evaluate({})
    assert not passed
    assert all(row["status"] == "UNKNOWN" for row in rows)


def test_ask_user_and_hook_lifecycle_are_paired(events):
    start = copy.deepcopy(events[1])
    start.update(
        id="ask-start", type="tool.execution_start", data={"toolCallId": "ask", "toolName": "ask_user", "arguments": {}}
    )
    end = copy.deepcopy(events[-1])
    end.update(id="ask-end", type="tool.execution_complete", data={"toolCallId": "ask", "success": True})
    end["agentId"] = "main"
    hook_start = copy.deepcopy(start)
    hook_start.update(id="hook-start", type="hook.start", data={"hookInvocationId": "hook", "hookType": "PreToolUse"})
    hook_end = copy.deepcopy(end)
    hook_end.update(id="hook-end", type="hook.end", data={"hookInvocationId": "hook", "success": False})
    report = metrics(events + [start, end, hook_start, hook_end])
    assert report["totals"]["askquestions_count"] == 1
    assert report["totals"]["error_spans_total"] == 1
    assert report["native_evidence"]["incomplete_operations"] == 0
    assert not load("smoke_verify").evaluate(report)[1]


def test_native_jsonl_loader_and_workspace_discovery(events, tmp_path):
    profiler = load("profile_debug_log")
    root = tmp_path / "sessions"
    local = root / "matching" / "events.jsonl"
    other = root / "other" / "events.jsonl"
    local.parent.mkdir(parents=True)
    other.parent.mkdir()
    local.write_text("\n".join(json.dumps(record) for record in events))
    foreign = copy.deepcopy(events[0])
    foreign["data"]["context"]["gitRoot"] = str(tmp_path / "unrelated")
    other.write_text(json.dumps(foreign))
    assert profiler.discover_sdk_logs(ROOT, root) == [local]
    assert profiler.profile(profiler.load_spans(local))["totals"]["input_tokens"] == 90000


def test_wrong_parent_and_repeated_execution_ids_block(events):
    request = next(
        record
        for record in events
        if record["type"] == "tool.execution_start" and record["data"]["toolName"] == "write_agent"
    )
    request["agentId"] = "wrong-parent"
    with pytest.raises(ValueError, match="wrong parent"):
        metrics(events)


@pytest.mark.parametrize("field,value", [("type", []), ("agentId", []), ("id", 12)])
def test_invalid_event_identity_is_rejected(events, field, value):
    events[1][field] = value
    with pytest.raises(ValueError, match="event|native"):
        metrics(events)


def test_worker_completion_must_match_its_start_call(events):
    completion = next(record for record in events if record["type"] == "subagent.completed")
    completion["data"]["toolCallId"] = "unrelated-call"
    with pytest.raises(ValueError, match="completion"):
        metrics(events)


@pytest.mark.parametrize("kind", ["hook.start", "hook.end"])
def test_hook_without_identity_cannot_certify_complete_capture(events, kind):
    record = copy.deepcopy(events[-1])
    record.update(id="bad-hook", type=kind, data={"success": True})
    with pytest.raises(ValueError, match="hook"):
        metrics(events + [record])


def test_orphan_hook_completion_is_incomplete_not_a_passing_zero(events):
    record = copy.deepcopy(events[-1])
    record.update(id="orphan-hook", type="hook.end", data={"hookInvocationId": "unseen", "success": True})
    report = metrics(events + [record])
    assert report["native_evidence"]["incomplete_operations"] == 1
    assert not load("smoke_verify").evaluate(report)[1]


def test_native_metrics_do_not_infer_local_clear_or_phase_boundaries(events):
    report = metrics(events)
    assert report["compliance_metrics"]["max_chat_spans_between_clears"] is None
    assert report["compliance_metrics"]["max_askquestions_in_single_phase"] is None
    assert report["native_evidence"]["max_chat_calls_per_worker"] == 1
    assert report["observed_cache_tokens"] == {
        "read": 1000,
        "write": 100,
        "read_samples": 2,
        "write_samples": 2,
    }


def test_missing_cache_usage_is_unknown_not_zero(events):
    for record in events:
        if record["type"] == "session.usage_record":
            record["data"]["usage"].pop("cacheReadTokens")
            record["data"]["usage"].pop("cacheWriteTokens")
    assert metrics(events)["observed_cache_tokens"] == {
        "read": None,
        "write": None,
        "read_samples": 0,
        "write_samples": 0,
    }


def test_sdk_shutdown_closes_capture_but_appended_resume_reopens_it(events):
    events[-1]["type"] = "session.shutdown"
    assert metrics(events)["native_evidence"]["session_closed"] is True
    resume = copy.deepcopy(events[-1])
    resume.update(id="resume", type="session.resume", data={"context": {"gitRoot": str(ROOT)}})
    resume["timestamp"] = events[-2]["timestamp"]
    events.append(resume)
    assert metrics(events)["native_evidence"]["session_closed"] is False


def test_external_transport_never_duplicates_native_tool_work(events):
    native = next(record for record in events if record["type"] == "tool.execution_start")
    request = copy.deepcopy(native)
    request.update(id="external-request", type="external_tool.requested")
    request["data"]["requestId"] = "external-request"
    completion = copy.deepcopy(request)
    completion.update(id="external-complete", type="external_tool.completed", data={"requestId": "external-request"})
    original = metrics(events)["totals"]
    assert metrics(events + [request, completion])["totals"] == original


def test_external_only_outcome_is_unknown_not_success(events):
    request = copy.deepcopy(events[-1])
    request.update(
        id="external-request",
        type="external_tool.requested",
        data={"requestId": "external-request", "toolCallId": "external-only", "toolName": "runTests", "arguments": {}},
    )
    completion = copy.deepcopy(request)
    completion.update(id="external-complete", type="external_tool.completed", data={"requestId": "external-request"})
    report = metrics(events + [request, completion])
    assert report["native_evidence"]["external_tool_outcomes_unknown"] == 1
    assert report["native_evidence"]["incomplete_operations"] == 1
    assert not load("smoke_verify").evaluate(report)[1]


def test_workspace_discovery_rejects_a_session_resumed_elsewhere(events, tmp_path):
    profiler = load("profile_debug_log")
    resume = copy.deepcopy(events[0])
    resume.update(id="foreign-resume", type="session.resume")
    resume["data"]["context"]["gitRoot"] = str(tmp_path / "foreign")
    log = tmp_path / "state/session/events.jsonl"
    log.parent.mkdir(parents=True)
    log.write_text("\n".join(json.dumps(record) for record in events + [resume]))
    assert profiler.discover_sdk_logs(ROOT, tmp_path / "state") == []


@pytest.mark.parametrize("keep_origin", [False, True])
def test_worker_received_execution_is_attributed_even_without_a_native_send_tool(events, keep_origin):
    requests = [
        record
        for record in events
        if record["type"] == "tool.execution_start" and record["data"]["toolName"] == "write_agent"
    ]
    call_ids = {record["data"]["toolCallId"] for record in requests}
    if not keep_origin:
        events = [record for record in events if record["data"].get("toolCallId") not in call_ids]
    for request in requests:
        received = copy.deepcopy(request)
        received.update(
            id="received-" + request["id"],
            type="user.message",
            agentId=request["data"]["arguments"]["agent_id"],
            data={"content": request["data"]["arguments"]["message"]},
        )
        events.append(received)
    report = metrics(events)
    assert report["_computed"]["execution_count"] == 2
    assert report["_computed"]["challenger_per_step"] == {"2": 1}
    assert load("smoke_verify").evaluate(report)[1]
