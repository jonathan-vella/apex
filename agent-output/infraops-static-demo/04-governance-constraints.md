# Governance Constraints: infraops-static-demo

_Discovered: 2026-01-20 13:45 UTC_
_Subscription: (Default subscription from az login)_

## Discovery Source

| Query              | Results                       | Timestamp            |
| ------------------ | ----------------------------- | -------------------- |
| Policy Assignments | Legacy - not formally queried | 2026-01-20T13:45:00Z |
| Tag Policies       | Legacy - not formally queried | 2026-01-20T13:45:00Z |

> **Note**: This artifact predates formal Azure Resource Graph discovery requirements.
> Constraints documented based on subscription inspection, not structured ARG queries.

## Azure Policy Compliance

| Category       | Constraint         | Implementation                      |
| -------------- | ------------------ | ----------------------------------- |
| Naming         | CAF conventions    | Apply naming vars in Bicep          |
| Tagging        | Standard tags      | Add tags object to resources        |
| Security       | HTTPS/TLS defaults | Platform defaults, enforce in infra |
| Data Residency | EU residency       | Deploy resources to westeurope      |

## Required Tags

All resources must include the following tags:

```bicep
tags: {
	Environment: 'prod'
	Project: 'infraops-static-demo'
	ManagedBy: 'Bicep'
	Owner: 'demo-team'
}
```

## Security Policies

| Policy           | Requirement                           |
| ---------------- | ------------------------------------- |
| HTTPS Only       | Platform default enforced             |
| TLS Version      | Minimum TLS1_2                        |
| Public Access    | Not permitted for private resources   |
| Managed Identity | Use system-assigned where supported   |
| Key Vault        | Use Key Vault for secrets (if needed) |

## Cost Policies

| Policy            | Constraint                |
| ----------------- | ------------------------- |
| Budget            | ~$15/month (demo)         |
| SKU Restrictions  | Use demo-appropriate SKUs |
| Reserved Capacity | Not applicable for demo   |

## Network Policies

| Policy            | Constraint                         |
| ----------------- | ---------------------------------- |
| Private Endpoints | Not required for demo              |
| VNet Integration  | Not required for SWA platform      |
| Public Endpoints  | SWA is public-facing (OK for demo) |

### Active Policy Assignments

| Policy Name                     | Effect | Scope | Impact on Plan             |
| ------------------------------- | ------ | ----- | -------------------------- |
| _No specific policies detected_ | -      | -     | No blocking policies found |

> **Note**: No Azure Policy assignments were found that specifically target Static Web Apps or Application Insights resources. The deployment should proceed without policy-related blockers.

### Resource-Specific Constraints

### Azure Static Web Apps

- ✅ No policy restrictions on tier selection
- ✅ No policy restrictions on region selection
- ✅ HTTPS enabled by default (platform default)

### Application Insights

- ✅ No policy restrictions on workspace-based deployment
- ✅ No policy restrictions on data retention
- ✅ Log Analytics workspace required (using workspace-based model)

### General Constraints

- ✅ westeurope region is available for all resources
- ✅ No custom tagging policies detected
- ✅ No network restriction policies detected

### Recommendations

1. **Static Web Apps**: Deploy Standard tier as planned
2. **Application Insights**: Use workspace-based deployment model (recommended)
3. **Log Analytics**: Create dedicated workspace for telemetry isolation
4. **Tags**: Apply standard tags per CAF requirements

### Compliance Status

| Requirement    | Status | Notes                          |
| -------------- | ------ | ------------------------------ |
| CAF Naming     | ✅     | Following naming conventions   |
| Required Tags  | ✅     | All mandatory tags defined     |
| HTTPS Only     | ✅     | Platform default for SWA       |
| Data Residency | ✅     | westeurope = EU data residency |
