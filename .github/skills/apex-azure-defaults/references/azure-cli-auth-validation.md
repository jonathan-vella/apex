<!-- ref:azure-cli-auth-validation-v1 -->

# Azure CLI Token Validation

Standard procedure for validating Azure CLI authentication before
any deployment or Azure API operation.

## Why `az account show` Is Not Enough

Azure CLI stores account metadata (`~/.azure/azureProfile.json`)
separately from MSAL tokens. Container restarts, session timeouts,
or interrupted logins can leave metadata intact while tokens are
missing or expired. The VS Code Azure extension auth context is
also separate — being signed in via the extension does NOT mean
CLI commands will work.

## Two-Step Validation (MANDATORY)

```bash
# Step 1: Quick context check (informational only — NOT auth proof)
az account show --output table

# Step 2: MANDATORY — Validate real ARM token acquisition
az account get-access-token \
  --resource https://management.azure.com/ --output none
```

## Recovery If Step 2 Fails

Error: "User does not exist in MSAL token cache"

1. Run `az login --use-device-code`
   (works reliably in devcontainers/WSL/Codespaces)
2. Run `az account set --subscription {subscription-id}`
3. Re-run Step 2 to confirm token is valid
4. Only then proceed with deployment operations

---

## azd Auth Validation

`azd` maintains a **separate** MSAL token cache (`~/.azd/`), independent of the
Azure CLI (`~/.azure/`). A valid `az` session does NOT grant `azd` any Azure access.
This is the most common cause of "Not logged in" errors when running `azd provision`
in a devcontainer or Codespaces session where `az` is already authenticated.

### Two-Step Validation (MANDATORY before `azd provision` or `azd up`)

```bash
# Step 1: Check existing azd session
azd auth login --check-status

# Step 2: If not logged in, authenticate (device code is reliable in devcontainers)
azd auth login --use-device-code
```

### Service Principal (CI/CD)

```bash
azd auth login \
  --client-id "$AZURE_CLIENT_ID" \
  --client-secret "$AZURE_CLIENT_SECRET" \
  --tenant-id "$AZURE_TENANT_ID"
```

### Combined Preflight (run before `azd provision`)

```bash
az account get-access-token \
  --resource https://management.azure.com/ --output none \
  && azd auth login --check-status \
  && echo "Both auth contexts valid — safe to provision"
```

If either command fails, authentication must be refreshed before proceeding.
