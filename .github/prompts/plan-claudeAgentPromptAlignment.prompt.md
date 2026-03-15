# Plan: Claude Agent Prompt & Hand-off Alignment (v2 — Post-Adversarial Review)

## TL;DR

Review and update 14 Claude-model agent definitions (8 main + 6 subagents) and 14+ Claude-model prompt files to align with Anthropic's Claude Prompting Best Practices (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices). Add Claude-specific XML blocks selectively (not cargo-culted), fix cross-model prompt mismatches, remove stale handoff model overrides, add few-shot examples to key agents, and enrich hand-off context. Work on branch `feat/azure-skills-integration`.

**Key revision from v1**: Both adversarial reviews rejected blanket XML application. Revised plan scopes XML blocks per agent role — no cargo-culting.

## Decisions

- **Frontmatter is source of truth** for model fields
- **Selective XML blocks (REVISED from v1)**: Add only where genuinely useful per agent role. DO NOT add `<investigate_before_answering>` to Requirements (conflicts with ONE-SHOT gate) or lint subagents (procedural wrappers). DO NOT add `<avoid_overengineering>` to Architect (core job is comprehensive analysis). DROP `<use_parallel_tool_calls>` entirely (Claude 4.6 does this natively per the guide).
- **Replace dropped blocks with Claude-specific patterns**: Add `<context_awareness>` to Conductor and other large agents. Add `<subagent_budget>` to Conductor. Add `<scope_fencing>` instead of `<avoid_overengineering>` where appropriate.
- **Conservative language softening (~30%)**: Soften style emphasis, NOT constraint emphasis. Keep gates.
- **Fix cross-model prompt mismatches**: 5 prompt files → update model to match agent frontmatter
- **Remove stale handoff model overrides**: Remove `model:` lines from Conductor/Architect handoffs. Document rationale for each removal.
- **Pre-removal audit**: Before removing any model override, document whether it was intentional or stale
- **Few-shot examples**: 1-2 structured examples with input/decision/output format for Conductor, Architect, Planners
- **Backup**: tar.gz with integrity check
- **Body size mitigation**: Conductor (850+ lines) already over 400 limit — additions are warnings only, not blockers. Future refactor can extract handoff guide to reduce.

## Adversarial Review Summary

### Review 1 (Staff Engineer — feasibility & risk)

| Tier     | Count | Key Issues                                                                                                                                       |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRITICAL | 4     | Conductor body overflow (76% over), model routing breakage on override removal, language softening unmeasurable, model mismatch scope incomplete |
| HIGH     | 3     | 5+ agents will overflow, missing prompt model audit, few-shot examples lack model-specific provenance                                            |
| MEDIUM   | 2     | Registry sync timing, missing backup integrity check                                                                                             |
| LOW      | 2     | No XML format validator, no post-quality gate                                                                                                    |

**Resolution**: Body size overflow is accepted as warning (already pre-existing for Conductor/Requirements/Architect). Language softening gets a concrete rubric. Registry sync moved to after Phase 1. Backup gets integrity verification.

### Review 2 (Prompt Engineering — quality & model alignment)

| Tier     | Count | Key Issues                                                                                                                                                                                                |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 3     | `<investigate_before_answering>` conflicts with Requirements' ONE-SHOT gate, `<avoid_overengineering>` conflicts with Architect's comprehensive WAF mandate, cargo-cult `<investigate>` on lint subagents |
| HIGH     | 2     | `<use_parallel_tool_calls>` is redundant (Claude does natively), removing model overrides needs enriched context                                                                                          |
| MEDIUM   | 3     | Few-shot examples lack quality rubric, missing `<context_awareness>` for Conductor, missing subagent delegation limits                                                                                    |
| LOW      | 2     | Language softening too conservative, handoff enrichment template missing                                                                                                                                  |

**Resolution**: Dropped `<investigate_before_answering>` from Requirements and lint subagents. Dropped `<avoid_overengineering>` from Architect. Dropped `<use_parallel_tool_calls>` entirely. Added `<context_awareness>` and `<subagent_budget>` to Conductor. Added `<scope_fencing>` as targeted replacement.

**Both reviews agreed on**: Don't cargo-cult XML blocks. Each addition must be justified per the agent's actual role. Claude 4.6 is smart enough without over-prompting.

## In-Scope Files (28+ files + 1 registry)

### Claude Opus 4.6 Agents (6)

| #   | File                                            | Lines | Changes                                                                                                                                        |
| --- | ----------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `.github/agents/01-conductor.agent.md`          | ~850  | Remove handoff model overrides, add context_awareness + subagent_budget + output_contract, reasoning_effort, enrich handoffs, few-shot example |
| 2   | `.github/agents/02-requirements.agent.md`       | ~750  | Add output_contract, scope_fencing, reasoning_effort, soften ~8 instances. NO investigate (conflicts with ONE-SHOT)                            |
| 3   | `.github/agents/03-architect.agent.md`          | ~680  | Add investigate_before_answering, output_contract, reasoning_effort, remove handoff overrides, few-shot example. NO avoid_overengineering      |
| 4   | `.github/agents/05b-bicep-planner.agent.md`     | ~520  | Add investigate, output_contract, scope_fencing, reasoning_effort, few-shot example                                                            |
| 5   | `.github/agents/05t-terraform-planner.agent.md` | ~520  | Mirror 05b                                                                                                                                     |
| 6   | `.github/agents/11-context-optimizer.agent.md`  | ~265  | Add investigate, reasoning_effort                                                                                                              |

### Claude Opus 4.6 / Sonnet 4.6 Agents (2)

| #   | File                                            | Lines | Changes                                                  |
| --- | ----------------------------------------------- | ----- | -------------------------------------------------------- |
| 7   | `.github/agents/01-conductor-fastpath.agent.md` | ~145  | Add reasoning_effort, context_awareness                  |
| 8   | `.github/agents/09-diagnose.agent.md`           | ~290  | Add investigate, empty_result_recovery, reasoning_effort |

### Claude Sonnet 4.6 Subagents (6)

| #   | File                                                           | Lines | Changes                                        |
| --- | -------------------------------------------------------------- | ----- | ---------------------------------------------- |
| 9   | `.github/agents/_subagents/bicep-lint-subagent.agent.md`       | ~75   | NO changes (procedural wrapper)                |
| 10  | `.github/agents/_subagents/bicep-review-subagent.agent.md`     | ~180  | Add output_contract formalizing verdict format |
| 11  | `.github/agents/_subagents/bicep-whatif-subagent.agent.md`     | ~160  | Add empty_result_recovery                      |
| 12  | `.github/agents/_subagents/terraform-lint-subagent.agent.md`   | ~135  | NO changes (procedural wrapper)                |
| 13  | `.github/agents/_subagents/terraform-review-subagent.agent.md` | ~185  | Add output_contract formalizing verdict format |
| 14  | `.github/agents/_subagents/terraform-plan-subagent.agent.md`   | ~200  | Add empty_result_recovery, output_contract     |

### Claude Prompt Files (14+)

| #     | File                              | Change                                     |
| ----- | --------------------------------- | ------------------------------------------ |
| 15    | `04g-governance.prompt.md`        | Model fix: Sonnet 4.6 → GPT-5.4            |
| 16    | `06b-bicep-codegen.prompt.md`     | Model fix: Opus 4.6 → GPT-5.4              |
| 17    | `06t-terraform-codegen.prompt.md` | Model fix: Opus 4.6 → GPT-5.4              |
| 18    | `07b-bicep-deploy.prompt.md`      | Model fix: Sonnet 4.6 → GPT-5.4            |
| 19    | `07t-terraform-deploy.prompt.md`  | Model fix: Sonnet 4.6 → GPT-5.4            |
| 20-28 | 9 Claude prompt files             | Enhance with variable hints, prerequisites |

### Registry

| #   | File                          |
| --- | ----------------------------- |
| 29  | `.github/agent-registry.json` |

## Out of Scope

- All GPT-5.4 and GPT-5.3-Codex agents (already aligned in prior commit)
- Skill files (SKILL.md)
- Instruction files (.instructions.md)
- Infrastructure code
- Lint subagents (bicep-lint, terraform-lint) — procedural wrappers, no prompt changes needed

---

## Steps

### Phase 0: Backup & Baseline (_prerequisite for all_)

1. Create backup: `tar -czf backup/.github-backup-claude-review-$(date +%Y%m%d-%H%M%S).tar.gz .github/`
2. Verify backup integrity: `tar -tzf backup/.github-backup-claude-review-*.tar.gz > /dev/null && echo "OK"`
3. Measure baseline: `wc -l` all 14 in-scope agents
4. Confirm body size limit = 400 lines from `scripts/_lib/paths.mjs`

### Phase 1: Cross-Model Fixes & Handoff Cleanup (_depends on Phase 0_)

5. **Audit ALL handoff model overrides** in Conductor and Architect — document each as "intentional" or "stale" with rationale
6. **Fix 5 prompt file model mismatches**: 04g, 06b, 06t, 07b, 07t → update model to match agent frontmatter (GPT-5.4)
7. **Remove stale model overrides from handoffs** — only remove overrides documented as stale in step 5. For each removed override, enrich the handoff prompt text with 1-2 lines of artifact input/output context (so the target agent has clear instructions regardless of model)
8. Run `npm run validate:agent-registry` to confirm no regressions

### Phase 2: Claude XML Blocks — Main Agents (8 agents) (_depends on Phase 1; parallel with Phase 3_)

#### 2a. Add `<investigate_before_answering>` (SELECTIVE — 5 of 8 agents)

9. Add to: 03-architect, 05b, 05t, 09-diagnose, 11-context-optimizer
10. DO NOT add to: 01-conductor (routes, doesn't investigate), 02-requirements (conflicts with ONE-SHOT gate), 01-conductor-fastpath (too small)
11. Keep to 3-4 lines

#### 2b. Add `<output_contract>` (SELECTIVE — 5 agents with formal outputs)

12. 01-conductor (session state JSON), 02-requirements (01-requirements.md), 03-architect (02-architecture-assessment.md + charts), 05b (04-implementation-plan.md), 05t (mirror 05b)
13. Keep each to 8-12 lines

#### 2c. Add `<context_awareness>` (NEW — 2 large agents)

14. 01-conductor, 02-requirements — both are 750+ lines, Claude 4.6 needs explicit context budget guidance
15. Keep to 4-5 lines: "Before loading large skill files, check if SKILL.digest.md or SKILL.minimal.md variants are available. If context approaches 80%, switch to compressed variants."

#### 2d. Add `<subagent_budget>` (NEW — Conductor only)

16. Conductor orchestrates 12+ agents. Add delegation limit: "Invoke no more than 3 subagents sequentially before checkpointing progress with the user. This preserves context and prevents runaway delegation."
17. 3-4 lines

#### 2e. Add `<scope_fencing>` (REPLACES avoid_overengineering — 3 agents)

18. 02-requirements, 05b, 05t — these produce structured artifacts where scope creep is a risk
19. NOT for 03-architect (comprehensive WAF analysis is its core job)
20. 3-4 lines: "Audit your output against the step artifact template. Do not add sections, features, or analysis beyond what the template specifies."

#### 2f. Add `<empty_result_recovery>` (1 agent)

21. 09-diagnose — Azure resource queries may return empty results

#### 2g. Conservative language softening (~30%)

22. **Softening rubric**:
    - KEEP absolute language at: deployment approval gates, security baseline enforcement (TLS/HTTPS/MI), governance compliance (Deny policy mapping), authentication validation, placeholder scanning gates, ONE-SHOT gates
    - SOFTEN only: duplicate emphasis where adjacent prose already conveys the same rule, "CRITICAL" on non-security items → "Important", repeated "MUST" where context makes obligation clear → remove emphasis, "NEVER" that restates a positive DO rule → remove the NEVER version
23. Target: ~30% reduction measured by `grep -ci "MANDATORY\|NEVER\|CRITICAL\|MUST\|HARD" <file>` before/after

#### 2h. Add reasoning effort comments

24. Add `<!-- Recommended reasoning_effort: {level} -->` to agents missing it:
    - conductor=high, conductor-fastpath=medium, requirements=medium, architect=high, 05b=high, 05t=high, diagnose=medium, context-optimizer=medium

#### 2i. Enrich hand-off prompts

25. For each hand-off, add 1-2 sentences: what artifact was produced (input for target), what the target agent should produce (output), path references
26. Keep model-agnostic for cross-model transitions

#### Agent-specific net-new lines:

27. **01-conductor** (+12): context_awareness, subagent_budget, output_contract, remove ~8 model overrides (net neutral), enrich ~5 handoffs, soften ~5 instances
28. **01-conductor-fastpath** (+4): reasoning_effort, context_awareness
29. **02-requirements** (+12): output_contract, scope_fencing, context_awareness, soften ~8 instances. NO investigate, NO avoid_overengineering
30. **03-architect** (+12): investigate, output_contract, reasoning_effort, remove handoff overrides, soften ~4 instances. NO avoid_overengineering
31. **05b-bicep-planner** (+12): investigate, output_contract, scope_fencing, reasoning_effort, soften ~5 instances
32. **05t-terraform-planner** (+12): mirror 05b
33. **09-diagnose** (+8): investigate, empty_result_recovery, reasoning_effort, soften ~2 instances
34. **11-context-optimizer** (+5): investigate, reasoning_effort

### Phase 3: Claude Subagent Refinement (4 of 6 subagents) (_depends on Phase 0; parallel with Phase 2_)

35. **bicep-lint-subagent**: NO changes (procedural wrapper, per adversarial review)
36. **bicep-review-subagent** (+6): Add `<output_contract>` formalizing APPROVED/NEEDS_REVISION/FAILED verdict. Soften ~2 MANDATORY
37. **bicep-whatif-subagent** (+4): Add `<empty_result_recovery>` for no-change what-if
38. **terraform-lint-subagent**: NO changes (procedural wrapper)
39. **terraform-review-subagent** (+6): Mirror bicep-review
40. **terraform-plan-subagent** (+8): Add `<empty_result_recovery>` + `<output_contract>` for plan summary

### Phase 4: Few-Shot Examples (4 agents) (_depends on Phase 2_)

41. **01-conductor**: 1 structured example of workflow routing with input state → decision logic → output handoff (~10 lines in `<example>` tags)
42. **03-architect**: 1 example of WAF scoring table format (~10 lines)
43. **05b-bicep-planner**: 1 example of dependency ordering (~8 lines)
44. **05t-terraform-planner**: 1 example mirroring 05b (~8 lines)
45. Each example MUST include: input state, decision logic, expected output format

### Phase 5: Prompt File Enhancement (14+ prompts) (_depends on Phase 1_)

46. Fix 5 prompt model mismatches (step 6)
47. Enhance 9+ Claude prompt files with variable hints, prerequisites, session state detection hints
48. Verify `resume-workflow.prompt.md` still correct after prior changes

### Phase 6: Validation & Verification (_depends on Phases 2-5_)

49. `npm run validate:all` — full suite
50. `npm run lint:agent-frontmatter`
51. `npm run validate:agent-registry`
52. `npm run lint:md`
53. `npm run lint:agent-body-size` — log warnings, NOT blockers
54. `wc -l` all 14 agents — compare to baseline
55. Language softening verification: `grep -ci "MANDATORY\|NEVER\|CRITICAL\|MUST" <file>` before/after
56. `git diff --stat` — verify only in-scope files changed
57. Spot-check: Read 01-conductor and 02-requirements in full

### Phase 7: Commit & Push (_depends on Phase 6_)

58. `git add .github/ backup/`
59. Commit with conventional message:

    ```
    feat(agents): align Claude Opus/Sonnet agent prompts with Anthropic guidance

    - Add investigate_before_answering to 5 Claude agents (selective, not blanket)
    - Add output_contract to 5 agents with formal artifact outputs
    - Add context_awareness to 2 large agents (Conductor, Requirements)
    - Add subagent_budget to Conductor (delegation limits)
    - Add scope_fencing to 3 artifact-producing agents
    - Add empty_result_recovery to Diagnose + 2 subagents
    - Fix 5 prompt file model mismatches (Claude → GPT-5.4)
    - Remove stale model overrides from Conductor/Architect handoffs
    - Conservative language softening (~30% of absolute instances)
    - Add few-shot examples to Conductor, Architect, Planners
    - Enrich hand-off prompts with artifact context
    - Add reasoning_effort comments to 8 agents
    ```

60. `git push origin feat/azure-skills-integration`

---

## Relevant Files

### Main Agents (edit)

- `.github/agents/01-conductor.agent.md` — Remove model overrides, add context_awareness + subagent_budget + output_contract, example, enrich handoffs
- `.github/agents/01-conductor-fastpath.agent.md` — Add reasoning_effort, context_awareness
- `.github/agents/02-requirements.agent.md` — Add output_contract, scope_fencing, context_awareness, soften language. NO investigate
- `.github/agents/03-architect.agent.md` — Add investigate, output_contract, remove handoff overrides, example. NO avoid_overengineering
- `.github/agents/05b-bicep-planner.agent.md` — Add investigate, output_contract, scope_fencing, example
- `.github/agents/05t-terraform-planner.agent.md` — Mirror 05b
- `.github/agents/09-diagnose.agent.md` — Add investigate, empty_result_recovery
- `.github/agents/11-context-optimizer.agent.md` — Add investigate, reasoning_effort

### Subagents (edit)

- `.github/agents/_subagents/bicep-review-subagent.agent.md` — Add output_contract
- `.github/agents/_subagents/bicep-whatif-subagent.agent.md` — Add empty_result_recovery
- `.github/agents/_subagents/terraform-review-subagent.agent.md` — Add output_contract
- `.github/agents/_subagents/terraform-plan-subagent.agent.md` — Add empty_result_recovery, output_contract

### Subagents (no changes)

- `.github/agents/_subagents/bicep-lint-subagent.agent.md` — Skip (procedural wrapper)
- `.github/agents/_subagents/terraform-lint-subagent.agent.md` — Skip (procedural wrapper)

### Prompt Files (edit)

- 5 prompt files: model field fixes (04g, 06b, 06t, 07b, 07t)
- 9+ prompt files: Claude-specific enhancements

### Registry (verify)

- `.github/agent-registry.json` — Verify sync after all changes

### Read-only references

- `scripts/_lib/paths.mjs` — Body size limit (400 lines)
- Claude Prompting Best Practices — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

## Verification

1. `npm run validate:all` passes (pre-existing lint errors in microsoft-foundry skills are acceptable)
2. `npm run lint:agent-frontmatter` passes
3. `npm run validate:agent-registry` passes (diagnose warning is pre-existing)
4. `npm run lint:agent-body-size` passes — no NEW agents exceed 400 lines
5. `wc -l` comparison: all agents within estimated line-count increase vs baseline
6. Language softening verified via grep counts (before/after)
7. `git diff --stat` shows only in-scope files modified
8. Spot-check: Read 01-conductor.agent.md and 02-requirements.agent.md in full
9. Backup verified: `tar -tzf backup/.github-backup-claude-review-*.tar.gz | wc -l`

## Further Considerations

1. **Conductor body size (850+ lines)**: Pre-existing overflow. Future refactor could extract handoff definitions to a separate reference file, reducing body by ~200 lines.
2. **Language softening automation**: Consider creating `scripts/lint-agent-language.mjs` in a follow-up to prevent regression of absolute language density.
3. **Post-implementation quality measurement**: Run 3-5 test scenarios through Conductor after changes to measure turn count and artifact quality impact.
