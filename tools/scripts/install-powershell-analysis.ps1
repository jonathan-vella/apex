<#
.SYNOPSIS
    Installs the repository-pinned PowerShell analyzer for the current user.
.DESCRIPTION
    Uses the declared PSGallery version without changing repository trust,
    installing system-wide modules, or loading a PowerShell profile. An optional
    APEX_POWERSHELL_REPOSITORY_URL selects an HTTPS feed for this installation only.
.EXAMPLE
    pwsh -NoLogo -NoProfile -NonInteractive -File tools/scripts/install-powershell-analysis.ps1
#>
[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$temporaryRepository = $null

try {
    $requirements = Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot '../powershell/requirements.psd1')
    $available = Get-Module -ListAvailable -Name $requirements.ModuleName |
        Where-Object { $_.Version -eq [version]$requirements.RequiredVersion }
    if (-not $available) {
        $sourceLabel = if ($env:APEX_POWERSHELL_REPOSITORY_URL) { 'the configured HTTPS feed' } else { $requirements.Repository }
        if (-not $PSCmdlet.ShouldProcess('CurrentUser PowerShell modules', "Install $($requirements.ModuleName) $($requirements.RequiredVersion) from $sourceLabel")) {
            return
        }
        $repository = $requirements.Repository
        if ($env:APEX_POWERSHELL_REPOSITORY_URL) {
            $source = $null
            if (-not [uri]::TryCreate($env:APEX_POWERSHELL_REPOSITORY_URL, [UriKind]::Absolute, [ref]$source) -or
                $source.Scheme -ne 'https' -or $source.UserInfo -or $source.Query -or $source.Fragment) {
                throw 'APEX_POWERSHELL_REPOSITORY_URL must be an HTTPS feed URL without credentials, query, or fragment.'
            }
            $repository = "APEX-$([guid]::NewGuid().ToString('N'))"
            Register-PSRepository -Name $repository -SourceLocation $source.AbsoluteUri -InstallationPolicy Untrusted -ErrorAction Stop
            $temporaryRepository = $repository
        }
        Install-Module -Name $requirements.ModuleName -RequiredVersion $requirements.RequiredVersion `
            -Repository $repository -Scope CurrentUser -Force -ErrorAction Stop
    }
    Import-Module -Name $requirements.ModuleName -RequiredVersion $requirements.RequiredVersion -Force -ErrorAction Stop
    Write-Output "$($requirements.ModuleName) $($requirements.RequiredVersion) is ready."
}
catch {
    Write-Error "PowerShell analyzer provisioning failed: $($_.Exception.Message)" -ErrorAction Continue
    exit 1
}
finally {
    if ($temporaryRepository) {
        Unregister-PSRepository -Name $temporaryRepository -ErrorAction Stop
    }
}
