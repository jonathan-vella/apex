"""Native SDK normalization and truthful smoke acceptance, without live project writes."""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
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


@pytest.mark.parametrize(
    "message",
    [
        "Skill not found: required-skill",
        "Agent not found",
        "Search paths do not exist: required-input",
        "view_range out of bounds",
    ],
)
def test_runtime_failures_are_not_globally_reclassified_as_benign(events, message):
    failure = copy.deepcopy(events[-1])
    failure.update(
        id="failed-operation",
        type="tool.execution_start",
        data={
            "toolCallId": "failure-call",
            "toolName": "view",
            "arguments": {},
        },
    )
    completion = copy.deepcopy(failure)
    completion.update(
        id="failed-completion",
        type="tool.execution_complete",
        data={
            "toolCallId": "failure-call",
            "success": False,
            "error": {"message": message},
        },
    )
    assert metrics(events + [failure, completion])["totals"]["error_spans_non_benign"] == 1


def test_echoing_a_recall_command_is_not_resume_recovery(events):
    for event in events:
        if event["type"] == "tool.execution_start" and event["data"].get("toolName") == "bash":
            event["data"]["arguments"]["command"] = 'echo "apex-recall show sample --json"'
    assert metrics(events)["_computed"]["resume_recall_verified"] is False


def test_later_same_worker_execution_cannot_hide_oversized_input_or_missing_recovery(events):
    profiler = load("profile_debug_log")
    spans = profiler.sdk_events_to_spans(events)
    request = copy.deepcopy(next(span for span in spans if span.get("_sdk_execution", {}).get("worker_id") == "main"))
    start = max(int(span["startTimeUnixNano"]) for span in spans) + 1_000_000_000
    request["startTimeUnixNano"] = str(start)
    request["_sdk_execution"]["request_id"] = "later-execution"
    request["_sdk_execution"]["resume"] = True
    chat = copy.deepcopy(
        next(span for span in spans if span.get("_sdk_agent_id") == "main" and span["name"].startswith("chat:"))
    )
    chat["startTimeUnixNano"] = str(start + 1)
    for attribute in chat["attributes"]:
        if attribute["key"] == "gen_ai.usage.input_tokens":
            attribute["value"] = {"intValue": 45_001}
    result = profiler.sdk_execution_metrics(spans + [request, chat])
    assert result["max_first_execution_input_tokens"] == 45_001
    assert result["resume_recall_verified"] is None


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


@pytest.fixture
def one_shot(events):
    def capture(*, batch=False, legacy=False, reviewer="rubber-duck"):
        records = copy.deepcopy(events)
        if not legacy:
            leaf_calls = {
                record["data"]["toolCallId"]
                for record in records
                if record["type"] == "tool.execution_start"
                and record["data"].get("arguments", {}).get("agent_id") == "leaf"
            }
            records = [
                record
                for record in records
                if record.get("agentId") != "leaf" and record["data"].get("toolCallId") not in leaf_calls
            ]
        envelope = {
            "request_id": "review-1",
            "project_name": "sample",
            "step": "2",
            "review_depth": "default",
            "artifact_path": "agent-output/sample/02-architecture-assessment.md",
            "artifact_type": "architecture",
            "review_focus": "comprehensive",
            "pass_number": 1,
            "output_path": "agent-output/sample/challenge-findings-architecture.json",
            "overwrite": False,
            "cache_inputs": {"artifact_sha256": "recorded-metadata"},
        }
        if batch:
            envelope.pop("review_focus")
            envelope.pop("pass_number")
            envelope["lenses"] = [
                {"review_focus": "comprehensive", "pass_number": 1},
                {"review_focus": "cost-feasibility", "pass_number": 1},
            ]
        prompt = "APEX_REVIEW\n" + json.dumps(envelope)
        additions = [
            {
                "type": "tool.execution_start",
                "agentId": "main",
                "data": {
                    "toolCallId": "review-task",
                    "toolName": "task",
                    "arguments": {"agent_type": reviewer, "mode": "sync", "prompt": prompt},
                },
            },
            {
                "type": "subagent.started",
                "agentId": "reviewer",
                "data": {
                    "agentName": reviewer,
                    "parentId": "main",
                    "toolCallId": "review-task",
                    "executionMode": "sync",
                },
            },
            {"type": "user.message", "agentId": "reviewer", "data": {"content": prompt}},
            {
                "type": "assistant.message",
                "agentId": "reviewer",
                "data": {"apiCallId": "review-api", "content": '{"findings":[]}'},
            },
            {
                "type": "session.usage_record",
                "agentId": "reviewer",
                "data": {
                    "usage": {
                        "apiCallId": "review-api",
                        "inputTokens": 45000,
                        "outputTokens": 100,
                        "cacheReadTokens": 0,
                        "cacheWriteTokens": 0,
                        "duration": 500,
                    }
                },
            },
            {"type": "subagent.completed", "agentId": "reviewer", "data": {"toolCallId": "review-task"}},
            {
                "type": "tool.execution_complete",
                "agentId": "main",
                "data": {"toolCallId": "review-task", "success": True},
            },
        ]
        for index, record in enumerate(additions):
            record["id"] = f"review-event-{index}"
        records[-2:-2] = additions
        for index, record in enumerate(records):
            record["timestamp"] = (datetime(2026, 10, 16, tzinfo=UTC) + timedelta(seconds=index)).isoformat()
        return records

    return capture


def review_dispatch(records):
    return next(
        record
        for record in records
        if record["type"] == "tool.execution_start" and record["data"]["toolName"] == "task"
    )


def replace_review_envelope(records, envelope):
    review_dispatch(records)["data"]["arguments"]["prompt"] = "APEX_REVIEW\n" + json.dumps(envelope)


def share_parent_request_id(records):
    parent = next(
        record["data"]["arguments"]
        for record in records
        if record["type"] == "tool.execution_start"
        and record["data"].get("toolName") == "write_agent"
        and record["data"]["arguments"].get("agent_id") == "main"
    )
    request_id = json.loads(parent["message"].split("\n", 1)[1])["request_id"]
    envelope = json.loads(review_dispatch(records)["data"]["arguments"]["prompt"].split("\n", 1)[1])
    envelope["request_id"] = request_id
    replace_review_envelope(records, envelope)
    return request_id


@pytest.mark.parametrize("legacy", [False, True])
@pytest.mark.parametrize("batch", [False, True])
def test_historical_parent_and_review_request_id_reuse_counts_both_protocols(one_shot, tmp_path, legacy, batch):
    records = one_shot(legacy=legacy, batch=batch)
    shared_id = share_parent_request_id(records)
    report = metrics(records)
    requests = report["native_evidence"]["execution_requests"]
    assert len([request for request in requests if request["request_id"] == shared_id]) == 2
    assert report["_computed"]["execution_count"] == (3 if legacy else 2)
    assert report["_computed"]["challenger_per_step"] == {"2": 2 if legacy else 1}
    assert report["_computed"]["max_first_execution_input_tokens"] == 45000
    log = tmp_path / "events.jsonl"
    log.write_text("\n".join(json.dumps(record) for record in records))
    assert load("validate_review_ceiling").budget_check(log) == ({"2": 2 if legacy else 1}, [])


def test_duplicate_worker_execution_ids_still_fail_without_a_protocol_boundary(events):
    dispatches = [
        record["data"]["arguments"]
        for record in events
        if record["type"] == "tool.execution_start" and record["data"].get("toolName") == "write_agent"
    ]
    first = json.loads(dispatches[0]["message"].split("\n", 1)[1])
    second = json.loads(dispatches[1]["message"].split("\n", 1)[1])
    second["request_id"] = first["request_id"]
    dispatches[1]["message"] = "WORKER_EXECUTE\n" + json.dumps(second)
    with pytest.raises(ValueError, match="duplicate or conflicting execution request_id"):
        metrics(events)


def test_one_shot_omitted_mode_uses_attributed_synchronous_runtime_evidence(one_shot):
    records = one_shot()
    del review_dispatch(records)["data"]["arguments"]["mode"]
    report = metrics(records)
    assert report["_computed"]["challenger_per_step"] == {"2": 1}


@pytest.mark.parametrize("mode", ["sync", None])
@pytest.mark.parametrize("runtime_mode", ["background", None])
def test_one_shot_missing_or_conflicting_runtime_mode_fails_closed(one_shot, mode, runtime_mode):
    records = one_shot()
    args = review_dispatch(records)["data"]["arguments"]
    if mode is None:
        del args["mode"]
    start = next(
        record for record in records if record["type"] == "subagent.started" and record["agentId"] == "reviewer"
    )
    if runtime_mode is None:
        del start["data"]["executionMode"]
    else:
        start["data"]["executionMode"] = runtime_mode
    with pytest.raises(ValueError, match="APEX_REVIEW requires attributed synchronous execution"):
        metrics(records)


@pytest.mark.parametrize("mode", ["background", None, "unknown"])
def test_one_shot_explicit_non_sync_argument_cannot_use_runtime_default(one_shot, mode):
    records = one_shot()
    review_dispatch(records)["data"]["arguments"]["mode"] = mode
    with pytest.raises(ValueError, match="APEX_REVIEW"):
        metrics(records)


@pytest.mark.parametrize("batch", [False, True])
@pytest.mark.parametrize("legacy", [False, True])
@pytest.mark.parametrize("reviewer", ["rubber-duck", "challenger-review-subagent"])
def test_one_shot_single_and_batch_are_one_execution_per_dispatch(one_shot, batch, legacy, reviewer):
    records = one_shot(batch=batch, legacy=legacy, reviewer=reviewer)
    report = metrics(records)
    assert report["_computed"]["execution_count"] == (3 if legacy else 2)
    assert report["_computed"]["challenger_per_step"] == {"2": 2 if legacy else 1}
    requests = report["native_evidence"]["execution_requests"]
    assert sum(request.get("protocol") == "APEX_REVIEW" for request in requests) == 1
    assert report["_computed"]["max_first_execution_input_tokens"] == 45000
    assert load("smoke_verify").evaluate(report, strict=True)[1]


@pytest.mark.parametrize("model", [None, "different-runtime-model", "hydrafusion-max"])
def test_one_shot_models_remain_diagnostic(one_shot, model):
    records = one_shot()
    for record in records:
        if record.get("agentId") == "reviewer" and model is not None:
            if record["type"] == "assistant.message":
                record["data"]["model"] = model
            elif record["type"] == "session.usage_record":
                record["data"]["usage"]["model"] = "different-usage-model"
    assert load("smoke_verify").evaluate(metrics(records), strict=True)[1]


@pytest.mark.parametrize(
    "field,value",
    [("agentName", "other-reviewer"), ("parentId", "root"), ("toolCallId", "other-task")],
)
def test_one_shot_requires_named_reviewer_parent_and_task_link(one_shot, field, value):
    records = one_shot()
    start = next(
        record for record in records if record["type"] == "subagent.started" and record["agentId"] == "reviewer"
    )
    start["data"][field] = value
    with pytest.raises(ValueError, match="reviewer|attribution"):
        metrics(records)


def test_one_shot_without_reviewer_start_cannot_certify_metrics(one_shot):
    records = [
        record
        for record in one_shot()
        if not (record["type"] == "subagent.started" and record["agentId"] == "reviewer")
    ]
    with pytest.raises(ValueError, match="reviewer|attribution"):
        metrics(records)


def test_one_shot_receipts_and_export_repeats_do_not_double_count(one_shot):
    records = one_shot()
    receipt = copy.deepcopy(next(record for record in records if record["type"] == "user.message"))
    receipt["id"] = "repeated-receipt"
    records += [receipt, copy.deepcopy(review_dispatch(records))]
    report = metrics(records)
    assert report["_computed"]["execution_count"] == 2
    assert report["_computed"]["challenger_per_step"] == {"2": 1}
    assert report["native_evidence"]["duplicate_events"] == 1


def test_one_shot_external_transport_echo_is_not_an_extra_dispatch(one_shot):
    records = one_shot()
    request = copy.deepcopy(review_dispatch(records))
    request.update(id="review-external", type="external_tool.requested")
    request["data"]["requestId"] = "review-external"
    completion = copy.deepcopy(request)
    completion.update(id="review-external-end", type="external_tool.completed", data={"requestId": "review-external"})
    assert metrics(records + [request, completion])["_computed"]["execution_count"] == 2


def test_one_shot_conflicting_transport_echo_is_rejected(one_shot):
    records = one_shot()
    request = copy.deepcopy(review_dispatch(records))
    request.update(id="review-external", type="external_tool.requested")
    request["data"]["requestId"] = "review-external"
    request["data"]["arguments"]["prompt"] = "An unrelated prompt."
    with pytest.raises(ValueError, match="task arguments conflict"):
        metrics(records + [request])


def test_one_shot_external_only_dispatch_counts_but_cannot_certify_success(one_shot):
    records = one_shot()
    request = review_dispatch(records)
    request["type"] = "external_tool.requested"
    request["data"]["requestId"] = "review-external"
    completion = next(
        record
        for record in records
        if record["type"] == "tool.execution_complete" and record["data"]["toolCallId"] == "review-task"
    )
    completion.update(type="external_tool.completed", data={"requestId": "review-external"})
    report = metrics(records)
    assert report["_computed"]["challenger_per_step"] == {"2": 1}
    assert report["native_evidence"]["external_tool_outcomes_unknown"] == 1
    assert report["native_evidence"]["incomplete_operations"] == 1
    assert not load("smoke_verify").evaluate(report, strict=True)[1]


@pytest.mark.parametrize("tokens", [45000, 45001, None])
def test_one_shot_first_execution_threshold_is_measured_not_synthesized(one_shot, tokens):
    records = one_shot()
    usage = next(
        record["data"]["usage"]
        for record in records
        if record["type"] == "session.usage_record" and record.get("agentId") == "reviewer"
    )
    usage["inputTokens"] = tokens
    report = metrics(records)
    assert report["_computed"]["max_first_execution_input_tokens"] == tokens
    assert load("smoke_verify").evaluate(report, strict=True)[1] is (tokens == 45000)


@pytest.mark.parametrize("kind", ["assistant.message", "session.usage_record", "subagent.completed"])
def test_one_shot_missing_usage_or_capture_evidence_stays_nonpassing(one_shot, kind):
    records = [record for record in one_shot() if not (record["type"] == kind and record.get("agentId") == "reviewer")]
    assert not load("smoke_verify").evaluate(metrics(records), strict=True)[1]


@pytest.mark.parametrize(
    "mutation",
    [
        {"request_id": ""},
        {"project_name": None},
        {"step": 2},
        {"artifact_path": ""},
        {"artifact_type": None},
        {"output_path": ""},
        {"review_depth": "unknown"},
        {"overwrite": None},
        {"cache_inputs": None},
        {"review_focus": ""},
        {"pass_number": True},
        {"lenses": []},
        {"lenses": [{"review_focus": "comprehensive", "pass_number": 1}]},
    ],
)
def test_one_shot_malformed_envelopes_are_rejected(one_shot, mutation):
    records = one_shot()
    envelope = json.loads(review_dispatch(records)["data"]["arguments"]["prompt"].split("\n", 1)[1])
    envelope.update(mutation)
    replace_review_envelope(records, envelope)
    with pytest.raises(ValueError, match="APEX_REVIEW"):
        metrics(records)


def test_one_shot_invalid_json_is_rejected(one_shot):
    records = one_shot()
    review_dispatch(records)["data"]["arguments"]["prompt"] = "APEX_REVIEW\n{"
    with pytest.raises(ValueError, match="APEX_REVIEW"):
        metrics(records)


@pytest.mark.parametrize(
    "lenses",
    [
        None,
        {},
        [None],
        [{"review_focus": "", "pass_number": 1}],
        [{"review_focus": "comprehensive", "pass_number": 0}],
        [{"review_focus": "comprehensive", "pass_number": True}],
        [{"review_focus": "comprehensive", "pass_number": 1}] * 2,
    ],
)
def test_one_shot_invalid_batch_lenses_are_rejected(one_shot, lenses):
    records = one_shot(batch=True)
    envelope = json.loads(review_dispatch(records)["data"]["arguments"]["prompt"].split("\n", 1)[1])
    envelope["lenses"] = lenses
    replace_review_envelope(records, envelope)
    with pytest.raises(ValueError, match="APEX_REVIEW"):
        metrics(records)


def test_one_shot_accepts_supporting_inputs_without_exporting_prompt_payloads(one_shot):
    records = one_shot()
    envelope = json.loads(review_dispatch(records)["data"]["arguments"]["prompt"].split("\n", 1)[1])
    envelope["supporting_inputs"] = [{"path": "immutable-evidence.md", "sha256": "recorded-metadata"}]
    envelope["instructions"] = "Private bounded review instructions."
    replace_review_envelope(records, envelope)
    requests = metrics(records)["native_evidence"]["execution_requests"]
    review = next(request for request in requests if request.get("protocol") == "APEX_REVIEW")
    assert review["project"] == envelope["project_name"]
    assert "supporting_inputs" not in review
    assert "instructions" not in review


@pytest.mark.parametrize(
    "field,value", [("mode", "async"), ("model", None), ("reasoning_effort", "high"), ("context_tier", "default")]
)
def test_one_shot_requires_sync_without_overrides(one_shot, field, value):
    records = one_shot()
    review_dispatch(records)["data"]["arguments"][field] = value
    with pytest.raises(ValueError, match="APEX_REVIEW"):
        metrics(records)


@pytest.mark.parametrize("source", ["user", "unrelated-task", "handshake"])
def test_arbitrary_prompts_and_unrelated_rubber_duck_calls_are_not_reviews(one_shot, source):
    records = one_shot()
    dispatch = review_dispatch(records)
    if source == "user":
        records.remove(dispatch)
        records = [
            record
            for record in records
            if not (record["type"] == "tool.execution_complete" and record["data"]["toolCallId"] == "review-task")
        ]
    else:
        dispatch["data"]["arguments"]["prompt"] = (
            "APEX_WORKER_HANDSHAKE\nnonce" if source == "handshake" else "Explain this function."
        )
    report = metrics(records)
    assert report["_computed"]["execution_count"] == 1
    assert report["_computed"]["challenger_per_step"] == {}
    assert report["_computed"]["challenger_max_per_step"] is None


def test_one_shot_deep_cannot_certify_default_smoke_budget(one_shot):
    records = one_shot(batch=True)
    envelope = json.loads(review_dispatch(records)["data"]["arguments"]["prompt"].split("\n", 1)[1])
    envelope["review_depth"] = "deep"
    replace_review_envelope(records, envelope)
    profiler = load("profile_debug_log")
    report = profiler.profile(profiler.sdk_events_to_spans(records))
    assert len(report["native_evidence"]["execution_requests"]) == 2
    with pytest.raises(ValueError, match="default-mode smoke budget"):
        metrics(records)


def test_one_shot_root_parent_and_no_receipt_are_supported(one_shot):
    records = one_shot()
    for record in records:
        if record["id"].startswith("review-event-"):
            if record.get("agentId") == "main":
                record.pop("agentId")
            if record["type"] == "subagent.started":
                record["data"].pop("parentId")
    records = [record for record in records if record["type"] != "user.message"]
    assert metrics(records)["_computed"]["challenger_per_step"] == {"2": 1}


@pytest.mark.parametrize("reuse_request_id", [False, True])
@pytest.mark.parametrize("parent_id_collision", [False, True])
def test_actual_repeat_dispatches_count_towards_strict_budget(
    one_shot, tmp_path, reuse_request_id, parent_id_collision
):
    records = one_shot(legacy=True)
    if parent_id_collision:
        share_parent_request_id(records)
    repeated = copy.deepcopy([record for record in records if record["id"].startswith("review-event-")])
    for record in repeated:
        record["id"] += "-repeat"
        if record.get("agentId") == "reviewer":
            record["agentId"] = "reviewer-repeat"
        if record["data"].get("toolCallId") == "review-task":
            record["data"]["toolCallId"] = "review-task-repeat"
        if record["data"].get("apiCallId") == "review-api":
            record["data"]["apiCallId"] = "review-api-repeat"
        if "usage" in record["data"]:
            record["data"]["usage"]["apiCallId"] = "review-api-repeat"
        if record["type"] == "tool.execution_start" and not reuse_request_id:
            envelope = json.loads(record["data"]["arguments"]["prompt"].split("\n", 1)[1])
            envelope["request_id"] = "review-2"
            record["data"]["arguments"]["prompt"] = "APEX_REVIEW\n" + json.dumps(envelope)
    records[-2:-2] = repeated
    for index, record in enumerate(records):
        record["timestamp"] = (datetime(2026, 10, 16, tzinfo=UTC) + timedelta(seconds=index)).isoformat()
    if reuse_request_id:
        with pytest.raises(ValueError, match="duplicate or conflicting execution request_id"):
            metrics(records)
    else:
        assert metrics(records)["_computed"]["challenger_per_step"] == {"2": 3}
        path = tmp_path / "events.jsonl"
        path.write_text("\n".join(json.dumps(record) for record in records))
        assert load("validate_review_ceiling").budget_check(path)[1] == ["step 2: 3 invocations > ceiling 2"]
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/scripts/validate_review_ceiling.py"), "--budget", str(path), "--strict"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 1
        assert "3 invocations > ceiling 2" in result.stderr
