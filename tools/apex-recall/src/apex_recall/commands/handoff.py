"""'apex-recall handoff' command — deterministic next-step handoff contract."""

from __future__ import annotations

import json
from pathlib import Path

from ..config import get_agent_output_dir
from ..state_writer import project_dir, read_state, resolve_project_file, session_state_path, workspace_root_for

STEP_ORDER = ("1", "2", "3", "3_5", "4", "5", "6", "7")

STEP_NAMES = {
    "1": "Requirements",
    "2": "Architecture",
    "3": "Design",
    "3_5": "Governance",
    "4": "IaC Plan",
    "5": "IaC Code",
    "6": "Deploy",
    "7": "As-Built",
}

CANONICAL_STEP_ARTIFACTS = {
    "1": [
        "01-requirements.md",
        "sku-manifest.json",
        "sku-manifest.md",
        "challenge-findings-requirements.json",
    ],
    "2": [
        "02-architecture-assessment.md",
        "02-cost-estimate.json",
        "03-des-cost-estimate.md",
        "03-des-sku-comparison.md",
        "sku-manifest.json",
        "sku-manifest.md",
        "challenge-findings-architecture.json",
        "challenge-findings-cost-estimate.json",
    ],
    "3": [
        "03-des-diagram.py",
        "03-des-diagram.png",
    ],
    "3_5": [
        "04-policy-feasibility.json",
        "04-governance-constraints.json",
        "04-governance-constraints.md",
        "challenge-findings-governance-constraints-closure1.json",
        "challenge-findings-governance-constraints-pass1.json",
    ],
    "4": [
        "04-implementation-plan.md",
        "04-iac-contract.json",
        "04-policy-property-map.json",
        "04-environment-manifest.json",
        "challenge-findings-plan.json",
    ],
    "5": [
        "05-implementation-reference.md",
        "05-iac-handoff.json",
    ],
    "6": [
        "06-deployment-summary.md",
    ],
    "7": [
        "07-ab-operations-manual.md",
    ],
}


def _resolve_owner(step: str, iac_tool: str, step_entry: dict) -> str:
    tool = (iac_tool or "").strip().lower()
    if step == "1":
        return "02-Requirements"
    if step == "2":
        return "03-Architect"
    if step == "3":
        return "04-Design"
    if step == "3_5":
        return "04g-Governance"
    if step == "4":
        return "05-IaC Planner"
    if step == "5":
        if tool == "terraform":
            return "06t-Terraform CodeGen"
        if tool == "bicep":
            return "06b-Bicep CodeGen"
        return step_entry.get("agent") or "06b-Bicep CodeGen / 06t-Terraform CodeGen"
    if step == "6":
        if tool == "terraform":
            return "07t-Terraform Deploy"
        if tool == "bicep":
            return "07b-Bicep Deploy"
        return step_entry.get("agent") or "07b-Bicep Deploy / 07t-Terraform Deploy"
    if step == "7":
        return "08-As-Built"
    return step_entry.get("agent") or "01-Orchestrator"


def _discover_projects() -> list[tuple[str, Path, dict]]:
    out_dir = get_agent_output_dir()
    if not out_dir.exists():
        return []
    found = []
    for child in sorted(out_dir.iterdir()):
        if not child.is_dir() or child.name.startswith(("_", ".")):
            continue
        state_file = session_state_path(child.name)
        if state_file.is_file():
            try:
                data = read_state(state_file)
                if isinstance(data, dict):
                    found.append((child.name, state_file, data))
            except Exception:
                continue
    return found


def _select_active_step(steps: dict, decisions: dict, current_step: object = None) -> str:
    skip_design = str(decisions.get("design_artifacts", "")).lower() == "skip"
    cur_key = str(current_step).replace(".", "_") if current_step is not None else ""
    if (
        cur_key in STEP_ORDER
        and not (cur_key == "3" and skip_design)
        and steps.get(cur_key, {}).get("status") == "in_progress"
    ):
        return cur_key
    for key in STEP_ORDER:
        if key == "3" and skip_design:
            continue
        if steps.get(key, {}).get("status") == "in_progress":
            return key
    for key in STEP_ORDER:
        if key == "3" and skip_design:
            continue
        status = steps.get(key, {}).get("status", "pending")
        if status in ("pending", "stale", "not_started"):
            return key
    return "7"


def build_handoff_payload(project: str, data: dict, auto_selected: bool = False) -> dict:
    steps = data.get("steps", {}) if isinstance(data.get("steps"), dict) else {}
    decisions = data.get("decisions", {}) if isinstance(data.get("decisions"), dict) else {}
    iac_tool = data.get("iac_tool") or decisions.get("iac_tool") or ""
    region = decisions.get("region") or data.get("region") or "swedencentral"
    workflow_contract = decisions.get("workflow_contract") or "legacy"

    active_step = _select_active_step(steps, decisions, data.get("current_step"))
    step_entry = steps.get(active_step, {}) if isinstance(steps.get(active_step), dict) else {}
    step_status = step_entry.get("status", "pending")
    checkpoint = step_entry.get("sub_step")
    next_owner = _resolve_owner(active_step, iac_tool, step_entry)
    step_name = STEP_NAMES.get(active_step, step_entry.get("name") or f"Step {active_step}")

    completed_steps = [k for k in STEP_ORDER if steps.get(k, {}).get("status") == "complete"]

    pdir = project_dir(project)
    root = workspace_root_for()
    frozen_artifacts: list[str] = []
    seen: set[str] = set()
    for comp_step in completed_steps:
        for rel_name in CANONICAL_STEP_ARTIFACTS.get(comp_step, []):
            candidate = resolve_project_file(pdir, rel_name)
            if candidate.is_file():
                rel_path = str(candidate.resolve().relative_to(root))
                if rel_path not in seen:
                    seen.add(rel_path)
                    frozen_artifacts.append(rel_path)
        for art in steps.get(comp_step, {}).get("artifacts", []) or []:
            if isinstance(art, str):
                art_path = root / art
                if not art_path.is_file():
                    art_path = resolve_project_file(pdir, Path(art).name)
                if art_path.is_file():
                    rel_art = str(art_path.resolve().relative_to(root))
                    if rel_art not in seen:
                        seen.add(rel_art)
                        frozen_artifacts.append(rel_art)

    material_inputs = decisions.get("material_inputs", {}) if isinstance(decisions.get("material_inputs"), dict) else {}
    settled_ids = sorted(material_inputs.keys())

    resume_command = f"/apex-workflow-start resume {project}"
    checkpoint_clause = f" from checkpoint `{checkpoint}`" if checkpoint else ""
    tool_clause = f", `iac_tool={iac_tool}`" if iac_tool else ""
    delegation_prompt = (
        f"Continue `{project}` at Step {active_step} (`{next_owner}`{tool_clause}) "
        f"under `{workflow_contract}`{checkpoint_clause} and complete the full Step {active_step} "
        f"({step_name}) phase through its required validations and independent challenger review(s) "
        f"to the Step {active_step} approval gate. Preserve all {len(settled_ids)} settled material inputs "
        f"in `apex-recall` and keep completed upstream artifacts read-only."
    )

    return {
        "status": "READY",
        "project": project,
        "auto_selected": auto_selected,
        "workflow_contract": workflow_contract,
        "iac_tool": iac_tool or None,
        "region": region,
        "active_step": active_step,
        "step_name": step_name,
        "step_status": step_status,
        "checkpoint": checkpoint,
        "next_owner": next_owner,
        "completed_steps": completed_steps,
        "frozen_artifacts": frozen_artifacts,
        "settled_material_inputs_count": len(settled_ids),
        "settled_material_input_ids": settled_ids,
        "resume_command": resume_command,
        "delegation_prompt": delegation_prompt,
    }


def run(args) -> int:
    project = getattr(args, "project", None)
    as_json = getattr(args, "json", False)
    auto_selected = False

    if not project:
        discovered = _discover_projects()
        if not discovered:
            payload = {"status": "NO_ACTIVE_PROJECT", "candidates": []}
            print(json.dumps(payload, indent=2) if as_json else "No active APEX projects found in agent-output/.")
            return 1
        in_progress = [
            (name, path, data)
            for name, path, data in discovered
            if any(
                isinstance(s, dict) and s.get("status") == "in_progress"
                for s in (data.get("steps") or {}).values()
            )
        ]
        pool = in_progress if len(in_progress) == 1 else discovered if len(discovered) == 1 else []
        if len(pool) == 1:
            project, _, data = pool[0]
            auto_selected = True
        else:
            candidates = [name for name, _, _ in (in_progress or discovered)]
            payload = {"status": "AMBIGUOUS_PROJECT", "candidates": candidates}
            if as_json:
                print(json.dumps(payload, indent=2))
            else:
                print(f"Multiple projects found ({', '.join(candidates)}); specify `apex-recall handoff <project>`.")
            return 1
    else:
        state_file = session_state_path(project)
        if not state_file.is_file():
            payload = {"status": "PROJECT_NOT_FOUND", "project": project}
            print(json.dumps(payload, indent=2) if as_json else f"Project '{project}' not found at {state_file}.")
            return 1
        data = read_state(state_file)

    payload = build_handoff_payload(project, data, auto_selected=auto_selected)
    if as_json:
        print(json.dumps(payload, indent=2))
    else:
        print(
            f"▶ Next Step — Step {payload['active_step']} ({payload['step_name']} · {payload['next_owner']})\n"
            f"  Project:    {payload['project']}\n"
            f"  Checkpoint: {payload['checkpoint'] or 'none'}\n"
            f"  Contract:   {payload['workflow_contract']} | IaC: {payload['iac_tool'] or 'unset'}\n"
            f"  Settled:    {payload['settled_material_inputs_count']} material inputs | "
            f"{len(payload['frozen_artifacts'])} frozen upstream artifacts\n\n"
            f"```text\n{payload['resume_command']}\n```"
        )
    return 0
