<!-- ref:resource-name-mapping-v1 -->

# Understanding Resource Name Mapping

**⚠️ CRITICAL:** There is **NO 1:1 mapping** between ARM resource types and quota resource names.

## Example Mappings

| ARM Resource Type                     | Quota Resource Name                                     |
| ------------------------------------- | ------------------------------------------------------- |
| `Microsoft.App/managedEnvironments`   | `ManagedEnvironmentCount`                               |
| `Microsoft.Compute/virtualMachines`   | `standardDSv3Family`, `cores`, `virtualMachines`        |
| `Microsoft.Network/publicIPAddresses` | `PublicIPAddresses`, `IPv4StandardSkuPublicIpAddresses` |

## Discovery Workflow

**Never assume the quota resource name from the ARM type.** Always use this workflow:

1. **List all quotas** for the resource provider:

   ```bash
   az quota list --scope /subscriptions/<id>/providers/<ProviderNamespace>/locations/<region>
   ```

2. **Match by `localizedValue`** (human-readable description) to find the relevant quota

3. **Use the `name` field** (not ARM resource type) in subsequent commands:
   ```bash
   az quota show --resource-name ManagedEnvironmentCount --scope ...
   az quota usage show --resource-name ManagedEnvironmentCount --scope ...
   ```

> **📖 Detailed mapping examples and workflow:** See [commands.md - Understanding Resource Name Mapping](./commands.md#understanding-resource-name-mapping)
