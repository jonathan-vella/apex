# Phase 1.6 — Validator-vs-ESLint Overlap Audit

Date: 2026-05-08
Method: grep validators for AST-like patterns (regex over `import`, `require`,
`export`, `process.exit`); read suspect candidates end-to-end.

## Audit results

| Validator | Performs AST-level JS analysis? | Replaceable by ESLint? |
|-----------|---------------------------------|------------------------|
| `validate-no-deprecated-refs.mjs` | No — substring-greps removed paths/skill names across **markdown** files (not JS source) | No |
| `validate-glob-audit.mjs`         | No — parses **YAML frontmatter** and inspects `applyTo` globs in instruction files | No |
| `validate-agents.mjs`             | No — frontmatter + body checks on `.agent.md`/`.prompt.md`; the only `.mjs` inspection is `import.meta.url` to skip main() during testing | No |
| `validate-skills.mjs`             | No — content/cross-reference checks on `SKILL.md` files | No |
| `validate-artifacts.mjs`          | No — H2 heading sync between markdown templates and artifacts | No |
| `validate-instruction-checks.mjs` | No — instruction-file frontmatter and reference graph | No |
| `validate-deprecated-models.mjs`  | No — model-id substring checks across markdown | No |
| `validate-no-hardcoded-counts.mjs`| No — substring-greps numeric counts in markdown/json | No |
| `validate-glob-audit.mjs`         | No (duplicate listing for clarity) | No |
| `validate-e2e-step.mjs`           | Reads `.mjs` source but only as **strings to dispatch on** — not for AST-level lint checks | No |

## Conclusion

**No validators can be retired as a result of ESLint adoption.** All ~50
validators in `tools/scripts/` operate on **markdown / JSON / YAML content** —
they validate the *editorial* shape of agent definitions, skill manifests,
artifact templates, governance refs, and cross-references. ESLint operates on
JS/TS AST; the two surfaces are disjoint.

This is **not** a finding against adoption — it just means the LOC-offset
benefit the plan hypothesized in Phase 1.6 is **zero** for this codebase. The
Adoption case must rest on (1) shift-left bug catch on JS/MJS code and (2)
prose-rule consolidation in `javascript.instructions.md` (Phase 1.4 found 6
mechanical rules that move out of prose), not on validator retirement.

## Implication for Phase 3.1 findings

The "validator retirement candidates" list is empty. The findings note will
state "0 validators retireable" rather than offering a LOC offset. This narrows
the "Adopt" cost-benefit case to: Phase 2 must show genuine bug-class catch and
acceptable cost; there is no offset from deletions.
