"""Tests for tools/scripts/profile_debug_log.py.

Runs against the small anonymised OTel fixture at
``tests/fixtures/otel-log-min.json`` so it stays fast and reproducible.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "profile_debug_log.py"
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "otel-log-min.json"


@pytest.fixture(scope="module")
def profiler():
    """Load profile_debug_log as a module (path-loaded, no sys.path mutation)."""
    spec = importlib.util.spec_from_file_location("profile_debug_log", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def test_load_spans_returns_flat_list(profiler):
    spans = profiler.load_spans(FIXTURE)
    assert isinstance(spans, list)
    assert len(spans) == 5  # SessionStart, turn_start:0, chat, read_file, list_dir


def test_load_spans_rejects_malformed(profiler, tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{}")
    with pytest.raises(ValueError, match="missing resourceSpans"):
        profiler.load_spans(bad)


def test_profile_totals(profiler):
    spans = profiler.load_spans(FIXTURE)
    m = profiler.profile(spans)
    t = m["totals"]
    assert t["input_tokens"] == 45000
    assert t["output_tokens"] == 1200
    assert t["chat_calls"] == 1
    assert t["avg_input_per_call"] == 45000
    assert t["max_input_per_call"] == 45000
    # 1 raw error (list_dir status 2), 0 non-benign (ENOENT is filtered).
    assert t["error_spans_total"] == 1
    assert t["error_spans_non_benign"] == 0


def test_profile_tokens_by_model(profiler):
    spans = profiler.load_spans(FIXTURE)
    m = profiler.profile(spans)
    assert "claude-opus-4.7" in m["tokens_by_model"]
    row = m["tokens_by_model"]["claude-opus-4.7"]
    assert row["calls"] == 1
    assert row["input"] == 45000


def test_profile_tool_counts(profiler):
    spans = profiler.load_spans(FIXTURE)
    m = profiler.profile(spans)
    assert m["tool_call_counts"]["read_file"] == 1
    assert m["tool_call_counts"]["list_dir"] == 1


def test_cli_text_and_json(profiler, capsys):
    rc = profiler.main([str(FIXTURE)])
    assert rc == 0
    text_out = capsys.readouterr().out
    assert "input_tokens" in text_out

    rc = profiler.main([str(FIXTURE), "--json"])
    assert rc == 0
    json_out = capsys.readouterr().out
    parsed = json.loads(json_out)
    assert parsed["totals"]["input_tokens"] == 45000


def test_cli_handles_missing_file(profiler, capsys):
    rc = profiler.main(["does/not/exist.json"])
    assert rc == 1
    err = capsys.readouterr().err
    assert "error:" in err


def test_main_module_path():
    # Sanity: the script is importable as a file and is executable.
    assert SCRIPT.exists()
    assert SCRIPT.stat().st_mode & 0o111 or sys.platform.startswith("win")
