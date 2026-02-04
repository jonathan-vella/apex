<#
.SYNOPSIS
    Deploys Agent Testing infrastructure to Azure.

.DESCRIPTION
    Deploys Bicep templates for the Agent Testing framework with proper validation,
    what-if analysis, and user confirmation. Supports all three test scenarios:
    - Scenario 1: Static Web Apps (SWA)
    - Scenario 2: Multi-tier (App Service + SQL)
    - Scenario 3: Microservices (Container Apps + Service Bus)

.PARAMETER Environment
    Target environment (dev, test, staging, prod).
    Default: test

.PARAMETER Location
    Azure region for deployment.
    Default: swedencentral

.PARAMETER ResourceGroupName
    Name of the resource group to deploy to.
    If not specified, uses pattern: rg-agenttest-{environment}-{location}

.PARAMETER Scenario
    Which test scenario(s) to deploy.
    Valid values: All, SWA, MultiTier, Microservices
    Default: All

.PARAMETER WhatIf
    Shows what would happen if the deployment runs without actually deploying.

.PARAMETER SkipValidation
    Skips Bicep lint and build validation (not recommended).

.EXAMPLE
    .\deploy.ps1 -Environment test -Scenario All

.EXAMPLE
    .\deploy.ps1 -Environment dev -Scenario SWA -WhatIf

.NOTES
    Author: Agentic InfraOps - bicep-code agent
    Version: 1.0.0
    Requires: Azure CLI, Bicep CLI
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('dev', 'test', 'staging', 'prod')]
    [string]$Environment = 'test',

    [Parameter(Mandatory = $false)]
    [ValidateSet('swedencentral', 'germanywestcentral', 'westeurope', 'northeurope')]
    [string]$Location = 'swedencentral',

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $false)]
    [ValidateSet('All', 'SWA', 'MultiTier', 'Microservices')]
    [string]$Scenario = 'All',

    [Parameter(Mandatory = $false)]
    [switch]$SkipValidation
)

# ============================================================================
# Configuration
# ============================================================================

$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$BicepPath = Join-Path $ScriptPath 'main.bicep'
$ParamPath = Join-Path $ScriptPath 'main.bicepparam'

# Region abbreviations for naming
$regionMap = @{
    'swedencentral' = 'swc'
    'germanywestcentral' = 'gwc'
    'westeurope' = 'weu'
    'northeurope' = 'neu'
}
$locationAbbr = $regionMap[$Location]

# Default resource group name
if (-not $ResourceGroupName) {
    $ResourceGroupName = "rg-agenttest-$Environment-$locationAbbr"
}

# ============================================================================
# Banner
# ============================================================================

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                                       ║" -ForegroundColor Cyan
Write-Host "║   █████╗  ██████╗ ███████╗███╗   ██╗████████╗    ████████╗███████╗███████╗████████╗   ║" -ForegroundColor Cyan
Write-Host "║  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝    ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝   ║" -ForegroundColor Cyan
Write-Host "║  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║          ██║   █████╗  ███████╗   ██║      ║" -ForegroundColor Cyan
Write-Host "║  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║          ██║   ██╔══╝  ╚════██║   ██║      ║" -ForegroundColor Cyan
Write-Host "║  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║          ██║   ███████╗███████║   ██║      ║" -ForegroundColor Cyan
Write-Host "║  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝          ╚═╝   ╚══════╝╚══════╝   ╚═╝      ║" -ForegroundColor Cyan
Write-Host "║                                                                       ║" -ForegroundColor Cyan
Write-Host "║                    Agent Testing Framework                            ║" -ForegroundColor Cyan
Write-Host "║                    Infrastructure Deployment                          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Configuration Display
# ============================================================================

Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│  DEPLOYMENT CONFIGURATION                                          │" -ForegroundColor DarkGray
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  • Environment:     $Environment" -ForegroundColor White
Write-Host "  • Location:        $Location" -ForegroundColor White
Write-Host "  • Resource Group:  $ResourceGroupName" -ForegroundColor White
Write-Host "  • Scenario:        $Scenario" -ForegroundColor White
Write-Host "  • Template:        $BicepPath" -ForegroundColor White
Write-Host ""

# ============================================================================
# Pre-flight Checks
# ============================================================================

Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│  PRE-FLIGHT CHECKS                                                 │" -ForegroundColor DarkGray
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

# Check Azure CLI
Write-Host "  [1/4] Checking Azure CLI..." -ForegroundColor Gray
try {
    $azVersion = az version --output json 2>$null | ConvertFrom-Json
    Write-Host "      └─ Azure CLI v$($azVersion.'azure-cli')" -ForegroundColor Green
}
catch {
    Write-Host "      └─ ✗ Azure CLI not found. Install from https://aka.ms/installazurecli" -ForegroundColor Red
    exit 1
}

# Check Bicep CLI
Write-Host "  [2/4] Checking Bicep CLI..." -ForegroundColor Gray
try {
    $bicepVersion = az bicep version 2>&1
    if ($bicepVersion -match 'Bicep CLI version (\d+\.\d+\.\d+)') {
        Write-Host "      └─ Bicep CLI v$($Matches[1])" -ForegroundColor Green
    }
    else {
        Write-Host "      └─ Installing Bicep CLI..." -ForegroundColor Yellow
        az bicep install
    }
}
catch {
    Write-Host "      └─ ✗ Bicep CLI check failed" -ForegroundColor Red
    exit 1
}

# Check Azure authentication
Write-Host "  [3/4] Checking Azure authentication..." -ForegroundColor Gray
try {
    $account = az account show --output json 2>$null | ConvertFrom-Json
    Write-Host "      └─ Authenticated as: $($account.user.name)" -ForegroundColor Green
    Write-Host "      └─ Subscription: $($account.name)" -ForegroundColor Green
}
catch {
    Write-Host "      └─ ✗ Not authenticated. Run 'az login' first." -ForegroundColor Red
    exit 1
}

# Check template exists
Write-Host "  [4/4] Checking Bicep template..." -ForegroundColor Gray
if (Test-Path $BicepPath) {
    Write-Host "      └─ Template found: main.bicep" -ForegroundColor Green
}
else {
    Write-Host "      └─ ✗ Template not found: $BicepPath" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# Template Validation
# ============================================================================

if (-not $SkipValidation) {
    Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "│  TEMPLATE VALIDATION                                               │" -ForegroundColor DarkGray
    Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host ""

    # Bicep lint
    Write-Host "  [1/2] Running Bicep lint..." -ForegroundColor Gray
    $lintResult = az bicep lint --file $BicepPath 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      └─ ✓ Lint passed" -ForegroundColor Green
    }
    else {
        Write-Host "      └─ ⚠ Lint warnings:" -ForegroundColor Yellow
        $lintResult | ForEach-Object { Write-Host "         $_" -ForegroundColor Yellow }
    }

    # Bicep build
    Write-Host "  [2/2] Running Bicep build..." -ForegroundColor Gray
    $buildResult = az bicep build --file $BicepPath --stdout 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      └─ ✓ Build passed" -ForegroundColor Green
    }
    else {
        Write-Host "      └─ ✗ Build failed:" -ForegroundColor Red
        $buildResult | ForEach-Object { Write-Host "         $_" -ForegroundColor Red }
        exit 1
    }

    Write-Host ""
}

# ============================================================================
# Resource Group Creation
# ============================================================================

Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│  RESOURCE GROUP                                                    │" -ForegroundColor DarkGray
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

# Check if RG exists
$rgExists = az group exists --name $ResourceGroupName 2>$null
if ($rgExists -eq 'true') {
    Write-Host "  • Resource group exists: $ResourceGroupName" -ForegroundColor Green
}
else {
    Write-Host "  • Creating resource group: $ResourceGroupName" -ForegroundColor Yellow
    if ($PSCmdlet.ShouldProcess($ResourceGroupName, "Create resource group")) {
        az group create `
            --name $ResourceGroupName `
            --location $Location `
            --tags Environment=$Environment ManagedBy=Bicep Project=AgentTesting TTL=2h `
            --output none
        Write-Host "  • ✓ Resource group created" -ForegroundColor Green
    }
}

Write-Host ""

# ============================================================================
# Deployment Parameters
# ============================================================================

# Map scenario to booleans
$deploySwa = ($Scenario -eq 'All' -or $Scenario -eq 'SWA')
$deployMultiTier = ($Scenario -eq 'All' -or $Scenario -eq 'MultiTier')
$deployMicroservices = ($Scenario -eq 'All' -or $Scenario -eq 'Microservices')

# ============================================================================
# What-If Analysis
# ============================================================================

Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│  CHANGE ANALYSIS (What-If)                                         │" -ForegroundColor DarkGray
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  Analyzing deployment changes..." -ForegroundColor Gray

$whatIfResult = az deployment group what-if `
    --resource-group $ResourceGroupName `
    --template-file $BicepPath `
    --parameters environment=$Environment `
    --parameters location=$Location `
    --parameters deployScenario1Swa=$deploySwa `
    --parameters deployScenario2MultiTier=$deployMultiTier `
    --parameters deployScenario3Microservices=$deployMicroservices `
    --result-format FullResourcePayloads `
    --output json 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue

# Parse what-if results
$createCount = 0
$modifyCount = 0
$deleteCount = 0
$noChangeCount = 0

if ($whatIfResult.changes) {
    foreach ($change in $whatIfResult.changes) {
        switch ($change.changeType) {
            'Create' { $createCount++ }
            'Modify' { $modifyCount++ }
            'Delete' { $deleteCount++ }
            'NoChange' { $noChangeCount++ }
        }
    }
}

Write-Host ""
Write-Host "┌─────────────────────────────────────┐" -ForegroundColor White
Write-Host "│  CHANGE SUMMARY                     │" -ForegroundColor White
Write-Host "│  + Create: $($createCount.ToString().PadLeft(3)) resources            │" -ForegroundColor Green
Write-Host "│  ~ Modify: $($modifyCount.ToString().PadLeft(3)) resources            │" -ForegroundColor Yellow
Write-Host "│  - Delete: $($deleteCount.ToString().PadLeft(3)) resources            │" -ForegroundColor Red
Write-Host "│  = No change: $($noChangeCount.ToString().PadLeft(3)) resources       │" -ForegroundColor Gray
Write-Host "└─────────────────────────────────────┘" -ForegroundColor White
Write-Host ""

# ============================================================================
# User Confirmation
# ============================================================================

if (-not $WhatIfPreference) {
    Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "│  DEPLOYMENT CONFIRMATION                                           │" -ForegroundColor DarkGray
    Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  The deployment will:" -ForegroundColor White
    Write-Host "    • Create $createCount new Azure resources" -ForegroundColor White
    Write-Host "    • Deploy to: $ResourceGroupName" -ForegroundColor White
    Write-Host "    • Estimated time: 5-10 minutes" -ForegroundColor White
    Write-Host ""
    
    $confirmation = Read-Host "  Do you want to proceed? (yes/no)"
    if ($confirmation -ne 'yes') {
        Write-Host ""
        Write-Host "  ✗ Deployment cancelled by user" -ForegroundColor Yellow
        exit 0
    }
}

# ============================================================================
# Deployment
# ============================================================================

Write-Host ""
Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│  DEPLOYING INFRASTRUCTURE                                          │" -ForegroundColor DarkGray
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

if ($PSCmdlet.ShouldProcess($ResourceGroupName, "Deploy Bicep template")) {
    $deploymentName = "agent-testing-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    Write-Host "  Deployment name: $deploymentName" -ForegroundColor Gray
    Write-Host "  Starting deployment..." -ForegroundColor Gray
    Write-Host ""

    $deployResult = az deployment group create `
        --resource-group $ResourceGroupName `
        --template-file $BicepPath `
        --name $deploymentName `
        --parameters environment=$Environment `
        --parameters location=$Location `
        --parameters deployScenario1Swa=$deploySwa `
        --parameters deployScenario2MultiTier=$deployMultiTier `
        --parameters deployScenario3Microservices=$deployMicroservices `
        --output json 2>&1 | ConvertFrom-Json

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  ✓ DEPLOYMENT SUCCESSFUL" -ForegroundColor Green
        Write-Host ""

        # ============================================================================
        # Deployment Outputs
        # ============================================================================

        Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
        Write-Host "│  DEPLOYED RESOURCES                                                │" -ForegroundColor DarkGray
        Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
        Write-Host ""

        $outputs = $deployResult.properties.outputs

        if ($outputs.staticWebAppUrl) {
            Write-Host "  Static Web App:" -ForegroundColor Cyan
            Write-Host "    URL: $($outputs.staticWebAppUrl.value)" -ForegroundColor White
        }

        if ($outputs.appServiceUrl) {
            Write-Host "  App Service:" -ForegroundColor Cyan
            Write-Host "    URL: $($outputs.appServiceUrl.value)" -ForegroundColor White
        }

        if ($outputs.keyVaultUri) {
            Write-Host "  Key Vault:" -ForegroundColor Cyan
            Write-Host "    URI: $($outputs.keyVaultUri.value)" -ForegroundColor White
        }

        if ($outputs.containerAppFqdn) {
            Write-Host "  Container App:" -ForegroundColor Cyan
            Write-Host "    FQDN: $($outputs.containerAppFqdn.value)" -ForegroundColor White
        }

        Write-Host ""

        # ============================================================================
        # Next Steps
        # ============================================================================

        Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
        Write-Host "│  NEXT STEPS                                                        │" -ForegroundColor DarkGray
        Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  1. Verify resources in Azure Portal:" -ForegroundColor White
        Write-Host "     https://portal.azure.com/#@/resource/subscriptions/$($account.id)/resourceGroups/$ResourceGroupName" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  2. Run test scenarios against deployed infrastructure" -ForegroundColor White
        Write-Host ""
        Write-Host "  3. Resources will auto-cleanup after 2 hours (TTL tag)" -ForegroundColor White
        Write-Host ""
        Write-Host "  4. Manual cleanup (if needed):" -ForegroundColor White
        Write-Host "     az group delete --name $ResourceGroupName --yes --no-wait" -ForegroundColor Gray
        Write-Host ""
    }
    else {
        Write-Host ""
        Write-Host "  ✗ DEPLOYMENT FAILED" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Error details:" -ForegroundColor Red
        $deployResult | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        exit 1
    }
}
else {
    Write-Host "  [What-If Mode] - No resources were deployed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
