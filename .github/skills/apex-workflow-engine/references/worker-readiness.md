<!-- ref:worker-readiness-v5 -->

# Native Copilot worker lifecycle

This retained path now documents bounded native task execution in the Copilot harness inside VS Code.
It is not a readiness handshake, custom execution envelope or per-call telemetry attestation.
Older captures and the diagnostic verifier remain readable historical evidence, not active prerequisites.

## Dispatch

Use the actual available native `task` tool and an authorized worker name.
Pass objective, `execution_mode: delegated`, exact inputs/revisions, required decisions,
allowed writes/commands, outputs, review/validation expectations, cutoff and failure rules.
Skills and frontmatter do not grant permissions, enforce credential isolation or certify model routing.
Leave model/effort/context overrides unset unless explicitly required and supported.

Read the owner's current contract before framing the task; reuse it when already available.
Preserve approved requirements as authority, including mandatory capability and security dependencies.
A full-phase request includes its required decisions, evidence, validations and reviews, not only document drafting.
An explicitly bounded research/repair slice stays bounded and cannot claim completion of the whole phase.

Use a synchronous bounded task when no follow-up is needed.
For background work retain the returned handle, await the actual completion/idle notification,
then read the result. Use `write_agent` only for same-task running/idle workers whose contract
supports continuation. One-shot tasks return missing inputs for a new bounded invocation.
Do not treat Local's stateless runner rules as a universal Copilot API contract.

## Interaction

A directly selected main agent uses actual native `ask_user` for missing material questions.
Requirements, Architect, Design and Governance remain interactive when selected directly.
Required questions unavailable in the runtime are explicit blockers, not invented answers or terminal prompts.

A delegated main returns `USER_INPUT_REQUIRED` with stable `request_id`, `phase`, `message`,
`requestedSchema.properties` and missing inputs. The interactive parent asks, validates freeform
answers and supplies them against the same request. Leaves return their role-specific missing-input
failure and never ask users, manage parent todos or delegate.
Every resumed/replacement main task receives the complete captured-answer ledger, not just
the latest form response. Preserve confirmed values, custom answers, unknowns and skipped branches.
Carry explicit applicability context alongside forms, outside the native question payload.
Include current phase, frozen-input references, changed dependency paths, actual review/attempt IDs,
the explicitly selected successful cost revision and next authorized operation. Prefer a compact
summary plus exact authorized ledger/evidence paths; recover missing content rather than rereading
unchanged full artifacts. Never omit required security/approval evidence to meet a size target.
Before rendering a form remove answered/inapplicable fields; don't ask migration details for Greenfield
or create separate Other-description fields when native choices already accept freeform.
Pass only the actual native tool's supported form fields. `requestedSchema` contains `properties`;
do not forward arbitrary JSON Schema `required`, `pattern` or `format` keywords as if the tool enforced them.
Describe constraints and validate returned freeform answers separately, preserving any invalid-input blocker.
Decline never approves and cancellation stops. Native Autopilot may auto-answer questions;
a successful form or task result is not independent human authorization.

## Results and recovery

Consume the actual result in the role's declared file/text/verdict format.
Validate artifact/result shape, relevant input freshness and real command outcomes.
Treat a partial result as remaining work, not a completed phase. File presence and JSON syntax do not prove readiness.
Continue remaining authorized activities through the same owner/lifecycle, or relay genuinely missing inputs,
an actual capability failure or the final approval gate. Do not require another user "continue" for routine in-phase work.
Do not blindly repeat unchanged tasks; preserve actual blockers and the existing retry/review accounting.
For final Architecture approval, inspect pricing status `COMPLETE` and run the existing cost validator;
also require the separate Architecture and cost-feasibility review evidence. A valid FAILED cost payload is not readiness.
Missing capability, malformed result, stale evidence or permission denial blocks the affected action.
Never replace a missing reviewer with self-review, an arbitrary worker or a main-wrapper fallback.
Nested task capability missing on a delegated artifact owner is not reviewer unavailability:
return `REVIEW_REQUIRED` to the authorized interactive Orchestrator for automatic native
`challenger-review-subagent` sibling execution with the shared metadata/recorder/budget contract.
The actual interactive parent captures inputs and records results under its own native identity.
Only a real missing parent capability or failed/invalid result blocks that relay.
Keep the existing single identical-input empty-review retry and actual invocation budget.
New tasks/contexts never reset review accounting, findings or approvals.
Before any reviewer dispatch, use the shared request preflight and record its attempt start.
Use the actual task/recording outcome afterward; a completed task is not a published review or approval.

After compaction/new chat, recover missing domain evidence through artifacts and `apex-recall`;
an old task handle is not guaranteed resumable. No automatic backup restoration or approval reconstruction.
Native model labels and absent usage fields are diagnostics/unknowns, not acceptance proof.

## UI and permission observations

The owner tested Copilot with Probe Source selected on 2026-10-18.
The expected response appeared, but no native handoff controls appeared.
APEX therefore uses native task results or explicit user role selection rather than handoff metadata.
The transcript also showed Read/search with `tools: []`; enforcement was not established.
This is an observation of the tested client, not a universal unsupported-platform claim.
No source flag, task identity or test fixture proves a deployment authorization boundary.

Repository runtime hooks are intentionally retired; do not restore them or add a replacement guardian.
Git validation hooks remain separate. Real Azure writes require their actual scoped approval,
current governance/preview/security and independently controlled consequential execution path.
