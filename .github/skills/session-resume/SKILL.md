---
name: session-resume
description: "Session state tracking and resume protocol for the 7-step agent workflow. USE FOR: resume session, persist progress, checkpoint recovery, session-state.json schema. DO NOT USE FOR: Azure infrastructure, code generation, architecture design, troubleshooting."
compatibility: All agents (01-Conductor through 08-As-Built)
---

# Session Resume Skill

Persist agent progress to `00-session-state.json` and resume from the last
checkpoint after any interruption — mid-step, cross-step, or direct invocation.

## When to Use

- Starting / resuming any agent step
- Completing a sub-step checkpoint or finishing a step
- Conductor gate transitions
- Recovering after a chat crash or thread switch

## Quick Reference

| Concept           | Key Detail                                                     |
| ----------------- | -------------------------------------------------------------- |
| State file        | `agent-output/{project}/00-session-state.json`                 |
| Human companion   | `agent-output/{project}/00-handoff.md`                         |
| Resume detection  | Read JSON → check `steps.{N}.status` → branch accordingly      |
| Status values     | `pending` / `in_progress` / `complete` / `skipped`             |
| Context budget    | Hard limit on files loaded at startup per step (1-3 files)     |
| Sub-step tracking | Numbered checkpoint written to `sub_step` after each phase     |
| Write rule        | Always overwrite full JSON atomically; always update `updated` |

## Resume Flow (compact)

```text
00-session-state.json exists?
  NO  → Fresh start (create from template)
  YES → steps.{N}.status?
        pending     → set "in_progress", proceed
        in_progress → read sub_step, skip to checkpoint
        complete    → inform user, offer re-run
        skipped     → proceed to next step
```

## State Write Moments

1. **Step start** — `status: "in_progress"`, set `started`
2. **Sub-step done** — update `sub_step`, append `artifacts`, update `updated`
3. **Step done** — `status: "complete"`, set `completed`, clear `sub_step`
4. **Decision made** — add to `decisions` object
5. **Challenger finding** — append/remove in `open_findings`

## Minimal State Snippet

```json
{
  "schema_version": "1.0",
  "project": "my-project",
  "current_step": 2,
  "updated": "2026-03-02T10:15:00Z",
  "steps": {
    "2": {
      "status": "in_progress",
      "sub_step": "phase_2_waf",
      "artifacts": ["agent-output/my-project/02-architecture-assessment.md"]
    }
  }
}
```

## Reference Index

| Reference         | File                              | Content                                                                                       |
| ----------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Recovery Protocol | `references/recovery-protocol.md` | Resume detection, direct invocation, state write protocol, Conductor integration, portability |
| State File Schema | `references/state-file-schema.md` | Full JSON template (v2.0), lock/claim field definitions, all 7 step definitions               |
| Context Budgets   | `references/context-budgets.md`   | Per-step file budget table, all sub-step checkpoint tables (Steps 1-7)                        |

## Claim Protocol (v2.0)

The v2.0 schema adds an atomic claim-based model to prevent concurrent
sessions from double-writing the same step.

### Lock Flow

```text
1. Read 00-session-state.json
2. Check lock.heartbeat — stale (> stale_threshold_ms)?
   YES → Clear lock, log recovery event, proceed
   NO  → Lock held by another session — STOP, inform user
3. Acquire lock: set lock.owner_id, lock.heartbeat, lock.attempt_token (UUID)
4. Claim target step: set steps.{N}.claim.owner_id, attempt_token
5. Proceed with step work
6. On each sub-step: renew heartbeat (update lock.heartbeat + claim.heartbeat)
7. On completion: release claim, clear lock
```

### Optimistic Concurrency

All state writes MUST include the `attempt_token` from the active claim.
If the token in the file does not match, the write is rejected — another
session has taken over. The agent should halt and inform the user.

## Multi-Session Safety

When two Copilot chat sessions target the same project:

1. **First session** writes its `owner_id` + `attempt_token` to the lock
2. **Second session** reads the lock, sees a non-stale heartbeat → halts
3. If the first session crashes (heartbeat goes stale), the second session
   can recover via `sweepStale()` → clear the stale lock → re-claim
4. All recovery events are logged to `claim.event_log` for audit
