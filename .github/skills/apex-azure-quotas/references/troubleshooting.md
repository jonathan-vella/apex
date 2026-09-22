<!-- ref:troubleshooting-v1 -->

# Quota Troubleshooting Guide

Common errors, unsupported providers, and resolution steps for Azure quota operations.

Apply [quota evidence and fallback](commands.md#quota-evidence-and-fallback)
for all failures; this table classifies errors without defining a second procedure.

## Common Errors

| **Error**             | **Cause**                                      | **Solution**                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "No Limit" / "Unlimited" | Missing numeric quota evidence | Report unknown; follow canonical fallback |
| REST API failures | Scope, permission, throttling or coverage error | Classify diagnostics; the same provider is not a coverage bypass |
| `ExtensionNotFound`   | Quota extension not installed                  | `az extension add --name quota`                                                                                                                                                                 |
| `BadRequest` | Invalid arguments/scope or unsupported resource | Validate scope first; use documented fallback only when unsupported is confirmed |
| `MissingRegistration` | Microsoft.Quota provider not registered | Request approval before registering in the selected subscription |
| `QuotaExceeded` | Deployment would exceed quota | Propose an approved increase or region change; neither guarantees capacity |
| `InvalidScope`        | Incorrect scope format                         | Use pattern: `/subscriptions/<id>/providers/<namespace>/locations/<region>`                                                                                                                     |

## Unsupported Resource Providers

Coverage is resource-, region-, subscription- and API-version-specific. Do not
treat a static provider catalog as proof of support for every resource type.
Use current command evidence and official service limits; for Cosmos DB consult
[Cosmos DB limits](https://learn.microsoft.com/azure/cosmos-db/concepts-limits).
Unavailable evidence remains unknown, not unlimited capacity.
