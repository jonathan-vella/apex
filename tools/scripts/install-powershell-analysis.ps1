<#
.SYNOPSIS
    Installs the repository-pinned PowerShell analyzer for the current user.
.DESCRIPTION
    Uses the declared PSGallery version without changing repository trust,
    installing system-wide modules, or loading a PowerShell profile.
.EXAMPLE
    pwsh -NoLogo -NoProfile -NonInteractive -File tools/scripts/install-powershell-analysis.ps1
#>
[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'

try {
    $requirements = Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot '../powershell/requirements.psd1')
    $available = Get-Module -ListAvailable -Name $requirements.ModuleName |
        Where-Object { $_.Version -eq [version]$requirements.RequiredVersion }
    if (-not $available) {
        if (-not $PSCmdlet.ShouldProcess('CurrentUser PowerShell modules', "Install $($requirements.ModuleName) $($requirements.RequiredVersion) from $($requirements.Repository)")) {
            return
        }
        Install-Module -Name $requirements.ModuleName -RequiredVersion $requirements.RequiredVersion `
            -Repository $requirements.Repository -Scope CurrentUser -Force -ErrorAction Stop
    }
    Import-Module -Name $requirements.ModuleName -RequiredVersion $requirements.RequiredVersion -Force -ErrorAction Stop
    Write-Output "$($requirements.ModuleName) $($requirements.RequiredVersion) is ready."
}
catch {
    Write-Error "PowerShell analyzer provisioning failed: $($_.Exception.Message)" -ErrorAction Continue
    exit 1
}
