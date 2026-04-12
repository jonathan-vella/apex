# Quality Score

> Project health at a glance. Updated by the doc-gardening workflow and manual review.
> Exact entity counts are computed dynamically — see `.github/count-manifest.json`.

| Domain          | Grade | Status                                                                  | Next Action                                |
| --------------- | ----- | ----------------------------------------------------------------------- | ------------------------------------------ |
| Agents          | A     | 16 primary + 7 subagents; all pass structural + model-prompt checks     | Monitor via `validate:agents`              |
| Skills          | A     | 47 skills; all lint clean; references and canary markers present        | Monitor via `lint:skills-format`           |
| Instructions    | A     | 26 instructions; 0 orphaned refs; all applyTo globs have matching files | Monitor via `lint:glob-audit`              |
| Infrastructure  | A-    | Bicep + Terraform merged; IaC content archived as .tar.gz (by design)   | Expand Terraform E2E templates when needed |
| Documentation   | A     | Docs fresh; no stale files; lint:md 0 errors; freshness report clean    | Run doc-gardening after structural changes |
| CI / Validation | A     | Core repo lint clean; drawio-mcp-server suppressed via local config     | Monitor via `lint:md`                      |
| Context Budget  | A     | Agents -18%, Skills -46%, Instructions -32% vs baseline (stable)        | Quarterly audit via AGENTS.md checklist    |
| Backlog         | A     | 1 active item: E2E lessons                                              | Monitor E2E improvements                   |

## Grading Scale

| Grade | Meaning                                                |
| ----- | ------------------------------------------------------ |
| A     | Excellent — mechanically enforced, minimal manual gaps |
| B     | Good — conventions documented, some manual enforcement |
| C     | Fair — known gaps, improvement plan exists             |
| D     | Poor — significant gaps, no active remediation         |
| F     | Critical — domain is broken or unmaintained            |

## Change Log

| Date       | Domain          | Change                                                                                                            |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-02-26 | All             | Initial QUALITY_SCORE.md created; doc-gardening workflow adopted                                                  |
| 2026-02-26 | Infrastructure  | Terraform track (tf-dev): 3 agents + 3 subagents + Terraform CodeGen                                              |
| 2026-02-26 | Skills          | terraform-patterns skill added; microsoft-\* skills added                                                         |
| 2026-02-26 | Documentation   | Doc-gardening run: 7 debt items resolved; all count references now accurate                                       |
| 2026-02-26 | Skills          | Skills grade upgraded A- → A: all 14 confirmed valid GA; 15th-folder false alarm closed                           |
| 2026-02-26 | Agents          | New debt item: 4 agents have `agents` frontmatter field as string (should be array)                               |
| 2026-03-02 | Skills          | Skills count 14 → 17: `session-resume`, `context-optimizer`, `golden-principles` added                            |
| 2026-03-02 | Agents          | Agent count corrected 13 → 14 primary (context-optimizer agent was undercounted)                                  |
| 2026-03-02 | CI / Validation | Added `validate:session-state` script; validator count 14 → 15                                                    |
| 2026-03-02 | Documentation   | Fixed docs/README.md skill counts (16 → 17); added `session-resume` to skills table                               |
| 2026-03-02 | Documentation   | Grade upgraded A- → A: all counts now accurate after gardening fix                                                |
| 2026-03-02 | Instructions    | Instruction count corrected 25 → 26                                                                               |
| 2026-03-04 | Context Budget  | M1: Agents -15%, Skills -20%, Instructions -32%; 43 on-demand reference files                                     |
| 2026-03-04 | CI / Validation | M2: 5 context-optimization validators added; validator count 15 → 22                                              |
| 2026-03-04 | Skills          | M2: 5 skills split (session-resume, terraform-patterns, azure-bicep-patterns, etc.)                               |
| 2026-03-04 | Agents          | M2: 3 subagents trimmed; iac-common skill created; golden-principles integrated                                   |
| 2026-03-04 | Agents          | M3: Fast-path conductor created; challenger model → Sonnet 4.6; agent count 14 → 15                               |
| 2026-03-04 | Documentation   | M3: Weekly freshness cron workflow; quarterly context audit checklist                                             |
| 2026-03-04 | Context Budget  | M3 FINAL: Agents -18%, Skills -46%, Instructions -32%; 60 on-demand reference files                               |
| 2026-03-04 | CI / Validation | Doc-gardening: validator count corrected 22 → 33                                                                  |
| 2026-03-04 | Backlog         | Doc-gardening: debt #10 updated (5 agents); debt #11 updated (4 warnings, new set)                                |
| 2026-03-04 | Infrastructure  | tf-dev merged; IaC archived as .tar.gz (by design); grade B+ → A-; debt #6 resolved                               |
| 2026-03-06 | Skills          | Skills count corrected 18 → 20: `workflow-engine` and `context-shredding` were missing from docs                  |
| 2026-03-06 | Documentation   | docs/README.md skill counts updated (18 → 20) in 3 locations; 2 skills added to table                             |
| 2026-03-06 | Backlog         | Debt #5 resolved: validate:terraform runs clean (IaC archived, zero projects expected)                            |
| 2026-03-11 | Skills          | 3 microsoft-\* skills removed (PR chore/remove-microsoft-learn-mcp); count 20 → 18                                |
| 2026-03-11 | Skills          | Docs updated: 14 skills split with references/ (was 10); 69 on-demand reference files (was 60)                    |
| 2026-03-11 | Agents          | Count updated: 16 primary (+1: 04g-governance), 11 subagents (+2 challenger reviewers)                            |
| 2026-03-11 | Agents          | Grade A → A-: 01-orchestrator.agent.md is 354 lines (>350 limit); validate:agent-body-size failing                |
| 2026-03-11 | CI / Validation | Grade A+ → A: validate:agent-body-size has 1 error (conductor body 354 lines)                                     |
| 2026-03-11 | Backlog         | Debt #10 updated: 7 agents now have frontmatter array warning (was 5)                                             |
| 2026-03-11 | Backlog         | New debt #14: 01-orchestrator.agent.md body 354 lines exceeds 350-line limit                                      |
| 2026-03-15 | All             | Comprehensive validation: count-manifest.json created as single source of truth for entity counts                 |
| 2026-03-15 | CI / Validation | New validator: `validate:no-hardcoded-counts` — detects hard-coded entity counts in prose                         |
| 2026-03-15 | Skills          | New skill: `count-registry` — provides canonical count phrasing for agents; 39 total skills                       |
| 2026-03-15 | Instructions    | New instruction: `no-hardcoded-counts.instructions.md` — prevents count anti-pattern; 26 total                    |
| 2026-03-15 | Documentation   | Purged 78 hard-coded counts across 37 files; all entity references now use descriptive language                   |
| 2026-03-15 | Documentation   | Resolved "7 steps" vs "8 steps" conflict: all references now say "multi-step workflow"                            |
| 2026-03-15 | Agents          | Grade A- → A: conductor body 228 lines, well under 400-line validator limit; debt #14 resolved                    |
| 2026-03-15 | Backlog         | Debt #14 resolved (conductor body within limits); 1 remaining: lint:md plugin files (accepted)                    |
| 2026-03-11 | Documentation   | Grade A → A-: 15 doc pages had stale 7-step refs, agent/skill counts; all corrected                               |
| 2026-03-11 | Instructions    | Count corrected 26 → 27                                                                                           |
| 2026-03-11 | CI / Validation | Validator count corrected 33 → 35 (distinct lint: + validate: scripts)                                            |
| 2026-03-11 | Context Budget  | Ref files corrected 60 → 69                                                                                       |
| 2026-03-11 | Backlog         | Active debt items 2 → 3 (added #14)                                                                               |
| 2026-03-15 | Skills          | Skills count 18 → 38: 20 Azure skills integrated (azure-skills plugin #240-#245)                                  |
| 2026-03-15 | Skills          | Ref files 69 → 834; skills with refs 14 → 32; grade A → A- (19 missing Reference Index)                           |
| 2026-03-15 | Instructions    | Instruction count corrected 27 → 25                                                                               |
| 2026-03-15 | CI / Validation | Validator count 35 → 46; lint:md failing on 3 SKILL.minimal.md files                                              |
| 2026-03-15 | CI / Validation | Grade A → A-: markdown lint errors in microsoft-foundry, terraform-patterns, workflow-engine                      |
| 2026-03-15 | Documentation   | Grade A- → A: all docs updated within 15 days; no stale files                                                     |
| 2026-03-15 | Agents          | Orchestrator body 354 → 363 lines; 2 codegen agents have absolute-language warnings                               |
| 2026-03-15 | Backlog         | Debt #11 resolved (glob audit now clean); debt #15 added (markdown lint); #10 updated (8 agents)                  |
| 2026-03-15 | All             | Stale ref fixed: CHANGELOG.md `azure-troubleshooting` → `azure-diagnostics`                                       |
| 2026-03-23 | All             | Doc-gardening run: all checks pass; no stale files; freshness report clean                                        |
| 2026-03-23 | Agents          | Orchestrator body 363 → 337 lines; debt #14 resolved; 3 registry model-mismatch warnings found                    |
| 2026-03-23 | Skills          | Skills count 40 → 43; ref files 834 → 508; 19 orphaned skills (plugin architecture, by design)                    |
| 2026-03-23 | Instructions    | Instruction count 25 → 28 (3 new); all applyTo globs have matching files                                          |
| 2026-03-23 | CI / Validation | Grade A → A-: 34 validators; lint:md 115 errors in demo (96) + tests (11) + 4 site docs                           |
| 2026-03-23 | CI / Validation | SKILL.md lint errors resolved (debt #17); demo content now the primary lint debt                                  |
| 2026-03-23 | Backlog         | Debt #14 resolved (conductor 337 lines); #17 resolved (no SKILL.md lint errors)                                   |
| 2026-03-23 | Backlog         | New debt #18 (registry model drift, 3 agents), #19 (demo content lint, 96 errors)                                 |
| 2026-03-25 | Skills          | Ref files 508 → 474 (orphan cleanup); new enterprise-reference-example added to azure-diagrams                    |
| 2026-03-25 | Skills          | azure-diagrams skill: cross-step visual continuity section + curated reference example added                      |
| 2026-03-25 | CI / Validation | Grade A- → A: lint:md dropped from 115 errors to 2 (Fabric icon ref blanks only)                                  |
| 2026-03-25 | Backlog         | Debt #19 resolved (demo lint excluded or fixed); grade A- → A                                                     |
| 2026-03-25 | Backlog         | New debt #20: Fabric icon reference.md has 2 blank-line lint errors (MD012)                                       |
| 2026-03-27 | Skills          | Drawio SKILL.md: Reference Index section added; 3 canary markers added; ref files 473 total                       |
| 2026-03-27 | Skills          | Excalidraw references cleaned: 2 orphaned files removed (migrated to drawio); 1 ref remaining                     |
| 2026-03-27 | Agents          | 08-as-built.agent.md: ordered list numbering fixed (MD029)                                                        |
| 2026-03-27 | CI / Validation | Core repo lint clean (0 errors); 91 lint errors in vendored `mcp/drawio-mcp-server/` only                         |
| 2026-03-27 | CI / Validation | Freshness check: 0 issues (was 5); all canary markers and Reference Index sections present                        |
| 2026-03-27 | Instructions    | All instruction checks pass: 65 checks, 0 errors, 0 warnings                                                      |
| 2026-03-27 | Backlog         | Debt #20 resolved (Fabric ref blanks no longer flagged); drawio-mcp-server lint added as #21                      |
| 2026-04-03 | Agents          | Grade A → A-: e2e-orchestrator body 430 lines (>400 limit after E2E lessons edits)                                |
| 2026-04-03 | CI / Validation | Grade A → A-: drawio-mcp-server lint 91 → 314 errors (third-party content growth)                                 |
| 2026-04-03 | Skills          | Skills count 43 → 47; all lint clean; 2 prompt model-mismatch warnings remain                                     |
| 2026-04-03 | Instructions    | 26 instructions; all checks pass (58 checks, 0 errors)                                                            |
| 2026-04-03 | Backlog         | Grade A → A-: new debt #22 (e2e-orchestrator body size), #23 (E2E lessons improvements)                           |
| 2026-04-03 | Backlog         | Debt #18 updated: model-mismatch now 2 prompt warnings (governance/diagnose registry drift resolved)              |
| 2026-04-03 | CI / Validation | Grade A- → A: debt #21 resolved; local .markdownlint-cli2.jsonc suppresses vendored drawio rules                  |
| 2026-04-03 | Backlog         | Debt #21 resolved; active items 4 → 3                                                                             |
| 2026-04-12 | Agents          | Model assignments updated for 9 agents/subagents (codegen/deploy → GPT-5.4, design/subagents → Claude Sonnet 4.6) |
| 2026-04-12 | Backlog         | Debt #18 resolved: 0 prompt model-mismatch warnings remain (orchestrator + design prompts fixed)                  |
| 2026-04-12 | Backlog         | Active items 3 → 2: e2e-orchestrator body, E2E lessons                                                            |
| 2026-04-12 | Documentation   | Doc-gardening: 4 terminology errors fixed in `site/src/content/docs/reference/resources.md`                       |
| 2026-04-12 | Instructions    | `agent-definitions.instructions.md` prose + table model drift fixed (challenger, codegen, design)                 |
| 2026-04-12 | Agents          | Grade A- → A: e2e-orchestrator 425 lines under new 500-line limit; all validators pass                            |
| 2026-04-12 | Backlog         | Debt #22 resolved (body limit raised to 500); active items 2 → 1                                                  |

## How to Update

1. Run the doc-gardening prompt: `.github/prompts/doc-gardening.prompt.md`
2. Review findings and update grades above
3. Log changes in the Change Log table
4. Update `docs/exec-plans/tech-debt-tracker.md` for tracked debt items
