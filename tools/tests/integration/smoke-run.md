# VS Code Copilot SDK Smoke Acceptance

Manual, non-deploying Steps 1–2 acceptance for the supported SDK harness inside VS Code.
Static fixtures and built-in worker probes do not certify custom-agent discovery,
model/effort routing, tools, continuation, human gates or MCP binding.
Use a dedicated approved smoke project; never reset an existing project's state.

## Runtime Preconditions

1. Reload the VS Code runtime after definition changes and select `01-Orchestrator`.
2. Verify required MCP tools and hooks in that runtime. Do not duplicate live MCP
   registrations, change credentials or substitute models to force a pass.
3. Use `/apex-workflow-start` with an explicit fresh operation and project.
4. Before specialist work, follow the
   [tool-free worker protocol](../../../.github/skills/apex-workflow-engine/references/worker-readiness.md).
   Require matching actual configured/dispatched model evidence, parent linkage
   and background configuration. Run `--phase initial` for `MODEL_VERIFIED`
   (`continuation_verified: false`) before the nonce-only continuation; after the
   exact same-worker ACK and second turn completion, run `--phase complete` for
   `READY_VERIFIED` (`continuation_verified: true`) before `WORKER_EXECUTE`.
   The old pinned SDK profile does not establish unpinned Auto behavior; absent
   supported unpinned telemetry is a blocker, not permission to probe or substitute.
5. Stop on unknown routing, unavailable tools, missing approval or an operator deadline.
   A readiness result grants no project or deployment permission.

## Workflow Probe

1. Confirm Requirements discovery is one native `ask_user` form with independently typed fields,
   not a Local question API payload. The interactive parent mediates worker forms.
2. Exercise an input-required continuation without duplicating already answered questions.
   Decline never approves; cancellation stops.
3. Complete Requirements and its required independent review. Checkpoint through
   `apex-recall`, preserve output paths and present Gate 1 separately.
4. After explicit Gate 1 approval, verify and dispatch the exact Architect worker.
   Exercise a resumed worker whose first execution tool is
   `apex-recall show <project> --json`. Readiness and ACK turns remain tool-free.
5. Verify comprehensive architecture and separate cost-feasibility reviews in default mode.
   Reuse current valid evidence; missing/stale reviews and unresolved blockers cannot approve Gate 2.
6. Stop at Gate 2 without advancing into Governance, CodeGen or deployment.
   Persist the handoff; worker completion is not next-step approval.
7. Close the captured session. Do not infer a closed capture from Local `/clear` markers.
   A later resume reopens the capture even if its timestamp precedes the appended shutdown.

## Capture And Automated Evidence

Select the exact native session log; scoped export remains an optional separate manual skill.
No raw conversion or copying is required for profiling:

```bash
npm run profile:debug-log -- ~/.copilot/session-state/SELECTED_SESSION_ID/events.jsonl --json
npm run smoke:verify -- ~/.copilot/session-state/SELECTED_SESSION_ID/events.jsonl --strict
npm run validate:review-ceiling -- --budget ~/.copilot/session-state/SELECTED_SESSION_ID/events.jsonl --strict
```

Smoke output defaults to ignored baseline storage; use `--out` for an explicit alternative.
`--no-auto-discovery` requires a path; `--no-auto-export` is its compatibility alias.
Without a path, discovery is restricted to exact repository identity, never the newest global session.

| Automated signal      | Required captured evidence                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Format                | Native SDK, not historical Local/OTel                                                      |
| Usage                 | Input/output present for every observed call; authoritative usage counted once             |
| Scope                 | Root capture closed; no incomplete operations, unattributed usage or unknown actual models |
| `ask_user`            | At most 20 calls across the captured scope                                                 |
| First execution input | At most 45,000 tokens for every attributed worker execution                                |
| Resume                | Explicitly resumed execution with successful first-tool recall recovery                    |
| Reviews               | Attributed default-mode Challenger execution requests, at most 2 per step                  |
| Errors                | No non-benign observed errors                                                              |

Missing evidence is `UNKNOWN` and non-passing, not zero or a skipped success.
Cache totals are observed samples, not billing. Historical `/clear` and phase counters
are unavailable for native logs; do not infer phase boundaries from timestamps.
Readiness alone never counts as executed review work.
Received worker execution envelopes and matching send-tool records count once.
External-only transport completions do not prove tool success and remain non-passing.

## Acceptance Boundary

Automated telemetry acceptance is necessary but not sufficient. Record actual custom-agent
discovery, model/tool binding, continuation, independent review and human-stop observations.
It does not certify complete billing, review validity, approval or deployment success.
Never restamp existing review evidence or mutate another project's state to make a probe pass.
