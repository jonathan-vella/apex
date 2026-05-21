# Issue #425 — Workflow Hardening Plan

> Source: [Issue #425 — Workflow hardening: 7-point actionable plan from session-history audit](https://github.com/jonathan-vella/azure-agentic-infraops/issues/425)
> Branch: `feat/workflow-hardening-425`
> Scope: behaviour changes for orchestrated agents (Steps 1–7 + Post) and the subagents they invoke. No new agents.

## Verified anchors (deviations from issue text)

- Safe-shell linter lives at [tools/scripts/safe-shell.mjs](../../tools/scripts/safe-shell.mjs) — issue references `lint-safe-shell.mjs`.
- No `Explore.agent.md` exists. The execution-subagent pattern lives under [.github/agents/_subagents/](../../.github/agents/_subagents). Items 2 + 6 retarget there + [tools/apex-prompts/](../../tools/apex-prompts).
- Item 1 extends [.github/instructions/no-interactive-shell.instructions.md](../../.github/instructions/no-interactive-shell.instructions.md) rather than creating a sibling instructions file (smaller surface, same `applyTo`).
- `tools/scripts/validate-agents.mjs` exists and is the right host for Wave 3's H2-contract check.
- State scope: apex-recall atomically writes `00-session-state.json` then reindexes SQLite separately; it indexes `00-handoff.md` when present, but no current `00-handoff.md` files were found in the workspace. Wave 4 atomicity claims are scoped accordingly (see finding wf425-06).

## Execution waves

### Wave 1 — Foundation (Item 3) — unblocks Wave 2 (post-write hooks). Wave 5 is NOT unblocked here (see wf425-02).

**Task 3: Per-artifact post-write validation**

- Edit [.github/skills/azure-artifacts/SKILL.md](../../.github/skills/azure-artifacts/SKILL.md): add `## Post-write validation` H2 with type → command table:
  - `*.json` → `python -m json.tool <file> >/dev/null`
  - `*.bicep` → `bicep build --stdout <file> >/dev/null`
  - `*.tf` → `terraform fmt -check <file>` + `terraform validate` (when in a module dir)
  - `*.md` artifacts → existing `lint:artifact-templates` via lefthook (do not duplicate)
- Add one-line backref in each Step agent Operating Frame: `02`, `03`, `04`, `04g`, `05`, `06b`, `06t`, `07b`, `07t`, `08`.
- Tests (behavior-based, per wf425-07): `tests/integration/post-write-validation.test.mjs` must cover each artifact type — malformed `*.json`, malformed `*.bicep`, malformed `*.tf` in a module dir, and a malformed `*.md` artifact. Each must fail closed and surface a remediation hint.
- **Acceptance**: behavior tests above are green AND each Step agent body links to the table. Link presence alone is insufficient.

### Wave 2 — Authoring guardrails (Items 1 + 2)

**Task 1: Command portability**

- Extend [.github/instructions/no-interactive-shell.instructions.md](../../.github/instructions/no-interactive-shell.instructions.md) with `## Command portability` section: forbid bare `rg` / `fd` / `bat` in committed snippets without `command -v` guard or stdlib fallback (`grep -R`, `find`, `python -m json.tool`).
- Extend [tools/scripts/safe-shell.mjs](../../tools/scripts/safe-shell.mjs) with a small snippet scanner (per wf425-04): track shell fence boundaries, strip comments, tokenize command position after control operators (`|`, `&&`, `||`, `;`, `$(...)`, `if`, `xargs`, env-prefix), and associate `command -v` guards with the same block. A bare invocation is allowed only when the same block contains either `command -v <tool>` (gating the call) or a documented stdlib fallback (`grep -R` / `find` / `python -m json.tool`).
- Fixtures under `tests/scripts/safe-shell/` covering: bare `rg`, chained `… | rg …`, `if command -v rg; then rg …; else grep -R …; fi`, command substitution `$(rg …)`, guard for a different tool (false-positive guard), comment-only mention, and unrelated guard.
- **Acceptance**: all listed fixtures pass/fail as specified; `npm run lint:safe-shell` green.

**Task 2: Heredoc → editor-tool runtime hook**

- Add a shared "Artifact writes MUST use file-editing tools — never heredoc to `agent-output/**`" rule. Place canonical snippet in [.github/instructions/no-heredoc.instructions.md](../../.github/instructions/no-heredoc.instructions.md) and reference from artifact-writing subagents in [.github/agents/_subagents/](../../.github/agents/_subagents) (especially `policy-precheck-subagent`, `cost-estimate-subagent`, `*-whatif-subagent`, `*-plan-subagent`).
- Extend safe-shell (or sibling) lint to detect any heredoc/redirect writing to `agent-output/**` (per wf425-05): match heredoc operators `<<` and `<<-` regardless of delimiter spelling (quoted/unquoted/arbitrary name), follow the full compound command for `>`, `>>`, `tee`, `tee -a`, and `>&` redirections whose target resolves under `agent-output/**` (including `${VAR}` paths that any committed snippet sets to an `agent-output` prefix), and handle redirection-before-command order.
- Fixtures: classic `cat <<EOF > agent-output/...`, quoted delimiter, indented `<<-EOF`, append `>>`, redirect-before-command, `tee agent-output/...`, `tee -a`, variable-path target.
- **Acceptance**: every fixture above fails lint; safe rewrites (file-editing tool guidance text) pass; subagent prompts explicitly redirect to file-editing tools.

### Wave 3 — Subagent contracts (Item 6 + deploy-preview JSON contract for Wave 5)

**Task 6: Standardized execution-subagent prompt shape**

- New template: `tools/apex-prompts/execution-subagent.prompt.md` with three required H2s — `## Objective`, `## Commands`, `## Expected return`.
- Add rule to [.github/instructions/agent-authoring.instructions.md](../../.github/instructions/agent-authoring.instructions.md) citing the contract.
- Validator hook in [tools/scripts/validate-agents.mjs](../../tools/scripts/validate-agents.mjs): body H2s only (outside code fences), each section unique and non-empty (per wf425-08).
- **Migration inventory** (per wf425-03) — every file in [.github/agents/_subagents/](../../.github/agents/_subagents) is in scope. Migrate all of them in Wave 3 OR ship the validator with an explicit allowlist + follow-up issues. No "reference implementation only" path.
  - `bicep-validate-subagent`, `bicep-whatif-subagent`, `terraform-validate-subagent`, `terraform-plan-subagent`, `cost-estimate-subagent`, `policy-precheck-subagent`, `challenger-review-subagent`.
- **Acceptance**: validator fixtures cover missing slot, duplicate H2, H2 inside fenced code block, empty section, wrong heading level; `npm run validate:agents` green across all migrated subagents.

**Task 6b (new, per wf425-01): Deploy-preview JSON contract — prerequisite for Wave 5**

- Define a shared `deployment-preview-v1` JSON schema with fields: `creates`, `modifies`, `deletes`, `replaces`, `destructive` (bool), `policy_gate` (`PROCEED`|`BLOCK`), `cost_delta_monthly_usd`, `cost_envelope_monthly_usd`, `cost_delta_vs_envelope_pct`, `source_subagent`, `timestamp`.
- Add `output_path` input to `bicep-whatif-subagent` and `terraform-plan-subagent`; both must persist preview JSON conforming to the schema.
- Extend `policy-precheck-subagent` JSON to surface `deploy_gate` already exposed (it does) plus the create/modify/delete counts at the agreed key names.
- Extend `cost-estimate-subagent` to emit `cost_delta_vs_envelope` derived from approved budget envelope in `02-architecture-assessment.md` / cost artifact (define how envelope is sourced).
- **Acceptance**: schema file under `tools/schemas/`, fixture JSON validates against schema, deploy approval block (Wave 5) consumes only the schema fields.

### Wave 4 — State atomicity (Item 4)

**Task 4: `apex-recall transition` composite**

- Add `transition` subcommand to [tools/apex-recall/src/apex_recall](../../tools/apex-recall/src/apex_recall): wraps `checkpoint` + N×`decide` + optional `complete-step` into a single `00-session-state.json` write via the existing `atomic_write` path.
- **Atomicity scope (per wf425-06)**: atomic only for `00-session-state.json`. The SQLite recall index is reindexed after the atomic write; transition is NOT cross-file transactional with `00-handoff.md`. Add tests for index-repair / reindex on crash between state write and index commit. If a future change brings `00-handoff.md` into scope, that's a separate task.
- **Challenger enforcement (per wf425-09)**: transition MUST delegate the gate to the existing `complete-step` logic (do not reimplement). `validate:challenger-presence` remains the authoritative CI fallback. Tests: Steps 1, 2, 3.5, 4 × {sidecar present | missing | unreadable | intentionally skipped via `--allow-missing-challenger --challenger-skip-reason`}.
- CLI shape: `apex-recall transition <project> --from <step> --to <step> [--decision k=v ...] [--complete] [--allow-missing-challenger --challenger-skip-reason "..."] --json`.
- Tests in [tools/apex-recall/tests](../../tools/apex-recall/tests): happy path, missing-challenger rejection, intentional-skip audit entry, partial-failure rollback (state write succeeds, index commit fails → reindex recovers).
- Update `## Session State — apex-recall` block in [.github/copilot-instructions.md](../../.github/copilot-instructions.md) to list `transition` as preferred (legacy commands remain documented as fallback / rollback path).
- Update `01-Orchestrator.agent.md` to use `transition` as the reference path.
- **Acceptance**: tests green; orchestrator uses `transition`; `validate:challenger-presence` still trips when a transition is bypassed via direct state edit.

### Wave 5 — Deploy gates (Items 5 + 7) — depends on Wave 3 Task 6b

**Task 5: One-glance deploy approval block**

- **Prerequisite (per wf425-01/02)**: `deployment-preview-v1` schema from Wave 3 Task 6b is in place and all four data-source subagents emit conforming JSON.
- Update [.github/agents/07b-bicep-deploy.agent.md](../../.github/agents/07b-bicep-deploy.agent.md) and [.github/agents/07t-terraform-deploy.agent.md](../../.github/agents/07t-terraform-deploy.agent.md): before any `azd up` / `terraform apply`, read the four JSON sources, then render:

  ```text
  creates: N | modifies: N | deletes: N
  destructive: yes/no
  policy_gate: PROCEED/BLOCK
  cost_delta: +$X/month (vs envelope)
  decision: [approve] [abort]
  ```

- Add a check item to `challenger-review-subagent`'s deploy-lens checklist: "Approval block present and populated from schema-conformant sources."
- **Acceptance**: end-to-end fixture (preview JSON → rendered block) passes; deploy agents render the block before the human gate; challenger flags missing/under-populated block.

**Task 7: Universal bounded-retry policy**

- Add `## Bounded retry` H2 to [.github/skills/iac-common/SKILL.md](../../.github/skills/iac-common/SKILL.md): cap 3 attempts → escalate with fixed triple `proceed-with-substitute` / `change-region` / `abort`.
- Reference (one line each) from `07b`, `07t`, `04g-governance` agent bodies and from `policy-precheck-subagent.agent.md`.
- Add challenger checklist entry: "Retry loop bounded ≤3 with named escalation options."
- **Acceptance**: each named agent body contains retry ceiling + triple; challenger fixture flags unbounded loops.

### Wave 6 — Release hygiene (new, per wf425-10)

- Update docs site pages affected by the changes (apex-recall `transition`, deploy approval gates, post-write validation, command-portability rule).
- CHANGELOG entry referencing #425 with subsections per wave.
- Run `npm run validate:no-hardcoded-counts`; confirm [tools/registry/count-manifest.json](../../tools/registry/count-manifest.json) needs no count changes (no new agents/skills; new subcommand + validators only).
- Document rollback: legacy `checkpoint` / `decide` / `complete-step` remain functional; safe-shell + heredoc rules are additive (no behavior change for compliant snippets); deploy approval block can be disabled via a one-line agent revert.

## Commit map

| Wave | Conventional commit                                                                  |
| ---- | ------------------------------------------------------------------------------------ |
| 1    | `feat(skills): add post-write validation table + behavior tests (#425)`              |
| 2    | `feat(instructions): add command-portability rule + safe-shell scanner (#425)`       |
| 2    | `feat(agents): forbid heredoc/tee writes to agent-output in subagents (#425)`        |
| 3    | `feat(agents): standardize execution-subagent prompt contract + migrate all (#425)`  |
| 3    | `feat(schemas): add deployment-preview-v1 contract for deploy gates (#425)`          |
| 4    | `feat(apex-recall): add transition composite subcommand (#425)`                      |
| 5    | `feat(agents): deploy approval block + bounded-retry policy (#425)`                  |
| 6    | `docs: workflow-hardening rollout + CHANGELOG (#425)`                                |

## Pre-PR validation

```bash
npm run validate:all
pytest tools/apex-recall/tests
npm run lint:safe-shell
```

## Out of scope (per issue)

- New agents or new workflow steps.
- Changes to `agent-output/**` artifacts of existing projects.
- Re-running historical workflows.

## Adversarial review findings

Single-pass `comprehensive` review by `challenger-review-subagent` on 2026-05-21. 11 findings; BLOCKER + HIGH items are folded into the plan above. Full list retained for traceability.

| ID         | Sev      | Category               | Summary                                                                                              | Resolution in plan                                       |
| ---------- | -------- | ---------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| wf425-01   | BLOCKER  | coupling               | Deploy approval block needs JSON contract changes across 4 subagents; "no new tooling" was wrong.    | New Wave 3 Task 6b (`deployment-preview-v1` schema).     |
| wf425-02   | HIGH     | ordering_risk          | Wave 1 does not unblock Wave 5; Wave 5 depends on Wave 3 contract.                                   | Wave 1 unblock claim corrected; Wave 5 dep stated.       |
| wf425-03   | HIGH     | scope_creep            | Migrating only `policy-precheck-subagent` either leaves validator unenforced or breaks others.       | Wave 3 lists all 7 subagents; migrate-all or allowlist.  |
| wf425-04   | HIGH     | validator_design       | `^\s*(rg\|fd\|bat)` regex too narrow; misses pipes, subshells, conditionals, env-prefix.             | Replaced with snippet scanner + expanded fixtures.       |
| wf425-05   | HIGH     | validator_design       | Heredoc check misses `<<-`, quoted delimiters, `tee`, append, redirect-before-command, var paths.    | Broadened detector spec + fixtures enumerated.           |
| wf425-06   | HIGH     | atomicity_claim        | apex-recall is not cross-file transactional; state + SQLite index commit separately.                 | Wave 4 atomicity scope narrowed; reindex-recovery tests. |
| wf425-07   | MEDIUM   | acceptance_test_rigor  | "Agent body links to table" is not falsifiable; single JSON fixture under-covers.                    | Behavior tests for JSON/Bicep/TF/MD added to Wave 1.     |
| wf425-08   | MEDIUM   | acceptance_test_rigor  | Wave 3 validator acceptance doesn't cover fenced H2s, duplicates, empty sections.                    | Validator semantics + fixture matrix added to Wave 3.    |
| wf425-09   | MEDIUM   | missing_items          | `transition` could bypass `validate:challenger-presence` if it reimplements gate logic.              | Wave 4 mandates delegation to `complete-step` gate.      |
| wf425-10   | MEDIUM   | missing_items          | No docs site / CHANGELOG / count-manifest / rollback story.                                          | New Wave 6 (release hygiene).                            |
| wf425-11   | LOW      | anchor_accuracy        | `00-handoff.md` not found in workspace; relevant to Wave 4 scope.                                    | Note added under Verified anchors.                       |

Raw JSON: `/home/vscode/.vscode-server/data/User/workspaceStorage/f73a612d3687a7232ec8e35cbb14cb78/GitHub.copilot-chat/chat-session-resources/a4d3ee2f-cb76-463b-8fa5-c17f6c0b6575/toolu_01SDrFaBrZmc2uRWAZJoRZtU__vscode-1779383199929/content.json`.
