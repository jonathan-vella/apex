# AZD Errors

## Deployment Runtime Errors

These errors occur **during** `azd up` execution:

| Error                                                                     | Cause                                                          | Resolution                                                                                                                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unknown flag: --location`                                                | `azd up` doesn't accept `--location`                           | Use `azd env set AZURE_LOCATION <region>` before `azd up`                                                                                                                |
| Provision failed                                                          | Bicep template errors                                          | Check detailed error in output                                                                                                                                           |
| Deploy failed                                                             | Build or Docker errors                                         | Check build logs                                                                                                                                                         |
| Package failed                                                            | Missing Dockerfile or deps                                     | Verify Dockerfile exists and dependencies                                                                                                                                |
| Quota exceeded                                                            | Subscription limits                                            | Request increase or change region                                                                                                                                        |
| `could not determine container registry endpoint`                         | Missing `AZURE_CONTAINER_REGISTRY_ENDPOINT`                    | See [Missing Container Registry Variables](#missing-container-registry-variables)                                                                                        |
| `map has no entry for key "AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID"` | Missing managed identity env vars                              | See [Missing Container Registry Variables](#missing-container-registry-variables)                                                                                        |
| `map has no entry for key "MANAGED_IDENTITY_CLIENT_ID"`                   | Missing managed identity client ID                             | See [Missing Container Registry Variables](#missing-container-registry-variables)                                                                                        |
| `found '2' resources tagged with 'azd-service-name: <name>'`              | Previous deployment left duplicate-tagged resources in same RG | **Preferred**: Create fresh env with `azd env new <new-name>`, set subscription/location, redeploy. **Alternative**: Delete conflicting resources (requires `ask_user`). |

> ℹ️ **Pre-flight validation**: Run `apex-azure-validate` before deployment to catch configuration errors early. See [Pre-Deploy Checklist](../../pre-deploy-checklist.md).

| Error                                                                                              | Cause                                                              | Resolution                                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `PrincipalId '...' has type 'ServicePrincipal', which is different from specified PrincipalType 'User'` | A template assigns roles to the deploying identity with `principalType: 'User'`, but CI/CD deploys as a service principal | See [Principal Type Mismatch](#principal-type-mismatch) |
| `Operation expired` or a Container App revision timeout (about 900 s)                             | The app's managed identity doesn't have `AcrPull` on the registry yet | See [Container App Revision Timeout](#container-app-revision-timeout) |

## Principal Type Mismatch

Many azd templates assign roles to the deploying user with a hard-coded
`principalType: 'User'`, often behind an `allowUserIdentityPrincipal` flag. In
CI/CD the deploying identity is a service principal, so provisioning fails.

Report it to the IaC owner: parameterize `principalType` (see
[SQL auth](../../../../apex-azure-prepare/references/services/sql-database/auth.md)) or set the
template's `allowUserIdentityPrincipal` flag to `false` for service principal
deployments. Clearing `AZURE_PRINCIPAL_ID` with `azd env set` has no effect, because
azd repopulates it from the current sign-in.

## Container App Revision Timeout

**Symptom:** provisioning succeeds, then revision creation times out and the
Container App shows `Failed` with no active revision.

**Cause:** `azd up` provisions and deploys in one run. The revision pulls the
image before the new `AcrPull` assignment has propagated, which can take several
minutes.

**Check (read-only):**

```bash
az containerapp show --name <app-name> --resource-group <resource-group> \
  --query "{provisioningState:properties.provisioningState, latestRevision:properties.latestRevisionName}" -o json
PRINCIPAL_ID=$(az containerapp identity show --name <app-name> --resource-group <resource-group> --query principalId -o tsv)
az role assignment list --scope "$(az acr show --name <acr-name> --resource-group <resource-group> --query id -o tsv)" \
  --assignee-object-id "$PRINCIPAL_ID" --query "[].roleDefinitionName" -o tsv
```

**Resolution:** if `AcrPull` is present, redeploy once with `azd deploy`. If it
is missing, report it to the IaC owner; the IaC must declare `AcrPull` with
`principalType: 'ServicePrincipal'`. Assigning it by CLI needs explicit approval.
Prevent it with the [two-phase order](../../pre-deploy-checklist.md#container-apps-with-acr--acrpull-before-app-deploy),
and don't keep polling a hanging `azd up`.

## Missing Container Registry Variables

**Symptom:** Errors during `azd deploy` about missing container registry or managed identity environment variables:

```
ERROR: could not determine container registry endpoint, ensure 'registry' has been set in the docker options or 'AZURE_CONTAINER_REGISTRY_ENDPOINT' environment variable has been set
```

Or:

```
ERROR: failed executing template file: template: manifest template:6:14: executing "manifest template" at <.Env.AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID>: map has no entry for key "AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID"
```

Or:

```
ERROR: failed executing template file: template: manifest template:39:26: executing "manifest template" at <.Env.MANAGED_IDENTITY_CLIENT_ID>: map has no entry for key "MANAGED_IDENTITY_CLIENT_ID"
```

**Cause:** This typically occurs with .NET Aspire projects using azd "limited mode" (in-memory infrastructure generation without explicit `infra/` folder). The `azd provision` command creates the Azure Container Registry and Managed Identity resources but doesn't automatically populate the environment variables that `azd deploy` needs to reference them.

> ⚠️ **Prevention is Better:** For .NET Aspire projects, this issue should be addressed PROACTIVELY before deployment by setting up environment variables after `azd init` but before `azd up`. This avoids deployment failures entirely.

**Solution:**

After `azd provision` succeeds, manually set the missing environment variables by querying the provisioned resources:

```bash
# Get the resource group name (typically rg-{environment-name})
azd env get-values

# Set container registry endpoint
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT $(az acr list --resource-group <resource-group-name> --query "[0].loginServer" -o tsv)

# Set managed identity resource ID
azd env set AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID $(az identity list --resource-group <resource-group-name> --query "[0].id" -o tsv)

# Set managed identity client ID
azd env set MANAGED_IDENTITY_CLIENT_ID $(az identity list --resource-group <resource-group-name> --query "[0].clientId" -o tsv)
```

**PowerShell:**

```powershell
# Set container registry endpoint
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT (az acr list --resource-group <resource-group-name> --query "[0].loginServer" -o tsv)

# Set managed identity resource ID
azd env set AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID (az identity list --resource-group <resource-group-name> --query "[0].id" -o tsv)

# Set managed identity client ID
azd env set MANAGED_IDENTITY_CLIENT_ID (az identity list --resource-group <resource-group-name> --query "[0].clientId" -o tsv)
```

After setting these variables, retry the deployment:

```bash
azd deploy --no-prompt
```

> 💡 **Tip:** This issue is specific to Aspire limited mode. Manually setting these environment variables after `azd provision` is the recommended workaround.

## Retry

After fixing the issue:

```bash
azd up --no-prompt
```

## Cleanup (DESTRUCTIVE)

```bash
azd down --force --purge
```

⚠️ Permanently deletes ALL resources including databases and Key Vaults.
