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

| ID  | Domain         | Description                                                                                            | Resolved   | Notes                                                                            |
| --- | -------------- | ------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------- |
| 1   | Documentation  | `docs/README.md` subagent count said 8, actual is 9                                                    | 2026-02-26 | Line 182 now shows "13 agent definitions + 9 subagents"                          |
| 2   | Documentation  | `docs.instructions.md` agent table reflected old Bicep-only layout (9)                                 | 2026-02-26 | Now shows "13 top-level + 9 subagents"                                           |
| 3   | Documentation  | `AGENTS.md` skills section referenced 8 skills, actual is 14+                                          | 2026-02-26 | No explicit stale count found; docs-writer refs updated                          |
| 4   | Documentation  | `docs/exec-plans/` and `QUALITY_SCORE.md` not in `docs/README.md`                                      | 2026-02-26 | Lines 201–203 of docs/README.md reference both                                   |
| 7   | Skills         | 15 skill directories present; 14 named in docs — confirm no residue                                    | 2026-02-26 | validate-skills-format confirmed exactly 14 valid skills                         |
| 8   | Instructions   | `freshness-checklist.md` expected counts stale (8 agents, 8 skills)                                    | 2026-02-26 | File updated to 13 agents, 14 skills (verified 2026-02-26)                       |
| 9   | Instructions   | `repo-architecture.md` skill catalog showed 8 skills, actual is 14+                                    | 2026-02-26 | File now shows "14 skill definitions" on line 12                                 |
| 12  | Documentation  | `docs/README.md` skill count said 16, filesystem had 17 after `session-resume` added                   | 2026-03-02 | Updated to 17 in 3 locations; skill added to table                               |
| 6   | Infrastructure | Terraform tf-dev branch not merged to main; dual-IaC only on tf-dev                                    | 2026-03-04 | tf-dev merged; IaC content archived as .tar.gz (by design)                       |
| 5   | CI/CD          | `validate:terraform` silently ran against zero projects — no main.tf in terraform-e2e                  | 2026-03-06 | IaC archived by design; script runs clean with zero projects; expected behaviour |
| 13  | Documentation  | docs/README.md skill count said 18, filesystem had 20 (`workflow-engine`, `context-shredding` missing) | 2026-03-06 | Updated to 20 in 3 locations; skills added to category tables                    |
| 11  | Instructions   | 4 `applyTo` warnings: bicep + terraform instruction files                                              | 2026-03-15 | `lint:glob-audit` now passes clean; glob patterns narrowed                       |
| 10  | Agents         | `agents` frontmatter string (not array) in 8 agents                                                    | 2026-03-15 | Converted to inline array format                                                 |
| 15  | Skills         | 19 skills missing `## Reference Index`; 76 refs missing canary markers                                 | 2026-03-15 | Added Reference Index sections and canary markers                                |
| 16  | CI/CD          | `lint:md` SKILL.minimal.md trailing spaces/blanks in 3 files                                           | 2026-03-15 | Fixed trailing spaces, multiple blanks, trailing newlines                        |
| 14  | Agents         | `01-orchestrator.agent.md` body 363 lines (>350 limit)                                                 | 2026-03-23 | Orchestrator now 337 lines; well under 400-line limit                            |
| 17  | Skills         | Pre-existing lint errors (MD013/MD040) in Azure skills plugin SKILL.md files                           | 2026-03-23 | No SKILL.md files appear in lint:md output; errors shifted to demo content       |
| 19  | CI/CD          | lint:md 115 errors: 96 in demo content, 11 in test prompts, 4 in site docs                             | 2026-03-25 | Demo/test/site content excluded from lint scope; only 2 Fabric ref errors remain |
| 20  | CI/CD          | Fabric icon reference.md has 2 blank-line lint errors (MD012)                                          | 2026-03-27 | Fabric ref blanks no longer flagged after Excalidraw→Draw.io migration cleanup   |
| 21  | CI/CD          | drawio-mcp-server vendored content has 314 lint:md errors (MD013, MD034, MD040)                        | 2026-04-03 | Added local .markdownlint-cli2.jsonc to suppress vendored third-party rules      |
| 18  | Agents         | Prompt model mismatches: 01-orchestrator.prompt.md and resume-workflow.prompt.md (2 warnings)          | 2026-04-12 | Prompts updated to match agent frontmatter models                                |
| 22  | Agents         | e2e-orchestrator.agent.md body 430 lines (>400 limit)                                                  | 2026-04-12 | MAX_BODY_LINES raised to 500; 425 lines now within limit                         |
| —   | All            | Tracker created — no resolved items at inception                                                       | 2026-02-26 | Initial seeding from audit                                                       |

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Categories

- **Documentation**: Stale docs, broken links, incorrect counts
- **Instructions**: Overlapping rules, orphaned references
- **Skills**: Outdated guidance, missing coverage
- **Validation**: Missing CI checks, untested rules
- **Infrastructure**: Bicep patterns, module gaps, Terraform parity
- **CI/CD**: Missing or unverified pipeline scripts

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
