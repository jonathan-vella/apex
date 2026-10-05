<!-- ref:common-patterns-v1 -->

# Common Terraform Patterns

Diagnostic settings, conditional deployment, module composition, and managed identity patterns.

---

## Diagnostic Settings

There is no standalone AVM-TF diagnostic-setting module. Every AVM-TF
resource module exposes the standard `diagnostic_settings` input (storage
accounts split it per service, e.g. `diagnostic_settings_storage_account`
and `diagnostic_settings_blob`). Pass the Log Analytics workspace ID via
module outputs:

```hcl
module "log_analytics" {
  source  = "Azure/avm-res-operationalinsights-workspace/azurerm"
  version = "0.5.1"

  name                = "log-${var.project}-${var.environment}-${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  tags                = local.tags
}

module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "0.11.0"

  name                = local.kv_name
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = local.tags

  diagnostic_settings = {
    to_law = {
      name                  = "diag-${local.kv_name}"
      workspace_resource_id = module.log_analytics.resource_id
    }
  }
}
```

Versions are examples from the compatibility matrix in
[`avm-provider-compatibility.md`](avm-provider-compatibility.md);
resolve the current version at plan time.

Rule: Every resource in the deployment MUST have a diagnostic setting pointing
to the central Log Analytics workspace.

---

## Conditional Deployment

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

  name                     = "st${each.key}${local.suffix}"
  resource_group_name      = azurerm_resource_group.this.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = each.value.sku
  tags                     = local.tags
}
```

---

## Module Composition

Use [module-composition.md](module-composition.md) as the canonical pinned root
composition. It owns Resource Group and Key Vault output wiring; do not maintain
another copy here. For App Service, additionally wire the approved service plan's
resource ID and expose the vault URI in `KEY_VAULT_URI` through the approved
module's application settings. Verify the exact input/output names in its pinned
interface, including the vault URI output; do not infer them from service names.

Rules:

- Always pass **resource IDs and names** from module outputs, never hardcode
- Use `data.azurerm_client_config.current` for tenant and client IDs
- Chain outputs through locals when the same value is used 3+ times

---

## Managed Identity

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

### Common Role Assignments

| Service      | Role                            |
| ------------ | ------------------------------- |
| Key Vault    | `Key Vault Secrets User`        |
| Storage Blob | `Storage Blob Data Contributor` |
| Service Bus  | `Azure Service Bus Data Sender` |
| Event Hub    | `Azure Event Hubs Data Sender`  |
| ACR          | `AcrPull`                       |
