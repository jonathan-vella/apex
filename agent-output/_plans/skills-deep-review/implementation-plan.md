# Skills Deep-Review — Implementation Plan (v2, decisions applied)

> Companion to [findings.md](./findings.md). All Open Questions from v1 are now
> resolved; this is an execute-ready plan. v1 history is preserved in git.

## TL;DR

User decisions applied:

1. **Region centralization** — keep `swedencentral` (EU GDPR baseline). Make
   [.github/copilot-instructions.md](.github/copilot-instructions.md) the canonical
   declaration. [azure-defaults](.github/skills/azure-defaults/SKILL.md) becomes the
   IaC-flavoured mirror that **links back** to copilot-instructions. Every other
   skill (notably `azure-compute`) links to the canonical source.
2. **Retire the tier system entirely** — delete every `SKILL.digest.md` and every
   `SKILL.minimal.md`. The generator, the validator, the dedicated lefthook/CI checks,
   and all "Read SKILL.digest.md" / "Read SKILL.minimal.md" references across agents,
   prompts, subagents, instructions, AGENTS.md, copilot-instructions.md, site docs,
   and `applyTo` globs are all stripped. Only `SKILL.md` remains.
3. **Archived skills stay archived** — `azure-aigateway` and `azure-hosted-copilot-sdk`
   are not restored. Every live reference (skills, agents, prompts, refs, docs,
   changelog mirror in `site/`) is removed.
4. **`azure-rbac` and `azure-storage`** — rewrite to use `az CLI` + the
   `microsoft-learn` MCP server (`mcp_microsoft-lea_microsoft_docs_search`).
   Drop the `azure__*` (double-underscore) tool surface entirely.
5. **Phase 4 PR sizing** — single L PR (no split).
6. **Phase 6 generator + regeneration** — single PR with two commits (generator
   change first, then mass regeneration). NOTE: this phase collapses substantially
   because Phase 2 retires the generator entirely; Phase 6 in v2 becomes "post-tier
   cleanup", not "fix the generator".

## Target end-state

After all phases land, the following invariants hold:

- Every skill is **a single file**: `.github/skills/<name>/SKILL.md`. No `.digest`,
  no `.minimal`. No exceptions.
- The skill generator ([tools/scripts/generate-skill-digests.mjs](tools/scripts/generate-skill-digests.mjs)),
  the digest portion of [tools/scripts/validate-skill-checks.mjs](tools/scripts/validate-skill-checks.mjs),
  and the package.json `generate:digests` script are deleted. `validate:skill-checks`
  keeps only its size check.
- The **canonical** Azure default declarations (region, tags, AVM-first, security
  baseline) live in two coordinated places:
  - [.github/copilot-instructions.md](.github/copilot-instructions.md) — the
    universally-loaded declaration that all Copilot turns see.
  - [.github/skills/azure-defaults/SKILL.md](.github/skills/azure-defaults/SKILL.md) —
    the IaC-flavoured detail (CAF naming, unique suffix, AVM modules, reference
    index). It states "This skill is the IaC mirror; the universal declaration is
    in copilot-instructions.md" and never disagrees.
- No live `SKILL*.md`, agent, prompt, or instruction references `azure-aigateway`,
  `azure-hosted-copilot-sdk`, or any `azure__*` (double-underscore) tool.
- `azure-rbac` and `azure-storage` rely only on `az CLI` and the
  `microsoft-learn` MCP tools registered in [.vscode/mcp.json](.vscode/mcp.json).
- All validators pass: `npm run lint:md`, `npm run validate:agents`,
  `npm run lint:safe-shell`, `npm run validate:agent-registry`,
  `npm run validate:skill-checks`, `npm run validate:all`.

## Phases

Order: **Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 7.**
Phase 6 from v1 is folded into Phase 2 because retiring the tier removes both
"fix the generator" and "regenerate digests" work in one step.

### Phase 1 — Centralize region defaults and fix broken refs

**Goal.** Stop agents from following dead pointers and from defaulting to the
wrong Azure region. Establish [.github/copilot-instructions.md](.github/copilot-instructions.md)
as the canonical region declaration, with `azure-defaults` linking back.

**Inputs.** F-compute-01, F-deploy-01, F-prepare-01, F-docs-01.

**Parallel-with / depends-on.** None. Lands first.

**File-by-file changes:**

- [.github/copilot-instructions.md](.github/copilot-instructions.md) — add a new
  short H2 section near the top, e.g. `## Azure Defaults (canonical)`, containing:
  - Default regions table (`swedencentral` all resources; `westeurope` Static Web
    Apps; `germanywestcentral` failover) — copied verbatim from the current
    [azure-defaults/SKILL.md L21-L27](.github/skills/azure-defaults/SKILL.md#L21-L27).
  - Required tags one-liner (PascalCase: `Environment`, `ManagedBy`, `Project`, `Owner`).
  - One-liner pointing to [azure-defaults/SKILL.md](.github/skills/azure-defaults/SKILL.md)
    for IaC-specific detail (CAF naming, AVM, unique suffix, references).
  - One-liner pointing to
    [.github/instructions/references/iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md)
    and
    [.github/instructions/references/iac-security-baseline.md](.github/instructions/references/iac-security-baseline.md)
    for the security baseline.
- [.github/skills/azure-defaults/SKILL.md](.github/skills/azure-defaults/SKILL.md) —
  replace the standalone Default Regions header with a one-line link: "Default
  regions: see [.github/copilot-instructions.md](../../copilot-instructions.md#azure-defaults-canonical).
  Region values restated below for IaC-output convenience; in conflict, the
  canonical declaration wins." Keep the table for reference. Same treatment for
  the required-tags table.
- [.github/skills/azure-compute/SKILL.md#L29](.github/skills/azure-compute/SKILL.md#L29) —
  replace `Default region is eastus...` with: `Default region follows the
  canonical declaration in [copilot-instructions.md](../../copilot-instructions.md#azure-defaults-canonical);
  prices vary by region.`
- [.github/skills/azure-compute/SKILL.md#L54](.github/skills/azure-compute/SKILL.md#L54) —
  table row rewritten the same way.
- [.github/skills/azure-prepare/SKILL.md#L59-L62](.github/skills/azure-prepare/SKILL.md#L59-L62) —
  delete the two routing rows that reference `azure-hosted-copilot-sdk` and `azure-aigateway`.
- [.github/skills/azure-prepare/SKILL.md#L75](.github/skills/azure-prepare/SKILL.md#L75) —
  drop both archived skill names from the Step 0 narrative; keep `azure-cloud-migrate`.
- [.github/skills/azure-prepare/references/apim.md#L6](.github/skills/azure-prepare/references/apim.md#L6),
  [#L172](.github/skills/azure-prepare/references/apim.md#L172),
  [#L174](.github/skills/azure-prepare/references/apim.md#L174) — replace each
  `azure-aigateway` reference with a pointer to APIM docs only.
- [.github/skills/azure-prepare/references/research.md#L38](.github/skills/azure-prepare/references/research.md#L38) —
  same.
- [.github/skills/azure-deploy/SKILL.md#L24](.github/skills/azure-deploy/SKILL.md#L24) —
  remove the `invoke azure-aigateway` clause; keep the APIM-docs link.
- [.github/skills/docs-writer/references/repo-architecture.md#L93](.github/skills/docs-writer/references/repo-architecture.md#L93) —
  remove the `azure-aigateway` row.
- [docs/CHANGELOG.md](docs/CHANGELOG.md) and
  [site/src/content/docs/project/changelog.md](site/src/content/docs/project/changelog.md) —
  these contain historical entries mentioning the original
  addition/removal of `azure-aigateway`. Per
  [docs-trigger.instructions.md](.github/instructions/docs-trigger.instructions.md),
  historical changelog entries describe what changed at a point in time and are
  retained. **Leave as-is** (CHANGELOG is the only place where these names are
  allowed to appear).

**Verification:**

- `npm run lint:md`
- `npm run validate:agents`
- `npm run validate:agent-registry`
- `grep -rn "azure-aigateway\|azure-hosted-copilot-sdk" .github/ AGENTS.md README.md`
  → expect zero hits outside `docs/CHANGELOG.md` and `site/src/content/docs/project/changelog.md`.
- `grep -rn "\beastus\b" .github/skills/` → expect zero hits.
- Open [.github/copilot-instructions.md](.github/copilot-instructions.md) and the
  three edited skills; confirm every region reference now flows to a single source.

**Rollback.** `git revert` of the phase commit restores all edits. The new
`## Azure Defaults (canonical)` H2 in copilot-instructions is additive; reverting
removes the H2.

**PR size.** S.

### Phase 2 — Retire the SKILL.digest.md and SKILL.minimal.md tier system

**Goal.** Delete every `SKILL.digest.md` and every `SKILL.minimal.md`. Remove the
generator, the digest validator, and every "Read SKILL.digest.md" /
"Read SKILL.minimal.md" line across agents, prompts, instructions, AGENTS.md,
copilot-instructions.md, and the docs site.

**Inputs.** F-gen-01 plus every finding marked "rolls into F-gen-01" (F-adr-02,
F-bicep-02, F-deploy-02, F-prepare-03, F-rbac-02, F-resources-01, F-drawio-02,
F-ctx-01, digest portion of F-wf-01).

**Parallel-with / depends-on.** Must land after Phase 1. Phases 3 and 4 must
follow Phase 2 (every skill file is touched here).

**File-by-file changes:**

1. **Delete the tier files.** Run from repo root:

   ```bash
   git rm .github/skills/*/SKILL.digest.md .github/skills/*/SKILL.minimal.md
   ```

   This removes both tiers from every live skill in one git operation.

2. **Delete the generator and digest-validator paths:**

   - Delete [tools/scripts/generate-skill-digests.mjs](tools/scripts/generate-skill-digests.mjs).
   - [tools/scripts/validate-skill-checks.mjs](tools/scripts/validate-skill-checks.mjs) —
     strip the entire "Check 2: Digest quality" block
     ([L66-L120](tools/scripts/validate-skill-checks.mjs#L66-L120)). Keep
     "Check 1: Skill size" only. Update the script header comment at
     [L7](tools/scripts/validate-skill-checks.mjs#L7) so it no longer mentions digests.
   - [tools/scripts/safe-shell.mjs#L38](tools/scripts/safe-shell.mjs#L38) — change
     the `SKILL_FILE_NAMES` set from `["SKILL.md", "SKILL.digest.md", "SKILL.minimal.md"]`
     to `["SKILL.md"]`.
   - [tools/tests/orphan-skill-discovery.test.mjs](tools/tests/orphan-skill-discovery.test.mjs) —
     remove the two `it("finds SKILL.digest.md references", ...)` and
     `it("finds SKILL.minimal.md references", ...)` tests
     ([L36-L48](tools/tests/orphan-skill-discovery.test.mjs#L36-L48)). Update
     fixture content at [L58-L59](tools/tests/orphan-skill-discovery.test.mjs#L58-L59)
     so neither digest nor minimal appears.

3. **Update [package.json](package.json) scripts:**

   - Delete `"generate:digests"` ([L73](package.json#L73)).
   - Keep `"validate:skill-checks"` ([L70](package.json#L70)) — its body still
     works after the validator edit above.
   - No change needed to the `validate:_node` and `validate:_node-ci` aggregates
     ([L94](package.json#L94), [L95](package.json#L95)) — `validate:skill-checks`
     stays in both pipelines.

4. **Update [lefthook.yml](lefthook.yml):** no hook references `digest` directly
   (verified by grep). Glob patterns at L44, L60, L134, L136 are already scoped
   to `SKILL.md`. No edits.

5. **Update the instruction documents:**

   - [.github/instructions/agent-skills.instructions.md](.github/instructions/agent-skills.instructions.md):
     rewrite the "Wiring a Skill to an Agent" section
     ([L115-L135](.github/instructions/agent-skills.instructions.md#L115-L135)) —
     remove the tier table, the `SKILL.digest.md` / `SKILL.minimal.md` guidance,
     and the "fenced shell code blocks" pattern. Canonical wiring is now
     `.github/skills/{name}/SKILL.md` only.
   - [.github/instructions/context-optimization.instructions.md](.github/instructions/context-optimization.instructions.md):
     rewrite Runtime Compression ([L155-L170](.github/instructions/context-optimization.instructions.md#L155-L170))
     and Skill Loading ([L172-L175](.github/instructions/context-optimization.instructions.md#L172-L175))
     sections. Replace tier-based loading with: "Load `SKILL.md` on demand; read
     only the H2 sections needed; load `references/*.md` only when the SKILL.md
     body explicitly points to one."
   - [.github/instructions/no-interactive-shell.instructions.md#L3](.github/instructions/no-interactive-shell.instructions.md#L3) —
     strip `**/.github/skills/**/SKILL.digest.md` and
     `**/.github/skills/**/SKILL.minimal.md` from the `applyTo` glob.
   - [.github/skills/context-management/SKILL.md](.github/skills/context-management/SKILL.md) —
     remove the tier-selection table and the third-tier escalation. Mode A
     (Runtime Compression) now applies only to **artifacts** in `agent-output/`,
     not to skills. Mode B (Audit) stays intact.

6. **Update AGENTS.md and copilot-instructions.md:**

   - [AGENTS.md#L48](AGENTS.md#L48) and [#L106](AGENTS.md#L106) — replace the two
     `azure-defaults/SKILL.digest.md` references with `azure-defaults/SKILL.md`.
   - [.github/copilot-instructions.md#L65-L74](.github/copilot-instructions.md#L65-L74) —
     in the Skills paragraph, drop the entire "Default tier is `SKILL.digest.md`;
     `SKILL.minimal.md` is the >80%-utilization escalation" sentence. Replace
     with a one-liner: "Agents read `SKILL.md` files on demand."

7. **Update every agent and subagent that reads tier variants** — mechanical
   replacement (`SKILL.digest.md` → `SKILL.md`; tier-switch blocks deleted):

   - [.github/agents/01-orchestrator.agent.md](.github/agents/01-orchestrator.agent.md) — L182, L260-L263
   - [.github/agents/01-orchestrator-fastpath.agent.md](.github/agents/01-orchestrator-fastpath.agent.md) — L80
   - [.github/agents/02-requirements.agent.md](.github/agents/02-requirements.agent.md) — L59, L239, L241
   - [.github/agents/03-architect.agent.md](.github/agents/03-architect.agent.md) — L60, L114-L120, L192
   - [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md) — L50-L52, L105-L109, L206
   - [.github/agents/06b-bicep-codegen.agent.md](.github/agents/06b-bicep-codegen.agent.md) — L144-L145, L163-L168, L346
   - [.github/agents/07t-terraform-deploy.agent.md](.github/agents/07t-terraform-deploy.agent.md) — L145-L146
   - [.github/agents/08-as-built.agent.md](.github/agents/08-as-built.agent.md) — L101-L102, L114-L118, L245
   - [.github/agents/09-diagnose.agent.md](.github/agents/09-diagnose.agent.md) — L144-L145
   - [.github/agents/11-context-optimizer.agent.md](.github/agents/11-context-optimizer.agent.md) — L49-L51
   - [.github/agents/e2e-orchestrator.agent.md](.github/agents/e2e-orchestrator.agent.md) — L276-L277
   - [.github/agents/_subagents/bicep-validate-subagent.agent.md](.github/agents/_subagents/bicep-validate-subagent.agent.md) — L46-L51
   - [.github/agents/_subagents/terraform-validate-subagent.agent.md](.github/agents/_subagents/terraform-validate-subagent.agent.md) — L46-L51
   - [.github/agents/_subagents/challenger-review-subagent.agent.md](.github/agents/_subagents/challenger-review-subagent.agent.md) — L110-L111, L264
   - [.github/agents/_subagents/cost-estimate-subagent.agent.md](.github/agents/_subagents/cost-estimate-subagent.agent.md) — L89, L133

   Use `multi_replace_string_in_file` per file to bundle edits.

8. **Update prompts** — same mechanical replacement:

   - [.github/prompts/01-orchestrator.prompt.md](.github/prompts/01-orchestrator.prompt.md) — L28
   - [.github/prompts/02-requirements.prompt.md](.github/prompts/02-requirements.prompt.md) — L19
   - [.github/prompts/04g-governance.prompt.md](.github/prompts/04g-governance.prompt.md) — L34, L36
   - [.github/prompts/utility_prompts/merge-sensei-free-pr.prompt.md](.github/prompts/utility_prompts/merge-sensei-free-pr.prompt.md) — L282
   - [.github/prompts/utility_prompts/plan-agents-handoffs.prompt.md](.github/prompts/utility_prompts/plan-agents-handoffs.prompt.md) — L266
   - [.github/prompts/utility_prompts/plan-verifyAgentHandOffsInLineWithWorkflow.prompt.md](.github/prompts/utility_prompts/plan-verifyAgentHandOffsInLineWithWorkflow.prompt.md) — L385
   - [.github/prompts/utility_prompts/project-wide-review.prompt.md](.github/prompts/utility_prompts/project-wide-review.prompt.md) — L264

9. **Update the docs site sources:**

   - [site/src/content/docs/project/sensei-branch.md#L124](site/src/content/docs/project/sensei-branch.md#L124) —
     rewrite the `SKILL.digest.md` link to `SKILL.md`.
   - [site/src/content/docs/concepts/how-it-works/skills-and-instructions.md#L196](site/src/content/docs/concepts/how-it-works/skills-and-instructions.md#L196) —
     same.
   - [site/src/content/docs/concepts/how-it-works/workflow-engine.md#L197](site/src/content/docs/concepts/how-it-works/workflow-engine.md#L197) —
     remove the "Pre-built skill variants" bullet entirely.
   - [site/public/architecture-explorer-graph.json](site/public/architecture-explorer-graph.json#L1218) —
     this JSON mirrors instruction-file globs. After the `applyTo` edit lands,
     either regenerate via the site build step or hand-edit to strip the two
     `SKILL.digest.md` / `SKILL.minimal.md` glob entries.
   - [site/dist/](site/dist/) — rebuild via `cd site && npm run build`. Do not
     hand-edit.

10. **Add changelog entries:**

    - [docs/CHANGELOG.md](docs/CHANGELOG.md): "**Removed** — `SKILL.digest.md`
      and `SKILL.minimal.md` tier system. Each skill is now a single `SKILL.md`
      file; references are loaded on demand from `references/`."
    - [site/src/content/docs/project/changelog.md](site/src/content/docs/project/changelog.md):
      mirror.

11. **`findings.md` in this folder.** Leave intact — it captures the audit at the
    planning pass. This plan supersedes its remediation recommendations.

**Verification:**

- `npm run lint:md`
- `npm run validate:agents`
- `npm run validate:skill-checks` (after the digest-block deletion)
- `npm run lint:safe-shell`
- `npm run validate:agent-registry`
- `npm run validate:all`
- `find .github/skills -name "SKILL.digest.md" -o -name "SKILL.minimal.md"` → zero results.
- `grep -rn "SKILL\.digest\|SKILL\.minimal" .github/ AGENTS.md README.md package.json lefthook.yml tools/` →
  expect zero hits outside `docs/CHANGELOG.md`, the site's changelog mirror, and
  the orphan-skill-discovery test (which now tests the negative case).
- `cd site && npm run build` succeeds; `node site/check-links.mjs` reports zero broken links.

**Rollback.** `git revert` of the phase commit restores every deleted file plus
all source edits. Because the deletion is tracked in git, no external state is lost.

**PR size.** L. Two atomic commits recommended:

- Commit (a): delete tier files + delete generator + edit `validate-skill-checks.mjs`,
  `safe-shell.mjs`, orphan-skill-discovery test, and `package.json`.
- Commit (b): edit every "Read SKILL.digest.md" reference across agents, prompts,
  instructions, AGENTS.md, copilot-instructions.md, and the docs site.

Validators must pass after each commit; CI gate enforces this.

### Phase 3 — Rewrite `azure-rbac` and `azure-storage` on `az CLI` + `microsoft_docs_search`

**Goal.** Replace the `azure__*` (double-underscore) tool surface with `az CLI`
plus the `microsoft-learn` MCP (which IS registered in
[.vscode/mcp.json#L31-L34](.vscode/mcp.json#L31-L34)).

**Inputs.** F-rbac-01, F-storage-01, F-storage-02.

**Parallel-with / depends-on.** Independent of Phase 4. Must land after Phase 2
to avoid touching the same files.

**File-by-file changes:**

- [.github/skills/azure-rbac/SKILL.md](.github/skills/azure-rbac/SKILL.md) — rewrite
  the body so:
  1. Rules use `microsoft_docs_search` (via the `microsoft-learn` MCP) to look up
     built-in role definitions and `Microsoft.Authorization/roleAssignments`
     reference docs.
  2. CLI generation uses `az role definition list`, `az role assignment create`,
     and `az role definition create --role-definition` for custom roles.
  3. Bicep snippet generation is hand-authored from the canonical AVM pattern.
  4. Frontmatter `INVOKES:` becomes `INVOKES: microsoft-learn MCP, az CLI`.
  5. "Prerequisites for Granting Roles" stays unchanged.

  Reference template for the new flow:

  ```text
  1. Use mcp_microsoft-lea_microsoft_docs_search with query
     "Azure built-in role <operation>" to find candidate roles.
  2. Verify with `az role definition list --query "[?roleName=='<RoleName>']"`.
  3. Generate `az role assignment create --assignee <id> --role "<name>"
     --scope <scope>`.
  4. Emit a Bicep snippet using the canonical pattern (see
     azure-bicep-patterns/references/identity-pattern.md if the file exists,
     otherwise inline a `Microsoft.Authorization/roleAssignments` snippet with
     `guid()`-derived name and `principalType: 'ServicePrincipal'`).
  ```

- [.github/skills/azure-storage/SKILL.md#L13-L34](.github/skills/azure-storage/SKILL.md#L13-L34) —
  delete the "MCP Server (Preferred)" section. Keep "CLI Fallback" and rename to
  "CLI commands". Replace the `azure__storage` entries in the Services table
  ([L16](.github/skills/azure-storage/SKILL.md#L16)) with `az storage blob` /
  `az storage file` / `az storage queue` / `az storage table` / `az storage fs`.
- [.github/skills/azure-storage/SKILL.md#L24](.github/skills/azure-storage/SKILL.md#L24) —
  remove the `/azure:setup` and `/mcp` slash-command instruction.
- [.github/skills/azure-storage/SKILL.md#L94](.github/skills/azure-storage/SKILL.md#L94) —
  replace the inline security-baseline restatement with a one-liner: "Apply the
  security baseline (HTTPS-only, TLS 1.2, public blob disabled, Managed Identity):
  see [iac-security-baseline.md](../../instructions/references/iac-security-baseline.md)."
- Both skills: add `INVOKES: microsoft-learn MCP, az CLI` to frontmatter.

**Verification:**

- `npm run lint:md`
- `npm run validate:agents` (frontmatter-shape rules cover `INVOKES:`).
- `grep -rn "azure__" .github/skills/` → expect zero hits.
- `grep -rn "/azure:setup\|/mcp\b" .github/skills/` → expect zero hits (or only
  in contexts referring to `.vscode/mcp.json` literally).
- Manual smoke test of the rewritten `azure-rbac` flow on a sandbox subscription
  (informal; not CI-enforced).

**Rollback.** `git revert`. No external state changes.

**PR size.** M.

### Phase 4 — Consolidate canonical sources (DRY)

**Goal.** Each canonical fact lives in exactly one place. The fact's other mentions
become one-line links. Single L PR per user decision.

**Inputs.** F-bicep-01, F-tf-01, F-defaults-01, F-defaults-02, F-storage-02
(overlaps Phase 3), F-entra-01, F-tfsi-01, F-tft-01, F-iac-01, F-vp-01, F-gp-01,
plus the duplication matrix in [findings.md](./findings.md#cross-skill-duplication-matrix).

**Parallel-with / depends-on.** Must land after Phase 2 and after Phase 3.

**File-by-file changes** (grouped by canonical source):

- **Canonical: [.github/copilot-instructions.md](.github/copilot-instructions.md)
  (Phase 1's new `## Azure Defaults (canonical)` section)** — already authoritative
  for regions + required tags after Phase 1.

- **Canonical: [azure-defaults/SKILL.md](.github/skills/azure-defaults/SKILL.md).**
  - Keep CAF naming, unique suffix, AVM modules, reference index here.
  - Trim Security Baseline (L52-L65) to a one-line summary + link to
    [iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md)
    AND [iac-security-baseline.md](.github/instructions/references/iac-security-baseline.md).
  - Inline-link the Deprecated Services paragraph (L82-L85) to
    `references/deprecated-services.md`.

- **Mirror skills (`azure-bicep-patterns`, `terraform-patterns`).**
  - Replace each duplicated rule line (security baseline, AVM-first, naming,
    tags, unique suffix) with a one-liner: "Security baseline + AVM mandate:
    see [azure-defaults](../azure-defaults/SKILL.md)."
  - Keep tool-specific code examples in `references/`.
  - Both skills keep architectural rules they OWN (module-interface contract,
    conditional deployment style, Terraform plan-interpretation tips).

- **`azure-storage`** — already handled in Phase 3.

- **`terraform-search-import`, `terraform-test`** — replace inline naming/tag
  tables with links to `azure-defaults`.

- **`iac-common`** — trim `deploy.ps1` mentions from 4 to 1 + one reference link.

- **`entra-app-registration`** — link the HTTPS-only redirect URI rule to the
  canonical security baseline.

- **`vendor-prompting`** — restructure SKILL.md so rule details point at
  [rules.json](.github/skills/vendor-prompting/rules.json) as the only enumerated
  source. Body lists rule GROUPS only.

- **`golden-principles`** — reconcile SKILL.md against `references/principles.md`.
  Make `references/principles.md` canonical detail, SKILL.md the 10-line summary
  that ALWAYS matches. Remove the "when they disagree" clause at
  [SKILL.md#L36](.github/skills/golden-principles/SKILL.md#L36).

**Verification:**

- `npm run lint:md`
- `npm run validate:iac-security-baseline` on IaC examples — link-only baseline
  must still pass downstream checks.
- `grep -c "TLS 1.2\|TLS1_2" .github/skills/**/SKILL.md` → expect canonical files
  to dominate, not the pattern skills.
- Read [azure-bicep-patterns/SKILL.md](.github/skills/azure-bicep-patterns/SKILL.md)
  and [terraform-patterns/SKILL.md](.github/skills/terraform-patterns/SKILL.md):
  each should read as "tool-specific recipe", not "policy declaration".

**Rollback.** `git revert`. Phase 6 from v1 is gone; no regeneration loop to worry about.

**PR size.** L (single PR per user decision).

### Phase 5 — Add missing `INVOKES:` and fix stale MCP tool names

**Goal.** Close the discoverability gap surfaced in
[findings.md § Discoverability table](./findings.md#discoverability-table).

**Inputs.** Discoverability table; F-compliance-01.

**Parallel-with / depends-on.** Independent. Can run in parallel with Phase 4 if
PR conflicts are managed.

**File-by-file changes:**

- For each row in the discoverability table marked "Missing `INVOKES:`", append
  `INVOKES: <list>` to the frontmatter `description`:
  - `azure-compliance`: `INVOKES: azqr extension, az keyvault, az storage`.
  - `azure-cost-optimization`: `INVOKES: az resource graph, az consumption`.
  - `azure-deploy`: `INVOKES: azd CLI, az deployment, mcp_microsoft-lea_microsoft_docs_search`.
  - `azure-diagnostics`: `INVOKES: az monitor, az containerapp logs, az functionapp log, az resource graph`.
  - `azure-rbac`: `INVOKES: microsoft-learn MCP, az CLI` (also done in Phase 3; reconcile in this PR).
  - `azure-resources`: `INVOKES: az resource graph, az resource, mcp_microsoft-lea_microsoft_docs_search`.
  - `azure-storage`: `INVOKES: az CLI, microsoft-learn MCP` (also done in Phase 3).
  - `github-operations`: `INVOKES: gh CLI (primary), GitHub MCP (fallback)`.
  - `terraform-search-import`: `INVOKES: terraform MCP (registry toolset), terraform CLI`.
- For stale-looking tool names (e.g., `keyvault_*` in `azure-compliance`),
  cross-check against [.vscode/mcp.json](.vscode/mcp.json) and `tools/mcp-servers/`.
  Rename to the actual surface or replace with `az keyvault` CLI.

**Verification:**

- `npm run validate:agents`
- `npm run lint:md`

**Rollback.** `git revert`. Trivial.

**PR size.** S.

### Phase 7 — Per-skill polish

**Goal.** Apply every remaining `medium` and `low` finding that is an independent
one-line edit. Land last to mop up minor fallout.

**Inputs.** F-artifacts-01, F-artifacts-02, F-migrate-01, F-compliance-02, F-cost-01,
F-diag-01, F-gov-01, F-prepare-02 (emoji decoration), F-quotas-01, F-validate-01,
F-drawio-01, F-gh-01, F-mermaid-01, F-mslearn-01, F-pyd-01, F-tft-01, F-wf-01
(count-hardcoding), F-wf-02.

**Parallel-with / depends-on.** Independent of every other phase.

**File-by-file changes.** Each finding's "Fix" line in
[findings.md § Per-skill findings](./findings.md#per-skill-findings) is an
actionable single-edit recipe. Bundle into one `multi_replace_string_in_file`
call per skill per
[context-optimization.instructions.md](.github/instructions/context-optimization.instructions.md#L100-L120).

**Verification.** All validators in the matrix below.

**Rollback.** Each edit is independent.

**PR size.** M (can split by skill grouping if reviewer prefers).

## Cross-cutting changes (consolidated)

Checklist while drafting any phase's PR:

- [.github/copilot-instructions.md](.github/copilot-instructions.md):
  - Phase 1: add `## Azure Defaults (canonical)` section.
  - Phase 2: drop the `SKILL.digest.md` / `SKILL.minimal.md` mention in the
    Skills paragraph (L65-L74).
- [AGENTS.md](AGENTS.md):
  - Phase 2: replace two `SKILL.digest.md` references at L48 and L106 with `SKILL.md`.
- [.github/instructions/agent-skills.instructions.md](.github/instructions/agent-skills.instructions.md):
  - Phase 2: rewrite "Wiring a Skill to an Agent" — no tiers.
- [.github/instructions/context-optimization.instructions.md](.github/instructions/context-optimization.instructions.md):
  - Phase 2: rewrite Runtime Compression + Skill Loading sections.
- [.github/instructions/no-interactive-shell.instructions.md](.github/instructions/no-interactive-shell.instructions.md#L3):
  - Phase 2: strip `SKILL.digest.md` / `SKILL.minimal.md` from `applyTo`.
- [.github/skills/context-management/SKILL.md](.github/skills/context-management/SKILL.md):
  - Phase 2: remove tier-selection table; restrict Mode A to artifacts only.
- [docs/CHANGELOG.md](docs/CHANGELOG.md) and
  [site/src/content/docs/project/changelog.md](site/src/content/docs/project/changelog.md):
  - One entry per phase per
    [docs-trigger.instructions.md](.github/instructions/docs-trigger.instructions.md).
- [site/](site/): Phase 2 edits three markdown files plus the
  architecture-explorer-graph JSON; rebuild dist after edits.
- [tools/registry/count-manifest.json](tools/registry/count-manifest.json): no
  edits — counts compute from filesystem globs.

## Validation matrix

| Phase | `lint:md` | `validate:agents` | `validate:skill-checks` | `lint:safe-shell` | `validate:agent-registry` | `validate:iac-security-baseline` | Notes                                                  |
| ----- | :-------: | :---------------: | :---------------------: | :---------------: | :-----------------------: | :------------------------------: | ------------------------------------------------------ |
| 1     | ✅        | ✅                | ✅ (pre-edit form)      | ✅                | ✅                        | ✅                               | Region + broken-ref fixes                              |
| 2     | ✅        | ✅                | ✅ (post-edit form)     | ✅                | ✅                        | n/a                              | Tier retirement; digest checks removed from validator  |
| 3     | ✅        | ✅                | ✅                      | ✅                | ✅                        | ✅                               | Rewrites; verify `INVOKES:` shape after frontmatter edit |
| 4     | ✅        | ✅                | ✅                      | ✅                | ✅                        | ✅                               | Consolidation; canonical-link checks                   |
| 5     | ✅        | ✅                | ✅                      | n/a               | ✅                        | n/a                              | Description-shape edits                                |
| 7     | ✅        | ✅                | ✅                      | ✅                | ✅                        | ✅                               | Polish                                                 |

`npm run validate:all` must pass at the end of every phase. The site
`check-links.mjs` should also pass at the end of Phase 2.

## Risks & mitigations

- **Agent prompt drift after tier retirement (Phase 2).** Risk: an agent that
  hard-codes `Read .github/skills/X/SKILL.digest.md` loses context if missed.
  Mitigation: the file-by-file checklist in Phase 2 is exhaustive (every grep
  hit enumerated). Run `grep -rn "SKILL\.digest\|SKILL\.minimal" .` immediately
  before commit; any new hit blocks the PR.
- **Region declaration drift between copilot-instructions and azure-defaults
  (Phase 1).** Risk: future edits to `azure-defaults` regions accidentally
  contradict copilot-instructions. Mitigation: optional new validator
  `npm run validate:region-canonical` (see Open Question 1).
- **Discoverability regression after `INVOKES:` rewrites (Phase 5).** Risk:
  trimming the description text changes Copilot's auto-discovery keywords.
  Mitigation: WHEN / USE FOR triggers stay intact; `INVOKES:` is additive.
- **Breaking link refactors (Phase 4).** Risk: prose → link with a wrong
  anchor 404s in the docs site. Mitigation: `npm run lint:md` plus
  `site/check-links.mjs` gate the PR.
- **MCP tool-name corrections (Phase 3).** Risk: renaming a tool already in
  use by an agent breaks the flow. Mitigation: smoke-test the rewritten
  `azure-rbac` flow against a sandbox subscription before merge.
- **Phase 2 PR review surface.** Risk: an L-sized deletion+edit PR is hard to
  review. Mitigation: enforce two atomic commits as in Phase 2's PR-size note —
  reviewer can diff each commit independently.

## Out of scope / deferred

- **`vendor-prompting/rules.json` schema work.** F-vp-01 collapses the three-way
  duplication but does not change the JSON schema. A future pass can split
  `rules.json` into `claude-rules.json` / `gpt-rules.json` / `cross-vendor-rules.json`.
- **Skill test suites.** [tests/](tests/) has per-skill test directories but the
  audit did not inspect test contents. A follow-up audit should compare each
  skill's documented behaviour against its tests.
- **MCP server rebalancing.** Adding a generic `azure` MCP server (which would
  open up `mcp_azure_*` tools) is a separate infra decision. Phase 3 settles on
  `az CLI` + `microsoft-learn` MCP as the canonical surface.
- **Permanent deletion of `.archive/_archived_skills/azure-aigateway/` and
  `.archive/_archived_skills/azure-hosted-copilot-sdk/`.** Per the user
  decision, these stay archived. They are explicitly NOT deleted; the archive
  serves as historical record. Only live references are scrubbed.

## Open questions (residual, lightweight)

The plan can proceed without these; defaults are acceptable.

1. **Region-canonical validator (Phase 1 / 7).** Add
   `npm run validate:region-canonical` to assert that the Default Regions table
   in `azure-defaults/SKILL.md` byte-matches the table in
   `.github/copilot-instructions.md`? (Default: **yes**, add in Phase 7 — a
   30-line script that prevents silent drift.)
2. **`validate-skill-checks.mjs` naming (Phase 2).** After the digest-block
   deletion the file checks only skill size. Rename to `validate-skill-size.mjs`
   for clarity? (Default: **no**, keep the broader name; the file can grow back
   to multi-check semantics later.)
3. **Site changelog entry placement (Phase 2).** Append to the existing
   "Unreleased" section or open a new dated entry? (Default: append to
   **Unreleased**.)
