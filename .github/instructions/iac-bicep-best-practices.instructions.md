---
description: "Bicep-specific IaC best practices for Azure templates. Security baseline, naming, AVM mandate, anti-patterns."
applyTo: "**/*.bicep"
---

# Bicep Best Practices

Azure values are canonical in [Copilot instructions](../copilot-instructions.md#azure-defaults-canonical);
shared naming, AVM, and security procedures live in [apex-azure-defaults](../skills/apex-azure-defaults/SKILL.md).
This file covers Bicep-specific patterns. Discovered policy constraints always take precedence.

## Policy and Security

Azure Policy always wins. Code adapts to policy, never the reverse.
Cross-reference `04-governance-constraints.json` before writing templates; for Deny policies
prefer `azurePropertyPath` and fall back to `bicepPropertyPath`. Shared rules:
`references/iac-security-baseline.md` (security, networking, diagnostics) and
`references/iac-policy-compliance.md` (checklist, dynamic tags, Bicep translation).

## Naming

| Resource   | Max | Pattern                        | Example                  |
| ---------- | --- | ------------------------------ | ------------------------ |
| Storage    | 24  | `st{project}{env}{suffix}`     | `stcontosodev7xk2`       |
| Key Vault  | 24  | `kv-{project}-{env}-{suffix}`  | `kv-contoso-dev-abc123`  |
| SQL Server | 63  | `sql-{project}-{env}-{suffix}` | `sql-contoso-dev-abc123` |

Use lowerCamelCase for parameters, variables, resources, modules.
Avoid symbols named `resourceGroup`, `subscription`, `managementGroup`, `tenant`, `az` or `sys` when those
functions/namespaces are used. Prefer role-specific names such as `projectResourceGroup`; rename all references
together. Scope-function shadowing is a source defect, not a missing-module error that can be deferred.

## Unique Names

Generate `uniqueSuffix` once in `main.bicep` via `uniqueString(resourceGroup().id)`.
Pass to all modules. Use `take()` for length-constrained resources.

## AVM Modules

Use AVM modules (`br/public:avm/res/{service}/{resource}:{version}`) for all
resources where one exists. Raw Bicep only when no AVM exists and user approves.

**Pin to the latest published stable version**, resolved at plan time through MCR tags or
the `mcp_bicep_list_avm_metadata` MCP helper (procedure and stale-pin/freeze policy in
[`apex-azure-defaults`](../skills/apex-azure-defaults/SKILL.md)). Never copy a version
from `apex-azure-defaults/references/avm-modules.md` — versions are intentionally stripped.

## Module Outputs

Every module outputs: `resourceId`, `resourceName`, `principalId` (if identity exists).
For a resource-group ID at subscription scope, use
`subscriptionResourceId('Microsoft.Resources/resourceGroups', resourceGroupName)`; do not omit the resource type.
Constructed IDs and module declaration order do not establish dependencies. Preserve approved prerequisite edges
in both phased and `all` deployments; prefer symbolic outputs, or explicit `dependsOn` when IDs must remain phase-safe.

## Diagnostic Settings

Pass resource and workspace names (not IDs) to modules; resolve IDs with `existing`
inside the module. Coverage requirements: `references/iac-security-baseline.md`.

## Cost Monitoring and Repeatability

Every deployment includes a budget module (`references/iac-cost-monitoring.md`).
Zero hardcoded project-specific values: `projectName` has no default and tag values
reference parameters (dynamic tag rule in `references/iac-policy-compliance.md`).

## Anti-Patterns

| Anti-Pattern           | Solution                        |
| ---------------------- | ------------------------------- |
| Hardcoded names        | Use `uniqueString()` suffix     |
| Missing `@description` | Document all parameters         |
| Redundant `dependsOn` | Prefer symbolic outputs; add explicit edges when constructed IDs hide dependencies |
| Resource ID for scope  | Use `existing` + names          |
| S1 for zone redundancy | Use P1v3+                       |
| Raw Bicep (no AVM)     | Use AVM modules or get approval |
| No budget module       | Include `modules/budget.bicep`  |

## Validation

```bash
bicep build main.bicep && bicep lint main.bicep
```

## Cross-References

- Governance discovery: `.github/instructions/governance-discovery.instructions.md`
- Bicep patterns skill: `.github/skills/apex-azure-bicep-patterns/SKILL.md`
