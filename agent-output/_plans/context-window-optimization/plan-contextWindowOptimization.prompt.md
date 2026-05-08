# Plan: End-to-End Context Window Optimization

Address the five context-bloat sources diagnosed earlier (terminal output
replay, large file reads, artifact echo, subagent JSON dumps, heavy
auto-load baseline). Goal: reduce the per-turn token floor and prevent
the chat from re-bloating mid-workflow.

## Decisions captured

- Drop `skills` and `capability_skills` from `tools/registry/agent-registry.json` entirely.
- Architecture-explorer: drop agent→skill edges (skill nodes still exist as standalone nodes).
- Delete `tools/scripts/validate-registry-skill-coverage.mjs` and its npm script.
- Defer per-agent token-budget validator to a follow-up PR.

## Phase 1 — Subagent output contract (biggest single lever)

Goal: subagents write JSON to disk, return a 5–10 line summary instead of full payload.

### Path & write convention (resolves MF-1)

- **Path is parent-supplied.** Subagent receives `output_path` as an explicit input from its caller. Subagent does not compute the path or pass-number itself.
- **Step-namespaced prefix.** Caller uses the artifact-template prefix of its own step (e.g., Architect in Step 2 → `02-…`, Designer in Step 3 → `03-des-…`). This keeps `lint:artifact-templates` happy.
- **Pass numbering.** Reviews that may run multi-pass use `…-pass{N}.json`; `{N}` is supplied by the caller (Orchestrator increments via apex-recall). Single-pass artifacts (e.g., cost estimate) omit the suffix.
- **Atomic write.** Subagent writes to `{output_path}.tmp` then renames to `{output_path}`. Partial writes never appear under the canonical name.
- **Refuse-on-exists.** If the target already exists, subagent fails fast unless caller sets `overwrite: true`. This prevents silent loss on retries and parallel runs.
- **Backward compatibility.** The existing `nordic-foods/challenge-findings-requirements.json` (no `-pass` suffix) is grandfathered: parents may read either name; new writes always use the new convention.

1. Edit [.github/agents/_subagents/challenger-review-subagent.agent.md](../../../.github/agents/_subagents/challenger-review-subagent.agent.md):
   - Flip the "Do not write files" constraint. New contract: write the file at the caller-supplied `output_path` (canonical pattern: `agent-output/{project}/challenge-findings-{artifact}-pass{N}.json`)
     and return only `{overall_assessment, must_fix_count, should_fix_count, suggestion_count, file_path}`.
   - Apply the atomic-write + refuse-on-exists rules from the convention block above.
   - Update Output, Constraints, Stop rules sections.
   - Note in body: parent agent reads the file only if needed.
2. Edit [.github/agents/_subagents/cost-estimate-subagent.agent.md](../../../.github/agents/_subagents/cost-estimate-subagent.agent.md):
   - Flip "READ-ONLY". New contract: write the file at the caller-supplied `output_path` (canonical pattern when invoked by Architect: `agent-output/{project}/02-cost-estimate.json`; a small `02-cost-estimate.summary.md` may accompany it if structured md is required)
     and return totals + status only.
   - Apply the atomic-write + refuse-on-exists rules from the convention block above.
   - Update Goal, Constraints, Stop rules, Output Format.
3. Update parent agents that consume these subagents (Architect, Orchestrator,
   Requirements, IaC Planner, As-Built):
   - Replace "the subagent returns JSON; record it in artifact" with
     "the subagent writes the JSON; read it from disk if you need to surface findings".
   - Add a "do not paste subagent JSON inline" instruction.
   - Each call site must pass `output_path` explicitly per the convention above.
   - After the subagent returns, record the artifact via `apex-recall checkpoint <project> <step> subagent-output --json` (the existing `checkpoint` subcommand stamps the new file in session state). Note: `apex-recall` has no dedicated `artifact` subcommand; use `checkpoint` and let the file index pick the new file up on next `reindex` (resolves S-1).
4. Update the standalone [.github/agents/10-challenger.agent.md](../../../.github/agents/10-challenger.agent.md) wrapper (resolves S-4):
   - Verify it delegates fully to `challenger-review-subagent` and does not duplicate the now-flipped constraints.
   - If the wrapper accepts a target artifact path, document that it must also pass an `output_path` to the subagent per the convention above.
5. Update [.github/skills/workflow-engine/references/subagent-integration.md](../../../.github/skills/workflow-engine/references/subagent-integration.md)
   to document the new file-mode contract (path convention, atomic write, refuse-on-exists, parent-supplied paths, apex-recall artifact registration).
6. Add fixture-based contract test (resolves S-2): create `tools/tests/subagent-file-contract.test.mjs` that asserts, against canned subagent-call recordings: (a) summary message is ≤2 KB and ≤15 lines, (b) the declared `file_path` exists post-call, (c) summary numeric counts (`must_fix_count` etc.) match the file content, (d) re-running without `overwrite: true` is rejected.

Files: 2 subagent .agent.md, ~5 parent agent .agent.md, 1 standalone challenger wrapper, 1 skill reference, 1 NEW test file.
Validation: run a Step 1 / Step 2 dry-run; assert subagent final message <2KB and that the canonical file exists post-call. Also run `npm run lint:vendor-prompting` after subagent edits — flipping core constraints can break the GPT-5.5 outcome-first / Claude XML structure rules (resolves S-5).

### Rollback (Phase 1)

- Tag the pre-Phase-1 commit (`git tag pre-subagent-file-contract`) before merging. Rollback = revert the subagent diff and restore inline-JSON parent calls. Outputs already written to disk under the new convention can be left in place (parents will simply ignore them on rollback).

## Phase 2 — Drop `skills` / `capability_skills` from agent-registry

Order: loosen schema → drop validator branches → drop generator branches → clean data → tighten schema → docs.

1. Schema (loosen first) — edit [tools/schemas/agent-registry.schema.json](../../../tools/schemas/agent-registry.schema.json):
   make `skills` and `capability_skills` not required (and not referenced
   in additionalProperties=false rules). This unblocks intermediate states.
2. Validator code — edit [tools/scripts/validate-agent-registry.mjs](../../../tools/scripts/validate-agent-registry.mjs):
   drop the `validateSkills(...)` calls (lines 31, 38, 60, 71). Remove the
   helper function if unused. Keep checks for `agent`, `model`, `step`, `invokable`.
3. Generator — edit [tools/scripts/generate-explorer-graph.mjs](../../../tools/scripts/generate-explorer-graph.mjs):
   delete the two skill-loop blocks (lines ~377 and ~397). Stop emitting
   agent→skill edges. Skill nodes remain (built from `.github/skills/*/SKILL.md`).
4. Orphan validator — edit [tools/scripts/validate-orphaned-content.mjs](../../../tools/scripts/validate-orphaned-content.mjs):
   remove the `entry.capability_skills` and `entry.skills` reads (lines ~41–47, ~142).
   "Wired skills" set is now derived from a regex sweep across
   `.github/agents/**/*.agent.md` and `.github/skills/**/SKILL.md`. Use the
   explicit pattern `\.github/skills/([a-z0-9-]+)/SKILL(\.digest|\.minimal)?\.md`
   so digest/minimal references and full-file references are all counted (resolves SF-2).
   Add a small fixture test under `tools/tests/orphan-skill-discovery.test.mjs`
   that asserts the parser finds known references in a fixture set covering
   `SKILL.md`, `SKILL.digest.md`, `SKILL.minimal.md`, and fenced code blocks.
   Document the supported phrasings (one paragraph) in `.github/instructions/agent-skills.instructions.md` so authors don't drift to ad-hoc forms.
5. Skill-coverage validator — delete:
   - [tools/scripts/validate-registry-skill-coverage.mjs](../../../tools/scripts/validate-registry-skill-coverage.mjs)
   - the corresponding npm script in [package.json](../../../package.json)
   - any reference in [lefthook.yml](../../../lefthook.yml), `.github/workflows/*.yml`, docs
6. Site documentation (resolves MF-3) — edit:
   - [site/src/content/docs/concepts/how-it-works/skills-and-instructions.md](../../../site/src/content/docs/concepts/how-it-works/skills-and-instructions.md) — rewrite the "Wire it to an agent" section (line 199): skills are wired by the agent body's `Read .github/skills/{name}/...` line, not by an entry in `agent-registry.json`. Drop the "Also add the skill to the agent's entry in `tools/registry/agent-registry.json`" sentence.
   - [site/src/content/docs/concepts/how-it-works/four-pillars.md](../../../site/src/content/docs/concepts/how-it-works/four-pillars.md) — line 70 table cell: change "Agent role → file, model, required skills" to "Agent role → file, model, step".
   - Run `npm run lint:md` after.
7. Registry data — edit [tools/registry/agent-registry.json](../../../tools/registry/agent-registry.json):
   - Remove all `skills` and `capability_skills` arrays from every entry.
   - Update the top-level `description` field (remove the long paragraph
     about the two-skill-field contract; replace with a one-liner).
8. Schema (tighten last) — re-edit [tools/schemas/agent-registry.schema.json](../../../tools/schemas/agent-registry.schema.json):
   delete the `skills` and `capability_skills` property definitions
   entirely. Update top-level `description`.
9. Regenerate — run `node tools/scripts/generate-explorer-graph.mjs` so
   [site/public/architecture-explorer-graph.json](../../../site/public/architecture-explorer-graph.json)
   no longer has the edges.
10. Validation — run:
    - `npm run lint:json`
    - `npm run lint:md`
    - `node tools/scripts/validate-agent-registry.mjs`
    - `node tools/scripts/validate-orphaned-content.mjs`
    - `npm run validate:all`
    - `npm run validate:agent-registry`

### Rollback (Phase 2)

- Tag the pre-Phase-2 commit (`git tag pre-skills-removal`) before merging and reference the tag in the PR description (resolves S-3 for Phase 2). Rollback is non-trivial because the deleted `skills[]` / `capability_skills[]` data is not preserved elsewhere; the tag is the canonical recovery point. To revert: `git revert` the Phase 2 commits, then re-run `npm run validate:agent-registry` and `node tools/scripts/generate-explorer-graph.mjs`.

## Phase 3 — Terminal-replay prevention

Goal: stop interactive flags + long-output replay from being injected into chat.
Note: the original incident was a runtime chat behavior (an `mv -i` issued during a turn), not a forbidden pattern committed to a file. The instruction file is the primary control; the linter is a documentation aid that catches drift in committed snippets (resolves SF-3).

1. Add `.github/instructions/no-interactive-shell.instructions.md` with `applyTo` covering all agent, prompt, instruction, and skill files. Rules:
   - Never use `mv -i`, `rm -i`, `cp -i`, `read -p`, `confirm` prompts (including inside `bash -c '…'`).
   - Always prefer `mv -f`, `rm -f`, or use `replace_string_in_file`/`create_file` via the file tool.
   - Pipe long output (>50 lines) to a file (`cmd > /tmp/x && echo "wrote /tmp/x ($(wc -l </tmp/x) lines)"`).
   - If a >50-line output was already produced by mistake, do not attempt to clear it — the transcript already captured it. Note the bloat in apex-recall lessons and avoid repeating (resolves SF-4; previous "run `clear`" rule removed as ineffective).
2. Add `tools/scripts/safe-shell.mjs` (tiny lint, scoped as documentation aid): grep agent, prompt, instruction, skill, and README files for forbidden patterns (`mv -i`, `rm -i`, `cp -i`, `read -p`, and `bash -c '…-i…'`) and fail. The lint cannot enforce runtime chat behavior — that responsibility lies with the instruction file in step 1.
3. Wire `safe-shell` into `npm run validate:all` and lefthook `pre-push`.
4. Add a one-liner to [AGENTS.md](../../../AGENTS.md) and
   [.github/copilot-instructions.md](../../../.github/copilot-instructions.md)
   pointing to the new instruction file.

### Rollback (Phase 3)

- Tag the pre-Phase-3 commit (`git tag pre-terminal-hygiene`). Rollback = revert the new instruction file, the `safe-shell.mjs` script, and the `lint:safe-shell` wiring in `package.json` and `lefthook.yml`. Low risk — phase is purely additive.

## Phase 4 — Trim auto-load baseline

Goal: reduce the per-turn token floor; agents read digests, not full files.

### Baseline measurement protocol (resolves MF-2)

Before any Phase 4 edit lands, capture a baseline. After each change, re-measure and record the delta in the PR description.

- **Method.** Run a single canonical Step 1 invocation on `nordic-foods` (or a fresh fixture project). Read the chat debug log under `{{VSCODE_TARGET_SESSION_LOG}}` and sum the prompt-token field for the auto-loaded baseline files (`AGENTS.md`, `.github/copilot-instructions.md`, registry, skills index). Alternatively, run a one-off script that concatenates the same files and counts tokens via `tiktoken` or `wc -w * 1.3`.
- **Numeric target.** ≥30% reduction in baseline auto-loaded tokens. Sub-targets: AGENTS.md ≥30% token reduction, copilot-instructions.md ≥20% token reduction. Fail the phase if either sub-target is missed.
- **Source of truth.** Record before/after numbers in the PR body and in `agent-output/_plans/context-window-optimization/baseline-measurement.json`.

1. [AGENTS.md](../../../AGENTS.md) — keep top-of-file map, Setup Commands, Build & Validation, Workflow table, and Commit guidelines (these are needed every turn for command discovery, resolves SF-5). Move only the Code Style + Security Baseline tables into pointers to existing skills (these are duplicated in `azure-defaults` and `iac-policy-compliance.md`):
   - "Code Style → see [azure-defaults SKILL.digest.md](../../../.github/skills/azure-defaults/SKILL.digest.md)"
   - "Security Baseline → see [iac-policy-compliance.md](../../../.github/instructions/references/iac-policy-compliance.md)"
   - Target: ≥30% token reduction (measured via the protocol above). Do not use a fixed line target — line counts can mask token impact and risk stripping content the auto-loaded baseline relies on.
2. [.github/copilot-instructions.md](../../../.github/copilot-instructions.md) — same treatment; remove tables that duplicate AGENTS.md or skill digests; keep step-table + chat-trigger rules. Target: ≥20% token reduction.
3. Agent prompts — sweep `.github/agents/**/*.agent.md` for `Read .github/skills/{x}/SKILL.md` (full) and replace with `SKILL.digest.md`. Verified: all 47 skill directories already have a `SKILL.digest.md` — no missing-digest fallback needed.

   Reconciliation with `context-shredding` (resolves S-6): the existing `context-shredding` skill has **two** tier tables: a `Compression Tiers` table (artifact loading by % utilization, around line 20) and a `Skill Loading Tiers` table (SKILL.md / digest / minimal, around line 50). The artifact table is unrelated and stays as-is. Update **only the Skill Loading Tiers table** so the tier rule is:
   - Default (any utilization): `SKILL.digest.md`
   - >80% utilization or explicit minimal-mode flag: `SKILL.minimal.md`
   - Full `SKILL.md` is no longer a default; it is reserved for skill-authoring or debugging contexts where the digest is insufficient.
   This keeps a single source of truth and prevents contradictory guidance between Phase 4 and the skill.
4. Workflow-engine references — add `.github/skills/workflow-engine/references/orchestrator-handoff-guide.digest.md` (≤120 lines) covering only Gate templates + IaC routing decision. Orchestrator reads digest by default; full file remains for fallback.
5. Validate: capture before/after measurement per the protocol above; run an Orchestrator dry-run on `nordic-foods` Step 2; confirm both numeric targets met.

### Rollback (Phase 4)

- Tag the pre-Phase-4 commit (`git tag pre-baseline-trim`) and store the pre-trim `AGENTS.md` and `.github/copilot-instructions.md` snapshots in the PR description as fenced code blocks (recovery hedge in case a `git revert` is messy due to overlapping edits). Rollback = revert the trim commits and re-run baseline measurement to confirm restoration.

## Phase 5 — Optional CI guardrail (deferred per user)

Out of scope for this plan execution; track as follow-up.

## Steps overview

| # | Phase | Block | Parallelizable with |
|---|---|---|---|
| 1 | Subagent contracts | Phase 1 | Phase 3, 4 |
| 2 | Registry simplification | Phase 2 | Phase 3 (independent) |
| 3 | Terminal-replay prevention | Phase 3 | Phases 1, 2, 4 |
| 4 | Auto-load trim | Phase 4 | All |
| 5 | Token budget validator | deferred | — |

Recommended landing order: Phase 1 → Phase 3 → Phase 2 → Phase 4 (smallest blast radius first).

## Relevant Files

### Phase 1 (subagent contracts)

- [.github/agents/_subagents/challenger-review-subagent.agent.md](../../../.github/agents/_subagents/challenger-review-subagent.agent.md) — flip "do not write files" constraint; specify file path per artifact type
- [.github/agents/_subagents/cost-estimate-subagent.agent.md](../../../.github/agents/_subagents/cost-estimate-subagent.agent.md) — flip "READ-ONLY"; specify cost-estimate JSON path
- [.github/agents/10-challenger.agent.md](../../../.github/agents/10-challenger.agent.md) — update standalone wrapper to delegate to the new file-mode contract (resolves S-4)
- [.github/agents/02-requirements.agent.md](../../../.github/agents/02-requirements.agent.md), [.github/agents/03-architect.agent.md](../../../.github/agents/03-architect.agent.md), [.github/agents/04g-governance.agent.md](../../../.github/agents/04g-governance.agent.md), [.github/agents/05-iac-planner.agent.md](../../../.github/agents/05-iac-planner.agent.md), [.github/agents/06b-bicep-codegen.agent.md](../../../.github/agents/06b-bicep-codegen.agent.md), [.github/agents/06t-terraform-codegen.agent.md](../../../.github/agents/06t-terraform-codegen.agent.md), [.github/agents/08-as-built.agent.md](../../../.github/agents/08-as-built.agent.md) — update calls into these subagents to read from disk and to call `apex-recall checkpoint … subagent-output` after each subagent return (resolves S-1)
- [.github/skills/workflow-engine/references/subagent-integration.md](../../../.github/skills/workflow-engine/references/subagent-integration.md) — document file-mode contract (incl. apex-recall registration)
- `tools/tests/subagent-file-contract.test.mjs` — NEW fixture test for the subagent contract (resolves S-2)

### Phase 2 (registry)

- [tools/registry/agent-registry.json](../../../tools/registry/agent-registry.json) — remove `skills`, `capability_skills` from every entry; rewrite top-level description
- [tools/schemas/agent-registry.schema.json](../../../tools/schemas/agent-registry.schema.json) — delete the two property definitions; rewrite description
- [tools/scripts/validate-agent-registry.mjs](../../../tools/scripts/validate-agent-registry.mjs) — drop `validateSkills` calls and the helper function
- [tools/scripts/generate-explorer-graph.mjs](../../../tools/scripts/generate-explorer-graph.mjs) — drop the two skill-loop blocks (lines ~377, ~397)
- [tools/scripts/validate-orphaned-content.mjs](../../../tools/scripts/validate-orphaned-content.mjs) — re-derive "wired skills" via explicit regex `\.github/skills/([a-z0-9-]+)/SKILL(\.digest|\.minimal)?\.md`; drop registry array reads
- `tools/tests/orphan-skill-discovery.test.mjs` — NEW fixture test for the regex (covers `SKILL.md`, `SKILL.digest.md`, `SKILL.minimal.md`, fenced code blocks)
- [.github/instructions/agent-skills.instructions.md](../../../.github/instructions/agent-skills.instructions.md) — document the supported phrasings for skill references
- [tools/scripts/validate-registry-skill-coverage.mjs](../../../tools/scripts/validate-registry-skill-coverage.mjs) — DELETE file
- [package.json](../../../package.json) — remove the `lint:registry-skill-coverage` (or similar) script
- [lefthook.yml](../../../lefthook.yml), `.github/workflows/*.yml`, `docs/**/*.md` — delete references to the removed validator
- [site/src/content/docs/concepts/how-it-works/skills-and-instructions.md](../../../site/src/content/docs/concepts/how-it-works/skills-and-instructions.md) — rewrite "Wire it to an agent" section (drop the registry-edit instruction)
- [site/src/content/docs/concepts/how-it-works/four-pillars.md](../../../site/src/content/docs/concepts/how-it-works/four-pillars.md) — update line 70 table cell
- [site/public/architecture-explorer-graph.json](../../../site/public/architecture-explorer-graph.json) — regenerate (do not hand-edit)

### Phase 3 (terminal hygiene)

- `.github/instructions/no-interactive-shell.instructions.md` — NEW file
- `tools/scripts/safe-shell.mjs` — NEW tiny linter
- [package.json](../../../package.json) — add `lint:safe-shell` script
- [lefthook.yml](../../../lefthook.yml) — wire pre-push check
- [AGENTS.md](../../../AGENTS.md), [.github/copilot-instructions.md](../../../.github/copilot-instructions.md) — add one-liner pointer

### Phase 4 (auto-load trim)

- [AGENTS.md](../../../AGENTS.md) — replace tables with skill pointers; target ≥30% token reduction
- [.github/copilot-instructions.md](../../../.github/copilot-instructions.md) — same; target ≥20% token reduction
- `.github/agents/**/*.agent.md` — sweep `SKILL.md` → `SKILL.digest.md`
- [.github/skills/context-shredding/SKILL.md](../../../.github/skills/context-shredding/SKILL.md) — update **Skill Loading Tiers** table only (the `SKILL.md`/digest/minimal table around line 50; do not touch the artifact `Compression Tiers` table around line 20) so digest is the default and minimal is the >80%-utilization escalation (resolves S-6)
- `.github/skills/workflow-engine/references/orchestrator-handoff-guide.digest.md` — NEW file

## Verification

1. Phase 1 verification:
   - Trigger Step 1 challenger review on `nordic-foods` requirements (already exists). Final subagent message must be ≤10 lines + a `file_path`. Findings JSON file must exist on disk at the caller-supplied `output_path`.
   - Trigger cost-estimate-subagent on a simple input (e.g., 3 SKUs in `swedencentral`). Output file must exist at `agent-output/{project}/02-cost-estimate.json`; final message ≤15 lines.
   - Re-trigger the same challenger run without `overwrite: true`; confirm subagent refuses (does not silently overwrite).
   - Plant a process kill mid-write; confirm no partial canonical file appears (only `.tmp`).
   - Run `node --test tools/tests/subagent-file-contract.test.mjs`; all assertions pass (resolves S-2).
   - Run `npm run lint:vendor-prompting`; subagent files still satisfy GPT-5.5 outcome-first / Claude XML rules (resolves S-5).
   - Spot-check apex-recall: after a parent run, `apex-recall show <project> --json` lists the new artifact file under `files` / latest checkpoint (resolves S-1).
2. Phase 2 verification:
   - `npm run validate:all` passes.
   - `npm run validate:agent-registry` passes.
   - `node tools/scripts/generate-explorer-graph.mjs` emits a graph with no agent→skill edges; agent and skill nodes still present.
   - `git diff site/public/architecture-explorer-graph.json` shows only edge removals (no spurious changes).
   - `npm run lint:json` passes; schema rejects an entry that re-introduces the deleted fields.
   - `npm run lint:md` passes (covers the two updated site doc pages).
   - `node --test tools/tests/orphan-skill-discovery.test.mjs` passes.
3. Phase 3 verification:
   - `npm run lint:safe-shell` passes baseline.
   - Plant a `mv -i` in a copy of an agent file; confirm validator fails it. Plant `bash -c 'rm -i x'`; confirm validator also fails it.
4. Phase 4 verification:
   - `npm run lint:md` passes.
   - Baseline measurement (per Phase 4 protocol): AGENTS.md ≥30% token reduction; copilot-instructions.md ≥20% token reduction. Numbers recorded in `baseline-measurement.json` and PR body.
   - Re-run a Step 1 walkthrough; spot-check that no agent reads `SKILL.md` when `SKILL.digest.md` exists.

## Decisions

- Drop fields in registry rather than rename or hide.
- `skill-affinity` style separate file rejected (would just relocate the bytes).
- Token-budget validator deferred — revisit if context drift returns within 30 days.
- Subagent contract: `output_path` is parent-supplied and mandatory; "no path" mode no longer permitted. Atomic write + refuse-on-exists are required behaviors. Parents must record the output via `apex-recall checkpoint` after each subagent return (apex-recall has no dedicated `artifact` subcommand).
- Architecture-explorer agent→skill edges: dropped entirely (no replacement edges).
- `validate-registry-skill-coverage.mjs`: deleted (its sole purpose disappears with the fields).
- Phase 4 success measured by token-target deltas, not line counts.
- All 47 skill directories already have `SKILL.digest.md`; no missing-digest fallback path is needed.
- `context-shredding` tier table updated: `SKILL.digest.md` is the default; `SKILL.minimal.md` is the >80%-utilization escalation; full `SKILL.md` is reserved for skill-authoring/debugging.
- Each phase is tagged before merge (`pre-subagent-file-contract`, `pre-skills-removal`, `pre-terminal-hygiene`, `pre-baseline-trim`) so rollback has a canonical recovery point.

## Further considerations

1. Atomicity — Phase 2 lands as a single PR using the loosen-schema-first → data-cleanup → tighten-schema sequence within the same diff. Easier review than two PRs.
2. In-flight branches — `feat/vendor-prompting-enforcement` likely touches agent files or the registry. Plan a rebase coordination note in the PR description so the author of in-flight work can drop their `skills[]` edits.
3. Site rebuild — dropping `architecture-explorer-graph.json` edges may visibly thin the published architecture-explorer page. Decide whether to add a one-line caption ("Agent capabilities are discovered at runtime via skill description triggers") or leave the UI as-is.
