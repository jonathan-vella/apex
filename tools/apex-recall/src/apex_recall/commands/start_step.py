"""apex-recall start-step — mark a step as in_progress."""

from __future__ import annotations

import json
import sys

from ..state_writer import (
    _iso_now,
    migrate_to_v3,
    read_state,
    session_state_path,
    step_to_int,
    validate_step_key,
    write_state,
)


def run(args) -> int:
    project = args.project
    step = validate_step_key(args.step)
    force = getattr(args, "force", False)
    as_json = getattr(args, "json", False)

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)

    step_data = data["steps"].get(step, {})
    if step_data.get("status") == "complete" and not force:
        msg = f"Step {step} is already complete. Use --force to re-start."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    now = _iso_now()
    step_data["status"] = "in_progress"
    step_data["started"] = now
    step_data["completed"] = None
    data["steps"][step] = step_data
    data["current_step"] = step_to_int(step)

    write_state(project, data)

    result = {"project": project, "step": step, "status": "in_progress", "started": now}
    if as_json:
        print(json.dumps(result))
    else:
        print(f"Step {step} started for {project}")

    return 0
