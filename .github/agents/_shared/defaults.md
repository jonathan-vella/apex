# Shared Agent Configuration

This file contains shared configuration values that all agents should reference to maintain consistency.

> **Note**: Agents should import these defaults rather than duplicating them.

## Default Regions

| Purpose              | Region               | Location             | Rationale                                 |
| -------------------- | -------------------- | -------------------- | ----------------------------------------- |
| **Primary**          | `swedencentral`      | Sweden Central       | EU GDPR compliant, sustainable operations |
| **Alternative**      | `germanywestcentral` | Germany West Central | German data residency requirements        |
| **Preview Features** | `eastus`             | East US              | Early access to new Azure features        |

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

1. **AVM Index**: https://aka.ms/avm/index (searchable catalog)
2. **GitHub Changelog**: Each module has a CHANGELOG.md in its folder
3. **Bicep Registry**: `bicep restore` will fetch available versions
4. **VS Code**: Bicep extension provides version intellisense

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

### Per-Agent Research Focus

| Agent            | Primary Research Focus                                            |
| ---------------- | ----------------------------------------------------------------- |
| **Requirements** | User needs, existing projects, compliance requirements            |
| **Architect**    | Azure services, WAF pillars, SKU recommendations, pricing         |
| **Bicep Plan**   | AVM availability, governance constraints, implementation patterns |
| **Bicep Code**   | Module structure, naming conventions, security defaults           |
| **Deploy**       | Template validation, what-if results, resource dependencies       |
| **Diagram**      | Existing architecture, icon availability, layout patterns         |
| **Docs**         | Deployed resources, configuration details, operational procedures |

See also: [Agent Research Instructions](../instructions/agent-research-first.instructions.md)
