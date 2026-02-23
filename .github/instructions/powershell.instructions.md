---
applyTo: "**/*.ps1,**/*.psm1"
description: "PowerShell cmdlet and scripting best practices based on Microsoft guidelines"
---

# PowerShell Cmdlet Development Guidelines

## Quick Reference

| Rule        | Standard                                                                      |
| ----------- | ----------------------------------------------------------------------------- |
| Naming      | `Verb-Noun` with approved verbs (`Get-Verb`), PascalCase                      |
| Parameters  | PascalCase, singular, descriptive; use `ValidateSet`/`ValidateNotNullOrEmpty` |
| Variables   | PascalCase (public), camelCase (private); avoid abbreviations                 |
| Aliases     | **Never** in scripts — use full cmdlet and parameter names                    |
| Indentation | 4 spaces, opening `{` on same line as statement                               |

## Mandatory Patterns

### CmdletBinding and Comment-Based Help

Every public function MUST have `[CmdletBinding()]` and comment-based help:

```powershell
function Get-UserProfile {
    <#
    .SYNOPSIS
        Retrieves user profile details.
    .DESCRIPTION
        Fetches the profile for a given username with optional detail level.
    .PARAMETER Username
        The target user's login name.
    .EXAMPLE
        Get-UserProfile -Username 'jdoe' -ProfileType Detailed
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Username,

        [Parameter()]
        [ValidateSet('Basic', 'Detailed')]
        [string]$ProfileType = 'Basic'
    )
    process { <# logic #> }
}
```

### ShouldProcess for Destructive Operations

Use `SupportsShouldProcess` with appropriate `ConfirmImpact` for any
function that modifies system state:

```powershell
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
```

### Pipeline Support

- Use `ValueFromPipeline` / `ValueFromPipelineByPropertyName`
- Implement `Begin`/`Process`/`End` blocks
- Return rich objects (`[PSCustomObject]`), not formatted text
- Implement `-PassThru` for action cmdlets that normally produce no output

### Error Handling

- Set `$ErrorActionPreference = 'Stop'` in `begin` block
- Use `try`/`catch` with specific exception types
- In `[CmdletBinding()]` functions, prefer `$PSCmdlet.WriteError()` and
  `$PSCmdlet.ThrowTerminatingError()` over `Write-Error` and `throw`
- Construct proper `ErrorRecord` objects with category, target, and exception
- Use `Write-Verbose` for operational detail, `Write-Warning` for
  warnings, avoid `Write-Host` except for UI text

### Non-Interactive Design

- Accept input via parameters — never use `Read-Host` in scripts
- Support automation scenarios; document all required inputs
