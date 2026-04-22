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

Scan the repository for entropy and update health metrics. All counts cited in outputs
must come from `.github/count-manifest.json` — never hard-code numbers.

## Pre-flight

Before running tasks, verify target files exist. If any of the following are missing,
stop and ask the user (do not create them silently):

- `QUALITY_SCORE.md`
- `tests/exec-plans/tech-debt-tracker.md`
- `.github/count-manifest.json`
- `freshness-report.json` (optional — first-run gardening will create it)

## Tasks

1. **Stale documentation** — run `node scripts/check-docs-freshness.mjs` and flag files
   not updated in >90 days. Diff the resulting `freshness-report.json` against the
   previous committed version (if any) and summarise files that became stale, were
   refreshed, or were added since the last run.

2. **Instruction/skill drift** — run `node scripts/validate-instruction-checks.mjs` to
   find orphaned references from deleted/renamed instructions, plus
   `node scripts/validate-no-deprecated-refs.mjs` to catch stale script/module refs.

3. **Cross-reference integrity** — run `node scripts/validate-skills.mjs` (covers format
   and size; replaces the historical `validate-skills-format.mjs`) and
   `node scripts/validate-agents.mjs` (covers frontmatter; replaces the historical
   `validate-agent-frontmatter.mjs`).

4. **Count-manifest alignment** — run `node scripts/validate-no-hardcoded-counts.mjs`.
   Additionally, scan `site/src/content/docs/**/*.{md,mdx}`, `README.md`, `AGENTS.md`,
   and `QUALITY_SCORE.md` for numeric entity counts (e.g., "15 agents", "41 skills")
   that conflict with `count-manifest.json` computed values. Report each conflict with
   the exact file + line.

5. **Architecture Explorer graph freshness** — if
   `site/public/architecture-explorer-graph.json` exists, compare its `generatedAt`
   timestamp (or file mtime as fallback) against the newest mtime across
   `.github/agents/**`, `.github/agents/_subagents/**`, `.github/skills/**`,
   `.github/instructions/**`, `.github/prompts/**`, `.vscode/mcp.json`,
   `.github/agent-registry.json`. Flag as stale if any
   source is newer than the graph. Recommend running `npm run build:explorer-graph`.

6. **Quality score review** — read `QUALITY_SCORE.md`, compare grades against current
   state, propose updates.

7. **Tech debt inventory** — read `tests/exec-plans/tech-debt-tracker.md`, verify items
   still relevant, add new discoveries.

## Output

- Update `QUALITY_SCORE.md` with revised grades and change log entries.
- Update `tests/exec-plans/tech-debt-tracker.md` with new/resolved items.
- Report a summary to the user including: freshness diff totals, count-manifest
  conflicts (if any), explorer graph staleness status, and prioritised follow-ups.
- Do NOT hard-code counts in any output — reference `.github/count-manifest.json`.
