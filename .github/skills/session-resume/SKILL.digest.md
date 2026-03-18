<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Session Resume Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use

- Starting / resuming any agent step
- Completing a sub-step checkpoint or finishing a step
- Conductor gate transitions
- Recovering after a chat crash or thread switch

## Quick Reference

| Concept          | Key Detail                                                |
| ---------------- | --------------------------------------------------------- |
| State file       | `agent-output/{project}/00-session-state.json`            |
| Human companion  | `agent-output/{project}/00-handoff.md`                    |
| Resume detection | Read JSON → check `steps.{N}.status` → branch accordingly |
| Status values    | `pending` / `in_progress` / `complete` / `skipped`        |

> _See SKILL.md for full content._

## Resume Flow (compact)

````text
00-session-state.json exists?
  NO  → Fresh start (create from template)
  YES → steps.{N}.status?
        pending     → set "in_progress", proceed
        in_progress → read sub_step, skip to checkpoint

> _See SKILL.md for full content._

## State Write Moments

1. **Step start** — `status: "in_progress"`, set `started`
2. **Sub-step done** — update `sub_step`, append `artifacts`, update `updated`
3. **Step done** — `status: "complete"`, set `completed`, clear `sub_step`
4. **Decision made** — add to `decisions` object
5. **Challenger finding** — append/remove in `open_findings`

## Minimal State Snippet

```json
{
  "schema_version": "2.0",
  "project": "my-project",
  "current_step": 2,
  "updated": "2026-03-02T10:15:00Z",
  "lock": { "owner_id": null, "heartbeat": null, "attempt_token": null },

> _See SKILL.md for full content._

## Reference Index

| Reference         | File                              | Content                                                                                       |
| ----------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Recovery Protocol | `references/recovery-protocol.md` | Resume detection, direct invocation, state write protocol, Conductor integration, portability |
| State File Schema | `references/state-file-schema.md` | Full JSON template (v2.0), lock/claim field definitions, all step definitions                 |
| Context Budgets   | `references/context-budgets.md`   | Per-step file budget table, all sub-step checkpoint tables (Steps 1-7)                        |
````
