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

Present reviews must also match the expected artifact/lens, contain no
must-fix findings, and pass the workspace Node validator's strict freshness
check. Invalid present evidence cannot be waived with a missing-review skip.

Opt-out: ``--allow-missing-challenger`` together with
``--challenger-skip-reason "<text>"`` records an auditable skip in session
state. Both flags are required for opt-out; the reason persists in
``decisions.challenger_skip[]`` for post-mortem review.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

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


def _review_paths(project: str, step: str, governance_review: Path | None = None) -> list[tuple[Path, Path]]:
    gate = _CHALLENGER_GATE.get(step)
    if not gate:
        return []
    gates = [gate]
    if step in ("2", "4"):
        state = read_state(session_state_path(project))
        decisions = state.get("decisions")
        if isinstance(decisions, dict) and decisions.get("review_depth") == "deep":
            gates[0] = (gate[0], gate[1].removesuffix(".json") + "-pass1.json")
    if step == "2":
        gates.append(("03-des-cost-estimate.md", "challenge-findings-cost-estimate.json"))
    project_dir = session_state_path(project).parent
    if step in ("3_5", "4") and governance_review is not None:
        return [(project_dir / gate[0], governance_review)]
    produced = any((project_dir / gating_name).is_file() for gating_name, _ in gates)
    return [
        (project_dir / gating_name, project_dir / sidecar_name)
        for gating_name, sidecar_name in gates
        if (project_dir / gating_name).is_file() or (step == "2" and produced)
    ]


def _challenger_findings_missing(
    project: str, step: str, governance_review: Path | None = None
) -> tuple[bool, str | None, str | None]:
    """Return (blocked, gating_path, sidecar_path) for missing/unreadable evidence."""
    gating_path = sidecar_path = None
    for gating_path, sidecar_path in _review_paths(project, step, governance_review):
        if not sidecar_path.is_file():
            return (True, str(gating_path), str(sidecar_path))
        try:
            text = sidecar_path.read_text(encoding="utf-8").strip()
            if not text:
                return (True, str(gating_path), str(sidecar_path))
            json.loads(text)
        except OSError, UnicodeError, json.JSONDecodeError:
            return (True, str(gating_path), str(sidecar_path))

    return (False, str(gating_path) if gating_path else None, str(sidecar_path) if sidecar_path else None)


def _challenger_findings_invalid(project: str, step: str, governance_review: Path | None = None) -> str | None:
    """Validate present reviews before mutation; missing-review bypass cannot waive these checks."""
    root = session_state_path(project).parent.parent.parent.resolve()
    validator = root / "tools/scripts/validate-challenger-findings.mjs"
    for artifact, sidecar in _review_paths(project, step, governance_review):
        if not sidecar.is_file():
            continue
        try:
            document = json.loads(sidecar.read_text(encoding="utf-8"))
            if not isinstance(document, dict) or not isinstance(document.get("findings"), list):
                return f"{sidecar}: invalid single-review findings payload"
            if not artifact.is_file():
                return f"{artifact}: required reviewed artifact is missing"
            challenged = document.get("challenged_artifact")
            if not isinstance(challenged, str) or (root / challenged).resolve() != artifact.resolve():
                return f"{sidecar}: challenged_artifact does not match the gating artifact"
            expected_type = {
                "1": "requirements",
                "2": "architecture",
                "3_5": "governance-constraints",
                "4": "implementation-plan",
            }[step]
            expected_focus = "governance-reconciliation" if step == "3_5" else "comprehensive"
            if artifact.name == "03-des-cost-estimate.md":
                expected_type, expected_focus = "cost-estimate", "cost-feasibility"
            elif sidecar.name.endswith("-pass1.json") and step in ("2", "4"):
                expected_focus = "security-governance"
            if document.get("artifact_type") != expected_type or document.get("review_focus") != expected_focus:
                return f"{sidecar}: review type/focus does not match the required gate"
            expected_pass = int(sidecar.stem.rsplit("-pass", 1)[1]) if governance_review is not None else 1
            if type(document.get("pass_number")) is not int or document["pass_number"] != expected_pass:
                return f"{sidecar}: required pass-{expected_pass} review is invalid"
            if document.get("overall_assessment") in ("BLOCKED", "FAILED"):
                return f"{sidecar}: reviewer reported blocked/failed"
            if document.get("must_fix_count") != 0 or any(
                not isinstance(finding, dict) or finding.get("severity") == "must_fix"
                for finding in document["findings"]
            ):
                return f"{sidecar}: unresolved must_fix findings; decisions are not closure evidence"
            if not validator.is_file():
                return f"{validator}: required strict review validator unavailable"
            result = subprocess.run(
                ["node", str(validator.resolve()), "--verify-cache", str(sidecar.resolve())],
                cwd=root,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if result.returncode != 0:
                return f"{sidecar}: strict review validation failed: {(result.stdout + result.stderr)[-3000:]}"
        except (OSError, UnicodeError, ValueError, subprocess.SubprocessError) as error:
            return f"{sidecar}: review verification unavailable or invalid ({error})"
    return None


def _report_invalid_review(project: str, step: str, reason: str, as_json: bool) -> int:
    message = {
        "project": project,
        "step": step,
        "error": "challenger_findings_invalid",
        "reason": reason,
        "remediation": "Return to the artifact owner and 10-Challenger for current review and blocker closure. Preserve retry limits; do not restamp hashes.",
    }
    print(json.dumps(message) if as_json else f"Refusing completion: {reason}\n{message['remediation']}")
    return 2


def _record_skip(data: dict, step: str, reason: str, now: str) -> None:
    """Persist an audit trail for --allow-missing-challenger opt-outs."""
    decisions = data.setdefault("decisions", {})
    skips = decisions.setdefault("challenger_skip", [])
    skips.append({"step": step, "reason": reason, "recorded": now})


def _select_replacement_review(project: str, step: str, args) -> tuple[Path | None, dict | None]:
    governance = getattr(args, "governance_review", None) is not None or bool(
        getattr(args, "governance_review_reason", None)
    )
    plan = getattr(args, "plan_review", None) is not None or bool(getattr(args, "plan_review_reason", None))
    if governance and plan:
        raise ValueError("Select only one step-specific replacement review")
    option, expected_step, label, stem = (
        ("plan_review", "4", "Plan", "plan")
        if plan
        else ("governance_review", "3_5", "Governance", "governance-constraints")
    )
    selected = getattr(args, option, None)
    reason = (getattr(args, f"{option}_reason", None) or "").strip()
    if selected is None and not reason:
        return None, None
    if step != expected_step or not selected or not reason:
        raise ValueError(
            f"{label} replacement selection requires Step {expected_step}, a review path and its audit reason"
        )
    if plan:
        state = read_state(session_state_path(project))
        if state.get("decisions", {}).get("review_depth") == "deep":
            raise ValueError(
                "--plan-review selects a default comprehensive confirmation, not a deep-review lens replacement"
            )
    if getattr(args, "allow_missing_challenger", False):
        raise ValueError("A selected review cannot use the missing-review bypass")
    project_dir = session_state_path(project).parent.resolve()
    candidate = Path(selected)
    if not candidate.is_absolute():
        candidate = project_dir.parent.parent / candidate
    if candidate.is_symlink() or candidate.parent.resolve() != project_dir or not candidate.is_file():
        raise ValueError("Selected review must be a regular, non-symlink file in the current project")
    match = re.fullmatch(rf"challenge-findings-{stem}-pass([2-9][0-9]*|1[0-9]+)\.json", candidate.name)
    if not match:
        raise ValueError(f"Select an explicitly authorized later {label} pass using its canonical filename")
    original = project_dir / _CHALLENGER_GATE[expected_step][1]
    if not original.is_file():
        raise ValueError(f"Preserve the original {label} review before selecting a replacement")
    digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
    entry = {
        "decision": f"Select {label} replacement review for completion",
        "rationale": f"{reason}; review={candidate.name}; pass={match[1]}; sha256={digest}",
        "step": expected_step,
    }
    return candidate.resolve(), entry


def _select_governance_review(project: str, step: str, args) -> tuple[Path | None, dict | None]:
    return _select_replacement_review(project, step, args)


def run(args) -> int:
    project = args.project
    step = validate_step_key(args.step)
    as_json = getattr(args, "json", False)
    allow_missing = getattr(args, "allow_missing_challenger", False)
    skip_reason = (getattr(args, "challenger_skip_reason", None) or "").strip()

    try:
        governance_review, selection = _select_replacement_review(project, step, args)
    except (OSError, ValueError) as error:
        return _report_invalid_review(project, step, str(error), as_json)
    blocked, gating_path, sidecar_path = _challenger_findings_missing(project, step, governance_review)
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
                '--challenger-skip-reason "..."'
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
            "remediation": 'Provide --challenger-skip-reason "<auditable reason>"',
        }
        if as_json:
            print(json.dumps(msg))
        else:
            print('--allow-missing-challenger requires --challenger-skip-reason "<reason>" for the audit trail.')
        return 2

    invalid = _challenger_findings_invalid(project, step, governance_review)
    if invalid:
        return _report_invalid_review(project, step, invalid, as_json)

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
    if selection:
        data.setdefault("decision_log", []).append({**selection, "timestamp": now})

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
# .github/skills/apex-workflow-engine/templates/workflow-graph.json. Keep in
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
