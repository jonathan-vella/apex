<#
.SYNOPSIS
    Opens VS Code with Microsoft package feeds before the dev container is built.
.DESCRIPTION
    Sets package-feed opt-ins only for the launched VS Code process, restoring the
    calling shell afterwards. Does not persist host settings, install packages,
    change credentials, or bypass execution policy. Compatible with Windows
    PowerShell 5.1 so a new clone does not require PowerShell 7 on the host.
.EXAMPLE
    .\.devcontainer\open-microsoft.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$sources = @{
    APEX_NPM_REGISTRY_HOST_PATH = 'packagefeedproxy.microsoft.io/npm/'
    APEX_PIP_INDEX_HOST_PATH = 'packagefeedproxy.microsoft.io/pypi/simple/'
    APEX_POWERSHELL_REPOSITORY_URL = 'https://packagefeedproxy.microsoft.io/powershell/v2'
}
$previous = @{}

try {
    $code = Get-Command -Name code -CommandType Application -ErrorAction Stop | Select-Object -First 1
    foreach ($name in $sources.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $sources[$name], 'Process')
    }
    Write-Output 'Opening VS Code with Microsoft CFS sources for image builds and container setup.'
    Write-Output 'Close all existing VS Code windows first; an existing process retains its old environment.'
    & $code.Source (Join-Path $PSScriptRoot '..')
    if ($LASTEXITCODE -ne 0) {
        throw "VS Code exited with code $LASTEXITCODE."
    }
}
catch {
    Write-Error "Microsoft host launcher failed: $($_.Exception.Message)" -ErrorAction Continue
    exit 1
}
finally {
    foreach ($name in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
}
