<!-- ref:global-rules-v1 -->

# Global Rules

These rules apply to every phase of `apex-azure-upgrade`.

## Destructive Action Policy

⛔ This skill never performs destructive actions. These are cutover steps that need explicit user approval and
run through the deploy agents (07b/07t) or the resource owner's change process:

- Deleting apps, services, or resource groups
- Stopping or disabling the original app/service
- Overwriting app settings or configuration in the new app
- Removing the original hosting plan or service tier
- Modifying DNS or custom domain bindings

## User Confirmation Required

Ask the user before:

- Selecting the target Azure subscription or region
- Recommending new Azure resources
- Planning any step that stops or deletes the original app/service
- Planning changes to custom domains or network restrictions
- Any irreversible configuration change

## Best Practices

- Use `mcp_azure-mcp_get_azure_bestpractices` before recommending upgrade steps
- Prefer managed identity over connection strings — upgrades are a good time to improve security
- **Target the latest supported runtime version** — check Microsoft Learn for the newest GA version
- Keep the original app/service running until the upgraded one is fully validated
- Keep the new resource in the same resource group when it needs the same dependencies
- Follow the CAF naming in `apex-azure-defaults` for all new resources

## Identity-First Authentication (Zero API Keys)

> Enterprise subscriptions commonly enforce policies that block local auth. Always design for identity-based access from the start.

- Prefer managed identity connections over connection strings/keys
- Use `DefaultAzureCredential` in code — works locally and in Azure
- When using User Assigned Managed Identity, always pass `managedIdentityClientId` explicitly
- See service-specific identity configuration in the scenario reference files

## Rollback Policy

- Document rollback steps before any cutover
- Keep the original app intact and running until the upgrade is validated
- If the upgrade fails, the deployment owner restarts the original app and redirects clients
- Never delete the original app automatically
