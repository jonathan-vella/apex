# Batch 4 — Sensei Standard-Mode Audit (Read-Only)

> **Stage**: A (Audit) | **Mode**: Read-only — no skill files modified
> **Generated**: 2026-05-10 | **Branch**: `feat/skills-sensei`
> **Source data**: `npm run audit:skills -- --batch 4`
> **Plan**: [.github/prompts/plan-skillsAuditOptimize.prompt.md](../../prompts/plan-skillsAuditOptimize.prompt.md)
> **Tracker**: [TODO.md](TODO.md)

## Scope

| # | Skill | Path |
|---|---|---|
| 1 | `entra-app-registration` | [.github/skills/entra-app-registration/SKILL.md](../entra-app-registration/SKILL.md) |
| 2 | `github-operations` | [.github/skills/github-operations/SKILL.md](../github-operations/SKILL.md) |
| 3 | `golden-principles` | [.github/skills/golden-principles/SKILL.md](../golden-principles/SKILL.md) |
| 4 | `iac-common` | [.github/skills/iac-common/SKILL.md](../iac-common/SKILL.md) |
| 5 | `mermaid` | [.github/skills/mermaid/SKILL.md](../mermaid/SKILL.md) |
| 6 | `microsoft-docs` | [.github/skills/microsoft-docs/SKILL.md](../microsoft-docs/SKILL.md) |

## Summary

| Skill | Adherence | GEPA Score | Tokens | Top Issue | Recommended Action |
|---|---|---|---|---|---|
| entra-app-registration | **Medium** | 0.67 | 2196 | Missing `WHEN:`; **2 stale refs** (`azure-keyvault-expiration-audit`, `azure-security`) | Add prefix + `WHEN:`; **fix bug refs to `azure-compliance`** |
| github-operations | Medium-High | 0.50 | 2143 | Missing `WHEN:`; no skill-type prefix | Add `**WORKFLOW SKILL**` prefix + `WHEN:` |
| golden-principles | Medium-High | 0.50 | 1318 | Missing `WHEN:`; no skill-type prefix | Add `**ANALYSIS SKILL**` prefix + `WHEN:` |
| iac-common | Medium-High | 0.50 | 1755 | Missing `WHEN:`; no skill-type prefix | Add `**UTILITY SKILL**` prefix + `WHEN:` |
| mermaid | Medium-High | 0.50 | 1235 | Missing `WHEN:`; no skill-type prefix | Add `**UTILITY SKILL**` prefix + `WHEN:` |
| microsoft-docs | Medium-High | 0.67 | 832 | No skill-type prefix; **2 stale refs** (`microsoft-code-reference`, `microsoft-skill-creator`) | Add prefix + `WHEN:`; drop or replace stale refs |

### Aggregate observations

| Metric | Value |
|---|---|
| Skills passing GEPA ≥ 0.7 | 0 / 6 |
| Skills with skill-type prefix | 0 / 6 |
| Skills with both `USE FOR:` AND `WHEN:` | 0 / 6 |
| Skills over 1500 tokens | 4 / 6 |
| Stale cross-references found | 4 across 2 skills |
| Smallest body in repo so far | `microsoft-docs` (832 tokens) |

### Critical findings (batch 4)

1. 🚨 **`entra-app-registration` references 2 missing skills**: `azure-keyvault-expiration-audit` and `azure-security`. Both should be `azure-compliance` (the actual security/Key Vault audit skill in this repo) — same bug pattern as Batch 1's `azure-cost-optimization` → `azure-security` (already fixed).
2. 🚨 **`microsoft-docs` references 2 missing skills**: `microsoft-code-reference` and `microsoft-skill-creator`. Neither exists. The redirects should either be dropped or pointed at concrete alternatives.
3. **No batch-4 skill currently uses `WHEN:` literals** — every skill in this batch needs the same prefix + `WHEN:` add. Lowest-effort batch from a content-design perspective; just mechanical.

## Detailed appendix

### 1. entra-app-registration 🚨 STALE REFS

**Current** (478 chars):

```text
Guides Microsoft Entra ID app registration, OAuth 2.0 authentication, and MSAL integration. USE FOR: create app registration, register Azure AD app, configure OAuth, set up authentication, add API permissions, generate service principal, MSAL example, console app auth, Entra ID setup, Azure AD authentication. DO NOT USE FOR: Azure RBAC or role assignments (use azure-rbac), Key Vault secrets (use azure-keyvault-expiration-audit), Azure resource security (use azure-security).
```

**Scoring**: ✓ desc-length, ✓ has_use_for, ✗ has_when, ✓ has_steps, ✗ has_rules, ✓ no_bad. **Score: 0.67**

**Stale refs**: `azure-keyvault-expiration-audit` (does not exist) and `azure-security` (does not exist).

**Proposed**:

```diff
-description: "Guides Microsoft Entra ID app registration, OAuth 2.0 authentication, and MSAL integration. USE FOR: create app registration, register Azure AD app, configure OAuth, set up authentication, add API permissions, generate service principal, MSAL example, console app auth, Entra ID setup, Azure AD authentication. DO NOT USE FOR: Azure RBAC or role assignments (use azure-rbac), Key Vault secrets (use azure-keyvault-expiration-audit), Azure resource security (use azure-security)."
+description: "**WORKFLOW SKILL** — Guides Microsoft Entra ID app registration, OAuth 2.0 authentication, and MSAL integration. WHEN: \"create app registration\", \"register Azure AD app\", \"configure OAuth\", \"add API permissions\", \"generate service principal\", \"MSAL example\", \"Entra ID setup\". USE FOR: app registration creation, OAuth + MSAL scaffolding, service principal generation. DO NOT USE FOR: Azure RBAC or role assignments (use azure-rbac), Key Vault secrets / certificate audits (use azure-compliance), Azure resource security scanning (use azure-compliance)."
```

**Token Δ**: ~ +130 chars / +30 tokens.

**Bug fix confirmed**: both stale refs (`azure-keyvault-expiration-audit`, `azure-security`) replaced with the correct `azure-compliance`.

---

### 2. github-operations

**Current** (294 chars):

```text
Full contribution lifecycle: branch naming, conventional commits, GitHub issues, PRs, Actions, and releases. gh CLI-first with MCP fallback. USE FOR: commit, push, PR, branch, issue, release, GitHub operations. DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture decisions.
```

**Scoring**: ✓ desc-length, ✓ has_use_for, ✗ has_when, ✗ has_rules, ✗ has_steps, ✓ no_bad. **Score: 0.50**

**Proposed**:

```diff
-description: "Full contribution lifecycle: branch naming, conventional commits, GitHub issues, PRs, Actions, and releases. gh CLI-first with MCP fallback. USE FOR: commit, push, PR, branch, issue, release, GitHub operations. DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture decisions."
+description: "**WORKFLOW SKILL** — Full GitHub contribution lifecycle: branch naming, conventional commits, issues, PRs, Actions, and releases. gh CLI-first with MCP fallback. WHEN: \"commit\", \"push\", \"open PR\", \"create branch\", \"create issue\", \"cut release\", \"GitHub operation\". USE FOR: commit/push, PR creation, branch lifecycle, issues, releases, Actions config. DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture decisions."
```

**Token Δ**: ~ +160 chars / +35 tokens.

**MCP**: Body uses `gh` CLI + GitHub MCP. Could declare `INVOKES: gh CLI, github MCP (issues, PRs)`; deferred — adding INVOKES shifts routing semantics, not just frontmatter.

---

### 3. golden-principles

**Current** (269 chars):

```text
The 10 agent-first operating principles governing how agents work in this repository. USE FOR: agent behavior rules, operating philosophy, principle lookup, governance invariants. DO NOT USE FOR: Azure infrastructure, code generation, troubleshooting, diagram creation.
```

**Scoring**: ✓ desc-length, ✓ has_use_for, ✗ has_when, ✗ has_rules, ✗ has_steps, ✓ no_bad. **Score: 0.50**

**Proposed**:

```diff
-description: "The 10 agent-first operating principles governing how agents work in this repository. USE FOR: agent behavior rules, operating philosophy, principle lookup, governance invariants. DO NOT USE FOR: Azure infrastructure, code generation, troubleshooting, diagram creation."
+description: "**ANALYSIS SKILL** — The agent-first operating principles governing how agents work in this repository. WHEN: \"golden principles\", \"agent behavior rules\", \"operating philosophy\", \"principle lookup\", \"governance invariants\". USE FOR: agent behavior rules, operating philosophy, principle lookup, governance invariants. DO NOT USE FOR: Azure infrastructure, code generation, troubleshooting, diagram creation."
```

**Token Δ**: ~ +130 chars / +30 tokens.

**Note on count**: Removed the literal "10" from "The 10 agent-first principles" because (a) [.github/instructions/no-hardcoded-counts.instructions.md](../../instructions/no-hardcoded-counts.instructions.md) prohibits hard-coded entity counts, and (b) the count is enforced by [tools/registry/count-manifest.json](../../../tools/registry/count-manifest.json), not the skill description.

---

### 4. iac-common

**Current** (403 chars):

```text
Shared IaC deploy patterns for Bicep and Terraform deploy agents: deployment strategies, circuit breaker, known deploy issues. For preflight validation (auth, governance, stop rules), see azure-validate. USE FOR: Phased deployment, circuit breaker, deploy-specific known issues. DO NOT USE FOR: Preflight validation (use azure-validate), code generation (use azure-bicep-patterns or terraform-patterns).
```

**Scoring**: ✓ desc-length, ✓ has_use_for, ✗ has_when, ✗ has_rules, ✗ has_steps, ✓ no_bad. **Score: 0.50**

**Proposed**:

```diff
-description: "Shared IaC deploy patterns for Bicep and Terraform deploy agents: deployment strategies, circuit breaker, known deploy issues. For preflight validation (auth, governance, stop rules), see azure-validate. USE FOR: Phased deployment, circuit breaker, deploy-specific known issues. DO NOT USE FOR: Preflight validation (use azure-validate), code generation (use azure-bicep-patterns or terraform-patterns)."
+description: "**UTILITY SKILL** — Shared IaC deploy patterns for Bicep + Terraform deploy agents: deployment strategies, circuit breaker, known deploy issues. WHEN: \"phased deployment\", \"circuit breaker\", \"deploy strategy\", \"deploy issue\", \"shared IaC pattern\". USE FOR: phased deployment, circuit breaker patterns, deploy-specific known issues. DO NOT USE FOR: preflight validation (use azure-validate), code generation (use azure-bicep-patterns or terraform-patterns)."
```

**Token Δ**: ~ +110 chars / +25 tokens.

---

### 5. mermaid

**Current** (462 chars):

```text
Mermaid diagram generation for inline markdown documentation: flowcharts, sequence diagrams, Gantt charts, class diagrams, state diagrams, ER diagrams, and architecture visualizations. USE FOR: inline markdown diagrams, flowcharts, sequence diagrams, Gantt charts, state diagrams, ER diagrams, Azure resource visualization. DO NOT USE FOR: architecture diagrams with Azure icons (use drawio), WAF/cost charts (use python-diagrams), Draw.io diagrams (use drawio).
```

**Scoring**: ✓ desc-length, ✓ has_use_for, ✗ has_when, ✗ has_rules, ✗ has_steps, ✓ no_bad. **Score: 0.50**

**Proposed**:

```diff
-description: "Mermaid diagram generation for inline markdown documentation: flowcharts, sequence diagrams, Gantt charts, class diagrams, state diagrams, ER diagrams, and architecture visualizations. USE FOR: inline markdown diagrams, flowcharts, sequence diagrams, Gantt charts, state diagrams, ER diagrams, Azure resource visualization. DO NOT USE FOR: architecture diagrams with Azure icons (use drawio), WAF/cost charts (use python-diagrams), Draw.io diagrams (use drawio)."
+description: "**UTILITY SKILL** — Mermaid diagram generation for inline markdown documentation: flowcharts, sequence diagrams, Gantt, class, state, ER. WHEN: \"mermaid flowchart\", \"sequence diagram\", \"Gantt chart\", \"state diagram\", \"ER diagram\", \"inline markdown diagram\". USE FOR: inline markdown diagrams, flowcharts, sequence diagrams, Gantt charts, state diagrams, ER diagrams. DO NOT USE FOR: architecture diagrams with Azure icons (use drawio), WAF/cost charts (use python-diagrams)."
```

**Token Δ**: ~ +30 chars / +8 tokens.

---

### 6. microsoft-docs 🚨 STALE REFS

**Current** (410 chars):

```text
Query official Microsoft documentation to understand concepts, find tutorials, and learn how services work. USE FOR: Azure service overviews, quickstarts, configuration guides, limits and quotas, best practices, architecture patterns, WAF pillar references. DO NOT USE FOR: code sample lookups (use microsoft-code-reference), skill creation (use microsoft-skill-creator), Azure pricing (use azure-pricing MCP).
```

**Scoring**: ✓ desc-length, ✓ has_use_for, ✗ has_when, ✗ has_rules, ✗ has_steps, ✓ no_bad. **Score: 0.67**

**Stale refs**: `microsoft-code-reference` (does not exist), `microsoft-skill-creator` (does not exist).

**Proposed**:

```diff
-description: "Query official Microsoft documentation to understand concepts, find tutorials, and learn how services work. USE FOR: Azure service overviews, quickstarts, configuration guides, limits and quotas, best practices, architecture patterns, WAF pillar references. DO NOT USE FOR: code sample lookups (use microsoft-code-reference), skill creation (use microsoft-skill-creator), Azure pricing (use azure-pricing MCP)."
+description: "**ANALYSIS SKILL** — Query official Microsoft documentation to understand concepts, find tutorials, and learn how services work. WHEN: \"Microsoft Learn\", \"Azure docs\", \"quickstart guide\", \"limits and quotas\", \"WAF reference\", \"architecture pattern docs\". USE FOR: Azure service overviews, quickstarts, configuration guides, limits and quotas, best practices, architecture patterns, WAF pillar references. DO NOT USE FOR: Azure pricing (use azure-pricing MCP). INVOKES: microsoft-learn MCP (microsoft_docs_search, microsoft_code_sample_search, microsoft_docs_fetch)."
```

**Token Δ**: ~ +50 chars / +12 tokens.

**Stale ref fix**: drops both stale references. Code-sample lookups in this repo use the same Microsoft Learn MCP via `microsoft_code_sample_search` (declared in the new `INVOKES:`); skill creation is done in this repo via the [agent-skills.instructions.md](../../instructions/agent-skills.instructions.md) workflow + sensei, not a dedicated skill.

**MCP**: Adds `INVOKES: microsoft-learn MCP (microsoft_docs_search, microsoft_code_sample_search, microsoft_docs_fetch)` — confirmed available per the deferred-tools list.

## Recommended update order

1. 🚨 **entra-app-registration** — fixes 2 stale refs to non-existent skills
2. 🚨 **microsoft-docs** — fixes 2 stale refs + adds Microsoft Learn MCP `INVOKES:`
3. **github-operations** — straightforward prefix + WHEN
4. **golden-principles** — straightforward + drops hard-coded "10"
5. **iac-common** — straightforward
6. **mermaid** — straightforward

## Next step

This audit is read-only. To proceed, reply with one of:

- `update batch 4` — apply all 6 proposed diffs, validate, commit
- `update <skill-name>` — single-skill update (e.g., `update entra-app-registration` to fix bug refs first)
- `audit batch 5` — continue Stage A (final 6 skills)
- `gepa audit` — skip ahead to Stage B
