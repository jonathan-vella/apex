---
name: terraform-patterns
description: Common Azure Terraform infrastructure patterns using AVM-TF modules, including hub-spoke networking, private endpoints, diagnostic settings, conditional deployments, module composition, managed identity, and plan interpretation. Includes AVM Known Pitfalls section. Use when designing or generating Terraform templates that combine multiple Azure resources into repeatable patterns.
compatibility: Requires Terraform >= 1.9, azurerm ~> 4.0, Azure CLI
---

# Azure Terraform Patterns Skill

Reusable infrastructure patterns for Azure Terraform templates. These patterns complement
the `terraform-code-best-practices.instructions.md` (style rules) and `azure-defaults`
skill (naming, tags, regions) with composable architecture building blocks.

---

## Quick Reference

| Pattern                  | When to Use                                      |
| ------------------------ | ------------------------------------------------ |
| Hub-Spoke Networking     | Multi-workload environments with shared services |
| Private Endpoint Wiring  | Any PaaS service requiring private connectivity  |
| Diagnostic Settings      | Every deployed resource (mandatory)              |
| Conditional Deployment   | Optional resources controlled by variables       |
| Module Composition       | Calling multiple AVM modules in the root module  |
| Managed Identity Binding | Any service-to-service authentication            |
| Plan Interpretation      | Pre-deployment validation and change analysis    |

---

## Pattern 1 — Hub-Spoke Networking

Standard pattern using AVM-TF VNet module with peering:

```hcl
# Hub VNet
module "hub_vnet" {
  source  = "Azure/avm-res-network-virtualnetwork/azurerm"
  version = "~> 0.7"

  name                = "vnet-hub-${local.suffix}"
  resource_group_name = azurerm_resource_group.hub.name
  location            = var.location
  address_space       = ["10.0.0.0/16"]

  subnets = {
    AzureFirewallSubnet = { address_prefixes = ["10.0.1.0/24"] }
    GatewaySubnet       = { address_prefixes = ["10.0.2.0/24"] }
  }

  tags = local.tags
}

# Spoke VNet
module "spoke_vnet" {
  source  = "Azure/avm-res-network-virtualnetwork/azurerm"
  version = "~> 0.7"

  name                = "vnet-spoke-${var.workload}-${local.suffix}"
  resource_group_name = azurerm_resource_group.spoke.name
  location            = var.location
  address_space       = [var.spoke_address_prefix]

  peerings = {
    to-hub = {
      remote_virtual_network_resource_id = module.hub_vnet.resource_id
      allow_forwarded_traffic            = true
      allow_gateway_transit              = false
      use_remote_gateways                = false
    }
  }

  tags = local.tags
}
```

Key rules:

- Hub contains shared infrastructure (firewall, gateway, DNS)
- Spokes peer to hub — never to each other directly
- Use `module.hub_vnet.resource_id` output to wire peering in spoke modules
- Apply NSGs per subnet via the `subnets` map, not per VNet

---

## Pattern 2 — Private Endpoints

Standard three-resource pattern using AVM-TF private endpoint module:

```hcl
# Private endpoint for a PaaS service
module "storage_private_endpoint" {
  source  = "Azure/avm-res-network-privateendpoint/azurerm"
  version = "~> 0.1"

  name                = "pe-${local.st_name}-${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location

  private_connection_resource_id = module.storage.resource_id
  subnet_resource_id             = module.spoke_vnet.subnets["PrivateEndpoints"].resource_id

  private_dns_zone_group_name = "default"
  private_dns_zone_resource_ids = [
    azurerm_private_dns_zone.blob.id
  ]

  subresource_names = ["blob"]
  tags              = local.tags
}

# Private DNS Zone (one per service type)
resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.networking.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                  = "pdnslink-blob-${local.suffix}"
  resource_group_name   = azurerm_resource_group.networking.name
  private_dns_zone_name = azurerm_private_dns_zone.blob.name
  virtual_network_id    = module.spoke_vnet.resource_id
  registration_enabled  = false
  tags                  = local.tags
}
```

Common `subresource_names` per service:

| Service        | Subresource | Private DNS Zone                     |
| -------------- | ----------- | ------------------------------------ |
| Storage (Blob) | `blob`      | `privatelink.blob.core.windows.net`  |
| Storage (File) | `file`      | `privatelink.file.core.windows.net`  |
| Key Vault      | `vault`     | `privatelink.vaultcore.azure.net`    |
| SQL Server     | `sqlServer` | `privatelink.database.windows.net`   |
| Container Reg. | `registry`  | `privatelink.azurecr.io`             |
| App Service    | `sites`     | `privatelink.azurewebsites.net`      |
| Service Bus    | `namespace` | `privatelink.servicebus.windows.net` |
| Cosmos DB      | `Sql`       | `privatelink.documents.azure.com`    |

---

## Pattern 3 — Diagnostic Settings

Use the AVM-TF diagnostics module for every deployed resource. Pass the
Log Analytics workspace ID via module outputs:

```hcl
module "log_analytics" {
  source  = "Azure/avm-res-operationalinsights-workspace/azurerm"
  version = "~> 0.4"

  name                = "log-${var.project}-${var.environment}-${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  tags                = local.tags
}

# Attach diagnostics to each resource — pass workspace ID as output
module "storage_diagnostics" {
  source  = "Azure/avm-res-insights-diagnosticsetting/azurerm"
  version = "~> 0.1"

  name                           = "diag-${local.st_name}"
  target_resource_id             = module.storage.resource_id
  log_analytics_workspace_id     = module.log_analytics.resource_id
  log_analytics_destination_type = "Dedicated"

  logs_destinations_ids = [module.log_analytics.resource_id]
}
```

Rule: Every resource in the deployment MUST have a diagnostic setting pointing
to the central Log Analytics workspace.

---

## Pattern 4 — Conditional Deployment

Use `count` for simple boolean toggles. Use `for_each` for named, keyed resources:

```hcl
# Boolean toggle pattern
variable "deploy_bastion" {
  description = "Deploy Azure Bastion host."
  type        = bool
  default     = false
}

resource "azurerm_bastion_host" "this" {
  count = var.deploy_bastion ? 1 : 0

  name                = "bas-${var.project}-${var.environment}"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location

  ip_configuration {
    name                 = "configuration"
    subnet_id            = module.spoke_vnet.subnets["AzureBastionSubnet"].resource_id
    public_ip_address_id = azurerm_public_ip.bastion[0].id
  }

  tags = local.tags
}

# Referencing a conditional resource output safely
output "bastion_id" {
  value = var.deploy_bastion ? azurerm_bastion_host.this[0].id : null
}
```

Use `for_each` over `count` whenever resources have distinct names to avoid
index-based drift when items are added or removed:

```hcl
variable "storage_accounts" {
  type = map(object({ sku = string }))
  default = {
    data    = { sku = "Standard_LRS" }
    backups = { sku = "Standard_GRS" }
  }
}

resource "azurerm_storage_account" "this" {
  for_each = var.storage_accounts

  name                = "st${each.key}${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  account_tier        = "Standard"
  account_replication_type = each.value.sku
  tags                = local.tags
}
```

---

## Pattern 5 — Module Composition

Root module wires multiple AVM child modules, passing outputs as inputs:

```hcl
# main.tf — root module orchestration
module "resource_group" {
  source  = "Azure/avm-res-resources-resourcegroup/azurerm"
  version = "~> 0.1"

  name     = "rg-${var.project}-${var.environment}"
  location = var.location
  tags     = local.tags
}

module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.9"

  name                = local.kv_name
  resource_group_name = module.resource_group.name   # ← output from previous module
  location            = var.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = local.tags
}

module "app_service" {
  source  = "Azure/avm-res-web-site/azurerm"
  version = "~> 0.13"

  name                = "app-${var.project}-${var.environment}-${local.suffix}"
  resource_group_name = module.resource_group.name   # ← shared output
  location            = var.location
  service_plan_id     = module.app_service_plan.resource_id  # ← chained output
  tags                = local.tags

  app_settings = {
    KEY_VAULT_URI = module.key_vault.uri  # ← chained output
  }
}
```

Rules:

- Always pass **resource IDs and names** from module outputs, never hardcode
- Use `data.azurerm_client_config.current` for tenant and client IDs
- Chain outputs through locals when the same value is used 3+ times

---

## Pattern 6 — Managed Identity

Use SystemAssigned managed identity + RBAC role assignments:

```hcl
# Assign system identity to the app
resource "azurerm_linux_web_app" "this" {
  name                = "app-${var.project}-${var.environment}-${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  service_plan_id     = module.app_service_plan.resource_id

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags
}

# Grant app access to Key Vault secrets
resource "azurerm_role_assignment" "app_kv_secrets" {
  scope                = module.key_vault.resource_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.this.identity[0].principal_id
}

# Grant app access to Storage Blob
resource "azurerm_role_assignment" "app_storage_blob" {
  scope                = module.storage.resource_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_web_app.this.identity[0].principal_id
}
```

Common role assignments:

| Service      | Role                            |
| ------------ | ------------------------------- |
| Key Vault    | `Key Vault Secrets User`        |
| Storage Blob | `Storage Blob Data Contributor` |
| Service Bus  | `Azure Service Bus Data Sender` |
| Event Hub    | `Azure Event Hubs Data Sender`  |
| ACR          | `AcrPull`                       |

---

## Pattern 7 — Plan Interpretation

Reading `terraform plan` output to assess impact before applying:

```bash
# Generate a plan
terraform plan -out=plan.tfplan

# Human-readable summary
terraform show plan.tfplan

# Machine-readable JSON for analysis
terraform show -json plan.tfplan > plan.json
```

### Change Type Symbols

| Symbol | Meaning         | Action                                           |
| ------ | --------------- | ------------------------------------------------ |
| `+`    | Create          | New resource — safe                              |
| `-`    | Destroy         | Resource deleted — REVIEW before applying        |
| `~`    | Update in-place | Attribute change — usually safe                  |
| `-/+`  | Destroy/Create  | Replace — causes downtime for stateful resources |
| `<=`   | Read            | Data source refresh — non-destructive            |

### Red Flags in Plan Output

- `-/+` on databases, Key Vaults, storage accounts — stateful, causes data risk
- Large number of `~` changes on Application Gateway / NSG — likely Set-type phantom diff (see pitfalls)
- `destroy` on resources with `prevent_destroy = true` — Terraform will error

### Plan Summary Assessment

```bash
# Quick count of changes
terraform show -json plan.tfplan | \
  python3 -c "
import json, sys
plan = json.load(sys.stdin)
changes = plan.get('resource_changes', [])
by_action = {}
for c in changes:
    a = '+'.join(c['change']['actions'])
    by_action[a] = by_action.get(a, 0) + 1
for k, v in sorted(by_action.items()): print(f'{k}: {v}')
"
```

---

## Terraform AVM Known Pitfalls

### Set-Type Attribute Phantom Diffs

AzureRM resources using Terraform's `Set` type (Application Gateway, Load Balancer,
NSG, Azure Firewall, Front Door) compare elements by hash rather than logical identity.
Adding or removing ONE element causes ALL elements to appear as changed.

**Affected resources**: `azurerm_application_gateway`, `azurerm_lb`,
`azurerm_network_security_group`, `azurerm_firewall`, `azurerm_frontdoor`

**Detection**: Plan shows many `~` changes after adding a single rule.

**Mitigation**:

```hcl
# Use ignore_changes for set-type blocks when managed externally
lifecycle {
  ignore_changes = [
    backend_address_pool,
    backend_http_settings,
    http_listener,
    request_routing_rule,
    probe,
  ]
}
```

For full analysis, use the set-diff analyzer skill in `docs/tf-support/SKILL.md`.

### Provider Version Constraint Pitfalls

```hcl
# ❌ Too permissive — crosses breaking major versions
version = ">= 3.0"

# ❌ Too strict — blocks patch updates
version = "= 4.1.0"

# ✅ Correct — pins to azurerm 4.x, gets patch updates
version = "~> 4.0"
```

`~> 4.0` allows `4.0.1`, `4.1.0`, `4.9.x` but NOT `5.0.0`.
`~> 4.1` allows `4.1.0`, `4.1.1` but NOT `4.2.0`.

### Ignore Changes for Externally-Managed Tags

Some Azure services (e.g., Azure Policy Modify) auto-inject tags at deployment.
Without `ignore_changes`, every `terraform plan` shows phantom tag diff:

```hcl
resource "azurerm_resource_group" "this" {
  # ...
  lifecycle {
    ignore_changes = [tags["DateCreated"], tags["auto-managed-tag"]]
  }
}
```

### `for_each` Over `count` for Named Resources

Using `count` for resources with distinct identities causes drift when items
are inserted or removed from the middle of a list (Terraform reindexes):

```hcl
# ❌ count — deletes resource[1] and recreates resource[2] as resource[1]
resource "azurerm_subnet" "this" {
  count = length(var.subnet_names)
  name  = var.subnet_names[count.index]
}

# ✅ for_each — stable key-based identity
resource "azurerm_subnet" "this" {
  for_each = toset(var.subnet_names)
  name     = each.value
}
```

### `moved` Block for Resource Renaming

Renaming a resource identifier without a `moved` block causes destroy + recreate:

```hcl
# Old: resource "azurerm_key_vault" "main"
# New: resource "azurerm_key_vault" "this"

# Add moved block to prevent destroy/recreate
moved {
  from = azurerm_key_vault.main
  to   = azurerm_key_vault.this
}
```

`moved` blocks can also handle module renames:

```hcl
moved {
  from = module.old_name
  to   = module.new_name
}
```

Remove `moved` blocks after the state migration is confirmed in all environments.

### AVM Module `enable_telemetry` Default

AVM-TF modules deploy a `null_resource` for telemetry by default.
To disable in environments where outbound network is restricted:

```hcl
module "key_vault" {
  source           = "Azure/avm-res-keyvault-vault/azurerm"
  version          = "~> 0.9"
  enable_telemetry = false
  # ...
}
```

### azurerm 4.x Breaking Changes from 3.x

- `azurerm_storage_account`: `allow_blob_public_access` renamed to `allow_nested_items_to_be_public`
- `azurerm_storage_account`: `enable_https_traffic_only` renamed to `https_traffic_only_enabled`
- `azurerm_app_service` and `azurerm_function_app` removed — use `azurerm_linux_web_app` / `azurerm_windows_web_app`
- `azurerm_sql_*` resources largely replaced by `azurerm_mssql_*`

Always run `terraform validate` after upgrading the azurerm provider version.
