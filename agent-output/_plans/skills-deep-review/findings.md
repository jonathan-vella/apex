# Skills Deep-Review — Findings

> Read-only audit of every directory under [.github/skills/](.github/skills/) and its
> companion instruction/reference files. Companion: [implementation-plan.md](./implementation-plan.md).
> No skill files were edited during this pass.

## Executive summary

| Severity   | Count    | Themes                                                                                                  |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `critical` | 4        | Stale tool names in active skills, broken skill cross-refs (archived skills), region-default conflict   |
| `high`     | 7        | DRY: security baseline + AVM mandate duplicated; degenerate `SKILL.minimal.md` tier; auto-gen drift     |
| `medium`   | 11       | Sparse digest sections, ambiguous routing, missing canonical-source attribution, MCP tool-name drift    |
| `low`      | 9        | Discoverability polish, link upgrades, gotchas needing one-line context                                 |

**Top 5 themes (in priority order):**

1. **`SKILL.minimal.md` is structurally broken for most skills** — the auto-generator at
   [tools/scripts/generate-skill-digests.mjs](tools/scripts/generate-skill-digests.mjs#L100-L140) emits
   skeleton-only output (heading + one truncated leading line per H2). Many minimal files have entire
   sections rendered as `**Steps**:` with no body. Per `.github/instructions/agent-skills.instructions.md`,
   the minimal tier is the >80%-utilization escalation path — yet today it carries less actionable
   signal than the digest. Either the generator must be reworked or the tier must be retired.
2. **Stale references to archived skills inside active skills** —
   [azure-prepare/SKILL.md](.github/skills/azure-prepare/SKILL.md#L59) and
   [.azure/SKILL.md](.github/skills/azure-deploy/SKILL.md#L24) route to `azure-aigateway` and
   `azure-hosted-copilot-sdk`, which live only in [.archive/_archived_skills/](.archive/_archived_skills/).
   Agents following the routing table reach a dead end.
3. **Region-default contradiction between `azure-compute` and `azure-defaults`** —
   [azure-compute/SKILL.md#L29](.github/skills/azure-compute/SKILL.md#L29) and
   [#L54](.github/skills/azure-compute/SKILL.md#L54) hard-code `eastus` while
   [azure-defaults/SKILL.md#L25](.github/skills/azure-defaults/SKILL.md#L25) mandates `swedencentral`
   (EU GDPR baseline). Replicated to [azure-compute/SKILL.digest.md#L44](.github/skills/azure-compute/SKILL.digest.md#L44).
4. **`azure__*` double-underscore tool names in `azure-rbac` and `azure-storage`** — not registered
   in [.vscode/mcp.json](.vscode/mcp.json) and not following the `mcp_<server>_<tool>` convention used
   by every other skill. These look like a stale snapshot of an older Azure tool registry and need
   to be either renamed to the current MCP/extension contract or removed.
5. **Security baseline + AVM mandate duplicated across at least four skills** —
   [azure-defaults](.github/skills/azure-defaults/SKILL.md#L52-L60),
   [azure-bicep-patterns](.github/skills/azure-bicep-patterns/SKILL.md),
   [terraform-patterns](.github/skills/terraform-patterns/SKILL.md), and
   [azure-storage](.github/skills/azure-storage/SKILL.md#L94) all restate "HTTPS-only, TLS 1.2, no
   public blob, Managed Identity". When governance changes, drift is silent. Canonical source must
   be [.github/instructions/references/iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md)
   and [azure-defaults](.github/skills/azure-defaults/SKILL.md), with all other skills linking back.

**Estimated token-impact roll-up** (S<200 / M 200-1000 / L >1000 tokens saved per fix theme):

| Theme                                                            | Tag | Net savings (rough)                                |
| ---------------------------------------------------------------- | --- | -------------------------------------------------- |
| Retire degenerate `SKILL.minimal.md` (or fix generator)          | L   | ~1500-2500 tokens across skills that load minimal  |
| Consolidate security-baseline + AVM restatements                 | M   | ~600-900 tokens across pattern skills              |
| Trim `SKILL.digest.md` truncation noise + cargo-cult section stubs | M | ~400-800 tokens across most digests                |
| Fix region/tool-name contradictions (single-line edits)          | S   | <300 tokens but unblocks compliance-correct output |
| Update broken cross-refs to archived skills                      | S   | <200 tokens                                        |

---

## Cross-skill duplication matrix

| Topic                                              | Skills that duplicate it                                                                                                                                                                                                                                                                                                                                                                                            | Canonical source recommended                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default region                                     | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L25-L26) (correct: `swedencentral`); [azure-compute](.github/skills/azure-compute/SKILL.md#L29) and [its digest](.github/skills/azure-compute/SKILL.digest.md#L44) (wrong: `eastus`)                                                                                                                                                                          | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L21-L28). Others must link, not restate.                                                            |
| Required tags + casing                             | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L29-L45) (canonical); restated in [terraform-search-import](.github/skills/terraform-search-import/SKILL.md), [terraform-test](.github/skills/terraform-test/SKILL.md), and implicitly in [azure-governance-discovery](.github/skills/azure-governance-discovery/SKILL.md)                                                                                  | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L29-L45)                                                                                            |
| AVM-first mandate                                  | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L100-L105, L113), [azure-bicep-patterns](.github/skills/azure-bicep-patterns/SKILL.md), [terraform-patterns](.github/skills/terraform-patterns/SKILL.md), [golden-principles](.github/skills/golden-principles/SKILL.md), [iac-common](.github/skills/iac-common/SKILL.md)                                                                                  | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L100-L105) + [iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md)   |
| Security baseline (TLS 1.2 / HTTPS / public blob / MI) | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L52-L60, L118), [azure-storage](.github/skills/azure-storage/SKILL.md#L94), [entra-app-registration](.github/skills/entra-app-registration/SKILL.md#L127) (subset: HTTPS-only redirect URIs), restated as a rule line in [azure-bicep-patterns](.github/skills/azure-bicep-patterns/SKILL.md), [terraform-patterns](.github/skills/terraform-patterns/SKILL.md) | [.github/instructions/references/iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md) (and [iac-security-baseline.md](.github/instructions/references/iac-security-baseline.md)) |
| CAF naming + abbreviations                         | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L77-L96); restated partially in [terraform-search-import](.github/skills/terraform-search-import/SKILL.md), [terraform-test](.github/skills/terraform-test/SKILL.md)                                                                                                                                                                                       | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L77-L96) + `references/naming-full-examples.md`                                                     |
| Unique-suffix pattern                              | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L47-L50); restated in [azure-bicep-patterns](.github/skills/azure-bicep-patterns/SKILL.md) and `terraform-patterns/references/`                                                                                                                                                                                                                            | [azure-defaults](.github/skills/azure-defaults/SKILL.md#L47-L50)                                                                                            |
| Hub-spoke pattern                                  | [azure-bicep-patterns](.github/skills/azure-bicep-patterns/SKILL.digest.md#L9-L12) (Bicep flavour), [terraform-patterns](.github/skills/terraform-patterns/SKILL.digest.md#L9-L15) (Terraform flavour). Both names + the rule "spokes peer to hub only; NSGs per subnet" repeat                                                                                                                                    | Keep tool-specific patterns split, but extract the **architecture-agnostic** rule (the one-liner) into [azure-defaults](.github/skills/azure-defaults/SKILL.md) and link from both patterns skills. |
| Private endpoint pattern                           | Same dual-skill duplication as hub-spoke                                                                                                                                                                                                                                                                                                                                                                          | Same approach — extract architectural rule, keep per-tool code in `references/`.                                                                            |
| Diagnostic-settings mandate ("every resource → Log Analytics") | [azure-bicep-patterns](.github/skills/azure-bicep-patterns/SKILL.digest.md#L13-L15), [terraform-patterns](.github/skills/terraform-patterns/SKILL.digest.md#L16, L20), and implied in [iac-common](.github/skills/iac-common/SKILL.md)                                                                                                                                                                              | [azure-defaults](.github/skills/azure-defaults/SKILL.md) (rule), `references/` per tool (code)                                                              |
| Deployment commands (`azd up`, `azd provision`, `terraform apply`) | [azure-deploy](.github/skills/azure-deploy/SKILL.md), [azure-prepare](.github/skills/azure-prepare/SKILL.md), [iac-common](.github/skills/iac-common/SKILL.md), [terraform-search-import](.github/skills/terraform-search-import/SKILL.md)                                                                                                                                                                          | [azure-deploy](.github/skills/azure-deploy/SKILL.md) is the execution canonical; [iac-common](.github/skills/iac-common/SKILL.md) holds shared strategy patterns. Other skills must link. |
| `deploy.ps1` deprecation note                      | [iac-common](.github/skills/iac-common/SKILL.md#L19, L42-L47, L60), restated in [iac-common digest](.github/skills/iac-common/SKILL.digest.md#L10, L29, L38), referenced from [azure-deploy](.github/skills/azure-deploy/SKILL.md#L68)                                                                                                                                                                              | [iac-common](.github/skills/iac-common/SKILL.md) (one mention + reference to `azd-vs-deploy-guide.md`)                                                      |
| Plan-first / approval-gate workflow                | [azure-prepare](.github/skills/azure-prepare/SKILL.md#L40-L57), [azure-validate](.github/skills/azure-validate/SKILL.md#L1-L16), [azure-deploy](.github/skills/azure-deploy/SKILL.md#L1-L20), [iac-common](.github/skills/iac-common/SKILL.md)                                                                                                                                                                       | [azure-prepare](.github/skills/azure-prepare/SKILL.md#L40-L57) (origin) + [workflow-engine](.github/skills/workflow-engine/SKILL.md) (DAG-level)             |
| Diagram-tool routing (drawio / mermaid / python-diagrams) | All three diagram skills' frontmatter (good: symmetric `DO NOT USE FOR`), plus restated implicitly in [.github/instructions/markdown.instructions.md](.github/instructions/markdown.instructions.md#L29-L38)                                                                                                                                                                                                       | The instruction file already holds it. Skills should link, not restate.                                                                                     |

---

## Cross-skill contradictions

| Topic                                                | Skill A claim                                                                                                                            | Skill B claim                                                                                                                                  | Recommended resolution                                                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default region for new Azure resources**           | [azure-compute/SKILL.md#L29](.github/skills/azure-compute/SKILL.md#L29) — `eastus`                                                       | [azure-defaults/SKILL.md#L25](.github/skills/azure-defaults/SKILL.md#L25) — `swedencentral` (EU GDPR baseline)                                 | **Critical.** `azure-defaults` wins. Update `azure-compute` L29 and L54 (plus its digest L44) to either link to `azure-defaults` or state "uses the region from `azure-defaults`". |
| **Where the security baseline lives**                | Each pattern skill restates it inline as a rule line.                                                                                    | [`iac-policy-compliance.md`](.github/instructions/references/iac-policy-compliance.md) and [azure-defaults](.github/skills/azure-defaults/SKILL.md#L52-L60) are documented as canonical in [AGENTS.md](AGENTS.md). | Skill rule lines should be a single line linking to the canonical doc. Keep tool-specific code in `references/`.                                                                   |
| **`SKILL.minimal.md` purpose**                       | [agent-skills.instructions.md](.github/instructions/agent-skills.instructions.md) — `SKILL.minimal.md` is the >80%-utilization escalation tier with actionable rules. | Reality: most generated `SKILL.minimal.md` files (e.g., [azure-deploy](.github/skills/azure-deploy/SKILL.minimal.md), [azure-prepare](.github/skills/azure-prepare/SKILL.minimal.md), [azure-rbac](.github/skills/azure-rbac/SKILL.minimal.md)) contain section labels with no body. | Either regenerate with a content-aware extractor or retire the tier and have agents fall back to `SKILL.digest.md` at high utilization.                                            |
| **`azd vs deploy.ps1` status**                       | [iac-common/SKILL.md#L19](.github/skills/iac-common/SKILL.md#L19) — "`deploy.ps1` is deprecated"                                          | Older [`azure-deploy/SKILL.md` reference list](.github/skills/azure-deploy/SKILL.md#L68) still links to `azd-vs-deploy-guide.md` as if both are first-class. | Already mostly consistent; tighten azure-deploy to say "legacy fallback only" alongside the link.                                                                                  |
| **`azure-aigateway` / `azure-hosted-copilot-sdk` existence** | [azure-prepare/SKILL.md#L59-L62](.github/skills/azure-prepare/SKILL.md#L59-L62), [azure-deploy/SKILL.md#L24](.github/skills/azure-deploy/SKILL.md#L24), [azure-prepare/references/apim.md](.github/skills/azure-prepare/references/apim.md) — treat both as live skills | Filesystem: both live in [.archive/_archived_skills/](.archive/_archived_skills/) only.                                                                                                  | Remove or replace routing rows; if APIM-AI-gateway is still a desired path, undo the archive (separate decision).                                                                  |
| **MCP tool naming convention**                       | [azure-rbac/SKILL.md#L10-L28](.github/skills/azure-rbac/SKILL.md#L10) and [azure-storage/SKILL.md#L16-L30](.github/skills/azure-storage/SKILL.md#L16-L30) — use `azure__<tool>` (double underscore) | Every other MCP-aware skill ([azure-kusto](.github/skills/azure-kusto/SKILL.md), [microsoft-docs](.github/skills/microsoft-docs/SKILL.md), [drawio](.github/skills/drawio/SKILL.md)) uses single-underscore tool aliases that map to entries in [.vscode/mcp.json](.vscode/mcp.json). | These two skills predate the current MCP registry. Rename to match the actual tool surface or remove the bare references and link to `microsoft-docs` / `azure-pricing` instead.   |
| **Diagram routing for cost charts**                  | [python-diagrams](.github/skills/python-diagrams/SKILL.md) — owns cost/WAF/compliance charts                                              | [drawio](.github/skills/drawio/SKILL.md) — `DO NOT USE FOR: WAF/cost charts (use python-diagrams)`. [mermaid](.github/skills/mermaid/SKILL.md) — same. | **Consistent.** No action.                                                                                                                                                          |
| **Where the workflow DAG lives**                     | [AGENTS.md#L80](AGENTS.md) names [workflow-graph.json](.github/skills/workflow-engine/templates/workflow-graph.json) as source-of-truth.   | [workflow-engine/SKILL.md](.github/skills/workflow-engine/SKILL.md) and [.github/copilot-instructions.md](.github/copilot-instructions.md) agree. | **Consistent.** No action.                                                                                                                                                          |

---

## Per-skill findings

Each finding: `id` · severity · location (line link) · problem · evidence · fix · token-impact
(S<200 / M 200-1000 / L >1000 tokens) · depends-on.

### azure-adr

- **F-adr-01** · `low` · [azure-adr/SKILL.md#L3](.github/skills/azure-adr/SKILL.md#L3). Description says
  `DO NOT USE FOR: ... cost estimates (use cost-estimate-subagent)`. The subagent exists at
  [.github/agents/_subagents/cost-estimate-subagent.agent.md](.github/agents/_subagents/cost-estimate-subagent.agent.md),
  so this is correct (not a broken ref). No action.
- **F-adr-02** · `low` · [azure-adr/SKILL.minimal.md](.github/skills/azure-adr/SKILL.minimal.md). The minimal
  tier is auto-generated boilerplate (`**Output Format**:`, `**Integration with Workflow**:` with no body).
  Same systemic issue as F-gen-01. Token-impact: rolls into F-gen-01.

### azure-artifacts

- **F-artifacts-01** · `medium` · [azure-artifacts/SKILL.md#L9](.github/skills/azure-artifacts/SKILL.md).
  Description leads with "Artifact template structures, H2 compliance rules, and documentation styling
  for agent outputs (Steps 1-7)". Mentions step range, but the canonical step list per
  [AGENTS.md](AGENTS.md) goes through Post (Lessons). Either say "every workflow step" or
  link to [workflow-graph.json](.github/skills/workflow-engine/templates/workflow-graph.json) to avoid
  silent drift. Fix: S.
- **F-artifacts-02** · `low` · `references/` directory holds all the per-step templates but the skill body
  does not enumerate which exist. Agents must guess filenames. Add a reference index. Fix: S.

### azure-bicep-patterns

- **F-bicep-01** · `high` · [azure-bicep-patterns/SKILL.md](.github/skills/azure-bicep-patterns/SKILL.md)
  restates AVM-first, hub-spoke, PE, diagnostics rules as bullet/table content that duplicates
  [azure-defaults](.github/skills/azure-defaults/SKILL.md#L100-L105) and
  [iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md). Today the
  pattern skill owns BOTH the rule and the code. Recommended: the rule lives in canonical sources;
  this skill owns ONLY the Bicep code recipe + module-interface contract. Fix: M.
- **F-bicep-02** · `medium` · [azure-bicep-patterns/SKILL.digest.md#L43-L48](.github/skills/azure-bicep-patterns/SKILL.digest.md#L43-L48)
  ends the Gotchas section with `> _See SKILL.md for full content._` mid-bullet ("Watch for unexpected
  deletes, SKU downgrades,…"). Truncation by [generate-skill-digests.mjs#L42-L54](tools/scripts/generate-skill-digests.mjs#L42-L54)
  loses the rest of the rule. Fix: S after F-gen-01 lands.

### azure-cloud-migrate

- **F-migrate-01** · `low` · [azure-cloud-migrate/SKILL.md](.github/skills/azure-cloud-migrate/SKILL.md).
  Description lists AWS Lambda, AWS, GCP migration scenarios — but the body documents only Lambda.
  Either expand or scope the description more narrowly ("Lambda → Functions today; other scenarios
  on request"). Fix: S.

### azure-compliance

- **F-compliance-01** · `medium` · [azure-compliance/SKILL.md](.github/skills/azure-compliance/SKILL.md).
  MCP tool reference uses bare `keyvault_*` names; the rest of the repo uses `mcp_<server>_<tool>` or
  `azure_<scope>`. Verify against [.vscode/mcp.json](.vscode/mcp.json) and align. Fix: S.
- **F-compliance-02** · `low` · Frontmatter `DO NOT USE FOR: cost analysis (use azure-cost-optimization)`
  is fine, but `DO NOT USE FOR` also needs `general diagnostics (use azure-diagnostics)` to prevent
  trigger collisions on "security audit" vs "production troubleshooting". Fix: S.

### azure-compute

- **F-compute-01** · `critical` · [azure-compute/SKILL.md#L29](.github/skills/azure-compute/SKILL.md#L29)
  + [#L54](.github/skills/azure-compute/SKILL.md#L54) + [SKILL.digest.md#L44](.github/skills/azure-compute/SKILL.digest.md#L44).
  States `eastus` is the default region. Contradicts the EU-GDPR baseline in
  [azure-defaults/SKILL.md#L25](.github/skills/azure-defaults/SKILL.md#L25) (`swedencentral`).
  Evidence quote: `- **Default region** is `eastus` when none is specified; note that prices vary by region`.
  Fix: rewrite as `- **Default region** follows [`azure-defaults`](../azure-defaults/SKILL.md#L25);
  prices vary by region.` Token-impact: S. Depends on: nothing.

### azure-cost-optimization

- **F-cost-01** · `low` · The body mentions Redis-specific path but the description repeats the same
  Redis trigger inline. Acceptable redundancy for discoverability. No action.

### azure-defaults

- **F-defaults-01** · `medium` · [azure-defaults/SKILL.md#L52-L65](.github/skills/azure-defaults/SKILL.md#L52-L65).
  Security baseline is restated inline as a "5-Line Summary" table. The canonical source per
  [AGENTS.md](AGENTS.md#L79) is
  [iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md). Today, both
  files describe the same baseline. Acceptable for an at-startup skill, but state explicitly that
  the table is a mirror of the canonical instruction and link to it. Fix: S.
- **F-defaults-02** · `low` · [azure-defaults/SKILL.md#L82-L85](.github/skills/azure-defaults/SKILL.md#L82-L85).
  Deprecated services list inline; the dedicated `references/deprecated-services.md` is referenced
  one line later. Recommend inline link to that reference so agents don't double-load. Fix: S.

### azure-deploy

- **F-deploy-01** · `critical` · [azure-deploy/SKILL.md#L24](.github/skills/azure-deploy/SKILL.md#L24).
  Body says "APIM/AI gateway infra changes: see [APIM docs](https://learn.microsoft.com/azure/api-management/get-started-create-service-instance)
  or invoke **azure-aigateway**." `azure-aigateway` exists only in
  [.archive/_archived_skills/azure-aigateway/](.archive/_archived_skills/azure-aigateway/SKILL.md).
  Routes to a non-existent skill. Fix: remove the `invoke azure-aigateway` clause or restore the
  skill. Token-impact: S.
- **F-deploy-02** · `low` · [azure-deploy/SKILL.minimal.md](.github/skills/azure-deploy/SKILL.minimal.md)
  is degenerate (empty body under `**Steps**`, `**MCP Tools**`, `**References**`). Same root cause as
  F-gen-01.

### azure-diagnostics

- **F-diag-01** · `medium` · Frontmatter `DO NOT USE FOR: pre-deployment validation (use azure-validate),
  cost analysis (use azure-cost-optimization)` is good. The body section "View activity log" expands
  scope to generic Azure troubleshooting beyond Container Apps / Function Apps. Clarify in frontmatter
  "best for Container Apps + Function Apps; activity-log basics also covered". Fix: S.

### azure-governance-discovery

- **F-gov-01** · `low` · Exit-code contract is documented (0/1/2/3) but no link to the script.
  [scripts/discover.py](.github/skills/azure-governance-discovery/scripts/discover.py) exists; add link
  from the contract table. Fix: S.

### azure-kusto

- **F-kusto-01** · `low` · Frontmatter `INVOKES:` lists tool aliases not literal MCP tool names. Other
  skills do the same (drawio, microsoft-docs). Consistent within the codebase; no action.

### azure-prepare

- **F-prepare-01** · `critical` · [azure-prepare/SKILL.md#L59](.github/skills/azure-prepare/SKILL.md#L59)
  and [#L62](.github/skills/azure-prepare/SKILL.md#L62), plus
  [azure-prepare/references/apim.md#L6](.github/skills/azure-prepare/references/apim.md#L6),
  [#L172](.github/skills/azure-prepare/references/apim.md#L172), [#L174](.github/skills/azure-prepare/references/apim.md#L174),
  and [azure-prepare/references/research.md#L38](.github/skills/azure-prepare/references/research.md#L38).
  All route to `azure-aigateway` and/or `azure-hosted-copilot-sdk`, both of which are archived. The
  STEP 0 specialized-routing table is a load-bearing decision point — getting it wrong derails the
  workflow. Fix: drop these rows (or restore the skills, separate decision). Token-impact: S.
- **F-prepare-02** · `medium` · Body uses emoji-prefixed H2 headings
  ("❌ STEP 0:" / "❌ PLAN-FIRST WORKFLOW"). [markdown.instructions.md](.github/instructions/markdown.instructions.md)
  scopes "no emojis" to agent definitions / instructions / skills loaded into chat. Skills are in scope.
  The decoration is also load-bearing in places (the validator does not know `❌ STEP 0` means
  "blocking"). Suggest replacing with text marker (e.g. `STEP 0 (BLOCKING)`). Fix: S.
- **F-prepare-03** · `low` · [SKILL.minimal.md](.github/skills/azure-prepare/SKILL.minimal.md) — same
  degenerate output as the rest. Rolls into F-gen-01.

### azure-quotas

- **F-quotas-01** · `medium` · "REST API data is unreliable" rule lacks a one-line reason. Agents won't
  know whether to retry or skip. Add: "...because not all resource providers expose quotas via the
  Quota REST API". Fix: S.

### azure-rbac

- **F-rbac-01** · `critical` · [azure-rbac/SKILL.md#L10-L28](.github/skills/azure-rbac/SKILL.md#L10).
  Body relies on tools `azure__documentation`, `azure__extension_cli_generate`, `azure__bicepschema`,
  `azure__get_azure_bestpractices` (double underscore). [.vscode/mcp.json](.vscode/mcp.json) defines
  no `azure` MCP server — only `azure-pricing`, `terraform`, `microsoft-learn`, `astro-docs`, `drawio`,
  `github`. These names appear to be a stale snapshot of the VS Code Azure extension's old tool
  registry. Agents reading this skill will call non-existent tools and fail. Fix: replace with the
  current toolset (`microsoft_docs_search`, az CLI, optionally `mcp_microsoft-lea_*`) or remove the
  body and rebuild from current capability. Token-impact: M.
- **F-rbac-02** · `high` · [azure-rbac/SKILL.minimal.md](.github/skills/azure-rbac/SKILL.minimal.md) is 3
  lines: heading + "Read `SKILL.md` for full content." For agents asked to make a quick RBAC routing
  decision, this is no better than no skill at all. Fix: hand-author a minimal tier with the actual
  decision tree (least-privilege built-in → custom role → assignment scope rule). Token-impact: S.

### azure-resources

- **F-resources-01** · `low` · [azure-resources/SKILL.digest.md](.github/skills/azure-resources/SKILL.digest.md)
  is 136 lines — longer than its source [SKILL.md](.github/skills/azure-resources/SKILL.md) at 125
  lines. The digest is supposed to be <60% of the source per
  [generate-skill-digests.mjs#L69](tools/scripts/generate-skill-digests.mjs#L69). Drift detected; regenerate.
  Token-impact: S.

### azure-storage

- **F-storage-01** · `critical` · [azure-storage/SKILL.md#L16-L30](.github/skills/azure-storage/SKILL.md#L16).
  Same `azure__storage` double-underscore pattern as F-rbac-01. Plus a "Run `/azure:setup` or enable
  via `/mcp`" instruction that has no equivalent slash command in the current Copilot Chat surface.
  Fix: rebuild with current Azure MCP tool names or az CLI. Token-impact: M.
- **F-storage-02** · `medium` · Body restates security baseline inline at L94 — duplicates `azure-defaults`.
  Replace with a one-line link. Fix: S.

### azure-validate

- **F-validate-01** · `medium` · Body says "All checks must pass — do not deploy with failures" but the
  table doesn't list the exact `npm run` commands. Agents must dive into `references/infraops-preflight.md`.
  Add a one-line command summary at H2 level. Fix: S.

### context-management

- **F-ctx-01** · `medium` · This is the canonical skill for tier selection, so its own tier outputs
  are a credibility signal. [SKILL.minimal.md](.github/skills/context-management/SKILL.minimal.md) is
  35 lines — better than most but still mostly section-label boilerplate. Hand-author a minimal that
  shows the actual tier-selection table. Fix: S.

### docs-writer

- **F-docs-01** · `medium` · [docs-writer/references/repo-architecture.md#L93](.github/skills/docs-writer/references/repo-architecture.md#L93)
  still lists `azure-aigateway` as an active skill. Reference content is out of sync with archive
  status. Fix: drop the row or annotate "(archived)". Fix: S.
- **F-docs-02** · `low` · Out-of-scope list is fine; one-line "why" annotations would help. Fix: S.

### drawio

- **F-drawio-01** · `medium` · [drawio/SKILL.md#L3](.github/skills/drawio/SKILL.md#L3) and
  [#L65](.github/skills/drawio/SKILL.md#L65) say "700+ Azure icons". This is a count of an external
  asset library, not a project entity — out of scope of
  [no-hardcoded-counts.instructions.md](.github/instructions/no-hardcoded-counts.instructions.md) by
  the letter of the rule. But the number drifts when the MCP server bumps icons. Suggest "the full
  Azure icon set bundled with the MCP server" with a link to the asset folder. Fix: S.
- **F-drawio-02** · `low` · `SKILL.digest.md` includes long-form "Layout Conventions" body — that
  section should live in `references/style-reference.md`. Fix: S.

### entra-app-registration

- **F-entra-01** · `low` · `HTTPS-only redirect URIs` restates a slice of the security baseline
  ([SKILL.md#L127](.github/skills/entra-app-registration/SKILL.md#L127)). Acceptable, but link to
  canonical source for consistency. Fix: S.

### github-operations

- **F-gh-01** · `low` · Body emphasises `gh` CLI but the description doesn't mention "do not run
  `gh auth` in devcontainers" — a rule that's in
  [.github/copilot-instructions.md](.github/copilot-instructions.md#L80). Bring the rule into the
  skill or link to it. Fix: S.

### golden-principles

- **F-gp-01** · `medium` · [golden-principles/SKILL.md#L36](.github/skills/golden-principles/SKILL.md#L36)
  explicitly admits drift between SKILL.md and `references/principles.md` ("when these disagree...
  prefer the canonical detail in references"). Anti-pattern: the skill itself says it's stale.
  Reconcile the two sources. Fix: M.

### iac-common

- **F-iac-01** · `medium` · The skill is essentially a thin layer that delegates to `references/deployment-strategies.md`
  and `references/azd-vs-deploy-guide.md`. That's fine, but `deploy.ps1` is mentioned 4 times in
  SKILL.md and 3 times in SKILL.digest.md. One mention + reference is enough. Fix: S.

### mermaid

- **F-mermaid-01** · `low` · Body is well-bounded and frontmatter scope exclusions are correct. The
  dark-mode-theming example uses `primaryColor: '#ffffff'` on light background — verify it renders.
  No action unless someone reports a rendering issue.

### microsoft-docs

- **F-mslearn-01** · `low` · CLI fallback (`@microsoft/learn-cli`) is mentioned without a maintenance
  caveat. Add: "Availability subject to npm package maintenance; primary path is the MCP server."
  Fix: S.

### python-diagrams

- **F-pyd-01** · `low` · Font stack hard-codes "Arial Bold" without fallback. Add `sans-serif`
  fallback in the example. Fix: S.

### terraform-patterns

- **F-tf-01** · `high` · Same duplication-of-canonical-rules issue as F-bicep-01. Plus an
  internally-resolved rule duplication: hub-spoke / PE / diagnostics rule lines appear in both
  SKILL.md and SKILL.digest.md. Should appear once in SKILL.md with the digest extracting a single
  pointer row. Fix: M.

### terraform-search-import

- **F-tfsi-01** · `medium` · Restates CAF naming + tag rules instead of linking to `azure-defaults`.
  Fix: S.
- **F-tfsi-02** · `low` · "Search workflow is experimental, TBD azurerm support" — accurate caveat,
  no action.

### terraform-test

- **F-tft-01** · `low` · Restates the CAF naming examples — link instead. Fix: S.

### vendor-prompting

- **F-vp-01** · `medium` · The skill's audit-procedure is canonical, but its own SKILL.md restates
  rule IDs that also live in [rules.json](.github/skills/vendor-prompting/rules.json) AND in
  [.github/instructions/vendor-prompting.instructions.md](.github/instructions/vendor-prompting.instructions.md).
  This three-way duplication is hard to keep in sync. Recommendation: SKILL.md lists rule **groups**
  (Claude / GPT-5.5 / cross-vendor) and links to `rules.json` as the only enumerated source.
  Fix: M.

### workflow-engine

- **F-wf-01** · `medium` · [workflow-engine/SKILL.digest.md#L54](.github/skills/workflow-engine/SKILL.digest.md#L54)
  hard-codes "synthetic fixture suite (6 agents + 3 `00-handoff.md`)". Per
  [no-hardcoded-counts.instructions.md](.github/instructions/no-hardcoded-counts.instructions.md),
  agent/skill/handoff counts must not be hard-coded outside the allow-list. Replace with descriptive
  language ("a fixture set covering the main workflow agents and handoff variants"). Fix: S.
- **F-wf-02** · `low` · Reference index column widths break the 120-char line limit per
  [markdown.instructions.md](.github/instructions/markdown.instructions.md#L13). Run `npm run lint:md`
  to confirm. Fix: S.

### Cross-cutting (auto-generator)

- **F-gen-01** · `high` · [tools/scripts/generate-skill-digests.mjs](tools/scripts/generate-skill-digests.mjs).
  Two structural problems:
  - **Section truncation**: [`trimSection`](tools/scripts/generate-skill-digests.mjs#L42-L54) cuts at
    `maxPerSection` lines and appends `> _See SKILL.md for full content._`. Routinely cuts mid-bullet
    or mid-table (see F-bicep-02, F-defaults-01 quote evidence).
  - **Minimal-tier heuristic**: [`generateMinimal`](tools/scripts/generate-skill-digests.mjs#L100-L140)
    emits `**<H2>**:` then the first non-table/non-list/non-blockquote line, up to 120 chars. For
    skills whose H2 bodies start with a table, the result is an empty section label (see
    [azure-deploy/SKILL.minimal.md](.github/skills/azure-deploy/SKILL.minimal.md)).
  - **Skip-if-exists writer**: by default, skills with existing digests are **never** regenerated
    (line 154). Drift compounds silently. See F-resources-01.
  Fix options (pick one):
  - (A) Hand-author all `SKILL.minimal.md` files (and regenerate digests with a section-aware
    extractor that respects table boundaries).
  - (B) Retire `SKILL.minimal.md` entirely; teach agents to fall back to `SKILL.digest.md` at high
    utilization (update [agent-skills.instructions.md](.github/instructions/agent-skills.instructions.md)).
  - (C) Make the generator content-aware: detect tables/code-fences and prefer narrative paragraphs,
    not the first cell after a heading.
  Token-impact (option B retirement): L (saves all minimal tier load + simplifies tier doc).

---

## Discoverability table

| Skill                    | `WHEN:` | `USE FOR:` | `DO NOT USE FOR:` | `INVOKES:` present? | Notes                                                                                                       |
| ------------------------ | :-----: | :--------: | :---------------: | :-----------------: | ----------------------------------------------------------------------------------------------------------- |
| azure-adr                | ✅      | ✅         | ✅                | n/a (no MCP)         | OK                                                                                                          |
| azure-artifacts          | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| azure-bicep-patterns     | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| azure-cloud-migrate      | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| azure-compliance         | ✅      | ✅         | ✅                | Missing             | Description does not surface azqr / KeyVault MCP usage despite body referencing them. Add `INVOKES:`.        |
| azure-compute            | ✅      | ✅         | ✅                | n/a (web_fetch only) | OK                                                                                                          |
| azure-cost-optimization  | ✅      | ✅         | ✅                | Missing             | Body uses Azure CLI; if it uses any MCP (e.g., pricing), surface in `INVOKES:`.                              |
| azure-defaults           | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| azure-deploy             | ✅      | ✅         | ✅                | Missing             | Body lists `mcp_azure_mcp_subscription_list`, `mcp_azure_mcp_group_list`, `mcp_azure_mcp_azd`. Surface them. |
| azure-diagnostics        | ✅      | ✅         | ✅                | Missing             | Body uses KQL + Resource Graph MCP. Surface them.                                                            |
| azure-governance-discovery | ✅    | ✅         | ✅                | n/a (Python script)  | OK                                                                                                          |
| azure-kusto              | ✅      | ✅         | ✅                | ✅                   | OK                                                                                                          |
| azure-prepare            | ✅      | ✅         | ✅                | n/a                 | OK; specialized-routing table is broken (F-prepare-01).                                                      |
| azure-quotas             | ✅      | ✅         | ✅                | ✅                   | OK                                                                                                          |
| azure-rbac               | ✅      | ✅         | ✅                | Missing             | Body relies on `azure__*` tools (F-rbac-01). Either fix tools then add `INVOKES:`, or remove the dependency. |
| azure-resources          | ✅      | ✅         | ✅                | Missing             | Body uses Resource Graph + storage/compute MCPs. Surface.                                                    |
| azure-storage            | ✅      | ✅         | ✅                | Missing             | Same as azure-rbac (F-storage-01).                                                                           |
| azure-validate           | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| context-management       | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| docs-writer              | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| drawio                   | ✅      | ✅         | ✅                | ✅                   | OK                                                                                                          |
| entra-app-registration   | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| github-operations        | ✅      | ✅         | ✅                | Missing             | Body uses gh CLI + GitHub MCP. Add `INVOKES:`.                                                               |
| golden-principles        | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| iac-common               | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| mermaid                  | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| microsoft-docs           | ✅      | ✅         | ✅                | ✅                   | OK                                                                                                          |
| python-diagrams          | ✅      | ✅         | ✅                | n/a (CLI only)       | OK                                                                                                          |
| terraform-patterns       | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| terraform-search-import  | ✅      | ✅         | ✅                | Missing             | Body uses terraform MCP. Surface.                                                                            |
| terraform-test           | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| vendor-prompting         | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |
| workflow-engine          | ✅      | ✅         | ✅                | n/a                 | OK                                                                                                          |

**Conclusion:** every skill has WHEN/USE FOR/DO NOT USE FOR. `INVOKES:` is patchy — used consistently
where MCP-only tools are involved (kusto, learn, quotas, drawio) but missing on several skills that
do call MCP servers (deploy, diagnostics, resources, github, terraform-search-import,
cost-optimization, compliance).

---

## Broken references

| Reference                                                                                                                                                                     | Target status                                                                                          | Action                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [azure-prepare/SKILL.md#L59](.github/skills/azure-prepare/SKILL.md#L59) → `azure-hosted-copilot-sdk`                                                                           | Archived: only in [.archive/_archived_skills/azure-hosted-copilot-sdk/](.archive/_archived_skills/)    | Remove the routing row.                                             |
| [azure-prepare/SKILL.md#L62](.github/skills/azure-prepare/SKILL.md#L62) → `azure-aigateway`                                                                                    | Archived: [.archive/_archived_skills/azure-aigateway/](.archive/_archived_skills/azure-aigateway/SKILL.md) | Remove routing row OR restore the skill (separate decision).         |
| [azure-prepare/SKILL.md#L75](.github/skills/azure-prepare/SKILL.md#L75) — Step 0 description names both archived skills                                                         | Same                                                                                                   | Update wording.                                                     |
| [azure-prepare/references/apim.md#L6](.github/skills/azure-prepare/references/apim.md#L6), [#L172](.github/skills/azure-prepare/references/apim.md#L172), [#L174](.github/skills/azure-prepare/references/apim.md#L174) → `azure-aigateway` | Same                                                                                                   | Replace with "out of scope; see APIM docs" until skill restored.    |
| [azure-prepare/references/research.md#L38](.github/skills/azure-prepare/references/research.md#L38) → `azure-aigateway`                                                          | Same                                                                                                   | Same as above.                                                      |
| [azure-deploy/SKILL.md#L24](.github/skills/azure-deploy/SKILL.md#L24) → `azure-aigateway`                                                                                       | Same                                                                                                   | Drop the inline invoke clause.                                      |
| [docs-writer/references/repo-architecture.md#L93](.github/skills/docs-writer/references/repo-architecture.md#L93) — lists `azure-aigateway` as an active skill                  | Same                                                                                                   | Remove or annotate `(archived)`.                                    |
| [azure-rbac/SKILL.md#L10-L28](.github/skills/azure-rbac/SKILL.md#L10) — `azure__documentation`, `azure__bicepschema`, `azure__get_azure_bestpractices`, `azure__extension_cli_generate` | No `azure` server in [.vscode/mcp.json](.vscode/mcp.json); double-underscore naming non-standard | Replace with current tool surface or remove tool dependence.        |
| [azure-storage/SKILL.md#L16-L30](.github/skills/azure-storage/SKILL.md#L16) — `azure__storage`                                                                                  | Same                                                                                                   | Same.                                                               |
| [azure-storage/SKILL.md#L24](.github/skills/azure-storage/SKILL.md) — `/azure:setup` / `/mcp` slash commands                                                                    | No such commands in current Copilot Chat / VS Code surface                                              | Remove or replace with the actual onboarding step.                  |
| [azure-resources/SKILL.digest.md](.github/skills/azure-resources/SKILL.digest.md) > `SKILL.md` line count                                                                       | Digest is larger than source — generator drift                                                          | Regenerate with `node tools/scripts/generate-skill-digests.mjs azure-resources`. |

---

## Auto-generator concerns (digest / minimal)

Summarised under **F-gen-01** above. The most egregious minimal-tier outputs:

- [azure-deploy/SKILL.minimal.md](.github/skills/azure-deploy/SKILL.minimal.md) (24 lines, half empty)
- [azure-prepare/SKILL.minimal.md](.github/skills/azure-prepare/SKILL.minimal.md) (32 lines, mostly section labels)
- [drawio/SKILL.minimal.md](.github/skills/drawio/SKILL.minimal.md) (28 lines, leading lines truncated mid-clause)
- [azure-rbac/SKILL.minimal.md](.github/skills/azure-rbac/SKILL.minimal.md) (3 lines total — triggered by the `digestLineCount < 14` short-skill branch)
- [workflow-engine/SKILL.minimal.md](.github/skills/workflow-engine/SKILL.minimal.md) (15 lines)
- [iac-common/SKILL.minimal.md](.github/skills/iac-common/SKILL.minimal.md) (15 lines)

Digest outliers (digest ≥ source line count):

- [azure-resources/SKILL.digest.md](.github/skills/azure-resources/SKILL.digest.md) — 136 lines vs source 125. Drift.

Digest tail-truncation evidence (representative; not exhaustive):

- [azure-bicep-patterns/SKILL.digest.md#L46](.github/skills/azure-bicep-patterns/SKILL.digest.md#L46) — Gotchas cut mid-bullet after "Watch for unexpected deletes, SKU downgrades,".
- [azure-defaults/SKILL.digest.md](.github/skills/azure-defaults/SKILL.digest.md#L20) — Regions table truncated to 3 rows of original 3 (OK) but Quick Reference body cut mid-sentence further down.
- [vendor-prompting/SKILL.digest.md](.github/skills/vendor-prompting/SKILL.digest.md#L17) — Decision Tree section is `**Decision Tree** > _See SKILL.md for full content._` with no body at all.

---

## What we did NOT find

For completeness:

- **No heredoc / interactive-shell violations** in committed `SKILL*.md` snippets. `npm run lint:safe-shell`
  is enforced and clean.
- **No hard-coded counts of agents/skills/instructions/validators in skill prose** except the workflow-engine
  digest noted in F-wf-01. External counts like the drawio "700+ icons" are out of scope per the rule.
- **All 33 skill frontmatter descriptions** have WHEN / USE FOR / DO NOT USE FOR sections. The skill
  taxonomy (WORKFLOW / ANALYSIS / UTILITY) is consistent.
- **Vendor-prompting compliance** — the skill ruleset in [rules.json](.github/skills/vendor-prompting/rules.json)
  applies to `.agent.md` / `.prompt.md`, not to `SKILL.md` files, so no findings raised here. (Skills do
  get loaded by Claude / GPT-5.5 agents but the rules.json scope is per-vendor agent body, not skill body.)
- **No security-baseline mistakes** in skill bodies — every restated baseline is consistent with
  [iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md). The problem is
  duplication, not correctness.

---

## Severity index

| Severity   | Findings                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `critical` | F-compute-01, F-deploy-01, F-prepare-01, F-rbac-01, F-storage-01                                          |
| `high`     | F-bicep-01, F-rbac-02, F-tf-01, F-gen-01 (cross-cutting)                                                  |
| `medium`   | F-artifacts-01, F-compliance-01, F-bicep-02, F-defaults-01, F-diag-01, F-prepare-02, F-quotas-01, F-storage-02, F-ctx-01, F-docs-01, F-validate-01, F-gp-01, F-iac-01, F-tfsi-01, F-vp-01, F-wf-01 |
| `low`      | F-adr-01, F-adr-02, F-artifacts-02, F-migrate-01, F-compliance-02, F-cost-01, F-defaults-02, F-deploy-02, F-gov-01, F-kusto-01, F-prepare-03, F-resources-01, F-drawio-01, F-drawio-02, F-entra-01, F-gh-01, F-mermaid-01, F-mslearn-01, F-pyd-01, F-tfsi-02, F-tft-01, F-wf-02 |
