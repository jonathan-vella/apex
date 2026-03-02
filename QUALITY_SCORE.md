# Quality Score

> Project health at a glance. Updated by the doc-gardening workflow and manual review.

| Domain          | Grade | Status                                                                        | Next Action                                           |
| --------------- | ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| Agents          | A-    | 14 primary + 9 subagents; dual-IaC Bicep + Terraform complete                 | Fix `agents` array warnings in 4 agent frontmatters   |
| Skills          | A     | 17 named GA skills confirmed; all pass GA format validation; no residue found | Maintain as new skills added                          |
| Instructions    | A-    | 26 instruction files; 0 errors; 3 minor `applyTo` warnings (non-blocking)     | Investigate ⚠️ on bicep/shell/terraform applyTo globs |
| Infrastructure  | B+    | Bicep complete; Terraform track on tf-dev, not yet merged                     | Merge tf-dev and validate full Terraform suite        |
| Documentation   | A     | Agent/skill counts accurate across all docs after gardening fix               | Monitor for drift after future skill additions        |
| CI / Validation | A     | 15 validators; all pass; validate:session-state added; full suite green       | Maintain as new validators added                      |
| Backlog         | B     | 2 active debt items remain (tf-dev merge, frontmatter warnings); 7 resolved   | Close resolved issues; track frontmatter fix          |

## Grading Scale

| Grade | Meaning                                                |
| ----- | ------------------------------------------------------ |
| A     | Excellent — mechanically enforced, minimal manual gaps |
| B     | Good — conventions documented, some manual enforcement |
| C     | Fair — known gaps, improvement plan exists             |
| D     | Poor — significant gaps, no active remediation         |
| F     | Critical — domain is broken or unmaintained            |

## Change Log

| Date       | Domain          | Change                                                                                  |
| ---------- | --------------- | --------------------------------------------------------------------------------------- |
| 2026-02-26 | All             | Initial QUALITY_SCORE.md created; doc-gardening workflow adopted                        |
| 2026-02-26 | Infrastructure  | Terraform track (tf-dev): 3 agents + 3 subagents + Terraform CodeGen                    |
| 2026-02-26 | Skills          | terraform-patterns skill added; microsoft-\* skills added                               |
| 2026-02-26 | Documentation   | Doc-gardening run: 7 debt items resolved; all count references now accurate             |
| 2026-02-26 | Skills          | Skills grade upgraded A- → A: all 14 confirmed valid GA; 15th-folder false alarm closed |
| 2026-02-26 | Agents          | New debt item: 4 agents have `agents` frontmatter field as string (should be array)     |
| 2026-03-02 | Skills          | Skills count 14 → 17: `session-resume`, `context-optimizer`, `golden-principles` added  |
| 2026-03-02 | Agents          | Agent count corrected 13 → 14 primary (context-optimizer agent was undercounted)        |
| 2026-03-02 | CI / Validation | Added `validate:session-state` script; validator count 14 → 15                          |
| 2026-03-02 | Documentation   | Fixed docs/README.md skill counts (16 → 17); added `session-resume` to skills table     |
| 2026-03-02 | Documentation   | Grade upgraded A- → A: all counts now accurate after gardening fix                      |
| 2026-03-02 | Instructions    | Instruction count corrected 25 → 26                                                     |

## How to Update

1. Run the doc-gardening prompt: `.github/prompts/doc-gardening.prompt.md`
2. Review findings and update grades above
3. Log changes in the Change Log table
4. Update `docs/exec-plans/tech-debt-tracker.md` for tracked debt items
