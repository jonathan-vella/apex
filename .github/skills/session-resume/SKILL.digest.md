<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Session Resume Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use

- Starting / resuming any agent step
- Completing a sub-step checkpoint or finishing a step
- Orchestrator gate transitions
- Recovering after a chat crash or thread switch

## Fast Recall with apex-recall (Tier 0)

Before loading full artifacts, use `apex-recall` for lightweight orientation.

### When to invoke

- **Fresh step start** — before reading any artifact files
- **Interrupted/resumed step recovery** — before re-reading sub-step context
- NOT on every chat turn or generic file edit

### Progressive disclosure protocol

1. **Tier 1 — orientation** (~50 tokens): `apex-recall sessions --json --limit 5` + `apex-recall files --json --limit 5`
2. **Tier 2 — targeted search** (~200 tokens): `apex-recall search '<term>' --json --project <name>` or `apex-recall decisions --json --project <name>`
3. **Tier 3 — full project context** (~500 tokens): `apex-recall show <project> --json`

If `apex-recall` is not installed or returns empty results, skip to normal artifact file reads.

## Quick Reference

| Concept           | Key Detail                                                     |
| ----------------- | -------------------------------------------------------------- |
| State file        | `agent-output/{project}/00-session-state.json`                 |
| Human companion   | `agent-output/{project}/00-handoff.md`                         |
| Resume detection  | Read JSON → check `steps.{N}.status` → branch accordingly      |
> _See SKILL.md for full content._

## Resume Flow (compact)
> _See SKILL.md for full content._

## State Write Moments

1. **Step start** — `status: "in_progress"`, set `started`
2. **Sub-step done** — update `sub_step`, append `artifacts`, update `updated`
3. **Step done** — `status: "complete"`, set `completed`, clear `sub_step`
4. **Decision made** — add to `decisions` object
5. **Challenger finding** — append/remove in `open_findings`

## Minimal State Snippet
> _See SKILL.md for full content._

## Schema Version Enforcement (MANDATORY)

All agents MUST enforce schema version at read time:

1. **On read**: Check `schema_version` field. If `"1.0"`, `"2.0"`, or missing → migrate to `"3.0"` immediately:
   - Set `"schema_version": "3.0"`
   - Remove `"lock"` object if present (no longer used)
> _See SKILL.md for full content._

## Reference Index

| Reference         | File                              | Content                                                                                       |
| ----------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Recovery Protocol | `references/recovery-protocol.md` | Resume detection, direct invocation, state write protocol, Orchestrator integration, portability |
| State File Schema | `references/state-file-schema.md` | Full JSON template (v3.0), field definitions, all step definitions                            |
| Context Budgets   | `references/context-budgets.md`   | Per-step file budget table, all sub-step checkpoint tables (Steps 1-7)                        |
