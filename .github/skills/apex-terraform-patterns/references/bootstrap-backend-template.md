<!-- ref:bootstrap-backend-template-v1 -->

# Bootstrap Backend Script Templates

Templates for explicitly authorized backend provisioning, never validation-only
or preview execution. Existing backends can be used without running bootstrap.

## Requirements

- Confirm ownership and approval of the exact subscription, RG, account, container
  and any updates to existing resources before setting `APEX_BOOTSTRAP_AUTHORIZED=true`.
  This flag records caller authorization; it does not grant Azure permissions.
- Supply approved names, location, replication SKU and network mode. Use `Disabled`
  for production data services. An approved private endpoint/DNS path must already
  make the account reachable by the runner; this template does not create networking.
- Supply a JSON object of effective policy tags, preserving casing and values, from
  `04-governance-constraints.json`. If no tag policy applies, use the canonical
  [greenfield contract](../../apex-azure-defaults/references/tag-strategy.md).
  Do not pass the entire governance artifact as the tag map.
- Require management-plane permission to create/update the RG and storage account,
  and Storage Blob Data Contributor at the account scope for container/state access.
  Provision these separately with approval; never assign roles or fall back to keys
  on a denial. RBAC/network/policy failures stop, including propagation delays.
- Idempotent create calls enforce approved settings on rerun. Do not interpret a
  failed lookup as absence, suppress stderr, or report success after a native failure.

## Bash Template (`bootstrap-backend.sh`)

```bash
#!/usr/bin/env bash
# Bootstrap Azure Storage Account for Terraform remote state
set -euo pipefail

[[ "${APEX_BOOTSTRAP_AUTHORIZED:-}" == "true" ]] || { echo "Bootstrap authorization required" >&2; exit 2; }
[[ $# -eq 8 ]] || { echo "Usage: $0 RG ACCOUNT CONTAINER LOCATION SUBSCRIPTION TAGS_JSON SKU NETWORK_MODE" >&2; exit 2; }
RESOURCE_GROUP="${1:?}"
STORAGE_ACCOUNT="${2:?}"
CONTAINER="${3:?}"
LOCATION="${4:?}"
SUBSCRIPTION="${5:?}"
TAGS_FILE="${6:?}"
SKU="${7:?}"
NETWORK_MODE="${8:?}"
[[ "$NETWORK_MODE" == "Disabled" || "$NETWORK_MODE" == "Enabled" ]] || exit 2
command -v az >/dev/null
command -v jq >/dev/null
tags_json=$(jq -ce 'if type == "object" and length > 0 and all(to_entries[];
  (.key | length > 0) and (.key | test("[=\\r\\n]") | not) and
  (.value | type == "string") and (.value | test("[\\r\\n]") | not))
  then . else error("Expected nonempty policy tag map") end' "$TAGS_FILE")
tag_lines=$(jq -r 'to_entries[] | "\(.key)=\(.value)"' <<< "$tags_json")
mapfile -t TAGS <<< "$tag_lines"

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" \
  --subscription "$SUBSCRIPTION" --tags "${TAGS[@]}" --output none

az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --subscription "$SUBSCRIPTION" \
    --tags "${TAGS[@]}" \
    --sku "$SKU" \
    --kind StorageV2 \
    --min-tls-version TLS1_2 \
    --allow-blob-public-access false \
    --allow-shared-key-access false \
    --default-to-oauth-authentication true \
    --public-network-access "$NETWORK_MODE" \
    --https-only true \
    --output none

  az storage container create \
    --name "$CONTAINER" \
    --account-name "$STORAGE_ACCOUNT" \
    --subscription "$SUBSCRIPTION" \
    --auth-mode login \
    --output none

echo "=== Backend bootstrap complete ==="
```

## PowerShell Template (`bootstrap-backend.ps1`)

```powershell
<#
.SYNOPSIS
    Bootstrap Azure Storage Account for Terraform remote state.
.DESCRIPTION
    Idempotent script — safe to re-run. Creates resource group, storage
    account, and blob container for Terraform state backend.
#>
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [Parameter(Mandatory)][string]$StorageAccount,
    [Parameter(Mandatory)][string]$Container,
    [Parameter(Mandatory)][string]$Location,
    [Parameter(Mandatory)][string]$Subscription,
    [Parameter(Mandatory)][string]$TagsFile,
    [Parameter(Mandatory)][string]$Sku,
    [ValidateSet("Disabled", "Enabled")][string]$NetworkMode = "Disabled"
)

$ErrorActionPreference = "Stop"

if ($env:APEX_BOOTSTRAP_AUTHORIZED -ne "true") { throw "Bootstrap authorization required" }
$tagMap = Get-Content -Raw -LiteralPath $TagsFile | ConvertFrom-Json -AsHashtable
if ($tagMap -isnot [System.Collections.IDictionary] -or $tagMap.Count -eq 0) { throw "Expected nonempty policy tag map" }
$policyTags = @($tagMap.GetEnumerator() | ForEach-Object {
  if (-not $_.Key -or $_.Key -match "[=\r\n]" -or $_.Value -isnot [string] -or $_.Value -match "[\r\n]") {
    throw "Invalid policy tag"
  }
  "$($_.Key)=$($_.Value)"
})

az group create --name $ResourceGroup --location $Location `
  --subscription $Subscription --tags @policyTags --output none
if ($LASTEXITCODE -ne 0) { throw "Resource group provisioning failed" }

az storage account create `
        --name $StorageAccount `
        --resource-group $ResourceGroup `
        --location $Location `
        --subscription $Subscription `
        --tags @policyTags `
        --sku $Sku `
        --kind StorageV2 `
        --min-tls-version TLS1_2 `
        --allow-blob-public-access false `
        --allow-shared-key-access false `
        --default-to-oauth-authentication true `
        --public-network-access $NetworkMode `
        --https-only true `
        --output none
      if ($LASTEXITCODE -ne 0) { throw "Storage account provisioning failed" }

      az storage container create `
        --name $Container `
        --account-name $StorageAccount `
        --subscription $Subscription `
        --auth-mode login `
        --output none
      if ($LASTEXITCODE -ne 0) { throw "Container provisioning failed" }

Write-Host "=== Backend bootstrap complete ===" -ForegroundColor Green
```

## Backend Authentication

Set `use_azuread_auth = true` in the `azurerm` backend configuration (or
`ARM_USE_AZUREAD=true`). Use the approved CLI, managed identity or OIDC identity;
never configure `access_key`, SAS tokens or connection strings as a fallback.
Bootstrap approval is not approval to initialize/migrate state or deploy workloads.
