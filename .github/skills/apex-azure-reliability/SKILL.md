---
name: apex-azure-reliability
user-invocable: true
disable-model-invocation: false
argument-hint: "resource group, subscription or app name to assess"
description: '**ANALYSIS SKILL** — Read-only reliability assessment for App Service and Azure Functions: zone redundancy, ZRS storage, health probes and multi-region failover. WHEN: "assess reliability", "zone redundant", "multi-region failover", "single points of failure", "disaster recovery readiness". DO NOT USE FOR: fixes or deploys (06b/06t), troubleshooting (apex-azure-diagnostics).'
license: MIT
metadata:
  author: Microsoft
  version: "1.1.1"
---

# Azure Reliability Assessment

Adapted from upstream `azure-reliability`. This skill assesses the reliability
posture of deployed **App Service** and **Azure Functions** resources and returns
findings. It never changes resources, patches IaC or deploys: fixes flow through
05-IaC Planner and 06b/06t.

## Quick Reference

| Property           | Details                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Best for           | Reliability findings for 08-As-Built and 09-Diagnose                           |
| Supported services | Azure Functions, App Service (Container Apps: noted, not assessed)             |
| Query method       | Azure Resource Graph (`az graph query`, needs the `resource-graph` extension)  |
| Permissions        | Reader on the target scope                                                     |
| Failover region    | `germanywestcentral` (APEX default), primary `swedencentral`                   |

## MCP Tools

| Tool                                   | Purpose                                             |
| -------------------------------------- | --------------------------------------------------- |
| `mcp_azure-mcp_extension_cli_generate` | Generate read-only `az` commands for resource queries |
| `mcp_azure-mcp_subscription_list`      | List available subscriptions                        |
| `mcp_azure-mcp_group_list`             | List resource groups                                |

## Rules

1. Scope every query to the user's resource group (`| where resourceGroup =~ '<rg-name>'`), subscription
   (`--subscriptions <sub-id>`) or app (`| where name =~ '<app-name>'`).
2. Run read-only commands only. Record each gap as a finding with the target setting from the service reference.
3. Never print app setting values or connection strings; query setting names only.
4. Resources without a service reference (Container Apps and others) are listed as `⚪ not assessed` — never
   invent commands or settings for them.
5. Don't assign numeric scores or grades. Price plan or redundancy changes only through `cost-estimate-subagent`.

## Assessment Workflow

### Phase 1: Discover Resources

1. Identify the scope (resource group, subscription or app name).
2. Query Azure Resource Graph for every resource in scope.
3. Classify resources by service type; note unsupported compute without a deep dive.

### Phase 2: Assess Reliability

**Platform discovery first:**

| Platform check                                     | Reference                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| Zone redundancy — discovery                        | [zone-redundancy-checks.md](references/zone-redundancy-checks.md)         |
| Storage redundancy (cross-service)                 | [storage-redundancy-checks.md](references/storage-redundancy-checks.md)   |
| Multi-region and global load balancers             | [multi-region-checks.md](references/multi-region-checks.md)               |
| Front Door / Traffic Manager / App Insights probes | [health-probe-checks.md](references/health-probe-checks.md)               |

**Then a per-service deep dive:**

| Service detected                                                                     | Reference                                                                     |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Azure Functions (`microsoft.web/serverfarms` with `kind contains 'functionapp'`)     | [services/functions/reliability.md](references/services/functions/reliability.md) |
| App Service (`microsoft.web/sites` and `microsoft.web/serverfarms` without `functionapp`) | [services/app-service/reliability.md](references/services/app-service/reliability.md) |
| Container Apps (`microsoft.app/containerapps`, `microsoft.app/managedenvironments`)  | ⚪ Not assessed                                                                |

### Phase 3: Build the Reliability Checklist

Present a **feature-pivoted** table with four rows in this order: Zone redundancy — compute, Zone-redundant
storage, Health probes, Multi-region failover. Each row has one status and the relevant resources:

- `🟢 ON` — enabled on every relevant resource; `🟡 PARTIAL` — some resources or partial configuration;
  `🔴 OFF` — missing everywhere. For storage, show the SKU instead of `OFF` (`🔴 LRS`, `🔴 GRS`, `🟢 ZRS`, `🟢 GZRS`).
- List only relevant resources, one bullet each, with a short reason (`(FC1)`, `(defaulted; no SKU set)`).
  Credit resources that are already compliant with `— already ON`.
- Drop a row only when no resource in scope could apply to it. No `n/a` cells.

```text
Reliability Assessment — {scope}
Reliability Feature          Status      Resources
Zone redundancy — compute    🔴 OFF      • plan-web-{suffix} (P1v3)
Zone-redundant storage       🔴 GRS      • st{suffix} (defaulted; no SKU set in IaC)
Health probes                🟡 PARTIAL  • app-web-{suffix} — already ON
                                         • func-api-{suffix} — needs code change (FC1)
Multi-region failover        🔴 OFF      • Single region (swedencentral) — Front Door not configured
```

## Priority Classification

| Priority | Criteria                                           | Owner action                        |
| -------- | -------------------------------------------------- | ----------------------------------- |
| Critical | No zone redundancy AND production workload         | Raise with the IaC owner now        |
| High     | LRS storage on zone-redundant compute              | Plan the change within days         |
| Medium   | Single region but zone-redundant                   | Plan for the next change window     |
| Low      | Missing health probes or monitoring gaps           | Track and fix                       |

## Reliability Findings

Return findings to the calling agent; never write a standalone reliability artifact.

| Caller      | Artifact                     | Sections that receive findings                                                                                              |
| ----------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 08-As-Built | `07-backup-dr-plan.md`       | Executive Summary availability row; 1. Recovery Objectives; 2. Backup Strategy; 3. Disaster Recovery Procedures; 4. Testing Schedule |
| 08-As-Built | `07-design-document.md`      | 8. Backup & Disaster Recovery                                                                                               |
| 09-Diagnose | `08-resource-health-report.md` | Issues Identified (by severity); Prevention Recommendations; Next Steps                                                   |

Each finding states the resource, the current state, the target setting and its priority. Multi-region designs
go to 05-IaC Planner as a recommendation; don't start multi-region work without explicit user consent.

## Error Handling

| Error                     | Remediation                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| Authentication required   | Ask the user to run `az login` locally, then retry                 |
| Access denied             | Confirm a Reader role assignment on the scope                      |
| Plan doesn't support ZR   | Record the plan upgrade path; price it through `cost-estimate-subagent` |
| Region doesn't support AZ | Record the limitation; suggest a zone-capable region               |

## Reference Index

| Reference                                        | When to Load                                        |
| ------------------------------------------------ | --------------------------------------------------- |
| `references/zone-redundancy-checks.md`           | Compute zone redundancy discovery                   |
| `references/storage-redundancy-checks.md`        | Storage replication checks and targets              |
| `references/multi-region-checks.md`              | Multi-region deployment and global load balancers   |
| `references/health-probe-checks.md`              | Front Door, Traffic Manager and App Insights probes |
| `references/services/functions/reliability.md`   | Azure Functions plan rules and targets              |
| `references/services/app-service/reliability.md` | App Service plan rules and targets                  |
