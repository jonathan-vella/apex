"""apex-recall decide — record decisions and decision_log entries."""

from __future__ import annotations

import json
import sys

from ..state_writer import (
    _iso_now,
    migrate_to_v3,
    read_state,
    session_state_path,
    write_state,
)


def run(args) -> int:
    project = args.project
    as_json = getattr(args, "json", False)
    key = getattr(args, "key", None)
    value = getattr(args, "value", None)
    decision_text = getattr(args, "decision", None)
    rationale = getattr(args, "rationale", None)
    step = getattr(args, "step", None)

    # Validate: must provide exactly one mode
    has_kv = key is not None
    has_decision = decision_text is not None

    if has_kv and has_decision:
        msg = "Cannot use both --key/--value (Mode A) and --decision (Mode B) at the same time."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    if not has_kv and not has_decision:
        msg = "Provide either --key/--value for decisions or --decision for decision_log."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    if has_kv and value is None:
        msg = "--key requires --value."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)

    if has_kv:
        # Mode A: key-value in decisions object
        data.setdefault("decisions", {})[key] = value
        write_state(project, data)
        result = {"project": project, "key": key, "value": value}
        if as_json:
            print(json.dumps(result))
        else:
            print(f"Decision: {project} {key}={value}")
    else:
        # Mode B: append to decision_log
        entry = {
            "decision": decision_text,
            "timestamp": _iso_now(),
        }
        if rationale:
            entry["rationale"] = rationale
        if step:
            entry["step"] = step
        data.setdefault("decision_log", []).append(entry)
        write_state(project, data)
        result = {"project": project, "decision": decision_text, "timestamp": entry["timestamp"]}
        if step:
            result["step"] = step
        if as_json:
            print(json.dumps(result))
        else:
            print(f"Decision logged: {decision_text}")

    return 0
