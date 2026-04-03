---
description: "Generate as-built documentation for an existing Azure deployment with no prior artifacts. Discovers resources, collects requirements interactively, synthesizes pseudo-artifacts, then hands off to 08-As-Built."
agent: "agent"
model: Claude Sonnet 4.6 (copilot)
tools:
  - vscode
  - execute
  - read
  - agent
  - browser
  - edit
  - search
  - web
  - "azure-mcp/*"
  - "microsoft-learn/*"
  - todo
argument-hint: "Provide subscription name/ID, resource group(s), and workload name"
---

# As-Built Documentation from Existing Azure Deployment

Generate comprehensive as-built documentation (all 7 Step-7 documents + Draw.io diagram)
for an existing Azure workload where **no prior artifacts exist** (no IaC, no requirements docs,
no architecture assessments). The agent discovers everything from the live Azure environment
and user-provided context.

## Mission

1. Collect Azure environment details and workload requirements interactively (Phases 1-3)
2. Deep-scan the deployed Azure resources to build a full inventory (Phase 4)
3. Synthesize pseudo-artifacts that replicate Steps 1-6 outputs (Phase 5)
4. Hand off to `08-As-Built` agent to generate the complete documentation suite (Phase 6)

## Scope & Preconditions

- User has Azure CLI authenticated (`az account show` succeeds)
- User has Reader access (minimum) to the target subscription and resource group(s)
- No prior `agent-output/{project}/` artifacts exist — this prompt creates them from scratch
- All 7 as-built documents + Draw.io diagram will be generated

---

## Phase 1: Environment Discovery — CALL `askQuestions` FIRST

Your very first tool call MUST be `askQuestions`. Do NOT read files, search, or run commands
before completing Phases 1-3. No exceptions.

### Round 1: Azure Environment (always ask)

Use `askQuestions` — 4 questions:

1. **Workload / Project name** — freeform text (used as `{project}` folder name under `agent-output/`)
2. **Subscription** — freeform text (name or ID, e.g., `c103c983-d48f-4c1e-b12d-c7be294bb8ff`)
3. **Resource Group(s)** — freeform text (comma-separated if multiple, e.g., `rg-app-prod, rg-shared-prod`)
4. **Brief workload description** — freeform text (1-2 sentences: what does this workload do?)

### Round 2: Deployment Context (always ask)

Use `askQuestions` — 4 questions:

1. **Deployment scenario** — options: `Greenfield deployment`, `Migrated from on-premises`,
   `Migrated from another cloud (AWS/GCP)`, `Modernized from legacy Azure setup`, `Unknown / Not sure`
2. **Environments in scope** — multiSelect: true, options: `Production`, `Staging`, `Development`, `Test`, `DR`
3. **IaC tool for future adoption** — options: `Bicep` (recommended), `Terraform`, `Neither / Not applicable`
4. **Who manages this workload?** — freeform text (team name, e.g., "Platform Engineering Team")

## Phase 2: Requirements & NFRs — CALL `askQuestions`

### Round 1: Business Requirements (always ask)

Use `askQuestions` — 5 questions:

1. **Monthly budget** — options: `< $500`, `$500 - $2,000`, `$2,000 - $10,000`, `$10,000 - $50,000`,
   `$50,000+`, plus freeform
2. **Regulatory / compliance frameworks** — multiSelect: true, options: `GDPR`, `SOC 2`, `ISO 27001`,
   `HIPAA`, `PCI-DSS`, `NIST 800-53`, `None / Unknown`, plus freeform
3. **Data sensitivity** — multiSelect: true, options: `Public data`, `Internal only`,
   `Confidential / PII`, `Highly regulated (financial, health)`, `Classified / government`
4. **Industry** — options: `Financial services`, `Healthcare`, `Retail / E-commerce`,
   `Government`, `Technology / SaaS`, `Manufacturing`, plus freeform
5. **Company size** — options: `Startup (< 50 employees)`, `SMB (50-500)`, `Enterprise (500+)`

### Round 2: Non-Functional Requirements (always ask)

Use `askQuestions` — 6 questions:

1. **RTO (Recovery Time Objective)** — options: `< 15 minutes (mission-critical)`,
   `< 1 hour`, `< 4 hours (standard)`, `< 24 hours (relaxed)`,
   `Not defined`, plus freeform
2. **RPO (Recovery Point Objective)** — options: `< 5 minutes (near-zero data loss)`,
   `< 1 hour`, `< 4 hours`, `< 12 hours (relaxed)`,
   `Not defined`, plus freeform
3. **Target SLA** — options: `99.99% (mission-critical, ~4min/month downtime)`,
   `99.9% (standard, ~43min/month)`, `99.5% (relaxed, ~3.6h/month)`,
   `Not defined`, plus freeform
4. **Transactions per second (peak)** — options: `< 100 TPS`, `100 - 1,000 TPS`,
   `1,000 - 10,000 TPS`, `10,000+ TPS`, `Not applicable / Unknown`, plus freeform
5. **Target Azure Secure Score** — options: `> 90%`, `> 80%`, `> 70%`,
   `Not tracked`, plus freeform
6. **Multi-region deployment?** — options: `Single region`,
   `Active-passive (failover)`, `Active-active (multi-region)`, `Not sure`

### Round 3: Architecture Context (always ask)

Use `askQuestions` — 3 questions:

1. **Workload pattern** — options: `N-Tier web application`, `Microservices`,
   `Event-driven / serverless`, `Data analytics / batch processing`,
   `IoT / edge`, `SPA + API backend`, `Hub-spoke networking`, `Other` (freeform)
2. **Authentication method** — options: `Microsoft Entra ID (Azure AD)`,
   `External identity provider`, `API keys / shared secrets`,
   `Managed Identity (service-to-service)`, `Mixed / Multiple`
3. **Known issues or concerns** — freeform text (optional — anything the docs should highlight:
   performance bottlenecks, security gaps, upcoming migrations, technical debt)

---

## Phase 3: Validate Azure Access

After Phases 1-2 questioning is complete, validate connectivity:

```bash
# Verify subscription access
az account set --subscription "{subscription}"
az account show --query "{name:name, id:id, state:state}" -o table

# Verify resource group access
az group show --name "{resource-group}" --query "{name:name, location:location}" -o table
```

If access fails, STOP and ask the user to authenticate (`az login`) or provide correct values.

---

## Phase 4: Deep Azure Resource Discovery

Run these commands sequentially. Capture all output for pseudo-artifact synthesis.

### 4.1 Full Resource Inventory

```bash
# List all resources with details
az resource list --resource-group "{rg}" \
  --query "[].{name:name, type:type, location:location, sku:sku, kind:kind, id:id, tags:tags}" \
  -o json

# For each additional resource group, repeat the above
```

### 4.2 Networking Configuration

```bash
# Virtual networks and subnets
az network vnet list --resource-group "{rg}" \
  --query "[].{name:name, addressSpace:addressSpace.addressPrefixes, subnets:subnets[].{name:name, prefix:addressPrefix, nsg:networkSecurityGroup.id}}" -o json

# NSGs and rules
az network nsg list --resource-group "{rg}" \
  --query "[].{name:name, rules:securityRules[].{name:name, priority:priority, direction:direction, access:access, protocol:protocol, destPort:destinationPortRange}}" -o json

# Private endpoints
az network private-endpoint list --resource-group "{rg}" \
  --query "[].{name:name, subnet:subnet.id, connections:privateLinkServiceConnections[].{service:privateLinkServiceId, groupIds:groupIds}}" -o json

# Public IPs
az network public-ip list --resource-group "{rg}" \
  --query "[].{name:name, address:ipAddress, sku:sku.name, allocation:publicIPAllocationMethod}" -o json
```

### 4.3 Security & Identity

```bash
# Role assignments on the resource group
az role assignment list --resource-group "{rg}" \
  --query "[].{principal:principalName, role:roleDefinitionName, principalType:principalType, scope:scope}" -o table

# Key Vault (if exists)
az keyvault list --resource-group "{rg}" \
  --query "[].{name:name, sku:properties.sku.name, softDelete:properties.enableSoftDelete, purgeProtection:properties.enablePurgeProtection, privateEndpoints:properties.privateEndpointConnections}" -o json

# Managed identities
az identity list --resource-group "{rg}" \
  --query "[].{name:name, principalId:principalId, clientId:clientId}" -o json
```

### 4.4 Diagnostics & Monitoring

```bash
# Diagnostic settings for each resource (sample command; iterate over resource IDs)
az monitor diagnostic-settings list --resource "{resource-id}" \
  --query "[].{name:name, logs:logs[].{category:category, enabled:enabled}, metrics:metrics[].{category:category, enabled:enabled}, workspace:workspaceId}" -o json

# Log Analytics workspaces
az monitor log-analytics workspace list --resource-group "{rg}" \
  --query "[].{name:name, sku:sku.name, retention:retentionInDays}" -o json

# Application Insights
az monitor app-insights component show --resource-group "{rg}" \
  --query "[].{name:name, instrumentationKey:instrumentationKey, connectionString:connectionString}" -o json 2>/dev/null || echo "No App Insights found"

# Alerts
az monitor metrics alert list --resource-group "{rg}" \
  --query "[].{name:name, severity:severity, enabled:enabled, criteria:criteria}" -o json 2>/dev/null || echo "No metric alerts found"
```

### 4.5 Backup & DR Configuration

```bash
# Recovery Services vaults
az backup vault list --resource-group "{rg}" \
  --query "[].{name:name, storageType:properties.storageType}" -o json 2>/dev/null || echo "No backup vaults"

# Replication status (if ASR configured)
az resource list --resource-group "{rg}" --resource-type "Microsoft.RecoveryServices/vaults" \
  --query "[].{name:name, id:id}" -o json
```

### 4.6 Tags & Governance

```bash
# Resource group tags
az group show --name "{rg}" --query "tags" -o json

# Azure Policy assignments on the subscription
az policy assignment list --scope "/subscriptions/{subscription-id}" \
  --query "[].{name:name, displayName:displayName, effect:policyDefinitionId, enforcementMode:enforcementMode}" -o table
```

### 4.7 Cost Data (Last 30 Days)

```bash
# Actual cost by service (last 30 days)
az costmanagement query --type ActualCost --scope "/subscriptions/{subscription-id}" \
  --timeframe MonthToDate --dataset-aggregation '{"totalCost":{"name":"Cost","function":"Sum"}}' \
  --dataset-grouping name="ResourceGroup" type="Dimension" \
  -o json 2>/dev/null || echo "Cost Management API not available — costs will use pricing estimates"
```

---

## Phase 5: Synthesize Pseudo-Artifacts

Using the discovered data and user answers, create these files in `agent-output/{project}/`:

### 5.1 Session State

Create `agent-output/{project}/00-session-state.json` with:

```json
{
  "project": "{project}",
  "created": "{ISO-date}",
  "updated": "{ISO-date}",
  "source": "as-built-from-azure-discovery",
  "decisions": {
    "region": "{discovered-region}",
    "iac_tool": "{user-selected}",
    "budget": "{user-stated}",
    "complexity": "{inferred}"
  },
  "steps": {
    "1": {
      "status": "complete",
      "artifacts": ["01-requirements.md"],
      "note": "Synthesized from Azure discovery"
    },
    "2": {
      "status": "complete",
      "artifacts": ["02-architecture-assessment.md"],
      "note": "Synthesized from Azure discovery"
    },
    "3": { "status": "skipped" },
    "3.5": {
      "status": "complete",
      "artifacts": ["04-governance-constraints.md"],
      "note": "Synthesized from Azure Policy scan"
    },
    "4": {
      "status": "complete",
      "artifacts": ["04-implementation-plan.md"],
      "note": "Synthesized from resource inventory"
    },
    "5": { "status": "skipped", "note": "No IaC exists" },
    "6": {
      "status": "complete",
      "artifacts": ["06-deployment-summary.md"],
      "note": "Synthesized from live resource state"
    },
    "7": { "status": "pending" }
  }
}
```

### 5.2 Requirements (01-requirements.md)

Synthesize from user answers (Phases 1-2). Include:

- Business context, workload description, industry, company size
- NFRs: RTO, RPO, SLA, TPS, budget, secure score target
- Compliance frameworks selected by the user
- Region (from discovered resources), IaC tool preference
- `iac_tool: {Bicep|Terraform}` metadata line
- Workload pattern and authentication method
- Service scope: list all Azure service types discovered in Phase 4

### 5.3 Architecture Assessment (02-architecture-assessment.md)

Synthesize from discovered resource configuration. For each WAF pillar, assess:

- **Security**: TLS settings, private endpoints, managed identity usage, NSG rules, Key Vault
- **Reliability**: Zone redundancy, backup configuration, replication, SLA alignment
- **Performance**: SKU tiers, scaling configuration, caching, CDN
- **Cost Optimization**: SKU appropriateness vs stated budget, reserved instances, right-sizing
- **Operational Excellence**: Diagnostics, monitoring, tagging compliance, IaC coverage

Use resource discovery data from Phase 4. Score each pillar 1-5 based on observed configuration.

### 5.4 Governance Constraints (04-governance-constraints.md)

Populate from Azure Policy scan (Phase 4.6). List:

- Active policy assignments with effects (Deny, Audit, DeployIfNotExists)
- Relevant constraints for the workload (allowed regions, required tags, denied SKUs)

### 5.5 Implementation Plan (04-implementation-plan.md)

Reverse-engineer from the discovered resources:

- Resource dependency tree (which resources reference which)
- Network topology (VNets, subnets, NSGs, private endpoints)
- Service configuration summary per resource

### 5.6 Deployment Summary (06-deployment-summary.md)

Generate from live state:

- List every resource with: name, type, SKU, location, resource ID, provisioning state
- Resource group name, subscription, deployment region
- Tag compliance status
- Mark deployment status as "Existing — discovered via Azure CLI"

### 5.7 Project README

Create `agent-output/{project}/README.md` with workflow progress showing Steps 1-6 as
synthesized/complete and Step 7 as pending.

---

## Phase 6: Hand Off to 08-As-Built

After all pseudo-artifacts are saved, delegate to the `08-As-Built` agent:

> **Handoff prompt to `08-As-Built`:**
>
> Generate the complete Step 7 documentation suite for the `{project}` project.
> Prior artifacts (Steps 1, 2, 4, 6) have been synthesized from live Azure
> resource discovery and saved to `agent-output/{project}/`. No IaC templates
> exist — use Azure CLI queries for resource details. The workload runs in
> subscription `{subscription}`, resource group(s) `{resource-groups}`.
> Read all prior artifacts and generate all 7 documentation files plus
> the Draw.io as-built diagram.

The `08-As-Built` agent will produce:

- `07-resource-inventory.md`
- `07-design-document.md`
- `07-ab-cost-estimate.md`
- `07-compliance-matrix.md`
- `07-backup-dr-plan.md`
- `07-operations-runbook.md`
- `07-documentation-index.md`
- `07-ab-diagram.drawio`

---

## Output Expectations

All files saved to `agent-output/{project}/`:

| File                            | Source      | Content                                    |
| ------------------------------- | ----------- | ------------------------------------------ |
| `00-session-state.json`         | This prompt | Workflow state with Steps 1-6 synthesized  |
| `01-requirements.md`            | This prompt | Requirements from user answers             |
| `02-architecture-assessment.md` | This prompt | WAF assessment from discovered state       |
| `04-governance-constraints.md`  | This prompt | Azure Policy constraints                   |
| `04-implementation-plan.md`     | This prompt | Reverse-engineered from resource inventory |
| `06-deployment-summary.md`      | This prompt | Live resource state snapshot               |
| `README.md`                     | This prompt | Project dashboard                          |
| `07-*.md` (7 files)             | 08-As-Built | Full documentation suite                   |
| `07-ab-diagram.drawio`          | 08-As-Built | Architecture diagram                       |

## Quality Assurance

- Pseudo-artifacts must follow the H2 structure from `azure-artifacts` templates
- All Azure resource data must come from live `az` CLI queries — never fabricated
- NFR values must come from user answers — never assumed
- The handoff to `08-As-Built` must include subscription and resource group details
- Final validation: `npm run lint:artifact-templates` must pass for all `agent-output/{project}/` files
