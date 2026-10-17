<!-- ref:worker-readiness-v1 -->

# Copilot SDK Worker Readiness

Frontmatter owns model and effort. The SDK can fall back to the parent's model;
an allowlist or static validator does not prove routing. Verify every delegated
step and leaf worker before project work. Unknown evidence blocks execution.

## Ready-Only Handshake

1. The parent confirms graph prerequisites and the applicable human approval.
   Resolve the exact definition and model from frontmatter, never from a handoff override.
2. Start that named worker with `task`, `mode: background`, leaving model, effort
   and context overrides unset. Supply only `APEX_WORKER_HANDSHAKE`, the definition
   name, a fresh nonce, and the parent's identity. Do not supply an execution request yet.
3. The worker's first turn performs **no tools, file reads/writes, reviews or Azure actions**.
   Return `WORKER_READY`, the exact definition name and nonce, then stop the turn.
4. After the idle notification, read the result. Verify the name and nonce, then run:

   ```bash
   node tools/scripts/verify-worker-ready.mjs \
     --events /absolute/path/to/current-session/events.jsonl \
     --definition .github/agents/02-requirements.agent.md \
     --worker-id WORKER_ID --parent-id root
   ```

   The root interactive session uses `root`; a nested caller supplies its own worker ID.
   Pass the explicit current log path through the delegation envelope; never choose
   the newest session across unrelated workspaces.
5. Require `MODEL_VERIFIED`: attributed start/completion, actual dispatched model
   matching the catalog `runtime_id`, definition-owned routing, no caller override,
   exact frontmatter effort, background mode, multi-turn configuration and zero tools.
   Require a nonempty matching call identity. Observed tools or nested dispatch
   block readiness even if the completion reports zero tool calls.
   A catalog ID is an expected identity, not evidence of runtime availability.
   The verifier accepts the legacy attribution pair `unset` / `agent_definition` and the observed SDK pair
   `custom_agent_definition` / `agent_definition_default`. The latter also requires one matching parent
   `task` start record with the exact definition and background mode, and no `model`, `reasoning_effort`,
   or `context_tier` argument keys. Mixed, unknown, inherited, or overridden attribution remains blocking.
   Acceptance of labels does not certify the parent's own routing, the ACK, reviews, or execution permission.
6. Send `write_agent` a nonce-only continuation test. Require a `WORKER_READY_ACK`
   echo of the original nonce and definition **without tools**. A failed continuation
   blocks the worker; never relaunch project work under an inherited model.
7. Only then send the bounded execution envelope to the **same worker ID**, including
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
does not authorize another model, inline specialist work or an automatic retry.
Preserve the review-specific single identical-input retry rule separately.

File hooks are supplementary. The inspected Agent Host adapter wires SDK
PreToolUse/PostToolUse but not file-based SubagentStop; do not rely on an advisory
hook to validate review evidence, enforce approvals or authorize continuation.
