<#
.SYNOPSIS
    Deploy Nordic Fresh Foods infrastructure to Azure using phased Bicep deployment.

.DESCRIPTION
    Deploys the nordic-fresh-foods project in 5 phases with approval gates.
    Supports re-entry via -StartFromPhase parameter.

.PARAMETER ResourceGroup
    Target resource group name.

.PARAMETER Location
    Azure region (default: swedencentral).

.PARAMETER Environment
    Deployment environment: dev or prod.

.PARAMETER StartFromPhase
    Phase to start from (1-5). Use for re-entry after a failed phase.

.PARAMETER WhatIf
    Run what-if preview without deploying.

.EXAMPLE
    ./deploy.ps1 -ResourceGroup "rg-nordic-fresh-foods-prod" -Environment "prod"
    ./deploy.ps1 -ResourceGroup "rg-nordic-fresh-foods-dev" -Environment "dev" -StartFromPhase 3
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter()]
    [string]$Location = "swedencentral",

    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "prod")]
    [string]$Environment,

    [Parameter()]
    [ValidateRange(1, 5)]
    [int]$StartFromPhase = 1,

    [Parameter()]
    [string]$TechnicalContact = "cto@nordicfreshfoods.eu",

    [Parameter()]
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

# ──────────────────────────────────────────────
# Banner
# ──────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Nordic Fresh Foods — Bicep Deployment          ║" -ForegroundColor Cyan
Write-Host "║   Environment: $($Environment.PadRight(35))║" -ForegroundColor Cyan
Write-Host "║   Region: $($Location.PadRight(40))║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ──────────────────────────────────────────────
# Prerequisites
# ──────────────────────────────────────────────

Write-Host "[CHECK] Verifying Azure CLI login..." -ForegroundColor Yellow
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Error "Not logged in to Azure CLI. Run 'az login' first."
    exit 1
}
Write-Host "[OK] Logged in as: $($account.user.name) | Subscription: $($account.name)" -ForegroundColor Green

# Validate ARM token is live (MSAL cache can be stale in devcontainers)
Write-Host "[CHECK] Validating ARM token..." -ForegroundColor Yellow
$tokenTest = az account get-access-token --resource https://management.azure.com/ --output json 2>$null
if (-not $tokenTest) {
    Write-Error "ARM token invalid or expired. Re-authenticate: 'az login --use-device-code'"
    exit 1
}
Write-Host "[OK] ARM token valid" -ForegroundColor Green

# Verify Bicep CLI
$bicepVersion = az bicep version 2>$null
if (-not $bicepVersion) {
    Write-Host "[INSTALL] Installing Bicep CLI..." -ForegroundColor Yellow
    az bicep install
}

# Select parameter file
$paramFile = if ($Environment -eq "dev") { "main.dev.bicepparam" } else { "main.bicepparam" }
$templateFile = "main.bicep"

# Verify files exist
if (-not (Test-Path $templateFile)) {
    Write-Error "Template file '$templateFile' not found. Run from infra/bicep/nordic-fresh-foods/ directory."
    exit 1
}
if (-not (Test-Path $paramFile)) {
    Write-Error "Parameter file '$paramFile' not found."
    exit 1
}

# ──────────────────────────────────────────────
# Governance Tag Validation
# ──────────────────────────────────────────────

$requiredTags = @("environment", "owner", "costcenter", "application", "workload", "sla", "backup-policy", "maint-window", "technical-contact")
Write-Host "[CHECK] Resource group will require $($requiredTags.Count) mandatory tags (Azure Policy Deny)" -ForegroundColor Yellow

# ──────────────────────────────────────────────
# Phase definitions
# ──────────────────────────────────────────────

$phases = @(
    @{ Number = 1; Name = "Foundation"; Phase = "foundation"; Description = "VNet + Subnets + NSGs" }
    @{ Number = 2; Name = "Observability"; Phase = "observability"; Description = "Log Analytics + App Insights" }
    @{ Number = 3; Name = "Security"; Phase = "security"; Description = "Key Vault + DNS Zones + PE (KV)" }
    @{ Number = 4; Name = "Data"; Phase = "data"; Description = "SQL Server + Storage + PEs" }
    @{ Number = 5; Name = "Compute"; Phase = "compute"; Description = "App Service + Budget + RBAC" }
)

# ──────────────────────────────────────────────
# Resource Group Creation (Phase 0)
# ──────────────────────────────────────────────

if ($StartFromPhase -le 1) {
    Write-Host ""
    Write-Host "═══ Phase 0: Resource Group ═══" -ForegroundColor Magenta

    $rgExists = az group exists --name $ResourceGroup 2>$null
    if ($rgExists -eq "false") {
        Write-Host "[CREATE] Creating resource group: $ResourceGroup" -ForegroundColor Yellow

        if (-not $WhatIf) {
            az group create `
                --name $ResourceGroup `
                --location $Location `
                --tags "environment=$Environment" "owner=nordic-fresh-foods-team" "costcenter=NFF-001" "application=freshconnect" "workload=web-app" "sla=99.9%" "backup-policy=daily-30d" "maint-window=sun-02:00-06:00-utc" "technical-contact=$TechnicalContact" `
                --output none

            Write-Host "[OK] Resource group created with all 9 mandatory tags" -ForegroundColor Green
        }
        else {
            Write-Host "[WHATIF] Would create resource group: $ResourceGroup" -ForegroundColor DarkYellow
        }
    }
    else {
        Write-Host "[OK] Resource group already exists: $ResourceGroup" -ForegroundColor Green
    }
}

# ──────────────────────────────────────────────
# Phase Execution Loop
# ──────────────────────────────────────────────

foreach ($phaseInfo in $phases) {
    if ($phaseInfo.Number -lt $StartFromPhase) {
        Write-Host ""
        Write-Host "[SKIP] Phase $($phaseInfo.Number): $($phaseInfo.Name) (starting from phase $StartFromPhase)" -ForegroundColor DarkGray
        continue
    }

    Write-Host ""
    Write-Host "═══ Phase $($phaseInfo.Number): $($phaseInfo.Name) — $($phaseInfo.Description) ═══" -ForegroundColor Magenta

    # Approval gate (prod only, skip for phase 1)
    if ($Environment -eq "prod" -and $phaseInfo.Number -gt 1 -and -not $WhatIf) {
        Write-Host ""
        $response = Read-Host "  Proceed with Phase $($phaseInfo.Number)? (y/n)"
        if ($response -ne "y") {
            Write-Host "[ABORT] Deployment stopped at Phase $($phaseInfo.Number)" -ForegroundColor Red
            exit 0
        }
    }

    # What-If preview
    Write-Host "[PREVIEW] Running what-if for Phase $($phaseInfo.Number)..." -ForegroundColor Yellow
    az deployment group what-if `
        --resource-group $ResourceGroup `
        --template-file $templateFile `
        --parameters $paramFile `
        --parameters phase=$($phaseInfo.Phase) `
        --no-pretty-print `
        --output table 2>$null

    if ($WhatIf) {
        Write-Host "[WHATIF] Phase $($phaseInfo.Number) preview complete" -ForegroundColor DarkYellow
        continue
    }

    # Deploy
    Write-Host "[DEPLOY] Deploying Phase $($phaseInfo.Number)..." -ForegroundColor Yellow
    $deploymentName = "nff-$Environment-phase$($phaseInfo.Number)-$(Get-Date -Format 'yyyyMMddHHmmss')"

    $result = az deployment group create `
        --resource-group $ResourceGroup `
        --template-file $templateFile `
        --parameters $paramFile `
        --parameters phase=$($phaseInfo.Phase) `
        --name $deploymentName `
        --output json 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Error "[FAIL] Phase $($phaseInfo.Number) deployment failed. Re-run with -StartFromPhase $($phaseInfo.Number)"
        Write-Host $result -ForegroundColor Red
        exit 1
    }

    $deployment = $result | ConvertFrom-Json
    Write-Host "[OK] Phase $($phaseInfo.Number): $($phaseInfo.Name) — $($deployment.properties.provisioningState)" -ForegroundColor Green

    # Track phase 2 deployment name for post-deploy activity log routing
    if ($phaseInfo.Number -eq 2) { $phase2DeploymentName = $deploymentName }
}

# ──────────────────────────────────────────────
# Activity Log Diagnostic Routing (subscription-scoped)
# ──────────────────────────────────────────────

if (-not $WhatIf) {
    Write-Host ""
    Write-Host "═══ Post-Deploy: Activity Log Routing ═══" -ForegroundColor Magenta

    $lawId = (az deployment group show `
        --resource-group $ResourceGroup `
        --name $phase2DeploymentName `
        --query "properties.outputs.logAnalyticsWorkspaceName.value" `
        --output tsv 2>$null)

    if ($lawId) {
        Write-Host "[CONFIG] Routing Activity Log to Log Analytics workspace..." -ForegroundColor Yellow
        az monitor diagnostic-settings subscription create `
            --name "activity-to-law-$Environment" `
            --workspace $lawId `
            --logs '[{"category":"Administrative","enabled":true},{"category":"Security","enabled":true},{"category":"Policy","enabled":true}]' `
            --output none 2>$null

        Write-Host "[OK] Activity Log routing configured" -ForegroundColor Green
    }
    else {
        Write-Host "[WARN] Could not retrieve Log Analytics workspace. Configure Activity Log routing manually." -ForegroundColor Yellow
    }
}

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Deployment Complete                            ║" -ForegroundColor Green
Write-Host "║   Resource Group: $($ResourceGroup.PadRight(31))║" -ForegroundColor Green
Write-Host "║   Environment: $($Environment.PadRight(35))║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green

if ($Environment -eq "prod") {
    Write-Host ""
    Write-Host "[POST-DEPLOY] SQL contained user creation required:" -ForegroundColor Yellow
    Write-Host "  Use AzureCLI deploymentScript or connect via PE to create:" -ForegroundColor Yellow
    Write-Host "  CREATE USER [app-nordic-fresh-foods-prod-<suffix>] FROM EXTERNAL PROVIDER;" -ForegroundColor DarkYellow
    Write-Host "  ALTER ROLE db_datareader ADD MEMBER [app-nordic-fresh-foods-prod-<suffix>];" -ForegroundColor DarkYellow
    Write-Host "  ALTER ROLE db_datawriter ADD MEMBER [app-nordic-fresh-foods-prod-<suffix>];" -ForegroundColor DarkYellow
}
