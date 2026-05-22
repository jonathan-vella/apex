"""apex-recall transition — composite step-transition (#425, Wave 4).

Bundles N×``decide`` + optional ``complete-step`` + next-step ``start-step``
into ONE atomic ``00-session-state.json`` write. The composite exists because
agents that sequenced these as separate calls historically left state
inconsistent on crash (decision recorded but step not advanced, complete-step
written without the follow-up start-step, etc.).

Out of scope: ``checkpoint`` (sub_step / phase / artifact / telemetry
recording) is still a separate command. ``transition`` is intentionally
narrow — it only moves the workflow pointer (decisions → complete → start).

Atomicity scope (per adversarial review wf425-06)
-------------------------------------------------
This command guarantees atomicity ONLY for the single ``write_state`` call to
``00-session-state.json``. The SQLite recall index is reindexed AFTER the
atomic write by ``write_state``; a crash between the JSON write and index
commit leaves the index stale, which the next ``apex-recall reindex`` repairs.
``transition`` does NOT touch ``00-handoff.md``.

Challenger enforcement (per wf425-09)
-------------------------------------
When ``--complete`` is passed, the challenger gate from
``complete_step._challenger_findings_missing`` runs BEFORE any state mutation.
On gate failure, the command refuses (exit 2) without writing — preserving the
same semantics as direct ``complete-step``. ``validate:challenger-presence``
remains the authoritative CI fallback.

CLI shape
---------
    apex-recall transition <project>
        --from-step <step>
        --to-step <step>
        [--decision key=value ...]   # repeatable; Mode A only (decisions{})
        [--complete]                  # mark from-step complete (gated)
        [--allow-missing-challenger --challenger-skip-reason "..."]
        [--json]
"""

from __future__ import annotations

import json
import sys

from ..state_writer import (
    _iso_now,
    migrate_to_v3,
    read_state,
    session_state_path,
    step_to_int,
    validate_step_key,
    write_state,
)
from .complete_step import _challenger_findings_missing, _record_skip


def _parse_decisions(raw_pairs: list[str] | None) -> dict[str, str]:
    """Parse repeated ``--decision key=value`` flags. Reject malformed entries."""
    out: dict[str, str] = {}
    if not raw_pairs:
        return out
    for pair in raw_pairs:
        if "=" not in pair:
            raise ValueError(
                f"--decision expects key=value (got: {pair!r})",
            )
        key, value = pair.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            raise ValueError(f"--decision key is empty in {pair!r}")
        out[key] = value
    return out


def run(args) -> int:  # noqa: C901 — one CLI dispatcher, branchy by design
    project = args.project
    from_step = validate_step_key(args.from_step)
    to_step = validate_step_key(args.to_step)
    complete = bool(getattr(args, "complete", False))
    allow_missing = bool(getattr(args, "allow_missing_challenger", False))
    skip_reason = (getattr(args, "challenger_skip_reason", None) or "").strip()
    as_json = bool(getattr(args, "json", False))

    try:
        decisions = _parse_decisions(getattr(args, "decision", None))
    except ValueError as exc:
        msg = {"error": str(exc)}
        if as_json:
            print(json.dumps(msg))
        else:
            print(f"Error: {exc}", file=sys.stderr)
        return 1

    # Challenger gate (only when completing from_step). Read-only; runs
    # before any state mutation so a gate failure does not partially write.
    if complete:
        blocked, gating_path, sidecar_path = _challenger_findings_missing(project, from_step)
        if blocked and not allow_missing:
            msg = {
                "project": project,
                "step": from_step,
                "error": "challenger_findings_missing",
                "gating_artifact": gating_path,
                "required_sidecar": sidecar_path,
                "remediation": (
                    "Run the challenger-review-subagent against the gating artifact "
                    "and produce the required findings sidecar, then re-run "
                    "`apex-recall transition`. To bypass intentionally, pass "
                    '--allow-missing-challenger --challenger-skip-reason "..."'
                ),
            }
            if as_json:
                print(json.dumps(msg))
            else:
                print(
                    f"Refusing to transition: challenger findings missing for step {from_step}.\n"
                    f"  gating artifact: {gating_path}\n"
                    f"  required sidecar: {sidecar_path}\n"
                    f"  -> {msg['remediation']}"
                )
            return 2
        if blocked and allow_missing and not skip_reason:
            msg = {
                "project": project,
                "step": from_step,
                "error": "challenger_skip_reason_required",
                "remediation": 'Provide --challenger-skip-reason "<auditable reason>"',
            }
            if as_json:
                print(json.dumps(msg))
            else:
                print(
                    "--allow-missing-challenger requires --challenger-skip-reason "
                    '"<reason>" for the audit trail.'
                )
            return 2
    else:
        blocked = False

    # Single atomic mutation.
    path = session_state_path(project)
    data = read_state(path)
    data = migrate_to_v3(data)
    now = _iso_now()

    # 1. Optionally complete from_step.
    from_data = data["steps"].get(from_step, {})
    if complete:
        from_data["status"] = "complete"
        from_data["completed"] = now
        from_data["sub_step"] = None
        if blocked and allow_missing:
            _record_skip(data, from_step, skip_reason, now)
    data["steps"][from_step] = from_data

    # 2. Record decisions in the decisions{} map.
    if decisions:
        existing_decisions = data.setdefault("decisions", {})
        # decisions is a dict in v3 schema; ignore list-shaped legacy.
        if isinstance(existing_decisions, dict):
            existing_decisions.update(decisions)
        else:
            # Defensive: replace with dict only if legacy non-dict was seen.
            data["decisions"] = dict(decisions)

    # 3. Start to_step.
    to_data = data["steps"].get(to_step, {})
    to_data["status"] = "in_progress"
    to_data["started"] = now
    to_data["completed"] = None
    data["steps"][to_step] = to_data
    data["current_step"] = step_to_int(to_step)

    write_state(project, data)

    result = {
        "project": project,
        "from_step": from_step,
        "to_step": to_step,
        "completed": complete,
        "decisions_recorded": list(decisions.keys()),
        "challenger_skip_recorded": bool(blocked and allow_missing),
        "timestamp": now,
    }
    if as_json:
        print(json.dumps(result))
    else:
        actions = []
        if complete:
            actions.append(f"completed step {from_step}")
        if decisions:
            actions.append(f"recorded {len(decisions)} decision(s)")
        actions.append(f"started step {to_step}")
        print(f"Transition {from_step} → {to_step} for {project}: " + ", ".join(actions))

    return 0
