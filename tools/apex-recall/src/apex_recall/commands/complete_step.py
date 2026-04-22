"""apex-recall complete-step — mark a step as complete."""

from __future__ import annotations

import json

from ..state_writer import (
    _iso_now,
    migrate_to_v3,
    read_state,
    session_state_path,
    validate_step_key,
    write_state,
)


def run(args) -> int:
    project = args.project
    step = validate_step_key(args.step)
    as_json = getattr(args, "json", False)

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)

    step_data = data["steps"].get(step, {})
    now = _iso_now()
    step_data["status"] = "complete"
    step_data["completed"] = now
    step_data["sub_step"] = None
    data["steps"][step] = step_data

    write_state(project, data)

    result = {"project": project, "step": step, "status": "complete", "completed": now}
    if as_json:
        print(json.dumps(result))
    else:
        print(f"Step {step} completed for {project}")

    return 0
