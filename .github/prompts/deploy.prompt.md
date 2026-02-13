---
description: "Deploy Bicep templates to Azure with what-if analysis"
agent: "Deploy"
model: "GPT-5.3-Codex"
tools:
  - execute/runInTerminal
  - read
  - edit/createFile
---

# Deploy to Azure

Deploy the Bicep infrastructure to Azure using the deploy agent workflow.

## Variables

- `projectName`: The project folder name in `infra/bicep/{projectName}/`
- `environment`: Target environment (dev/staging/prod) - default: `dev`
- `resourceGroup`: Resource group name - default: `rg-{projectName}-{environment}`
- `location`: Azure region - default: `swedencentral`

## Pre-Deployment Checklist

Before proceeding, verify:

1. **Azure CLI authenticated**: Run `az account show` to confirm
2. **Correct subscription**: Verify the subscription ID matches expectations
3. **Bicep templates validated**: Run `bicep build main.bicep` with no errors
4. **Parameters file exists**: Confirm `main.bicepparam` is present

## Deployment Workflow

### Step 1: Validate Templates

```bash
cd infra/bicep/{projectName}
bicep build main.bicep
```

### Step 2: What-If Analysis

Always run what-if before deployment to preview changes:

```bash
# Create resource group if needed
az group create --name {resourceGroup} --location {location}

# Run what-if
az deployment group what-if \
  --resource-group {resourceGroup} \
  --template-file main.bicep \
  --parameters main.bicepparam
```

### Step 3: User Approval Gate

**STOP and wait for user approval** before executing the actual deployment.

Present the what-if summary and ask:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  DEPLOYMENT APPROVAL REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What-if analysis shows:
  • Resources to create: {count}
  • Resources to modify: {count}
  • Resources to delete: {count}

Target: {resourceGroup} in {location}
Subscription: {subscriptionName}

Proceed with deployment? (yes/no)

→
```

### Step 4: Execute Deployment

Only after explicit user approval:

```bash
az deployment group create \
  --resource-group {resourceGroup} \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --name {projectName}-$(date +%Y%m%d%H%M%S)
```

### Step 5: Capture Outputs

```bash
az deployment group show \
  --resource-group {resourceGroup} \
  --name {deployment-name} \
  --query properties.outputs
```

### Step 6: Generate Deployment Summary

Create `agent-output/{projectName}/06-deployment-summary.md` with:

- Deployment timestamp and duration
- Resource group and subscription details
- All deployed resources with resource IDs
- Endpoint URLs (if applicable)
- Next steps for post-deployment configuration

## Error Handling

If deployment fails:

1. Capture the full error message
2. Identify the root cause (quota, naming, permissions, etc.)
3. Offer to hand off to the **Bicep Code** agent to fix the templates
4. After fixes, retry deployment from Step 2

## Next Steps

After successful deployment, suggest:

> "Deployment complete! Next steps:
>
> - **Deploy** agent → Generate workload documentation (Step 7)
> - **Design** agent → Create as-built architecture diagram
> - **Architect** agent → Review deployed resources for WAF compliance"
