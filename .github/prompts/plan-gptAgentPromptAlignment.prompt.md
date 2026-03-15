# Plan: GPT Agent Prompt & Hand-off Alignment (v2 — Post-Adversarial Review)

## TL;DR

Review and update 13 GPT-model agent definitions and 5 GPT-model prompt files to align with OpenAI's GPT-5.4 Prompt Guidance and Codex Prompting Guide. Apply lightweight structured prompt patterns (not heavy XML), improve hand-off context, fix model registry discrepancies. Work on branch `feat/azure-skills-integration`.

**Key revision from v1**: Both adversarial reviews rejected blanket 6-XML-block-per-agent approach. Revised plan uses selective, minimal-overhead patterns.

## Decisions

- **Frontmatter is source of truth** for model fields → update `agent-registry.json` to match
- **Selective XML block adoption (REVISED from v1)**: Add only `<output_contract>` blocks to agents with formal output requirements. Use prose for verification/completeness/tool rules (proven effective — challenger-review-subagent is the best-structured subagent and uses no XML)
- **Model-specific patterns**: Codex-specific patterns (compaction readiness, batch optimization) for GPT-5.3-Codex agents; GPT-5.4 patterns (output contracts, dependency checks as prose, empty-result recovery) for GPT-5.4 agents
- **DO NOT add Codex autonomy preambles to subagents** — existing patterns already work well
- **Hand-off style**: Keep existing labels imperative; enrich prompt body text with artifact state context but keep narrow/safe (no inline artifact content)
- **DROP reasoning_effort from frontmatter** — not a real VS Code Copilot field; add as prose guidance comment in agent body instead
- **Backup**: Create `backup/` folder in repo root with tar.gz of `.github/` before any changes (not .gitignored per user request)
- **Branch**: All work on `feat/azure-skills-integration`
- **Body size limit**: Verify actual enforced limit in `scripts/_lib/paths.mjs` before any edits; if an agent goes over, log a **warning** but do NOT block — it is not a blocker
- **No PR needed**: Commit and push directly on `feat/azure-skills-integration`

## In-Scope Files (18 files + 1 registry)

### GPT-5.4 Agents (8)

| #   | File                                            | Current Model     |
| --- | ----------------------------------------------- | ----------------- |
| 1   | `.github/agents/04-design.agent.md`             | GPT-5.4 (copilot) |
| 2   | `.github/agents/04g-governance.agent.md`        | GPT-5.4 (copilot) |
| 3   | `.github/agents/06b-bicep-codegen.agent.md`     | GPT-5.4 (copilot) |
| 4   | `.github/agents/06t-terraform-codegen.agent.md` | GPT-5.4 (copilot) |
| 5   | `.github/agents/07b-bicep-deploy.agent.md`      | GPT-5.4 (copilot) |
| 6   | `.github/agents/07t-terraform-deploy.agent.md`  | GPT-5.4 (copilot) |
| 7   | `.github/agents/08-as-built.agent.md`           | GPT-5.4 (copilot) |
| 8   | `.github/agents/10-challenger.agent.md`         | GPT-5.4           |

### GPT-5.3-Codex / GPT-5.4 Subagents (5)

| #   | File                                                                  | Current Model           |
| --- | --------------------------------------------------------------------- | ----------------------- |
| 9   | `.github/agents/_subagents/challenger-review-subagent.agent.md`       | GPT-5.4                 |
| 10  | `.github/agents/_subagents/challenger-review-codex-subagent.agent.md` | GPT-5.3-Codex (copilot) |
| 11  | `.github/agents/_subagents/challenger-review-batch-subagent.agent.md` | GPT-5.3-Codex (copilot) |
| 12  | `.github/agents/_subagents/cost-estimate-subagent.agent.md`           | GPT-5.3-Codex (copilot) |
| 13  | `.github/agents/_subagents/governance-discovery-subagent.agent.md`    | GPT-5.3-Codex (copilot) |

### GPT Prompt Files (4 GPT-specific + 1 model fix)

| #   | File                                          | Current Model   | Scope                                      |
| --- | --------------------------------------------- | --------------- | ------------------------------------------ |
| 14  | `.github/prompts/01-conductor.prompt.md`      | GPT-5.4 (WRONG) | Model fix only → change to Claude Opus 4.6 |
| 15  | `.github/prompts/04-design.prompt.md`         | GPT-5.3-Codex   | GPT prompt enhancement                     |
| 16  | `.github/prompts/08-as-built.prompt.md`       | GPT-5.3-Codex   | GPT prompt enhancement                     |
| 17  | `.github/prompts/challenger-review.prompt.md` | GPT-5.4         | GPT prompt enhancement                     |
| 18  | `.github/prompts/resume-workflow.prompt.md`   | GPT-5.4         | GPT prompt enhancement                     |

### Registry

| #   | File                          |
| --- | ----------------------------- |
| 19  | `.github/agent-registry.json` |

## Out of Scope

- All Claude Opus 4.6 and Claude Sonnet 4.6 agents (17 agents, 14 prompts)
- Skill files (SKILL.md) — no model-specific prompt patterns
- Instruction files (.instructions.md) — format rules, not model prompts
- Infrastructure code (Bicep/Terraform templates)
- The `01-Conductor` agent itself (uses Claude Opus 4.6) — only its GPT-5.4 prompt file is in scope

---

## Steps

### Phase 0: Backup & Baseline (prerequisite for all other phases)

1. Create `backup/` directory in repo root
2. Run `tar -czf backup/.github-backup-$(date +%Y%m%d-%H%M%S).tar.gz .github/`
3. Verify backup integrity: `tar -tzf backup/.github-backup-*.tar.gz | head -20`
4. **NEW**: Read `scripts/_lib/paths.mjs` to determine actual enforced body size limit (300 vs 350 vs 400 lines) — resolve discrepancy before any edits
5. **NEW**: Measure current line counts for all 13 in-scope agents with `wc -l` — record as baseline

### Phase 1: Registry Alignment (_depends on Phase 0_)

6. Read `.github/agent-registry.json` in full
7. Update model fields in `agent-registry.json` to match frontmatter values for all 13 in-scope agents
8. **RESOLVED**: Fix 01-conductor.prompt.md — change model from GPT-5.4 to Claude Opus 4.6 to match the Conductor agent. This prompt is now **out of GPT-specific scope** (fix applied as a simple model field correction in Phase 1).
9. Run `npm run validate:agent-registry` to confirm no regressions

### Phase 2: GPT-5.4 Agent Prompt Enhancement (8 agents) (_depends on Phase 1; parallel with Phase 3_)

For each GPT-5.4 agent (#1-#8), apply these changes selectively based on agent needs:

#### 2a. Add `<output_contract>` block (SELECTIVE — only agents with formal outputs)

10. **Agents needing output_contract**: 04-design (3 files), 06b-bicep-codegen (file tree), 06t-terraform-codegen (file tree), 07b-bicep-deploy (deployment summary), 07t-terraform-deploy (deployment summary), 08-as-built (7 docs), 10-challenger (JSON findings)
11. Keep each block to 8-12 lines: list expected files, format, and validation command
12. **DO NOT add** output_contract to 04g-governance — its output is already well-defined in the Phase 2: Generate Artifacts section

#### 2b. Strengthen existing prose gates (NOT new XML blocks)

13. For agents with existing verification gates (what-if classification, quality scores, placeholder scanning), add **one sentence of GPT-5.4 guidance at the gate**: "Do not finalize until verification passes. If a check fails, retry with a different strategy before reporting blocked."
14. Add `<empty_result_recovery>` (3-5 lines) ONLY to agents that query Azure: 04g-governance, 07b-bicep-deploy, 07t-terraform-deploy — this is a genuine gap the guides call out

#### 2c. Add dependency preamble (prose, not XML)

15. For each agent, add a 2-3 line "Prerequisites" reminder at the top of the workflow: "Before starting, verify these files exist: [list]. If any is missing, stop and report which file is absent."
16. This replaces the proposed `<dependency_checks>` XML block with equivalent, lighter-weight prose

#### 2d. Add reasoning effort as prose comment (NOT frontmatter)

17. Add a single comment line to each agent's body: `<!-- Recommended reasoning_effort: medium -->` — this serves as documentation for human maintainers, not a parsed field
18. Recommendations: design=medium, governance=low, bicep-codegen=high, terraform-codegen=high, bicep-deploy=medium, terraform-deploy=medium, as-built=medium, challenger=high

#### 2e. Improve hand-off prompt bodies

19. Keep existing labels unchanged
20. Enrich hand-off `prompt:` fields with 1-2 sentences: what artifact was produced, what the target agent should expect as input
21. **SAFETY**: Never inline artifact content in hand-off text — reference file paths only
22. For cross-model hand-offs (GPT → Claude or vice versa), keep hand-off text simple and model-agnostic

#### 2f. GPT-5.4-specific lightweight patterns

23. Add `<user_updates_spec>` (5 lines) to long-running agents only: 06b-bicep-codegen, 06t-terraform-codegen, 08-as-built — these are the agents that take many turns
24. Add `<default_follow_through_policy>` (4 lines) to agents with approval gates: 04g-governance, 07b-bicep-deploy, 07t-terraform-deploy

#### Agent-specific changes (net-new lines estimate per agent):

25. **04-design** (+15): output_contract for 3 files + prose quality gate reinforcement
26. **04g-governance** (+10): empty_result_recovery + follow_through_policy
27. **06b-bicep-codegen** (+25): output_contract for file tree + user_updates_spec + consolidate scattered tool rules into one DO/DON'T row
28. **06t-terraform-codegen** (+25): mirror 06b; retain HCP guardrail as-is
29. **07b-bicep-deploy** (+15): output_contract for deployment summary + empty_result_recovery + follow_through_policy
30. **07t-terraform-deploy** (+15): mirror 07b
31. **08-as-built** (+20): output_contract listing all 7 docs + user_updates_spec + pricing provenance reinforcement
32. **10-challenger** (+10): output_contract for JSON + input fallback rule for unmatched artifacts

### Phase 3: Codex Subagent Refinement (5 subagents) (_depends on Phase 0; parallel with Phase 2_)

**REVISED**: DO NOT add Codex autonomy preambles — existing agents already work well. Focus on targeted improvements:

33. **challenger-review-subagent** (GPT-5.4): Add `<output_contract>` formalizing the existing JSON spec (already good — just wrap in block). Add input validation: "If artifact_path doesn't exist, return error JSON with status: 'artifact_not_found'"
34. **challenger-review-codex-subagent** (Codex): No structural changes — already well-optimized. Add empty_result_recovery for edge case where artifact is empty file
35. **challenger-review-batch-subagent** (Codex): Add explicit parallel coordination note: "Process each artifact independently; do not let findings from one artifact influence scoring of another"
36. **cost-estimate-subagent** (Codex): Formalize call budget as a visible rule: "**Budget**: ≤5 MCP tool calls total. If budget exhausted, report partial results with [budget_exceeded] flag." Add empty_result_recovery for unknown SKUs
37. **governance-discovery-subagent** (Codex): Add empty_result_recovery for 0-policy-found scenarios. Reinforce batch script preference. No autonomy preamble needed — agent already has excellent structure

### Phase 4: Prompt File Enhancement (5 prompts) (_depends on Phase 1_)

38. **01-conductor.prompt.md**: Fix model field from GPT-5.4 → Claude Opus 4.6 (Conductor uses Opus). No GPT-specific prompt changes.
39. **04-design.prompt.md**: Add project_name and architecture_assessment_path as expected variables
40. **08-as-built.prompt.md**: Add list of prerequisite artifacts the user should confirm exist
41. **challenger-review.prompt.md**: Add artifact_type hint so users know to specify it
42. **resume-workflow.prompt.md**: Verify session-state.json path reference is correct

### Phase 5: Validation & Verification (_depends on Phases 2-4_)

43. Run `npm run validate:all` — full validation suite
44. Run `npm run lint:agent-frontmatter` — frontmatter compliance
45. Run `npm run validate:agent-registry` — registry consistency
46. Run `npm run lint:md` — markdown linting
47. Run `npm run validate:agent-body-size` — if any agent exceeds the limit, log as **warning** (not a blocker)
48. `wc -l` all 13 agents — compare against Phase 0 baseline to confirm additions are within estimates
49. `git diff --stat` to verify only in-scope files changed (18 agents/prompts + 1 registry)
50. Spot-check: Read 06b-bicep-codegen and 07b-bicep-deploy in full to verify changes integrate cleanly with existing prose

### Phase 6: Commit & Push (_depends on Phase 5_)

51. Stage changes: `git add .github/`
52. Commit with descriptive message:

    ```
    feat(agents): align GPT-5.4/Codex agent prompts with OpenAI guidance

    - Add output_contract blocks to 7 GPT-5.4 agents with formal outputs
    - Add empty_result_recovery to 3 Azure-querying agents
    - Add user_updates_spec to 3 long-running agents
    - Enrich hand-off prompts with input/output context
    - Update agent-registry.json model fields to match frontmatter
    - Fix 01-conductor.prompt.md model to Claude Opus 4.6
    - Strengthen existing prose verification gates
    ```

53. Push: `git push origin feat/azure-skills-integration`

---

## Relevant Files

- `.github/agents/04-design.agent.md` — Add output_contract (3 files), reinforce quality gate prose
- `.github/agents/04g-governance.agent.md` — Add empty_result_recovery + follow_through_policy
- `.github/agents/06b-bicep-codegen.agent.md` — Add output_contract, user_updates_spec, consolidate tool rules (+25 lines)
- `.github/agents/06t-terraform-codegen.agent.md` — Mirror 06b for Terraform (+25 lines)
- `.github/agents/07b-bicep-deploy.agent.md` — Add output_contract + empty_result_recovery + follow_through_policy
- `.github/agents/07t-terraform-deploy.agent.md` — Mirror 07b for Terraform
- `.github/agents/08-as-built.agent.md` — Add output_contract (7 docs), user_updates_spec, reinforce pricing provenance
- `.github/agents/10-challenger.agent.md` — Add output_contract for JSON, input fallback rule
- `.github/agents/_subagents/challenger-review-subagent.agent.md` — Formalize existing JSON output as output_contract + input validation
- `.github/agents/_subagents/challenger-review-codex-subagent.agent.md` — Add empty_result_recovery only
- `.github/agents/_subagents/challenger-review-batch-subagent.agent.md` — Add parallel coordination note
- `.github/agents/_subagents/cost-estimate-subagent.agent.md` — Formalize call budget, add empty_result_recovery
- `.github/agents/_subagents/governance-discovery-subagent.agent.md` — Add empty_result_recovery, reinforce batch preference
- `.github/prompts/01-conductor.prompt.md` — Resolve model override, add context
- `.github/prompts/04-design.prompt.md` — Add variable hints
- `.github/prompts/08-as-built.prompt.md` — Add prerequisite list
- `.github/prompts/challenger-review.prompt.md` — Add artifact_type hint
- `.github/prompts/resume-workflow.prompt.md` — Verify session-state path
- `.github/agent-registry.json` — Update model fields to match frontmatter
- `scripts/_lib/paths.mjs` — READ ONLY: determine actual body size limit

## Verification

1. `npm run validate:all` passes with 0 errors
2. `npm run lint:agent-frontmatter` passes
3. `npm run validate:agent-registry` passes
4. `npm run lint:md` passes
5. `npm run validate:agent-body-size` passes — no agent exceeds the enforced limit
6. `wc -l` comparison: all 13 agents within estimated line-count increase vs Phase 0 baseline
7. `git diff --stat` shows only in-scope files modified (18 agents/prompts + 1 registry)
8. Spot-check: Read 06b-bicep-codegen.agent.md and 07b-bicep-deploy.agent.md in full to verify changes integrate with existing prose
9. Backup verification: `tar -tzf backup/.github-backup-*.tar.gz | wc -l` matches original file count

## Adversarial Review Summary

### Review 1 (Staff Engineer — feasibility & risk)

| Tier     | Count | Key Issues                                                                                      |
| -------- | ----- | ----------------------------------------------------------------------------------------------- |
| CRITICAL | 3     | Body size overflow risk, XML not parsed by Copilot framework, conflicting body size limits      |
| HIGH     | 6     | Model source ambiguity, cross-model hand-off risk, no XML validation, conductor prompt mismatch |
| MEDIUM   | 5     | Frontmatter sync, backup location, batch validation, commit message                             |
| LOW      | 2     | Mirror details, context shredding tiers                                                         |

**Resolution**: Reduced XML blocks from 6 per agent to 1 selective (`output_contract`). Rest stays as prose. Body size risk mitigated to +10-25 lines per agent.

### Review 2 (Prompt Engineering — quality & model alignment)

| Tier     | Count | Key Issues                                                                                                                         |
| -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 4     | 6 XML blocks = instruction fatigue, reasoning_effort not a Copilot field, Codex preambles break working agents, cargo-culting risk |
| HIGH     | 3     | Hand-off injection risk, completeness_contract underspecified, verification_loop adds rigidity                                     |
| MEDIUM   | 3     | Verbose hand-offs, body overflow, breaking optimized Codex agents                                                                  |
| LOW      | 3     | No XML linting, missing Codex preamble template, conductor model mismatch                                                          |

**Resolution**: Dropped blanket XML, dropped Codex autonomy preambles, dropped reasoning_effort as frontmatter field. Added targeted patterns only where gaps are real.

**Both reviews agreed on**: Don't over-engineer. Existing challenger-review-subagent (best-structured, no XML) proves prose works. Add structure only where genuine gaps exist.

**Missing patterns acknowledged but deferred**: Compaction API integration, Phase parameter, full personality customization — these require API-level changes beyond prompt text.

## Further Considerations

1. **Body size headroom**: Even with reduced scope (+10-25 lines per agent), if 06b-bicep-codegen goes over, it's a **warning only** — not a blocker. We proceed regardless and can optimize later.
2. **Future work**: Consider adding automated prompt↔agent alignment validation in a follow-up commit.
