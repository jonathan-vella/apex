---
mode: agent
description: Implements Phase 1 — Instructions, Skills & Dual-Field Governance. Creates Terraform instructions, terraform-patterns skill, updates azure-defaults, and migrates governance-discovery to dual-field output.
---

# Phase 1 — Instructions, Skills & Governance

## Context Load

Read these files before starting:

1. `docs/tf-support/PROGRESS.md` — confirm Phase 1 is active, check which items remain
2. `.github/instructions/governance-discovery.instructions.md` — current state
3. `.github/agents/_subagents/governance-discovery-subagent.agent.md` — current state
4. `.github/instructions/bicep-code-best-practices.instructions.md` — template to adapt
5. `.github/instructions/bicep-policy-compliance.instructions.md` — template to adapt
6. `.github/skills/azure-bicep-patterns/SKILL.md` — template to adapt
7. `.github/skills/azure-defaults/SKILL.md` — where to add Terraform section
8. `docs/tf-support/SKILL.md` — AzureRM pitfalls reference (research material)
9. `docs/tf-support/terraform-azure-planning.agent.md` — AVM-TF reference patterns
10. `docs/tf-support/mcp-tools.md` — if Phase 0 item 0.8 was completed

Work through unchecked items only.

## Item 1.9 — Update `governance-discovery.instructions.md`

Locate the `applyTo` frontmatter line. Change from:

```yaml
applyTo: "**/04-governance-constraints.md, **/04-governance-constraints.json, **/*.bicep"
```

To:

```yaml
applyTo: "**/04-governance-constraints.md, **/04-governance-constraints.json, **/*.bicep, **/*.tf"
```

No other changes to this file.

## Item 1.10 — Update `governance-discovery-subagent` — dual-field output

The subagent must produce BOTH `bicepPropertyPath` AND `azurePropertyPath` in the
`04-governance-constraints.json` output for every policy entry.

Find the section in the subagent that describes the JSON output format and add
`azurePropertyPath` alongside `bicepPropertyPath`:

- `bicepPropertyPath`: existing field — unchanged (e.g., `storageAccounts::properties.minimumTlsVersion`)
- `azurePropertyPath`: new IaC-agnostic field (e.g., `storageAccount.properties.minimumTlsVersion`)

The `azurePropertyPath` format follows the Azure REST API resource property path,
dot-separated, resource type first (camelCase), then property path.

Also update the subagent's `description` field in frontmatter — remove the phrase
"called by the Bicep Plan agent" and replace with "called by IaC plan agents
(Bicep and Terraform)".

## Item 1.11 — Create `terraform-code-best-practices.instructions.md`

Create `.github/instructions/terraform-code-best-practices.instructions.md`.

Frontmatter:
```yaml
---
description: "Infrastructure as Code best practices for Azure Terraform templates. AVM-first, CAF naming, security baseline."
applyTo: "**/*.tf"
---
```

Model it on `bicep-code-best-practices.instructions.md` but with HCL conventions:

- **AVM-TF first**: `source = "Azure/avm-res-{service}-{resource}/azurerm"` from Terraform Registry
- **File structure**: `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`, `versions.tf`, `locals.tf`, `backend.tf`
- **CAF naming**: use `azurerm_resource_group.this`, lowercase with hyphens for Azure names
- **Required tag**: `ManagedBy = "Terraform"` alongside standard tags
- **Security baseline**: TLS 1.2, HTTPS-only, managed identity, no public access by default
- **State backend**: Azure Storage Account (never HCP Terraform Cloud)
- **Provider pinning**: pin `azurerm` to minor version `~> 4.0`
- **unique suffix**: use `random_string.suffix` (4 chars, lowercase, no special)
- **`terraform fmt`**: always format before committing
- **`terraform validate`**: always validate before planning
- Cross-reference `governance-discovery.instructions.md` for policy compliance

## Item 1.12 — Create `terraform-policy-compliance.instructions.md`

Create `.github/instructions/terraform-policy-compliance.instructions.md`.

Frontmatter:
```yaml
---
description: "MANDATORY Azure Policy compliance rules for Terraform code generation. Azure Policy always wins."
applyTo: "**/*.tf, **/*.agent.md"
---
```

Model on `bicep-policy-compliance.instructions.md`. Key sections:

- **Mandate**: Azure Policy always wins — read `04-governance-constraints.json` first
- **`azurePropertyPath` translation**: read the `azurePropertyPath` field from each policy entry.
  Translate to `azurerm` resource argument using this pattern:
  - Split on `.` to get `[resourceType, "properties", ...rest]`
  - Map `resourceType` to `azurerm_*` resource name (document table of common mappings)
  - Map property path to Terraform argument name (snake_case)
  - Example: `storageAccount.properties.minimumTlsVersion` → `azurerm_storage_account.min_tls_version`
- **HARD GATE**: Deny policies map to required resource arguments — must be set
- **Modify policies**: read the `requiredValue` and enforce it
- **Audit policies**: add as a comment in the resource for awareness
- Cross-reference `04-governance-constraints.json` for the policy list

## Item 1.13 — Create `terraform-patterns/SKILL.md`

Create `.github/skills/terraform-patterns/SKILL.md`.

Adapt the structure from `azure-bicep-patterns/SKILL.md`. Include these 7 patterns
in HCL format, using AVM-TF modules:

1. **Hub-Spoke Network** — `Azure/avm-res-network-virtualnetwork/azurerm` + peering
2. **Private Endpoints** — `Azure/avm-res-network-privateendpoint/azurerm` pattern
3. **Diagnostic Settings** — `Azure/avm-res-insights-diagnosticsetting/azurerm` per resource
4. **Conditional Deployment** — `count = var.deploy_feature ? 1 : 0` pattern
5. **Module Composition** — calling multiple AVM modules, passing outputs as inputs
6. **Managed Identity** — `identity { type = "SystemAssigned" }` + role assignment
7. **Plan Interpretation** — `terraform plan` output: reading create/update/destroy/replace

Add a **"Terraform AVM Known Pitfalls"** section (draw from `docs/tf-support/SKILL.md`):

- Set-type attribute ordering causing phantom diffs (use `lifecycle { ignore_changes = [...] }`)
- Provider version constraint pitfalls (`~>` vs `>=`)
- `ignore_changes` lifecycle for externally-managed tags
- `for_each` over `count` for named resources (avoids index-based drift)
- The `moved` block for resource renaming without destroy/recreate

## Item 1.14 — Update `azure-defaults/SKILL.md`

Add a new `## Terraform Conventions` section after the existing Bicep section. Include:

- AVM-TF registry lookup: `registry.terraform.io/modules/Azure/{module}/azurerm/latest`
- Tag syntax in HCL: `tags = merge(var.tags, { ManagedBy = "Terraform" })`
- Format: `terraform fmt -recursive`
- Validate: `terraform validate`
- State backend: Azure Storage Account pattern (copy the snippet from the plan)
- Unique suffix: `resource "random_string" "suffix" { length = 4; lower = true; special = false }`

Add a **"Common AVM-TF Modules" table** — map these 16 resource types to their
Terraform Registry AVM modules:

| Resource | Bicep AVM | Terraform AVM |
| -------- | --------- | ------------- |
| Key Vault | `br/public:avm/res/key-vault/vault` | `Azure/avm-res-keyvault-vault/azurerm` |
| Storage Account | `br/public:avm/res/storage/storage-account` | `Azure/avm-res-storage-storageaccount/azurerm` |
| Virtual Network | `br/public:avm/res/network/virtual-network` | `Azure/avm-res-network-virtualnetwork/azurerm` |
| App Service Plan | `br/public:avm/res/web/serverfarm` | `Azure/avm-res-web-serverfarm/azurerm` |
| Web App | `br/public:avm/res/web/site` | `Azure/avm-res-web-site/azurerm` |
| Container Registry | `br/public:avm/res/container-registry/registry` | `Azure/avm-res-containerregistry-registry/azurerm` |
| AKS | `br/public:avm/res/container-service/managed-cluster` | `Azure/avm-res-containerservice-managedcluster/azurerm` |
| SQL Database | `br/public:avm/res/sql/server` | `Azure/avm-res-sql-server/azurerm` |
| Cosmos DB | `br/public:avm/res/document-db/database-account` | `Azure/avm-res-documentdb-databaseaccount/azurerm` |
| Service Bus | `br/public:avm/res/service-bus/namespace` | `Azure/avm-res-servicebus-namespace/azurerm` |
| Event Hub | `br/public:avm/res/event-hub/namespace` | `Azure/avm-res-eventhub-namespace/azurerm` |
| Log Analytics | `br/public:avm/res/operational-insights/workspace` | `Azure/avm-res-operationalinsights-workspace/azurerm` |
| App Insights | `br/public:avm/res/insights/component` | `Azure/avm-res-insights-component/azurerm` |
| Private DNS Zone | `br/public:avm/res/network/private-dns-zone` | `Azure/avm-res-network-privatednszones/azurerm` |
| User-Assigned Identity | `br/public:avm/res/managed-identity/user-assigned-identity` | `Azure/avm-res-managedidentity-userassignedidentity/azurerm` |
| API Management | `br/public:avm/res/api-management/service` | `Azure/avm-res-apimanagement-service/azurerm` |

## Validation

```bash
npm run validate:all
npm run lint:instruction-frontmatter    # if available
npm run lint:skills-format              # if available
```

Verify `governance-discovery-subagent` frontmatter still valid:
```bash
npm run lint:agent-frontmatter
```

## Commit

```bash
git add .github/instructions/governance-discovery.instructions.md \
        .github/agents/_subagents/governance-discovery-subagent.agent.md \
        .github/instructions/terraform-code-best-practices.instructions.md \
        .github/instructions/terraform-policy-compliance.instructions.md \
        .github/skills/terraform-patterns/SKILL.md \
        .github/skills/azure-defaults/SKILL.md
git commit -m "feat(instructions): add Terraform instructions, skills, and dual-field governance

- governance-discovery.instructions.md: add **/*.tf to applyTo
- governance-discovery-subagent: dual-field output (bicepPropertyPath + azurePropertyPath)
- New: terraform-code-best-practices.instructions.md
- New: terraform-policy-compliance.instructions.md (azurePropertyPath translation)
- New: terraform-patterns/SKILL.md (7 patterns + AVM pitfalls)
- azure-defaults/SKILL.md: add Terraform Conventions + AVM-TF module table"
```

## Update PROGRESS.md

Check off `1.9` through `1.14`, update Phase 1 row to `✅ Complete`, set
`active_phase: 2`, add session note, commit.

## Regression Check

Run `docs/tf-support/prompts/regression-check.prompt.md` before moving to Phase 2.
