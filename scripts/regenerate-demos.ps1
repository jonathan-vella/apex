<#
.SYNOPSIS
    Regenerates demo output folders with fresh agent responses.

.DESCRIPTION
    This script cleans and recreates the demo output folders for all demo scenarios.
    It removes old generated content and creates empty folder structures ready for
    new agent workflow runs.

    Supported demos:
    - ecommerce (E-Commerce Platform)
    - healthcare (Healthcare Patient Portal)
    - analytics (Data Analytics Platform)
    - staticsite (Static Website)

.PARAMETER Demo
    The demo scenario to regenerate. Use 'all' to regenerate all demos.
    Valid values: all, ecommerce, healthcare, analytics, staticsite

.PARAMETER CleanBicep
    Also clean the generated Bicep files in infra/bicep/{demo}/

.PARAMETER Force
    Skip confirmation prompts.

.EXAMPLE
    ./regenerate-demos.ps1 -Demo all
    Regenerates all demo output folders.

.EXAMPLE
    ./regenerate-demos.ps1 -Demo ecommerce -CleanBicep -CleanPlanning
    Regenerates ecommerce demo including Bicep and planning files.

.EXAMPLE
    ./regenerate-demos.ps1 -Demo healthcare -Force
    Regenerates healthcare demo without confirmation.

.NOTES
    Author: GitHub Copilot Demo Team
    Requires: PowerShell 7+
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('all', 'ecommerce', 'healthcare', 'analytics', 'staticsite')]
    [string]$Demo,

    [switch]$CleanBicep,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Repository root (script is in /scripts/)
$RepoRoot = Split-Path -Parent $PSScriptRoot

# Demo configurations
$DemoConfigs = @{
    'ecommerce' = @{
        Name        = 'E-Commerce Platform'
        OutputDir   = 'demo-output'
        DiagramDir  = 'docs/diagrams/ecommerce'
        BicepDir    = 'infra/bicep/ecommerce'
        PromptFile  = 'demos/demo-prompts.md'
    }
    'healthcare' = @{
        Name        = 'Healthcare Patient Portal'
        OutputDir   = 'demo-output/healthcare'
        DiagramDir  = 'docs/diagrams/healthcare'
        BicepDir    = 'infra/bicep/healthcare'
        PromptFile  = 'demos/healthcare-demo.md'
    }
    'analytics' = @{
        Name        = 'Data Analytics Platform'
        OutputDir   = 'demo-output/analytics'
        DiagramDir  = 'docs/diagrams/analytics'
        BicepDir    = 'infra/bicep/analytics'
        PromptFile  = 'demos/analytics-demo.md'
    }
    'staticsite' = @{
        Name        = 'Static Website'
        OutputDir   = 'demo-output/staticsite'
        DiagramDir  = 'docs/diagrams/staticsite'
        BicepDir    = 'infra/bicep/staticsite'
        PromptFile  = 'demos/static-site-demo.md'
    }
}

function Write-Header {
    param([string]$Message)
    Write-Host "`n$('=' * 60)" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "$('=' * 60)" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "  → $Message" -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Skip {
    param([string]$Message)
    Write-Host "  ○ $Message" -ForegroundColor DarkGray
}

function Remove-DemoFolder {
    param(
        [string]$Path,
        [string]$Description
    )

    $FullPath = Join-Path $RepoRoot $Path

    if (Test-Path $FullPath) {
        if ($PSCmdlet.ShouldProcess($FullPath, "Remove $Description")) {
            Remove-Item -Path $FullPath -Recurse -Force
            Write-Success "Removed: $Path"
        }
    }
    else {
        Write-Skip "Not found: $Path"
    }
}

function New-DemoFolder {
    param(
        [string]$Path,
        [string]$Description
    )

    $FullPath = Join-Path $RepoRoot $Path

    if (-not (Test-Path $FullPath)) {
        if ($PSCmdlet.ShouldProcess($FullPath, "Create $Description")) {
            New-Item -Path $FullPath -ItemType Directory -Force | Out-Null
            Write-Success "Created: $Path"
        }
    }
    else {
        Write-Skip "Exists: $Path"
    }
}

function Invoke-DemoRegeneration {
    param([string]$DemoKey)

    $Config = $DemoConfigs[$DemoKey]
    Write-Header "Regenerating: $($Config.Name)"

    # Clean output directory
    Write-Step "Cleaning output directory..."
    Remove-DemoFolder -Path $Config.OutputDir -Description 'demo output'
    New-DemoFolder -Path $Config.OutputDir -Description 'demo output'

    # Clean diagram directory
    Write-Step "Cleaning diagram directory..."
    Remove-DemoFolder -Path $Config.DiagramDir -Description 'diagrams'
    New-DemoFolder -Path $Config.DiagramDir -Description 'diagrams'

    # Clean Bicep directory (if requested)
    if ($CleanBicep) {
        Write-Step "Cleaning Bicep directory..."
        Remove-DemoFolder -Path $Config.BicepDir -Description 'Bicep templates'
        New-DemoFolder -Path $Config.BicepDir -Description 'Bicep templates'
    }
    else {
        Write-Skip "Skipping Bicep cleanup (use -CleanBicep to include)"
    }

    Write-Host "`n  📋 Next steps:" -ForegroundColor Yellow
    Write-Host "     1. Open $($Config.PromptFile)" -ForegroundColor White
    Write-Host "     2. Follow the workflow prompts" -ForegroundColor White
    Write-Host "     3. Save outputs to $($Config.OutputDir)/" -ForegroundColor White
}

# Main execution
Write-Host "`n🔄 Demo Regeneration Script" -ForegroundColor Magenta
Write-Host "Repository: $RepoRoot`n"

# Confirmation prompt
if (-not $Force -and -not $WhatIfPreference) {
    $DemosToProcess = if ($Demo -eq 'all') { $DemoConfigs.Keys } else { @($Demo) }
    $DemoNames = ($DemosToProcess | ForEach-Object { $DemoConfigs[$_].Name }) -join ', '

    Write-Host "This will clean the following demos: " -NoNewline
    Write-Host $DemoNames -ForegroundColor Yellow
    Write-Host ""

    if ($CleanBicep) {
        Write-Host "⚠️  Bicep templates will also be deleted!" -ForegroundColor Red
    }
    if ($CleanPlanning) {
        Write-Host "⚠️  Planning files will also be deleted!" -ForegroundColor Red
    }

    $Confirm = Read-Host "`nContinue? (y/N)"
    if ($Confirm -notmatch '^[yY]') {
        Write-Host "`nOperation cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Process demos
if ($Demo -eq 'all') {
    foreach ($Key in $DemoConfigs.Keys) {
        Invoke-DemoRegeneration -DemoKey $Key
    }
}
else {
    Invoke-DemoRegeneration -DemoKey $Demo
}

# Summary
Write-Header "Regeneration Complete"
Write-Host @"

All specified demo folders have been cleaned and recreated.

To run a demo:
  1. Open the demo prompt file in VS Code
  2. Use Ctrl+Alt+I to select agents
  3. Follow the workflow: Requirements → Architect → Bicep Plan → Bicep Code
  4. Save outputs to the appropriate demo-output folder

Demo prompt files:
"@ -ForegroundColor White

foreach ($Key in $DemoConfigs.Keys) {
    Write-Host "  • $($DemoConfigs[$Key].PromptFile)" -ForegroundColor Cyan
}

Write-Host ""
