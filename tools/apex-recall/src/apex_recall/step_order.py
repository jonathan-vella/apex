"""Light step-order check. A human can always override it with a logged reason."""

from __future__ import annotations

# Step 3 (Design) is optional, so Governance (3_5) follows Architecture directly.
PREDECESSOR = {"2": "1", "3": "2", "3_5": "2", "4": "3_5", "5": "4", "6": "5", "7": "6"}
_DONE = ("complete", "skipped")


def _status(data: dict, step: str) -> str | None:
    return data.get("steps", {}).get(step, {}).get("status")


def order_problem(data: dict, step: str, *, completing: bool, completed_now: tuple[str, ...] = ()) -> str | None:
    """Return a plain-language problem, or None when the step is in order."""
    predecessor = PREDECESSOR.get(step)
    if predecessor is None:
        return None
    predecessor_done = _status(data, predecessor) in _DONE or predecessor in completed_now
    if completing:
        if _status(data, step) in ("in_progress", "complete") or predecessor_done:
            return None
        return f"Step {step} was never started and Step {predecessor} is not complete"
    if _status(data, step) == "in_progress" or predecessor_done:
        return None
    return f"Step {predecessor} is not complete, so Step {step} cannot start yet"


def check_order(
    data: dict, step: str, override: str | None, now: str, *, completing: bool, completed_now: tuple[str, ...] = ()
) -> None:
    """Raise ValueError on an out-of-order step unless an override reason is given; log the override."""
    problem = order_problem(data, step, completing=completing, completed_now=completed_now)
    if problem is None:
        return
    reason = (override or "").strip()
    if not reason:
        raise ValueError(f'{problem}. A human can proceed with --allow-out-of-order "<reason>".')
    data.setdefault("decisions", {}).setdefault("order_overrides", []).append(
        {"step": step, "problem": problem, "reason": reason, "recorded": now}
    )


def report_order_error(project: str, step: str, error: Exception, as_json: bool) -> int:
    import json

    if as_json:
        print(json.dumps({"project": project, "step": step, "error": "step_out_of_order", "reason": str(error)}))
    else:
        print(f"Refusing step {step}: {error}")
    return 2
