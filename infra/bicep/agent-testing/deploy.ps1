<#
.SYNOPSIS
    Deploys Agent Testing Infrastructure to Azure.

.DESCRIPTION
    This script deploys the agent-testing infrastructure using Azure Bicep templates.
    It performs pre-flight validation, what-if analysis, and deployment with user confirmation.

.PARAMETER ResourceGroupName
    Name of the resource group to deploy to. Default: rg-agenttest-dev

.PARAMETER Location
    Azure region for deployment. Default: swedencentral

.PARAMETER Environment
    Environment name (dev, staging, prod). Default: dev

.PARAMETER SqlAdminGroupObjectId
    Azure AD Group Object ID for SQL Server administrators.
    If not provided, uses the current user's Object ID.

.PARAMETER WhatIf
    Shows what would happen if the cmdlet runs. The deployment does not occur.

.EXAMPLE
    .\deploy.ps1
    Deploys with default settings, auto-detecting SQL admin.

.EXAMPLE
    .\deploy.ps1 -WhatIf
    Shows deployment preview without making changes.

.EXAMPLE
    .\deploy.ps1 -SqlAdminGroupObjectId "00000000-0000-0000-0000-000000000000"
    Deploys with specified SQL admin group.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter()]
    [string]$ResourceGroupName = 'rg-agenttest-dev',

    [Parameter()]
    [ValidateSet('swedencentral', 'germanywestcentral', 'westeurope', 'northeurope')]
    [string]$Location = 'swedencentral',

    [Parameter()]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',

    [Parameter()]
    [string]$SqlAdminGroupObjectId = ''
)

# =============================================================================
# CONFIGURATION
# =============================================================================

$ErrorActionPreference = 'Stop'
$ScriptPath = $PSScriptRoot
$TemplateFile = Join-Path $ScriptPath 'main.bicep'
$ParametersFile = Join-Path $ScriptPath 'main.bicepparam'

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

function Write-Banner {
    param([string]$Text)
    $line = '═' * 75
    Write-Host ""
    Write-Host "╔$line╗" -ForegroundColor Cyan
    Write-Host "║  $($Text.PadRight(72))║" -ForegroundColor Cyan
    Write-Host "╚$line╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    $line = '─' * 72
    Write-Host ""
    Write-Host "┌$line┐" -ForegroundColor DarkCyan
    Write-Host "│  $($Text.PadRight(69))│" -ForegroundColor DarkCyan
    Write-Host "└$line┘" -ForegroundColor DarkCyan
}

function Write-Step {
    param([int]$Number, [int]$Total, [string]$Text)
    Write-Host "  [$Number/$Total] $Text" -ForegroundColor Yellow
}

function Write-SubStep {
    param([string]$Text)
    Write-Host "      └─ $Text" -ForegroundColor Gray
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Label, [string]$Value)
    Write-Host "      • " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($Label): " -NoNewline -ForegroundColor White
    Write-Host $Value -ForegroundColor Cyan
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

Write-Banner "AGENT TESTING INFRASTRUCTURE DEPLOYMENT"

Write-Section "DEPLOYMENT CONFIGURATION"

Write-Info "Resource Group" $ResourceGroupName
Write-Info "Location" $Location
Write-Info "Environment" $Environment
Write-Info "Template" $TemplateFile

# -----------------------------------------------------------------------------
# Step 1: Pre-flight Checks
# -----------------------------------------------------------------------------

Write-Section "PRE-FLIGHT CHECKS"

Write-Step 1 5 "Checking Azure CLI..."
$azVersion = az version --output json 2>$null | ConvertFrom-Json
if (-not $azVersion) {
    Write-Error "Azure CLI not found. Install from https://aka.ms/installazurecli"
    exit 1
}
Write-SubStep "Azure CLI v$($azVersion.'azure-cli') ✓"

Write-Step 2 5 "Checking Bicep CLI..."
$bicepVersion = bicep --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Bicep CLI not found. Install with: az bicep install"
    exit 1
}
Write-SubStep "$bicepVersion ✓"

Write-Step 3 5 "Checking Azure authentication..."
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Error "Not logged in to Azure. Run: az login"
    exit 1
}
Write-SubStep "Subscription: $($account.name) ✓"
Write-SubStep "User: $($account.user.name)"

Write-Step 4 5 "Validating template syntax..."
$buildResult = bicep build $TemplateFile --stdout 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Template validation failed:"
    Write-Host $buildResult -ForegroundColor Red
    exit 1
}
Write-SubStep "Syntax valid ✓"

Write-Step 5 5 "Running Bicep lint..."
bicep lint $TemplateFile 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      └─ Lint warnings detected (non-blocking)" -ForegroundColor Yellow
} else {
    Write-SubStep "Lint passed ✓"
}

# -----------------------------------------------------------------------------
# Step 2: Auto-detect SQL Admin if not provided
# -----------------------------------------------------------------------------

if ([string]::IsNullOrEmpty($SqlAdminGroupObjectId)) {
    Write-Section "AUTO-DETECTING SQL ADMINISTRATOR"
    
    Write-Step 1 1 "Getting current user Object ID..."
    $currentUser = az ad signed-in-user show --query id -o tsv 2>$null
    if ($currentUser) {
        $SqlAdminGroupObjectId = $currentUser
        $currentUserUpn = az ad signed-in-user show --query userPrincipalName -o tsv 2>$null
        Write-SubStep "Using current user: $currentUserUpn"
        Write-SubStep "Object ID: $SqlAdminGroupObjectId"
    } else {
        Write-Error "Could not detect current user. Please provide -SqlAdminGroupObjectId"
        exit 1
    }
}

# -----------------------------------------------------------------------------
# Step 3: Ensure Resource Group Exists
# -----------------------------------------------------------------------------

Write-Section "RESOURCE GROUP"

$rgExists = az group show --name $ResourceGroupName --output json 2>$null
if (-not $rgExists) {
    Write-Step 1 1 "Creating resource group..."
    az group create --name $ResourceGroupName --location $Location --output none
    Write-SubStep "Created: $ResourceGroupName in $Location ✓"
} else {
    Write-Step 1 1 "Resource group exists ✓"
    Write-SubStep "$ResourceGroupName in $(($rgExists | ConvertFrom-Json).location)"
}

# -----------------------------------------------------------------------------
# Step 4: What-If Analysis
# -----------------------------------------------------------------------------

Write-Section "CHANGE PREVIEW (WHAT-IF)"

Write-Step 1 1 "Analyzing changes..."

$whatIfOutput = az deployment group what-if `
    --resource-group $ResourceGroupName `
    --template-file $TemplateFile `
    --parameters `
        location=$Location `
        environment=$Environment `
        projectName='agenttest' `
        sqlAdminGroupObjectId=$SqlAdminGroupObjectId `
        sqlAdminGroupName='SQL Administrators' `
    --output json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "What-if analysis failed:"
    Write-Host $whatIfOutput -ForegroundColor Red
    exit 1
}

# Parse what-if results
try {
    $whatIfJson = $whatIfOutput | ConvertFrom-Json
    $changes = $whatIfJson.changes
    
    $createCount = ($changes | Where-Object { $_.changeType -eq 'Create' }).Count
    $modifyCount = ($changes | Where-Object { $_.changeType -eq 'Modify' }).Count
    $deleteCount = ($changes | Where-Object { $_.changeType -eq 'Delete' }).Count
    $noChangeCount = ($changes | Where-Object { $_.changeType -eq 'NoChange' }).Count
    
    Write-Host ""
    Write-Host "┌─────────────────────────────────────────┐" -ForegroundColor DarkCyan
    Write-Host "│  CHANGE SUMMARY                          │" -ForegroundColor DarkCyan
    Write-Host "│  + Create: $($createCount.ToString().PadLeft(3)) resources                 │" -ForegroundColor Green
    Write-Host "│  ~ Modify: $($modifyCount.ToString().PadLeft(3)) resources                 │" -ForegroundColor Yellow
    Write-Host "│  - Delete: $($deleteCount.ToString().PadLeft(3)) resources                 │" -ForegroundColor Red
    Write-Host "│  = NoChange: $($noChangeCount.ToString().PadLeft(3)) resources               │" -ForegroundColor Gray
    Write-Host "└─────────────────────────────────────────┘" -ForegroundColor DarkCyan
} catch {
    Write-Host "      └─ What-if output:" -ForegroundColor Yellow
    Write-Host $whatIfOutput
}

# -----------------------------------------------------------------------------
# Step 5: User Confirmation
# -----------------------------------------------------------------------------

if ($WhatIfPreference) {
    Write-Host ""
    Write-Success "WHAT-IF COMPLETE - No changes made"
    exit 0
}

Write-Host ""
Write-Host "  Do you want to proceed with deployment? " -NoNewline -ForegroundColor White
Write-Host "(yes/no): " -NoNewline -ForegroundColor Yellow

$confirmation = Read-Host
if ($confirmation -ne 'yes') {
    Write-Host ""
    Write-Host "  Deployment cancelled by user." -ForegroundColor Yellow
    exit 0
}

# -----------------------------------------------------------------------------
# Step 6: Deploy
# -----------------------------------------------------------------------------

Write-Section "DEPLOYING INFRASTRUCTURE"

Write-Step 1 1 "Deploying Bicep template..."

$deploymentName = "agent-testing-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

$deployOutput = az deployment group create `
    --name $deploymentName `
    --resource-group $ResourceGroupName `
    --template-file $TemplateFile `
    --parameters `
        location=$Location `
        environment=$Environment `
        projectName='agenttest' `
        sqlAdminGroupObjectId=$SqlAdminGroupObjectId `
        sqlAdminGroupName='SQL Administrators' `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed!"
    Write-Host $deployOutput -ForegroundColor Red
    exit 1
}

$deployment = $deployOutput | ConvertFrom-Json

Write-Success "DEPLOYMENT SUCCESSFUL"
Write-Host ""

# -----------------------------------------------------------------------------
# Step 7: Display Outputs
# -----------------------------------------------------------------------------

Write-Section "DEPLOYED RESOURCES"

$outputs = $deployment.properties.outputs

Write-Host ""
Write-Host "  Monitoring:" -ForegroundColor White
Write-Info "Log Analytics" $outputs.logAnalyticsWorkspaceName.value
Write-Info "App Insights" $outputs.applicationInsightsName.value

Write-Host ""
Write-Host "  Security:" -ForegroundColor White
Write-Info "Key Vault" $outputs.keyVaultName.value
Write-Info "Key Vault URI" $outputs.keyVaultUri.value

Write-Host ""
Write-Host "  Storage:" -ForegroundColor White
Write-Info "Storage Account" $outputs.storageAccountName.value

Write-Host ""
Write-Host "  Compute - App Service:" -ForegroundColor White
Write-Info "App Service" "https://$($outputs.appServiceHostname.value)"

Write-Host ""
Write-Host "  Compute - Container Apps:" -ForegroundColor White
Write-Info "Container App" "https://$($outputs.containerAppFqdn.value)"

Write-Host ""
Write-Host "  Data:" -ForegroundColor White
Write-Info "SQL Server" $outputs.sqlServerFqdn.value

Write-Host ""
Write-Host "  Messaging:" -ForegroundColor White
Write-Info "Service Bus" $outputs.serviceBusNamespaceName.value

Write-Host ""
Write-Host "  Web:" -ForegroundColor White
Write-Info "Static Web App" "https://$($outputs.staticWebAppHostname.value)"

# -----------------------------------------------------------------------------
# Step 8: Next Steps
# -----------------------------------------------------------------------------

Write-Section "NEXT STEPS"

Write-Host @"

  1. Configure App Service deployment:
     az webapp deployment source config-zip --resource-group $ResourceGroupName --name $($outputs.appServiceName.value) --src app.zip

  2. Configure Container App:
     az containerapp update --resource-group $ResourceGroupName --name $($outputs.containerAppName.value) --image <your-image>

  3. Configure Static Web App:
     az staticwebapp hostname set --resource-group $ResourceGroupName --name $($outputs.staticWebAppName.value)

  4. View deployment in Azure Portal:
     https://portal.azure.com/#@/resource/subscriptions/$($account.id)/resourceGroups/$ResourceGroupName/overview

"@ -ForegroundColor Gray

Write-Banner "DEPLOYMENT COMPLETE"
