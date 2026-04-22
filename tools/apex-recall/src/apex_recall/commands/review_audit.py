"""apex-recall review-audit — manage review_audit entries."""

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
    as_json = getattr(args, "json", False)

    complexity = getattr(args, "complexity", None)
    passes_planned = getattr(args, "passes_planned", None)
    passes_executed = getattr(args, "passes_executed", None)
    models = getattr(args, "model", None) or []
    skips = getattr(args, "skip", None) or []
    skip_reasons = getattr(args, "skip_reason", None) or []

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)

    audit_key = f"step_{step}"
    ra = data.setdefault("review_audit", {})
    entry = ra.setdefault(audit_key, {
        "complexity": "",
        "passes_planned": 0,
        "passes_executed": 0,
        "skipped": [],
        "skip_reasons": [],
        "models_used": [],
    })

    if complexity is not None:
        entry["complexity"] = complexity
    if passes_planned is not None:
        entry["passes_planned"] = passes_planned
    if passes_executed is not None:
        entry["passes_executed"] = passes_executed

    # Append models (deduplicated)
    for m in models:
        if m not in entry.setdefault("models_used", []):
            entry["models_used"].append(m)

    # Append skip pass numbers
    for s in skips:
        s_int = int(s)
        if s_int not in entry.setdefault("skipped", []):
            entry["skipped"].append(s_int)

    # Append skip reasons
    for sr in skip_reasons:
        entry.setdefault("skip_reasons", []).append(sr)

    ra[audit_key] = entry
    data["review_audit"] = ra

    write_state(project, data)

    result = {"project": project, "step": step, "audit_key": audit_key, "entry": entry}
    if as_json:
        print(json.dumps(result))
    else:
        print(f"Review audit updated: {project} {audit_key}")

    return 0
