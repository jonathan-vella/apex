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

    data["steps"][step] = step_data

    write_state(project, data)

    result = {"project": project, "step": step, "sub_step": sub_step, "updated": data.get("updated", "")}
    if artifact:
        result["artifact_added"] = artifact
    if as_json:
        print(json.dumps(result))
    else:
        print(f"Checkpoint: {project} step {step} → {sub_step}")

    return 0
