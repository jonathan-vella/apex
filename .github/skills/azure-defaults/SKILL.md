---
name: azure-defaults
description: Provides Azure defaults for naming, regions, tags, AVM-first modules, security baselines, WAF criteria, governance discovery, and pricing guidance across all agents.
compatibility: Works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool.
license: MIT
metadata:
  author: jonathan-vella
  version: "1.0"
  category: azure-infrastructure
---

# Azure Defaults Skill

Single source of truth for all Azure infrastructure configuration used across agents.
Replaces individual `_shared/` file lookups with one consolidated reference.

---

## Quick Reference (Load First)

### Default Regions

| Service             | Default Region       | Reason                              |
| ------------------- | -------------------- | ----------------------------------- |
| **All resources**   | `swedencentral`      | EU GDPR-compliant                   |
| **Static Web Apps** | `westeurope`         | Not available in swedencentral      |
| **Azure OpenAI**    | `swedencentral`      | Limited availability — verify first |
| **Failover**        | `germanywestcentral` | EU paired alternative               |

### Required Tags (Azure Policy Enforced)

| Tag           | Required | Example Values           |
| ------------- | -------- | ------------------------ |
| `Environment` | Yes      | `dev`, `staging`, `prod` |
| `ManagedBy`   | Yes      | `Bicep`                  |
| `Project`     | Yes      | Project identifier       |
| `Owner`       | Yes      | Team or individual name  |

Bicep pattern:

```bicep
tags: {
  Environment: environment
  ManagedBy: 'Bicep'
  Project: projectName
  Owner: owner
}
```

### Unique Suffix Pattern

Generate ONCE in `main.bicep`, pass to ALL modules:

```bicep
// main.bicep
var uniqueSuffix = uniqueString(resourceGroup().id)

module keyVault 'modules/key-vault.bicep' = {
  params: { uniqueSuffix: uniqueSuffix }
}
```

### Security Baseline

| Setting                    | Value               | Applies To                        |
| -------------------------- | ------------------- | --------------------------------- |
| `supportsHttpsTrafficOnly` | `true`              | Storage accounts                  |
| `minimumTlsVersion`        | `'TLS1_2'`          | All services                      |
| `allowBlobPublicAccess`    | `false`             | Storage accounts                  |
| `publicNetworkAccess`      | `'Disabled'` (prod) | Data services                     |
| Authentication             | Managed Identity    | Prefer over keys/strings          |
| SQL Auth                   | Azure AD-only       | `azureADOnlyAuthentication: true` |

---

## CAF Naming Conventions

### Standard Abbreviations

| Resource         | Abbreviation | Name Pattern                | Max Length |
| ---------------- | ------------ | --------------------------- | ---------- |
| Resource Group   | `rg`         | `rg-{project}-{env}`        | 90         |
| Virtual Network  | `vnet`       | `vnet-{project}-{env}`      | 64         |
| Subnet           | `snet`       | `snet-{purpose}-{env}`      | 80         |
| NSG              | `nsg`        | `nsg-{purpose}-{env}`       | 80         |
| Key Vault        | `kv`         | `kv-{short}-{env}-{suffix}` | **24**     |
| Storage Account  | `st`         | `st{short}{env}{suffix}`    | **24**     |
| App Service Plan | `asp`        | `asp-{project}-{env}`       | 40         |
| App Service      | `app`        | `app-{project}-{env}`       | 60         |
| SQL Server       | `sql`        | `sql-{project}-{env}`       | 63         |
| SQL Database     | `sqldb`      | `sqldb-{project}-{env}`     | 128        |
| Static Web App   | `stapp`      | `stapp-{project}-{env}`     | 40         |
| CDN / Front Door | `fd`         | `fd-{project}-{env}`        | 64         |
| Log Analytics    | `log`        | `log-{project}-{env}`       | 63         |
| App Insights     | `appi`       | `appi-{project}-{env}`      | 255        |
| Container App    | `ca`         | `ca-{project}-{env}`        | 32         |
| Container Env    | `cae`        | `cae-{project}-{env}`       | 60         |
| Cosmos DB        | `cosmos`     | `cosmos-{project}-{env}`    | 44         |
| Service Bus      | `sb`         | `sb-{project}-{env}`        | 50         |

### Length-Constrained Resources

Key Vault and Storage Account have 24-char limits. Always include `uniqueSuffix`:

```bicep
// Key Vault: kv-{8chars}-{3chars}-{6chars} = 21 chars max
var kvName = 'kv-${take(projectName, 8)}-${take(environment, 3)}-${take(uniqueSuffix, 6)}'

// Storage: st{8chars}{3chars}{6chars} = 19 chars max (no hyphens!)
var stName = 'st${take(replace(projectName, '-', ''), 8)}${take(environment, 3)}${take(uniqueSuffix, 6)}'
```

### Naming Rules

- **DO**: Use lowercase with hyphens (`kv-myapp-dev-abc123`)
- **DO**: Include `uniqueSuffix` in globally unique names (Key Vault, Storage, SQL Server)
- **DO**: Use `take()` to truncate long names within limits
- **DON'T**: Use hyphens in Storage Account names (only lowercase + numbers)
- **DON'T**: Hardcode unique values — always derive from `uniqueString(resourceGroup().id)`
- **DON'T**: Exceed max length — Bicep won't warn, deployment will fail

---

## Azure Verified Modules (AVM)

### AVM-First Policy

1. **ALWAYS** check AVM availability first via `mcp_bicep_list_avm_metadata`
2. Use AVM module defaults for SKUs when available
3. If custom SKU needed, require live deprecation research
4. **NEVER** hardcode SKUs without validation
5. **NEVER** write raw Bicep for a resource that has an AVM module

### Common AVM Modules

| Resource           | Module Path                                        | Min Version |
| ------------------ | -------------------------------------------------- | ----------- |
| Key Vault          | `br/public:avm/res/key-vault/vault`                | `0.11.0`    |
| Virtual Network    | `br/public:avm/res/network/virtual-network`        | `0.5.0`     |
| Storage Account    | `br/public:avm/res/storage/storage-account`        | `0.14.0`    |
| App Service Plan   | `br/public:avm/res/web/serverfarm`                 | `0.4.0`     |
| App Service        | `br/public:avm/res/web/site`                       | `0.12.0`    |
| SQL Server         | `br/public:avm/res/sql/server`                     | `0.10.0`    |
| Log Analytics      | `br/public:avm/res/operational-insights/workspace` | `0.9.0`     |
| App Insights       | `br/public:avm/res/insights/component`             | `0.4.0`     |
| NSG                | `br/public:avm/res/network/network-security-group` | `0.5.0`     |
| Static Web App     | `br/public:avm/res/web/static-site`                | `0.4.0`     |
| Container App      | `br/public:avm/res/app/container-app`              | `0.11.0`    |
| Container Env      | `br/public:avm/res/app/managed-environment`        | `0.8.0`     |
| Cosmos DB          | `br/public:avm/res/document-db/database-account`   | `0.10.0`    |
| Front Door         | `br/public:avm/res/cdn/profile`                    | `0.7.0`     |
| Service Bus        | `br/public:avm/res/service-bus/namespace`          | `0.10.0`    |
| Container Registry | `br/public:avm/res/container-registry/registry`    | `0.6.0`     |

### Finding Latest AVM Version

```
// Use Bicep MCP tool:
mcp_bicep_list_avm_metadata → filter by resource type → use latest version

// Or check: https://aka.ms/avm/index
```

### AVM Usage Pattern

```bicep
module keyVault 'br/public:avm/res/key-vault/vault:0.11.0' = {
  name: '${kvName}-deploy'
  params: {
    name: kvName
    location: location
    tags: tags
    enableRbacAuthorization: true
    enablePurgeProtection: true
  }
}
```

---

## AVM Known Pitfalls

### Region Limitations

| Service         | Limitation                                                                  | Workaround                                |
| --------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| Static Web Apps | Only 5 regions: `westus2`, `centralus`, `eastus2`, `westeurope`, `eastasia` | Use `westeurope` for EU                   |
| Azure OpenAI    | Limited regions per model                                                   | Check availability before planning        |
| Container Apps  | Most regions but not all                                                    | Verify `cae` environment in target region |

### Parameter Type Mismatches

Known issues when using AVM modules — verify before coding:

**Log Analytics Workspace** (`operational-insights/workspace`):

- `dailyQuotaGb` is `int` in AVM, not `string`
- **DO**: `dailyQuotaGb: 5`
- **DON'T**: `dailyQuotaGb: '5'`

**Container Apps Managed Environment** (`app/managed-environment`):

- `appLogsConfiguration` deprecated in newer versions
- **DO**: Use `logsConfiguration` with destination object
- **DON'T**: Use `appLogsConfiguration.destination: 'log-analytics'`

**Container Apps** (`app/container-app`):

- `scaleSettings` is an object, not array of rules
- **DO**: Check AVM schema for exact object shape
- **DON'T**: Assume `scaleRules: [...]` array format

**SQL Server** (`sql/server`):

- `sku` parameter is a typed object `{name, tier, capacity}`
- **DO**: Pass full SKU object matching schema
- **DON'T**: Pass just string `'S0'`
- `availabilityZone` requires specific format per region

**App Service** (`web/site`):

- `APPINSIGHTS_INSTRUMENTATIONKEY` deprecated
- **DO**: Use `APPLICATIONINSIGHTS_CONNECTION_STRING` instead
- **DON'T**: Set instrumentation key directly

**Key Vault** (`key-vault/vault`):

- `softDeleteRetentionInDays` is immutable after creation
- **DO**: Set correctly on first deploy (default: 90)
- **DON'T**: Try to change after vault exists

**Static Web App** (`web/static-site`):

- Free SKU may not be deployable via ARM in all regions
- **DO**: Use `Standard` SKU for reliable ARM deployment
- **DON'T**: Assume Free tier works everywhere via Bicep

---

## WAF Assessment Criteria

### Scoring Scale

| Score | Definition                                  |
| ----- | ------------------------------------------- |
| 9-10  | Exceeds best practices, production-ready    |
| 7-8   | Meets best practices with minor gaps        |
| 5-6   | Adequate but improvements needed            |
| 3-4   | Significant gaps, address before production |
| 1-2   | Critical deficiencies, not production-ready |

### Pillar Definitions

| Pillar      | Icon | Focus Areas                                              |
| ----------- | ---- | -------------------------------------------------------- |
| Security    | 🔒   | Identity, network, data protection, threat detection     |
| Reliability | 🔄   | SLA, redundancy, disaster recovery, health monitoring    |
| Performance | ⚡   | Response time, scalability, caching, load testing        |
| Cost        | 💰   | Right-sizing, reserved instances, monitoring spend       |
| Operations  | 🔧   | IaC, CI/CD, monitoring, incident response, documentation |

### Assessment Rules

- **DO**: Score each pillar 1-10 with confidence level (High/Medium/Low)
- **DO**: Identify specific gaps with remediation recommendations
- **DO**: Calculate composite WAF score as average of all pillars
- **DON'T**: Give perfect 10/10 scores without exceptional justification
- **DON'T**: Skip any pillar even if requirements seem light
- **DON'T**: Provide generic recommendations — be specific to the workload

---

## Azure Pricing MCP Service Names

Exact names for the Azure Pricing MCP tool. Using wrong names returns 0 results.

| Azure Service    | Correct `service_name`  | Common SKUs                                |
| ---------------- | ----------------------- | ------------------------------------------ |
| SQL Database     | `SQL Database`          | `Basic`, `Standard`, `S0`, `S1`, `Premium` |
| App Service      | `Azure App Service`     | `B1`, `S1`, `P1v3`, `P1v4`                 |
| Container Apps   | `Azure Container Apps`  | `Consumption`                              |
| Service Bus      | `Service Bus`           | `Basic`, `Standard`, `Premium`             |
| Key Vault        | `Key Vault`             | `Standard`                                 |
| Storage          | `Storage`               | `Standard`, `Premium`, `LRS`, `GRS`        |
| Virtual Machines | `Virtual Machines`      | `D4s_v5`, `B2s`, `E4s_v5`                  |
| Static Web Apps  | `Azure Static Web Apps` | `Free`, `Standard`                         |
| Cosmos DB        | `Azure Cosmos DB`       | `Serverless`, `Provisioned`                |
| Front Door       | `Azure Front Door`      | `Standard`, `Premium`                      |

- **DO**: Use exact names from the table above
- **DON'T**: Use "Azure SQL" (returns 0 results) — use "SQL Database"
- **DON'T**: Use "Web App" — use "Azure App Service"

---

## Service Recommendation Matrix

### Workload Patterns

| Pattern           | Cost-Optimized Tier        | Balanced Tier                    | Enterprise Tier                         |
| ----------------- | -------------------------- | -------------------------------- | --------------------------------------- |
| **Static Site**   | SWA Free + Blob            | SWA Std + CDN + KV               | SWA Std + FD + KV + Monitor             |
| **API-First**     | App Svc B1 + SQL Basic     | App Svc S1 + SQL S1 + KV         | App Svc P1v3 + SQL Premium + APIM       |
| **N-Tier Web**    | App Svc B1 + SQL Basic     | App Svc S1 + SQL S1 + Redis + KV | App Svc P1v4 + SQL Premium + Redis + FD |
| **Serverless**    | Functions Consumption      | Functions Premium + CosmosDB     | Functions Premium + CosmosDB + APIM     |
| **Container**     | Container Apps Consumption | Container Apps + ACR + KV        | AKS + ACR + KV + Monitor                |
| **Data Platform** | SQL Basic + Blob           | Synapse Serverless + ADLS        | Synapse Dedicated + ADLS + Purview      |

### Detection Signals

Map user language to workload pattern:

| User Says                              | Likely Pattern |
| -------------------------------------- | -------------- |
| "website", "landing page", "blog"      | Static Site    |
| "REST API", "microservices", "backend" | API-First      |
| "web app", "portal", "dashboard"       | N-Tier Web     |
| "event-driven", "triggers", "webhooks" | Serverless     |
| "Docker", "Kubernetes", "containers"   | Container      |
| "analytics", "data warehouse", "ETL"   | Data Platform  |

### Business Domain Signals

| Industry          | Common Compliance | Default Security                      |
| ----------------- | ----------------- | ------------------------------------- |
| Healthcare        | HIPAA             | Private endpoints, encryption at rest |
| Financial         | PCI-DSS, SOC 2    | WAF, private endpoints, audit logging |
| Government        | FedRAMP, IL4/5    | Azure Gov, private endpoints          |
| Retail/E-commerce | PCI-DSS           | WAF, DDoS protection                  |
| Education         | FERPA             | Data residency, access controls       |

### Company Size Heuristics

| Size                | Budget Signal  | Default Tier   | Security Posture       |
| ------------------- | -------------- | -------------- | ---------------------- |
| Startup (<50)       | "$50-200/mo"   | Cost-Optimized | Basic managed identity |
| Mid-Market (50-500) | "$500-2000/mo" | Balanced       | Private endpoints, KV  |
| Enterprise (500+)   | "$2000+/mo"    | Enterprise     | Full WAF compliance    |

### Industry Compliance Pre-Selection

| Industry   | Auto-Select                       |
| ---------- | --------------------------------- |
| Healthcare | HIPAA checkbox, private endpoints |
| Finance    | PCI-DSS + SOC 2, WAF required     |
| Government | Data residency, enhanced audit    |
| Retail     | PCI-DSS if payments, DDoS         |

---

## Governance Discovery

### MANDATORY Gate

Governance discovery is a **hard gate**. If Azure connectivity is unavailable or policies cannot
be fully retrieved (including management group-inherited), STOP and inform the user.
Do NOT proceed to implementation planning with incomplete policy data.

### Discovery Commands (Ordered by Completeness)

**1. REST API (MANDATORY — includes management group-inherited policies)**:

```bash
SUB_ID=$(az account show --query id -o tsv)
az rest --method GET \
  --url "https://management.azure.com/subscriptions/\
${SUB_ID}/providers/Microsoft.Authorization/\
policyAssignments?api-version=2022-06-01" \
  --query "value[].{name:name, \
displayName:properties.displayName, \
scope:properties.scope, \
enforcementMode:properties.enforcementMode, \
policyDefinitionId:properties.policyDefinitionId}" \
  -o json
```

> [!CAUTION]
> `az policy assignment list` only returns subscription-scoped assignments.
> Management group policies (often Deny/tag enforcement) are invisible to it.
> **ALWAYS use the REST API above as the primary discovery method.**

**2. Policy Definition Drill-Down (for each Deny/DeployIfNotExists)**:

```bash
# For built-in or subscription-scoped policies
az policy definition show --name "{guid}" \
  --query "{displayName:displayName, \
effect:policyRule.then.effect, \
conditions:policyRule.if}" -o json

# For management-group-scoped custom policies
az policy definition show --name "{guid}" \
  --management-group "{mgId}" \
  --query "{displayName:displayName, \
effect:policyRule.then.effect}" -o json

# For policy set definitions (initiatives)
az policy set-definition show --name "{guid}" \
  --query "{displayName:displayName, \
policyCount:policyDefinitions | length(@)}" -o json
```

**3. ARG KQL (supplemental — subscription-scoped only)**:

```kusto
PolicyResources
| where type == 'microsoft.authorization/policyassignments'
| where properties.enforcementMode == 'Default'
| project name, displayName=properties.displayName,
  effect=properties.parameters.effect.value,
  scope=properties.scope
| order by name asc
```

### Azure Policy Discovery Workflow

Before creating implementation plans, discover active policies:

```
1. Verify Azure connectivity: az account show
2. REST API: Get ALL effective policy assignments (subscription + MG inherited)
3. Compare count with Azure Portal (Policy > Assignments) — must match
4. For each Deny/DeployIfNotExists: drill into policy definition JSON
5. Check tag enforcement policies (names containing 'tag' or 'Tag')
6. Check allowed resource types and locations
7. Document ALL findings in 04-governance-constraints.md
```

### Common Policy Constraints

| Policy             | Impact                          | Solution                              |
| ------------------ | ------------------------------- | ------------------------------------- |
| Required tags      | Deployment fails without tags   | Include all 4 required tags           |
| Allowed locations  | Resources rejected outside list | Use `swedencentral` default           |
| SQL AAD-only auth  | SQL password auth blocked       | Use `azureADOnlyAuthentication: true` |
| Storage shared key | Shared key access denied        | Use managed identity RBAC             |
| Zone redundancy    | Non-zonal SKUs rejected         | Use P1v4+ for App Service Plans       |

---

## Research Workflow (All Agents)

### Standard 4-Step Pattern

1. **Validate Prerequisites** — Confirm previous artifact exists. If missing, STOP.
2. **Read Agent Context** — Read previous artifact for context. Read template for H2 structure.
3. **Domain-Specific Research** — Query ONLY for NEW information not in artifacts.
4. **Confidence Gate (80% Rule)** — Proceed at 80%+ confidence. Below 80%, ASK user.

### Confidence Levels

| Level           | Indicators                  | Action                                      |
| --------------- | --------------------------- | ------------------------------------------- |
| High (80-100%)  | All critical info available | Proceed                                     |
| Medium (60-79%) | Some assumptions needed     | Document assumptions, ask for critical gaps |
| Low (0-59%)     | Major gaps                  | STOP — request clarification                |

### Context Reuse Rules

- **DO**: Read previous agent's artifact for context
- **DO**: Cache shared defaults (read once per session)
- **DO**: Query external sources only for NEW information
- **DON'T**: Re-query Azure docs for resources already in artifacts
- **DON'T**: Search workspace repeatedly (context flows via artifacts)
- **DON'T**: Re-validate previous agent's work (trust artifact chain)

### Agent-Specific Research Focus

| Agent        | Primary Research                      | Skip (Already in Artifacts)      |
| ------------ | ------------------------------------- | -------------------------------- |
| Requirements | User needs, business context          | —                                |
| Architect    | WAF gaps, SKU comparisons, pricing    | Service list (from 01)           |
| Bicep Plan   | AVM availability, governance policies | Architecture decisions (from 02) |
| Bicep Code   | AVM schemas, parameter types          | Resource list (from 04)          |
| Deploy       | Azure state (what-if), credentials    | Template structure (from 05)     |

---

## Service Lifecycle Validation

### AVM Default Trust

When using AVM modules with default SKU parameters:

- Trust the AVM default — Microsoft maintains these
- No additional deprecation research needed for defaults
- If overriding SKU parameter, run deprecation research

### Deprecation Research (For Non-AVM or Custom SKUs)

| Source            | Query Pattern                                              | Reliability |
| ----------------- | ---------------------------------------------------------- | ----------- |
| Azure Updates     | `azure.microsoft.com/updates/?query={service}+deprecated`  | High        |
| Microsoft Learn   | Check "Important" / "Note" callouts on service pages       | High        |
| Azure CLI         | `az provider show --namespace {provider}` for API versions | Medium      |
| Resource Provider | Check available SKUs in target region                      | High        |

### Known Deprecation Patterns

| Pattern                    | Status            | Replacement           |
| -------------------------- | ----------------- | --------------------- |
| "Classic" anything         | DEPRECATED        | ARM equivalents       |
| CDN `Standard_Microsoft`   | DEPRECATED 2027   | Azure Front Door      |
| App Gateway v1             | DEPRECATED        | App Gateway v2        |
| "v1" suffix services       | Likely deprecated | Check for v2          |
| Old API versions (2020-xx) | Outdated          | Use latest stable API |

### What-If Deprecation Signals

Deploy agent should scan what-if output for:
`deprecated|sunset|end.of.life|no.longer.supported|classic.*not.*supported|retiring`

If detected, STOP and report before deployment.

---

## Template-First Output Rules

### Mandatory Compliance

| Rule         | Requirement                                            |
| ------------ | ------------------------------------------------------ |
| Exact text   | Use template H2 text verbatim                          |
| Exact order  | Required H2s appear in template-defined order          |
| Anchor rule  | Extra sections allowed only AFTER last required H2     |
| No omissions | All template H2s must appear in output                 |
| Attribution  | Include `> Generated by {agent} agent \| {YYYY-MM-DD}` |

### Output Location

All agent outputs go to `agent-output/{project}/`:

| Step | Output File                      | Agent                   |
| ---- | -------------------------------- | ----------------------- |
| 1    | `01-requirements.md`             | Requirements            |
| 2    | `02-architecture-assessment.md`  | Architect               |
| 3    | `03-des-*.{py,md}`               | Design                  |
| 4    | `04-implementation-plan.md`      | Bicep Plan              |
| 4    | `04-governance-constraints.md`   | Bicep Plan              |
| 4    | `04-preflight-check.md`          | Bicep Code (pre-flight) |
| 5    | `05-implementation-reference.md` | Bicep Code              |
| 6    | `06-deployment-summary.md`       | Deploy                  |
| 7    | `07-*.md` (7 documents)          | azure-artifacts skill   |

### Header Format

```markdown
# Step {N}: {Title} - {project-name}

> Generated by {agent} agent | {YYYY-MM-DD}
```

---

## Validation Checklist

Before completing any agent task, verify:

- [ ] Output file saved to `agent-output/{project}/`
- [ ] All required H2 headings from template are present
- [ ] H2 headings match template text exactly
- [ ] All 4 required tags included in resource definitions
- [ ] Unique suffix used for globally unique names
- [ ] Security baseline settings applied
- [ ] Region defaults correct (swedencentral, or exception documented)
- [ ] Attribution header included with agent name and date
