# VS Code Copilot SDK Smoke Acceptance

Manual, non-deploying Steps 1–2 acceptance for the supported SDK harness inside VS Code.
Static fixtures and built-in worker probes do not certify custom-agent discovery,
worker identity, tools, continuation, human gates or MCP binding.
Use a dedicated approved smoke project; never reset an existing project's state.

## Runtime Preconditions

1. Reload definitions if required and select `01-Orchestrator`.
   Model selection belongs to the operator and runtime, including Auto and HydraFusion;
   model changes do not require a fresh chat or block readiness.
2. Verify required MCP tools and hooks in that runtime. Do not duplicate live MCP
   registrations, change credentials or substitute models to force a pass.
3. Use `/apex-workflow-start` with an explicit fresh operation and project.
4. Before specialist work, follow the
   [worker readiness protocol](../../../.github/skills/apex-workflow-engine/references/worker-readiness.md).
   In normal and Autopilot runs, dispatch the worker directly with `WORKER_EXECUTE`
   and verify attribution via `verify-worker-ready.mjs --phase execute` (`EXECUTE_VERIFIED`).
   For diagnostic standalone readiness probes, run `--phase initial` for `HANDSHAKE_VERIFIED`
   (`continuation_verified: false`) before the nonce-only continuation; after the
   exact same-worker ACK and second turn completion, run `--phase complete` for
   `READY_VERIFIED` (`continuation_verified: true`).
   Leave per-call model/effort/context overrides unset. Model names, effort,
   picker selection and model-source labels are optional diagnostics, not gates;
   parent, configured, dispatched and response models may differ between turns.
5. In Autopilot mode (`APEX_UNATTENDED=1` or explicit user `"run in autopilot"` / `"auto mode"`),
   `01-Orchestrator` auto-resolves discovery defaults from the project brief, applies
   `must_fix`/`should_fix` review mitigations, and auto-advances across all authorized
   gates (including test deployments when Azure test scope is authorized), pausing only
   on unresolvable blockers.

## Workflow Probe

1. Confirm Requirements discovery is one native `ask_user` form with independently typed fields,
   not a Local question API payload. The interactive parent mediates worker forms.
2. Exercise an input-required continuation without duplicating already answered questions.
   Decline never approves; cancellation stops.
3. Complete Requirements and its required independent review. Checkpoint through
   `apex-recall`, preserve output paths and present Gate 1 separately.
   Invoke built-in `rubber-duck` using the
   [one-shot review contract](../../../.github/skills/apex-azure-defaults/references/one-shot-review.md),
   `mode: sync` and no routing overrides. Do not run a reviewer handshake or ACK.
   Require linked dispatch/completion, exact recorded findings and strict freshness
   validation. The technical return stays with the same Orchestrator; Challenger
   is optional manual recovery. An exhausted allowance remains exhausted.
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

| Automated signal      | Required captured evidence                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| Format                | Native SDK, not historical Local/OTel                                          |
| Usage                 | Input/output present for every observed call; authoritative usage counted once |
| Scope                 | Root capture closed; no incomplete operations or unattributed usage            |
| `ask_user`            | At most 20 calls across the captured scope                                     |
| First execution input | At most 45,000 tokens for every attributed worker execution                    |
| Resume                | Explicitly resumed execution with successful first-tool recall recovery        |
| Reviews               | Attributed default-mode independent review requests, at most 2 per step        |
| Errors                | No non-benign observed errors                                                  |

Missing required evidence is `UNKNOWN` and non-passing, not zero or a skipped success.
Model metadata remains diagnostic only, including absent or changing actual models.
Cache totals are observed samples, not billing. Historical `/clear` and phase counters
are unavailable for native logs; do not infer phase boundaries from timestamps.
Readiness alone never counts as executed review work.
Received worker execution envelopes and matching send-tool records count once.
Each actual `APEX_REVIEW` rubber-duck dispatch also counts once, including a
multi-lens batch. A valid findings record and a telemetry count are separate requirements.
External-only transport completions do not prove tool success and remain non-passing.

## Acceptance Boundary

Automated telemetry acceptance is necessary but not sufficient. Record actual custom-agent
discovery, worker identity/tool binding, continuation, independent review and human-stop observations.
It does not certify complete billing, review validity, approval or deployment success.
Never restamp existing review evidence or mutate another project's state to make a probe pass.
