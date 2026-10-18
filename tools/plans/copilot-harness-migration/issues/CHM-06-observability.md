## CHM-06: validate genuine evidence and optional usage

GitHub: [#768](https://github.com/jonathan-vella/apex/issues/768).
Requirements: R6, R9. Priority: P1. Depends on: CHM-16.
Status: proposed scope; the earlier strict PASS with synthetic shutdown remains withdrawn.

### Objective and inputs

Make evidence handling useful for the final VS Code target without creating a mandatory attestation framework.
Use a genuinely selected runtime capture, actual runtime fields, final role/result contracts and existing
`profile_debug_log.py`, `export-sdk-logs.py`, `smoke_verify.py` and tests.
Source presence and old numeric thresholds do not prove runtime coverage or current product value.

### Allowed changes and behavior

Only affected profiling/export/smoke adapters, their tests and associated on-demand guidance.
No unrelated session scans, global newest-session lookup, raw-log publication or project-state edits.
Preserve historical native/OTel readers where required.
Native usage/context facilities are primary; optional diagnostics do not grant permission or certify billing.

### Validation and negative cases

Run `python3 -m pytest tools/tests/scripts/test_sdk_events.py
tools/tests/scripts/test_export_sdk_logs.py tools/tests/scripts/test_profile_debug_log.py
tools/tests/scripts/test_native_log_parser.py tools/tests/scripts/test_smoke_verify.py -q`.
For permitted actual captures, invoke the existing profiler/export commands with explicit session/workspace input.
Review old smoke thresholds and exact event sequencing individually: keep justified behavior checks,
adapt unsupported assumptions and retire unmeasured conventions with tests in the same slice.

Test missing usage (UNKNOWN, not zero), duplicate authoritative usage, wrong workspace, partial root capture,
later resume, malformed payload, failed tool, missing attribution and redaction.
Never append shutdown/events or reconstruct review content to force PASS.

### Acceptance and evidence

- [ ] Relevant behavior claims are supported by genuine, exact-scope observations.
- [ ] Required behavior gaps block; optional usage gaps remain explicitly UNKNOWN.
- [ ] Historical readers and privacy/redaction behavior have regression coverage.
- [ ] Retained thresholds have rationale; removed prose/metrics gates have caller/test closure.
- [ ] No token/cost/latency saving, real billing or approval claim is inferred from incomplete data.

Return commands/results, input identities, coverage/unknowns and evidence references for CHM-17.
Rollback only this packet's adapter changes; do not alter raw history.
Stop on privacy/scope ambiguity or an unavailable required field. No merge, auto-merge or Azure actions.
