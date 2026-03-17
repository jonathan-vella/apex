[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter()]
    [string]$Location = 'swedencentral',

    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter()]
    [ValidateSet('all', 'foundation', 'networking', 'security', 'data', 'compute', 'edge')]
    [string]$Phase = 'all',

    [Parameter(Mandatory = $true)]
    [string]$ProjectName,

    [Parameter(Mandatory = $true)]
    [string]$Owner,

    [Parameter(Mandatory = $true)]
    [string]$CostCenter,

    [Parameter(Mandatory = $true)]
    [string]$WorkloadName,

    [Parameter(Mandatory = $true)]
    [string]$SlaTier,

    [Parameter(Mandatory = $true)]
    [string]$BackupPolicy,

    [Parameter(Mandatory = $true)]
    [string]$MaintenanceWindow,

    [Parameter(Mandatory = $true)]
    [string]$TechnicalContact,

    [Parameter(Mandatory = $true)]
    [PSCredential]$PostgresqlAdministratorCredential,

    [Parameter(Mandatory = $true)]
    [string]$ManagementVmAdminPublicKey,

    [Parameter()]
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$templateFile = Join-Path $PSScriptRoot 'main.bicep'
$parameterFile = Join-Path $PSScriptRoot 'main.bicepparam'

$phaseOrder = @(
    @{ Name = 'foundation'; Description = 'Monitoring and shared identity' }
    @{ Name = 'networking'; Description = 'VNet, subnets, NSGs, and DNS zones' }
    @{ Name = 'security'; Description = 'Key Vault and private access' }
    @{ Name = 'data'; Description = 'PostgreSQL, Redis, and storage services' }
    @{ Name = 'compute'; Description = 'AKS, VM, and budget controls' }
    @{ Name = 'edge'; Description = 'API Management and Front Door' }
)

Write-Host ''
Write-Host 'Contoso Service Hub - Bicep Deployment' -ForegroundColor Cyan
Write-Host "Environment : $Environment" -ForegroundColor Cyan
Write-Host "Location    : $Location" -ForegroundColor Cyan
Write-Host "Phase       : $Phase" -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw 'Azure CLI is required.'
}

az account show --output none 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI is not logged in. Run 'az login' first."
}

az account get-access-token --resource https://management.azure.com/ --output none 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Azure ARM token is invalid. Re-authenticate with 'az login --use-device-code'."
}

az bicep version *> $null
if ($LASTEXITCODE -ne 0) {
    az bicep install *> $null
}

az bicep build --file $templateFile *> $null
az bicep lint --file $templateFile *> $null

$postgresqlAdministratorPasswordPlain = $PostgresqlAdministratorCredential.GetNetworkCredential().Password

$resourceGroupExists = az group exists --name $ResourceGroup | ConvertFrom-Json
if (-not $resourceGroupExists) {
    $resourceGroupTags = @(
        "environment=$Environment"
        "owner=$Owner"
        "costcenter=$CostCenter"
        "application=$ProjectName"
        "workload=$WorkloadName"
        "sla=$SlaTier"
        "backup-policy=$BackupPolicy"
        "maint-window=$MaintenanceWindow"
        "technical-contact=$TechnicalContact"
        "tech-contact=$TechnicalContact"
        'ManagedBy=Bicep'
    )

    if ($PSCmdlet.ShouldProcess($ResourceGroup, 'Create tagged resource group')) {
        az group create --name $ResourceGroup --location $Location --tags $resourceGroupTags --output none
    }
}

$phasesToRun = if ($Phase -eq 'all') { $phaseOrder } else { $phaseOrder | Where-Object { $_.Name -eq $Phase } }

foreach ($phaseInfo in $phasesToRun) {
    Write-Host ''
    Write-Host ("Phase: {0} - {1}" -f $phaseInfo.Name, $phaseInfo.Description) -ForegroundColor Magenta

    az deployment group what-if `
        --resource-group $ResourceGroup `
        --template-file $templateFile `
        --parameters $parameterFile `
        --parameters environment=$Environment phase=$($phaseInfo.Name) projectName=$ProjectName owner=$Owner costCenter=$CostCenter workloadName=$WorkloadName slaTier=$SlaTier backupPolicy=$BackupPolicy maintenanceWindow=$MaintenanceWindow technicalContact=$TechnicalContact managementVmAdminPublicKey="$ManagementVmAdminPublicKey" postgresqlAdministratorPassword="$postgresqlAdministratorPasswordPlain" location=$Location `
        --no-pretty-print `
        --output table

    if ($WhatIf) {
        continue
    }

    if ($Environment -eq 'prod' -and $phaseInfo.Name -ne 'foundation') {
        $approval = Read-Host "Proceed with phase '$($phaseInfo.Name)'? (y/n)"
        if ($approval -ne 'y') {
            throw "Deployment stopped before phase '$($phaseInfo.Name)'."
        }
    }

    if ($PSCmdlet.ShouldProcess($ResourceGroup, "Deploy phase $($phaseInfo.Name)")) {
        az deployment group create `
            --resource-group $ResourceGroup `
            --name "csh-$Environment-$($phaseInfo.Name)-$(Get-Date -Format 'yyyyMMddHHmmss')" `
            --template-file $templateFile `
            --parameters $parameterFile `
            --parameters environment=$Environment phase=$($phaseInfo.Name) projectName=$ProjectName owner=$Owner costCenter=$CostCenter workloadName=$WorkloadName slaTier=$SlaTier backupPolicy=$BackupPolicy maintenanceWindow=$MaintenanceWindow technicalContact=$TechnicalContact managementVmAdminPublicKey="$ManagementVmAdminPublicKey" postgresqlAdministratorPassword="$postgresqlAdministratorPasswordPlain" location=$Location
    }
}

Write-Host ''
Write-Host 'Deployment workflow complete.' -ForegroundColor Green
