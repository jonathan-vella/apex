---
applyTo: "**/*.ps1,**/*.psm1"
description: "PowerShell cmdlet and scripting best practices based on Microsoft guidelines"
---

# PowerShell Scripting Guidelines

Use PowerShell 7 for maintained repository tooling. Existing Azure and Kubernetes diagnostics
print human-readable evidence; governance collection writes JSON. Preserve those contracts.

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

Public entry scripts and exported functions need `[CmdletBinding()]` and comment-based help:
`.SYNOPSIS`, `.DESCRIPTION`, `.PARAMETER` for caller inputs, and `.EXAMPLE`. Use parameter
validation where meaningful. Internal helpers need comments only for non-obvious decisions.

### ShouldProcess for Destructive Operations

Use `SupportsShouldProcess` and actually call `$PSCmdlet.ShouldProcess()` before destructive
or system-changing operations; choose `ConfirmImpact` for the consequence:

```powershell
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
```

Return objects from reusable APIs. Keep labeled console output for diagnostic entry scripts;
do not replace a machine-readable collector's JSON contract with formatted text.

### Error Handling

- Fail closed for provisioning and validation: use `$ErrorActionPreference = 'Stop'`,
  catch failures at the entry boundary, emit a useful diagnostic, and exit nonzero.
- Check `$LASTEXITCODE` immediately after native commands; PowerShell's error preference
  does not reliably turn native nonzero exit codes into terminating errors.
- Best-effort diagnostic collectors may continue after individual reads fail, provided the
  missing evidence is visible. Do not infer a successful check from absent output.
- Use `Write-Verbose` for operational detail, `Write-Warning` for
  warnings, avoid `Write-Host` except for UI text

### Non-Interactive Design

- Accept input via parameters — never use `Read-Host` in scripts
- Preserve explicit approval and dry-run safeguards for cloud-mutating, privileged and
  cluster-affecting actions. Static analysis never grants operational approval.
- Document all required inputs

## Repository Analysis

- Provision with `npm run setup:powershell`. The exact PSScriptAnalyzer version and repository
  are declared in `tools/powershell/requirements.psd1`; installation is `CurrentUser` only,
  does not change gallery trust, and fails if installation/import fails.
- Run `npm run lint:powershell` and `npm run test:powershell`. Missing `pwsh` or the pinned
  module is a failure, never a skipped check.
- The check parses without executing scripts, then applies
  `tools/powershell/PSScriptAnalyzerSettings.psd1`. Every selected-rule diagnostic blocks,
  including warnings and suppressed findings. Do not add blanket exclusions or suppressions.
- Discovery covers tracked and non-ignored untracked PowerShell sources under `tools/scripts/`,
  `.devcontainer/` and `.github/skills/*/scripts/`, plus analyzer configuration in
  `tools/powershell/`. Historical `agent-output/`, `infra/` examples and test fixtures are
  intentionally excluded from default analysis; fixture tests analyze invalid files explicitly.
- Selected rules cover aliases, automatic-variable overwrites, empty catches, dynamic expression
  evaluation, plaintext credential handling, parameter defaults and runspace variable scope.
  Naming, help and operational approval remain review obligations, not claims of full static enforcement.
- CI, the external validation suite and existing Lefthook Git checks run these commands.
  These are Git hooks, not Copilot SDK runtime hooks.

Command semantics:
[Invoke-ScriptAnalyzer](https://learn.microsoft.com/powershell/module/psscriptanalyzer/invoke-scriptanalyzer)
returns diagnostics; its `EnableExit` counts error records, so the repository wrapper explicitly
fails on all selected diagnostics.
[Install-Module](https://learn.microsoft.com/powershell/module/powershellget/install-module)
uses `RequiredVersion` for the exact pin and `Scope CurrentUser` for user-local installation.
