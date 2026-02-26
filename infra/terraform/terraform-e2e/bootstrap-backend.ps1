<#
.SYNOPSIS
    Bootstrap Azure Storage Account for Terraform remote state.
.DESCRIPTION
    Creates the resource group, storage account, and blob container
    required for Terraform remote state. Idempotent — safe to re-run.
.EXAMPLE
    ./bootstrap-backend.ps1
    ./bootstrap-backend.ps1 -ResourceGroup "rg-tfstate-prod" -Location "germanywestcentral"
#>
param(
    [string]$ResourceGroup = "rg-tfstate-dev",
    [string]$StorageAccount = "sttfstatedev",
    [string]$Container = "tfstate",
    [string]$Location = "swedencentral"
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════╗"
Write-Host "║   terraform-e2e — Bootstrap State Backend      ║"
Write-Host "╚════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "Resource Group:  $ResourceGroup"
Write-Host "Storage Account: $StorageAccount"
Write-Host "Container:       $Container"
Write-Host "Location:        $Location"
Write-Host ""

# Verify Azure CLI authentication
try {
    az account get-access-token --output none 2>$null
} catch {
    Write-Error "Azure CLI not authenticated. Run 'az login' first."
    exit 1
}

# Resource group (idempotent — 9 RG tags required by JV-Enforce RG Tags v3 Deny policy)
Write-Host "→ Creating resource group '$ResourceGroup'..."
az group create `
    --name $ResourceGroup `
    --location $Location `
    --tags `
        environment=dev `
        owner=team-terraform `
        costcenter=terraform-e2e `
        application=terraform-e2e `
        workload=tfstate `
        sla=99.9 `
        backup-policy=default `
        maint-window=weekends `
        technical-contact=team-terraform `
    --output none

# Storage account (idempotent — governance: no public blob, HTTPS, TLS 1.2)
$exists = az storage account show --name $StorageAccount --resource-group $ResourceGroup --output none 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "→ Storage account '$StorageAccount' already exists."
} else {
    Write-Host "→ Creating storage account '$StorageAccount'..."
    az storage account create `
        --name $StorageAccount `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --kind StorageV2 `
        --min-tls-version TLS1_2 `
        --https-only true `
        --allow-blob-public-access false `
        --tags Environment=dev ManagedBy=Terraform Project=terraform-e2e Owner=team-terraform `
        --output none
}

# Blob container (idempotent)
$containerExists = az storage container show --name $Container --account-name $StorageAccount --auth-mode login --output none 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "→ Container '$Container' already exists."
} else {
    Write-Host "→ Creating blob container '$Container'..."
    az storage container create `
        --name $Container `
        --account-name $StorageAccount `
        --auth-mode login `
        --output none
}

Write-Host ""
Write-Host "✅ State backend ready."
Write-Host "   Run: terraform init ``"
Write-Host "     -backend-config=`"resource_group_name=$ResourceGroup`" ``"
Write-Host "     -backend-config=`"storage_account_name=$StorageAccount`" ``"
Write-Host "     -backend-config=`"container_name=$Container`""
