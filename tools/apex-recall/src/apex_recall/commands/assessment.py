"""Narrow revision-aware assessment command; no evidence collection or implicit authority."""

from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path

from ..assessment import mutate
from ..state_writer import StateConflict, check_state_revision, read_state, session_state_path, write_state


def load_request(value: str, data: dict) -> dict:
    value = value.strip()
    inline = value.startswith(("{", "[")) or value in ("null", "true", "false")
    if inline:
        contents = value
        location = "inline assessment request"
    else:
        path = Path(value).absolute()
        if path.is_symlink():
            raise ValueError(f"Assessment request path cannot be a symlink: {path}")
        if not path.exists():
            raise ValueError(f"Assessment request file not found: {path}")
        if not path.is_file():
            raise ValueError(f"Assessment request path must be a regular JSON file: {path}")
        try:
            raw = path.read_bytes()
            contents = raw.decode("utf-8")
        except (OSError, UnicodeError) as error:
            raise ValueError(f"Cannot read UTF-8 assessment request file: {path}") from error
        data.input_revisions[path] = sha256(raw).hexdigest()
        location = f"assessment request file {path}"
    try:
        request = json.loads(contents)
    except json.JSONDecodeError as error:
        raise ValueError(f"Malformed JSON in {location} at line {error.lineno}, column {error.colno}") from error
    if not isinstance(request, dict):
        raise ValueError(f"Assessment request must be a JSON object: {location}")
    return request


def run(args) -> int:
    data = read_state(session_state_path(args.project))
    request = load_request(args.request or "{}", data)
    expected = request.get("expected_revision")
    if expected is not None and expected != data.revision:
        raise StateConflict("Assessment expected_revision differs from primary state")
    preview = args.dry_run and args.action in ("start", "adopt")
    result = mutate(args.project, data, args.action, request, args.phase, preview=preview)
    if args.dry_run:
        check_state_revision(data, session_state_path(args.project))
        result["dry_run"] = True
        result["assessment_run"] = data["assessment_run"]
        if preview:
            result["status"] = "preview"
            result["approval_required"] = not (
                isinstance(request.get("receipt"), dict) and request["receipt"].get("approved") is True
            )
    else:
        write_state(args.project, data)
    result["revision"] = data.revision
    result["permission_granted"] = False
    print(json.dumps(result))
    return 0
