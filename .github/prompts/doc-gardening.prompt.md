---
description: "Scan for stale docs, instruction drift, quality score degradation, and tech debt. Updates QUALITY_SCORE.md and tech-debt-tracker.md."
agent: agent
model: "Claude Opus 4.6"
tools:
  [
    vscode,
    execute,
    read,
    agent,
    browser,
    edit,
    search,
    web,
    azure-mcp/search,
    todo,
  ]
---

# Doc Gardening

Scan the repository for entropy and update health metrics.

## Tasks

1. Stale documentation — run `node scripts/check-docs-freshness.mjs` and flag files not updated
   in >90 days
2. Instruction/skill drift — run `node scripts/validate-instruction-checks.mjs` to find
   orphaned references from deleted/renamed instructions
3. Cross-reference integrity — run `node scripts/validate-skills-format.mjs` and
   `node scripts/validate-agent-frontmatter.mjs`
4. Quality score review — read `QUALITY_SCORE.md`, compare grades against current state,
   propose updates
5. Tech debt inventory — read `tests/exec-plans/tech-debt-tracker.md`, verify items still
   relevant, add new discoveries

## Output

- Update `QUALITY_SCORE.md` with revised grades and change log entries
- Update `tests/exec-plans/tech-debt-tracker.md` with new/resolved items
- Report summary of findings to the user
