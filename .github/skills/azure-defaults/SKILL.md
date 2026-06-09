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

IaC-flavoured mirror of the canonical Azure defaults declared in
[`.github/copilot-instructions.md`](../../copilot-instructions.md#azure-defaults-canonical).
Deep-dive content lives in `references/` — load on demand.

> **Canonical source rule**: if the tables below disagree with
> [`copilot-instructions.md`](../../copilot-instructions.md#azure-defaults-canonical),
> the canonical declaration wins. This skill restates them for IaC-output
> convenience only.

---

## Quick Reference (Load First)

### Default Regions

| Service             | Default Region       | Reason                         |
| ------------------- | -------------------- | ------------------------------ |
| **All resources**   | `swedencentral`      | EU GDPR-compliant              |
| **Static Web Apps** | `westeurope`         | Not available in swedencentral |
| **Failover**        | `germanywestcentral` | EU paired alternative          |

### Required Tags (Azure Policy Enforced)

**These 9 lowercase tags are the APEX baseline** — they mirror the
org-wide resource-group tag-deny policy (every key must exist on the RG
or the deployment is denied). Use lowercase keys (mixing `owner` +
`Owner` triggers `AmbiguousPolicyEvaluationPaths`). Always defer to
`04-governance-constraints.md` for the project's actual required list —
discovered policy always wins.

| Tag                 | Required | Example Values           |
| ------------------- | -------- | ------------------------ |
| `environment`       | Yes      | `dev`, `staging`, `prod` |
| `owner`             | Yes      | `team-platform@…`        |
| `costcenter`        | Yes      | `cc-12345`               |
| `application`       | Yes      | `mindthehack`            |
| `workload`          | Yes      | `apex-aks`               |
| `sla`               | Yes      | `production`, `dev`      |
| `backup-policy`     | Yes      | `daily-35d`, `none`      |
| `maint-window`      | Yes      | `sat-02:00-04:00`        |
| `technical-contact` | Yes      | `alerts@…`               |

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

### Cost Monitoring Baseline

Non-negotiable for prod. Governance (`04-governance-constraints.json`
`cost_monitoring.*`) always wins. Budget thresholds: 5 notifications
(actual 80/100/125 + forecast 100/125). Required: budget + Action Group
(AVM, create-or-reuse via preflight) + subscription-scoped anomaly alert.
Opt-out via `cost_monitoring_mode ∈ {enforced, minimal, deferred}`
(`minimal`/`deferred` non-prod only).

For the full contract, AVM lookup, governance precedence, and exception
schema, read [`references/cost-alerts-baseline.md`](references/cost-alerts-baseline.md).
For stack-specific snippets, read
[`references/cost-alerts-bicep.md`](references/cost-alerts-bicep.md) or
[`references/cost-alerts-terraform.md`](references/cost-alerts-terraform.md).

### VNet Planning Baseline

Interactive. Architect Phase 6b (between 6a SKU confirmation and Step 7
pricing) runs the gate whenever **either** trigger holds:
(a) any `services[].requires[]` row contains `vnet-integration` or
`private-endpoints`, OR (b) any `services[].service_name` is in the
vnet-attached whitelist (App Gateway, AKS, VM/VMSS, APIM internal,
Bastion, Azure Firewall, VPN/ER Gateway, NAT Gateway, App Gateway for
Containers). Default address space `10.0.0.0/16` (greenfield;
at least `/22`). Recommendation style: a single subnet table followed
by per-row `Apply edit / Skip / Done` askMe loop. Opt-out via
`vnet_planning_mode ∈ {guided, fast, deferred}` (`deferred` blocked
for prod). Governance `network_constraints` always wins.

For the full contract — trigger contract, askQuestions templates,
subnet sizing matrix per workload with Microsoft Learn citations,
CIDR math, existing-VNet validation, AVM modules — read
[`references/vnet-planning.md`](references/vnet-planning.md).

### Deprecated Services (Do NOT Recommend for Greenfield)

Never recommend deprecated services (Azure AD B2C, Redis Enterprise E50,
CDN WAF classic, App Gateway v1, CDN Standard Microsoft) for greenfield.
Full retirement table + replacement guidance:
[`references/deprecated-services.md`](references/deprecated-services.md).

### Engine / Runtime Version Currency

For any managed service with a selectable engine or runtime version
(MySQL / PostgreSQL, Redis, AKS Kubernetes version, Cosmos API, App
Service runtime), pin the **latest GA LTS** version and confirm it
against the service's version-support policy at plan time. Two failure
modes to avoid:

- **Retiring versions** carried over from an older template (e.g. MySQL
  `8.0`, whose standard support ends 2026-04-30). The version literal is
  a creative decision — resolve it live, don't copy it from a prior
  project.
- **Innovation / preview releases** (e.g. MySQL `9.x`) for durable data
  workloads. Innovation releases exclude HA, replicas, and automated
  backups and have a short server lifecycle.

Example: MySQL Flexible Server → `version: '8.4'` (GA LTS → 8.4.x), not
the retiring `8.0` or the innovation `9.x`. A major-version change on an
**existing** server is a separate concern — see
[`iac-common/known-deploy-issues.md`](../iac-common/references/known-deploy-issues.md).

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
2. **ALWAYS pin to the latest published stable version** — resolve live
   at plan time; never reuse a pin from a prior project or training data
3. Use AVM defaults for SKUs when available
4. **NEVER** write raw Bicep/TF for a resource that has an AVM module

For module paths, the live-lookup procedure (MCR for Bicep,
`registry.terraform.io` for Terraform, MCP equivalents), the validator
(`npm run validate:avm-versions:freeze` — MUST run before
`apex-recall complete-step 4`), and the structured `pin_policy` schema
for stale-pin exceptions, read
[`references/avm-modules.md`](references/avm-modules.md).

---

## Rules

All baseline rules (region, tags, security, cost monitoring, deprecated
services) are stated in **Quick Reference** above — that is the canonical
form. The invariants below are gate-level / non-negotiable:

- **AVM-first** — never write raw Bicep/TF for a resource that has an AVM module
- **Pin AVM live at plan time** — stale pins require `pin_policy.mode = "exception"` in `04-iac-contract.json`; enforced by `npm run validate:avm-versions:freeze`
- **Tag casing is case-sensitive** — never emit both `owner` and `Owner` (`AmbiguousPolicyEvaluationPaths` error)
- **Unique suffix** — generate `uniqueString(resourceGroup().id)` ONCE per deployment
- **Governance wins** — `04-governance-constraints.md` overrides any default in this skill (tags, regions, SKUs, cost monitoring)
- **VNet planning is interactive** — never auto-pick CIDRs without confirmation.
  Trigger: any `services[].requires[] ∈ {vnet-integration, private-endpoints}` **OR**
  `services[].service_name` in vnet-attached whitelist. Governance
  `network_constraints` overrides defaults. Contract:
  [`references/vnet-planning.md`](references/vnet-planning.md).

## Steps

1. **Read Quick Reference** — region, tags, suffix, security baseline
2. **Cross-check governance** — `04-governance-constraints.md` overrides defaults
3. **Pick AVM modules** — resolve the latest stable version live (see [`references/avm-modules.md`](references/avm-modules.md))
4. **Apply naming + tags** — CAF table above; load [`references/naming-full-examples.md`](references/naming-full-examples.md) for length-constrained resources
5. **Apply security baseline** — see Quick Reference; load [`references/security-baseline-full.md`](references/security-baseline-full.md) when AVM parameters surface deprecation
6. **Run the VNet planning gate** — when the trigger contract holds (see VNet Planning Baseline above). Skip when `decisions.vnet_planning_mode = deferred` (sandbox only). Contract: [`references/vnet-planning.md`](references/vnet-planning.md)
7. **Apply cost monitoring** — see Quick Reference; load [`references/cost-alerts-baseline.md`](references/cost-alerts-baseline.md) for the full cost contract
8. **Validate** — `npm run validate:iac-security-baseline` + `lint:bicep` / `terraform fmt && validate`

---

## Output Rules & Checklist

| Rule         | Requirement                                    |
| ------------ | ---------------------------------------------- |
| Exact text   | Use template H2 text verbatim                  |
| Exact order  | Required H2s in template-defined order         |
| Anchor rule  | Extra sections only AFTER last required H2     |
| No omissions | All template H2s must appear in output         |
| Attribution  | `> Generated by {agent} agent \| {YYYY-MM-DD}` |

Before saving: confirm output path is `agent-output/{project}/`, all 4
required tags are present, `uniqueSuffix` is wired into globally-unique
names, and region defaults match the table above.

---

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                                   | When to Load                                            |
| ------------------------------------------- | ------------------------------------------------------- |
| `references/naming-full-examples.md`        | Generating names for length-constrained resources       |
| `references/avm-modules.md`                 | Looking up AVM module paths or versions                 |
| `references/security-baseline-full.md`      | Debugging AVM parameter issues or checking deprecations |
| `references/pricing-guidance.md`            | Running cost estimates with Azure Pricing MCP           |
| `references/cost-estimate-parent-contract.md` | Parent-side delegation contract for `cost-estimate-subagent` (loaded by 03 + 08) |
| `references/service-matrices.md`            | Mapping user requirements to Azure service tiers        |
| `references/waf-criteria.md`                | Scoring WAF pillar assessments                          |
| `references/governance-discovery.md`        | Discovering Azure Policy constraints                    |
| `references/policy-effect-decision-tree.md` | Translating policy effects into plan/code actions       |
| `references/adversarial-review-protocol.md` | Running challenger-review-subagent passes               |
| `references/azure-cli-auth-validation.md`   | Validating Azure CLI auth before deployments            |
| `references/terraform-conventions.md`       | Generating Terraform (HCL) code                         |
| `references/research-workflow.md`           | Following the standard 4-step research pattern          |
| `references/tag-strategy.md`                | Choosing the greenfield CAF tag fallback (no policy)    |
| `references/workflow-gates.md`              | Looking up cross-agent gate protocols (SKU/budget/etc.) |
| `references/cost-alerts-baseline.md`        | Full cost-monitoring contract (scope matrix, modes, governance) |
| `references/cost-alerts-bicep.md`           | Bicep snippets for budget + Action Group + scheduledActions |
| `references/cost-alerts-terraform.md`       | Terraform snippets for budget + Action Group + anomaly  |
| `references/vnet-planning.md`               | VNet planning gate — trigger contract, askQuestions templates, subnet sizing matrix |
