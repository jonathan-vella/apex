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

**Never assume the quota resource name from the ARM type.** Follow the canonical
[resource name discovery](commands.md#resource-name-mapping) and
[evidence/fallback procedure](commands.md#quota-evidence-and-fallback).
The examples above are hints, not a supported-provider catalog or substitute for
the exact name and units returned for the selected scope.
