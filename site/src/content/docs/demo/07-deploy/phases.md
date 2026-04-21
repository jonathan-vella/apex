---
title: "Deployment Phases"
description: "Change summary, validation issues, deployment commands, and post-deployment tasks for the Malta catering infrastructure deployment"
sidebar:
  order: 1
---

## Change Summary

| Change Type  | Count | Resources Affected                                                                  |
| ------------ | ----- | ----------------------------------------------------------------------------------- |
| Create (+)   | 11+   | VNet, App Service Plan, Web App, staging slot, private endpoints, DNS zones, budget |
| Modify (~)   | 3+    | ACR, Key Vault, Storage network posture                                             |
| NoChange (=) | 2     | Log Analytics, Application Insights                                                 |

## Validation Issues

- The first App Service deployment attempt failed because `S1` Linux was unavailable for this subscription in `swedencentral`; the final deployment succeeded after switching to `P0v3`.
- Runtime verification after deployment returned HTTP `503` on both production and staging endpoints and remains an open post-deployment task.
- No blocking infrastructure deployment errors remained after the final `P0v3` deployment completed.

## To Actually Deploy

### Azure Developer CLI (azd)

```bash
cd infra/bicep/malta-catering

# Preview changes
azd provision --preview

# Deploy
azd provision --no-prompt
```

### PowerShell (deploy.ps1)

```powershell
cd infra/bicep/malta-catering

# What-if preview
./deploy.ps1 -WhatIf

# Deploy
./deploy.ps1
```

### Azure CLI

```bash
cd infra/bicep/malta-catering

az deployment group create \
  --resource-group "rg-malta-catering-dev" \
  --template-file main.bicep \
  --parameters main.bicepparam
```

:::note
The final successful deployment used the updated `main.bicepparam` value `appServicePlanSku = 'P0V3'`.
:::

## Post-Deployment Tasks

| Task                                                                  | Owner             | Status      |
| --------------------------------------------------------------------- | ----------------- | ----------- |
| Verify production endpoint health beyond HTTP `503`                   | Platform owner    | In progress |
| Grant staging slot the same dependency RBAC as production             | Platform owner    | In progress |
| Enable App Service Authentication if social/staff sign-in is required | Application owner | Pending     |
| Add application availability alerts                                   | Platform owner    | Pending     |
| Implement Table Storage export or backup path                         | Platform owner    | Pending     |
