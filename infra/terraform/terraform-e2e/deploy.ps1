<#
.SYNOPSIS
    Deploy terraform-e2e infrastructure to Azure.
.DESCRIPTION
    Initializes Terraform with Azure Storage backend, plans, and applies
    the configuration with user approval. Supports phased deployment.
.EXAMPLE
    ./deploy.ps1
    ./deploy.ps1 -DeploymentPhase 1
    ./deploy.ps1 -Environment "staging" -DeploymentPhase 2
#>
param(
    [string]$ResourceGroup = "rg-tfstate-dev",
    [string]$StorageAccount = "sttfstatedev",
    [string]$Container = "tfstate",
    [string]$Location = "swedencentral",
    [string]$Environment = "dev",
    [int]$DeploymentPhase = 3
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════╗"
Write-Host "║   terraform-e2e — Terraform Deploy             ║"
Write-Host "╚════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "Backend RG:       $ResourceGroup"
Write-Host "Storage Account:  $StorageAccount"
Write-Host "Container:        $Container"
Write-Host "Location:         $Location"
Write-Host "Environment:      $Environment"
Write-Host "Deployment Phase: $DeploymentPhase"
Write-Host ""

# Verify Azure CLI authentication
try {
    az account get-access-token --output none 2>$null
} catch {
    Write-Error "Azure CLI not authenticated. Run 'az login' first."
    exit 1
}

$SubscriptionId = (az account show --query id -o tsv)
Write-Host "Subscription:     $SubscriptionId"
Write-Host ""

# Initialize Terraform with backend config
Write-Host "═══ terraform init ═══"
terraform init `
    -backend-config="resource_group_name=$ResourceGroup" `
    -backend-config="storage_account_name=$StorageAccount" `
    -backend-config="container_name=$Container"

# Validate configuration
Write-Host ""
Write-Host "═══ terraform validate ═══"
terraform validate

# Plan
Write-Host ""
Write-Host "═══ terraform plan ═══"
terraform plan `
    -var="subscription_id=$SubscriptionId" `
    -var="environment=$Environment" `
    -var="location=$Location" `
    -var="deployment_phase=$DeploymentPhase" `
    -out=tfplan

# Approval gate
Write-Host ""
Write-Host "─────────────────────────────────────────────────"
Write-Host "Review the plan above. Continue with apply?"
Write-Host "─────────────────────────────────────────────────"
$confirm = Read-Host "Type 'yes' to apply"
if ($confirm -ne "yes") {
    Write-Host "Aborted."
    exit 0
}

# Apply
Write-Host ""
Write-Host "═══ terraform apply ═══"
terraform apply tfplan

# Output
Write-Host ""
Write-Host "═══ terraform output ═══"
terraform output

Write-Host ""
Write-Host "✅ Deployment complete (phase $DeploymentPhase)."
