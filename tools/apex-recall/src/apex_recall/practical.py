"""Scoped decisions and derived views for explicitly adopted practical workflows."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

from .state_writer import (
    _iso_now,
    check_state_revision,
    file_revision,
    project_dir,
    resolve_contract_path,
    resolve_meta_path,
    resolve_project_file,
    resolve_review_path,
    session_state_path,
    workspace_root_for,
)

CONTRACT = "practical-v1"
MECHANICAL_REPAIRS = frozenset({"render", "cross-reference", "schema", "count"})
MARKER = "<!-- recall-assessment:"


def digest(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


def enabled(data: dict) -> bool:
    contract = data.get("decisions", {}).get("workflow_contract")
    if contract not in (None, "", CONTRACT):
        raise ValueError(f"Unsupported workflow contract: {contract}")
    return contract == CONTRACT


def validate_state(data: dict) -> None:
    if not enabled(data):
        return
    decisions = data["decisions"]
    for key in ("material_inputs", "phase_scopes", "review_cycles", "assessment_views"):
        if not isinstance(decisions.get(key, {}), dict):
            raise ValueError(f"Invalid practical decision map: {key}")
    for key, record in material_inputs(data).items():
        if not isinstance(record, dict) or record.get("input_id") != key or not record.get("recorded_at"):
            raise ValueError("Invalid scoped material input provenance")
        validate_record({name: value for name, value in record.items() if name != "recorded_at"})
    for step, scope in decisions.get("phase_scopes", {}).items():
        if step not in ("1", "2", "3", "3_5", "4", "5", "6", "7") or not isinstance(scope, dict):
            raise ValueError("Invalid phase scope")
        if set(scope) != {"request_id", "input_ids", "environments"} or not scope["request_id"]:
            raise ValueError("Phase scope lacks approval provenance or consumed inputs")
        if (
            not isinstance(scope["input_ids"], list)
            or not scope["input_ids"]
            or not isinstance(scope["environments"], list)
            or not scope["environments"]
        ):
            raise ValueError("Phase scope requires consumed inputs and environments")
        for key in scope["input_ids"]:
            if key not in material_inputs(data) or not set(scope["environments"]) <= set(
                material_inputs(data)[key]["environments"]
            ):
                raise ValueError("Phase exceeds captured input scope")
    for cycle in decisions.get("review_cycles", {}).values():
        if (
            not isinstance(cycle, dict)
            or type(cycle.get("calls")) is not int
            or type(cycle.get("max_calls")) is not int
            or not 0 <= cycle["calls"] <= cycle["max_calls"]
            or not all(
                cycle.get(key) for key in ("step", "artifact", "lens", "initial_id", "projection", "canonical_path")
            )
        ):
            raise ValueError("Invalid consumed review cycle")
        if "current_path" in cycle and (
            Path(cycle["current_path"]).name != cycle["current_path"] or not cycle["current_path"].endswith(".json")
        ):
            raise ValueError("Current review path must be project-local JSON")


def material_inputs(data: dict) -> dict:
    return data.get("decisions", {}).get("material_inputs", {})


def validate_record(record: dict) -> None:
    required = {"input_id", "value", "environments", "owner", "request_id"}
    if not isinstance(record, dict) or set(record) != required:
        raise ValueError(f"Material input requires exactly {sorted(required)}")
    if not all(isinstance(record[key], str) and record[key].strip() for key in ("input_id", "owner", "request_id")):
        raise ValueError("Material input identity, owner and actual request provenance are required")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", record["input_id"]):
        raise ValueError("Invalid material input ID")
    if (
        not isinstance(record["environments"], list)
        or not record["environments"]
        or any(env not in ("dev", "test", "staging", "prod", "sandbox") for env in record["environments"])
    ):
        raise ValueError("Material input requires explicit supported environments")
    if len(set(record["environments"])) != len(record["environments"]):
        raise ValueError("Duplicate material-input environment")
    json.dumps(record["value"], allow_nan=False)
    if record["value"] is None or isinstance(record["value"], str) and not record["value"].strip():
        raise ValueError("A captured value is required; false and zero are valid answers")


def record_input(data: dict, record: dict) -> None:
    if not enabled(data):
        raise ValueError("Explicit practical workflow adoption is required")
    validate_record(record)
    decisions = data.setdefault("decisions", {})
    inputs = decisions.setdefault("material_inputs", {})
    previous = inputs.get(record["input_id"])
    if previous and all(previous.get(key) == value for key, value in record.items()):
        return
    if previous and previous["request_id"] == record["request_id"]:
        raise ValueError("Changed material input requires new actual owner-response provenance")
    current = {**json.loads(json.dumps(record)), "recorded_at": _iso_now()}
    inputs[record["input_id"]] = current
    data.setdefault("decision_log", []).append(
        {
            "decision": "Record scoped material input",
            "input_id": record["input_id"],
            "record": current,
            "supersedes": digest(previous) if previous else None,
            "timestamp": current["recorded_at"],
        }
    )


def grant_phase(data: dict, step: str, scope: dict) -> None:
    if not enabled(data):
        raise ValueError("Explicit practical workflow adoption is required")
    if not isinstance(scope, dict) or set(scope) != {"request_id", "input_ids", "environments"}:
        raise ValueError("Phase scope requires request_id, input_ids and environments")
    if not isinstance(scope["request_id"], str) or not scope["request_id"].strip():
        raise ValueError("Actual owner approval request provenance is required")
    if (
        not isinstance(scope["input_ids"], list)
        or not scope["input_ids"]
        or not all(isinstance(key, str) and key for key in scope["input_ids"])
    ):
        raise ValueError("Phase scope must name its consumed material inputs")
    if len(set(scope["input_ids"])) != len(scope["input_ids"]):
        raise ValueError("Duplicate phase input")
    if (
        not isinstance(scope["environments"], list)
        or not scope["environments"]
        or any(env not in ("dev", "test", "staging", "prod", "sandbox") for env in scope["environments"])
    ):
        raise ValueError("Explicit phase environments required")
    inputs = material_inputs(data)
    for key in scope["input_ids"]:
        if key not in inputs or not set(scope["environments"]) <= set(inputs[key]["environments"]):
            raise ValueError("Phase scope exceeds captured material input scope")
    existing = data.setdefault("decisions", {}).setdefault("phase_scopes", {}).get(step)
    if existing and existing != scope:
        if existing["request_id"] == scope["request_id"]:
            raise ValueError("Scope expansion requires new owner approval provenance")
        data.setdefault("decision_log", []).append(
            {
                "decision": "Explicit phase scope revision without resetting review history",
                "step": step,
                "before": existing,
                "after": scope,
                "timestamp": _iso_now(),
            }
        )
    data["decisions"]["phase_scopes"][step] = json.loads(json.dumps(scope))


def projection(data: dict, step: str) -> dict:
    scope = data.get("decisions", {}).get("phase_scopes", {}).get(step)
    if not enabled(data) or not scope:
        raise ValueError("Explicit phase scope is required")
    inputs = material_inputs(data)
    if any(key not in inputs for key in scope["input_ids"]):
        raise ValueError("Consumed material input is missing")
    return json.loads(
        json.dumps(
            {
                "contract": CONTRACT,
                "step": step,
                "scope": scope,
                "inputs": {key: inputs[key] for key in sorted(scope["input_ids"])},
            }
        )
    )


def assessment_text(view: dict) -> str:
    rows = [f"{MARKER}{view['step']} -->", f"Decision projection: `{digest(view)}`", ""]
    for key, record in view["inputs"].items():
        rows.append(
            f"- {key}: {json.dumps(record['value'], ensure_ascii=True)}; environments={','.join(record['environments'])}; owner={record['owner']}; request={record['request_id']}"
        )
    rows.append("<!-- /recall-assessment -->")
    return "\n".join(rows)


def decision_sidecar(view: dict) -> dict:
    return {
        "decisions": [
            {
                "issue_id": key,
                "action": record["value"]["action"],
                "note": record["value"].get("note", ""),
                "request_id": record["request_id"],
            }
            for key, record in view["inputs"].items()
            if isinstance(record["value"], dict) and record["value"].get("action") in ("accept", "reject", "defer")
        ],
        "projection_sha256": digest(view),
    }


def assert_routine(before: dict, after: dict, repair: str) -> None:
    if repair not in MECHANICAL_REPAIRS or before != after:
        raise ValueError("Material/unknown change cannot be published as a routine repair")


def pending_questions(data: dict, step: str, candidates: list[dict]) -> list[dict]:
    """Remove granted mechanical work and answered inputs, never a stage approval."""
    current = projection(data, step)
    questions = []
    for item in candidates:
        kind = item.get("kind")
        if kind == "routine":
            assert_routine(current, item.get("protected_after"), item.get("repair"))
        elif kind == "stage_approval":
            questions.append(item)
        elif kind == "material":
            if item.get("input_id") not in material_inputs(data):
                questions.append(item)
        else:
            raise ValueError("Question needs an explicit material, stage-approval or eligible routine purpose")
    return questions


def sync_views(project: str, data: dict, step: str) -> dict:
    """Generate consumed-decision JSON and a Markdown block; no state file is directly edited."""
    view = projection(data, step)
    directory = project_dir(project)
    target = resolve_meta_path(directory, f"assessment-step-{step}.json")
    markdown = (
        directory / "04-governance-constraints.md"
        if step == "3_5"
        else resolve_meta_path(directory, f"assessment-step-{step}.md")
    )
    text = assessment_text(view)
    existing = markdown.read_text(encoding="utf-8") if markdown.exists() else ""
    pattern = rf"<!-- recall-assessment:{re.escape(step)} -->[\s\S]*?<!-- /recall-assessment -->"
    rendered = (
        re.sub(pattern, lambda _: text, existing)
        if re.search(pattern, existing)
        else existing.rstrip() + "\n\n" + text + "\n"
    )
    outputs = [(target, json.dumps(view, indent=2, ensure_ascii=True) + "\n"), (markdown, rendered)]
    governance = resolve_contract_path(directory, "04-governance-constraints.json")
    if step == "3_5" and governance.exists():
        envelope = json.loads(governance.read_text(encoding="utf-8"))
        envelope["project_assessment"] = view
        outputs.append((governance, json.dumps(envelope, indent=2, ensure_ascii=True) + "\n"))
        decisions_path = resolve_review_path(directory, "challenge-findings-governance-constraints-decisions.json")
        if decisions_path.exists() and "projection_sha256" not in json.loads(
            decisions_path.read_text(encoding="utf-8")
        ):
            raise ValueError("Preserve legacy decision history; explicit owner migration of this view is required")
        outputs.append(
            (
                decisions_path,
                json.dumps(decision_sidecar(view), indent=2) + "\n",
            )
        )
    for file, _ in outputs:
        if file.is_symlink():
            raise ValueError("Assessment views cannot be symlinks")
        data.input_revisions[file] = file_revision(file)
    check_state_revision(data, session_state_path(project))
    for file, contents in outputs:
        file.parent.mkdir(parents=True, exist_ok=True)
        scratch = file.with_suffix(file.suffix + ".recall-scratch")
        with scratch.open("x", encoding="utf-8") as stream:
            stream.write(contents)
        scratch.replace(file)
        data.input_revisions[file] = file_revision(file)
    binding = {"projection_sha256": digest(view), "path": target.name, "markdown": markdown.name}
    data["decisions"].setdefault("assessment_views", {})[step] = binding
    return binding


def check_views(project: str, data: dict, step: str) -> None:
    if not enabled(data):
        return
    view = projection(data, step)
    binding = data["decisions"].get("assessment_views", {}).get(step)
    if not binding or binding["projection_sha256"] != digest(view):
        raise ValueError("Assessment views are missing or stale against consumed decisions")
    expected_markdown = "04-governance-constraints.md" if step == "3_5" else f"assessment-step-{step}.md"
    if Path(binding["path"]).name != f"assessment-step-{step}.json" or Path(binding["markdown"]).name != expected_markdown:
        raise ValueError("Assessment bindings must use their project-local canonical paths")
    directory = project_dir(project)
    target = resolve_project_file(directory, binding["path"])
    markdown = resolve_project_file(directory, binding["markdown"])
    for file in (target, markdown):
        if file.is_symlink():
            raise ValueError("Assessment view cannot be a symlink")
        data.input_revisions[file] = file_revision(file)
    if json.loads(target.read_text(encoding="utf-8")) != view or assessment_text(view) not in markdown.read_text(
        encoding="utf-8"
    ):
        raise ValueError("Assessment views are inconsistent; regenerate within authorized scope")
    governance = resolve_contract_path(directory, "04-governance-constraints.json")
    if step == "3_5" and governance.exists():
        data.input_revisions[governance] = file_revision(governance)
        if json.loads(governance.read_text(encoding="utf-8")).get("project_assessment") != view:
            raise ValueError("Canonical Governance JSON assessment is inconsistent")
        decisions_path = resolve_review_path(directory, "challenge-findings-governance-constraints-decisions.json")
        data.input_revisions[decisions_path] = file_revision(decisions_path)
        if not decisions_path.is_file() or json.loads(decisions_path.read_text(encoding="utf-8")) != decision_sidecar(
            view
        ):
            raise ValueError("Derived decision sidecar is stale")
    check_state_revision(data, session_state_path(project))
    scope = view["scope"]["environments"]
    readiness = action_readiness(
        data, {"4": "plan-complete", "5": "code-complete", "6": "deploy"}.get(step, f"step-{step}-complete"), scope
    )
    if readiness["status"] == "blocked":
        raise ValueError(f"Scoped readiness blocked: {readiness['holds']}")
    if step == "2":
        check_feasibility(project, data)


def adoption_report(data: dict) -> dict:
    return {
        "contract": CONTRACT,
        "already_adopted": enabled(data),
        "preserve_steps": data.get("steps", {}),
        "preserve_attempts": len(data.get("review_attempts", [])),
        "cycle_attribution_gaps": sorted(
            {
                item["id"]
                for item in data.get("review_attempts", [])
                if item["kind"] in ("invocation", "empty-output-retry") and not item.get("cycle_id")
            }
        ),
        "legacy_decisions_require_explicit_records": sorted(
            key
            for key in data.get("decisions", {})
            if key not in ("workflow_contract", "material_inputs", "phase_scopes")
        ),
        "permission_granted": False,
        "review_allowance_reset": False,
    }


def cycle_identity(request: dict) -> str:
    return digest({key: request[key] for key in ("step", "artifact_path", "review_focus", "pass_number")})


def extend_cycle(data: dict, extension: dict) -> None:
    if (
        not enabled(data)
        or not isinstance(extension, dict)
        or set(extension) != {"cycle_id", "max_calls", "request_id", "projection_sha256"}
    ):
        raise ValueError(
            "Explicit extension requires cycle_id, max_calls, current projection_sha256 and actual approval request_id"
        )
    cycle = data.get("decisions", {}).get("review_cycles", {}).get(extension["cycle_id"])
    if not cycle or type(extension["max_calls"]) is not int or extension["max_calls"] <= cycle.get("max_calls", 2):
        raise ValueError("Extension must explicitly increase an existing cycle's bound")
    if not isinstance(extension["request_id"], str) or not extension["request_id"].strip():
        raise ValueError("Owner extension approval provenance required")
    if extension["projection_sha256"] != digest(projection(data, cycle["step"])):
        raise ValueError("Extension scope does not match current consumed decisions")
    cycle["max_calls"] = extension["max_calls"]
    cycle["projection"] = extension["projection_sha256"]
    data.setdefault("decision_log", []).append(
        {
            "decision": "Explicit bounded review extension",
            **extension,
            "consumed": cycle["calls"],
            "timestamp": _iso_now(),
        }
    )


def prepare_cycle(project: str, data: dict, args: object) -> dict | None:
    request_path = getattr(args, "review_request", None)
    if not enabled(data):
        if request_path:
            raise ValueError("Review-cycle request requires explicit workflow adoption")
        return None
    if getattr(args, "attempt_kind", None) == "repair":
        return None
    if request_path is None:
        raise ValueError("Practical review attempts require the exact --review-request")
    request = json.loads(request_path.read_text(encoding="utf-8"))
    step = str(args.step)
    check_views(project, data, step)
    if request.get("project_name") != project or request.get("step") != step:
        raise ValueError("Review request project/step differs from attempt scope")
    if getattr(args, "attempt_id", None) not in (None, request.get("request_id")):
        raise ValueError("Review request identity differs from attempt")
    args.attempt_id = request["request_id"]
    if getattr(args, "input_digest", None) is None and not getattr(args, "attempt_input", None):
        args.attempt_input = [
            request["artifact_path"],
            *[item["path"] for item in request.get("supporting_inputs", [])],
        ]
    key = cycle_identity(request)
    history = data.get("review_attempts", [])
    previous = [item for item in history if item["id"] == args.attempt_id]
    cycles = data.setdefault("decisions", {}).setdefault("review_cycles", {})
    cycle = cycles.get(key)
    if args.attempt_outcome == "started" and not previous:
        binding = data["decisions"]["assessment_views"][step]
        pdir = project_dir(project)
        binding_file = resolve_project_file(pdir, binding["path"])
        binding_name = Path(binding["path"]).name
        expected_paths = {
            f"agent-output/{project}/{binding['path']}",
            f"agent-output/{project}/{binding_name}",
            f"agent-output/{project}/_meta/{binding_name}",
        }
        if not any(
            item.get("path") in expected_paths
            and item.get("sha256") == file_revision(binding_file)
            for item in request.get("supporting_inputs", [])
        ):
            raise ValueError("Review request must freeze the consumed decision projection")
        root = workspace_root_for()
        result = subprocess.run(
            [
                "node",
                str(root / "tools/scripts/record-review.mjs"),
                "--preflight",
                "--request",
                str(request_path.resolve()),
            ],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            raise ValueError(f"Review preflight failed: {result.stderr.strip()}")
        snapshot = digest(projection(data, step))
        if cycle:
            if cycle["projection"] != snapshot:
                raise ValueError("Material scope changed; owner-led cycle revision required, not an allowance reset")
            if cycle["calls"] >= cycle.get("max_calls", 2):
                raise ValueError("Review cycle exhausted; explicit bounded extension required")
            parent = getattr(args, "closure_of", None) or getattr(args, "retry_of", None)
            if parent != cycle["initial_id"]:
                raise ValueError("Closure/retry must name its original cycle attempt")
            prior = [item for item in history if item["id"] == parent]
            if not prior or prior[-1]["outcome"] not in ("completed", "failed"):
                raise ValueError("Original attempt is unfinished or unknown")
            canonical_published = (
                (root / cycle["canonical_path"]).is_file()
                or resolve_review_path(project, Path(cycle["canonical_path"]).name).is_file()
                or bool(cycle.get("current_path"))
            )
            if (
                getattr(args, "closure_of", None)
                and canonical_published
                and not isinstance(request.get("prior_findings"), list)
            ):
                raise ValueError("Closure requires prior findings, not an inferred approval")
        else:
            if any(
                item["step"] == step
                and item["kind"] in ("invocation", "empty-output-retry")
                and not item.get("cycle_id")
                for item in history
            ):
                raise ValueError(
                    "Legacy consumed attempts have no cycle attribution; explicit owner reconciliation required"
                )
            if getattr(args, "closure_of", None) or getattr(args, "retry_of", None):
                raise ValueError("Initial cycle attempt is missing")
            cycle = {
                "step": step,
                "artifact": request["artifact_path"],
                "lens": request["review_focus"],
                "pass_number": request["pass_number"],
                "canonical_path": request["output_path"],
                "initial_id": args.attempt_id,
                "projection": snapshot,
                "calls": 0,
                "max_calls": 2,
            }
            cycles[key] = cycle
        cycle["calls"] += 1
    elif not cycle:
        raise ValueError("Review cycle start is missing")
    return {"key": key, "request": request}


def select_cycle_result(project: str, data: dict, args: object, prepared: dict | None) -> None:
    result_path = getattr(args, "review_result", None)
    if result_path is None:
        return
    if not prepared or args.attempt_outcome != "completed":
        raise ValueError("Only a completed attributed practical invocation can select a result")
    root = workspace_root_for()
    target = result_path.resolve()
    directory = project_dir(project).resolve()
    if result_path.is_symlink() or target.parent not in (directory, directory / "reviews") or target.suffix != ".json":
        raise ValueError("Review result must be a regular project JSON file")
    document = json.loads(target.read_text(encoding="utf-8"))
    request = prepared["request"]
    if (
        target != (root / request["output_path"]).resolve()
        or document.get("review_execution", {}).get("request_id") != args.attempt_id
        or document.get("challenged_artifact") != request["artifact_path"]
        or document.get("review_focus") != request["review_focus"]
        or document.get("pass_number") != request["pass_number"]
    ):
        raise ValueError("Review result identity/lens differs from its recorded attempt")
    validation = subprocess.run(
        ["node", str(root / "tools/scripts/validate-challenger-findings.mjs"), "--path", str(target), "--verify-cache"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if validation.returncode:
        raise ValueError(f"Current review result invalid: {validation.stdout} {validation.stderr}")
    data.input_revisions[target] = file_revision(target)
    data["decisions"]["review_cycles"][prepared["key"]]["current_path"] = target.name


def cycle_paths(data: dict, step: str, gates: list[tuple[str, str]]) -> list[tuple[str, str]]:
    if not enabled(data):
        return gates
    cycles = data.get("decisions", {}).get("review_cycles", {}).values()
    result = []
    for artifact, sidecar in gates:
        matches = [cycle for cycle in cycles if cycle["step"] == step and Path(cycle["canonical_path"]).name == sidecar]
        if len(matches) > 1:
            raise ValueError("Ambiguous current review cycle")
        result.append((artifact, matches[0].get("current_path", sidecar) if matches else sidecar))
    return result


def action_readiness(data: dict, action: str, environments: list[str]) -> dict:
    holds = []
    for key, record in material_inputs(data).items():
        value = record["value"]
        if not isinstance(value, dict) or "blocked_actions" not in value:
            continue
        shared = value.get("shared_with", [])
        if (
            not isinstance(value["blocked_actions"], list)
            or not value["blocked_actions"]
            or not all(isinstance(item, str) and item for item in value["blocked_actions"])
            or not isinstance(value.get("release_condition"), str)
            or not value["release_condition"].strip()
            or not isinstance(shared, list)
            or any(env not in ("dev", "test", "staging", "prod", "sandbox") for env in shared)
        ):
            raise ValueError("A scoped hold requires blocked actions and a release condition")
        affected = set(record["environments"]) | set(shared)
        if action in value["blocked_actions"] and affected.intersection(environments):
            holds.append({"input_id": key, "owner": record["owner"], "release_condition": value["release_condition"]})
    return {
        "status": "blocked" if holds else "current",
        "environments": environments,
        "holds": holds,
        "permission_granted": False,
    }


def _feasibility_validation(project: str, data: dict, snapshot: Path) -> None:
    record = material_inputs(data).get("azure_read_scope")
    if (
        not enabled(data)
        or not record
        or not isinstance(record["value"], dict)
        or not isinstance(record["value"].get("subscription_id"), str)
        or not record["value"]["subscription_id"].strip()
        or record["value"].get("policy_read_scope") != "subscription-and-inherited"
    ):
        raise ValueError("Explicit target/read scope is required before policy discovery")
    root = workspace_root_for()
    target = snapshot.resolve()
    if snapshot.is_symlink() or not target.is_relative_to(root.resolve()):
        raise ValueError("Policy evidence must remain in the workspace")
    script = root / ".github/skills/apex-azure-governance-discovery/scripts/discover.py"
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--project",
            project,
            "--subscription",
            record["value"]["subscription_id"],
            "--out",
            str(target),
            "--validate-only",
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise ValueError(
            f"Preliminary policy evidence is incomplete, stale or differently scoped: {result.stdout} {result.stderr}"
        )
    data.input_revisions[target] = file_revision(target)


def bind_feasibility(project: str, data: dict, snapshot: Path) -> None:
    _feasibility_validation(project, data, snapshot)
    root = workspace_root_for()
    data.setdefault("metadata", {})["policy_feasibility"] = {
        "path": str(snapshot.resolve().relative_to(root.resolve())),
        "sha256": file_revision(snapshot),
        "read_scope": digest(material_inputs(data)["azure_read_scope"]),
    }


def check_feasibility(project: str, data: dict) -> str:
    if "azure_read_scope" not in material_inputs(data):
        return "provisional_no_authorized_target"
    record = data.get("metadata", {}).get("policy_feasibility")
    if not record or record["read_scope"] != digest(material_inputs(data)["azure_read_scope"]):
        raise ValueError("Early policy feasibility is missing or target/read scope changed")
    root = workspace_root_for()
    snapshot = root / record["path"]
    if not snapshot.exists():
        snapshot = resolve_contract_path(project, Path(record["path"]).name)
    _feasibility_validation(project, data, snapshot)
    if file_revision(snapshot) != record["sha256"]:
        raise ValueError("Policy evidence changed; explicit owner refresh binding required")
    return "current"
