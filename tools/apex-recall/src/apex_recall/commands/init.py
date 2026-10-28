"""apex-recall init — create a fresh 00-session-state.json."""

from __future__ import annotations

import json
import sys

from ..state_writer import (
    StateDocument,
    ensure_layout_v2_dirs,
    file_revision,
    make_template,
    project_dir,
    session_state_path,
    write_state,
)


def run(args) -> int:
    project = args.project
    force = getattr(args, "force", False)
    as_json = getattr(args, "json", False)
    layout = int(getattr(args, "layout", 2) or 2)

    pdir = project_dir(project)
    existing_path = session_state_path(project)

    if existing_path.exists() and not force:
        msg = f"Session state already exists: {existing_path}. Use --force to overwrite."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    if layout == 2:
        ensure_layout_v2_dirs(pdir)

    data = make_template(project)
    if layout == 2:
        data["layout_version"] = 2
    data.setdefault("decisions", {})["workflow_contract"] = "practical-v1"
    if force and existing_path.exists():
        data = StateDocument(data, existing_path, file_revision(existing_path))
    written = write_state(project, data)

    if as_json:
        print(json.dumps({"created": True, "project": project, "file": str(written)}))
    else:
        print(f"Created session state: {written}")

    return 0
