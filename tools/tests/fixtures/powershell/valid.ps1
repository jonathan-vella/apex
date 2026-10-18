<#
.SYNOPSIS
    Valid analysis-only fixture.
.DESCRIPTION
    Throws if executed so tests prove that analysis does not run scripts.
.EXAMPLE
    npm run test:powershell
#>
[CmdletBinding()]
param()

Write-Output 'valid fixture'
throw 'Analysis fixtures must never execute.'
