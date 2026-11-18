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

.EXAMPLE
    pwsh -NoLogo -NoProfile -NonInteractive -File tools/scripts/collect-governance-baseline.ps1 -ManagementGroupId "mg-root"
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

function Read-GzipJson {
    param([string]$Path)
    $file = [System.IO.File]::OpenRead($Path)
    try {
        $gzip = [System.IO.Compression.GZipStream]::new($file, [System.IO.Compression.CompressionMode]::Decompress)
        try {
            $reader = [System.IO.StreamReader]::new($gzip, [System.Text.UTF8Encoding]::new($false))
            try { return $reader.ReadToEnd() | ConvertFrom-Json }
            finally { $reader.Dispose() }
        }
        finally { $gzip.Dispose() }
    }
    finally { $file.Dispose() }
}

function Write-GzipJson {
    param([string]$Path, [string]$Json)
    $file = [System.IO.File]::Create($Path)
    try {
        $gzip = [System.IO.Compression.GZipStream]::new($file, [System.IO.Compression.CompressionLevel]::Optimal)
        try {
            $writer = [System.IO.StreamWriter]::new($gzip, [System.Text.UTF8Encoding]::new($false))
            try { $writer.Write($Json) }
            finally { $writer.Dispose() }
        }
        finally { $gzip.Dispose() }
    }
    finally { $file.Dispose() }
}

# ─── ARM Token ───────────────────────────────────────────────────────────────
function Get-ArmToken {
    $tokenJson = az account get-access-token --resource "$ARM" -o json 2>$null
    if (-not $tokenJson) { throw "Failed to acquire ARM token via az account get-access-token" }
    $token = $tokenJson | ConvertFrom-Json
    return $token.accessToken
}

function Get-HttpStatusCode {
    param($ErrorRecord)
    if ($null -eq $ErrorRecord) { return $null }
    $ex = if ($ErrorRecord -is [System.Management.Automation.ErrorRecord]) { $ErrorRecord.Exception } else { $ErrorRecord }
    for ($cur = $ex; $null -ne $cur; $cur = $cur.InnerException) {
        if ($cur.PSObject.Properties['Response'] -and $null -ne $cur.Response) {
            $resp = $cur.Response
            if ($resp.PSObject.Properties['StatusCode'] -and $null -ne $resp.StatusCode) {
                $code = [int]$resp.StatusCode
                if ($code -ge 100 -and $code -le 599) { return $code }
            }
        }
        if ($cur.PSObject.Properties['StatusCode'] -and $null -ne $cur.StatusCode) {
            $code = [int]$cur.StatusCode
            if ($code -ge 100 -and $code -le 599) { return $code }
        }
    }
    $text = "$ErrorRecord"
    if ($text -match '(?i)\bHTTP(?:/\d(?:\.\d)?)?\s+(\d{3})\b') {
        return [int]$Matches[1]
    }
    if ($text -match '(?i)\b(403)\s+Forbidden\b') {
        return 403
    }
    return $null
}

$CANONICAL_SURFACES = @{
    "policyassignments" = "policyAssignments"
    "policydefinitions" = "policyDefinitions"
    "policysetdefinitions" = "policySetDefinitions"
    "policyexemptions" = "policyExemptions"
}

$MG_RESOURCE_REGEX = '(?i)/providers/Microsoft\.Management/managementGroups/([^/?#''"\s]+)(?:/providers/Microsoft\.Authorization/(policyAssignments|policyDefinitions|policySetDefinitions|policyExemptions)(?:/[^/?#''"\s]+)?)?'

function Get-ManagementGroupScopeInfo {
    param(
        [string]$Target = "",
        [string]$Detail = "",
        [string]$SubscriptionId = "",
        [string]$DefaultSurface = "policyDefinitions"
    )
    $cleanTarget = if ($Target) { ($Target -replace "^$([regex]::Escape($ARM))", "") -split '\?', 2 | Select-Object -First 1 } else { "" }
    $targetMatch = [regex]::Match($cleanTarget, $MG_RESOURCE_REGEX)
    if ($targetMatch.Success) {
        $mgId = $targetMatch.Groups[1].Value
        $rawSurface = $targetMatch.Groups[2].Value.ToLower()
        $surface = if ($rawSurface -and $CANONICAL_SURFACES.ContainsKey($rawSurface)) { $CANONICAL_SURFACES[$rawSurface] } else { $DefaultSurface }
        return @{
            Scope = "/providers/Microsoft.Management/managementGroups/$mgId"
            ManagementGroup = $mgId
            Surface = $surface
            ResourceId = $cleanTarget
        }
    }
    if ($Detail) {
        $loweredDetail = $Detail.ToLower()
        if ($SubscriptionId) {
            $subScope = "/subscriptions/$($SubscriptionId.ToLower())"
            if ($loweredDetail.Contains("scope '$subScope'") -or $loweredDetail.Contains("scope `"$subScope`"")) {
                return $null
            }
        }
        $detailMatch = [regex]::Match($Detail, $MG_RESOURCE_REGEX)
        if ($detailMatch.Success) {
            $mgId = $detailMatch.Groups[1].Value
            $rawSurface = $detailMatch.Groups[2].Value.ToLower()
            $surface = if ($rawSurface -and $CANONICAL_SURFACES.ContainsKey($rawSurface)) { $CANONICAL_SURFACES[$rawSurface] } else { $DefaultSurface }
            return @{
                Scope = "/providers/Microsoft.Management/managementGroups/$mgId"
                ManagementGroup = $mgId
                Surface = $surface
                ResourceId = $detailMatch.Value
            }
        }
    }
    return $null
}

function Get-ScopeMetadataForId {
    param(
        [string]$ResourceId = "",
        [string]$SubscriptionId = "",
        [string]$FallbackScope = ""
    )
    $clean = if ($ResourceId) { ($ResourceId -replace "^$([regex]::Escape($ARM))", "") -split '\?', 2 | Select-Object -First 1 } else { "" }
    $lowered = $clean.ToLower()
    $surface = "policyDefinitions"
    foreach ($marker in $CANONICAL_SURFACES.Keys) {
        if ($lowered.Contains("/$marker/") -or $lowered.EndsWith("/$marker")) {
            $surface = $CANONICAL_SURFACES[$marker]
            break
        }
    }
    $mgInfo = Get-ManagementGroupScopeInfo -Target $clean -DefaultSurface $surface
    if ($null -ne $mgInfo) {
        return [ordered]@{
            scope = $mgInfo.Scope
            management_group = $mgInfo.ManagementGroup
            surface = $mgInfo.Surface
            resource_id = $mgInfo.ResourceId
        }
    }
    $scope = $FallbackScope
    if (-not $scope -and $lowered.Contains("/providers/microsoft.authorization/")) {
        $scope = ($clean -split '(?i)/providers/Microsoft\.Authorization/', 2)[0]
    }
    if (-not $scope) {
        $scope = if ($lowered.StartsWith("/providers/microsoft.authorization/")) { "/providers/Microsoft.Authorization" } else { "/subscriptions/$SubscriptionId" }
    }
    $out = [ordered]@{
        scope = $scope
        surface = $surface
        resource_id = if ($clean) { $clean } else { $scope }
    }
    $scopeMg = Get-ManagementGroupScopeInfo -Target $scope -DefaultSurface $surface
    if ($null -ne $scopeMg) {
        $out.scope = $scopeMg.Scope
        $out.management_group = $scopeMg.ManagementGroup
    }
    return $out
}

function Get-NormalizedUnresolvedScopes {
    param([array]$Entries)
    $deduped = @{}
    foreach ($entry in $Entries) {
        if ($null -eq $entry) { continue }
        $statusPart = if ($entry.Contains("http_status") -and $null -ne $entry["http_status"]) { [string]$entry["http_status"] } else { "" }
        $key = "$($entry['reason'])|$(([string]$entry['scope']).ToLower())|$($entry['surface'])|$(([string]$entry['resource_id']).ToLower())|$statusPart"
        if (-not $deduped.ContainsKey($key)) {
            $deduped[$key] = $entry
        }
    }
    return @(
        $deduped.Values | Sort-Object `
            @{ Expression = { ([string]$_['scope']).ToLower() } }, `
            @{ Expression = { [string]$_['surface'] } }, `
            @{ Expression = { ([string]$_['resource_id']).ToLower() } }, `
            @{ Expression = { [string]$_['reason'] } }
    )
}

function Invoke-ArmRest {
    param(
        [string]$Url,
        [string]$Token,
        [switch]$PropagateErrors
    )
    $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
    $allValues = @()
    $currentUrl = $Url
    do {
        try {
            $response = Invoke-RestMethod -Uri $currentUrl -Headers $headers -Method Get -ErrorAction Stop
        }
        catch {
            if ($PropagateErrors) { throw }
            Write-Warning "ARM REST call failed: $currentUrl — $_"
            return $allValues
        }
        if ($response.PSObject.Properties['value']) { $allValues += $response.value }
        $currentUrl = if ($response.PSObject.Properties['nextLink']) { $response.nextLink } else { $null }
    } while ($currentUrl)
    return $allValues
}

function Invoke-ArmRestSingle {
    param(
        [string]$Url,
        [string]$Token,
        [string]$ExpectedId = "",
        [string]$DefaultSurface = "policyDefinitions",
        [System.Collections.IList]$UnresolvedScopes = $null
    )
    $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
    try {
        $resp = Invoke-RestMethod -Uri $Url -Headers $headers -Method Get -ErrorAction Stop
        if ($null -eq $resp) { return $null }
        if ($resp.PSObject.Properties['value'] -and $resp.value -is [System.Collections.IList]) {
            if ($ExpectedId) {
                foreach ($item in $resp.value) {
                    if ($item.id -and $item.id.ToLower() -eq $ExpectedId.ToLower()) { return $item }
                }
                return $null
            }
            return $(if ($resp.value.Count -gt 0) { $resp.value[0] } else { $null })
        }
        if ($resp.PSObject.Properties['id'] -and $resp.id) {
            if (-not $ExpectedId -or $resp.id.ToLower() -eq $ExpectedId.ToLower()) { return $resp }
        }
        return $null
    }
    catch {
        $code = Get-HttpStatusCode $_
        if ($code -eq 404) { return $null }
        if ($code -eq 403) {
            $target = if ($ExpectedId) { $ExpectedId } else { $Url }
            $mgInfo = Get-ManagementGroupScopeInfo -Target $target -Detail "$_" -DefaultSurface $DefaultSurface
            if ($null -ne $mgInfo -and $null -ne $UnresolvedScopes) {
                [void]$UnresolvedScopes.Add([ordered]@{
                    reason = "ancestor_scope_forbidden"
                    scope = $mgInfo.Scope
                    management_group = $mgInfo.ManagementGroup
                    surface = $mgInfo.Surface
                    resource_id = if ($ExpectedId) { $ExpectedId } else { $mgInfo.ResourceId }
                    http_status = 403
                })
                Write-Warning "Ancestor management-group scope forbidden (HTTP 403): $($mgInfo.Scope) ($($mgInfo.Surface): $(if ($ExpectedId) { $ExpectedId } else { $mgInfo.ResourceId }))"
                return $null
            }
        }
        Write-Warning "ARM REST single fetch failed: $Url — $_"
        return $null
    }
}

# ─── Classification (mirrors discover.py exactly) ───────────────────────────
function Resolve-ParameterValue {
    param($Value, [hashtable]$Parameters)
    if ($null -eq $Value) { return $null }
    if ($Value -is [string]) {
        $trimmed = $Value.Trim()
        if ($trimmed -match "^\[parameters\('([^']+)'\)\]$") {
            $key = $Matches[1].ToLower()
            if ($Parameters.ContainsKey($key)) { return $Parameters[$key] }
            return $Value
        }
        if ($trimmed -match "^\[if\(contains\(parameters\('([^']+)'\),\s*'([^']+)'\),\s*parameters\('([^']+)'\),\s*'([^']+)'\)\]$") {
            $listKey = $Matches[1].ToLower()
            $targetType = $Matches[2].ToLower()
            $effectKey = $Matches[3].ToLower()
            $fallbackEffect = $Matches[4]
            if ($Parameters.ContainsKey($listKey) -and $Parameters.ContainsKey($effectKey)) {
                $container = $Parameters[$listKey]
                $chosen = $Parameters[$effectKey]
                if ($container -is [array] -and $null -ne $chosen) {
                    $lowerItems = @($container | ForEach-Object { ([string]$_).ToLower() })
                    if ($lowerItems -contains $targetType) { return [string]$chosen }
                    return [string]$fallbackEffect
                }
            }
        }
        return $Value
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $resolvedDict = [ordered]@{}
        foreach ($entryKey in $Value.Keys) {
            $resolvedDict[$entryKey] = Resolve-ParameterValue -Value $Value[$entryKey] -Parameters $Parameters
        }
        return $resolvedDict
    }
    if ($Value -is [System.Collections.IList]) {
        $resolvedList = @()
        foreach ($item in $Value) {
            $resolvedList += ,(Resolve-ParameterValue -Value $item -Parameters $Parameters)
        }
        return ,$resolvedList
    }
    if ($Value -is [pscustomobject]) {
        $resolvedObj = [ordered]@{}
        foreach ($prop in $Value.PSObject.Properties) {
            $resolvedObj[$prop.Name] = Resolve-ParameterValue -Value $prop.Value -Parameters $Parameters
        }
        return [pscustomobject]$resolvedObj
    }
    return $Value
}

$CALLER_IDENTITY_EXPR_REGEX = '(?i)(?:requestContext\s*\(\s*\)\s*\.\s*identity\b|requestContext\s*\(\s*\)\s*\[\s*[''"]identity[''"]\s*\]|tryGet\s*\(\s*requestContext\s*\(\s*\)\s*,\s*[''"]identity[''"]\s*\))'
$DISALLOWED_POLICY_FN_REGEX = '(?i)\b(?:field|resourceGroup|subscription|tenant|policy|deployment)\s*\('
$CURRENT_FN_REGEX = '(?i)\bcurrent\s*\(\s*(?:[''"]([^''"]+)[''"])?\s*\)'
$ANY_REQUEST_CONTEXT_REGEX = '(?i)\brequestContext\b'
$CONDITION_OPERATORS_LOWER = @(
    "equals", "notequals", "like", "notlike", "match", "matchinsensitively",
    "notmatch", "notmatchinsensitively", "contains", "notcontains", "in", "notin",
    "containskey", "notcontainskey", "less", "lessorequals", "greater", "greaterorequals", "exists"
)

function ConvertTo-LowerKeyTable {
    param($Node)
    if ($null -eq $Node) { return $null }
    if ($Node -is [System.Collections.IDictionary]) {
        $map = @{}
        foreach ($k in $Node.Keys) { $map[([string]$k).ToLower()] = $Node[$k] }
        return $map
    }
    if ($Node -is [pscustomobject]) {
        $map = @{}
        foreach ($prop in $Node.PSObject.Properties) { $map[$prop.Name.ToLower()] = $prop.Value }
        return $map
    }
    return $null
}

function Test-IdentityValue {
    param($Value, [string[]]$BoundCountNames = @())
    if ($null -eq $Value -or $Value -is [bool] -or $Value -is [ValueType]) {
        return [pscustomobject]@{ Ok = $true; SawIdentity = $false }
    }
    if ($Value -is [string]) {
        $trimmed = $Value.Trim()
        if ($trimmed.StartsWith("[") -and -not $trimmed.StartsWith("[[") -and $trimmed.EndsWith("]")) {
            if ([regex]::IsMatch($trimmed, $DISALLOWED_POLICY_FN_REGEX)) {
                return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
            }
            foreach ($cm in [regex]::Matches($trimmed, $CURRENT_FN_REGEX)) {
                $boundName = if ($cm.Groups[1].Success -and $cm.Groups[1].Value) { $cm.Groups[1].Value.ToLower() } else { "default" }
                if ($BoundCountNames -notcontains $boundName) {
                    return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
                }
            }
            $hasIdentity = [regex]::IsMatch($trimmed, $CALLER_IDENTITY_EXPR_REGEX)
            $stripped = [regex]::Replace($trimmed, $CALLER_IDENTITY_EXPR_REGEX, "")
            if ([regex]::IsMatch($stripped, $ANY_REQUEST_CONTEXT_REGEX)) {
                return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
            }
            return [pscustomobject]@{ Ok = $true; SawIdentity = $hasIdentity }
        }
        return [pscustomobject]@{ Ok = $true; SawIdentity = $false }
    }
    if ($Value -is [System.Collections.IList]) {
        $saw = $false
        foreach ($item in $Value) {
            $res = Test-IdentityValue -Value $item -BoundCountNames $BoundCountNames
            if (-not $res.Ok) { return [pscustomobject]@{ Ok = $false; SawIdentity = $false } }
            $saw = $saw -or $res.SawIdentity
        }
        return [pscustomobject]@{ Ok = $true; SawIdentity = $saw }
    }
    return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
}

function Test-IdentityCondition {
    param($Node, [string[]]$BoundCountNames = @())
    $lowerMap = ConvertTo-LowerKeyTable $Node
    if ($null -eq $lowerMap -or $lowerMap.Count -eq 0) {
        return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
    }
    if ($lowerMap.ContainsKey("field")) {
        return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
    }
    if ($lowerMap.Count -eq 1 -and ($lowerMap.ContainsKey("allof") -or $lowerMap.ContainsKey("anyof"))) {
        $key = if ($lowerMap.ContainsKey("allof")) { "allof" } else { "anyof" }
        $children = $lowerMap[$key]
        if (-not ($children -is [System.Collections.IList]) -or $children.Count -eq 0) {
            return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
        }
        $saw = $false
        foreach ($child in $children) {
            $res = Test-IdentityCondition -Node $child -BoundCountNames $BoundCountNames
            if (-not $res.Ok) { return [pscustomobject]@{ Ok = $false; SawIdentity = $false } }
            $saw = $saw -or $res.SawIdentity
        }
        return [pscustomobject]@{ Ok = $true; SawIdentity = $saw }
    }
    if ($lowerMap.Count -eq 1 -and $lowerMap.ContainsKey("not")) {
        return Test-IdentityCondition -Node $lowerMap["not"] -BoundCountNames $BoundCountNames
    }
    if ($lowerMap.ContainsKey("count")) {
        $opKeys = @($lowerMap.Keys | Where-Object { $_ -ne "count" })
        $countMap = ConvertTo-LowerKeyTable $lowerMap["count"]
        if ($opKeys.Count -ne 1 -or ($CONDITION_OPERATORS_LOWER -notcontains $opKeys[0]) -or $null -eq $countMap) {
            return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
        }
        if ($countMap.ContainsKey("field") -or -not $countMap.ContainsKey("value")) {
            return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
        }
        foreach ($ck in $countMap.Keys) {
            if ($ck -notin @("value", "name", "where")) {
                return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
            }
        }
        $valRes = Test-IdentityValue -Value $countMap["value"] -BoundCountNames $BoundCountNames
        if (-not $valRes.Ok) { return [pscustomobject]@{ Ok = $false; SawIdentity = $false } }
        $opRes = Test-IdentityValue -Value $lowerMap[$opKeys[0]] -BoundCountNames $BoundCountNames
        if (-not $opRes.Ok) { return [pscustomobject]@{ Ok = $false; SawIdentity = $false } }
        $sawWhere = $false
        if ($countMap.ContainsKey("where")) {
            $rawName = $countMap["name"]
            $nextName = if ($rawName -is [string] -and $rawName) { $rawName.ToLower() } else { "default" }
            $nextBound = @($BoundCountNames + $nextName | Select-Object -Unique)
            $whereRes = Test-IdentityCondition -Node $countMap["where"] -BoundCountNames $nextBound
            if (-not $whereRes.Ok) { return [pscustomobject]@{ Ok = $false; SawIdentity = $false } }
            $sawWhere = $whereRes.SawIdentity
        }
        return [pscustomobject]@{ Ok = $true; SawIdentity = ($valRes.SawIdentity -or $opRes.SawIdentity -or $sawWhere) }
    }
    if ($lowerMap.ContainsKey("value")) {
        $opKeys = @($lowerMap.Keys | Where-Object { $_ -ne "value" })
        if ($opKeys.Count -ne 1 -or ($CONDITION_OPERATORS_LOWER -notcontains $opKeys[0])) {
            return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
        }
        $valRes = Test-IdentityValue -Value $lowerMap["value"] -BoundCountNames $BoundCountNames
        if (-not $valRes.Ok) { return [pscustomobject]@{ Ok = $false; SawIdentity = $false } }
        $opRes = Test-IdentityValue -Value $lowerMap[$opKeys[0]] -BoundCountNames $BoundCountNames
        if (-not $opRes.Ok) { return [pscustomobject]@{ Ok = $false; SawIdentity = $false } }
        return [pscustomobject]@{ Ok = $true; SawIdentity = ($valRes.SawIdentity -or $opRes.SawIdentity) }
    }
    return [pscustomobject]@{ Ok = $false; SawIdentity = $false }
}

function Test-IsCallerIdentityOnly {
    param($Defn, [hashtable]$EffectiveParameters = @{})
    if ($null -eq $Defn -or -not $Defn.properties -or -not $Defn.properties.policyRule) { return $false }
    $ifNode = $Defn.properties.policyRule.if
    if ($null -eq $ifNode) { return $false }
    $resolvedIf = if ($EffectiveParameters.Count -gt 0) {
        Resolve-ParameterValue -Value $ifNode -Parameters $EffectiveParameters
    }
    else {
        $ifNode
    }
    $res = Test-IdentityCondition -Node $resolvedIf
    return [bool]($res.Ok -and $res.SawIdentity)
}

function Get-EffectiveParameters {
    param($Defn, $Supplied)
    $result = @{}
    $defaults = $Defn.properties.parameters
    if ($defaults) {
        foreach ($prop in $defaults.PSObject.Properties) {
            if ($null -ne $prop.Value -and $prop.Value.PSObject.Properties['defaultValue']) {
                $result[$prop.Name.ToLower()] = $prop.Value.defaultValue
            }
        }
    }
    if ($Supplied) {
        foreach ($prop in $Supplied.PSObject.Properties) {
            if ($null -ne $prop.Value -and $prop.Value.PSObject.Properties['value']) {
                $result[$prop.Name.ToLower()] = $prop.Value.value
            }
        }
    }
    return $result
}

function Get-EffectOf {
    param($Defn, [hashtable]$EffectiveParameters = @{})
    $props = $Defn.properties
    if (-not $props) { return $null }
    $rule = $props.policyRule
    if (-not $rule) { return $null }
    $then = $rule.then
    if (-not $then) { return $null }
    $eff = $then.effect
    if (-not $eff) { return $null }
    $params = if ($EffectiveParameters.Count -gt 0) { $EffectiveParameters } else { Get-EffectiveParameters -Defn $Defn -Supplied $null }
    $resolved = Resolve-ParameterValue -Value ([string]$eff) -Parameters $params
    if (-not $resolved -or ($resolved -is [string] -and $resolved.StartsWith("["))) {
        return $null
    }
    $effLower = ([string]$resolved).ToLower()
    switch ($effLower) {
        "deny" { return "Deny" }
        "audit" { return "Audit" }
        "auditifnotexists" { return "AuditIfNotExists" }
        "deployifnotexists" { return "DeployIfNotExists" }
        "modify" { return "Modify" }
        "append" { return "Append" }
        "disabled" { return "Disabled" }
        default { return [string]$resolved }
    }
}

function Get-Classification {
    param(
        [string]$Effect,
        [bool]$IdentityOnly = $false
    )
    if ($BLOCKER_EFFECTS -contains $Effect) {
        if ($IdentityOnly) { return "caller-identity" }
        return "blocker"
    }
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
    $typeMatches = [regex]::Matches($ruleJson, '"type"\s*:\s*"(Microsoft\.\w+/\w+(?:/\w+)?)"')
    foreach ($m in $typeMatches) {
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
    $unresolvedScopeEntries = [System.Collections.ArrayList]::new()

    $assignmentsUrl = "$base/policyAssignments?`$filter=atScope()&api-version=$API_ASSIGNMENTS"
    try {
        $assignments = @(Invoke-ArmRest -Url $assignmentsUrl -Token $Token -PropagateErrors)
    }
    catch {
        $mgInfo = if ((Get-HttpStatusCode $_) -eq 403) {
            Get-ManagementGroupScopeInfo -Target $assignmentsUrl -Detail "$_" -SubscriptionId $SubId -DefaultSurface "policyAssignments"
        }
        else { $null }
        if ($null -eq $mgInfo) { throw }
        [void]$unresolvedScopeEntries.Add([ordered]@{
            reason = "ancestor_scope_forbidden"
            scope = $mgInfo.Scope
            management_group = $mgInfo.ManagementGroup
            surface = "policyAssignments"
            resource_id = $mgInfo.ResourceId
            http_status = 403
        })
        $assignments = @(Invoke-ArmRest -Url "$base/policyAssignments?`$filter=atExactScope()&api-version=$API_ASSIGNMENTS" -Token $Token -PropagateErrors)
    }

    $subDefs = Invoke-ArmRest -Url "$base/policyDefinitions?api-version=$API_DEFINITIONS" -Token $Token
    $subSets = Invoke-ArmRest -Url "$base/policySetDefinitions?api-version=$API_DEFINITIONS" -Token $Token
    $exemptions = Invoke-ArmRest -Url "$base/policyExemptions?`$filter=atScope()&api-version=$API_EXEMPTIONS" -Token $Token

    $defs = @{}
    foreach ($d in $subDefs) { $defs[($d.id).ToLower()] = $d }
    $sets = @{}
    foreach ($s in $subSets) { $sets[($s.id).ToLower()] = $s }

    # Hydrate any assignment stubs missing policyDefinitionId
    for ($idx = 0; $idx -lt $assignments.Count; $idx++) {
        $stub = $assignments[$idx]
        if ($stub.id -and (-not $stub.properties -or -not $stub.properties.policyDefinitionId)) {
            $hydrated = Invoke-ArmRestSingle `
                -Url "$ARM$($stub.id)?api-version=$API_ASSIGNMENTS" `
                -Token $Token `
                -ExpectedId $stub.id `
                -DefaultSurface "policyAssignments" `
                -UnresolvedScopes $unresolvedScopeEntries
            if ($null -ne $hydrated) {
                $assignments[$idx] = $hydrated
            }
        }
    }

    # Phase 2 — Fetch referenced MG/tenant initiatives and definitions not in subscription lists
    $tenantSetIds = [ordered]@{}
    $tenantDefIds = [ordered]@{}
    foreach ($a in $assignments) {
        $pidOriginal = if ($a.properties) { [string]($a.properties.policyDefinitionId ?? "") } else { "" }
        $pidLower = $pidOriginal.ToLower()
        if (-not $pidLower) { continue }
        if ($pidLower.Contains("/policysetdefinitions/") -and -not $sets.ContainsKey($pidLower)) {
            if (-not $tenantSetIds.Contains($pidLower)) { $tenantSetIds[$pidLower] = $pidOriginal }
        }
        elseif ($pidLower.Contains("/policydefinitions/") -and -not $defs.ContainsKey($pidLower)) {
            if (-not $tenantDefIds.Contains($pidLower)) { $tenantDefIds[$pidLower] = $pidOriginal }
        }
    }

    foreach ($origSetId in ($tenantSetIds.Values | Sort-Object)) {
        $fetchedSet = Invoke-ArmRestSingle `
            -Url "$ARM${origSetId}?api-version=$API_DEFINITIONS" `
            -Token $Token `
            -ExpectedId $origSetId `
            -DefaultSurface "policySetDefinitions" `
            -UnresolvedScopes $unresolvedScopeEntries
        if ($null -ne $fetchedSet -and $fetchedSet.id) {
            $sets[$fetchedSet.id.ToLower()] = $fetchedSet
        }
    }

    foreach ($setObj in $sets.Values) {
        $setMembers = if ($setObj.properties) { $setObj.properties.policyDefinitions } else { $null }
        if (-not $setMembers) { continue }
        foreach ($m in $setMembers) {
            $memberId = [string]($m.policyDefinitionId ?? "")
            if ($memberId -and -not $defs.ContainsKey($memberId.ToLower()) -and -not $tenantDefIds.Contains($memberId.ToLower())) {
                $tenantDefIds[$memberId.ToLower()] = $memberId
            }
        }
    }

    foreach ($origDefId in ($tenantDefIds.Values | Sort-Object)) {
        $fetchedDef = Invoke-ArmRestSingle `
            -Url "$ARM${origDefId}?api-version=$API_DEFINITIONS" `
            -Token $Token `
            -ExpectedId $origDefId `
            -DefaultSurface "policyDefinitions" `
            -UnresolvedScopes $unresolvedScopeEntries
        if ($null -ne $fetchedDef -and $fetchedDef.id) {
            $defs[$fetchedDef.id.ToLower()] = $fetchedDef
        }
    }

    $forbiddenIds = @{}
    foreach ($entry in $unresolvedScopeEntries) {
        if ($entry["reason"] -eq "ancestor_scope_forbidden" -and $entry["resource_id"]) {
            $forbiddenIds[([string]$entry["resource_id"]).ToLower()] = $true
        }
    }

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
    $unclassifiedCount = 0

    foreach ($a in $keptAssignments) {
        $props = $a.properties
        $display = $(if ($props) { $props.displayName } else { $null }) ?? $a.name ?? $a.id ?? "<unknown>"
        $scope = $(if ($props) { $props.scope } else { $null }) ?? ""
        $policyDefOriginal = if ($props) { [string]($props.policyDefinitionId ?? "") } else { "" }
        $policyDefId = $policyDefOriginal.ToLower()
        $assignmentId = ($a.id ?? "").ToLower()
        $assignmentType = if ($scope.ToLower() -match '/providers/microsoft.management/managementgroups/') { "management-group" } else { "subscription" }

        $assignmentInventory += @{
            displayName = $display
            scope = $scope
            assignmentType = $assignmentType
            policyDefinitionId = $policyDefId
        }

        if (-not $policyDefId) {
            $unclassifiedCount++
            if (-not $forbiddenIds.ContainsKey($assignmentId)) {
                $meta = Get-ScopeMetadataForId -ResourceId ([string]($a.id ?? "")) -SubscriptionId $SubId -FallbackScope $scope
                $meta["reason"] = "missing_policy_definition_id"
                [void]$unresolvedScopeEntries.Add($meta)
            }
            continue
        }

        # Resolve members and effective parameters
        $members = @()
        if ($policyDefId -match '/policysetdefinitions/' -and $sets.ContainsKey($policyDefId)) {
            $setObj = $sets[$policyDefId]
            $setParams = Get-EffectiveParameters -Defn $setObj -Supplied $props.parameters
            $setMembers = $setObj.properties.policyDefinitions
            if (-not $setMembers -or @($setMembers).Count -eq 0) {
                $unclassifiedCount++
                $meta = Get-ScopeMetadataForId -ResourceId ($setObj.id ?? $policyDefOriginal) -SubscriptionId $SubId -FallbackScope $scope
                $meta["reason"] = "empty_initiative_members"
                [void]$unresolvedScopeEntries.Add($meta)
            }
            if ($setMembers) {
                foreach ($m in $setMembers) {
                    $midOriginal = [string]($m.policyDefinitionId ?? "")
                    $mid = $midOriginal.ToLower()
                    if ($defs.ContainsKey($mid)) {
                        $memberDef = $defs[$mid]
                        $memberParams = Get-EffectiveParameters -Defn $memberDef -Supplied $null
                        if ($m.parameters) {
                            foreach ($mp in $m.parameters.PSObject.Properties) {
                                if ($null -ne $mp.Value -and $mp.Value.PSObject.Properties['value']) {
                                    $resolvedVal = Resolve-ParameterValue -Value $mp.Value.value -Parameters $setParams
                                    $memberParams[$mp.Name.ToLower()] = $resolvedVal
                                }
                            }
                        }
                        $members += @{ defn = $memberDef; memberRefId = $m.policyDefinitionReferenceId; effectiveParams = $memberParams }
                    }
                    else {
                        $unclassifiedCount++
                        $targetUid = if ($midOriginal) { $midOriginal } else { $policyDefOriginal }
                        if (-not $forbiddenIds.ContainsKey($targetUid.ToLower())) {
                            $meta = Get-ScopeMetadataForId -ResourceId $targetUid -SubscriptionId $SubId -FallbackScope $scope
                            $meta["reason"] = "definition_not_found"
                            [void]$unresolvedScopeEntries.Add($meta)
                        }
                    }
                }
            }
        }
        elseif ($defs.ContainsKey($policyDefId)) {
            $defObj = $defs[$policyDefId]
            $defParams = Get-EffectiveParameters -Defn $defObj -Supplied $props.parameters
            $members += @{ defn = $defObj; memberRefId = $null; effectiveParams = $defParams }
        }
        else {
            $unclassifiedCount++
            if (-not $forbiddenIds.ContainsKey($policyDefId)) {
                $meta = Get-ScopeMetadataForId -ResourceId $policyDefOriginal -SubscriptionId $SubId -FallbackScope $scope
                $meta["reason"] = "definition_not_found"
                [void]$unresolvedScopeEntries.Add($meta)
            }
        }

        foreach ($member in $members) {
            $defn = $member.defn
            $memberRefId = $member.memberRefId
            $eff = Get-EffectOf -Defn $defn -EffectiveParameters $member.effectiveParams
            if (-not $eff) {
                $unclassifiedCount++
                $meta = Get-ScopeMetadataForId -ResourceId ([string]($defn.id ?? $policyDefOriginal)) -SubscriptionId $SubId -FallbackScope $scope
                $meta["reason"] = "unresolved_effect"
                [void]$unresolvedScopeEntries.Add($meta)
                continue
            }
            if ($eff -eq "Disabled") { $disabledCount++; continue }
            if ($eff -in @("Audit", "AuditIfNotExists", "Append")) { $auditCount++; continue }
            if ($eff -notin $RELEVANT_EFFECTS) {
                if ($eff -ne "enforceSetting") {
                    $unclassifiedCount++
                    $meta = Get-ScopeMetadataForId -ResourceId ([string]($defn.id ?? $policyDefOriginal)) -SubscriptionId $SubId -FallbackScope $scope
                    $meta["reason"] = "unresolved_effect"
                    [void]$unresolvedScopeEntries.Add($meta)
                }
                continue
            }

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

            $identityOnly = if ($BLOCKER_EFFECTS -contains $eff) {
                Test-IsCallerIdentityOnly -Defn $defn -EffectiveParameters $member.effectiveParams
            }
            else { $false }
            $classification = Get-Classification -Effect $eff -IdentityOnly $identityOnly
            if ($exemption -and $classification -in @("blocker", "caller-identity")) { $classification = "informational" }
            if ($props -and $props.enforcementMode -eq "DoNotEnforce") { $classification = "informational" }

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
            if ($identityOnly) {
                $finding.identity_only = $true
            }

            # Assignment parameters
            $assignmentParams = if ($props) { $props.parameters } else { $null }
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

    $blockerCount = @($findings | Where-Object { $_.classification -eq "blocker" }).Count
    $callerIdentityCount = @($findings | Where-Object { $_.classification -eq "caller-identity" }).Count
    $autoRemediateCount = @($findings | Where-Object { $_.classification -eq "auto-remediate" }).Count
    $exemptedCount = @($findings | Where-Object { $null -ne $_.exemption }).Count
    $infoCount = @($findings | Where-Object { $_.classification -eq "informational" }).Count
    $subScopeCount = @($keptAssignments | Where-Object { $_.properties -and $_.properties.scope -and $_.properties.scope.ToLower() -notmatch '/providers/microsoft.management/' }).Count
    $mgInheritedCount = @($keptAssignments | Where-Object { $_.properties -and $_.properties.scope -and $_.properties.scope.ToLower() -match '/providers/microsoft.management/' }).Count

    $tagsRequired = Get-TagsRequired $findings
    $allowedLocations = Get-AllowedLocations $findings
    $unresolvedScopes = @(Get-NormalizedUnresolvedScopes -Entries $unresolvedScopeEntries)

    # L0 attestation envelope (plan-optimiseGovernanceAgent.prompt.md Phase 3b).
    # We emit every field except `completeness_signature` here; the cached
    # renderer recomputes the signature via the canonical Python helper so
    # the cached path stays byte-identical to the live path for the same
    # upstream findings (F2 decision — single signature algorithm).
    $discoveredAtIso = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ" -AsUTC)
    $managementGroups = @(
        $keptAssignments
        | Where-Object { $_.properties -and $_.properties.scope -and ($_.properties.scope.ToLower() -match '/providers/microsoft.management/managementgroups/') }
        | ForEach-Object {
            $marker = '/providers/microsoft.management/managementgroups/'
            $scope = $_.properties.scope.ToLower()
            ($scope -split [regex]::Escape($marker), 2)[1] -split '/', 2 | Select-Object -First 1
        }
        | Where-Object { $_ }
        | Select-Object -Unique
    )
    $subDiscoveryStatus = if ($unclassifiedCount -gt 0 -or $unresolvedScopes.Count -gt 0) { "PARTIAL" } else { "COMPLETE" }
    $discoveryMetadata = [ordered]@{
        discovery_status = $subDiscoveryStatus
        discovered_at = $discoveredAtIso
        scope = [ordered]@{
            subscription_id = $SubId
            management_groups = @($managementGroups)
        }
        api_versions = [ordered]@{
            policyAssignments = $API_ASSIGNMENTS
            policyDefinitions = $API_DEFINITIONS
            policyExemptions = $API_EXEMPTIONS
        }
        page_counts = [ordered]@{
            policyAssignments = $assignments.Count
            policyDefinitions = $defs.Count
            policyExemptions = $exemptions.Count
        }
        # Left blank intentionally — render_cached_governance.py recomputes
        # this via the canonical _completeness_signature helper.
        completeness_signature = ""
        ttl_days = 7
    }
    if ($unresolvedScopes.Count -gt 0) {
        $discoveryMetadata.unresolved_scopes = @($unresolvedScopes)
    }

    return [ordered]@{
        schema_version = "governance-constraints-v1"
        subscription_id = $SubId
        discovered_at = $discoveredAtIso
        source = "github-actions-baseline"
        discovery_status = $subDiscoveryStatus
        discovery_metadata = $discoveryMetadata
        unresolved_scopes = @($unresolvedScopes)
        discovery_summary = [ordered]@{
            assignment_total = $assignments.Count
            assignment_kept = $keptAssignments.Count
            defender_auto_filtered = $filteredDefender.Count
            subscription_scope_count = $subScopeCount
            management_group_inherited_count = $mgInheritedCount
            blocker_count = $blockerCount
            caller_identity_count = $callerIdentityCount
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
if ($MyInvocation.InvocationName -ne '.') {
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
$baselineFile = Join-Path $OutputDir "governance-policy-baseline.json.gz"
$existingBaseline = $null
if (Test-Path $baselineFile) {
    try {
        $existingBaseline = Read-GzipJson -Path $baselineFile
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
    if ($envelope.discovery_status -ne "COMPLETE") {
        $coverageStatus = "PARTIAL"
    }
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
$baselineJson = $baseline | ConvertTo-Json -Depth 50 -Compress
Write-GzipJson -Path $baselineFile -Json $baselineJson
Write-Host "Wrote baseline: $baselineFile"

# Write raw debug file (gitignored — not committed)
$rawFile = Join-Path $OutputDir "governance-policy-raw.json"
$baseline | ConvertTo-Json -Depth 100 | Set-Content -Path $rawFile -NoNewline
Write-Host "Wrote raw debug: $rawFile (gitignored)"

Write-Host "Done. Coverage: $coverageStatus | Processed: $totalProcessed | Excluded: $($subscriptionsExcluded.Count) | Skipped: $($subscriptionsSkipped.Count)"
}
