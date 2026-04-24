<#
.SYNOPSIS
    Collects Azure Policy assignments across all subscriptions under a
    Management Group and writes a deterministic governance-baseline-v1 JSON.

.DESCRIPTION
    Authenticates via the workflow's azure/login@v2 context, discovers
    descendant subscriptions, collects policy assignments/definitions/
    set-definitions/exemptions per subscription, classifies findings
    identically to discover.py, and writes a deterministic baseline.

    discovered_at timestamps are preserved for unchanged subscriptions
    to prevent no-op daily PR churn.

.PARAMETER ManagementGroupId
    Required. The root Management Group ID to traverse.

.PARAMETER OutputDir
    Output directory for baseline files. Default: .github/data

.PARAMETER IncludeDefenderAuto
    Switch. If set, retains Defender-for-Cloud auto-assignments.

.PARAMETER MaxSubscriptions
    Maximum subscriptions to process. Default: 100.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ManagementGroupId,

    [string]$OutputDir = ".github/data",

    [switch]$IncludeDefenderAuto,

    [int]$MaxSubscriptions = 100
)

# StrictMode intentionally omitted — REST API response objects have dynamic
# properties that vary per endpoint, and strict property access causes false
# failures. Error handling is via try/catch + ErrorActionPreference Stop.
$ErrorActionPreference = "Stop"

# ─── Constants (mirroring discover.py) ───────────────────────────────────────
$ARM = "https://management.azure.com"
$API_ASSIGNMENTS = "2022-06-01"
$API_DEFINITIONS = "2021-06-01"
$API_EXEMPTIONS = "2022-07-01-preview"
$API_MG_DESCENDANTS = "2020-05-01"

$BLOCKER_EFFECTS = @("Deny")
$AUTO_REMEDIATE_EFFECTS = @("DeployIfNotExists", "Modify")
$RELEVANT_EFFECTS = $BLOCKER_EFFECTS + $AUTO_REMEDIATE_EFFECTS
$DEFENDER_ASSIGNED_BY = @("Security Center", "Microsoft Defender for Cloud")

# ─── ARM Token ───────────────────────────────────────────────────────────────
function Get-ArmToken {
    $tokenJson = az account get-access-token --resource "$ARM" -o json 2>$null
    if (-not $tokenJson) { throw "Failed to acquire ARM token via az account get-access-token" }
    $token = $tokenJson | ConvertFrom-Json
    return $token.accessToken
}

function Invoke-ArmRest {
    param([string]$Url, [string]$Token)
    $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
    $allValues = @()
    $currentUrl = $Url
    do {
        try {
            $response = Invoke-RestMethod -Uri $currentUrl -Headers $headers -Method Get -ErrorAction Stop
        }
        catch {
            Write-Warning "ARM REST call failed: $currentUrl — $_"
            return $allValues
        }
        if ($response.PSObject.Properties['value']) { $allValues += $response.value }
        $currentUrl = if ($response.PSObject.Properties['nextLink']) { $response.nextLink } else { $null }
    } while ($currentUrl)
    return $allValues
}

function Invoke-ArmRestSingle {
    param([string]$Url, [string]$Token)
    $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
    try {
        return Invoke-RestMethod -Uri $Url -Headers $headers -Method Get -ErrorAction Stop
    }
    catch {
        Write-Warning "ARM REST single fetch failed: $Url — $_"
        return $null
    }
}

# ─── Classification (mirrors discover.py exactly) ───────────────────────────
function Get-EffectOf {
    param($Defn)
    $props = $Defn.properties
    if (-not $props) { return $null }
    $rule = $props.policyRule
    if (-not $rule) { return $null }
    $then = $rule.then
    if (-not $then) { return $null }
    $eff = $then.effect
    if (-not $eff) { return $null }
    # Resolve parameterized effects
    if ($eff -match '^\[parameters\(') {
        $paramName = $eff -replace "^\[parameters\('", "" -replace "'\)\]$", ""
        $paramDef = $props.parameters.$paramName
        if ($paramDef -and $paramDef.defaultValue) {
            return [string]$paramDef.defaultValue
        }
        return $null
    }
    return [string]$eff
}

function Get-Classification {
    param([string]$Effect)
    if ($BLOCKER_EFFECTS -contains $Effect) { return "blocker" }
    if ($AUTO_REMEDIATE_EFFECTS -contains $Effect) { return "auto-remediate" }
    return "informational"
}

function Test-IsDefenderAuto {
    param($Assignment)
    $props = $Assignment.properties
    if (-not $props) { return $false }
    if (-not $props.PSObject.Properties['metadata']) { return $false }
    $metadata = $props.metadata
    if (-not $metadata -or -not $metadata.PSObject.Properties['assignedBy']) { return $false }
    $assignedBy = $metadata.assignedBy
    if (-not $assignedBy) { return $false }
    return ($DEFENDER_ASSIGNED_BY -contains $assignedBy)
}

function Get-ResourceTypes {
    param($Defn)
    $types = @()
    $rule = $Defn.properties.policyRule
    if (-not $rule) { return $types }
    $ruleJson = $rule | ConvertTo-Json -Depth 20 -Compress
    $matches = [regex]::Matches($ruleJson, '"type"\s*:\s*"(Microsoft\.\w+/\w+(?:/\w+)?)"')
    foreach ($m in $matches) {
        $t = $m.Groups[1].Value
        if ($types -notcontains $t) { $types += $t }
    }
    return $types
}

function Get-RequiredValue {
    param($Defn)
    $rule = $Defn.properties.policyRule
    if (-not $rule) { return $null }
    $then = $rule.then
    if (-not $then -or -not $then.details) { return $null }
    $val = $then.details.value
    if ($null -ne $val) { return $val }
    $existCond = $then.details.existenceCondition
    if ($existCond) {
        $condJson = $existCond | ConvertTo-Json -Depth 10 -Compress
        $valMatch = [regex]::Match($condJson, '"(?:equals|in)"\s*:\s*(\[.*?\]|"[^"]*"|\d+|true|false)')
        if ($valMatch.Success) { return $valMatch.Groups[1].Value }
    }
    return $null
}

function Get-PropertyPaths {
    param($Defn, $ResourceTypes)
    $result = @{ azurePropertyPath = $null; bicepPropertyPath = $null; pathSemantics = $null }
    $rule = $Defn.properties.policyRule
    if (-not $rule) { return $result }
    $ruleJson = $rule | ConvertTo-Json -Depth 20 -Compress
    # Look for field conditions
    $fieldMatch = [regex]::Match($ruleJson, '"field"\s*:\s*"([^"]+)"')
    if ($fieldMatch.Success) {
        $field = $fieldMatch.Groups[1].Value
        if ($field -match '^Microsoft\.' -or $field -match '^\[') { return $result }
        if ($field -match 'tags\[') {
            $result.pathSemantics = "tag-policy-non-property"
            return $result
        }
        $result.azurePropertyPath = "properties.$field"
        $bicep = $field -replace '\.', '.'
        $result.bicepPropertyPath = $bicep
    }
    return $result
}

function Get-TagsRequired {
    param($Findings)
    $seen = @{}
    $tags = @()
    foreach ($f in $Findings) {
        $isTag = ($f.pathSemantics -eq "tag-policy-non-property") -or (($f.category -split '\s')[0] -ieq "Tags")
        if (-not $isTag) { continue }
        $params = $f.assignment_parameters
        $tagKeys = @()
        foreach ($pn in @("tagName", "tagname", "tag_name")) {
            if ($params -and $params.$pn) {
                $v = $params.$pn
                if ($v -is [string]) { $tagKeys += $v }
                elseif ($v -is [array]) { $tagKeys += $v }
            }
        }
        foreach ($pn in @("tagNames", "listOfTagNames", "tagnames")) {
            if ($params -and $params.$pn -and $params.$pn -is [array]) {
                $tagKeys += $params.$pn
            }
        }
        if ($tagKeys.Count -gt 0) {
            foreach ($key in $tagKeys) {
                $key = $key.Trim()
                if ($key -and -not $seen.ContainsKey($key)) {
                    $seen[$key] = $true
                    $tags += @{ name = $key; source_policy = $f.policy_id; source_assignment = $f.assignment_display_name }
                }
            }
        }
        else {
            $policyName = ($f.display_name -split '\s')[0..99] -join ' '
            if ($policyName -and -not $seen.ContainsKey($policyName)) {
                $seen[$policyName] = $true
                $tags += @{ name = "[unresolved: $policyName]"; source_policy = $f.policy_id; source_assignment = $f.assignment_display_name; unresolved = "true" }
            }
        }
    }
    return $tags
}

function Get-AllowedLocations {
    param($Findings)
    $locations = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($f in $Findings) {
        $dn = ($f.display_name -replace '\s', ' ').ToLower()
        $cat = ($f.category -replace '\s', ' ').ToLower()
        $isLocation = ($dn -match 'location') -or ($dn -match 'region') -or ($cat -match 'location')
        if ($isLocation) {
            $rv = $f.required_value
            if ($rv -is [array]) { foreach ($v in $rv) { [void]$locations.Add([string]$v) } }
            elseif ($rv -is [string] -and $rv) { [void]$locations.Add($rv) }
        }
        $params = $f.assignment_parameters
        if ($params) {
            foreach ($pn in @("listOfAllowedLocations", "allowedLocations", "listofallowedlocations", "allowedlocations")) {
                if ($params.$pn -is [array]) {
                    foreach ($v in $params.$pn) { if ($v) { [void]$locations.Add([string]$v) } }
                }
            }
        }
    }
    return ($locations | Sort-Object)
}

# ─── Process a single subscription ──────────────────────────────────────────
function Process-Subscription {
    param([string]$SubId, [string]$Token)

    $base = "$ARM/subscriptions/$SubId/providers/Microsoft.Authorization"

    $assignments = Invoke-ArmRest -Url "$base/policyAssignments?`$filter=atScope()&api-version=$API_ASSIGNMENTS" -Token $Token
    $subDefs = Invoke-ArmRest -Url "$base/policyDefinitions?api-version=$API_DEFINITIONS" -Token $Token
    $subSets = Invoke-ArmRest -Url "$base/policySetDefinitions?api-version=$API_DEFINITIONS" -Token $Token
    $exemptions = Invoke-ArmRest -Url "$base/policyExemptions?`$filter=atScope()&api-version=$API_EXEMPTIONS" -Token $Token

    $defs = @{}
    foreach ($d in $subDefs) { $defs[($d.id).ToLower()] = $d }
    $sets = @{}
    foreach ($s in $subSets) { $sets[($s.id).ToLower()] = $s }

    # Build exemption map
    $exemptionMap = @{}
    foreach ($ex in $exemptions) {
        $exProps = $ex.properties
        if (-not $exProps) { continue }
        $asgId = ($exProps.policyAssignmentId -replace '\s', '').ToLower()
        if ($asgId) { $exemptionMap[$asgId] = @{ category = $exProps.exemptionCategory; policyDefinitionReferenceIds = $exProps.policyDefinitionReferenceIds } }
    }

    # Filter Defender auto-assignments
    $filteredDefender = @()
    $keptAssignments = @()
    foreach ($a in $assignments) {
        if ((Test-IsDefenderAuto $a) -and -not $IncludeDefenderAuto) {
            $filteredDefender += ($a.properties.displayName ?? $a.name ?? $a.id ?? "<unknown>")
        }
        else { $keptAssignments += $a }
    }

    $assignmentInventory = @()
    $findings = @()
    $auditCount = 0
    $disabledCount = 0

    foreach ($a in $keptAssignments) {
        $props = $a.properties
        $display = $props.displayName ?? $a.name ?? $a.id ?? "<unknown>"
        $scope = $props.scope ?? ""
        $policyDefId = ($props.policyDefinitionId ?? "").ToLower()
        $assignmentId = ($a.id ?? "").ToLower()
        $assignmentType = if ($scope.ToLower() -match '/providers/microsoft.management/managementgroups/') { "management-group" } else { "subscription" }

        $assignmentInventory += @{
            displayName = $display
            scope = $scope
            assignmentType = $assignmentType
            policyDefinitionId = $policyDefId
        }

        if (-not $policyDefId) { continue }

        # Resolve members
        $members = @()
        if ($policyDefId -match '/policysetdefinitions/' -and $sets.ContainsKey($policyDefId)) {
            $setMembers = $sets[$policyDefId].properties.policyDefinitions
            if ($setMembers) {
                foreach ($m in $setMembers) {
                    $mid = ($m.policyDefinitionId ?? "").ToLower()
                    if ($defs.ContainsKey($mid)) {
                        $members += @{ defn = $defs[$mid]; memberRefId = $m.policyDefinitionReferenceId }
                    }
                }
            }
        }
        elseif ($defs.ContainsKey($policyDefId)) {
            $members += @{ defn = $defs[$policyDefId]; memberRefId = $null }
        }

        foreach ($member in $members) {
            $defn = $member.defn
            $memberRefId = $member.memberRefId
            $eff = Get-EffectOf $defn
            if (-not $eff) { continue }
            if ($eff -eq "Disabled") { $disabledCount++; continue }
            if ($eff -in @("Audit", "AuditIfNotExists")) { $auditCount++; continue }
            if ($eff -notin $RELEVANT_EFFECTS) { continue }

            $rtypes = Get-ResourceTypes $defn
            $paths = Get-PropertyPaths $defn $rtypes
            $category = $defn.properties.metadata.category ?? "Uncategorized"

            $exemption = $null
            if ($exemptionMap.ContainsKey($assignmentId)) {
                $candidate = $exemptionMap[$assignmentId]
                $refIds = $candidate.policyDefinitionReferenceIds
                if (-not $refIds -or $memberRefId -in $refIds) {
                    $exemption = $candidate
                }
            }

            $classification = Get-Classification $eff
            if ($exemption -and $classification -eq "blocker") { $classification = "informational" }

            $effectLower = $eff.Substring(0,1).ToLower() + $eff.Substring(1)

            $finding = [ordered]@{
                policy_id = $defn.id
                display_name = $defn.properties.displayName ?? $defn.name ?? $defn.id
                effect = $effectLower
                scope = $scope
                assignment_display_name = $display
                assignment_id = $a.id
                classification = $classification
                category = $category
                resource_types = @($rtypes)
                required_value = (Get-RequiredValue $defn)
                azurePropertyPath = $paths.azurePropertyPath
                bicepPropertyPath = $paths.bicepPropertyPath
                exemption = $exemption
                override = $null
            }

            # Assignment parameters
            $assignmentParams = $props.parameters
            if ($assignmentParams) {
                $paramValues = [ordered]@{}
                foreach ($key in ($assignmentParams | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)) {
                    $val = $assignmentParams.$key.value
                    if ($null -ne $val) { $paramValues[$key] = $val }
                }
                if ($paramValues.Count -gt 0) { $finding.assignment_parameters = $paramValues }
            }
            if ($paths.pathSemantics) { $finding.pathSemantics = $paths.pathSemantics }
            $findings += $finding
        }
    }

    $blockerCount = ($findings | Where-Object { $_.classification -eq "blocker" }).Count
    $autoRemediateCount = ($findings | Where-Object { $_.classification -eq "auto-remediate" }).Count
    $exemptedCount = ($findings | Where-Object { $null -ne $_.exemption }).Count
    $infoCount = ($findings | Where-Object { $_.classification -eq "informational" }).Count
    $subScopeCount = ($keptAssignments | Where-Object { $_.properties.scope -and $_.properties.scope.ToLower() -notmatch '/providers/microsoft.management/' }).Count
    $mgInheritedCount = ($keptAssignments | Where-Object { $_.properties.scope -and $_.properties.scope.ToLower() -match '/providers/microsoft.management/' }).Count

    $tagsRequired = Get-TagsRequired $findings
    $allowedLocations = Get-AllowedLocations $findings

    return [ordered]@{
        schema_version = "governance-constraints-v1"
        subscription_id = $SubId
        discovered_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ" -AsUTC)
        source = "github-actions-baseline"
        discovery_status = "COMPLETE"
        discovery_summary = [ordered]@{
            assignment_total = $assignments.Count
            assignment_kept = $keptAssignments.Count
            defender_auto_filtered = $filteredDefender.Count
            subscription_scope_count = $subScopeCount
            management_group_inherited_count = $mgInheritedCount
            blocker_count = $blockerCount
            auto_remediate_count = $autoRemediateCount
            informational_count = $infoCount
            audit_count = $auditCount
            disabled_count = $disabledCount
            exempted_count = $exemptedCount
        }
        assignment_inventory = @($assignmentInventory)
        findings = @($findings)
        policies = @($findings)
        tags_required = @($tagsRequired)
        allowed_locations = @($allowedLocations)
    }
}

# ─── Main ────────────────────────────────────────────────────────────────────
Write-Host "Governance Baseline Collector — MG: $ManagementGroupId"

$token = Get-ArmToken
Write-Host "ARM token acquired"

# Discover descendant subscriptions
$descendantsUrl = "$ARM/providers/Microsoft.Management/managementGroups/$ManagementGroupId/descendants?api-version=$API_MG_DESCENDANTS"
$descendants = Invoke-ArmRest -Url $descendantsUrl -Token $token
$allSubs = $descendants | Where-Object { $_.type -eq "Microsoft.Management/managementGroups/subscriptions" }
$allSubs = $allSubs | Sort-Object { $_.name }
Write-Host "Discovered $($allSubs.Count) subscriptions under MG: $ManagementGroupId"

# Exclusion checks
$subscriptionsExcluded = @()
$eligibleSubs = @()
foreach ($sub in $allSubs) {
    $subId = $sub.name
    try {
        $subDetail = Invoke-RestMethod -Uri "$ARM/subscriptions/${subId}?api-version=2022-12-01" `
            -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
            -Method Get -ErrorAction Stop
    }
    catch {
        $subscriptionsExcluded += [ordered]@{ subscription_id = $subId; reason = "unreadable"; detail = "$_" }
        Write-Warning "Excluding $subId — unreadable: $_"
        continue
    }
    $state = $subDetail.subscriptionPolicies.spendingLimit ?? $subDetail.state ?? "Unknown"
    if ($subDetail.state -eq "Disabled") {
        $subscriptionsExcluded += [ordered]@{ subscription_id = $subId; reason = "disabled" }
        Write-Warning "Excluding $subId — disabled"
        continue
    }
    $quotaId = $subDetail.subscriptionPolicies.quotaId ?? ""
    if ($quotaId -like "AAD_*") {
        $subscriptionsExcluded += [ordered]@{ subscription_id = $subId; reason = "AAD_quota"; quota_id = $quotaId }
        Write-Warning "Excluding $subId — AAD quota: $quotaId"
        continue
    }
    $eligibleSubs += $subId
}

# Apply cap
$subscriptionsSkipped = @()
$subsToProcess = $eligibleSubs
if ($eligibleSubs.Count -gt $MaxSubscriptions) {
    $subsToProcess = $eligibleSubs[0..($MaxSubscriptions - 1)]
    $subscriptionsSkipped = $eligibleSubs[$MaxSubscriptions..($eligibleSubs.Count - 1)]
    Write-Warning "Cap applied: processing $MaxSubscriptions of $($eligibleSubs.Count) eligible. Skipping $($subscriptionsSkipped.Count)."
}

$coverageStatus = if ($subscriptionsSkipped.Count -gt 0) { "PARTIAL" } else { "COMPLETE" }

# Read existing baseline for timestamp preservation
$baselineFile = Join-Path $OutputDir "governance-policy-baseline.json"
$existingBaseline = $null
if (Test-Path $baselineFile) {
    try {
        $existingBaseline = Get-Content $baselineFile -Raw | ConvertFrom-Json
    }
    catch { Write-Warning "Could not parse existing baseline for timestamp preservation" }
}

# Process subscriptions
$subscriptions = [ordered]@{}
$totalProcessed = 0
$subIndex = 0
foreach ($subId in $subsToProcess) {
    $subIndex++
    Write-Host "Processing subscription ${subIndex}/$($subsToProcess.Count): $subId"
    try {
        $envelope = Process-Subscription -SubId $subId -Token $token
    }
    catch {
        Write-Warning "Failed to process subscription $subId — $_"
        $subscriptionsExcluded += [ordered]@{ subscription_id = $subId; reason = "processing_error"; detail = "$_" }
        continue
    }

    # Timestamp preservation: if content is identical to prior run, keep old discovered_at
    if ($existingBaseline -and $existingBaseline.subscriptions.$subId) {
        $priorEntry = $existingBaseline.subscriptions.$subId
        $priorCopy = $priorEntry | ConvertTo-Json -Depth 50 -Compress | ConvertFrom-Json
        $currentCopy = $envelope | ConvertTo-Json -Depth 50 -Compress | ConvertFrom-Json
        # Null out discovered_at for comparison
        $priorCopy.discovered_at = ""
        $currentCopy.discovered_at = ""
        $priorJson = $priorCopy | ConvertTo-Json -Depth 50 -Compress
        $currentJson = $currentCopy | ConvertTo-Json -Depth 50 -Compress
        if ($priorJson -eq $currentJson) {
            $envelope.discovered_at = $priorEntry.discovered_at
            Write-Host "  Subscription $subId unchanged — preserving discovered_at"
        }
    }

    $subscriptions[$subId] = $envelope
    $totalProcessed++
}

# Build summary
$totalBlockers = 0
$totalAutoRemediate = 0
$totalFindings = 0
foreach ($sub in $subscriptions.Values) {
    $totalBlockers += $sub.discovery_summary.blocker_count
    $totalAutoRemediate += $sub.discovery_summary.auto_remediate_count
    $totalFindings += $sub.findings.Count
}

$baseline = [ordered]@{
    schema_version = "governance-baseline-v1"
    management_group_id = $ManagementGroupId
    coverage_status = $coverageStatus
    subscriptions_discovered = $allSubs.Count
    subscriptions_processed = $totalProcessed
    subscriptions_skipped = @($subscriptionsSkipped)
    subscriptions_excluded = @($subscriptionsExcluded)
    summary = [ordered]@{
        total_findings = $totalFindings
        total_blockers = $totalBlockers
        total_auto_remediate = $totalAutoRemediate
        subscriptions_complete = $totalProcessed
    }
    subscriptions = $subscriptions
}

# Write output
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$baselineJson = $baseline | ConvertTo-Json -Depth 50
$baselineJson | Set-Content -Path $baselineFile -NoNewline
Write-Host "Wrote baseline: $baselineFile"

# Write raw debug file (gitignored — not committed)
$rawFile = Join-Path $OutputDir "governance-policy-raw.json"
$baseline | ConvertTo-Json -Depth 100 | Set-Content -Path $rawFile -NoNewline
Write-Host "Wrote raw debug: $rawFile (gitignored)"

Write-Host "Done. Coverage: $coverageStatus | Processed: $totalProcessed | Excluded: $($subscriptionsExcluded.Count) | Skipped: $($subscriptionsSkipped.Count)"
