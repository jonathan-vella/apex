"""apex-recall review-audit — manage review_audit entries."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

from ..input_digest import inputs_digest
from ..state_writer import (
    _iso_now,
    check_state_revision,
    migrate_to_v3,
    read_state,
    session_state_path,
    validate_step_key,
    workspace_root_for,
    write_state,
)


def _register_native_request(
    requests: dict[str, dict],
    *,
    request_id: object,
    call_id: object,
    timestamp: object,
    source: str,
) -> None:
    if not isinstance(request_id, str) or not request_id:
        raise ValueError("Native review dispatch has no request ID")
    if not isinstance(call_id, str) or not call_id:
        raise ValueError("Native review dispatch has no toolCallId")
    existing = requests.get(request_id)
    if existing is not None:
        if existing["call"] != call_id or source in existing["sources"]:
            raise ValueError(f"Ambiguous duplicate native request ID: {request_id}")
        if (
            isinstance(timestamp, str)
            and timestamp
            and (not existing["timestamp"] or timestamp < existing["timestamp"])
        ):
            existing["timestamp"] = timestamp
        existing["sources"].add(source)
        return
    requests[request_id] = {
        "call": call_id,
        "timestamp": timestamp if isinstance(timestamp, str) else None,
        "sources": {source},
    }


def _parse_native_review_prompt(
    prompt: object,
    *,
    target_project: str,
    target_step: str,
    root: Path | None = None,
) -> dict | None:
    if not isinstance(prompt, str):
        return None
    if prompt.startswith("APEX_REVIEW\n"):
        parsed = json.loads(prompt.removeprefix("APEX_REVIEW\n"))
        if not isinstance(parsed, dict):
            return None
        if parsed.get("project_name") != target_project or parsed.get("step") != target_step:
            return None
        return parsed
    if prompt.startswith("APEX_REVIEW_FILE\n"):
        envelope = json.loads(prompt.removeprefix("APEX_REVIEW_FILE\n"))
        if not isinstance(envelope, dict):
            return None
        req_id = envelope.get("request_id")
        proj = envelope.get("project_name")
        stp = envelope.get("step")
        depth = envelope.get("review_depth")
        req_path = envelope.get("request_path")
        req_sha = envelope.get("request_sha256")
        if (
            not all(isinstance(v, str) and v for v in (req_id, proj, stp, req_path))
            or depth not in ("default", "deep")
            or not isinstance(req_sha, str)
            or re.fullmatch(r"[0-9a-f]{64}", req_sha) is None
            or "\\" in req_path
            or req_path.startswith("/")
            or any(part in ("", ".", "..") for part in req_path.split("/"))
            or not req_path.startswith(f"agent-output/{proj}/_meta/")
        ):
            raise ValueError("Invalid APEX_REVIEW_FILE native review envelope")
        if proj != target_project or stp != target_step:
            return None
        base = (root or workspace_root_for()).resolve()
        cursor = base
        exists_all = True
        for part in req_path.split("/"):
            cursor = cursor / part
            if cursor.is_symlink():
                raise ValueError("Symlinked APEX_REVIEW_FILE request_path in native review dispatch")
            if not cursor.exists():
                exists_all = False
                break
        if exists_all and cursor.is_file():
            raw_bytes = cursor.read_bytes()
            if hashlib.sha256(raw_bytes).hexdigest() != req_sha:
                raise ValueError("APEX_REVIEW_FILE request_sha256 mismatch in native review dispatch")
            loaded = json.loads(raw_bytes.decode("utf-8"))
            if (
                not isinstance(loaded, dict)
                or loaded.get("request_id") != req_id
                or loaded.get("project_name") != proj
                or loaded.get("step") != stp
                or loaded.get("review_depth") != depth
            ):
                raise ValueError("APEX_REVIEW_FILE header fields differ from saved review request")
            return loaded
        return envelope
    return None


def reconcile_events(events_path: Path, attempts: list[dict], project: str, step: str) -> dict:
    """Report native lifecycle evidence without editing or backdating the ledger."""
    root = workspace_root_for()
    requests: dict[str, dict] = {}
    outcomes: dict[str, bool] = {}
    hook_pre_starts: dict[str, list[tuple[str, dict]]] = {}
    hook_pre_ok: set[str] = set()
    hook_post_starts: dict[str, tuple[str, bool]] = {}
    hook_post_ok: set[str] = set()
    subagent_starts: set[str] = set()
    subagent_completes: set[str] = set()
    with events_path.open(encoding="utf-8") as source:
        for line in source:
            event = json.loads(line)
            data = event.get("data", {})
            etype = event.get("type")
            if etype == "tool.execution_start" and data.get("toolName") == "task":
                args = data.get("arguments", {})
                prompt = args.get("prompt", "")
                if args.get("agent_type") != "challenger-review-subagent":
                    continue
                request = _parse_native_review_prompt(prompt, target_project=project, target_step=step, root=root)
                if request is not None:
                    _register_native_request(
                        requests,
                        request_id=request.get("request_id"),
                        call_id=data.get("toolCallId"),
                        timestamp=event.get("timestamp"),
                        source="task",
                    )
            elif etype == "tool.execution_complete":
                cid = data.get("toolCallId")
                if isinstance(cid, str) and cid:
                    outcomes[cid] = data.get("success") is True
            elif etype == "hook.start" and (event.get("agentId") or "root") == "root":
                inv_id = data.get("hookInvocationId")
                hook_type = data.get("hookType")
                inp = data.get("input") if isinstance(data.get("input"), dict) else {}
                if hook_type == "preToolUse" and isinstance(inv_id, str) and inv_id:
                    for tc in inp.get("toolCalls") or []:
                        if not isinstance(tc, dict) or tc.get("name") != "task":
                            continue
                        args = tc.get("args") if isinstance(tc.get("args"), dict) else {}
                        prompt = args.get("prompt", "")
                        if (
                            args.get("agent_type") == "challenger-review-subagent"
                            and isinstance(prompt, str)
                            and (prompt.startswith("APEX_REVIEW\n") or prompt.startswith("APEX_REVIEW_FILE\n"))
                        ):
                            hook_pre_starts.setdefault(inv_id, []).append(
                                (event.get("timestamp") or "", {"call": tc.get("id"), "prompt": prompt})
                            )
                elif (
                    hook_type == "postToolUse" and isinstance(inv_id, str) and inv_id and inp.get("toolName") == "task"
                ):
                    call_id = inp.get("toolCallId")
                    res_ok = (
                        isinstance(inp.get("toolResult"), dict) and inp["toolResult"].get("resultType") == "success"
                    )
                    if isinstance(call_id, str) and call_id:
                        hook_post_starts[inv_id] = (call_id, res_ok)
            elif etype == "hook.end" and (event.get("agentId") or "root") == "root" and data.get("success") is True:
                inv_id = data.get("hookInvocationId")
                if data.get("hookType") == "preToolUse" and isinstance(inv_id, str):
                    hook_pre_ok.add(inv_id)
                elif data.get("hookType") == "postToolUse" and isinstance(inv_id, str):
                    hook_post_ok.add(inv_id)
            elif etype == "subagent.started" and data.get("agentName") == "challenger-review-subagent":
                if (
                    data.get("parentId") is None
                    and data.get("executionMode") == "sync"
                    and data.get("resumable") is False
                ):
                    cid = data.get("toolCallId")
                    if isinstance(cid, str) and cid:
                        subagent_starts.add(cid)
            elif etype == "subagent.completed" and data.get("agentName") == "challenger-review-subagent":
                cid = data.get("toolCallId")
                if isinstance(cid, str) and cid:
                    subagent_completes.add(cid)

    for inv_id, entries in hook_pre_starts.items():
        if inv_id not in hook_pre_ok:
            continue
        for ts, info in entries:
            call_id = info["call"]
            if not isinstance(call_id, str) or call_id not in subagent_starts:
                continue
            request = _parse_native_review_prompt(info["prompt"], target_project=project, target_step=step, root=root)
            if request is not None:
                _register_native_request(
                    requests,
                    request_id=request.get("request_id"),
                    call_id=call_id,
                    timestamp=ts,
                    source="root_hook",
                )
    for inv_id, (call_id, res_ok) in hook_post_starts.items():
        if call_id not in outcomes and inv_id in hook_post_ok and call_id in subagent_completes:
            outcomes[call_id] = res_ok
    records = []
    for request_id, native in requests.items():
        history = [attempt for attempt in attempts if attempt.get("id") == request_id and attempt.get("step") == step]
        recorded = history[-1]["outcome"] if history else "missing"
        task_outcome = outcomes.get(native["call"])
        expected = "unknown" if task_outcome is None else "completed" if task_outcome else "failed"
        starts = [attempt for attempt in history if attempt.get("outcome") == "started"]
        timing = "unknown"
        if starts and starts[0].get("recorded_at") and native["timestamp"]:
            try:
                timing = (
                    "before_dispatch"
                    if datetime.fromisoformat(starts[0]["recorded_at"]) <= datetime.fromisoformat(native["timestamp"])
                    else "retrospective"
                )
            except ValueError:
                timing = "unknown"
        records.append(
            {
                "request_id": request_id,
                "tool_call_id": native["call"],
                "native_dispatch_at": native["timestamp"],
                "task_outcome": expected,
                "recorded_outcome": recorded,
                "start_timing": timing,
                "gap": not history or recorded == "started" or recorded != expected or timing != "before_dispatch",
                "publication_status": "not_established_by_task_completion",
                "input_equivalence": "not_established_by_task_completion",
            }
        )
    return {
        "project": project,
        "step": step,
        "read_only": True,
        "permission_granted": False,
        "scope": "Supplied capture only; missing events are not proof an operation never ran.",
        "requests": records,
        "ledger_without_native_dispatch": sorted(
            {
                attempt["id"]
                for attempt in attempts
                if attempt.get("step") == step
                and attempt.get("kind") in ("invocation", "empty-output-retry", "publication-retry")
                and attempt["id"] not in requests
            }
        ),
    }


def run(args) -> int:
    project = args.project
    step = validate_step_key(args.step)
    as_json = getattr(args, "json", False)

    complexity = getattr(args, "complexity", None)
    passes_planned = getattr(args, "passes_planned", None)
    passes_executed = getattr(args, "passes_executed", None)
    models = getattr(args, "model", None) or []
    skips = getattr(args, "skip", None) or []
    skip_reasons = getattr(args, "skip_reason", None) or []

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)
    events_path = getattr(args, "reconcile_events", None)
    if events_path is not None:
        if any(
            getattr(args, name, None) not in (None, [])
            for name in (
                "attempt_id",
                "attempt_kind",
                "input_digest",
                "attempt_input",
                "attempt_outcome",
                "review_output",
                "retry_of",
                "complexity",
                "passes_planned",
                "passes_executed",
                "model",
                "skip",
                "skip_reason",
            )
        ):
            raise ValueError("Read-only reconciliation cannot be combined with audit mutations")
        result = reconcile_events(events_path, data.get("review_attempts", []), project, step)
        check_state_revision(data, path)
        print(json.dumps(result))
        return 0
    from ..practical import prepare_cycle, select_cycle_result

    prepared = (
        prepare_cycle(project, data, args)
        if getattr(args, "attempt_id", None) or getattr(args, "review_request", None)
        else None
    )
    attempt_id = getattr(args, "attempt_id", None)
    review_output = getattr(args, "review_output", None)
    attempt_options = [
        getattr(args, name, None) for name in ("attempt_kind", "input_digest", "attempt_outcome", "retry_of")
    ]
    attempt_inputs = getattr(args, "attempt_input", None) or []
    if attempt_id is not None or any(attempt_options) or attempt_inputs or review_output is not None:
        kind, digest, outcome, retry_of = attempt_options
        if attempt_inputs:
            if digest:
                raise ValueError("Use --input-digest or --attempt-input, not both")
            digest = inputs_digest(workspace_root_for(), attempt_inputs)
        if (
            not attempt_id
            or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", attempt_id)
            or kind not in ("invocation", "repair", "empty-output-retry", "publication-retry")
            or not re.fullmatch(r"[a-f0-9]{64}", digest or "")
            or outcome not in ("started", "completed", "failed", "unknown")
        ):
            raise ValueError("Attempt ID, kind, input digest and outcome are required")
        if review_output is not None and (
            review_output not in ("empty", "nonempty", "unknown")
            or kind not in ("invocation", "empty-output-retry", "publication-retry")
            or outcome not in ("completed", "failed")
        ):
            raise ValueError("Reviewer output is recorded only with a completed or failed native review attempt")
        attempts = data.setdefault("review_attempts", [])
        previous = [attempt for attempt in attempts if attempt["id"] == attempt_id]
        if previous and any(
            attempt[key] != value
            for attempt in previous
            for key, value in (("step", step), ("kind", kind), ("input_digest", digest), ("retry_of", retry_of))
        ):
            raise ValueError("Attempt identity cannot be reused for different inputs, kind or step")
        if previous and previous[-1]["outcome"] == outcome:
            if previous[-1].get("review_output") != review_output:
                raise ValueError("Terminal reviewer output cannot be rewritten; reconcile explicitly with the owner")
            if getattr(args, "review_result", None) is not None:
                select_cycle_result(project, data, args, prepared)
                write_state(project, data)
            else:
                check_state_revision(data, path)
            print(json.dumps({"outcome": "already_applied", "attempt_id": attempt_id, "input_digest": digest}))
            return 0
        if previous and previous[-1]["outcome"] != "started":
            raise ValueError(
                "Terminal or unknown attempt outcomes cannot be rewritten; reconcile explicitly with the owner"
            )
        if not previous and outcome != "started":
            raise ValueError("Record attempt start before its outcome")
        if kind == "empty-output-retry":
            originals = [attempt for attempt in attempts if attempt["id"] == retry_of]
            if originals and (originals[-1]["kind"] != "invocation" or originals[-1]["step"] != step):
                raise ValueError(
                    "Retry must reference an original invocation in the same step; retry chains are forbidden"
                )
            original = originals[-1] if originals else {}
            legacy_failed = original.get("outcome") == "failed" and "review_output" not in original
            empty_output = (
                original.get("outcome") in ("completed", "failed") and original.get("review_output") == "empty"
            )
            if original.get("input_digest") != digest or not (legacy_failed or empty_output):
                raise ValueError(
                    "Retry requires empty reviewer output from a terminal original with identical input digest"
                )
            if not previous and any(attempt.get("retry_of") == retry_of for attempt in attempts):
                raise ValueError("Identical-input retry already recorded; allowance cannot reset")
        elif kind == "publication-retry":
            if not prepared:
                raise ValueError("publication-retry requires --review-request")
            originals = [attempt for attempt in attempts if attempt["id"] == retry_of]
            if not originals or originals[-1]["kind"] != "invocation" or originals[-1]["step"] != step:
                raise ValueError(
                    "Publication retry must reference an original invocation in the same step; retry chains are forbidden"
                )
            original = originals[-1]
            live_inputs = [
                prepared["request"]["artifact_path"],
                *(item["path"] for item in prepared["request"].get("supporting_inputs", [])),
            ]
            live_digest = inputs_digest(workspace_root_for(), live_inputs)
            if (
                original.get("outcome") != "completed"
                or original.get("review_output") != "nonempty"
                or original.get("input_digest") != digest
                or live_digest != digest
            ):
                raise ValueError(
                    "Publication retry requires a completed nonempty invocation and unchanged input bytes on disk"
                )
            if not previous and any(attempt.get("retry_of") == retry_of for attempt in attempts):
                raise ValueError("Retry already recorded for this invocation; allowance cannot reset")
        elif retry_of is not None and not prepared:
            raise ValueError("retry-of is only valid for empty-output-retry or publication-retry attempts")
        select_cycle_result(project, data, args, prepared)
        attempts.append(
            {
                "schema_version": "review-attempt-v1",
                "id": attempt_id,
                "step": step,
                "kind": kind,
                "input_digest": digest,
                "outcome": outcome,
                **({"review_output": review_output} if review_output is not None else {}),
                **({"output_path": prepared["request"]["output_path"]} if prepared else {}),
                "retry_of": retry_of,
                "recorded_at": _iso_now(),
                **({"cycle_id": prepared["key"]} if prepared else {}),
            }
        )
        write_state(project, data)
        # `authorization` is kept for existing readers; this record is evidence only and permits nothing.
        print(
            json.dumps(
                {
                    "attempt_id": attempt_id,
                    "outcome": outcome,
                    **({"review_output": review_output} if review_output is not None else {}),
                    "input_digest": digest,
                    "permission_granted_by_this_record": False,
                    "authorization": "not_granted",
                }
            )
        )
        return 0

    audit_key = f"step_{step}"
    ra = data.setdefault("review_audit", {})
    entry = ra.setdefault(
        audit_key,
        {
            "complexity": "",
            "passes_planned": 0,
            "passes_executed": 0,
            "skipped": [],
            "skip_reasons": [],
            "models_used": [],
        },
    )

    if complexity is not None:
        entry["complexity"] = complexity
    if passes_planned is not None:
        entry["passes_planned"] = passes_planned
    if passes_executed is not None:
        if passes_executed < entry.get("passes_executed", 0):
            raise ValueError("Recorded executed review count cannot decrease")
        entry["passes_executed"] = passes_executed

    # Append models (deduplicated)
    for m in models:
        if m not in entry.setdefault("models_used", []):
            entry["models_used"].append(m)

    # Append skip pass numbers
    for s in skips:
        s_int = int(s)
        if s_int not in entry.setdefault("skipped", []):
            entry["skipped"].append(s_int)

    # Append skip reasons
    for sr in skip_reasons:
        entry.setdefault("skip_reasons", []).append(sr)

    ra[audit_key] = entry
    data["review_audit"] = ra

    write_state(project, data)

    result = {"project": project, "step": step, "audit_key": audit_key, "entry": entry}
    if as_json:
        print(json.dumps(result))
    else:
        print(f"Review audit updated: {project} {audit_key}")

    return 0
