#!/usr/bin/env python3
"""Profile native VS Code Copilot SDK events or historical OTel/Local exports.

Extracts headline metrics used by the token-reduction workstream:

  - token totals per model (input + output)
  - per-call input-token distribution buckets
  - subagent wall-time aggregate + per-invocation list
  - tool-call payload sizes (top consumers)
  - duplicate file-read map (read_file path -> count)
  - hard error spans (status.code == 2) with non-benign filter
  - ask_user count + per-call duration (historical question aliases are readable)
  - session wall time, agent wall time (chat span sum), user-wait
    wall time (askQuestions duration sum)

Schema reference: VS Code Copilot Chat exports an OpenTelemetry
``resourceSpans`` array. Each chat call is a span named
``chat:<model>``; each tool invocation has ``gen_ai.operation.name ==
'execute_tool'`` with ``gen_ai.tool.name`` set.

Historical-only informational warning checks (no exit-code impact):

  - ``--max-spans-between-clears N`` flags sessions exceeding ``N``
    chat spans without a SessionStart/Stop boundary (Phase 2a
    compliance signal).
  - ``--max-askquestions-per-phase N`` flags any contiguous run
    (between turn boundaries) exceeding ``N`` askQuestions calls
    (Phase 4 compliance signal).

Usage:

    python3 tools/scripts/profile_debug_log.py LOG.json [--json]
    python3 tools/scripts/profile_debug_log.py LOG.json --json > out.json

Exit codes: ``0`` on success, ``1`` on malformed/missing log,
``2`` on argparse error.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import median
from typing import Any

# OTel status codes: 0 = UNSET/OK (treated as OK), 1 = OK, 2 = ERROR.
# A subset of tool errors are routine ("not found" probes etc.) and
# would inflate the error count without indicating a real problem.
BENIGN_ERROR_FRAGMENTS = (
    "ENOENT",
    "no such file or directory",
)


def _jsonl_record_to_span(rec: dict[str, Any]) -> dict[str, Any]:
    """Convert a VS Code Copilot Chat JSONL event record into an OTel-shaped span."""
    if not isinstance(rec, dict) or ("type" not in rec and "name" not in rec):
        raise ValueError("JSONL line is not a valid event object")

    raw_attrs = rec.get("attrs") if isinstance(rec.get("attrs"), dict) else {}
    rtype = str(rec.get("type") or "")
    rname = str(rec.get("name") or "")
    if rtype == "child_session_ref":
        rtype = "subagent"
        rname = rname.removeprefix("runSubagent-")

    start_ns: str | None = None
    end_ns: str | None = None
    if isinstance(rec.get("ts"), (int, float)):
        s_ns = int(rec["ts"] * 1_000_000)
        dur_ms = int(rec.get("dur") or 0) if isinstance(rec.get("dur"), (int, float)) else 0
        start_ns = str(s_ns)
        end_ns = str(s_ns + max(0, dur_ms) * 1_000_000)

    attributes: list[dict[str, Any]] = []

    def add_attr(key: str, val: Any) -> None:
        if val is None:
            return
        if isinstance(val, bool):
            attributes.append({"key": key, "value": {"boolValue": val}})
        elif isinstance(val, int):
            attributes.append({"key": key, "value": {"intValue": val}})
        elif isinstance(val, float):
            attributes.append({"key": key, "value": {"doubleValue": val}})
        elif isinstance(val, str):
            attributes.append({"key": key, "value": {"stringValue": val}})
        else:
            attributes.append({"key": key, "value": {"stringValue": json.dumps(val)}})

    span_name = rname
    if rtype == "llm_request":
        model = raw_attrs.get("model") or (rname.split(":", 1)[1] if rname.startswith("chat:") else rname or "unknown")
        span_name = rname if rname.startswith("chat:") else f"chat:{model}"
        add_attr("gen_ai.operation.name", "chat")
        add_attr("gen_ai.request.model", str(model))
        add_attr("gen_ai.usage.input_tokens", raw_attrs.get("inputTokens"))
        add_attr("gen_ai.usage.output_tokens", raw_attrs.get("outputTokens"))
    elif rtype == "tool_call":
        add_attr("gen_ai.operation.name", "execute_tool")
        add_attr("gen_ai.tool.name", rname)
        args_val = raw_attrs.get("args")
        if args_val is not None:
            add_attr(
                "gen_ai.tool.call.arguments",
                args_val if isinstance(args_val, str) else json.dumps(args_val),
            )
        if raw_attrs.get("result") is not None:
            add_attr("gen_ai.tool.call.result", str(raw_attrs.get("result")))

    raw_status = rec.get("status")
    status_obj: dict[str, Any] = {}
    if isinstance(raw_status, dict):
        status_obj = raw_status
    elif raw_status in ("error", "failed", "ERROR", "FAILED") or raw_attrs.get("error"):
        status_obj = {
            "code": 2,
            "message": str(raw_attrs.get("error") or raw_attrs.get("message") or raw_status or "error"),
        }

    span: dict[str, Any] = {
        "name": span_name,
        "attributes": attributes,
        "status": status_obj,
    }
    for canonical, alias in (("traceId", "tid"), ("spanId", "sid"), ("parentSpanId", "pid")):
        if rec.get(canonical) or rec.get(alias):
            span[canonical] = str(rec.get(canonical) or rec[alias])
    if start_ns is not None:
        span["startTimeUnixNano"] = start_ns
    if end_ns is not None:
        span["endTimeUnixNano"] = end_ns
    if rtype == "subagent":
        span["_jsonl_subagent"] = str(raw_attrs.get("agentName") or rname or "(unknown)")
    return span


def sdk_events_to_spans(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize native SDK events without adding parent token rollups twice."""

    def identifier(value: Any, label: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"native {label} requires a nonempty string")
        return value

    records: list[dict[str, Any]] = []
    seen_events: dict[str, dict[str, Any]] = {}
    for event in events:
        if not isinstance(event, dict) or not isinstance(event.get("data"), dict):
            raise ValueError("native event requires an object data payload")
        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id:
            raise ValueError("native event requires an id")
        identifier(event.get("type"), "event type")
        if event.get("agentId") is not None:
            identifier(event["agentId"], "event agentId")
        if event_id in seen_events:
            if event != seen_events[event_id]:
                raise ValueError(f"conflicting native event id: {event_id}")
            continue
        seen_events[event_id] = event
        records.append(event)
    if not records:
        raise ValueError("no native events")
    capture_closed = False
    for event in records:
        if not event.get("agentId"):
            if event["type"] in ("session.end", "session.shutdown"):
                capture_closed = True
            elif event["type"] in (
                "session.start",
                "session.resume",
                "user.message",
                "assistant.turn_start",
                "assistant.message",
                "tool.execution_start",
                "external_tool.requested",
            ):
                capture_closed = False

    def timestamp(event: dict[str, Any]) -> int:
        value = event.get("timestamp")
        if not isinstance(value, str):
            raise ValueError(f"event {event['id']}: missing timestamp")
        date = datetime.fromisoformat(value)
        if date.tzinfo is None:
            raise ValueError(f"event {event['id']}: timestamp needs a timezone")
        return int(date.timestamp() * 1_000_000_000)

    for event in records:
        timestamp(event)
    session = next((e["data"] for e in records if e.get("type") == "session.start"), {})
    session_id = identifier(session.get("sessionId"), "session.start sessionId")
    spans: list[dict[str, Any]] = []

    def make_span(
        name: str,
        event: dict[str, Any],
        attrs: dict[str, Any] | None = None,
        end: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        attributes = []
        for key, value in (attrs or {}).items():
            if value is None:
                continue
            kind = "boolValue" if isinstance(value, bool) else "intValue" if isinstance(value, int) else "stringValue"
            attributes.append({"key": key, "value": {kind: value if kind != "stringValue" else str(value)}})
        span = {
            "name": name,
            "attributes": attributes,
            "traceId": session_id,
            "spanId": event["id"],
            "startTimeUnixNano": str(timestamp(event)),
            "_source_format": "copilot-sdk",
            "_sdk_agent_id": event.get("agentId") or "root",
        }
        if end is not None:
            span["endTimeUnixNano"] = str(timestamp(end))
        return span

    executions: dict[tuple[str, str], tuple[dict[str, Any], dict[str, Any], set[str]]] = {}

    def record_execution(
        event: dict[str, Any],
        message: Any,
        target: Any,
        parent: str,
        source: str,
    ) -> None:
        if not isinstance(message, str) or not message.startswith("WORKER_EXECUTE\n"):
            return
        envelope = json.loads(message.removeprefix("WORKER_EXECUTE\n"))
        if (
            not isinstance(envelope, dict)
            or not all(
                isinstance(envelope.get(key), str) and envelope[key]
                for key in ("request_id", "project", "step", "phase")
            )
            or not isinstance(envelope.get("resume"), bool)
            or envelope.get("review_depth") not in ("default", "deep")
            or not isinstance(target, str)
            or not target
            or envelope.get("parent_id", parent) != parent
        ):
            raise ValueError(f"event {event['id']}: invalid WORKER_EXECUTE envelope")
        request_id = envelope["request_id"]
        request_key = ("WORKER_EXECUTE", request_id)
        previous = executions.get(request_key)
        if previous is not None:
            request, original, sources = previous
            if (
                original != envelope
                or request["_sdk_execution"]["worker_id"] != target
                or request["_sdk_execution"]["parent_id"] != parent
                or source in sources
            ):
                raise ValueError(f"duplicate or conflicting execution request_id: {request_id}")
            sources.add(source)
            return
        request = make_span("WorkerExecute", event)
        request["spanId"] += ":execution"
        request["_sdk_execution"] = {
            **{key: envelope[key] for key in ("request_id", "project", "step", "phase", "resume", "review_depth")},
            "worker_id": target,
            "parent_id": parent,
        }
        executions[request_key] = request, envelope, {source}
        spans.append(request)

    worker_starts = {event.get("agentId"): event for event in records if event["type"] == "subagent.started"}
    worker_by_call = {
        event["data"].get("toolCallId"): event.get("agentId")
        for event in records
        if event["type"] == "subagent.started" and event["data"].get("toolCallId") and event.get("agentId")
    }
    tools: dict[tuple[str, str], dict[str, Any]] = {}
    workers: dict[str, dict[str, Any]] = {}
    hooks: dict[tuple[str, str], dict[str, Any]] = {}
    calls: dict[str, dict[str, Any]] = {}
    usage: dict[str, dict[str, Any]] = {}
    for event in records:
        data = event["data"]
        kind = event.get("type")
        agent = event.get("agentId") or "root"
        if kind in ("session.start", "session.end", "session.shutdown"):
            spans.append(make_span("SessionStart" if kind == "session.start" else "Stop", event, end=event))
        elif kind == "user.message" and agent != "root":
            start = worker_starts.get(agent)
            if start is not None:
                record_execution(
                    event, data.get("content"), agent, start["data"].get("parentId") or "root", "worker_input"
                )
            elif isinstance(data.get("content"), str) and data["content"].startswith("WORKER_EXECUTE\n"):
                raise ValueError(f"event {event['id']}: execution input has no worker start")
        elif kind == "assistant.message":
            call_id = data.get("apiCallId")
            tool_reqs = data.get("toolRequests")
            if (
                call_id is None
                and not data.get("model")
                and not data.get("content")
                and isinstance(tool_reqs, list)
                and tool_reqs
                and all(isinstance(req, dict) and req.get("name") == "read_agent" for req in tool_reqs)
            ):
                continue
            if call_id is not None:
                identifier(call_id, "API call ID")
            calls.setdefault(call_id or f"unattributed:{event['id']}", event)
        elif kind == "session.usage_record":
            record = data.get("usage")
            if not isinstance(record, dict):
                raise ValueError(f"event {event['id']}: invalid usage payload")
            accounting = record.get("accounting") or {}
            if not isinstance(accounting, dict):
                raise ValueError(f"event {event['id']}: invalid usage accounting")
            call_id = record.get("apiCallId") or accounting.get("usageId")
            identifier(call_id, "usage apiCallId or accounting.usageId")
            previous = usage.get(call_id)
            fields = ("model", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens")
            if previous and any(previous["data"]["usage"].get(k) != record.get(k) for k in fields):
                raise ValueError(f"conflicting authoritative usage for call {call_id}")
            usage.setdefault(call_id, event)
        elif kind == "tool.execution_start":
            call_id = identifier(data.get("toolCallId"), "tool start call ID")
            identifier(data.get("toolName"), "tool name")
            if (agent, call_id) in tools:
                raise ValueError(f"duplicate tool start: {call_id}")
            tool = make_span(
                data["toolName"],
                event,
                {
                    "gen_ai.operation.name": "execute_tool",
                    "gen_ai.tool.name": data["toolName"],
                    "gen_ai.tool.call.arguments": json.dumps(data.get("arguments"), ensure_ascii=False),
                },
            )
            tool["_sdk_incomplete"] = True
            tools[(agent, call_id)] = tool
            spans.append(tool)
            args = data.get("arguments")
            message = args.get("message") if isinstance(args, dict) else None
            if data["toolName"] == "write_agent" and isinstance(args, dict):
                record_execution(event, message, args.get("agent_id"), agent, "tool")
            elif data["toolName"] == "task" and isinstance(args, dict) and call_id in worker_by_call:
                record_execution(event, args.get("prompt"), worker_by_call[call_id], agent, "tool")
        elif kind == "tool.execution_complete":
            call_id = identifier(data.get("toolCallId"), "tool completion call ID")
            tool = tools.get((agent, call_id))
            if tool is None:
                orphan = make_span("UnmatchedToolCompletion", event)
                orphan["_sdk_incomplete"] = True
                spans.append(orphan)
                continue
            tool["endTimeUnixNano"] = str(max(int(tool["startTimeUnixNano"]), timestamp(event)))
            tool["_sdk_incomplete"] = not isinstance(data.get("success"), bool)
            tool["attributes"].append(
                {
                    "key": "gen_ai.tool.call.result",
                    "value": {"stringValue": json.dumps(data.get("result"), ensure_ascii=False)},
                }
            )
            tool["status"] = (
                {"code": 2 if data["success"] is False else 1, "message": str(data.get("error") or "")}
                if isinstance(data.get("success"), bool)
                else {"message": "Success evidence unavailable"}
            )
        elif kind == "subagent.started":
            if agent == "root" or not data.get("agentName"):
                raise ValueError(f"event {event['id']}: worker start needs attributed agent ID/name")
            if agent in workers:
                raise ValueError(f"duplicate worker start: {agent}")
            worker = make_span(data["agentName"], event)
            worker["_jsonl_subagent"] = data["agentName"]
            worker["_sdk_parent_agent_id"] = (
                identifier(data["parentId"], "worker parent ID") if data.get("parentId") is not None else "root"
            )
            worker["_sdk_start_call_id"] = identifier(data.get("toolCallId"), "worker start call ID")
            worker["_sdk_execution_mode"] = data.get("executionMode")
            worker["_sdk_incomplete"] = True
            workers[agent] = worker
            spans.append(worker)
        elif kind == "subagent.completed":
            worker = workers.get(agent)
            if worker is None:
                orphan = make_span("UnmatchedWorkerCompletion", event)
                orphan["_sdk_incomplete"] = True
                spans.append(orphan)
            else:
                if data.get("toolCallId") != worker["_sdk_start_call_id"]:
                    raise ValueError(f"worker completion does not match start call: {agent}")
                worker["endTimeUnixNano"] = str(timestamp(event))
                worker["_sdk_incomplete"] = False
        elif kind == "hook.start":
            hook_id = identifier(data.get("hookInvocationId"), "hook invocation ID")
            if (agent, hook_id) in hooks:
                raise ValueError(f"duplicate hook start: {hook_id}")
            hook = make_span(f"hook:{data.get('hookType', 'unknown')}", event)
            hook["_sdk_incomplete"] = True
            hooks[(agent, hook_id)] = hook
            spans.append(hook)
        elif kind == "hook.end":
            hook_id = identifier(data.get("hookInvocationId"), "hook invocation ID")
            hook = hooks.get((agent, hook_id))
            if hook is None:
                orphan = make_span("UnmatchedHookCompletion", event)
                orphan["_sdk_incomplete"] = True
                spans.append(orphan)
            else:
                hook["endTimeUnixNano"] = str(timestamp(event))
                hook["_sdk_incomplete"] = not isinstance(data.get("success"), bool)
                hook["status"] = (
                    {"code": 2 if data["success"] is False else 1, "message": str(data.get("error") or "")}
                    if isinstance(data.get("success"), bool)
                    else {"message": "Success evidence unavailable"}
                )

    external: dict[tuple[str, str], dict[str, Any]] = {}
    for event in records:
        kind, data = event["type"], event["data"]
        if kind not in ("external_tool.requested", "external_tool.completed"):
            continue
        agent = event.get("agentId") or "root"
        request_id = identifier(data.get("requestId"), "external tool request ID")
        if kind == "external_tool.requested":
            if (agent, request_id) in external:
                raise ValueError(f"duplicate external tool request: {request_id}")
            call_id = identifier(data.get("toolCallId"), "external tool call ID")
            name = identifier(data.get("toolName"), "external tool name")
            tool = tools.get((agent, call_id))
            if tool is None:
                tool = make_span(
                    name,
                    event,
                    {
                        "gen_ai.operation.name": "execute_tool",
                        "gen_ai.tool.name": name,
                        "gen_ai.tool.call.arguments": json.dumps(data.get("arguments"), ensure_ascii=False),
                    },
                )
                tool["_sdk_incomplete"] = True
                tool["_sdk_unknown_external_outcome"] = True
                tools[(agent, call_id)] = tool
                spans.append(tool)
                args = data.get("arguments")
                if name == "write_agent" and isinstance(args, dict):
                    record_execution(event, args.get("message"), args.get("agent_id"), agent, "tool")
            elif tool["name"] != name:
                raise ValueError(f"external/native tool name conflict: {call_id}")
            elif name == "task" and json.loads(_attrs(tool).get("gen_ai.tool.call.arguments") or "null") != data.get(
                "arguments"
            ):
                raise ValueError(f"external/native task arguments conflict: {call_id}")
            external[(agent, request_id)] = tool
        else:
            tool = external.get((agent, request_id))
            if tool is None:
                tool = make_span("UnmatchedExternalCompletion", event)
                tool["_sdk_incomplete"] = True
                spans.append(tool)
            elif tool.get("_sdk_unknown_external_outcome"):
                # Transport completion carries no execution-success evidence.
                tool["endTimeUnixNano"] = str(timestamp(event))

    for (parent, call_id), tool in tools.items():
        if tool["name"] != "task":
            continue
        args = json.loads(_attrs(tool).get("gen_ai.tool.call.arguments") or "null")
        if not isinstance(args, dict) or args.get("agent_type") not in {"rubber-duck", "challenger-review-subagent"}:
            continue
        prompt = args.get("prompt")
        if not isinstance(prompt, str) or not prompt.startswith("APEX_REVIEW\n"):
            continue
        envelope = _one_shot_review_envelope(prompt, args)
        linked = [
            worker
            for worker in workers.values()
            if worker["_sdk_parent_agent_id"] == parent and worker["_sdk_start_call_id"] == call_id
        ]
        if (
            len(linked) != 1
            or linked[0]["_jsonl_subagent"] != args["agent_type"]
            or (parent != "root" and parent not in workers)
            or int(linked[0]["startTimeUnixNano"]) < int(tool["startTimeUnixNano"])
        ):
            raise ValueError(
                f"review request {envelope['request_id']}: missing reviewer or wrong parent/task attribution"
            )
        if linked[0]["_sdk_execution_mode"] != "sync":
            raise ValueError(
                f"review request {envelope['request_id']}: APEX_REVIEW requires attributed synchronous execution"
            )
        request_id = envelope["request_id"]
        request_key = ("APEX_REVIEW", request_id)
        if request_key in executions:
            raise ValueError(f"duplicate or conflicting execution request_id: {request_id}")
        request = {
            **tool,
            "name": "ReviewExecute",
            "spanId": tool["spanId"] + ":execution",
            "attributes": [],
            "_sdk_execution": {
                **{key: envelope[key] for key in ("request_id", "step", "review_depth")},
                "project": envelope["project_name"],
                "phase": "review",
                "resume": False,
                "worker_id": linked[0]["_sdk_agent_id"],
                "parent_id": parent,
                "protocol": "APEX_REVIEW",
            },
        }
        # The request is a marker, not another tool operation or outcome.
        for key in ("_sdk_incomplete", "_sdk_unknown_external_outcome", "status"):
            request.pop(key, None)
        executions[request_key] = request, envelope, {"tool"}
        spans.append(request)

    for call_id in calls.keys() | usage.keys():
        message = calls.get(call_id)
        authoritative = usage.get(call_id)
        event = message or authoritative
        assert event is not None
        record = authoritative["data"]["usage"] if authoritative else {}
        model = identifier(record.get("model") or event["data"].get("model") or "unknown", "model")
        chat = make_span(
            f"chat:{model}",
            event,
            {
                "gen_ai.operation.name": "chat",
                "gen_ai.request.model": model,
                "gen_ai.usage.input_tokens": record.get("inputTokens"),
                "gen_ai.usage.output_tokens": record.get("outputTokens"),
                "gen_ai.usage.cache_read_tokens": record.get("cacheReadTokens"),
                "gen_ai.usage.cache_write_tokens": record.get("cacheWriteTokens"),
            },
        )
        chat["spanId"] = f"usage:{call_id}"
        chat["_sdk_unattributed_usage"] = authoritative is not None and message is None
        duration = record.get("duration")
        if authoritative and isinstance(duration, (int, float)) and not isinstance(duration, bool) and duration >= 0:
            end = timestamp(authoritative)
            chat["endTimeUnixNano"] = str(end)
            chat["startTimeUnixNano"] = str(end - int(duration * 1_000_000))
        spans.append(chat)
    metadata = make_span("NativeLogMetadata", records[0])
    metadata["spanId"] += ":metadata"
    metadata["_sdk_session"] = session
    metadata["_sdk_capture_closed"] = capture_closed
    metadata["_sdk_duplicate_events"] = len(events) - len(records)
    metadata["_sdk_duplicate_usage"] = sum(e.get("type") == "session.usage_record" for e in records) - len(usage)
    spans.append(metadata)
    return sorted(spans, key=lambda span: int(span["startTimeUnixNano"]))


def _one_shot_review_envelope(prompt: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Validate dispatch intent, without treating it as findings or runtime approval."""
    try:
        envelope = json.loads(prompt.removeprefix("APEX_REVIEW\n"))
    except json.JSONDecodeError as exc:
        raise ValueError("invalid APEX_REVIEW envelope JSON") from exc
    required = ("request_id", "project_name", "step", "artifact_path", "artifact_type", "output_path")
    if (
        ("mode" in arguments and arguments["mode"] != "sync")
        or any(key in arguments for key in ("model", "reasoning_effort", "context_tier"))
        or not isinstance(envelope, dict)
        or not all(isinstance(envelope.get(key), str) and envelope[key].strip() for key in required)
        or envelope.get("review_depth") not in ("default", "deep")
        or not isinstance(envelope.get("overwrite"), bool)
        or not isinstance(envelope.get("cache_inputs"), dict)
    ):
        raise ValueError("invalid APEX_REVIEW envelope or task arguments")
    lenses = envelope.get("lenses") if "lenses" in envelope else [envelope]
    if (
        ("lenses" in envelope and any(key in envelope for key in ("review_focus", "pass_number")))
        or not isinstance(lenses, list)
        or not lenses
        or any(
            not isinstance(lens, dict)
            or not isinstance(lens.get("review_focus"), str)
            or not lens["review_focus"].strip()
            or type(lens.get("pass_number")) is not int
            or lens["pass_number"] <= 0
            for lens in lenses
        )
        or len({(lens["review_focus"], lens["pass_number"]) for lens in lenses}) != len(lenses)
    ):
        raise ValueError("invalid APEX_REVIEW lenses")
    return envelope


def load_spans(path: Path) -> list[dict[str, Any]]:
    """Read an OTel JSON or VS Code JSONL debug log file and return a flat list of spans.

    Raises ``ValueError`` on malformed input so the CLI can surface a
    clean diagnostic instead of a stack trace.
    """
    text = path.read_text(encoding="utf-8")
    stripped = text.strip()
    if not stripped:
        raise ValueError(f"{path}: empty log file")

    try:
        raw = json.loads(stripped)
    except json.JSONDecodeError as exc:
        lines = [line.strip() for line in stripped.splitlines() if line.strip()]
        if len(lines) <= 1 and path.suffix.lower() != ".jsonl":
            raise ValueError(f"{path}: not valid JSON ({exc.msg})") from exc
        records: list[dict[str, Any]] = []
        for idx, line in enumerate(lines, start=1):
            try:
                rec = json.loads(line)
                if not isinstance(rec, dict):
                    raise ValueError("not an event object")
                records.append(rec)
            except (json.JSONDecodeError, ValueError) as line_exc:
                raise ValueError(f"{path}:{idx}: invalid JSONL record ({line_exc})") from line_exc
        if not records:
            raise ValueError(f"{path}: no spans found") from exc
        if any("data" in record for record in records):
            return sdk_events_to_spans(records)
        return [_jsonl_record_to_span(record) for record in records]

    if isinstance(raw, dict) and "data" in raw:
        return sdk_events_to_spans([raw])
    if isinstance(raw, dict) and ("ts" in raw or "type" in raw) and "resourceSpans" not in raw:
        return [_jsonl_record_to_span(raw)]

    if not isinstance(raw, dict):
        raise ValueError(f"{path}: missing resourceSpans[]")

    resource_spans = raw.get("resourceSpans")
    if not isinstance(resource_spans, list) or not resource_spans:
        raise ValueError(f"{path}: missing resourceSpans[]")

    spans = []
    for rs in resource_spans:
        for ss in rs.get("scopeSpans", []):
            spans.extend(ss.get("spans", []))
    if not spans:
        raise ValueError(f"{path}: no spans found")
    return spans


def discover_sdk_logs(repository: Path, state_root: Path | None = None) -> list[Path]:
    """Discover only logs whose native metadata belongs to this repository."""
    root = (state_root or Path.home() / ".copilot/session-state").expanduser().resolve()
    repository = repository.resolve()
    matches: list[Path] = []
    for candidate in root.glob("*/events.jsonl"):
        if candidate.is_symlink() or candidate.parent.is_symlink() or not candidate.resolve().is_relative_to(root):
            print(f"warning: skipped non-local session log {candidate}", file=sys.stderr)
            continue
        try:
            with candidate.open(encoding="utf-8") as stream:
                event = json.loads(next(stream))
                if event.get("type") != "session.start":
                    raise ValueError("first record is not session.start")
                context = event.get("data", {}).get("context", {})
                workspace = context.get("gitRoot") or context.get("cwd")
                if (
                    not isinstance(workspace, str)
                    or not Path(workspace).is_absolute()
                    or Path(workspace).resolve() != repository
                ):
                    continue
                for line in stream:
                    if not line.strip():
                        continue
                    event = json.loads(line)
                    if event.get("type") == "session.resume":
                        context = event.get("data", {}).get("context", {})
                        workspace = context.get("gitRoot") or context.get("cwd")
                        if (
                            not isinstance(workspace, str)
                            or not Path(workspace).is_absolute()
                            or Path(workspace).resolve() != repository
                        ):
                            raise ValueError("resumed session has unknown or different workspace identity")
                matches.append(candidate)
        except (OSError, ValueError, StopIteration, AttributeError) as exc:
            print(f"warning: cannot identify workspace for {candidate}: {exc}", file=sys.stderr)
    return sorted(matches, key=lambda file: (file.stat().st_mtime_ns, str(file)))


def sdk_execution_metrics(spans: list[dict[str, Any]]) -> dict[str, Any]:
    """Measure linked execution calls, including one-shot reviews and worker resume recovery."""
    executions = [span for span in spans if "_sdk_execution" in span]
    first_inputs: list[int] = []
    recovery: list[bool | None] = []
    workers = {span["_sdk_agent_id"]: span for span in spans if span.get("_jsonl_subagent")}
    reviews: Counter[str] = Counter()
    request_ids: set[tuple[str, str]] = set()
    for request in executions:
        envelope = request["_sdk_execution"]
        request_id = envelope["request_id"]
        request_key = (envelope.get("protocol", "WORKER_EXECUTE"), request_id)
        if request_key in request_ids:
            raise ValueError(f"duplicate execution request_id: {request_id}")
        request_ids.add(request_key)
        start = int(request["startTimeUnixNano"])
        target = envelope["worker_id"]
        worker = workers.get(target)
        if worker is None or worker["_sdk_parent_agent_id"] != envelope["parent_id"]:
            raise ValueError(f"execution request {request_id}: missing worker or wrong parent attribution")
        stop = min(
            (
                int(other["startTimeUnixNano"])
                for other in executions
                if other["_sdk_execution"]["worker_id"] == target and int(other["startTimeUnixNano"]) > start
            ),
            default=None,
        )
        window = [
            span
            for span in spans
            if span.get("_sdk_agent_id") == target
            and int(span["startTimeUnixNano"]) >= start
            and (stop is None or int(span["startTimeUnixNano"]) < stop)
        ]
        chats = [span for span in window if span.get("name", "").startswith("chat:")]
        value = _token_count(_attrs(chats[0]).get("gen_ai.usage.input_tokens")) if chats else None
        if value is not None:
            first_inputs.append(value)
        if envelope.get("resume") is True:
            tool = next((span for span in window if _attrs(span).get("gen_ai.operation.name") == "execute_tool"), None)
            if tool is None:
                recovery.append(None)
            else:
                arguments = json.loads(_attrs(tool).get("gen_ai.tool.call.arguments") or "{}")
                command = arguments.get("command") if isinstance(arguments, dict) else None
                recovery.append(
                    command == f"apex-recall show {envelope['project']} --json"
                    and tool.get("status", {}).get("code") == 1
                )
        if worker["_jsonl_subagent"] == "challenger-review-subagent" or envelope.get("protocol") == "APEX_REVIEW":
            if envelope.get("review_depth") != "default":
                raise ValueError("default-mode smoke budget requires explicit default review_depth")
            reviews[str(envelope["step"])] += 1
    return {
        "execution_count": len(executions),
        "max_first_execution_input_tokens": max(first_inputs)
        if first_inputs and len(first_inputs) == len(executions)
        else None,
        "resume_recall_verified": all(recovery) if recovery and all(value is not None for value in recovery) else None,
        "challenger_per_step": dict(reviews),
        "challenger_max_per_step": max(reviews.values()) if reviews else None,
    }


def _attrs(span: dict[str, Any]) -> dict[str, Any]:
    """Flatten OTel attribute list into a plain dict.

    OTel encodes values inside a ``value`` wrapper keyed by type
    (``stringValue``, ``intValue``, etc.). Pull out the first non-null
    value to give downstream code a simple key/value dict.
    """
    out: dict[str, Any] = {}
    for a in span.get("attributes", []):
        key = a.get("key")
        if not key:
            continue
        v = a.get("value", {}) or {}
        for typed in ("stringValue", "intValue", "doubleValue", "boolValue"):
            if typed in v:
                # OTel JSON serialises intValue as a string in some
                # exporters; coerce when the key implies a number.
                val = v[typed]
                if typed == "intValue" and isinstance(val, str):
                    with contextlib.suppress(ValueError):
                        val = int(val)
                out[key] = val
                break
    return out


def _duration_s(span: dict[str, Any]) -> float:
    """Return span duration in seconds (0.0 if timestamps missing)."""
    try:
        start = int(span["startTimeUnixNano"])
        end = int(span["endTimeUnixNano"])
    except KeyError, ValueError, TypeError:
        return 0.0
    return max(0.0, (end - start) / 1e9)


def _interval_union_s(intervals_ns: list[tuple[int, int]]) -> float:
    """Return merged non-overlapping duration in seconds from (start_ns, end_ns) pairs."""
    valid = sorted((s, e) for s, e in intervals_ns if e > s)
    if not valid:
        return 0.0
    total_ns = 0
    cur_s, cur_e = valid[0]
    for s, e in valid[1:]:
        if s <= cur_e:
            cur_e = max(cur_e, e)
        else:
            total_ns += cur_e - cur_s
            cur_s, cur_e = s, e
    total_ns += cur_e - cur_s
    return total_ns / 1e9


def _bucket(n: int) -> str:
    """Coarse histogram bucket for input-token distribution."""
    if n < 10_000:
        return "<10K"
    if n < 50_000:
        return "10K-50K"
    if n < 100_000:
        return "50K-100K"
    if n < 200_000:
        return "100K-200K"
    return ">=200K"


def _token_count(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, str) and value.isascii() and value.isdigit():
        return int(value)
    return None


def _is_benign_error(span: dict[str, Any], attrs: dict[str, Any]) -> bool:
    """Drop errors that match the benign list (e.g. probe ENOENTs)."""
    msg = (span.get("status") or {}).get("message", "") or ""
    blob = msg + " " + str(attrs.get("gen_ai.tool.call.result", ""))[:500]
    return any(frag in blob for frag in BENIGN_ERROR_FRAGMENTS)


def profile(
    spans: list[dict[str, Any]],
    *,
    max_spans_between_clears: int = 50,
    max_askquestions_per_phase: int = 3,
) -> dict[str, Any]:
    """Compute the full metrics dictionary from a span list."""
    # Per-model token totals + per-call distribution.
    tokens_by_model: dict[str, dict[str, int]] = defaultdict(
        lambda: {"input": 0, "output": 0, "calls": 0, "input_samples": 0, "output_samples": 0},
    )
    input_buckets: Counter[str] = Counter()
    per_call_inputs: list[int] = []
    max_input_per_call = 0

    # Tool stats.
    tool_calls: Counter[str] = Counter()
    tool_payload_bytes: dict[str, int] = defaultdict(int)
    read_file_paths: Counter[str] = Counter()

    spans_by_id = {(span.get("traceId"), span.get("spanId")): span for span in spans if span.get("spanId")}
    delegation_spans = {
        identity
        for identity, span in spans_by_id.items()
        if _attrs(span).get("gen_ai.operation.name") == "execute_tool"
        and (_attrs(span).get("gen_ai.tool.name") or span.get("name")) == "runSubagent"
    }
    delegation_ancestors = set()
    for identity in delegation_spans:
        current = spans_by_id[identity]
        visited = set()
        while current.get("parentSpanId"):
            parent = (current.get("traceId"), current["parentSpanId"])
            if parent in visited or parent not in spans_by_id:
                break
            visited.add(parent)
            delegation_ancestors.add(parent)
            current = spans_by_id[parent]

    # Subagent stats.
    subagent_wall = 0.0
    subagent_calls: list[dict[str, Any]] = []

    # askQuestions stats.
    ask_durations: list[float] = []

    # Error stats. Track both raw count (status.code == 2) and the
    # non-benign filtered list so we can report the plan-target raw
    # number while keeping the useful filtered list for triage.
    error_spans: list[dict[str, Any]] = []
    error_spans_raw_count = 0

    # Inter-boundary span counters for compliance warnings.
    chat_since_boundary = 0
    inter_boundary_max = 0
    ask_in_phase = 0
    ask_per_phase_max = 0
    warnings: list[str] = []

    session_start: int | None = None
    session_end: int | None = None
    agent_chat_wall = 0.0
    chat_intervals_ns: list[tuple[int, int]] = []
    tool_intervals_ns: list[tuple[int, int]] = []
    pricing_learn_calls = 0
    tool_stalls_over_60s = 0
    seen_spans: set[tuple[str, str]] = set()
    duplicate_exported_spans = 0

    for span in spans:
        identity = (span.get("traceId"), span.get("spanId"))
        if all(identity):
            if identity in seen_spans:
                duplicate_exported_spans += 1
                continue
            seen_spans.add(identity)
        name = span.get("name") or ""
        attrs = _attrs(span)

        # Track overall session bounds for wall-time reporting.
        span_bounds_ns: tuple[int, int] | None = None
        try:
            s = int(span["startTimeUnixNano"])
            e = int(span["endTimeUnixNano"])
            session_start = s if session_start is None else min(session_start, s)
            session_end = e if session_end is None else max(session_end, e)
            span_bounds_ns = (s, e)
        except KeyError, ValueError, TypeError:
            pass

        # Error spans (status.code == 2). Counted up front because the
        # remainder of the loop may `continue` for chat/boundary spans
        # before reaching this check.
        status = span.get("status") or {}
        if status.get("code") == 2:
            error_spans_raw_count += 1
            if not _is_benign_error(span, attrs):
                error_spans.append(
                    {
                        "span_name": name,
                        "tool": attrs.get("gen_ai.tool.name"),
                        "message": status.get("message", ""),
                    },
                )

        # Chat spans → token + per-model accounting.
        if name.startswith("chat:"):
            model = attrs.get("gen_ai.request.model") or name.split(":", 1)[1]
            in_tok = _token_count(attrs.get("gen_ai.usage.input_tokens"))
            out_tok = _token_count(attrs.get("gen_ai.usage.output_tokens"))
            row = tokens_by_model[model]
            row["calls"] += 1
            if in_tok is not None:
                row["input"] += in_tok
                row["input_samples"] += 1
                input_buckets[_bucket(in_tok)] += 1
                per_call_inputs.append(in_tok)
                max_input_per_call = max(max_input_per_call, in_tok)
            if out_tok is not None:
                row["output"] += out_tok
                row["output_samples"] += 1
            agent_chat_wall += _duration_s(span)
            if span_bounds_ns is not None:
                chat_intervals_ns.append(span_bounds_ns)
            chat_since_boundary += 1
            continue

        # SessionStart / Stop reset the inter-clear counter.
        if name in ("SessionStart", "Stop"):
            inter_boundary_max = max(inter_boundary_max, chat_since_boundary)
            chat_since_boundary = 0
            continue

        # turn_start:N is a per-step boundary for askQuestions counting.
        if name.startswith("turn_start:"):
            ask_per_phase_max = max(ask_per_phase_max, ask_in_phase)
            ask_in_phase = 0

        # Tool spans.
        if attrs.get("gen_ai.operation.name") == "execute_tool":
            tname = attrs.get("gen_ai.tool.name") or name
            tool_calls[tname] += 1
            dur_s = _duration_s(span)
            if span_bounds_ns is not None and tname not in ("ask_user", "vscode_askQuestions", "task", "runSubagent"):
                tool_intervals_ns.append(span_bounds_ns)
            if dur_s >= 60.0 and tname not in ("ask_user", "vscode_askQuestions", "task", "runSubagent"):
                tool_stalls_over_60s += 1
            args_blob = str(attrs.get("gen_ai.tool.call.arguments", ""))
            result_blob = str(attrs.get("gen_ai.tool.call.result", ""))
            tool_payload_bytes[tname] += len(args_blob.encode("utf-8")) + len(result_blob.encode("utf-8"))
            if tname in ("mcp_azure_mcp_ser_pricing", "azure-mcp/pricing"):
                with contextlib.suppress(json.JSONDecodeError, TypeError):
                    parsed_args = json.loads(args_blob) if args_blob else {}
                    if isinstance(parsed_args, dict) and parsed_args.get("learn") is True:
                        pricing_learn_calls += 1
            if tname in ("read_file", "view", "Read"):
                # Pull filePath out of the JSON arguments to map dupes.
                try:
                    args_obj = json.loads(args_blob) if args_blob else {}
                    fpath = (
                        (args_obj.get("filePath") or args_obj.get("file_path") or args_obj.get("path") or "(unknown)")
                        if isinstance(args_obj, dict)
                        else "(unknown)"
                    )
                except json.JSONDecodeError, TypeError:
                    fpath = "(unparseable)"
                read_file_paths[fpath] += 1
            elif tname in ("ask_user", "vscode_askQuestions"):
                ask_durations.append(_duration_s(span))
                ask_in_phase += 1
            elif tname == "runSubagent":
                try:
                    arguments = json.loads(args_blob) if args_blob else {}
                    agent_name = arguments.get("agentName") if isinstance(arguments, dict) else None
                except json.JSONDecodeError, TypeError:
                    agent_name = None
                if not isinstance(agent_name, str) or not agent_name.strip():
                    agent_name = "(unknown)"
                duration = _duration_s(span)
                subagent_wall += duration
                subagent_calls.append({"name": agent_name, "duration_s": round(duration, 2)})
                continue

        # Subagent invocations.
        subagent_label = span.get("_jsonl_subagent") or (
            name if name in ("challenger-review-subagent", "execution_subagent", "cost-estimate-subagent") else None
        )
        if subagent_label:
            current = span
            visited = set()
            covered = identity in delegation_ancestors
            while not covered and current.get("parentSpanId"):
                parent = (current.get("traceId"), current["parentSpanId"])
                if parent in visited or parent not in spans_by_id:
                    break
                covered = parent in delegation_spans
                visited.add(parent)
                current = spans_by_id[parent]
            if covered:
                continue
            dur = _duration_s(span)
            subagent_wall += dur
            subagent_calls.append({"name": subagent_label, "duration_s": round(dur, 2)})

    # Final inter-boundary check after the loop.
    inter_boundary_max = max(inter_boundary_max, chat_since_boundary)
    ask_per_phase_max = max(ask_per_phase_max, ask_in_phase)

    native = [span for span in spans if span.get("_source_format") == "copilot-sdk"]
    worker_chat_counts = Counter(
        span["_sdk_agent_id"]
        for span in native
        if span.get("name", "").startswith("chat:") and span["_sdk_agent_id"] != "root"
    )
    cache_reads = [
        value
        for span in spans
        if (value := _token_count(_attrs(span).get("gen_ai.usage.cache_read_tokens"))) is not None
    ]
    cache_writes = [
        value
        for span in spans
        if (value := _token_count(_attrs(span).get("gen_ai.usage.cache_write_tokens"))) is not None
    ]
    if not native and inter_boundary_max > max_spans_between_clears:
        warnings.append(
            f"inter_boundary_chat_spans={inter_boundary_max} exceeds "
            f"threshold {max_spans_between_clears} (Phase 2a: /clear compliance)",
        )
    if not native and ask_per_phase_max > max_askquestions_per_phase:
        warnings.append(
            f"max_askquestions_per_phase={ask_per_phase_max} exceeds "
            f"threshold {max_askquestions_per_phase} (Phase 4: batching compliance)",
        )

    total_input = sum(row["input"] for row in tokens_by_model.values())
    total_output = sum(row["output"] for row in tokens_by_model.values())
    total_calls = sum(row["calls"] for row in tokens_by_model.values())
    input_samples = sum(row["input_samples"] for row in tokens_by_model.values())
    output_samples = sum(row["output_samples"] for row in tokens_by_model.values())
    avg_in = round(total_input / input_samples) if input_samples else 0
    if input_samples != total_calls or output_samples != total_calls:
        warnings.append("Token usage is incomplete: totals are observed lower bounds, not full-workflow cost evidence.")
    p50_in = int(median(per_call_inputs)) if per_call_inputs else 0
    session_wall = (session_end - session_start) / 1e9 if session_start and session_end else 0.0
    user_wait_wall = sum(ask_durations)

    # Build top-N readable lists from the wider counters.
    top_tool_payloads = sorted(
        ({"tool": t, "bytes": b} for t, b in tool_payload_bytes.items()),
        key=lambda r: r["bytes"],
        reverse=True,
    )[:10]
    duplicate_reads = [{"path": p, "count": c} for p, c in read_file_paths.most_common(20) if c > 1]

    metadata = next((span for span in native if span.get("name") == "NativeLogMetadata"), {})
    executions = [span["_sdk_execution"] for span in native if "_sdk_execution" in span]
    return {
        "native_evidence": {
            "format": "copilot-sdk" if native else "historical",
            "session_id": metadata.get("_sdk_session", {}).get("sessionId"),
            "session_closed": metadata.get("_sdk_capture_closed", False),
            "worker_count": len({span["_sdk_agent_id"] for span in native if span.get("_jsonl_subagent")}),
            "max_chat_calls_per_worker": max(worker_chat_counts.values(), default=None),
            "execution_requests": executions,
            "incomplete_operations": sum(bool(span.get("_sdk_incomplete")) for span in native),
            "external_tool_outcomes_unknown": sum(bool(span.get("_sdk_unknown_external_outcome")) for span in native),
            "unattributed_usage": sum(bool(span.get("_sdk_unattributed_usage")) for span in native),
            "unknown_models": sum(span.get("name") == "chat:unknown" for span in native),
            "duplicate_events": metadata.get("_sdk_duplicate_events", 0),
            "duplicate_usage_records": metadata.get("_sdk_duplicate_usage", 0),
        },
        "usage_coverage": {
            "input_samples": input_samples,
            "output_samples": output_samples,
            "chat_calls": total_calls,
            "complete": total_calls > 0 and input_samples == output_samples == total_calls,
            "duplicate_exported_spans": duplicate_exported_spans,
            "scope": "Observed chat spans only; missing child requests, cache billing and semantic parent rollups are not inferred.",
        },
        "observed_cache_tokens": {
            "read": sum(cache_reads) if cache_reads else None,
            "write": sum(cache_writes) if cache_writes else None,
            "read_samples": len(cache_reads),
            "write_samples": len(cache_writes),
        },
        "totals": {
            "input_tokens": total_input,
            "output_tokens": total_output,
            "chat_calls": total_calls,
            "avg_input_per_call": avg_in,
            "p50_input_per_call": p50_in,
            "max_input_per_call": max_input_per_call,
            "askquestions_count": len(ask_durations),
            "subagent_invocations": len(subagent_calls),
            "challenger_invocations": sum(1 for c in subagent_calls if c["name"] == "challenger-review-subagent"),
            "error_spans_total": error_spans_raw_count,
            "error_spans_non_benign": len(error_spans),
            "pricing_learn_calls": pricing_learn_calls,
            "tool_stalls_over_60s": tool_stalls_over_60s,
        },
        "wall_time_s": {
            "session_total": round(session_wall, 1),
            "agent_chat": round(agent_chat_wall, 1),
            "agent_chat_union": round(_interval_union_s(chat_intervals_ns), 1),
            "tool_execution_union": round(_interval_union_s(tool_intervals_ns), 1),
            "subagent": round(subagent_wall, 1),
            "user_wait_askquestions": round(user_wait_wall, 1),
        },
        "tokens_by_model": {
            m: {
                "input": row["input"],
                "output": row["output"],
                "calls": row["calls"],
                "input_samples": row["input_samples"],
                "output_samples": row["output_samples"],
                "avg_input_per_call": round(row["input"] / row["input_samples"]) if row["input_samples"] else 0,
            }
            for m, row in tokens_by_model.items()
        },
        "input_token_buckets": dict(input_buckets),
        "tool_call_counts": dict(tool_calls.most_common()),
        "top_tool_payloads": top_tool_payloads,
        "duplicate_reads": duplicate_reads,
        "subagent_calls": subagent_calls,
        "errors": error_spans,
        "warnings": warnings,
        "compliance_metrics": {
            "max_chat_spans_between_clears": None if native else inter_boundary_max,
            "max_askquestions_in_single_phase": None if native else ask_per_phase_max,
        },
    }


def render_text(metrics: dict[str, Any], path: Path) -> str:
    """Human-readable summary; the JSON form remains the source of truth."""
    lines: list[str] = []
    t = metrics["totals"]
    w = metrics["wall_time_s"]
    lines.append(f"# profile: {path}")
    lines.append("")
    lines.append("## Totals")
    lines.append("  Observed usage only; see usage_coverage in JSON before comparing complete workflows.")
    lines.append(f"  input_tokens         : {t['input_tokens']:>12,}")
    lines.append(f"  output_tokens        : {t['output_tokens']:>12,}")
    lines.append(f"  chat_calls           : {t['chat_calls']:>12,}")
    lines.append(f"  avg_input_per_call   : {t['avg_input_per_call']:>12,}")
    lines.append(f"  p50_input_per_call   : {t['p50_input_per_call']:>12,}")
    lines.append(f"  max_input_per_call   : {t['max_input_per_call']:>12,}")
    lines.append(f"  askquestions         : {t['askquestions_count']:>12}")
    lines.append(f"  subagent_invocations : {t['subagent_invocations']:>12}")
    lines.append(f"  challenger_invokes   : {t['challenger_invocations']:>12}")
    lines.append(f"  errors (total)       : {t['error_spans_total']:>12}")
    lines.append(f"  errors (non-benign)  : {t['error_spans_non_benign']:>12}")
    lines.append("")
    lines.append("## Wall time (s)")
    for k, v in w.items():
        lines.append(f"  {k:<22}: {v:>10}")
    lines.append("")
    lines.append("## Tokens by model")
    for m, row in metrics["tokens_by_model"].items():
        lines.append(
            f"  {m:<22}: in={row['input']:>10,}  out={row['output']:>8,}  "
            f"calls={row['calls']:>4}  avg_in={row['avg_input_per_call']:>8,}",
        )
    lines.append("")
    lines.append("## Input-token buckets")
    for bucket, count in metrics["input_token_buckets"].items():
        lines.append(f"  {bucket:<10}: {count}")
    if metrics["duplicate_reads"]:
        lines.append("")
        lines.append("## Duplicate file reads")
        for entry in metrics["duplicate_reads"]:
            lines.append(f"  {entry['count']:>3}x  {entry['path']}")
    if metrics["errors"]:
        lines.append("")
        lines.append("## Errors (non-benign)")
        for e in metrics["errors"][:10]:
            lines.append(f"  {e['span_name']}  tool={e['tool']}  msg={e['message'][:80]}")
    if metrics["warnings"]:
        lines.append("")
        lines.append("## Warnings")
        for w_msg in metrics["warnings"]:
            lines.append(f"  ! {w_msg}")
    return "\n".join(lines)


def probe_evidence(spans: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize observed events without exporting instructions or tool payloads."""
    calls = []
    tools = []
    seen = {}
    duplicates = 0
    conflicts = 0
    for span in spans:
        identity = (span.get("traceId"), span.get("spanId"))
        if all(identity):
            fingerprint = hashlib.sha256(json.dumps(span, sort_keys=True).encode("utf-8")).hexdigest()
            if seen.get(identity) == fingerprint:
                duplicates += 1
                continue
            if identity in seen:
                conflicts += 1
            seen[identity] = fingerprint
        attributes = _attrs(span)
        operation = attributes.get("gen_ai.operation.name")
        timestamp = _token_count(span.get("startTimeUnixNano"))
        if operation == "chat":
            calls.append({"model": attributes.get("gen_ai.request.model"), "start_time_ns": timestamp})
        elif operation == "execute_tool":
            tools.append(
                {
                    "tool": attributes.get("gen_ai.tool.name") or span.get("name"),
                    "start_time_ns": timestamp,
                    "invocation_attribution": "unknown",
                }
            )
    first_chat = min((call["start_time_ns"] for call in calls if call["start_time_ns"] is not None), default=None)
    for tool in tools:
        start = tool["start_time_ns"]
        tool["before_first_model_request"] = (
            start < first_chat if start is not None and first_chat is not None else None
        )
    return {
        "model_requests": calls,
        "tool_events": tools,
        "duplicate_spans_omitted": duplicates,
        "conflicting_span_ids": conflicts,
        "prompt_response_source": "not extracted",
        "verdict": "requires review",
        "limitations": [
            "Timing does not establish whether a tool was invoked by the model or harness.",
            "Missing events do not prove export completeness or successful workflow enforcement.",
            "Model and tool names remain visible; review all output before sharing.",
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("log", type=Path, help="Path to OTel debug log JSON")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text")
    parser.add_argument("--probe-evidence", action="store_true", help="Emit payload-free probe evidence as JSON")
    parser.add_argument("--reviewed-prompt", type=Path, help="Separately supplied, manually redacted prompt text")
    parser.add_argument("--reviewed-response", type=Path, help="Separately supplied, manually redacted response text")
    parser.add_argument(
        "--max-spans-between-clears",
        type=int,
        default=50,
        help="Warn when chat-span count between SessionStart/Stop exceeds N (default: 50)",
    )
    parser.add_argument(
        "--max-askquestions-per-phase",
        type=int,
        default=3,
        help="Warn when askQuestions count between turn_start:N markers exceeds N (default: 3)",
    )
    args = parser.parse_args(argv)
    if bool(args.reviewed_prompt) != bool(args.reviewed_response):
        parser.error("--reviewed-prompt and --reviewed-response must be supplied together")
    if args.reviewed_prompt and not args.probe_evidence:
        parser.error("reviewed text requires --probe-evidence")

    try:
        spans = load_spans(args.log)
        if args.probe_evidence:
            evidence = probe_evidence(spans)
            evidence["log_sha256"] = hashlib.sha256(args.log.read_bytes()).hexdigest()
            if args.reviewed_prompt:
                evidence["supplied_text"] = {
                    "source": "separately supplied; redaction and matching asserted by operator, not verified",
                    "prompt": args.reviewed_prompt.read_text(encoding="utf-8"),
                    "response": args.reviewed_response.read_text(encoding="utf-8"),
                }
            json.dump(evidence, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
            return 0
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    metrics = profile(
        spans,
        max_spans_between_clears=args.max_spans_between_clears,
        max_askquestions_per_phase=args.max_askquestions_per_phase,
    )

    if args.json:
        json.dump(metrics, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        print(render_text(metrics, args.log))
    return 0


if __name__ == "__main__":
    sys.exit(main())
