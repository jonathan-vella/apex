#Requires -Version 7.0
<#
.SYNOPSIS
    Deploy e2e-conductor-test infrastructure to Azure

.DESCRIPTION
    Deploys Static Web App with CDN for E2E validation testing.
    Includes preflight validation, what-if analysis, and deployment execution.

.PARAMETER Owner
    Owner name for resource tagging (required)

.PARAMETER TechnicalContact
    Technical contact email for alerts (required)

.PARAMETER Environment
    Environment name (dev/staging/prod). Default: dev

.PARAMETER Location
    Azure region for deployment. Default: westeurope

.PARAMETER WhatIf
    Run what-if analysis only, do not deploy

.EXAMPLE
    .\deploy.ps1 -Owner "DevOps Team" -TechnicalContact "devops@example.com"
    
.EXAMPLE
    .\deploy.ps1 -Owner "DevOps Team" -TechnicalContact "devops@example.com" -WhatIf
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [string]$Owner,

    [Parameter(Mandatory = $true)]
    [string]$TechnicalContact,

    [Parameter(Mandatory = $false)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',

    [Parameter(Mandatory = $false)]
    [ValidateSet('westeurope', 'eastus2', 'centralus', 'westus2', 'eastasia')]
    [string]$Location = 'westeurope'
)

# ============================================================================
# Configuration
# ============================================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ProjectName = 'e2e-conductor-test'
$TemplateFile = Join-Path $PSScriptRoot 'main.bicep'
$ParametersFile = Join-Path $PSScriptRoot 'main.bicepparam'

# ============================================================================
# Banner
# ============================================================================

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   E2E CONDUCTOR TEST - AZURE DEPLOYMENT                           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Pre-flight Validation
# ============================================================================

Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
Write-Host "│  [1/4] PRE-FLIGHT VALIDATION                                       │" -ForegroundColor Yellow
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
Write-Host ""

# Check Azure CLI
Write-Host "  [1/3] Checking Azure CLI..." -NoNewline
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host " ✓" -ForegroundColor Green
    Write-Host "      └─ Version: $($azVersion.'azure-cli')" -ForegroundColor Gray
} catch {
    Write-Host " ✗" -ForegroundColor Red
    Write-Error "Azure CLI not found. Install from: https://aka.ms/azure-cli"
}

# Check Bicep CLI
Write-Host "  [2/3] Checking Bicep CLI..." -NoNewline
try {
    $bicepVersion = bicep --version
    Write-Host " ✓" -ForegroundColor Green
    Write-Host "      └─ Version: $bicepVersion" -ForegroundColor Gray
} catch {
    Write-Host " ✗" -ForegroundColor Red
    Write-Error "Bicep CLI not found. Run: az bicep install"
}

# Check Azure authentication
Write-Host "  [3/3] Checking Azure authentication..." -NoNewline
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host " ✓" -ForegroundColor Green
    Write-Host "      └─ Subscription: $($account.name)" -ForegroundColor Gray
    Write-Host "      └─ Tenant: $($account.tenantId)" -ForegroundColor Gray
} catch {
    Write-Host " ✗" -ForegroundColor Red
    Write-Error "Not logged in to Azure. Run: az login"
}

Write-Host ""

# ============================================================================
# Template Validation
# ============================================================================

Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
Write-Host "│  [2/4] TEMPLATE VALIDATION                                         │" -ForegroundColor Yellow
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
Write-Host ""

Write-Host "  [1/2] Building Bicep template..." -NoNewline
try {
    $buildOutput = bicep build $TemplateFile --stdout 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✓" -ForegroundColor Green
    } else {
        Write-Host " ✗" -ForegroundColor Red
        Write-Error "Bicep build failed:`n$buildOutput"
    }
} catch {
    Write-Host " ✗" -ForegroundColor Red
    Write-Error "Failed to build Bicep template: $_"
}

Write-Host "  [2/2] Linting template..." -NoNewline
try {
    $lintOutput = bicep lint $TemplateFile 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✓" -ForegroundColor Green
    } else {
        Write-Host " ⚠" -ForegroundColor Yellow
        Write-Host "      └─ Warnings:" -ForegroundColor Yellow
        $lintOutput | ForEach-Object { Write-Host "         $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host " ⚠" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# What-If Analysis
# ============================================================================

Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
Write-Host "│  [3/4] WHAT-IF ANALYSIS                                            │" -ForegroundColor Yellow
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
Write-Host ""

Write-Host "  • Project: $ProjectName" -ForegroundColor Cyan
Write-Host "  • Environment: $Environment" -ForegroundColor Cyan
Write-Host "  • Location: $Location" -ForegroundColor Cyan
Write-Host "  • Owner: $Owner" -ForegroundColor Cyan
Write-Host ""

if ($PSCmdlet.ShouldProcess("Azure Subscription", "Run What-If Analysis")) {
    Write-Host "  Running what-if analysis..." -ForegroundColor Cyan
    Write-Host ""
    
    $whatIfResult = az deployment sub what-if `
        --location $Location `
        --template-file $TemplateFile `
        --parameters owner="$Owner" `
        --parameters technicalContact="$TechnicalContact" `
        --parameters environment=$Environment `
        --parameters location=$Location `
        --no-pretty-print `
        2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host $whatIfResult
        Write-Host ""
        
        # Parse change summary
        $createCount = ($whatIfResult | Select-String "Create:" | Measure-Object).Count
        $modifyCount = ($whatIfResult | Select-String "Modify:" | Measure-Object).Count
        $deleteCount = ($whatIfResult | Select-String "Delete:" | Measure-Object).Count
        
        Write-Host "┌─────────────────────────────────────────┐" -ForegroundColor Cyan
        Write-Host "│  CHANGE SUMMARY                          │" -ForegroundColor Cyan
        Write-Host "│  + Create: $createCount resources" -ForegroundColor Green
        Write-Host "│  ~ Modify: $modifyCount resources" -ForegroundColor Yellow
        Write-Host "│  - Delete: $deleteCount resources" -ForegroundColor Red
        Write-Host "└─────────────────────────────────────────┘" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "What-if analysis failed:" -ForegroundColor Red
        Write-Host $whatIfResult -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# Deployment Confirmation
# ============================================================================

if ($WhatIfPreference) {
    Write-Host "What-if analysis complete. Run without -WhatIf to deploy." -ForegroundColor Yellow
    exit 0
}

Write-Host "Do you want to proceed with deployment? (yes/no): " -NoNewline -ForegroundColor Yellow
$confirmation = Read-Host

if ($confirmation -ne 'yes') {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# ============================================================================
# Deployment Execution
# ============================================================================

Write-Host ""
Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
Write-Host "│  [4/4] DEPLOYMENT EXECUTION                                        │" -ForegroundColor Yellow
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date

if ($PSCmdlet.ShouldProcess("Azure Subscription", "Deploy Infrastructure")) {
    Write-Host "  Starting deployment..." -ForegroundColor Cyan
    Write-Host ""
    
    $deploymentName = "deploy-$ProjectName-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    $deploymentResult = az deployment sub create `
        --name $deploymentName `
        --location $Location `
        --template-file $TemplateFile `
        --parameters owner="$Owner" `
        --parameters technicalContact="$TechnicalContact" `
        --parameters environment=$Environment `
        --parameters location=$Location `
        --output json `
        2>&1

    if ($LASTEXITCODE -eq 0) {
        $deployment = $deploymentResult | ConvertFrom-Json
        $endTime = Get-Date
        $duration = $endTime - $startTime
        
        Write-Host ""
        Write-Host "✓ DEPLOYMENT SUCCESSFUL" -ForegroundColor Green
        Write-Host ""
        Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Green
        Write-Host "│  DEPLOYMENT SUMMARY                                                │" -ForegroundColor Green
        Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Green
        Write-Host ""
        Write-Host "  • Deployment Name: $deploymentName" -ForegroundColor Cyan
        Write-Host "  • Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Cyan
        Write-Host "  • Status: $($deployment.properties.provisioningState)" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Resource Endpoints:" -ForegroundColor Cyan
        
        if ($deployment.properties.outputs.staticWebAppHostname) {
            Write-Host "    • Static Web App: https://$($deployment.properties.outputs.staticWebAppHostname.value)" -ForegroundColor Gray
        }
        if ($deployment.properties.outputs.cdnEndpointHostname) {
            Write-Host "    • CDN Endpoint: https://$($deployment.properties.outputs.cdnEndpointHostname.value)" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "  Next Steps:" -ForegroundColor Yellow
        Write-Host "    1. Configure Static Web App with your repository" -ForegroundColor Gray
        Write-Host "    2. Verify CDN endpoint is serving content" -ForegroundColor Gray
        Write-Host "    3. Check metric alerts in Azure Portal" -ForegroundColor Gray
        Write-Host ""
        
    } else {
        Write-Host "✗ DEPLOYMENT FAILED" -ForegroundColor Red
        Write-Host ""
        Write-Host $deploymentResult -ForegroundColor Red
        exit 1
    }
}

Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   DEPLOYMENT COMPLETE                                             ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
