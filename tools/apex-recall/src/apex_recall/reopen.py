"""Downstream invalidation when a completed step is reopened with ``start-step --force``."""

from __future__ import annotations

# Keep equal to the `requires` closure in workflow-graph.json; test_reopen.py asserts the match.
DEPENDENTS: dict[str, tuple[str, ...]] = {
    "1": ("2", "3", "3_5", "4", "5", "6", "7"),
    "2": ("3", "3_5", "4", "5", "6", "7"),
    "3": (),
    "3_5": ("4", "5", "6", "7"),
    "4": ("5", "6", "7"),
    "5": ("6", "7"),
    "6": ("7",),
    "7": (),
}
# Reopening any of these makes an existing Plan approval refer to superseded inputs.
_PLAN_INPUT_STEPS = ("1", "2", "3_5", "4")
_STALE_KEYS = ("previous_completed", "stale_since", "stale_because")


def invalidate_dependents(data, step: str, now: str) -> dict:
    """Mark dependent steps stale and supersede the Plan approval; return what changed.

    Stale is additive: readers that do not know it see a status that is not ``complete``, so
    they treat the step as unfinished. Artifacts and risk authorizations are kept as history.
    """
    stale: list[str] = []
    for key in DEPENDENTS.get(step, ()):
        entry = data["steps"].get(key)
        if not entry or entry.get("status") not in ("complete", "in_progress"):
            continue
        entry.update(
            status="stale",
            previous_completed=entry.get("completed"),
            stale_since=now,
            stale_because=f"Step {step} was reopened",
            sub_step=None,
            started=None,
            completed=None,
        )
        stale.append(key)

    superseded = None
    decisions = data.setdefault("decisions", {})
    if step in _PLAN_INPUT_STEPS and decisions.get("plan_status") in ("APPROVED", "EXCEPTION_AUTHORIZED"):
        superseded = decisions["plan_status"]
        decisions["plan_status"] = "SUPERSEDED"

    if stale or superseded:
        parts = []
        if stale:
            parts.append("steps marked stale: " + ", ".join(stale))
        if superseded:
            parts.append(f"plan_status {superseded} -> SUPERSEDED")
        data.setdefault("decision_log", []).append(
            {
                "decision": f"Step {step} reopened; " + "; ".join(parts),
                "timestamp": now,
                "rationale": "Reopening a step invalidates what was built on it; re-complete each stale step in order",
                "step": step,
            }
        )
    return {"stale_steps": stale, "superseded_plan_status": superseded}


def clear_stale(step_data: dict) -> None:
    """Drop stale markers when a stale step is started again."""
    for key in _STALE_KEYS:
        step_data.pop(key, None)
