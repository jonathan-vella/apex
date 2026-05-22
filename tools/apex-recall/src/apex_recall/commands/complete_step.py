"""apex-recall complete-step — mark a step as complete.

Runtime challenger-review gate
------------------------------
APEX requires an adversarial challenger pass on every creative artifact at
Steps 1, 2, 3.5 (when governance constraints were discovered), and 4 — see
``AGENTS.md`` ``Agent Workflow`` table. ``complete-step`` is the only
workflow chokepoint every agent must hit before handoff, so the gate lives
here. If the gating artifact for a review-mandated step exists in
``agent-output/{project}/`` but its matching ``challenge-findings-*.json``
sidecar is missing or unreadable, this command **refuses** to mark the
step complete (exit code 2) — blocking every downstream agent until the
review is run.

Opt-out: ``--allow-missing-challenger`` together with
``--challenger-skip-reason "<text>"`` records an auditable skip in session
state. Both flags are required for opt-out; the reason persists in
``decisions.challenger_skip[]`` for post-mortem review.
"""

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

# Step -> (gating artifact, required findings sidecar) for review-mandated
# steps. AGENTS.md "Agent Workflow" table is the source of truth; keep in
# sync. Steps 3/5/6/7 have no mandatory single-pass comprehensive review.
_CHALLENGER_GATE: dict[str, tuple[str, str]] = {
    "1": ("01-requirements.md", "challenge-findings-requirements.json"),
    "2": ("02-architecture-assessment.md", "challenge-findings-architecture.json"),
    # Step 3_5 governance is conditional - review only required if the
    # governance constraints artifact was actually produced.
    "3_5": ("04-governance-constraints.md", "challenge-findings-governance-constraints-pass1.json"),
    "4": ("04-implementation-plan.md", "challenge-findings-plan.json"),
}


def _challenger_findings_missing(project: str, step: str) -> tuple[bool, str | None, str | None]:
    """Return (blocked, gating_path, sidecar_path)."""
    gate = _CHALLENGER_GATE.get(step)
    if not gate:
        return (False, None, None)
    gating_name, sidecar_name = gate

    project_dir = session_state_path(project).parent
    gating_path = project_dir / gating_name
    sidecar_path = project_dir / sidecar_name

    # Skip gate when the step's gating artifact was never produced (e.g.
    # governance step legitimately skipped because no constraints existed).
    if not gating_path.is_file():
        return (False, str(gating_path), str(sidecar_path))

    if not sidecar_path.is_file():
        return (True, str(gating_path), str(sidecar_path))

    # Sidecar must be non-empty, parseable JSON. Schema shape is enforced
    # separately by `npm run validate:challenger-findings`; we keep the
    # runtime gate fast and decoupled (presence + parseability only).
    try:
        text = sidecar_path.read_text(encoding="utf-8").strip()
        if not text:
            return (True, str(gating_path), str(sidecar_path))
        json.loads(text)
    except (OSError, json.JSONDecodeError):
        return (True, str(gating_path), str(sidecar_path))

    return (False, str(gating_path), str(sidecar_path))


def _record_skip(data: dict, step: str, reason: str, now: str) -> None:
    """Persist an audit trail for --allow-missing-challenger opt-outs."""
    decisions = data.setdefault("decisions", {})
    skips = decisions.setdefault("challenger_skip", [])
    skips.append({"step": step, "reason": reason, "recorded": now})


def run(args) -> int:
    project = args.project
    step = validate_step_key(args.step)
    as_json = getattr(args, "json", False)
    allow_missing = getattr(args, "allow_missing_challenger", False)
    skip_reason = (getattr(args, "challenger_skip_reason", None) or "").strip()

    blocked, gating_path, sidecar_path = _challenger_findings_missing(project, step)
    if blocked and not allow_missing:
        msg = {
            "project": project,
            "step": step,
            "error": "challenger_findings_missing",
            "gating_artifact": gating_path,
            "required_sidecar": sidecar_path,
            "remediation": (
                "Run the challenger-review-subagent (or the 10-Challenger agent) "
                "against the gating artifact and produce the required findings "
                "sidecar, then re-run `apex-recall complete-step`. To bypass "
                "intentionally, pass --allow-missing-challenger "
                "--challenger-skip-reason \"...\""
            ),
        }
        if as_json:
            print(json.dumps(msg))
        else:
            print(
                f"Refusing to complete step {step}: required challenger findings "
                f"missing.\n  gating artifact: {gating_path}\n  required sidecar: "
                f"{sidecar_path}\n  -> {msg['remediation']}"
            )
        return 2

    if blocked and allow_missing and not skip_reason:
        msg = {
            "project": project,
            "step": step,
            "error": "challenger_skip_reason_required",
            "remediation": "Provide --challenger-skip-reason \"<auditable reason>\"",
        }
        if as_json:
            print(json.dumps(msg))
        else:
            print(
                "--allow-missing-challenger requires --challenger-skip-reason "
                "\"<reason>\" for the audit trail."
            )
        return 2

    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)

    step_data = data["steps"].get(step, {})
    now = _iso_now()
    step_data["status"] = "complete"
    step_data["completed"] = now
    step_data["sub_step"] = None
    data["steps"][step] = step_data

    if blocked and allow_missing:
        _record_skip(data, step, skip_reason, now)

    write_state(project, data)

    # Additive hint (#425): surface the preferred atomic alternative on every
    # successful complete-step. Agents that parse --json see it and can adapt;
    # the human-readable path stays clean (no stderr pollution).
    next_step = _next_step_key(step)
    hint = (
        f"prefer `apex-recall transition {project} --from-step {step} "
        f"--to-step {next_step} --complete --decision <k=v>` when also "
        "recording decisions or starting the next step (atomic, single "
        "00-session-state.json write)."
    )

    result = {"project": project, "step": step, "status": "complete", "completed": now}
    if blocked and allow_missing:
        result["challenger_skip_recorded"] = True
    result["hint"] = hint
    if as_json:
        print(json.dumps(result))
    else:
        print(f"Step {step} completed for {project}")

    return 0


# Step ordering for the JSON hint. Mirrors the workflow graph at
# .github/skills/workflow-engine/templates/workflow-graph.json. Keep in
# sync if the workflow changes.
_STEP_ORDER = ["1", "2", "3", "3_5", "4", "5", "6", "7"]


def _next_step_key(step: str) -> str:
    """Return the next step in the workflow, or 'next' if at the end."""
    try:
        idx = _STEP_ORDER.index(step)
    except ValueError:
        return "next"
    if idx + 1 >= len(_STEP_ORDER):
        return "next"
    return _STEP_ORDER[idx + 1]
