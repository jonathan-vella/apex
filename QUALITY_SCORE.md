# Quality Score

> Project health at a glance. Updated by the doc-gardening workflow and manual review.

| Domain          | Grade | Status                                                                     | Next Action                                  |
| --------------- | ----- | -------------------------------------------------------------------------- | -------------------------------------------- |
| Agents          | A-    | 16 primary + 11 subagents; 01-conductor.agent.md is 354 lines (>350 limit) | Trim conductor to ≤350 lines                 |
| Skills          | A     | 18 GA skills; 14 split with references/; 69 on-demand reference files      | Maintain as new skills added                 |
| Instructions    | A     | 27 instruction files; 5 split with references; narrow globs enforced       | Monitor via `lint:glob-audit`                |
| Infrastructure  | A-    | Bicep + Terraform merged; IaC content archived as .tar.gz (by design)      | Expand Terraform E2E templates when needed   |
| Documentation   | A-    | 15 doc pages had stale 7-step/count refs; fixed 2026-03-11                 | Run doc-gardening after structural changes   |
| CI / Validation | A     | 35 validators; 1 failing (validate:agent-body-size: conductor 354 lines)   | Fix conductor body size to unblock A+        |
| Context Budget  | A     | Agents -18%, Skills -46%, Instructions -32% vs baseline; 69 ref files      | Quarterly audit via AGENTS.md checklist      |
| Backlog         | B+    | 3 active debt items; 12 resolved                                           | Close resolved issues; track frontmatter fix |

## Grading Scale

| Grade | Meaning                                                |
| ----- | ------------------------------------------------------ |
| A     | Excellent — mechanically enforced, minimal manual gaps |
| B     | Good — conventions documented, some manual enforcement |
| C     | Fair — known gaps, improvement plan exists             |
| D     | Poor — significant gaps, no active remediation         |
| F     | Critical — domain is broken or unmaintained            |

## Change Log

| Date       | Domain          | Change                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------ |
| 2026-02-26 | All             | Initial QUALITY_SCORE.md created; doc-gardening workflow adopted                                 |
| 2026-02-26 | Infrastructure  | Terraform track (tf-dev): 3 agents + 3 subagents + Terraform CodeGen                             |
| 2026-02-26 | Skills          | terraform-patterns skill added; microsoft-\* skills added                                        |
| 2026-02-26 | Documentation   | Doc-gardening run: 7 debt items resolved; all count references now accurate                      |
| 2026-02-26 | Skills          | Skills grade upgraded A- → A: all 14 confirmed valid GA; 15th-folder false alarm closed          |
| 2026-02-26 | Agents          | New debt item: 4 agents have `agents` frontmatter field as string (should be array)              |
| 2026-03-02 | Skills          | Skills count 14 → 17: `session-resume`, `context-optimizer`, `golden-principles` added           |
| 2026-03-02 | Agents          | Agent count corrected 13 → 14 primary (context-optimizer agent was undercounted)                 |
| 2026-03-02 | CI / Validation | Added `validate:session-state` script; validator count 14 → 15                                   |
| 2026-03-02 | Documentation   | Fixed docs/README.md skill counts (16 → 17); added `session-resume` to skills table              |
| 2026-03-02 | Documentation   | Grade upgraded A- → A: all counts now accurate after gardening fix                               |
| 2026-03-02 | Instructions    | Instruction count corrected 25 → 26                                                              |
| 2026-03-04 | Context Budget  | M1: Agents -15%, Skills -20%, Instructions -32%; 43 on-demand reference files                    |
| 2026-03-04 | CI / Validation | M2: 5 context-optimization validators added; validator count 15 → 22                             |
| 2026-03-04 | Skills          | M2: 5 skills split (session-resume, terraform-patterns, azure-bicep-patterns, etc.)              |
| 2026-03-04 | Agents          | M2: 3 subagents trimmed; iac-common skill created; golden-principles integrated                  |
| 2026-03-04 | Agents          | M3: Fast-path conductor created; challenger model → Sonnet 4.6; agent count 14 → 15              |
| 2026-03-04 | Documentation   | M3: Weekly freshness cron workflow; quarterly context audit checklist                            |
| 2026-03-04 | Context Budget  | M3 FINAL: Agents -18%, Skills -46%, Instructions -32%; 60 on-demand reference files              |
| 2026-03-04 | CI / Validation | Doc-gardening: validator count corrected 22 → 33                                                 |
| 2026-03-04 | Backlog         | Doc-gardening: debt #10 updated (5 agents); debt #11 updated (4 warnings, new set)               |
| 2026-03-04 | Infrastructure  | tf-dev merged; IaC archived as .tar.gz (by design); grade B+ → A-; debt #6 resolved              |
| 2026-03-06 | Skills          | Skills count corrected 18 → 20: `workflow-engine` and `context-shredding` were missing from docs |
| 2026-03-06 | Documentation   | docs/README.md skill counts updated (18 → 20) in 3 locations; 2 skills added to table            |
| 2026-03-06 | Backlog         | Debt #5 resolved: validate:terraform runs clean (IaC archived, zero projects expected)           |
| 2026-03-11 | Skills          | 3 microsoft-\* skills removed (PR chore/remove-microsoft-learn-mcp); count 20 → 18               |
| 2026-03-11 | Skills          | Docs updated: 14 skills split with references/ (was 10); 69 on-demand reference files (was 60)   |
| 2026-03-11 | Agents          | Count updated: 16 primary (+1: 04g-governance), 11 subagents (+2 challenger reviewers)           |
| 2026-03-11 | Agents          | Grade A → A-: 01-conductor.agent.md is 354 lines (>350 limit); validate:agent-body-size failing  |
| 2026-03-11 | CI / Validation | Grade A+ → A: validate:agent-body-size has 1 error (conductor body 354 lines)                    |
| 2026-03-11 | Backlog         | Debt #10 updated: 7 agents now have frontmatter array warning (was 5)                            |
| 2026-03-11 | Backlog         | New debt #14: 01-conductor.agent.md body 354 lines exceeds 350-line limit                        |
| 2026-03-11 | Documentation   | Grade A → A-: 15 doc pages had stale 7-step refs, agent/skill counts; all corrected              |
| 2026-03-11 | Instructions    | Count corrected 26 → 27                                                                          |
| 2026-03-11 | CI / Validation | Validator count corrected 33 → 35 (distinct lint: + validate: scripts)                           |
| 2026-03-11 | Context Budget  | Ref files corrected 60 → 69                                                                      |
| 2026-03-11 | Backlog         | Active debt items 2 → 3 (added #14)                                                              |

## How to Update

1. Run the doc-gardening prompt: `.github/prompts/doc-gardening.prompt.md`
2. Review findings and update grades above
3. Log changes in the Change Log table
4. Update `docs/exec-plans/tech-debt-tracker.md` for tracked debt items
