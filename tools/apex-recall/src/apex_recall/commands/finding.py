"""apex-recall finding — manage open_findings."""

from __future__ import annotations

import json
import sys

from ..state_writer import (
    migrate_to_v3,
    read_state,
    session_state_path,
    write_state,
)


def run(args) -> int:
    project = args.project
    add_text = getattr(args, "add", None)
    remove_text = getattr(args, "remove", None)
    as_json = getattr(args, "json", False)

    if not add_text and not remove_text:
        msg = "Provide --add or --remove."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)

    findings = data.setdefault("open_findings", [])

    if add_text:
        if add_text not in findings:
            findings.append(add_text)
        write_state(project, data)
        result = {"project": project, "action": "added", "finding": add_text, "total": len(findings)}
        if as_json:
            print(json.dumps(result))
        else:
            print(f"Finding added: {add_text}")
    elif remove_text:
        if remove_text in findings:
            findings.remove(remove_text)
            write_state(project, data)
            result = {"project": project, "action": "removed", "finding": remove_text, "total": len(findings)}
        else:
            result = {"project": project, "action": "not_found", "finding": remove_text, "total": len(findings)}
        if as_json:
            print(json.dumps(result))
        else:
            action = result["action"]
            print(f"Finding {action}: {remove_text}")

    return 0
