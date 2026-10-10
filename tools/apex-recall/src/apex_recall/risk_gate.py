"""Read-only review and risk gates shared by completion, entry, resume and CI."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

from .state_writer import StateDocument, check_state_revision, file_revision, read_state, session_state_path

ACTIONS = ("plan-complete", "codegen", "code-complete", "deploy", "deployment-complete", "teardown-complete")
COMPLETION_ACTIONS = {"4": "plan-complete", "5": "code-complete", "6": "deployment-complete"}
ENTRY_ACTIONS = {"5": "codegen", "6": "deploy", "7": "deployment-complete"}


def _stored_record(data: dict, action: str) -> dict | None:
    records = data.get("risk_authorizations", {})
    predecessor = {
        "code-complete": "codegen",
        "deployment-complete": "deploy",
        "teardown-complete": "deployment-complete",
    }
    return records.get(action) or records.get(predecessor.get(action)) or records.get("plan-complete")


def evaluate_gate(
    project: str,
    data: StateDocument,
    action: str,
    args: object | None = None,
    *,
    selected: Path | None = None,
    require_approval: bool = True,
    completing_plan: bool = False,
    completing_code: bool = False,
    review_cache: dict | None = None,
) -> dict:
    from .commands.complete_step import (
        _challenger_findings_invalid,
        _challenger_findings_missing,
        _review_paths,
        _select_replacement_review,
        watch_review_inputs,
    )

    args = args or SimpleNamespace()
    root = session_state_path(project).parent.parent.parent
    explicit = getattr(args, "risk_authorization", None)
    stored = _stored_record(data, action)
    authorization = explicit or (stored or {}).get("authorization", {}).get("path")
    approval = getattr(args, "risk_approval", None) or ((stored or {}).get("approval") or {}).get("path")
    context = getattr(args, "deployment_context", None) or ((stored or {}).get("context") or {}).get("path")
    if not require_approval:
        approval = None
    if not authorization and (approval or context):
        raise ValueError("Risk approval/context requires explicit authorization")
    if authorization and getattr(args, "allow_missing_challenger", False):
        raise ValueError("Risk authorization cannot combine with the missing-review bypass")
    if selected is None:
        selected, selection = _select_replacement_review(project, "4", SimpleNamespace(), data)
    watch_review_inputs(data, project, "4", selected)
    missing, _, _ = _challenger_findings_missing(project, "4", selected)
    audited_skip = (
        not authorization
        and not selected
        and any(
            isinstance(skip, dict)
            and skip.get("step") == "4"
            and isinstance(skip.get("reason"), str)
            and skip["reason"].strip()
            for skip in data.get("decisions", {}).get("challenger_skip", [])
        )
    )
    if missing and not audited_skip:
        raise ValueError("Required Plan review missing; risk authorization cannot waive review presence")
    cache_key = (str(selected), bool(authorization))
    if review_cache is not None and cache_key in review_cache:
        invalid = review_cache[cache_key]
    else:
        invalid = _challenger_findings_invalid(project, "4", selected, bool(authorization))
        if review_cache is not None:
            review_cache[cache_key] = invalid
    if invalid:
        raise ValueError(invalid)
    if not authorization:
        check_state_revision(data, session_state_path(project))
        return {
            "status": "current",
            "action": action,
            "unresolved_findings": [],
            "review_skip": bool(missing and audited_skip),
        }
    if data.get("decisions", {}).get("review_depth") == "deep":
        raise ValueError("risk-authorization-v1 supports default comprehensive Plan reviews only")
    if not explicit and stored:
        for field in ("authorization", "approval", "context"):
            ref = stored.get(field)
            if ref and file_revision(root / ref["path"]) != ref["sha256"]:
                raise ValueError(f"Stored risk {field} bytes changed; explicit owner resolution required")
    evaluator = root / "tools/scripts/evaluate-risk-authorization.mjs"
    schema = root / "tools/schemas/risk-authorization.schema.json"
    if not evaluator.is_file() or not schema.is_file():
        raise ValueError("Required authorization evaluator/schema unavailable")
    data.input_revisions.update({path: file_revision(path) for path in (evaluator, schema)})
    request = {
        "root": str(root),
        "project": project,
        "action": action,
        "authorization": authorization,
        "approval": approval,
        "context": context,
        "reviews": [str(sidecar) for _, sidecar in _review_paths(project, "4", selected)],
        "preserved_reviews": [str(root / "agent-output" / project / "challenge-findings-plan.json")]
        if selected
        else [],
        "preserved_execution": (data.get("risk_authorizations", {}).get("deployment-complete") or {}).get("execution"),
        "require_approval": require_approval,
    }
    try:
        response = subprocess.run(
            ["node", str(evaluator.resolve())],
            input=json.dumps(request),
            cwd=root,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        result = json.loads(response.stdout)
        if response.returncode or result.get("status") != "exception-authorized":
            raise ValueError(result.get("error", "Authorization verification failed"))
        for ref in result["watched_inputs"]:
            target = Path(ref["path"])
            if file_revision(target) != ref["sha256"]:
                raise ValueError("Authorization inputs changed during validation")
            data.input_revisions[target] = ref["sha256"]
        data.validation_deadlines.append(result["valid_until"])
        if require_approval and action in ("deployment-complete", "teardown-complete"):
            deployment = data.get("steps", {}).get("6", {})
            observed_start = result.get("execution_started_at")
            if (
                deployment.get("status") not in ("in_progress", "complete")
                or not deployment.get("started")
                or not observed_start
                or observed_start < deployment["started"]
            ):
                raise ValueError("Completion receipts must follow the recorded deployment execution boundary")
            execution = result.get("execution")
            if not execution:
                raise ValueError("Canonical execution identity required for lifecycle completion")
            prior_execution = (data.get("risk_authorizations", {}).get("deployment-complete") or {}).get("execution")
            if action == "teardown-complete" and (deployment.get("status") != "complete" or not prior_execution):
                raise ValueError("Teardown completion requires preserved completed deployment execution")
            if prior_execution and prior_execution != execution:
                raise ValueError("Lifecycle action cannot substitute the preserved completed deployment execution")
        if (
            require_approval
            and action != "plan-complete"
            and not (
                data.get("steps", {}).get("4", {}).get("status") == "complete"
                or completing_plan
                and action == "codegen"
            )
        ):
            raise ValueError("Exception-authorized downstream action still requires completed Step 4")
        if (
            require_approval
            and action in ("deploy", "deployment-complete", "teardown-complete")
            and not (
                data.get("steps", {}).get("5", {}).get("status") == "complete" or completing_code and action == "deploy"
            )
        ):
            raise ValueError("Lab deployment still requires completed CodeGen and its existing validation gates")
        result["record"] = {
            "schema_version": "risk-selection-v1",
            "authorization": result["authorization"],
            "approval": result["approval"],
            "execution": result.get("execution"),
            "context": {
                "path": str(Path(context).relative_to(root)) if Path(context).is_absolute() else context,
                "sha256": file_revision(root / context),
            }
            if context
            else None,
        }
        check_state_revision(data, session_state_path(project))
        return result
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        raise ValueError(f"Risk authorization unavailable or invalid: {error}") from error


def record_authorization(data: dict, result: dict | None, now: str) -> None:
    if result and result.get("status") == "exception-authorized":
        record = result["record"]
        records = data.setdefault("risk_authorizations", {})
        if records.get(result["action"]) != record:
            records[result["action"]] = record
            if result["action"] == "plan-complete":
                data.setdefault("decisions", {})["plan_status"] = "EXCEPTION_AUTHORIZED"
            data.setdefault("decision_log", []).append(
                {
                    "id": f"D{len(data.get('decision_log', [])) + 1:03d}",
                    "step": 4,
                    "agent": "apex-recall",
                    "title": "Explicit lab risk authorization",
                    "choice": "EXCEPTION_AUTHORIZED",
                    "rationale": "Verified external authority and separate human approval; findings remain unresolved",
                    "decision": "Risk gate exception-authorized; findings remain unresolved",
                    "action": result["action"],
                    "authorization": record["authorization"],
                    "timestamp": now,
                }
            )


def check_entry(
    project: str, data: StateDocument, step: str, args: object, *, completing_code: bool = False
) -> dict | None:
    action = ENTRY_ACTIONS.get(step)
    if not action:
        return None
    if not data.get("risk_authorizations") and not getattr(args, "risk_authorization", None):
        return None
    if step == "7" and data.get("steps", {}).get("6", {}).get("status") != "complete":
        raise ValueError("Exception-bearing As-Built entry requires completed deployment")
    result = evaluate_gate(project, data, action, args, completing_code=completing_code)
    if result["status"] == "exception-authorized" and data.get("steps", {}).get("4", {}).get("status") != "complete":
        raise ValueError("Exception-authorized downstream entry still requires completed Step 4")
    return result


def ordinary_entry_warning(project: str, data: StateDocument, step: str) -> str | None:
    """Warn-only freshness note for projects without a lab exception; never blocks."""
    if step not in ("5", "6") or data.get("risk_authorizations"):
        return None
    if not (session_state_path(project).parent / "04-implementation-plan.md").exists():
        return None
    watched = dict(data.input_revisions)
    try:
        evaluate_gate(project, data, ENTRY_ACTIONS[step])
    except (OSError, ValueError) as error:
        return f"Plan review is not current (warning only): {' '.join(str(error).split())[:220]}"
    finally:
        data.input_revisions.clear()
        data.input_revisions.update(watched)
    return None


def run(args: object) -> int:
    project = args.project
    data = read_state(session_state_path(project))
    try:
        result = evaluate_gate(project, data, args.action, args, require_approval=not args.authorization_only)
        public = {key: value for key, value in result.items() if key not in ("record", "watched_inputs")}
        print(json.dumps(public))
        return 0
    except ValueError as error:
        print(json.dumps({"status": "blocked", "action": args.action, "error": str(error)}))
        return 2
