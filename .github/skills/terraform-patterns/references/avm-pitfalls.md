<!-- ref:avm-pitfalls-v1 -->

# Terraform AVM Known Pitfalls

## Set-Type Attribute Phantom Diffs

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

## Provider Version Constraint Pitfalls

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

## Ignore Changes for Externally-Managed Tags

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

## `for_each` Over `count` for Named Resources

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

## `moved` Block for Resource Renaming

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

## AVM Module `enable_telemetry` Default

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

## azurerm 4.x Breaking Changes from 3.x

- `azurerm_storage_account`: `allow_blob_public_access` renamed to `allow_nested_items_to_be_public`
- `azurerm_storage_account`: `enable_https_traffic_only` renamed to `https_traffic_only_enabled`
- `azurerm_app_service` and `azurerm_function_app` removed — use `azurerm_linux_web_app` / `azurerm_windows_web_app`
- `azurerm_sql_*` resources largely replaced by `azurerm_mssql_*`

Always run `terraform validate` after upgrading the azurerm provider version.

## Provider Runtime Failures (pass validate + plan, fail at apply)

These failures are emitted by the Azure resource provider during
`terraform apply` — `terraform validate`, `tfsec`, and `terraform plan`
all pass because the violation is provider-semantic / data-plane, not HCL
shape. The same resource-provider behaviours hit the Bicep track (full
detail in
[`azure-bicep-patterns/references/avm-pitfalls.md`](../../azure-bicep-patterns/references/avm-pitfalls.md));
only the `azurerm` argument names differ. The shared, language-neutral
catalogue lives in
[`iac-common/references/known-deploy-issues.md`](../../iac-common/references/known-deploy-issues.md).

### AKS outbound type must match the egress topology

`azurerm_kubernetes_cluster.network_profile.outbound_type` must be
`userAssignedNATGateway` when a NAT Gateway is attached to the node subnet
(BYO VNet). `userDefinedRouting` requires a `0.0.0.0/0` route table to a
firewall/NVA and is rejected when public network access is restricted
(`UserDefinedRouting is not supported when Cluster has public network access set to Disabled`).
BYO-VNet clusters also need the control-plane identity to hold
`Network Contributor` on the VNet (`azurerm_role_assignment`).

### AKS fixed node pool must not set min/max count

On `azurerm_kubernetes_cluster_node_pool`, leave `min_count`/`max_count`
unset (`null`) unless the auto-scaling toggle is enabled
(`auto_scaling_enabled` in azurerm 4.x / `enable_auto_scaling` in 3.x),
or apply fails with
`InvalidParameter: ... minCount set which requires enableAutoscaling true`.

### MySQL Flexible Server: private endpoint vs delegated subnet

`azurerm_mysql_flexible_server` is *either* VNet-injected
(`delegated_subnet_id` + a subnet delegated to
`Microsoft.DBforMySQL/flexibleServers`, /29 minimum) *or* reached via an
`azurerm_private_endpoint` — not both. Pointing it at a shared PE subnet
without delegation fails with `VnetSubnetMissingDelegation`. For a shared
PE subnet, use a private endpoint.

### MySQL engine version + major-version change

Pin the latest GA LTS major version (`version = "8.4"` → 8.4.x) per the
[version support policy](https://learn.microsoft.com/azure/mysql/concepts-version-policy);
avoid the retiring `8.0` and the innovation `9.x` (no HA/replica/backup).
A major-version change on an **existing** server must be the only changed
property, or the provider returns
`UpdateServerVersionTogetherWithOtherPropertiesNotAllowed` — recreate
(non-prod) or use the in-place Major Version Upgrade flow (prod).

### Cost Management anomaly alert viewId scope

When emitting a `Microsoft.CostManagement/scheduledActions` InsightAlert
(via `azapi_resource`), the `viewId` must be scope-matched to the action:
prefix the built-in view with the subscription resource ID
(`/subscriptions/<id>/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup`).
A bare `/providers/Microsoft.CostManagement/views/...` path is rejected
with `InvalidView`.

### Orphaned private endpoint on redeploy

Deleting a PaaS resource leaves its `azurerm_private_endpoint`
`Disconnected`; re-applying fails with
`PrivateEndpointCannotBeUpdatedInDisconnectedState`. Delete the orphaned
PE (or `terraform state rm` + manual delete) before re-applying so it
recreates `Approved`.
