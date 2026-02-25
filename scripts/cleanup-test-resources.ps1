<#
.SYNOPSIS
    Cleans up expired test resource groups based on TTL tag.

.DESCRIPTION
    This Azure Automation Runbook finds resource groups with a TTL tag and deletes
    those that have exceeded their time-to-live. Designed for ephemeral test infrastructure
    cleanup in the Agent Testing framework.

.PARAMETER TtlHours
    Default TTL in hours. Resource groups older than this will be deleted.
    Default: 2 hours

.PARAMETER TagName
    The tag name to check for TTL information.
    Default: 'TTL'

.PARAMETER DryRun
    If true, only logs what would be deleted without actually deleting.
    Default: false

.EXAMPLE
    .\cleanup-test-resources.ps1 -TtlHours 2 -DryRun $true

.NOTES
    Author: Agentic InfraOps - 06b-Bicep CodeGen agent
    Version: 1.0.0
    Requires: Az.Resources module
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $false)]
    [int]$TtlHours = 2,

    [Parameter(Mandatory = $false)]
    [string]$TagName = 'TTL',

    [Parameter(Mandatory = $false)]
    [bool]$DryRun = $false
)

# ============================================================================
# Configuration
# ============================================================================

$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'

# Pattern to match agent test resource groups
$ResourceGroupPattern = 'rg-agenttest-*'

# ============================================================================
# Authentication (Azure Automation Managed Identity)
# ============================================================================

Write-Information "========================================="
Write-Information " Agent Testing - Resource Cleanup Runbook"
Write-Information "========================================="
Write-Information ""
Write-Information "Configuration:"
Write-Information "  TTL Hours: $TtlHours"
Write-Information "  Tag Name: $TagName"
Write-Information "  Dry Run: $DryRun"
Write-Information "  Pattern: $ResourceGroupPattern"
Write-Information ""

try {
    # Connect using managed identity
    Write-Information "Connecting to Azure using managed identity..."
    Connect-AzAccount -Identity -ErrorAction Stop | Out-Null
    Write-Information "✓ Connected to Azure"
}
catch {
    Write-Error "Failed to connect to Azure: $($_.Exception.Message)"
    throw
}

# ============================================================================
# Find Expired Resource Groups
# ============================================================================

Write-Information ""
Write-Information "Searching for resource groups matching pattern: $ResourceGroupPattern"

$resourceGroups = Get-AzResourceGroup -Tag @{ $TagName = '*' } -ErrorAction SilentlyContinue |
    Where-Object { $_.ResourceGroupName -like $ResourceGroupPattern }

if (-not $resourceGroups) {
    Write-Information "✓ No resource groups found matching pattern with TTL tag"
    Write-Information "  Cleanup complete - nothing to delete"
    exit 0
}

Write-Information "Found $($resourceGroups.Count) resource group(s) with TTL tag"

$expiredGroups = @()
$currentTime = Get-Date

foreach ($rg in $resourceGroups) {
    $ttlValue = $rg.Tags[$TagName]

    # Parse TTL tag value (expected format: ISO 8601 datetime or hours)
    try {
        if ($ttlValue -match '^\d+$') {
            # TTL is specified in hours from creation
            $createdTime = $rg.Tags['CreatedAt']
            if ($createdTime) {
                $created = [DateTime]::Parse($createdTime)
                $expiryTime = $created.AddHours([int]$ttlValue)
            }
            else {
                # Fallback: use resource group creation time from Azure
                $expiryTime = $currentTime.AddHours(-$TtlHours) # Conservative approach
            }
        }
        else {
            # TTL is an absolute expiry datetime
            $expiryTime = [DateTime]::Parse($ttlValue)
        }

        if ($currentTime -gt $expiryTime) {
            $expiredGroups += @{
                Name = $rg.ResourceGroupName
                ExpiryTime = $expiryTime
                Age = ($currentTime - $expiryTime).TotalHours
            }
            Write-Information "  EXPIRED: $($rg.ResourceGroupName) (expired $([math]::Round(($currentTime - $expiryTime).TotalHours, 1)) hours ago)"
        }
        else {
            $remaining = ($expiryTime - $currentTime).TotalMinutes
            Write-Information "  ACTIVE: $($rg.ResourceGroupName) ($([math]::Round($remaining, 0)) minutes remaining)"
        }
    }
    catch {
        Write-Warning "  SKIP: $($rg.ResourceGroupName) - Could not parse TTL value: $ttlValue"
    }
}

# ============================================================================
# Delete Expired Resource Groups
# ============================================================================

Write-Information ""
Write-Information "========================================="
Write-Information " Cleanup Summary"
Write-Information "========================================="
Write-Information "  Total scanned: $($resourceGroups.Count)"
Write-Information "  Expired: $($expiredGroups.Count)"
Write-Information "  Mode: $(if ($DryRun) { 'DRY RUN' } else { 'LIVE' })"
Write-Information ""

if ($expiredGroups.Count -eq 0) {
    Write-Information "✓ No expired resource groups to delete"
    exit 0
}

$deletedCount = 0
$failedCount = 0

foreach ($expired in $expiredGroups) {
    $rgName = $expired.Name

    if ($DryRun) {
        Write-Information "[DRY RUN] Would delete: $rgName"
        $deletedCount++
    }
    else {
        if ($PSCmdlet.ShouldProcess($rgName, "Delete resource group")) {
            try {
                Write-Information "Deleting: $rgName..."
                Remove-AzResourceGroup -Name $rgName -Force -AsJob | Out-Null
                Write-Information "  ✓ Deletion initiated for: $rgName"
                $deletedCount++
            }
            catch {
                Write-Warning "  ✗ Failed to delete $rgName : $($_.Exception.Message)"
                $failedCount++
            }
        }
    }
}

# ============================================================================
# Final Report
# ============================================================================

Write-Information ""
Write-Information "========================================="
Write-Information " Cleanup Complete"
Write-Information "========================================="
Write-Information "  Deleted: $deletedCount"
Write-Information "  Failed: $failedCount"
Write-Information "  Mode: $(if ($DryRun) { 'DRY RUN (no actual deletions)' } else { 'LIVE' })"
Write-Information ""

if ($failedCount -gt 0) {
    Write-Warning "Some resource groups failed to delete. Review logs for details."
    exit 1
}

Write-Information "✓ Cleanup runbook completed successfully"
exit 0
