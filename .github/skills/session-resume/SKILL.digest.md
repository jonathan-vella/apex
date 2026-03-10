<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Session Resume (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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

## Resume Flow

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

## Claim Protocol (v2.0)

```text
1. Read state → check lock.heartbeat stale?
   YES → Clear lock, log recovery, proceed
   NO  → Lock held — STOP, inform user
2. Acquire lock: set owner_id, heartbeat, attempt_token (UUID)
3. Claim step: set steps.{N}.claim fields
4. Renew heartbeat on each sub-step
5. Release claim on completion
```

All writes MUST include `attempt_token`. Mismatch = another session took over → halt.

## Reference Index

| Reference         | File                              | Content                       |
| ----------------- | --------------------------------- | ----------------------------- |
| Recovery Protocol | `references/recovery-protocol.md` | Resume detection, portability |
| State File Schema | `references/state-file-schema.md` | Full v2.0 JSON template       |
| Context Budgets   | `references/context-budgets.md`   | Per-step file budgets         |
