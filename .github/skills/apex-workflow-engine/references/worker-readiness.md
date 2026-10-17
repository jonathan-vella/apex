<!-- ref:worker-readiness-v3 -->

# Copilot SDK Worker Readiness

Active main agents and leaf workers omit model and effort pins. Before production
workflow execution, the operator explicitly selects Auto in the supported runtime;
omitted frontmatter does not select Auto. Verify every delegated step and leaf
worker before project work. SDK telemetry verifies only the observed route unless
it explicitly records the operator's Auto selection. Unknown evidence blocks execution.

## Ready-Only Handshake

1. The parent confirms graph prerequisites and the applicable human approval.
   The operator selects Auto in the runtime before dispatch; this selection is
   separate from agent definitions and is not implied by omitted frontmatter.
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
5. Require `MODEL_VERIFIED` with `phase: initial` and
   `continuation_verified: false`: exactly one attributed start, configuration, linked
   parent `task` dispatch, completed first turn and worker completion; exact worker and parent identity;
   background mode; multi-turn configuration; nonempty configured and dispatched
   model evidence that agrees; and zero tool events or nested workers. If a
   definition is deliberately pinned in a legacy fixture, the observed model must
   also match one of its catalog runtime IDs. Active production definitions have
   no such expected ID. An explicit effort pin is likewise checked only for a
   legacy fixture; unpinned runtime effort is not inferred.
   Supported source pairs are `custom_agent_definition` /
   `agent_definition_default` for explicitly pinned legacy fixtures, and
   `unset` / `session_inheritance` for unpinned active definitions when the parent
   dispatch contains no model, effort or context override and the configured and
   dispatched worker model matches the parent session's observed model. If those
   models differ or parent model evidence is absent, stop. This verifies the
   inherited route only; it does not prove the operator selected Auto. Verify Auto
   separately in the current parent runtime. Never infer Auto from model names,
   omission of frontmatter pins, or stale session startup metadata.
   The verifier requires the exact
   worker name, one matching parent dispatch in background mode, and no `model`,
   `reasoning_effort`, or `context_tier` argument keys. Unknown or unobserved
   sources fail closed. Configured/dispatched agreement proves the observed model
   route, not operator Auto selection, availability, or permission to act.
   This first-phase result never certifies continuation or complete readiness.
   Do not send project work based on `MODEL_VERIFIED`.
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
   Both phases repeat all routing, identity, override and no-tool checks. Complete
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
