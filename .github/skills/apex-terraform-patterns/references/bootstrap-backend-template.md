<!-- ref:bootstrap-backend-template-v1 -->

# Bootstrap Backend Script Templates

Idempotent scripts that provision the Azure Storage Account backend
BEFORE `terraform init` can be run. Both must be generated for every
Terraform project.

## Requirements

- **Parameterized**: Accept `RESOURCE_GROUP`, `STORAGE_ACCOUNT`, `CONTAINER`,
  `LOCATION` as parameters (with sensible defaults)
- **Idempotent**: Check whether each resource exists before creating it
- **Governance-aware**: Read `04-governance-constraints.json` for naming policies
  BEFORE setting default names

## Bash Template (`bootstrap-backend.sh`)

```bash
#!/usr/bin/env bash
# Bootstrap Azure Storage Account for Terraform remote state
set -euo pipefail

RESOURCE_GROUP="${1:-rg-tfstate-{project}}"
STORAGE_ACCOUNT="${2:-sttfstate{suffix}}"
CONTAINER="${3:-tfstate}"
LOCATION="${4:-swedencentral}"

echo "=== Bootstrapping Terraform Backend ==="
echo "Resource Group:  $RESOURCE_GROUP"
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Container:       $CONTAINER"
echo "Location:        $LOCATION"

# Resource Group (idempotent)
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none 2>/dev/null || true

# Storage Account (check-then-create)
if ! az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --min-tls-version TLS1_2 \
    --allow-blob-public-access false \
    --https-only true \
    --output none
fi

# Container (check-then-create)
if ! az storage container show --name "$CONTAINER" --account-name "$STORAGE_ACCOUNT" &>/dev/null; then
  az storage container create \
    --name "$CONTAINER" \
    --account-name "$STORAGE_ACCOUNT" \
    --output none
fi

echo "=== Backend bootstrap complete ==="
```

## PowerShell Template (`bootstrap-backend.ps1`)

```powershell
<#
.SYNOPSIS
    Bootstrap Azure Storage Account for Terraform remote state.
.DESCRIPTION
    Idempotent script — safe to re-run. Creates resource group, storage
    account, and blob container for Terraform state backend.
#>
param(
    [string]$ResourceGroup = "rg-tfstate-{project}",
    [string]$StorageAccount = "sttfstate{suffix}",
    [string]$Container = "tfstate",
    [string]$Location = "swedencentral"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Bootstrapping Terraform Backend ===" -ForegroundColor Cyan
Write-Host "Resource Group:  $ResourceGroup"
Write-Host "Storage Account: $StorageAccount"
Write-Host "Container:       $Container"
Write-Host "Location:        $Location"

# Resource Group (idempotent)
az group create --name $ResourceGroup --location $Location --output none 2>$null

# Storage Account (check-then-create)
$saExists = az storage account show --name $StorageAccount --resource-group $ResourceGroup 2>$null
if (-not $saExists) {
    az storage account create `
        --name $StorageAccount `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --kind StorageV2 `
        --min-tls-version TLS1_2 `
        --allow-blob-public-access false `
        --https-only true `
        --output none
}

# Container (check-then-create)
$containerExists = az storage container show --name $Container --account-name $StorageAccount 2>$null
if (-not $containerExists) {
    az storage container create `
        --name $Container `
        --account-name $StorageAccount `
        --output none
}

Write-Host "=== Backend bootstrap complete ===" -ForegroundColor Green
```

## Naming Defaults

Replace `{project}` and `{suffix}` with actual values from governance
constraints and the unique suffix pattern. If governance policies enforce
naming conventions, those take precedence.
