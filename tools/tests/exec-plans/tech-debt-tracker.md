<a id="top"></a>

# Tech Debt Tracker

> [Current Version](../../VERSION.md) | Running inventory of known debt and quality gaps

Updated by the doc-gardening workflow and referenced by `QUALITY_SCORE.md`.

## Active Debt Items

| ID  | Domain        | Description                                                                             | Priority | Owner | Milestone  |
| --- | ------------- | --------------------------------------------------------------------------------------- | -------- | ----- | ---------- |
| 23  | Agents/Skills | E2E RALPH loop lessons: 7 fixes + 2 validators applied; see `10-improvement-actions.md` | Low      | —     | Monitoring |

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Resolved Items

| ID | Domain | Description | Resolved | Notes |
| --- | --- | --- | --- | --- |
| 1 | Documentation | Subagent count 8→9 | 2026-02-26 | Fixed in docs/README.md |
| 2 | Documentation | Agent table old Bicep-only layout | 2026-02-26 | Updated to 13+9 |
| 3 | Documentation | Skills section ref'd 8, actual 14+ | 2026-02-26 | Docs-writer refs updated |
| 4 | Documentation | exec-plans/QUALITY_SCORE missing from README | 2026-02-26 | Added references |
| 7 | Skills | 15 dirs, 14 in docs | 2026-02-26 | Confirmed 14 valid |
| 8 | Instructions | freshness-checklist counts stale | 2026-02-26 | Updated counts |
| 9 | Instructions | repo-architecture skill catalog stale | 2026-02-26 | Shows 14 skills |
| 12 | Documentation | Skill count 16→17 | 2026-03-02 | 3 locations fixed |
| 6 | Infrastructure | tf-dev not merged | 2026-03-04 | Merged; archived |
| 5 | CI/CD | validate:terraform zero projects | 2026-03-06 | Expected behaviour |
| 13 | Documentation | Skill count 18→20 | 2026-03-06 | 3 locations + tables |
| 11 | Instructions | 4 applyTo warnings | 2026-03-15 | Globs narrowed |
| 10 | Agents | Frontmatter string not array | 2026-03-15 | Inline array format |
| 15 | Skills | 19 missing Reference Index | 2026-03-15 | Sections + canary added |
| 16 | CI/CD | SKILL.minimal.md trailing spaces | 2026-03-15 | Fixed whitespace |
| 14 | Agents | Orchestrator 363 lines (>350) | 2026-03-23 | Now 337 lines |
| 17 | Skills | SKILL.md lint errors (MD013/MD040) | 2026-03-23 | Shifted to demo content |
| 19 | CI/CD | lint:md 115 errors (demo/test/site) | 2026-03-25 | Excluded from scope |
| 20 | CI/CD | Fabric ref 2 blank-line errors | 2026-03-27 | Migration cleanup |
| 21 | CI/CD | drawio-mcp-server 314 lint errors | 2026-04-03 | Local suppression config |
| 18 | Agents | 2 prompt model mismatches | 2026-04-12 | Prompts updated |
| 22 | Agents | e2e-orchestrator 430 lines (>400) | 2026-04-12 | Limit raised to 500 |
| 24 | Documentation | Explorer graph stale (2026-04-22) | 2026-04-24 | Regenerated |
| 25 | Agents | Governance agent lacks context_awareness | 2026-04-24 | Block added |
| — | All | Tracker created | 2026-02-26 | Initial seeding |

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Categories

- **Documentation**: Stale docs, broken links, incorrect counts
- **Instructions**: Overlapping rules, orphaned references
- **Skills**: Outdated guidance, missing coverage
- **Validation**: Missing CI checks, untested rules
- **Infrastructure**: Bicep patterns, module gaps, Terraform parity
- **CI/CD**: Missing or unverified pipeline scripts

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
