<!-- ref:troubleshooting-v1 -->

# Quota Troubleshooting Guide

Common errors, unsupported providers, and resolution steps for Azure quota operations.

## Common Errors

| **Error**             | **Cause**                                      | **Solution**                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST API "No Limit"   | REST API showing misleading "unlimited" values | **CRITICAL: "No Limit" ≠ unlimited!** Use CLI instead. Check [service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| REST API failures     | REST API unreliable and misleading             | **Always use Azure CLI** - See [commands.md](./commands.md) for complete CLI reference                                                                                                          |
| `ExtensionNotFound`   | Quota extension not installed                  | `az extension add --name quota`                                                                                                                                                                 |
| `BadRequest`          | Resource provider not supported by quota API   | Use CLI (preferred) or [service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)                                       |
| `MissingRegistration` | Microsoft.Quota provider not registered        | `az provider register --namespace Microsoft.Quota`                                                                                                                                              |
| `QuotaExceeded`       | Deployment would exceed quota                  | Request increase or choose different region                                                                                                                                                     |
| `InvalidScope`        | Incorrect scope format                         | Use pattern: `/subscriptions/<id>/providers/<namespace>/locations/<region>`                                                                                                                     |

## Unsupported Resource Providers

**Known unsupported providers:**

- ❌ Microsoft.DocumentDB (Cosmos DB) - Use Portal or [Cosmos DB limits docs](https://learn.microsoft.com/en-us/azure/cosmos-db/concepts-limits)

**Confirmed working providers:**

- ✅ Microsoft.Compute (VMs, disks, cores)
- ✅ Microsoft.Network (VNets, IPs, load balancers)
- ✅ Microsoft.App (Container Apps)
- ✅ Microsoft.Storage (storage accounts)
- ✅ Microsoft.MachineLearningServices (ML compute)

> **📖 See also:** [Troubleshooting Guide](./commands.md#troubleshooting)
