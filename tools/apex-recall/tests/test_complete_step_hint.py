"""Tests for the `complete-step` JSON `hint` field (#425, Wave 4 follow-up).

The hint surfaces `apex-recall transition` as the preferred atomic
alternative on every successful complete-step --json. Agents that parse
the JSON pick it up; the human-readable path stays clean.

Run with:
    cd tools/apex-recall && python -m pytest tests/test_complete_step_hint.py
"""

from __future__ import annotations

import importlib
import io
import json
import os
import sys
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace


def _reimport_with_root(root: Path):
    os.environ["APEX_ROOT"] = str(root)
    for mod in list(sys.modules):
        if mod.startswith("apex_recall"):
            del sys.modules[mod]
    return importlib.import_module("apex_recall.commands.complete_step")


def _seed(root: Path, project: str) -> Path:
    proj_dir = root / "agent-output" / project
    proj_dir.mkdir(parents=True, exist_ok=True)
    state = {
        "schema_version": "session-state-v3",
        "project": project,
        "current_step": 1,
        "steps": {
            "1": {"status": "in_progress", "started": "2026-05-22T10:00:00Z"},
            "2": {"status": "not_started"},
        },
        "decisions": {},
    }
    (proj_dir / "00-session-state.json").write_text(json.dumps(state), encoding="utf-8")
    return proj_dir


def _capture(mod, args: SimpleNamespace) -> tuple[int, str]:
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = mod.run(args)
    return rc, buf.getvalue()


def test_hint_present_on_json_success(tmp_path):
    mod = _reimport_with_root(tmp_path)
    _seed(tmp_path, "demo")
    args = SimpleNamespace(
        project="demo",
        step="1",
        json=True,
        allow_missing_challenger=False,
        challenger_skip_reason=None,
    )
    rc, stdout = _capture(mod, args)
    assert rc == 0
    payload = json.loads(stdout.strip())
    assert "hint" in payload, "complete-step --json must include the 'hint' field"
    assert "apex-recall transition" in payload["hint"]
    # The hint must name the next step (Step 1 -> Step 2 for the seeded state).
    assert "--to-step 2" in payload["hint"]


def test_hint_absent_on_human_readable_success(tmp_path):
    """Without --json, no extra noise is added to stdout."""
    mod = _reimport_with_root(tmp_path)
    _seed(tmp_path, "demo")
    args = SimpleNamespace(
        project="demo",
        step="1",
        json=False,
        allow_missing_challenger=False,
        challenger_skip_reason=None,
    )
    rc, stdout = _capture(mod, args)
    assert rc == 0
    assert "hint" not in stdout, "human-readable path must stay clean (no hint pollution)"
    assert "Step 1 completed for demo" in stdout


def test_hint_handles_last_step_gracefully(tmp_path):
    """At the final step, the hint falls back to 'next' as the to-step."""
    mod = _reimport_with_root(tmp_path)
    proj_dir = _seed(tmp_path, "demo")
    state = json.loads((proj_dir / "00-session-state.json").read_text(encoding="utf-8"))
    state["steps"]["7"] = {"status": "in_progress"}
    state["current_step"] = 7
    (proj_dir / "00-session-state.json").write_text(json.dumps(state), encoding="utf-8")
    args = SimpleNamespace(
        project="demo",
        step="7",
        json=True,
        allow_missing_challenger=False,
        challenger_skip_reason=None,
    )
    rc, stdout = _capture(mod, args)
    assert rc == 0
    payload = json.loads(stdout.strip())
    assert "hint" in payload
    assert "--to-step next" in payload["hint"]
