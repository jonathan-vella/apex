# Tech Debt Tracker

> [Current Version](../../VERSION.md) | Running inventory of known debt and quality gaps

Updated by the doc-gardening workflow and referenced by `QUALITY_SCORE.md`.

## Active Debt Items

| ID  | Domain       | Description                                                                                                                                                              | Priority | Owner | Milestone  |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----- | ---------- |
| 5   | CI/CD        | `validate:terraform` script runs silently — confirm it validates all projects under `infra/terraform/`                                                                   | Medium   | —     | tf-dev     |
| 10  | Agents       | `agents` frontmatter field is a string (not array) in 5 agents: conductor, conductor-fastpath, architect, bicep-codegen, terraform-codegen                               | Low      | —     | Phase-next |
| 11  | Instructions | 4 `applyTo` warnings in validate-instruction-references (bicep-code-best-practices, bicep-policy-compliance, terraform-code-best-practices, terraform-policy-compliance) | Low      | —     | Phase-next |

## Resolved Items

| ID  | Domain         | Description                                                                          | Resolved   | Notes                                                      |
| --- | -------------- | ------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------- |
| 1   | Documentation  | `docs/README.md` subagent count said 8, actual is 9                                  | 2026-02-26 | Line 182 now shows "13 agent definitions + 9 subagents"    |
| 2   | Documentation  | `docs.instructions.md` agent table reflected old Bicep-only layout (9)               | 2026-02-26 | Now shows "13 top-level + 9 subagents"                     |
| 3   | Documentation  | `AGENTS.md` skills section referenced 8 skills, actual is 14+                        | 2026-02-26 | No explicit stale count found; docs-writer refs updated    |
| 4   | Documentation  | `docs/exec-plans/` and `QUALITY_SCORE.md` not in `docs/README.md`                    | 2026-02-26 | Lines 201–203 of docs/README.md reference both             |
| 7   | Skills         | 15 skill directories present; 14 named in docs — confirm no residue                  | 2026-02-26 | validate-skills-format confirmed exactly 14 valid skills   |
| 8   | Instructions   | `freshness-checklist.md` expected counts stale (8 agents, 8 skills)                  | 2026-02-26 | File updated to 13 agents, 14 skills (verified 2026-02-26) |
| 9   | Instructions   | `repo-architecture.md` skill catalog showed 8 skills, actual is 14+                  | 2026-02-26 | File now shows "14 skill definitions" on line 12           |
| 12  | Documentation  | `docs/README.md` skill count said 16, filesystem had 17 after `session-resume` added | 2026-03-02 | Updated to 17 in 3 locations; skill added to table         |
| 6   | Infrastructure | Terraform tf-dev branch not merged to main; dual-IaC only on tf-dev                  | 2026-03-04 | tf-dev merged; IaC content archived as .tar.gz (by design) |
| —   | All            | Tracker created — no resolved items at inception                                     | 2026-02-26 | Initial seeding from audit                                 |

## Categories

- **Documentation**: Stale docs, broken links, incorrect counts
- **Instructions**: Overlapping rules, orphaned references
- **Skills**: Outdated guidance, missing coverage
- **Validation**: Missing CI checks, untested rules
- **Infrastructure**: Bicep patterns, module gaps, Terraform parity
- **CI/CD**: Missing or unverified pipeline scripts
