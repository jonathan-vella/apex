"""Tests for tools/scripts/smoke_verify.py."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "smoke_verify.py"
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "otel-log-min.json"


def _load():
    spec = importlib.util.spec_from_file_location("smoke_verify", SCRIPT)
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)  # type: ignore[union-attr]
    return m


def test_find_newest_log_returns_path_or_none():
    mod = _load()
    result = mod.find_newest_log()
    assert result is None or result.suffix == ".json"


def test_post_clear_signals_missing_when_no_clear():
    """The min fixture has only one SessionStart → no /clear boundary."""
    mod = _load()
    profiler = _load()  # smoke_verify imports profile_debug_log dynamically
    # Load spans via the bundled loader
    prof_spec = importlib.util.spec_from_file_location(
        "profile_debug_log",
        REPO_ROOT / "tools" / "scripts" / "profile_debug_log.py",
    )
    assert prof_spec and prof_spec.loader
    profiler = importlib.util.module_from_spec(prof_spec)
    prof_spec.loader.exec_module(profiler)  # type: ignore[union-attr]
    spans = profiler.load_spans(FIXTURE)
    result = mod.compute_post_clear_signals(spans)
    assert result["post_clear_seen"] is False
    assert result["post_clear_first_input_tokens"] is None
    assert result["post_clear_first_tool_signature"] is None


def test_post_clear_signals_detected_with_two_session_starts(tmp_path):
    """Synthesise a 2-session log → post-clear boundary detected."""
    mod = _load()
    log = {
        "resourceSpans": [
            {
                "resource": {},
                "scopeSpans": [
                    {
                        "spans": [
                            {"name": "SessionStart", "startTimeUnixNano": "1", "endTimeUnixNano": "2"},
                            {
                                "name": "chat:gpt-5.3-codex",
                                "startTimeUnixNano": "3",
                                "endTimeUnixNano": "4",
                                "attributes": [
                                    {"key": "gen_ai.usage.input_tokens", "value": {"intValue": 90000}}
                                ],
                            },
                            {"name": "Stop", "startTimeUnixNano": "5", "endTimeUnixNano": "6"},
                            {"name": "SessionStart", "startTimeUnixNano": "7", "endTimeUnixNano": "8"},
                            {
                                "name": "chat:gpt-5.3-codex",
                                "startTimeUnixNano": "9",
                                "endTimeUnixNano": "10",
                                "attributes": [
                                    {"key": "gen_ai.usage.input_tokens", "value": {"intValue": 30000}}
                                ],
                            },
                            {
                                "name": "run_in_terminal",
                                "startTimeUnixNano": "11",
                                "endTimeUnixNano": "12",
                                "attributes": [
                                    {"key": "gen_ai.operation.name", "value": {"stringValue": "execute_tool"}},
                                    {"key": "gen_ai.tool.name", "value": {"stringValue": "run_in_terminal"}},
                                    {
                                        "key": "gen_ai.tool.call.arguments",
                                        "value": {"stringValue": "apex-recall show smoke-test --json"},
                                    },
                                ],
                            },
                        ]
                    }
                ],
            }
        ]
    }
    p = tmp_path / "log.json"
    p.write_text(json.dumps(log))

    prof_spec = importlib.util.spec_from_file_location(
        "profile_debug_log",
        REPO_ROOT / "tools" / "scripts" / "profile_debug_log.py",
    )
    assert prof_spec and prof_spec.loader
    profiler = importlib.util.module_from_spec(prof_spec)
    prof_spec.loader.exec_module(profiler)  # type: ignore[union-attr]
    spans = profiler.load_spans(p)

    result = mod.compute_post_clear_signals(spans)
    assert result["post_clear_seen"] is True
    assert result["post_clear_first_input_tokens"] == 30000
    assert "apex-recall show" in result["post_clear_first_tool_signature"]


def test_cli_pass_on_synthetic_clean_log(tmp_path):
    """A log that meets every acceptance target should exit 0."""
    log = {
        "resourceSpans": [
            {
                "resource": {},
                "scopeSpans": [
                    {
                        "spans": [
                            {"name": "SessionStart", "startTimeUnixNano": "1", "endTimeUnixNano": "2"},
                            {"name": "turn_start:0", "startTimeUnixNano": "3", "endTimeUnixNano": "4"},
                            {
                                "name": "chat:gpt-5.3-codex",
                                "startTimeUnixNano": "5",
                                "endTimeUnixNano": "6",
                                "attributes": [
                                    {"key": "gen_ai.usage.input_tokens", "value": {"intValue": 50000}}
                                ],
                            },
                            {"name": "Stop", "startTimeUnixNano": "7", "endTimeUnixNano": "8"},
                            {"name": "SessionStart", "startTimeUnixNano": "9", "endTimeUnixNano": "10"},
                            {
                                "name": "chat:gpt-5.3-codex",
                                "startTimeUnixNano": "11",
                                "endTimeUnixNano": "12",
                                "attributes": [
                                    {"key": "gen_ai.usage.input_tokens", "value": {"intValue": 20000}}
                                ],
                            },
                            {
                                "name": "run_in_terminal",
                                "startTimeUnixNano": "13",
                                "endTimeUnixNano": "14",
                                "attributes": [
                                    {"key": "gen_ai.operation.name", "value": {"stringValue": "execute_tool"}},
                                    {"key": "gen_ai.tool.name", "value": {"stringValue": "run_in_terminal"}},
                                    {
                                        "key": "gen_ai.tool.call.arguments",
                                        "value": {"stringValue": "apex-recall show smoke-test --json"},
                                    },
                                ],
                            },
                        ]
                    }
                ],
            }
        ]
    }
    p = tmp_path / "log.json"
    p.write_text(json.dumps(log))
    out = tmp_path / "out.json"
    r = subprocess.run(
        [sys.executable, str(SCRIPT), str(p), "--out", str(out)],
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, f"expected 0, got {r.returncode}: {r.stdout} {r.stderr}"
    assert "ACCEPTANCE PASSED" in r.stdout
    assert out.is_file()
    saved = json.loads(out.read_text())
    assert "_computed" in saved


def test_cli_fail_on_baseline_outlier(tmp_path):
    """test04-01 is the worst-case outlier — must fail every target."""
    log = REPO_ROOT / "logs" / "test04-01.json"
    if not log.exists():
        return  # baseline corpus not extracted; skip silently
    out = tmp_path / "out.json"
    r = subprocess.run(
        [sys.executable, str(SCRIPT), str(log), "--out", str(out)],
        capture_output=True,
        text=True,
    )
    assert r.returncode == 1
    assert "ACCEPTANCE FAILED" in r.stdout
    assert "FAIL" in r.stdout


def test_jsonl_to_otel_basic_shape(tmp_path):
    """A minimal JSONL with one llm_request converts to a profileable OTel envelope."""
    mod = _load()
    jsonl_path = tmp_path / "main.jsonl"
    records = [
        {
            "ts": 1700000000000,
            "dur": 0,
            "sid": "fixture",
            "type": "session_start",
            "name": "session_start",
            "spanId": "s0",
            "status": "ok",
        },
        {
            "ts": 1700000001000,
            "dur": 1500,
            "sid": "fixture",
            "type": "llm_request",
            "name": "chat:gpt-5.3-codex",
            "spanId": "s1",
            "status": "ok",
            "attrs": {"model": "gpt-5.3-codex", "inputTokens": 12345, "outputTokens": 100},
        },
        {
            "ts": 1700000002500,
            "dur": 10,
            "sid": "fixture",
            "type": "tool_call",
            "name": "read_file",
            "spanId": "s2",
            "status": "ok",
            "attrs": {"args": '{"filePath":"path/REDACTED"}', "result": "{}"},
        },
    ]
    jsonl_path.write_text("\n".join(json.dumps(r) for r in records))
    envelope = mod.jsonl_to_otel(jsonl_path)
    spans = envelope["resourceSpans"][0]["scopeSpans"][0]["spans"]
    assert len(spans) == 3

    # llm_request → chat: span with gen_ai.usage.input_tokens
    chat_span = next(s for s in spans if s["name"] == "chat:gpt-5.3-codex")
    keys = {a["key"] for a in chat_span["attributes"]}
    assert "gen_ai.operation.name" in keys
    assert "gen_ai.request.model" in keys
    assert "gen_ai.usage.input_tokens" in keys

    # tool_call → execute_tool with gen_ai.tool.name
    tool_span = next(s for s in spans if s["name"] == "read_file")
    keys = {a["key"] for a in tool_span["attributes"]}
    assert "gen_ai.operation.name" in keys
    assert "gen_ai.tool.name" in keys


def test_jsonl_to_otel_normalizes_subagent_name(tmp_path):
    """child_session_ref runSubagent-challenger-... → bare challenger-review-subagent."""
    mod = _load()
    jsonl_path = tmp_path / "main.jsonl"
    record = {
        "ts": 1700000000000,
        "dur": 1000,
        "sid": "fixture",
        "type": "child_session_ref",
        "name": "runSubagent-challenger-review-subagent",
        "spanId": "s0",
        "status": "ok",
        "attrs": {"childSessionId": "x", "label": "x"},
    }
    jsonl_path.write_text(json.dumps(record))
    envelope = mod.jsonl_to_otel(jsonl_path)
    span = envelope["resourceSpans"][0]["scopeSpans"][0]["spans"][0]
    assert span["name"] == "challenger-review-subagent"


def test_jsonl_to_otel_then_profile_roundtrip(tmp_path):
    """Convert JSONL → OTel → load via profile_debug_log: totals should match."""
    mod = _load()
    prof_spec = importlib.util.spec_from_file_location(
        "profile_debug_log",
        REPO_ROOT / "tools" / "scripts" / "profile_debug_log.py",
    )
    assert prof_spec and prof_spec.loader
    profiler = importlib.util.module_from_spec(prof_spec)
    prof_spec.loader.exec_module(profiler)  # type: ignore[union-attr]

    jsonl_path = tmp_path / "main.jsonl"
    records = [
        {
            "ts": 1700000001000,
            "dur": 100,
            "sid": "fixture",
            "type": "llm_request",
            "name": "chat:gpt-5.3-codex",
            "spanId": "s1",
            "status": "ok",
            "attrs": {"model": "gpt-5.3-codex", "inputTokens": 5000, "outputTokens": 50},
        },
    ]
    jsonl_path.write_text("\n".join(json.dumps(r) for r in records))

    converted = tmp_path / "converted.json"
    converted.write_text(json.dumps(mod.jsonl_to_otel(jsonl_path)))
    spans = profiler.load_spans(converted)
    metrics = profiler.profile(spans)
    assert metrics["totals"]["input_tokens"] == 5000
    assert metrics["totals"]["output_tokens"] == 50
    assert metrics["totals"]["chat_calls"] == 1
