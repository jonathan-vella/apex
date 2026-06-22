<!-- ref:log-profiling-v1 -->

# Log profiling — `profile_debug_log.py`

Profiles Copilot Chat OTel debug logs for the token-reduction
workstream. Used by `11-Context Optimizer` during audits and by the
multi-log baselining workflow under
`agent-output/_baselines/`.

## Quick start

```sh
# Plain-text summary
python3 tools/scripts/profile_debug_log.py logs/test04-01.json

# Machine-readable JSON
python3 tools/scripts/profile_debug_log.py logs/test04-01.json --json

# npm alias (parity with other repo scripts)
npm run profile:debug-log -- logs/test04-01.json
```

## What it extracts

| Section                  | Field                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| Totals                   | `input_tokens`, `output_tokens`, `chat_calls`, avg/p50/max input/call |
| askQuestions             | Count + per-call durations                                            |
| Subagents                | Total invocations, challenger invocations                             |
| Wall time                | `session_total`, `agent_chat`, `subagent`, `user_wait_askquestions`   |
| Tokens by model          | Per-model input/output/calls/avg                                      |
| Input-token buckets      | `<10K`, `10K-50K`, `50K-100K`, `100K-200K`, `>=200K`                  |
| Top tool payloads        | 10 largest tools by `arguments + result` byte sum                     |
| Duplicate file reads     | `read_file` paths invoked > 1× (Phase 2c signal)                      |
| Errors                   | Total raw + non-benign list (ENOENT-style filtered out)               |
| Compliance metrics       | `max_chat_spans_between_clears`, `max_askquestions_in_single_phase`   |
| Warnings                 | Threshold-exceeded notes (informational only)                         |

## Compliance thresholds

Two informational warnings drop into the output when a session
violates a token-reduction contract — exit code stays 0.

- `--max-spans-between-clears N` (default `50`) flags any run of
  `chat:*` spans between `SessionStart`/`Stop` markers that exceeds
  `N`. Backs **Phase 2a** (Gate-boundary `/clear` handoff).
- `--max-askquestions-per-phase N` (default `3`) flags any contiguous
  run between `turn_start:N` markers that exceeds `N` askQuestions
  calls. Backs **Phase 4** (batching enforcement).

## Multi-log baselining

For the **Phase 0** baseline range, run the profiler against ≥3
sessions covering different workflow shapes and roll the JSON output
into one document:

```sh
mkdir -p agent-output/_baselines
for log in logs/test04-01.json logs/agent-debug-log-*.json tmp/agent-debug-log-*.json; do
  echo "=== ${log} ==="
  python3 tools/scripts/profile_debug_log.py "${log}" --json
done > agent-output/_baselines/profile-runs.jsonl
```

Compute p50 / p90 / max manually (or with `jq`) across the sessions
for each headline metric and save the result locally as
`agent-output/_baselines/multi-log-baseline.json` (gitignored working
data). The token-reduction plan locks targets against the **p50** of
that range, never the canonical `test04-01` outlier alone.

## Tests

`tests/scripts/test_profile_debug_log.py` runs against a small
anonymised fixture (`tests/fixtures/otel-log-min.json`). File paths
are replaced with `path/REDACTED`; token counts are preserved.

```sh
python3 -m pytest tests/scripts/test_profile_debug_log.py -q
```

## Schema reference

VS Code Copilot Chat exports an OpenTelemetry payload:

```text
{
  "resourceSpans": [{ "scopeSpans": [{ "spans": [...] }] }],
  "copilotChat":   { "sessionId": "...", "sessionTitle": "..." }
}
```

Each span carries `name`, `startTimeUnixNano`, `endTimeUnixNano`,
`status.code` (0=UNSET/OK, 1=OK, 2=ERROR), and a typed
`attributes[]` list. Chat calls are `chat:<model>` spans; tool
invocations have `gen_ai.operation.name == "execute_tool"` with the
tool name in `gen_ai.tool.name`.
