---
description: "Bicep-specific IaC best practices for Azure templates. Security baseline, naming, AVM mandate, anti-patterns."
applyTo: "**/*.bicep"
---

# Bicep Best Practices

Region, tags, AVM-first mandate, unique suffix, and security baseline
are defined in `AGENTS.md` (always loaded). This file covers Bicep-specific
patterns. Policy constraints (`04-governance-constraints.md`) always take precedence.

## Security

Azure Policy always wins. Code adapts to policy, never the reverse.
See `references/iac-security-baseline.md` for shared security rules and
`references/iac-policy-compliance.md` for the full policy compliance workflow.

```bicep
// Storage
supportsHttpsTrafficOnly: true
minimumTlsVersion: 'TLS1_2'
allowBlobPublicAccess: false
allowSharedKeyAccess: false  // Policy may require this

// SQL
azureADOnlyAuthentication: true
minimalTlsVersion: '1.2'
publicNetworkAccess: 'Disabled'
```

## Policy Compliance

Cross-reference `04-governance-constraints.json` before writing templates.
For Deny policies, prefer `azurePropertyPath`; fall back to `bicepPropertyPath`.
See `references/iac-policy-compliance.md` for the full checklist and Bicep
translation rules.

## Naming

| Resource   | Max | Pattern                        | Example                  |
| ---------- | --- | ------------------------------ | ------------------------ |
| Storage    | 24  | `st{project}{env}{suffix}`     | `stcontosodev7xk2`       |
| Key Vault  | 24  | `kv-{project}-{env}-{suffix}`  | `kv-contoso-dev-abc123`  |
| SQL Server | 63  | `sql-{project}-{env}-{suffix}` | `sql-contoso-dev-abc123` |

Use lowerCamelCase for parameters, variables, resources, modules.

## Unique Names

Generate `uniqueSuffix` once in `main.bicep` via `uniqueString(resourceGroup().id)`.
Pass to all modules. Use `take()` for length-constrained resources.

## AVM Modules

Use AVM modules (`br/public:avm/res/{service}/{resource}:{version}`) for all
resources where one exists. Raw Bicep only when no AVM exists and user approves.

## Module Outputs

Every module outputs: `resourceId`, `resourceName`, `principalId` (if identity exists).

## Diagnostic Settings

Pass resource names (not IDs) to diagnostic modules. Use `existing` keyword
for symbolic references inside the diagnostic module.

## Cost Monitoring

Every deployment includes a budget module. See `references/iac-cost-monitoring.md`.

## Repeatability

Zero hardcoded project-specific values. `projectName` parameter has no default.
All tag values reference parameters. See `references/iac-policy-compliance.md`
for the dynamic tag list rule.

## Anti-Patterns

| Anti-Pattern           | Solution                        |
| ---------------------- | ------------------------------- |
| Hardcoded names        | Use `uniqueString()` suffix     |
| Missing `@description` | Document all parameters         |
| Explicit `dependsOn`   | Use symbolic references         |
| Resource ID for scope  | Use `existing` + names          |
| S1 for zone redundancy | Use P1v3+                       |
| Raw Bicep (no AVM)     | Use AVM modules or get approval |
| No budget module       | Include `modules/budget.bicep`  |

## Validation

```bash
bicep build main.bicep && bicep lint main.bicep
```

## Cross-References

- Policy compliance: `references/iac-policy-compliance.md`
- Security baseline: `references/iac-security-baseline.md`
- Cost monitoring: `references/iac-cost-monitoring.md`
- Governance discovery: `.github/instructions/governance-discovery.instructions.md`
- Azure defaults: `.github/skills/azure-defaults/SKILL.md`
- Bicep patterns skill: `.github/skills/azure-bicep-patterns/SKILL.md`
