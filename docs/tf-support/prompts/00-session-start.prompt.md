---
mode: agent
description: Start of every Terraform support work session. Orients Copilot from PROGRESS.md, determines active phase, and sets task context without loading the full plan.
---

# Session Start — Terraform Support (`tf-dev`)

You are helping implement the Terraform support plan on the `tf-dev` branch of
`jonathan-vella/azure-agentic-infraops`.

## Step 1 — Load Progress State

Read these files now:

1. `docs/tf-support/PROGRESS.md` — current progress, active phase, blockers
2. `docs/tf-support/BACKLOG.md` — full item list with statuses

## Step 2 — Report Current State

After reading, tell me:

- **Active phase**: which phase are we in (from frontmatter `active_phase`)
- **Last session**: who worked on it and when
- **Completed items**: list every checked `[x]` item
- **Next item**: the first unchecked `[ ]` item in the active phase
- **Blockers**: anything flagged in the Blockers & Notes table

Format as a brief status report — 1 paragraph, then a bullet for the next item.

## Step 3 — Recommend Next Action

Based on the status, recommend one of:

- "Continue Phase N — next item is [description]. Load phase prompt: `/prompt docs/tf-support/prompts/phase-N-*.prompt.md`"
- "Phase N is complete. Run regression check first: `/prompt docs/tf-support/prompts/regression-check.prompt.md`"
- "A blocker exists: [description]. Resolve it before continuing."

## Rules for This Session

- Never modify files outside the scope of the current phase without explicit instruction
- Run `npm run validate:all` before every commit
- Update `PROGRESS.md` at the end of this session (check off completed items, add session note)
- Keep commits small — one item or one logical group per commit
- Never break existing Bicep functionality — when in doubt, run the regression check

## If You Are Mid-Session (continuing after a break)

If I reopen Chat and say "resume" or "continue", re-read `PROGRESS.md` and
report status again. Do not assume previous Chat context is valid.
