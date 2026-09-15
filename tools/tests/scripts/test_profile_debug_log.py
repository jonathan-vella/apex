"""Tests for tools/scripts/profile_debug_log.py.

Runs against the small anonymised OTel fixture under ``tools/tests/fixtures``
so it stays fast and reproducible.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "profile_debug_log.py"
FIXTURE = REPO_ROOT / "tools" / "tests" / "fixtures" / "otel-log-min.json"


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


@pytest.mark.parametrize("arguments", ['{"agentName":"challenger-review-subagent"}', "{", "[]", "{}"])
def test_run_subagent_counts_attempts_without_inventing_identity(profiler, arguments):
    span = {
        "traceId": "review",
        "spanId": "call",
        "name": "runSubagent",
        "startTimeUnixNano": "1000000000",
        "endTimeUnixNano": "3000000000",
        "attributes": [
            {"key": "gen_ai.operation.name", "value": {"stringValue": "execute_tool"}},
            {"key": "gen_ai.tool.call.arguments", "value": {"stringValue": arguments}},
        ],
    }
    result = profiler.profile([span, span])
    assert result["totals"]["subagent_invocations"] == 1
    assert result["totals"]["challenger_invocations"] == int("challenger-review-subagent" in arguments)
    assert result["wall_time_s"]["subagent"] == 2


@pytest.mark.parametrize("tool_is_parent", [True, False])
def test_subagent_tool_and_related_named_span_count_once(profiler, tool_is_parent):
    tool = {
        "traceId": "review",
        "spanId": "tool",
        "name": "runSubagent",
        "attributes": [
            {"key": "gen_ai.operation.name", "value": {"stringValue": "execute_tool"}},
            {
                "key": "gen_ai.tool.call.arguments",
                "value": {"stringValue": '{"agentName":"challenger-review-subagent"}'},
            },
        ],
    }
    legacy = {"traceId": "review", "spanId": "legacy", "name": "challenger-review-subagent"}
    if tool_is_parent:
        legacy["parentSpanId"] = "tool"
    else:
        tool["parentSpanId"] = "legacy"
    independent = {"traceId": "other", "spanId": "legacy", "name": "execution_subagent"}
    result = profiler.profile([legacy, tool, independent])
    assert result["totals"]["subagent_invocations"] == 2
    assert result["totals"]["challenger_invocations"] == 1


def test_tool_payload_sizes_use_utf8_bytes(profiler):
    span = {
        "name": "read_file",
        "attributes": [
            {"key": "gen_ai.operation.name", "value": {"stringValue": "execute_tool"}},
            {"key": "gen_ai.tool.call.result", "value": {"stringValue": "\u00e9"}},
        ],
    }
    assert profiler.profile([span])["top_tool_payloads"][0]["bytes"] == 2


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
    # The package script invokes this file through Python, so it need not carry an executable bit.
    assert SCRIPT.exists()


def test_probe_evidence_omits_payloads_and_does_not_guess_attribution(profiler):
    def event(name, operation, start, **extra):
        return {
            "traceId": "probe",
            "spanId": name,
            "name": name,
            "startTimeUnixNano": str(start),
            "attributes": [{"key": "gen_ai.operation.name", "value": {"stringValue": operation}}]
            + [{"key": key, "value": {"stringValue": value}} for key, value in extra.items()],
        }

    todo = event("manage_todo_list", "execute_tool", 10, **{"gen_ai.tool.call.arguments": "PRIVATE_SENTINEL"})
    chat = event("chat", "chat", 20, **{"gen_ai.request.model": "test-model"})
    read = event("read_file", "execute_tool", 30, **{"gen_ai.tool.call.result": "PRIVATE_SENTINEL"})
    result = profiler.probe_evidence([read, todo, chat, todo])
    assert "PRIVATE_SENTINEL" not in json.dumps(result)
    assert result["duplicate_spans_omitted"] == 1
    assert [item["before_first_model_request"] for item in result["tool_events"]] == [False, True]
    assert all(item["invocation_attribution"] == "unknown" for item in result["tool_events"])
    assert result["model_requests"][0]["model"] == "test-model"
    assert result["verdict"] == "requires review"


def test_probe_evidence_missing_timing_is_unknown(profiler):
    result = profiler.probe_evidence(
        [
            {
                "name": "read_file",
                "attributes": [{"key": "gen_ai.operation.name", "value": {"stringValue": "execute_tool"}}],
            }
        ]
    )
    assert result["tool_events"][0]["before_first_model_request"] is None
    assert result["model_requests"] == []


def test_probe_evidence_retains_conflicting_span_ids(profiler):
    first = {
        "traceId": "probe",
        "spanId": "same",
        "name": "read_file",
        "attributes": [{"key": "gen_ai.operation.name", "value": {"stringValue": "execute_tool"}}],
    }
    second = {**first, "name": "run_in_terminal"}
    result = profiler.probe_evidence([first, second])
    assert result["conflicting_span_ids"] == 1
    assert [item["tool"] for item in result["tool_events"]] == ["read_file", "run_in_terminal"]
    assert result["duplicate_spans_omitted"] == 0


def test_probe_cli_omits_unsupplied_text(profiler, capsys):
    assert profiler.main([str(FIXTURE), "--probe-evidence"]) == 0
    result = json.loads(capsys.readouterr().out)
    assert "supplied_text" not in result
    assert result["prompt_response_source"] == "not extracted"
    assert result["verdict"] == "requires review"


def test_probe_cli_links_separately_reviewed_text(profiler, capsys, tmp_path):
    prompt = tmp_path / "prompt.txt"
    response = tmp_path / "response.txt"
    prompt.write_text("Reviewed hypothetical prompt")
    response.write_text("Reviewed hypothetical answer")
    assert (
        profiler.main(
            [str(FIXTURE), "--probe-evidence", "--reviewed-prompt", str(prompt), "--reviewed-response", str(response)]
        )
        == 0
    )
    result = json.loads(capsys.readouterr().out)
    assert len(result["log_sha256"]) == 64
    assert result["supplied_text"]["prompt"] == prompt.read_text()
    assert "not verified" in result["supplied_text"]["source"]
    assert "tool_payload_bytes" not in result
    with pytest.raises(SystemExit):
        profiler.main([str(FIXTURE), "--probe-evidence", "--reviewed-prompt", str(prompt)])


def test_partial_usage_preserves_observed_values_without_zero_denominator(profiler):
    complete = {
        "name": "chat:test",
        "attributes": [
            {"key": "gen_ai.usage.input_tokens", "value": {"intValue": 120}},
            {"key": "gen_ai.usage.output_tokens", "value": {"stringValue": "invalid"}},
        ],
    }
    missing = {"name": "chat:test", "attributes": []}
    result = profiler.profile([complete, missing])
    assert result["totals"]["input_tokens"] == 120
    assert result["totals"]["avg_input_per_call"] == 120
    assert result["usage_coverage"]["complete"] is False
    assert result["usage_coverage"]["input_samples"] == 1
    assert result["usage_coverage"]["output_samples"] == 0
    assert any("lower bounds" in warning for warning in result["warnings"])


def test_duplicate_exported_spans_do_not_double_count_tokens(profiler):
    spans = profiler.load_spans(FIXTURE)
    result = profiler.profile(spans + spans)
    assert result["totals"]["input_tokens"] == 45000
    assert result["totals"]["chat_calls"] == 1
    assert result["usage_coverage"]["duplicate_exported_spans"] == len(spans)
    assert result["usage_coverage"]["complete"] is True


@pytest.mark.parametrize("value", [-1, 1.5, True, "-5", "1.2", None])
def test_invalid_usage_is_unknown_not_a_measured_zero(profiler, value):
    assert profiler._token_count(value) is None


def test_empty_profile_is_not_complete_usage(profiler):
    assert profiler.profile([])["usage_coverage"]["complete"] is False
