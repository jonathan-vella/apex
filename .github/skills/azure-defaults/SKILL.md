---
name: azure-defaults
description: "Azure infrastructure defaults: regions, tags, naming (CAF), AVM-first policy, security baseline, unique suffix patterns. USE FOR: any agent generating or planning Azure resources. DO NOT USE FOR: artifact template structures (use azure-artifacts), pricing lookups (read references/pricing-guidance.md on demand)."
compatibility: Works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool.
license: MIT
metadata:
  author: jonathan-vella
  version: "2.0"
  category: azure-infrastructure
---

# Azure Defaults Skill

Single source of truth for Azure infrastructure configuration.
Deep-dive content lives in `references/` — load on demand.

---

## Quick Reference (Load First)

### Default Regions

| Service             | Default Region       | Reason                         |
| ------------------- | -------------------- | ------------------------------ |
| **All resources**   | `swedencentral`      | EU GDPR-compliant              |
| **Static Web Apps** | `westeurope`         | Not available in swedencentral |
| **Failover**        | `germanywestcentral` | EU paired alternative          |

### Required Tags (Azure Policy Enforced)

**These 4 tags are the MINIMUM baseline.** Always defer to
`04-governance-constraints.md` for the actual required tag list.

| Tag           | Required | Example Values           |
| ------------- | -------- | ------------------------ |
| `Environment` | Yes      | `dev`, `staging`, `prod` |
| `ManagedBy`   | Yes      | `Bicep` or `Terraform`   |
| `Project`     | Yes      | Project identifier       |
| `Owner`       | Yes      | Team or individual name  |

> **Tag Casing Rule**: Use PascalCase exactly as shown above (`Environment`,
> `ManagedBy`, `Project`, `Owner`). Never emit both `owner` and `Owner` or
> `environment` and `Environment` in the same template — Azure Policy treats
> case-variant tag keys as ambiguous evaluation paths
> (`AmbiguousPolicyEvaluationPaths` error).

### Unique Suffix Pattern

Generate ONCE, pass to ALL modules:

```bicep
var uniqueSuffix = uniqueString(resourceGroup().id)
```

### Security Baseline (5-Line Summary)

| Setting               | Value            | Applies To       |
| --------------------- | ---------------- | ---------------- |
| HTTPS-only            | `true`           | Storage, all     |
| TLS minimum           | `'TLS1_2'`       | All services     |
| Public blob access    | `false`          | Storage          |
| Public network (prod) | `'Disabled'`     | Data services    |
| Authentication        | Managed Identity | Prefer over keys |

For AVM pitfalls and deprecation patterns, read
`references/security-baseline-full.md`.

### Deprecated Services (Do NOT Recommend for Greenfield)

| Deprecated Service     | Replacement                      | Since      | Notes                         |
| ---------------------- | -------------------------------- | ---------- | ----------------------------- |
| Azure AD B2C           | Microsoft Entra External ID      | May 2025   | Not available for new tenants |
| Redis Enterprise E50   | Azure Managed Redis (Enterprise) | March 2027 | Plan migration before EOL     |
| CDN WAF (classic)      | Front Door Standard/Premium WAF  | 2025       | CDN WAF creation blocked      |
| App Gateway v1         | App Gateway v2                   | April 2026 | Classic SKU retiring          |
| CDN Standard Microsoft | Front Door Standard              | 2027       | Migration required            |

**Rule**: Never recommend deprecated services for greenfield projects.
Before recommending any service with a multi-year RI commitment, verify
the service retirement timeline extends beyond the commitment period.
Check Microsoft Learn deprecation announcements.

---

## CAF Naming Conventions

| Resource         | Abbr    | Pattern                     | Max |
| ---------------- | ------- | --------------------------- | --- |
| Resource Group   | `rg`    | `rg-{project}-{env}`        | 90  |
| Virtual Network  | `vnet`  | `vnet-{project}-{env}`      | 64  |
| Subnet           | `snet`  | `snet-{purpose}-{env}`      | 80  |
| NSG              | `nsg`   | `nsg-{purpose}-{env}`       | 80  |
| Key Vault        | `kv`    | `kv-{short}-{env}-{suffix}` | 24  |
| Storage Account  | `st`    | `st{short}{env}{suffix}`    | 24  |
| App Service Plan | `asp`   | `asp-{project}-{env}`       | 40  |
| App Service      | `app`   | `app-{project}-{env}`       | 60  |
| SQL Server       | `sql`   | `sql-{project}-{env}`       | 63  |
| SQL Database     | `sqldb` | `sqldb-{project}-{env}`     | 128 |
| Static Web App   | `stapp` | `stapp-{project}-{env}`     | 40  |
| Log Analytics    | `log`   | `log-{project}-{env}`       | 63  |
| App Insights     | `appi`  | `appi-{project}-{env}`      | 255 |

For extended abbreviations and length-constraint examples, read
`references/naming-full-examples.md`.

---

## Azure Verified Modules (AVM)

1. **ALWAYS** check AVM availability first
2. Use AVM defaults for SKUs when available
3. **NEVER** write raw Bicep/TF for a resource that has an AVM module

For the full Bicep + Terraform AVM module registry, read
`references/avm-modules.md`.

---

## Template-First Output Rules

| Rule         | Requirement                                    |
| ------------ | ---------------------------------------------- |
| Exact text   | Use template H2 text verbatim                  |
| Exact order  | Required H2s in template-defined order         |
| Anchor rule  | Extra sections only AFTER last required H2     |
| No omissions | All template H2s must appear in output         |
| Attribution  | `> Generated by {agent} agent \| {YYYY-MM-DD}` |

---

## Validation Checklist

- [ ] Output saved to `agent-output/{project}/`
- [ ] All required H2 headings present and correctly ordered
- [ ] All 4 required tags included in resource definitions
- [ ] Unique suffix used for globally unique names
- [ ] Security baseline settings applied
- [ ] Region defaults correct

---

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                                   | When to Load                                            |
| ------------------------------------------- | ------------------------------------------------------- |
| `references/naming-full-examples.md`        | Generating names for length-constrained resources       |
| `references/avm-modules.md`                 | Looking up AVM module paths or versions                 |
| `references/security-baseline-full.md`      | Debugging AVM parameter issues or checking deprecations |
| `references/pricing-guidance.md`            | Running cost estimates with Azure Pricing MCP           |
| `references/service-matrices.md`            | Mapping user requirements to Azure service tiers        |
| `references/waf-criteria.md`                | Scoring WAF pillar assessments                          |
| `references/governance-discovery.md`        | Discovering Azure Policy constraints                    |
| `references/policy-effect-decision-tree.md` | Translating policy effects into plan/code actions       |
| `references/adversarial-review-protocol.md` | Running challenger-review-subagent passes               |
| `references/azure-cli-auth-validation.md`   | Validating Azure CLI auth before deployments            |
| `references/terraform-conventions.md`       | Generating Terraform (HCL) code                         |
| `references/research-workflow.md`           | Following the standard 4-step research pattern          |
