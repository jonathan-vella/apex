---
name: azure-defaults
description: '**UTILITY SKILL** — Azure infrastructure defaults: regions, tags, naming (CAF), AVM-first policy, security baseline, unique suffix patterns. WHEN: "Azure naming convention", "CAF naming", "resource tags", "AVM module", "security baseline", "region default". USE FOR: any agent generating or planning Azure resources. DO NOT USE FOR: artifact template structures (use azure-artifacts), pricing lookups (read references/pricing-guidance.md on demand).'
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

Azure AD B2C, Redis Enterprise E50, CDN WAF (classic), App Gateway v1, and CDN Standard
Microsoft are all in retirement timelines. Never recommend deprecated services for
greenfield projects; for the full table with replacement guidance and EOL dates, read
[`references/deprecated-services.md`](references/deprecated-services.md).

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

## Rules

- **AVM-first is non-negotiable** — NEVER write raw Bicep/Terraform for a resource that has an AVM module available
- **Default region** is `swedencentral` (EU GDPR-compliant); fail over to `germanywestcentral`; use `westeurope` for Static Web Apps
- **Required tags** (PascalCase, exact casing): `Environment`, `ManagedBy`, `Project`, `Owner` — always defer to `04-governance-constraints.md` for the project's actual required tag list
- **Tag casing is case-sensitive** — never emit both `owner` and `Owner` in the same template (`AmbiguousPolicyEvaluationPaths` error)
- **Unique suffix** — generate `uniqueString(resourceGroup().id)` ONCE per deployment and pass to all modules
- **Security baseline** is non-negotiable: HTTPS-only, TLS 1.2 minimum, no public blob, public network disabled for prod data services, Managed Identity over keys
- **Never recommend deprecated services for greenfield** — Azure AD B2C, CDN WAF classic, App Gateway v1, Redis Enterprise E50; verify retirement timeline against multi-year RI commitments
- **CAF naming** — follow the abbreviation + length-cap table; load `references/naming-full-examples.md` when generating length-constrained names

## Steps

Applying defaults when generating Azure infrastructure:

1. **Read Quick Reference** — confirm region, tags, suffix, and security baseline match this skill
2. **Cross-check governance** — read `04-governance-constraints.md` for project-specific tag and policy requirements
3. **Pick AVM modules** — query the AVM registry for every resource type before writing raw Bicep/Terraform
4. **Apply naming** — use the CAF abbreviations table; load `references/naming-full-examples.md` for length-constrained resources
5. **Apply tags** — emit all 4 required tags (PascalCase) on every taggable resource
6. **Apply security baseline** — wire HTTPS-only, TLS 1.2, no public blob, Managed Identity, public network access settings
7. **Validate** — run `npm run validate:iac-security-baseline` and the appropriate `lint:bicep` / `terraform fmt && validate`

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

## Gotchas

- **Tag casing is case-sensitive** — Use PascalCase exactly: `Environment`,
  `ManagedBy`, `Project`, `Owner`. Never emit both `owner` and `Owner` in the
  same template — Azure Policy treats case-variant keys as ambiguous →
  `AmbiguousPolicyEvaluationPaths` error.
- **Never recommend deprecated services for greenfield** — Azure AD B2C
  (retired May 2025), CDN WAF classic, App Gateway v1, etc. Check the
  Deprecated Services list in Quick Reference.
- **AVM-first is non-negotiable** — NEVER write raw Bicep/Terraform for a
  resource that has an AVM module available.

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
