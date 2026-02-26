# Quality Score

> Project health at a glance. Updated by the doc-gardening workflow and manual review.

| Domain          | Grade | Status                                                                          | Next Action                                            |
| --------------- | ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Agents          | A-    | 13 primary + 9 subagents; dual-IaC Bicep + Terraform complete                   | Fix `agents` array warnings in 4 agent frontmatters    |
| Skills          | A     | 14 named GA skills confirmed; all pass GA format validation; no residue found   | Maintain as new skills added                           |
| Instructions    | A-    | 25 instruction files; 0 errors; 3 minor `applyTo` warnings (non-blocking)       | Investigate ⚠️ on bicep/shell/terraform applyTo globs  |
| Infrastructure  | B+    | Bicep complete; Terraform track on tf-dev, not yet merged                       | Merge tf-dev and validate full Terraform suite         |
| Documentation   | A-    | Agent/skill counts accurate across all docs; exec-plans linked in README        | Monitor for drift after tf-dev merge                   |
| CI / Validation | A     | 14 validators; all pass; full suite green; validate:terraform runs clean        | Maintain as new validators added                       |
| Backlog         | B     | 2 active debt items remain (tf-dev merge, frontmatter warnings); 7 resolved     | Close resolved issues; track frontmatter fix           |

## Grading Scale

| Grade | Meaning                                                |
| ----- | ------------------------------------------------------ |
| A     | Excellent — mechanically enforced, minimal manual gaps |
| B     | Good — conventions documented, some manual enforcement |
| C     | Fair — known gaps, improvement plan exists             |
| D     | Poor — significant gaps, no active remediation         |
| F     | Critical — domain is broken or unmaintained            |

## Change Log

| Date       | Domain         | Change                                                                                   |
| ---------- | -------------- | ---------------------------------------------------------------------------------------- |
| 2026-02-26 | All            | Initial QUALITY_SCORE.md created; doc-gardening workflow adopted                         |
| 2026-02-26 | Infrastructure | Terraform track (tf-dev): 3 agents + 3 subagents + Terraform CodeGen                    |
| 2026-02-26 | Skills         | terraform-patterns skill added; microsoft-\* skills added                                |
| 2026-02-26 | Documentation  | Doc-gardening run: 7 debt items resolved; all count references now accurate              |
| 2026-02-26 | Skills         | Skills grade upgraded A- → A: all 14 confirmed valid GA; 15th-folder false alarm closed  |
| 2026-02-26 | Agents         | New debt item: 4 agents have `agents` frontmatter field as string (should be array)      |

## How to Update

1. Run the doc-gardening prompt: `.github/prompts/doc-gardening.prompt.md`
2. Review findings and update grades above
3. Log changes in the Change Log table
4. Update `docs/exec-plans/tech-debt-tracker.md` for tracked debt items
