# Batch 1 — Sensei Standard-Mode Audit (Read-Only)

> **Phase**: 1 (Audit) | **Mode**: Read-only — no skill files modified
> **Generated**: 2026-05-10 | **Branch**: `feat/skills-sensei`
> **Source data**: `npm run audit:skills -- --batch 1`
> **Plan**: [.github/prompts/plan-skillsAuditOptimize.prompt.md](../../prompts/plan-skillsAuditOptimize.prompt.md)
> **Tracker**: [TODO.md](TODO.md)

## Scope

| # | Skill | Path |
|---|---|---|
| 1 | `azure-adr` | [.github/skills/azure-adr/SKILL.md](../azure-adr/SKILL.md) |
| 2 | `azure-artifacts` | [.github/skills/azure-artifacts/SKILL.md](../azure-artifacts/SKILL.md) |
| 3 | `azure-bicep-patterns` | [.github/skills/azure-bicep-patterns/SKILL.md](../azure-bicep-patterns/SKILL.md) |
| 4 | `azure-cloud-migrate` | [.github/skills/azure-cloud-migrate/SKILL.md](../azure-cloud-migrate/SKILL.md) |
| 5 | `azure-compliance` | [.github/skills/azure-compliance/SKILL.md](../azure-compliance/SKILL.md) |
| 6 | `azure-compute` | [.github/skills/azure-compute/SKILL.md](../azure-compute/SKILL.md) |
| 7 | `azure-cost-optimization` | [.github/skills/azure-cost-optimization/SKILL.md](../azure-cost-optimization/SKILL.md) |

## Summary

| Skill | Adherence | GEPA Score | Tokens | Top Issue | Recommended Action |
|---|---|---|---|---|---|
| azure-adr | Medium-High | 0.50 | 1783 | Missing `WHEN:` literal | Add `WHEN:` alongside `USE FOR:`; lowest-risk win |
| azure-artifacts | Medium-High | 0.33† | 1516 | No skill-type prefix; missing `WHEN:` | Add `**UTILITY SKILL**` prefix + `WHEN:` keyword |
| azure-bicep-patterns | Medium-High | 0.50 | 1434 | No skill-type prefix; missing `WHEN:` | Add `**UTILITY SKILL**` prefix + `WHEN:` keyword |
| azure-cloud-migrate | Medium-High | 0.83 | 547 | Missing `USE FOR:` (has `WHEN:`) | Add `USE FOR:` alongside `WHEN:`; high baseline |
| azure-compliance | Medium-High | 0.50 | 1337 | Missing `USE FOR:`; no skill-type prefix | Add `**ANALYSIS SKILL**` prefix + `USE FOR:` |
| azure-compute | **Medium** | 0.67 | 2642 | Description >60 words (91); 5× token limit | Trim description; add `USE FOR:`; consider body split |
| azure-cost-optimization | **Medium** | 0.67 | 1922 | Description >60 words (84); missing `WHEN:` | Trim description; add `WHEN:` |

> † `azure-artifacts` 0.33 score is depressed by a false-positive: the body's quality-checklist line `- [ ] No placeholder text ("TBD", "Insert here", "TODO")` triggers GEPA's `TODO|FIXME|HACK` regex. The text is intentional (it tells agents what NOT to emit). Treat as 0.50 baseline. **No fix required**.

### Aggregate observations

| Metric | Value |
|---|---|
| Skills passing GEPA ≥ 0.7 | 1 / 7 (`azure-cloud-migrate` only) |
| Skills with skill-type prefix (`**WORKFLOW/UTILITY/ANALYSIS SKILL**`) | 1 / 7 (`azure-adr`) |
| Skills with both `USE FOR:` AND `WHEN:` | 0 / 7 |
| Skills over 500-token soft limit | 7 / 7 |
| Skills over 1500 tokens (3× soft) | 4 / 7 |
| Skills with `INVOKES:` routing | 0 / 7 |

### Common patterns

1. **Missing dual-trigger** — Most skills have either `USE FOR:` *or* `WHEN:`, not both. Adding the second improves cross-model matching (Claude Sonnet weights `WHEN:`; GPT weights `USE FOR:`).
2. **No skill-type prefix** — Only `azure-adr` carries the `**ANALYSIS SKILL**` prefix (added in prior session). Adding prefixes is a free win toward routing clarity.
3. **Body token bloat** — Every batch-1 skill is over 500-token soft limit; `azure-compute` is 5× over. Body trimming is out-of-scope for frontmatter-only optimization but worth flagging.
4. **No INVOKES: routing** — None of these skills declare which MCPs/tools they invoke. Adding `INVOKES:` would unlock the High-tier score and help the orchestrator route correctly.

## Detailed appendix

### 1. azure-adr

**Current frontmatter description** (417 chars):

```text
**ANALYSIS SKILL** — Creates Azure Architecture Decision Records (ADRs) with WAF pillar mapping, alternatives, and consequences. USE FOR: "create ADR", "document decision", "architecture decision record", "record why we chose", "WAF pillar justification", "trade-off analysis". DO NOT USE FOR: Bicep/Terraform code (use 06b/06t agents), architecture diagrams (use drawio), cost estimates (use cost-estimate-subagent).
```

**Scoring breakdown**:

| Check | Result |
|---|---|
| description_length (150-1024) | ✓ 1.0 |
| has_use_for | ✓ 1.0 |
| no_bad_patterns | ✓ 1.0 |
| has_rules | ✗ 0.0 (no `## Rules` heading) |
| has_steps | ✗ 0.0 (no `## Steps` heading) |
| has_when | ✗ 0.0 (literal `WHEN:` token absent) |

**Adherence**: Medium-High. Already touched in prior session; prefix + quoted triggers + redirect anti-triggers in place.

**Proposed before/after** (text only — not applied):

```diff
-description: "**ANALYSIS SKILL** — Creates Azure Architecture Decision Records (ADRs) with WAF pillar mapping, alternatives, and consequences. USE FOR: \"create ADR\", \"document decision\", \"architecture decision record\", \"record why we chose\", \"WAF pillar justification\", \"trade-off analysis\". DO NOT USE FOR: Bicep/Terraform code (use 06b/06t agents), architecture diagrams (use drawio), cost estimates (use cost-estimate-subagent)."
+description: "**ANALYSIS SKILL** — Creates Azure Architecture Decision Records (ADRs) with WAF pillar mapping, alternatives, and consequences. WHEN: \"create ADR\", \"document decision\", \"architecture decision record\", \"record why we chose\", \"WAF pillar justification\", \"trade-off analysis\". USE FOR: ADR scaffolding, design ADRs (Step 3), as-built ADRs (Step 7). DO NOT USE FOR: Bicep/Terraform code (use 06b/06t agents), architecture diagrams (use drawio), cost estimates (use cost-estimate-subagent)."
```

**Token delta projection**: ~ +60 chars / +12 tokens.

**MCP integration check**: `INVOKES:` not present — N/A. Skill produces markdown ADRs and does not invoke external tools. Adding `INVOKES:` not warranted.

**Risk notes**: Already optimized in prior session. The proposed change keeps quoted phrases (now as `WHEN:` triggers) and adds `USE FOR:` as a routing list — both literals are present, satisfying `has_when` + `has_use_for`.

---

### 2. azure-artifacts

**Current frontmatter description** (317 chars):

```text
Artifact template structures, H2 compliance rules, and documentation styling for agent outputs (Steps 1-7). USE FOR: generating any agent artifact, checking H2 structure compliance. DO NOT USE FOR: Azure resource configuration (use azure-defaults), Bicep/Terraform patterns (use bicep-patterns or terraform-patterns).
```

**Scoring breakdown**:

| Check | Result |
|---|---|
| description_length (150-1024) | ✓ 1.0 |
| has_use_for | ✓ 1.0 |
| no_bad_patterns | ✗ 0.0 **(false positive — see top of report)** |
| has_rules | ✗ 0.0 |
| has_steps | ✗ 0.0 |
| has_when | ✗ 0.0 |

**Adherence**: Medium-High.

**Proposed before/after** (text only):

```diff
-description: "Artifact template structures, H2 compliance rules, and documentation styling for agent outputs (Steps 1-7). USE FOR: generating any agent artifact, checking H2 structure compliance. DO NOT USE FOR: Azure resource configuration (use azure-defaults), Bicep/Terraform patterns (use bicep-patterns or terraform-patterns)."
+description: "**UTILITY SKILL** — Artifact template structures, H2 compliance rules, and documentation styling for agent outputs (Steps 1-7). WHEN: \"generate artifact\", \"check H2 structure\", \"artifact template\", \"step 7 as-built\". USE FOR: generating any agent artifact, checking H2 structure compliance. DO NOT USE FOR: Azure resource configuration (use azure-defaults), Bicep/Terraform patterns (use azure-bicep-patterns or terraform-patterns)."
```

**Token delta projection**: ~ +110 chars / +25 tokens.

**MCP integration check**: N/A.

**Risk notes**: GEPA's TODO/FIXME false positive will persist after the fix because the offending body text is in the quality checklist. **Acceptable** — not a real issue.

---

### 3. azure-bicep-patterns

**Current frontmatter description** (277 chars):

```text
Reusable Azure Bicep patterns: hub-spoke, private endpoints, diagnostics, AVM composition. USE FOR: Bicep template design, hub-spoke networking, private endpoint patterns, AVM modules. DO NOT USE FOR: Terraform code, architecture decisions, troubleshooting, diagram generation.
```

**Scoring breakdown**:

| Check | Result |
|---|---|
| description_length (150-1024) | ✓ 1.0 |
| has_use_for | ✓ 1.0 |
| no_bad_patterns | ✓ 1.0 |
| has_rules | ✗ 0.0 |
| has_steps | ✗ 0.0 |
| has_when | ✗ 0.0 |

**Adherence**: Medium-High.

**Proposed before/after** (text only):

```diff
-description: "Reusable Azure Bicep patterns: hub-spoke, private endpoints, diagnostics, AVM composition. USE FOR: Bicep template design, hub-spoke networking, private endpoint patterns, AVM modules. DO NOT USE FOR: Terraform code, architecture decisions, troubleshooting, diagram generation."
+description: "**UTILITY SKILL** — Reusable Azure Bicep patterns: hub-spoke, private endpoints, diagnostics, AVM composition. WHEN: \"hub-spoke Bicep\", \"private endpoint module\", \"diagnostic settings\", \"AVM Bicep composition\". USE FOR: Bicep template design, hub-spoke networking, private endpoint patterns, AVM modules. DO NOT USE FOR: Terraform code (use terraform-patterns), architecture decisions (use azure-adr), troubleshooting, diagram generation (use drawio)."
```

**Token delta projection**: ~ +160 chars / +35 tokens.

**MCP integration check**: N/A — pattern reference, not tool-invoking.

---

### 4. azure-cloud-migrate (highest baseline)

**Current frontmatter description** (362 chars):

```text
Assess and migrate cross-cloud workloads to Azure. Generates assessment reports and converts code from AWS, GCP, or other providers to Azure services. WHEN: migrate Lambda to Azure Functions, migrate AWS to Azure, Lambda migration assessment, convert AWS serverless to Azure, migration readiness report, migrate from AWS, migrate from GCP, cross-cloud migration.
```

**Scoring breakdown**:

| Check | Result |
|---|---|
| description_length (150-1024) | ✓ 1.0 |
| has_when | ✓ 1.0 |
| has_rules | ✓ 1.0 (body has `## Rules`) |
| has_steps | ✓ 1.0 (body has `## Steps`) |
| no_bad_patterns | ✓ 1.0 |
| has_use_for | ✗ 0.0 |

**Adherence**: Medium-High. **Best in batch — already 0.83.**

**Proposed before/after** (text only):

```diff
-description: "Assess and migrate cross-cloud workloads to Azure. Generates assessment reports and converts code from AWS, GCP, or other providers to Azure services. WHEN: migrate Lambda to Azure Functions, migrate AWS to Azure, Lambda migration assessment, convert AWS serverless to Azure, migration readiness report, migrate from AWS, migrate from GCP, cross-cloud migration."
+description: "**WORKFLOW SKILL** — Assess and migrate cross-cloud workloads to Azure. Generates assessment reports and converts code from AWS, GCP, or other providers to Azure services. WHEN: \"migrate Lambda to Azure Functions\", \"migrate AWS to Azure\", \"convert AWS serverless to Azure\", \"migration readiness report\", \"cross-cloud migration\". USE FOR: cross-cloud assessment, AWS-to-Azure code conversion, GCP-to-Azure code conversion. DO NOT USE FOR: greenfield Azure deployment (use azure-prepare), Azure-only refactor (use azure-prepare)."
```

**Token delta projection**: ~ +160 chars / +35 tokens.

**MCP integration check**: N/A.

**Risk notes**: Adding `**WORKFLOW SKILL**` + `USE FOR:` + redirect anti-triggers gives this skill a clean path to High score and protects against collision with `azure-prepare`.

---

### 5. azure-compliance

**Current frontmatter description** (480 chars):

```text
Comprehensive Azure compliance and security auditing capabilities including best practices assessment, Key Vault expiration monitoring, and resource configuration validation. WHEN: compliance scan, security audit, BEFORE running azqr (compliance cli tool), Azure best practices, Key Vault expiration check, compliance assessment, resource review, configuration validation, expired certificates, expiring secrets, orphaned resources, policy compliance, security posture evaluation.
```

**Scoring breakdown**:

| Check | Result |
|---|---|
| description_length (150-1024) | ✓ 1.0 |
| has_when | ✓ 1.0 |
| no_bad_patterns | ✓ 1.0 |
| has_rules | ✗ 0.0 |
| has_steps | ✗ 0.0 |
| has_use_for | ✗ 0.0 |

**Adherence**: Medium-High (description has 71 words; word-count classifier flags this as borderline-Medium because >60).

**Proposed before/after** (text only):

```diff
-description: "Comprehensive Azure compliance and security auditing capabilities including best practices assessment, Key Vault expiration monitoring, and resource configuration validation. WHEN: compliance scan, security audit, BEFORE running azqr (compliance cli tool), Azure best practices, Key Vault expiration check, compliance assessment, resource review, configuration validation, expired certificates, expiring secrets, orphaned resources, policy compliance, security posture evaluation."
+description: "**ANALYSIS SKILL** — Azure compliance and security auditing: best practices, Key Vault expiration monitoring, resource validation. WHEN: \"compliance scan\", \"security audit\", \"Key Vault expiration check\", \"expired certificates\", \"orphaned resources\". USE FOR: pre-azqr compliance assessment, Key Vault audits, security posture evaluation. DO NOT USE FOR: cost analysis (use azure-cost-optimization), governance discovery (use azure-governance-discovery)."
```

**Token delta projection**: ~ -30 chars / -5 tokens (trimmed).

**MCP integration check**: N/A — body uses `azqr` CLI but doesn't formally invoke a named MCP. Could add `INVOKES: azqr CLI` for clarity.

**Risk notes**: Trimming verbose triggers ("compliance assessment", "configuration validation", "security posture evaluation" are redundant). Down from 71 → ~52 words.

---

### 6. azure-compute (highest token count)

**Current frontmatter description** (647 chars):

```text
Recommend Azure VM sizes, VM Scale Sets (VMSS), and configurations based on workload requirements, performance needs, and budget constraints. No Azure account required — uses public documentation and the Azure Retail Prices API. WHEN: recommend VM size, which VM should I use, choose Azure VM, VM for web/database/ML/batch/HPC, GPU VM, compare VM sizes, cheapest VM, best VM for workload, VM pricing, cost estimate, burstable/compute/memory/storage optimized VM, confidential computing, VM trade-offs, VM families, VMSS, scale set recommendation, autoscale VMs, load balanced VMs, VMSS vs VM, scale out, horizontal scaling, flexible orchestration.
```

**Scoring breakdown**:

| Check | Result |
|---|---|
| description_length (150-1024) | ✓ 1.0 |
| has_when | ✓ 1.0 |
| has_steps | ✓ 1.0 (body has `## Steps`) |
| no_bad_patterns | ✓ 1.0 |
| has_rules | ✗ 0.0 |
| has_use_for | ✗ 0.0 |

**Adherence**: **Medium** — description is 91 words, well over 60-word soft cap.

**Proposed before/after** (text only):

```diff
-description: "Recommend Azure VM sizes, VM Scale Sets (VMSS), and configurations based on workload requirements, performance needs, and budget constraints. No Azure account required — uses public documentation and the Azure Retail Prices API. WHEN: recommend VM size, which VM should I use, choose Azure VM, VM for web/database/ML/batch/HPC, GPU VM, compare VM sizes, cheapest VM, best VM for workload, VM pricing, cost estimate, burstable/compute/memory/storage optimized VM, confidential computing, VM trade-offs, VM families, VMSS, scale set recommendation, autoscale VMs, load balanced VMs, VMSS vs VM, scale out, horizontal scaling, flexible orchestration."
+description: "**ANALYSIS SKILL** — Recommend Azure VM sizes and Scale Sets (VMSS) for workload requirements, performance, and budget. Uses public docs and the Azure Retail Prices API. WHEN: \"recommend VM size\", \"choose Azure VM\", \"GPU VM\", \"compare VM sizes\", \"VMSS vs VM\", \"autoscale VMs\". USE FOR: VM family selection, VMSS sizing, confidential computing recommendations. DO NOT USE FOR: provisioning VMs (use azure-prepare), VM pricing for budgets (use azure-pricing MCP directly)."
```

**Token delta projection**: ~ -180 chars / -50 tokens (trimmed); body remains 2642 tokens — separate body-trim work warranted but out of frontmatter scope.

**MCP integration check**: Body references "Azure Retail Prices API" — could declare `INVOKES: azure-pricing MCP` if that's how it actually fetches pricing. **Verify in Phase 2** before applying.

**Risk notes**: Big trim — care needed to preserve trigger coverage. The trimmed list keeps the 6 most-distinctive phrases.

---

### 7. azure-cost-optimization

**Current frontmatter description** (600 chars):

```text
Identify and quantify cost savings across Azure subscriptions by analyzing actual costs, utilization metrics, and generating actionable optimization recommendations. USE FOR: optimize Azure costs, reduce Azure spending, reduce Azure expenses, analyze Azure costs, find cost savings, generate cost optimization report, find orphaned resources, rightsize VMs, cost analysis, reduce waste, Azure spending analysis, find unused resources, optimize Redis costs. DO NOT USE FOR: deploying resources (use azure-deploy), general Azure diagnostics (use azure-diagnostics), security issues (use azure-security)
```

**Scoring breakdown**:

| Check | Result |
|---|---|
| description_length (150-1024) | ✓ 1.0 |
| has_use_for | ✓ 1.0 |
| has_steps | ✓ 1.0 (body has `## Steps`) |
| no_bad_patterns | ✓ 1.0 |
| has_rules | ✗ 0.0 |
| has_when | ✗ 0.0 |

**Adherence**: **Medium** — description is 84 words, over 60-word soft cap.

**Proposed before/after** (text only):

```diff
-description: "Identify and quantify cost savings across Azure subscriptions by analyzing actual costs, utilization metrics, and generating actionable optimization recommendations. USE FOR: optimize Azure costs, reduce Azure spending, reduce Azure expenses, analyze Azure costs, find cost savings, generate cost optimization report, find orphaned resources, rightsize VMs, cost analysis, reduce waste, Azure spending analysis, find unused resources, optimize Redis costs. DO NOT USE FOR: deploying resources (use azure-deploy), general Azure diagnostics (use azure-diagnostics), security issues (use azure-security)"
+description: "**ANALYSIS SKILL** — Identify cost savings across Azure subscriptions via cost + utilization analysis. WHEN: \"optimize Azure costs\", \"reduce Azure spending\", \"find cost savings\", \"rightsize VMs\", \"find orphaned resources\", \"optimize Redis costs\". USE FOR: cost reduction reports, orphaned-resource discovery, rightsizing recommendations. DO NOT USE FOR: deploying resources (use azure-deploy), general diagnostics (use azure-diagnostics), security issues (use azure-compliance)."
```

**Token delta projection**: ~ -130 chars / -30 tokens (trimmed).

**MCP integration check**: Anti-trigger references `azure-security`, but no skill of that name exists in the repo. **Bug**: should be `azure-compliance` or `entra-app-registration`. The proposed diff fixes this to `azure-compliance`.

**Risk notes**: Trim is significant (84 → ~52 words). The proposed `WHEN:` keeps the 6 most-distinctive phrases and drops near-duplicates.

## Recommended optimize order

When you're ready to optimize, suggested per-skill priority within the batch:

1. **azure-cost-optimization** — fix `azure-security` reference bug (correctness issue) + trim
2. **azure-compute** — biggest token-budget win (description trim alone ~50 tokens)
3. **azure-compliance** — clean trim, adds `USE FOR:` + prefix
4. **azure-cloud-migrate** — already 0.83; small adds push to High
5. **azure-bicep-patterns** — straightforward `WHEN:` + prefix
6. **azure-artifacts** — straightforward `WHEN:` + prefix
7. **azure-adr** — already touched; lowest delta

## Next step

This audit is read-only. **No skill files were modified.** To proceed, reply with one of:

- `optimize batch 1` — author trigger harnesses for all 7 skills, then run GEPA optimize
- `optimize <skill-name>` — same but for one skill (e.g., `optimize azure-cost-optimization`)
- `audit batch 2` — continue Phase 1 to the next batch without optimizing yet
- `audit batches 2-5` — run all remaining audits before any optimize

Per the plan, GEPA optimize requires `pip install gepa` and authoring `tests/{skill}/triggers.test.ts` for each skill. Both happen on the first `optimize` command.
