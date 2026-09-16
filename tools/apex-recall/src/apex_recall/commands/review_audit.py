"""apex-recall review-audit — manage review_audit entries."""

from __future__ import annotations

import json
import re

from ..state_writer import (
    _iso_now,
    check_state_revision,
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
    attempt_id = getattr(args, "attempt_id", None)
    attempt_options = [
        getattr(args, name, None) for name in ("attempt_kind", "input_digest", "attempt_outcome", "retry_of")
    ]
    if attempt_id is not None or any(attempt_options):
        kind, digest, outcome, retry_of = attempt_options
        if (
            not attempt_id
            or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", attempt_id)
            or kind not in ("invocation", "repair", "empty-output-retry")
            or not re.fullmatch(r"[a-f0-9]{64}", digest or "")
            or outcome not in ("started", "completed", "failed", "unknown")
        ):
            raise ValueError("Attempt ID, kind, input digest and outcome are required")
        attempts = data.setdefault("review_attempts", [])
        previous = [attempt for attempt in attempts if attempt["id"] == attempt_id]
        if previous and any(
            attempt[key] != value
            for attempt in previous
            for key, value in (("step", step), ("kind", kind), ("input_digest", digest), ("retry_of", retry_of))
        ):
            raise ValueError("Attempt identity cannot be reused for different inputs, kind or step")
        if previous and previous[-1]["outcome"] == outcome:
            check_state_revision(data, path)
            print(json.dumps({"outcome": "already_applied", "attempt_id": attempt_id}))
            return 0
        if previous and previous[-1]["outcome"] != "started":
            raise ValueError(
                "Terminal or unknown attempt outcomes cannot be rewritten; reconcile explicitly with the owner"
            )
        if not previous and outcome != "started":
            raise ValueError("Record attempt start before its outcome")
        if kind == "empty-output-retry":
            originals = [attempt for attempt in attempts if attempt["id"] == retry_of]
            if originals and (originals[-1]["kind"] != "invocation" or originals[-1]["step"] != step):
                raise ValueError(
                    "Retry must reference an original invocation in the same step; retry chains are forbidden"
                )
            if not originals or originals[-1]["input_digest"] != digest or originals[-1]["outcome"] != "failed":
                raise ValueError("Retry requires failed original attempt with identical input digest")
            if not previous and any(attempt.get("retry_of") == retry_of for attempt in attempts):
                raise ValueError("Identical-input retry already recorded; allowance cannot reset")
        elif retry_of is not None:
            raise ValueError("retry-of is only valid for empty-output-retry attempts")
        attempts.append(
            {
                "schema_version": "review-attempt-v1",
                "id": attempt_id,
                "step": step,
                "kind": kind,
                "input_digest": digest,
                "outcome": outcome,
                "retry_of": retry_of,
                "recorded_at": _iso_now(),
            }
        )
        write_state(project, data)
        print(json.dumps({"attempt_id": attempt_id, "outcome": outcome, "authorization": "not_granted"}))
        return 0

    audit_key = f"step_{step}"
    ra = data.setdefault("review_audit", {})
    entry = ra.setdefault(
        audit_key,
        {
            "complexity": "",
            "passes_planned": 0,
            "passes_executed": 0,
            "skipped": [],
            "skip_reasons": [],
            "models_used": [],
        },
    )

    if complexity is not None:
        entry["complexity"] = complexity
    if passes_planned is not None:
        entry["passes_planned"] = passes_planned
    if passes_executed is not None:
        if passes_executed < entry.get("passes_executed", 0):
            raise ValueError("Recorded executed review count cannot decrease")
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
