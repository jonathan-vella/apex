[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter()]
    [string]$ProjectName = "e2e-ralph-loop",

    [Parameter()]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod",

    [Parameter()]
    [string]$ResourceGroup = "",

    [Parameter()]
    [string]$Location = "swedencentral",

    [Parameter()]
    [ValidateSet("foundation", "data", "compute", "all")]
    [string]$Phase = "all",

    [Parameter()]
    [string]$OwnerTag = "E2E",

    [Parameter()]
    [string]$ManagedByTag = "Bicep",

    [Parameter()]
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ResourceGroup)) {
    $ResourceGroup = "rg-$ProjectName-$Environment"
}

$templateFile = Join-Path $PSScriptRoot "main.bicep"
$parameterFile = Join-Path $PSScriptRoot "main.bicepparam"

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI is required."
}

Write-Host "[CHECK] Validating Azure CLI authentication..." -ForegroundColor Yellow
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    throw "Azure CLI is not authenticated. Run 'az login' first."
}

Write-Host "[CHECK] Validating Bicep template build..." -ForegroundColor Yellow
az bicep build --file $templateFile | Out-Null
az bicep lint --file $templateFile | Out-Null

$tags = @(
    "Environment=$Environment"
    "ManagedBy=$ManagedByTag"
    "Project=$ProjectName"
    "Owner=$OwnerTag"
)

Write-Host "[CHECK] Ensuring resource group exists..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --tags $tags --output none | Out-Null

$deploymentArgs = @(
    "deployment", "group"
)

if ($WhatIf.IsPresent) {
    $deploymentArgs += "what-if"
}
else {
    $deploymentArgs += "create"
}

$deploymentArgs += @(
    "--resource-group", $ResourceGroup,
    "--template-file", $templateFile,
    "--parameters", $parameterFile,
    "--parameters", "phase=$Phase",
    "--parameters", "location=$Location",
    "--parameters", "environment=$Environment",
    "--parameters", "projectName=$ProjectName",
    "--parameters", "ownerTag=$OwnerTag",
    "--parameters", "managedByTag=$ManagedByTag"
)

if ($PSCmdlet.ShouldProcess($ResourceGroup, "Deploy Bicep phase $Phase")) {
    & az @deploymentArgs
}
