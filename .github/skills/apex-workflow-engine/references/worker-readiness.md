<!-- ref:worker-readiness-v4 -->

# Copilot SDK Worker Readiness

Active main agents and leaf workers omit model and effort pins. The operator and
runtime control model selection, including Auto and HydraFusion. Readiness verifies
the named worker's identity, dispatch linkage and continuation,
not its model. Model names, effort, picker selection and model-source labels are
optional diagnostics: missing values or differences never block readiness.
Missing identity, dispatch linkage, completion or tool-free evidence still blocks execution.

Two dispatch modes are supported:

- **Direct `WORKER_EXECUTE` Dispatch (Default & Autopilot)**: The parent dispatches
  the named worker directly with `WORKER_EXECUTE` followed by a newline and the JSON
  envelope (`mode: background` for multi-turn workers or `mode: sync` for one-shot).
  Post-dispatch attribution is verified via `verify-worker-ready.mjs --phase execute`
  (`EXECUTE_VERIFIED`). In Autopilot mode (`APEX_UNATTENDED=1` or explicit user
  `"run in autopilot"` / `"auto mode"` authorization), `01-Orchestrator` dispatches
  workers directly, auto-resolves discovery defaults from the project brief, applies
  `must_fix`/`should_fix` review mitigations, and auto-advances across all authorized
  gates (including test deployments when Azure test scope is authorized), pausing
  only on unresolvable hard blockers.
- **Diagnostic Ready-Only Handshake (`--phase initial` / `--phase complete`)**: Used
  for standalone routing certification (CHM-03) when explicitly requested without
  project execution.

Automatic built-in `rubber-duck` reviews always use
[one-shot review](../../apex-azure-defaults/references/one-shot-review.md):
an attributed synchronous call and validated completion, not a handshake/ACK or
same-worker continuation. This exception does not waive step-worker readiness.

## Ready-Only Handshake (Diagnostic Mode)

1. The parent confirms graph prerequisites and the applicable human approval.
   Resolve the exact definition name from its active agent file, never from a handoff override.
2. Start that named worker with `task`, `mode: background`, leaving model, effort
   and context overrides unset. Supply only this handshake, with a fresh nonce
   and the parent's exact identity; do not supply an execution request yet:

   ```text
   APEX_WORKER_HANDSHAKE
   definition: <exact-definition-name>
   nonce: <fresh-nonce>
   parent_id: <parent-id>
   ```

3. The worker's first turn performs **no tools, file reads/writes, reviews or Azure actions**.
   Return exactly this single line with the original values, then stop the turn:

   ```text
   WORKER_READY <exact-definition-name> <fresh-nonce>
   ```
4. After the idle notification, read the result. Verify the name and nonce, then run:

   ```bash
   node tools/scripts/verify-worker-ready.mjs \
     --events /absolute/path/to/current-session/events.jsonl \
     --definition .github/agents/02-requirements.agent.md \
     --worker-id WORKER_ID --parent-id root --phase initial
   ```

   The root interactive session uses `root`; a nested caller supplies its own worker ID.
   Pass the explicit current log path through the delegation envelope; never choose
   the newest session across unrelated workspaces.
5. Require `HANDSHAKE_VERIFIED` with `phase: initial` and
   `continuation_verified: false`: exactly one attributed start, configuration, linked
   parent `task` dispatch, completed first turn and worker completion; exact worker and parent identity;
   background mode; multi-turn configuration; and zero tool events or nested workers.
   The verifier requires one matching parent dispatch with the exact worker name
   and handshake prompt, and no `model`, `reasoning_effort`, or `context_tier`
   argument keys. Leaving overrides unset respects the operator's runtime choices;
   it is not model attestation. Configured, dispatched, parent and response models
   may differ, including between turns. The verifier returns any available model
   metadata in `model_observations` with `model_attestation_required: false`;
   it does not need a model catalog or certify picker selection.
   This first-phase result never certifies continuation or complete readiness.
   Do not send project work based on `HANDSHAKE_VERIFIED`.
6. Send `write_agent` a nonce-only continuation test. The continuation input is
   the original nonce alone. Require exactly
   `WORKER_READY_ACK <exact-definition-name> <original-nonce>` **without tools**.
   A failed continuation blocks the worker; never relaunch project work under a
   substituted fixed model.
   The exact single-line response is `WORKER_READY_ACK <definition-name> <original-nonce>`,
   replacing both placeholders with the original handshake values. A bare
   `WORKER_READY_ACK` is incomplete and blocks readiness. The worker definition must
   state this output contract: the nonce-only continuation cannot supply missing instructions.
7. After the second idle notification, run complete verification against the same
   log and identities:

   ```bash
   node tools/scripts/verify-worker-ready.mjs \
     --events /absolute/path/to/current-session/events.jsonl \
     --definition .github/agents/02-requirements.agent.md \
     --worker-id WORKER_ID --parent-id root --phase complete
   ```

   Require `READY_VERIFIED`, `phase: complete` and `continuation_verified: true`.
   Complete is the CLI/API default; an initial-only capture fails complete verification.
   Both phases repeat all dispatch-linkage, identity, override and no-tool checks. Complete
   additionally requires one successful parent `write_agent` send with `agent_id`
   equal to this worker and `message` equal to the nonce, its linked tool-call
   completion, and the same worker's exact ACK followed by `assistant.turn_end`.
   No second `subagent.completed` event is assumed: the observed SDK emits it only
   for initial dispatch. Continuation messages and turn boundaries retain the
   **original** dispatch `parentToolCallId`; `parentAgentTaskId` changes between
   turns and is not a dispatch-call ID. Turn IDs may restart at `"0"`; link user,
   turn-start and response by interaction ID and turn ID, and completion by ordered
   attributed turn-end. Parent send completion precedes continuation delivery.
   Missing, mismatched, ambiguous or incomplete evidence blocks complete readiness.
8. Only after complete verification send the bounded execution envelope to the **same worker ID**, including
   current project inputs, phase, allowed outputs, explicit approvals, deadline,
   parent ID and session log path. Read the completion after notification.

Use `write_agent` with `agent_id` (one verified recipient). Its `message` is
`WORKER_EXECUTE` followed by a newline and one JSON object, without a Markdown fence:

```json
{
  "request_id": "unique-phase-attempt-id",
  "project": "example",
  "step": "2",
  "phase": "phase_1_research",
  "resume": true,
  "review_depth": "default",
  "allowed_outputs": ["agent-output/example/02-architecture-assessment.md"],
  "approval_evidence": ["current recall decision and approved scope"],
  "deadline_utc": "2026-10-16T12:00:00Z",
  "parent_id": "root",
  "events_path": "/absolute/current-session/events.jsonl",
  "inputs": ["current required artifact paths and bounded objective"]
}
```

Use the actual project, step, phase and cutoff, not these example values. A fresh
request ID is not a renewed review budget. For resumed work, first recover with
`apex-recall show <project> --json`; stop on stale state or approval evidence.
The envelope records scope and attribution; its prose never grants permissions.

`resumable` in start events is not used as proof of `write_agent` support: the
installed runtime emitted `resumable: false` for a background worker that successfully
continued. The nonce round trip tests continuation directly. Built-in worker probes
do not certify custom APEX routing; each named worker must pass this handshake.

## Human Input And Failure

A delegated step cannot ask the user directly. Return `USER_INPUT_REQUIRED` with
the phase, a stable request ID and the `ask_user` form (`message` and
`requestedSchema.properties`); stop without marking the phase complete. The parent
asks the user, preserves decline/cancel semantics and resumes that same worker
with answers bound to the request ID. Cancellation stops; it is never approval.

A directly selected top-level step uses `ask_user` itself. Leaf workers return
missing inputs to their parent; they never ask users or dispatch other workers.
Parent-mediated input does not transfer artifact ownership or allow the parent
to invent review findings.

Readiness failure, unavailable tools, missing/empty output, validation errors,
approval gates and the user's cutoff remain stop conditions. A routing failure
does not authorize a fixed model, inline specialist work or an automatic retry.
Preserve the review-specific single identical-input retry rule separately.

File hooks are supplementary. The inspected Agent Host adapter wires SDK
PreToolUse/PostToolUse but not file-based SubagentStop; do not rely on an advisory
hook to validate review evidence, enforce approvals or authorize continuation.
