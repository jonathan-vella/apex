"""Tests for `apex-recall show --json` emitting a `steps` field.

Regression for Phase G3 / F1a in
.github/prompts/plan-applyNordicFoodsLessons.prompt.md — `show.py` previously
omitted `steps`, which caused downstream `jq '.session.steps | to_entries[]'`
queries to iterate over null and fail. The field must now always be present
(defaulting to `{}`) so consumers can rely on schema shape.

Run with:
    cd tools/apex-recall && python -m pytest tests/test_show_steps.py
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
    """Reimport apex_recall with APEX_ROOT pinned so the indexer scans `root`."""
    os.environ["APEX_ROOT"] = str(root)
    for mod in list(sys.modules):
        if mod.startswith("apex_recall"):
            del sys.modules[mod]
    return importlib.import_module("apex_recall.commands.show")


def _write_session_state(root: Path, project: str, payload: dict) -> None:
    proj_dir = root / "agent-output" / project
    proj_dir.mkdir(parents=True, exist_ok=True)
    (proj_dir / "00-session-state.json").write_text(json.dumps(payload), encoding="utf-8")


def _capture_show(show_mod, project: str) -> dict:
    args = SimpleNamespace(project=project, json=True)
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = show_mod.run(args)
    assert rc == 0, "show.run must return 0"
    out = buf.getvalue().strip()
    assert out, "show.run must print JSON when --json is set"
    return json.loads(out)


def test_show_emits_steps_for_empty_session(tmp_path: Path) -> None:
    """A session with no `steps` key still surfaces `steps: {}` in show output."""
    project = "empty-proj"
    payload = {
        "schema_version": "3.0",
        "project": project,
        "current_step": 0,
        "iac_tool": "",
        "region": "swedencentral",
        "updated": "2026-05-13T00:00:00Z",
        "decisions": {},
        "open_findings": [],
        "decision_log": [],
        # Intentionally omit `steps` to verify the show.py default kicks in.
    }
    _write_session_state(tmp_path, project, payload)
    show_mod = _reimport_with_root(tmp_path)
    result = _capture_show(show_mod, project)
    assert "session" in result, f"missing session key in output: {result!r}"
    assert "steps" in result["session"], "session.steps must be present"
    assert result["session"]["steps"] == {}, "default steps must be empty dict"


def test_show_emits_steps_when_populated(tmp_path: Path) -> None:
    """A populated `steps` map round-trips through show output unchanged."""
    project = "populated-proj"
    steps = {
        "1": {"name": "Requirements", "status": "complete", "agent": "02-Requirements"},
        "5": {"name": "IaC Code", "status": "complete", "sub_step": "phase_4_validation"},
    }
    payload = {
        "schema_version": "3.0",
        "project": project,
        "current_step": 5,
        "iac_tool": "Bicep",
        "region": "swedencentral",
        "updated": "2026-05-13T00:00:00Z",
        "decisions": {},
        "open_findings": [],
        "decision_log": [],
        "steps": steps,
    }
    _write_session_state(tmp_path, project, payload)
    show_mod = _reimport_with_root(tmp_path)
    result = _capture_show(show_mod, project)
    assert result["session"]["steps"] == steps, "steps map must round-trip verbatim"
    # Sanity: keys are strings — `.key=="5"` jq queries depend on this
    assert all(isinstance(k, str) for k in result["session"]["steps"].keys())
