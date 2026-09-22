"""apex-recall init — create a fresh 00-session-state.json."""

from __future__ import annotations

import json
import sys

from ..state_writer import StateDocument, file_revision, make_template, session_state_path, write_state


def run(args) -> int:
    project = args.project
    force = getattr(args, "force", False)
    as_json = getattr(args, "json", False)

    path = session_state_path(project)

    if path.exists() and not force:
        msg = f"Session state already exists: {path}. Use --force to overwrite."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    data = make_template(project)
    if force and path.exists():
        data = StateDocument(data, path, file_revision(path))
    written = write_state(project, data)

    if as_json:
        print(json.dumps({"created": True, "project": project, "file": str(written)}))
    else:
        print(f"Created session state: {written}")

    return 0
