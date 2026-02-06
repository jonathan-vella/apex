# Shared Agent Configuration

This file contains shared configuration values that all agents should reference to maintain consistency.

> **Note**: Agents should import these defaults rather than duplicating them.
>
> **⚠️ See Also**: [AVM Pitfalls](./avm-pitfalls.md) for known AVM parameter issues and region limitations.

## Default Regions

| Purpose              | Region               | Location             | Rationale                                 |
| -------------------- | -------------------- | -------------------- | ----------------------------------------- |
| **Primary**          | `swedencentral`      | Sweden Central       | EU GDPR compliant, sustainable operations |
| **Alternative**      | `germanywestcentral` | Germany West Central | German data residency requirements        |
| **Preview Features** | `eastus`             | East US              | Early access to new Azure features        |

### Region Limitations (IMPORTANT)

Some Azure services do not support all regions:

| Service            | Supported Regions                                 | Default for EU  |
| ------------------ | ------------------------------------------------- | --------------- |
| **Static Web App** | westus2, centralus, eastus2, westeurope, eastasia | `westeurope`    |
| **Azure OpenAI**   | Limited - check Azure docs                        | `swedencentral` |

**Action**: When planning Static Web Apps, hardcode `westeurope` region, not the location parameter.

### Region Selection Guidelines

- **Default (no constraints)**: Use `swedencentral`
- **German data residency**: Use `germanywestcentral`
- **Swiss banking/healthcare**: Use `switzerlandnorth`
- **UK GDPR requirements**: Use `uksouth`
- **APAC latency optimization**: Use `southeastasia`

## Required Tags

All Azure resources MUST include these tags:

| Tag            | Required | Description            | Example                              |
| -------------- | -------- | ---------------------- | ------------------------------------ |
| `Environment`  | ✅ Yes   | Deployment environment | `dev`, `staging`, `prod`             |
| `ManagedBy`    | ✅ Yes   | IaC tool used          | `Bicep`, `ARM`                       |
| `Project`      | ✅ Yes   | Project identifier     | `ecommerce`, `patient-portal`        |
| `Owner`        | ✅ Yes   | Team or individual     | `platform-team`, `john.doe`          |
| `CostCenter`   | Optional | Billing allocation     | `CC-12345`                           |
| `WorkloadType` | Optional | Resource category      | `app`, `data`, `network`, `security` |
| `Backup`       | Optional | Enable VM auto-backup  | `true` (triggers Azure Policy)       |

### Bicep Tag Pattern

```bicep
var tags = {
  Environment: environment
  ManagedBy: 'Bicep'
  Project: projectName
  Owner: owner
  CostCenter: costCenter
  DeploymentDate: utcNow('yyyy-MM-dd')
}
```

## CAF Naming Conventions

Follow Cloud Adoption Framework pattern: `{type}-{workload}-{env}-{region}-{instance}`

### Region Abbreviations

| Region             | Abbreviation |
| ------------------ | ------------ |
| swedencentral      | `swc`        |
| germanywestcentral | `gwc`        |
| westeurope         | `weu`        |
| northeurope        | `neu`        |
| eastus             | `eus`        |
| eastus2            | `eus2`       |
| westus2            | `wus2`       |

### Resource Type Prefixes

| Resource Type          | Prefix  | Example                 |
| ---------------------- | ------- | ----------------------- |
| Resource Group         | `rg-`   | `rg-ecommerce-prod-swc` |
| Virtual Network        | `vnet-` | `vnet-hub-prod-swc-001` |
| Subnet                 | `snet-` | `snet-web-prod-swc`     |
| Network Security Group | `nsg-`  | `nsg-web-prod-swc`      |
| Key Vault              | `kv-`   | `kv-app-dev-swc-a1b2c3` |
| Storage Account        | `st`    | `steabordevswca1b2c3`   |
| App Service            | `app-`  | `app-api-prod-swc`      |
| App Service Plan       | `asp-`  | `asp-web-prod-swc`      |
| Azure SQL Server       | `sql-`  | `sql-crm-prod-swc-main` |
| Log Analytics          | `log-`  | `log-platform-prod-swc` |
| Application Insights   | `appi-` | `appi-web-prod-swc`     |

## Azure Pricing MCP - Service Name Reference

When using Azure Pricing MCP tools (`azure_price_search`, `azure_cost_estimate`), use these **exact** service names:

| Azure Service    | Correct `service_name`  | Common SKUs                                | Notes                  |
| ---------------- | ----------------------- | ------------------------------------------ | ---------------------- |
| SQL Database     | `SQL Database`          | `Basic`, `Standard`, `S0`, `S1`, `Premium` | Not "Azure SQL"        |
| App Service      | `Azure App Service`     | `B1`, `S1`, `P1v3`, `P1v4`                 | Include "Azure" prefix |
| Container Apps   | `Azure Container Apps`  | `Consumption`                              | Include "Azure" prefix |
| Service Bus      | `Service Bus`           | `Basic`, `Standard`, `Premium`             | No prefix              |
| Key Vault        | `Key Vault`             | `Standard`                                 | No prefix              |
| Storage          | `Storage`               | `Standard`, `Premium`, `LRS`, `GRS`        | General category       |
| Virtual Machines | `Virtual Machines`      | `D4s_v5`, `B2s`, `E4s_v5`                  | No "Azure" prefix      |
| Log Analytics    | `Log Analytics`         | Per-GB ingestion pricing                   | Or `Azure Monitor`     |
| Static Web Apps  | `Azure Static Web Apps` | `Free`, `Standard`                         | Include "Azure" prefix |
| Cosmos DB        | `Azure Cosmos DB`       | `Serverless`, `Provisioned`                | Include "Azure" prefix |

### Tier Keywords

Use tier keywords (`Basic`, `Standard`, `Premium`, `Free`, `Consumption`) directly as `sku_name`.
The MCP automatically searches both `productName` and `skuName` fields for these.

### Example Queries

```python
# Correct usage
azure_price_search(service_name="SQL Database", sku_name="Basic", region="swedencentral")
azure_price_search(service_name="Azure App Service", sku_name="B1", region="swedencentral")
azure_price_search(service_name="Service Bus", sku_name="Basic", region="swedencentral")

# Incorrect - will return 0 results
azure_price_search(service_name="Azure SQL", sku_name="Basic")  # Wrong service name
azure_price_search(service_name="Container Apps", sku_name="Consumption")  # Missing "Azure" prefix
```

## Azure Verified Modules (AVM)

**MANDATORY: MUST use AVM modules for all resources where available.**

Raw Bicep resources are only permitted when:

1. No AVM module exists for the resource type (verified at https://aka.ms/avm/index)
2. User explicitly types "approve raw bicep" when prompted
3. The rationale is documented in the implementation plan/reference

### AVM Approval Workflow

| Step | Action                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------- |
| 1    | Check `mcp_bicep_list_avm_metadata` or https://aka.ms/avm/index for module availability                           |
| 2    | If AVM exists: Use `br/public:avm/res/{service}/{resource}:{version}`                                             |
| 3    | If no AVM: **STOP** and prompt user: "No AVM module found for {resource}. Type **approve raw bicep** to proceed." |
| 4    | If approved: Document justification in implementation artifacts                                                   |

### AVM Registry

- **Registry**: `br/public:avm/res/*`
- **Documentation**: https://aka.ms/avm
- **GitHub**: https://github.com/Azure/bicep-registry-modules/tree/main/avm/res
- **Module Index**: https://aka.ms/avm/index

### Common AVM Modules (Verified January 2025)

| Resource         | Module Path                                        | Min Version | Notes                          |
| ---------------- | -------------------------------------------------- | ----------- | ------------------------------ |
| Key Vault        | `br/public:avm/res/key-vault/vault`                | `0.11.0`    | Includes PE, RBAC, diagnostics |
| Virtual Network  | `br/public:avm/res/network/virtual-network`        | `0.5.0`     | Subnet delegation support      |
| NSG              | `br/public:avm/res/network/network-security-group` | `0.4.0`     | Inline security rules          |
| Storage Account  | `br/public:avm/res/storage/storage-account`        | `0.14.0`    | HNS, PE, lifecycle             |
| App Service      | `br/public:avm/res/web/site`                       | `0.12.0`    | VNet integration, slots        |
| App Service Plan | `br/public:avm/res/web/serverfarm`                 | `0.4.0`     | Zone redundancy (P1v3+)        |
| SQL Server       | `br/public:avm/res/sql/server`                     | `0.10.0`    | AAD-only auth, TDE             |
| SQL Database     | `br/public:avm/res/sql/server/database`            | `0.8.0`     | Elastic pool support           |
| Log Analytics    | `br/public:avm/res/operational-insights/workspace` | `0.9.0`     | Retention policies             |
| App Insights     | `br/public:avm/res/insights/component`             | `0.4.0`     | LA workspace integration       |
| Redis Cache      | `br/public:avm/res/cache/redis`                    | `0.5.0`     | PE, clustering                 |
| Cosmos DB        | `br/public:avm/res/document-db/database-account`   | `0.10.0`    | Multi-region, CMK              |
| Event Hubs       | `br/public:avm/res/event-hub/namespace`            | `0.7.0`     | Capture, PE                    |
| Service Bus      | `br/public:avm/res/service-bus/namespace`          | `0.10.0`    | Premium tier, PE               |
| Static Web App   | `br/public:avm/res/web/static-site`                | `0.5.0`     | Custom domains                 |
| Front Door       | `br/public:avm/res/cdn/profile`                    | `0.7.0`     | WAF integration                |

> **⚠️ Version Freshness**: Versions shown are minimums verified as of January 2025.
> Always check the [AVM Module Index](https://aka.ms/avm/index) for latest versions before implementation.

### How to Find Latest Versions

**PREFERRED: Use MCP Tool (Automated)**

```bash
# Call mcp_bicep_list_avm_metadata to get all AVM versions
# Returns JSON with modulePath, versions[], and documentationUri
# Latest version = LAST element in the versions array
```

**Version Extraction Pattern:**

```json
{
  "modulePath": "avm/res/storage/storage-account",
  "versions": ["0.8.0", "0.9.0", ..., "0.31.0"],  // ← 0.31.0 is latest
  "documentationUri": "https://..."
}
```

**Fallback Methods:**

1. **AVM Index**: https://aka.ms/avm/index (searchable catalog)
2. **GitHub Changelog**: Each module has a CHANGELOG.md in its folder
3. **Bicep Registry**: `bicep restore` will fetch available versions
4. **VS Code**: Bicep extension provides version intellisense

### Automated Version Checks

- **GitHub Actions**: `.github/workflows/avm-version-check.yml` runs weekly
- **Agent Handoff**: Use "▶ Refresh AVM Versions" in Bicep Plan agent
- **GATE CHECK**: Agents MUST call `mcp_bicep_list_avm_metadata` before planning

## Well-Architected Framework (WAF) Pillars

### Scoring Guidelines

| Score | Rating    | Description                                            |
| ----- | --------- | ------------------------------------------------------ |
| 9-10  | Excellent | Follows all best practices, near-production-ready      |
| 7-8   | Good      | Follows most best practices, minor improvements needed |
| 5-6   | Adequate  | Meets basic requirements, notable gaps exist           |
| 3-4   | Poor      | Significant issues, requires major improvements        |
| 1-2   | Critical  | Fundamental problems, not recommended for production   |

### Pillar Definitions

| Pillar                     | Focus Areas                                             |
| -------------------------- | ------------------------------------------------------- |
| **Security**               | Identity, data protection, network security, governance |
| **Reliability**            | Resiliency, availability, disaster recovery, monitoring |
| **Performance Efficiency** | Scalability, capacity planning, optimization            |
| **Cost Optimization**      | Resource optimization, monitoring, governance           |
| **Operational Excellence** | DevOps, automation, monitoring, management              |

## Security Defaults

All implementations MUST include:

| Setting                    | Value         | Purpose                      |
| -------------------------- | ------------- | ---------------------------- |
| `supportsHttpsTrafficOnly` | `true`        | Enforce HTTPS                |
| `minimumTlsVersion`        | `TLS1_2`      | Modern TLS only              |
| `allowBlobPublicAccess`    | `false`       | No public blob access        |
| `publicNetworkAccess`      | `Disabled`    | Private endpoints preferred  |
| Managed Identities         | Preferred     | Over connection strings/keys |
| Private Endpoints          | Required      | For data services            |
| NSG deny rules             | Priority 4096 | Deny-by-default networking   |

## Template-First Output Generation

All agents generating workflow artifacts MUST follow the template-first approach:

### Before Generating Output

1. **Read the template file** - Load `../templates/{artifact}.template.md`
2. **Extract H2 headings** - Note exact text and order of required sections
3. **Prepare content** - Organize responses to fit the template structure

### Output Structure Rules

| Rule            | Requirement                                        | Example                                         |
| --------------- | -------------------------------------------------- | ----------------------------------------------- |
| **Exact text**  | Use template's H2 text verbatim                    | `## Approval Gate` not `## Approval Checkpoint` |
| **Exact order** | Required H2s appear in template-defined sequence   | Overview → Inventory → Tasks                    |
| **Anchor rule** | Extra sections allowed only AFTER last required H2 | Add `## References` after `## Approval Gate`    |
| **Attribution** | Include agent name and date in header              | `> Generated by {agent} agent \| {YYYY-MM-DD}`  |

### Attribution Header Format

```markdown
# Step N: {Artifact Title} - {project-name}

> Generated by {agent-name} agent | {YYYY-MM-DD}
> **Confidence Level**: {High|Medium|Low}
```

### Validation

All generated artifacts are validated by:

- **Pre-commit hook**: `STRICTNESS=standard npm run lint:wave1-artifacts`
- **CI workflow**: `.github/workflows/wave1-artifact-drift-guard.yml`
- **Project-specific**: `npm run validate:{project-name}` (if available)

## Governance Discovery (MANDATORY for Bicep Plan)

**CRITICAL**: Governance constraints MUST be discovered from Azure Resource Graph, NOT assumed.

### Why This Matters

Assumed governance causes deployment failures:

| Assumed                                         | Discovered               | Result               |
| ----------------------------------------------- | ------------------------ | -------------------- |
| 4 tags (Environment, ManagedBy, Project, Owner) | 9 tags from Azure Policy | ❌ Deployment denied |

### Discovery Workflow

Before creating `04-governance-constraints.md`, execute these Azure Resource Graph queries:

1. **Query all Policy Assignments** with effects and enforcement mode
2. **Query Tag Policies** with actual parameter values (tag names)
3. **Query Security Policies** for TLS, HTTPS, encryption requirements

### Required Output

`04-governance-constraints.md` MUST include:

```markdown
## Discovery Source

| Query              | Results               | Timestamp  |
| ------------------ | --------------------- | ---------- |
| Policy Assignments | X policies discovered | {ISO-8601} |
| Tag Policies       | X tags required       | {ISO-8601} |
```

See full instructions: [governance-discovery.instructions.md](../../instructions/governance-discovery.instructions.md)

## Research Requirements (MANDATORY)

**All agents MUST perform thorough research before implementation** to ensure complete,
one-shot execution without missing context or requiring multiple iterations.

### Pre-Implementation Research Checklist

Before creating ANY output files or making changes:

- [ ] **Search workspace** for existing patterns (`agent-output/`, similar projects)
- [ ] **Read relevant templates** in `.github/templates/` for output structure
- [ ] **Query documentation** via MCP tools (Azure docs, best practices)
- [ ] **Validate inputs** - confirm all required artifacts from previous steps exist
- [ ] **Achieve 80% confidence** before proceeding to implementation

### Research Workflow Pattern

```xml
<research_mandate>
MANDATORY: Before producing output artifacts, run comprehensive research.

Step 1: Context Gathering
- Use semantic_search, grep_search, read_file to gather workspace context
- Use Azure MCP tools to query documentation and best practices
- Read template files to understand output structure

Step 2: Validation Gate
- Confirm required inputs from previous workflow steps exist
- Verify template has been loaded
- Check Azure guidance has been obtained

Step 3: Confidence Assessment
- Only proceed when you have 80% confidence in context understanding
- If below 80%, use #tool:agent to delegate autonomous research
- Or ASK the user for clarification rather than assuming
</research_mandate>
```

### Delegation Pattern

When extensive research is needed, delegate to a subagent:

```markdown
MANDATORY: Run #tool:agent tool, instructing the agent to work autonomously
without pausing for user feedback, to gather comprehensive context.
```

## Service Recommendation Matrix

Use this matrix when recommending Azure services based on workload patterns.
Present options to the user via `askQuestions` for confirmation.

### Workload Pattern → Service Options

| Workload Pattern | Option A (Cost-Optimized) | Option B (Balanced) | Option C (Enterprise) |
|------------------|---------------------------|---------------------|-----------------------|
| **Static Site / SPA** | Static Web App Free | Static Web App Standard + CDN | Front Door + Blob Storage + CDN |
| **N-Tier Web App** | App Service B1 + Azure SQL Basic | App Service S1 + Azure SQL S1 + Redis | App Service P1v3 + Azure SQL P1 + Redis + Front Door |
| **API-First / Microservices** | Container Apps Consumption | Container Apps Dedicated + API Management Basic | AKS + API Management Standard + Service Bus |
| **Event-Driven / Serverless** | Functions Consumption + Event Grid | Functions Premium + Service Bus + Event Grid | Functions Premium + Event Hubs + APIM + Logic Apps |
| **Data Platform / Analytics** | Azure SQL Basic + Blob Storage | Synapse Serverless + Data Factory + SQL Managed Instance | Synapse Dedicated + Data Factory + Databricks + Purview |
| **IoT / Edge** | IoT Hub Free + Stream Analytics | IoT Hub S1 + Stream Analytics + Time Series Insights | IoT Hub S3 + Digital Twins + Event Hubs + Databricks |

### Tier Indicators

| Tier | Monthly Range | Characteristics |
|------|--------------|-----------------|
| 💰 Cost-Optimized | $0–50/mo | Shared/consumption SKUs, minimal redundancy |
| ⚖️ Balanced | $50–500/mo | Dedicated compute, basic HA, staging slots |
| 🏢 Enterprise | $500+/mo | Zone-redundant, premium SKUs, full WAF stack |

### Detection Signals

Use these signals to identify workload patterns during requirements discovery:

| Signal | Suggests Pattern |
|--------|-----------------|
| "static site", "SPA", "React/Vue/Angular", "no backend" | Static Site / SPA |
| "web app + database", "CRUD", "admin portal", "3-tier" | N-Tier Web App |
| "APIs", "microservices", "containers", "multiple services" | API-First / Microservices |
| "triggers", "events", "queue processing", "scheduled jobs" | Event-Driven / Serverless |
| "analytics", "data warehouse", "ETL", "reporting" | Data Platform / Analytics |
| "devices", "sensors", "telemetry", "edge computing" | IoT / Edge |

### Business Domain Signals

When users describe their project in business terms (not technical), use these
signals to **infer** the workload pattern. Present the inference as a recommendation
for user confirmation — do not ask the user to self-classify into technical categories.

| Business Signal | Inferred Pattern | Confidence |
|----------------|-----------------|------------|
| "ecommerce", "online store", "shopping cart", "product catalog" | N-Tier Web App | High |
| "customer portal", "patient portal", "employee portal" | N-Tier Web App | High |
| "CRM", "ERP", "internal tool", "admin panel", "back-office" | N-Tier Web App | High |
| "company website", "marketing site", "landing page", "blog" | Static Site / SPA | High |
| "documentation site", "portfolio", "brochure site" | Static Site / SPA | High |
| "order processing", "payment processing", "invoice automation" | Event-Driven / N-Tier | Medium |
| "notification system", "email campaigns", "scheduling" | Event-Driven / Serverless | Medium |
| "data warehouse", "business intelligence", "KPI dashboard" | Data Platform / Analytics | High |
| "reporting", "data lake", "ETL pipeline" | Data Platform / Analytics | High |
| "mobile app backend", "REST API", "multi-tenant SaaS" | API-First / Microservices | High |
| "chatbot", "AI assistant", "recommendation engine" | API-First / Microservices | Medium |
| "fleet management", "sensor monitoring", "smart building" | IoT / Edge | High |
| "migrate from on-prem", "modernize legacy", "lift and shift" | (use follow-up questions) | Low |
| "replace existing system", "re-platform" | (use follow-up questions) | Low |

**Low-confidence signals** (migration/modernization): When the user mentions migration
or modernization, you MUST ask follow-up questions about the current system before
inferring a pattern. Migration source determines target pattern:

| Migration Source | Typical Target Pattern |
|-----------------|----------------------|
| On-prem web app + SQL Server | N-Tier Web App |
| Legacy APIs / SOA services | API-First / Microservices |
| File-based data processing | Event-Driven / Serverless |
| On-prem data warehouse | Data Platform / Analytics |
| WordPress / Drupal / static sites | Static Site / SPA |
| Custom industrial / SCADA systems | IoT / Edge |

### Company Size Heuristics

Use company size to suggest appropriate default budget tier and scale expectations.
These are starting points — always confirm with the user.

| Company Size | Typical Budget Tier | Default User Scale | Notes |
|-------------|--------------------|--------------------|-------|
| Startup / Small (< 50 employees) | Cost-Optimized | < 1,000 users | Consumption-based, minimal redundancy |
| Mid-Market (50-500 employees) | Balanced | 1,000-10,000 users | Dedicated compute, staging environments |
| Enterprise (500+ employees) | Enterprise | 10,000+ users | Zone-redundant, premium SKUs, full WAF |

### Industry Compliance Mapping

When a user mentions their industry, pre-select applicable compliance frameworks
using `recommended: true` in askQuestions options.

| Industry | Primary Frameworks | Additional Considerations |
|----------|-------------------|--------------------------|
| Retail / Ecommerce | PCI-DSS, GDPR (if EU) | Payment processing, customer PII |
| Healthcare | HIPAA, GDPR (if EU) | PHI data, audit logging |
| Financial Services | SOC 2, PCI-DSS, GDPR (if EU) | Transaction integrity, encryption at rest |
| Government / Public Sector | ISO 27001, SOC 2 | Data sovereignty, air-gapped options |
| Education | GDPR (if EU), FERPA (if US) | Student data protection |
| General / Technology | GDPR (if EU), SOC 2 | Standard security baseline |

### Per-Agent Research Focus

| Agent            | Primary Research Focus                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| **Requirements** | User needs, existing projects, compliance requirements                        |
| **Architect**    | Azure services, WAF pillars, SKU recommendations, pricing                     |
| **Bicep Plan**   | AVM availability, **Azure Policy discovery via ARG**, implementation patterns |
| **Bicep Code**   | Module structure, naming conventions, security defaults                       |
| **Deploy**       | Template validation, what-if results, resource dependencies                   |
| **Diagram**      | Existing architecture, icon availability, layout patterns                     |
| **Docs**         | Deployed resources, configuration details, operational procedures             |

See also: [Agent Research Instructions](../../instructions/agent-research-first.instructions.md)
