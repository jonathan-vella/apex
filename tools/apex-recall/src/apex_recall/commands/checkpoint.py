"""apex-recall checkpoint — record a sub-step checkpoint."""

from __future__ import annotations

import json

from ..state_writer import (
    migrate_to_v3,
    read_state,
    session_state_path,
    validate_step_key,
    write_state,
)


def run(args) -> int:
    project = args.project
    step = validate_step_key(args.step)
    sub_step = args.sub_step
    artifact = getattr(args, "artifact", None)
    as_json = getattr(args, "json", False)

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)

    step_data = data["steps"].get(step, {})
    step_data["sub_step"] = sub_step

    if artifact and artifact not in step_data.get("artifacts", []):
        step_data.setdefault("artifacts", []).append(artifact)

    # Wave-0 telemetry: any --telemetry-* flag merges into steps[step].telemetry
    # so measure-workflow-baseline.mjs can aggregate per-tier averages.
    telemetry_fields = {
        "step_start_iso": getattr(args, "telemetry_step_start", None),
        "step_end_iso": getattr(args, "telemetry_step_end", None),
        "elapsed_ms": getattr(args, "telemetry_elapsed_ms", None),
        "input_tokens": getattr(args, "telemetry_input_tokens", None),
        "output_tokens": getattr(args, "telemetry_output_tokens", None),
        "subagent_count": getattr(args, "telemetry_subagent_count", None),
        "validation_attempts": getattr(args, "telemetry_validation_attempts", None),
        "cache_hits": getattr(args, "telemetry_cache_hits", None),
    }
    telemetry_supplied = {k: v for k, v in telemetry_fields.items() if v is not None}
    if telemetry_supplied:
        existing = step_data.get("telemetry", {}) or {}
        existing.update(telemetry_supplied)
        step_data["telemetry"] = existing

    data["steps"][step] = step_data

    write_state(project, data)

    result = {"project": project, "step": step, "sub_step": sub_step, "updated": data.get("updated", "")}
    if artifact:
        result["artifact_added"] = artifact
    if telemetry_supplied:
        result["telemetry_updated"] = list(telemetry_supplied.keys())
    if as_json:
        print(json.dumps(result))
    else:
        print(f"Checkpoint: {project} step {step} → {sub_step}")

    return 0
