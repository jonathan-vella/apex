<#
.SYNOPSIS
    Parses and analyzes maintained PowerShell scripts without executing them.
.DESCRIPTION
    Discovers tracked and non-ignored untracked scripts in maintained tooling,
    devcontainer and skill script directories. Historical infra, agent outputs
    and test fixtures are excluded. Every selected-rule diagnostic is blocking,
    including suppressed diagnostics. Missing tools, empty inputs, parser errors
    and analyzer failures return a nonzero exit code.
.PARAMETER Path
    Optional explicit script files, for focused checks and fixture tests.
.EXAMPLE
    pwsh -NoLogo -NoProfile -NonInteractive -File tools/scripts/check-powershell.ps1
.EXAMPLE
    pwsh -NoLogo -NoProfile -NonInteractive -File tools/scripts/check-powershell.ps1 -Path tools/scripts/collect-governance-baseline.ps1
#>
[CmdletBinding()]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string[]]$Path
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$failed = $false
$files = @($Path)

try {
    $requirements = Import-PowerShellDataFile -LiteralPath (Join-Path $root 'tools/powershell/requirements.psd1')
    try {
        Import-Module -Name $requirements.ModuleName -RequiredVersion $requirements.RequiredVersion -Force -ErrorAction Stop
    }
    catch {
        throw "PSScriptAnalyzer $($requirements.RequiredVersion) is required. Run npm run setup:powershell. $($_.Exception.Message)"
    }

    $settingsPath = Join-Path $root 'tools/powershell/PSScriptAnalyzerSettings.psd1'
    $settings = Import-PowerShellDataFile -LiteralPath $settingsPath
    $knownRules = @(Get-ScriptAnalyzerRule -ErrorAction Stop | Select-Object -ExpandProperty RuleName)
    if (-not $settings.IncludeRules.Count) { throw 'The analyzer rule selection is empty.' }
    foreach ($rule in $settings.IncludeRules) {
        if ($rule -notin $knownRules) { throw "Unknown analyzer rule: $rule" }
    }

    if (-not $PSBoundParameters.ContainsKey('Path')) {
        $tracked = @(& git -C $root ls-files -z --cached --others --exclude-standard -- tools/scripts .devcontainer .github/skills)
        if ($LASTEXITCODE -ne 0) { throw 'git ls-files failed; cannot discover maintained PowerShell scripts.' }
        $files = @($tracked -split "`0" | Where-Object {
            $_ -match '^(tools/scripts/|\.devcontainer/|\.github/skills/[^/]+/scripts/).+\.(ps1|psm1|psd1)$'
        } | ForEach-Object { Join-Path $root $_ })
        if (-not @($files | Where-Object { [System.IO.Path]::GetExtension($_) -in @('.ps1', '.psm1') }).Count) {
            throw 'No maintained PowerShell scripts found.'
        }
        $files += @(Get-ChildItem -LiteralPath (Join-Path $root 'tools/powershell') -File |
            Where-Object { $_.Extension -eq '.psd1' } | Select-Object -ExpandProperty FullName)
    }
    if (-not $files.Count) { throw 'No maintained PowerShell files found.' }

    foreach ($file in ($files | Sort-Object -Unique)) {
        try {
            if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "File does not exist: $file" }
            if ([System.IO.Path]::GetExtension($file) -notin @('.ps1', '.psm1', '.psd1')) {
                throw "Not a PowerShell source file: $file"
            }
            $resolved = (Resolve-Path -LiteralPath $file).Path
            $tokens = $null
            $parseErrors = $null
            $null = [System.Management.Automation.Language.Parser]::ParseFile($resolved, [ref]$tokens, [ref]$parseErrors)
            if ($parseErrors.Count) {
                foreach ($parseError in $parseErrors) {
                    Write-Output "${file}:$($parseError.Extent.StartLineNumber):$($parseError.Extent.StartColumnNumber): ParseError $($parseError.ErrorId): $($parseError.Message)"
                }
                $failed = $true
                continue
            }

            $diagnostics = @(Invoke-ScriptAnalyzer -Path $resolved -Settings $settingsPath -IncludeSuppressed -ErrorAction Stop)
            foreach ($diagnostic in $diagnostics) {
                Write-Output "${file}:$($diagnostic.Line):$($diagnostic.Column): $($diagnostic.Severity) $($diagnostic.RuleName): $($diagnostic.Message)"
                $failed = $true
            }
            Write-Output "Analyzed $file"
        }
        catch {
            Write-Output "${file}: Analysis failed: $($_.Exception.Message)"
            $failed = $true
        }
    }
}
catch {
    Write-Error "PowerShell analysis failed: $($_.Exception.Message)" -ErrorAction Continue
    exit 1
}

if ($failed) { exit 1 }
Write-Output 'PowerShell parsing and selected analyzer rules passed.'
