"""apex-recall finding — manage open_findings."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from ..state_writer import (
    migrate_to_v3,
    read_state,
    session_state_path,
    write_state,
)


def _read_bulk_payload(source: str) -> object:
    """Read --add-many input from stdin (`-`) or a file path.

    Returns the parsed JSON value (caller validates the shape). Raises
    `json.JSONDecodeError` or `OSError` on failure — both surface to the
    caller as the exit-2 contract documented in
    plan-optimiseGovernanceAgent.prompt.md Phase 5.
    """
    if source == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(source).read_text(encoding="utf-8")
    return json.loads(raw)


def _coerce_bulk_items(payload: object) -> tuple[list[str] | None, str | None]:
    """Validate `--add-many` payload and coerce to a list of strings.

    Returns `(items, None)` on success, or `(None, error_message)` on
    failure. Contract (plan Phase 5 S4 resolution):
      * Empty array → succeed with `[]`.
      * String elements → kept as-is.
      * Dict elements MUST carry a `text` key; otherwise fail.
      * Any other root or element type → fail.
    """
    if not isinstance(payload, list):
        return None, "apex-recall: --add-many expected a JSON array"
    items: list[str] = []
    for elem in payload:
        if isinstance(elem, str):
            items.append(elem)
        elif isinstance(elem, dict):
            text = elem.get("text")
            if not isinstance(text, str):
                return None, "apex-recall: --add-many object entries require a string `text` key"
            items.append(text)
        else:
            return None, "apex-recall: --add-many entries must be strings or objects with a `text` key"
    return items, None


def run(args) -> int:
    project = args.project
    add_text = getattr(args, "add", None)
    remove_text = getattr(args, "remove", None)
    add_many = getattr(args, "add_many", None)
    as_json = getattr(args, "json", False)

    if not add_text and not remove_text and not add_many:
        msg = "Provide --add, --add-many, or --remove."
        if as_json:
            print(json.dumps({"error": msg}))
        else:
            print(f"Error: {msg}", file=sys.stderr)
        return 1

    # --add-many takes precedence when supplied alongside other flags
    # (the typical invocation only sets one). The bulk path is fully
    # additive and never dedupes — this is the locked S4 contract.
    if add_many:
        try:
            payload = _read_bulk_payload(add_many)
        except (json.JSONDecodeError, OSError) as e:
            print(f"apex-recall: --add-many expected a JSON array ({e})", file=sys.stderr)
            return 2
        items, err = _coerce_bulk_items(payload)
        if err is not None:
            print(err, file=sys.stderr)
            return 2

        # Empty-array no-op: skip the state read/write entirely so the
        # state file's mtime is not touched. Locked S4 contract.
        if not items:
            if as_json:
                print(json.dumps({"project": project, "action": "appended", "appended": 0}))
            else:
                print("Findings appended: 0 (no-op)")
            return 0

        path = session_state_path(project)
        data = read_state(path)
        data = migrate_to_v3(data)
        findings = data.setdefault("open_findings", [])
        # Append unconditionally — no dedup against existing entries.
        findings.extend(items)
        write_state(project, data)
        result = {"project": project, "action": "appended", "appended": len(items), "total": len(findings)}
        if as_json:
            print(json.dumps(result))
        else:
            print(f"Findings appended: {len(items)} (total {len(findings)})")
        return 0

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
