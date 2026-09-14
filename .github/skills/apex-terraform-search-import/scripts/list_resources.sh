#!/usr/bin/env bash
# Extract list resources supported by Terraform providers
# Usage: ./list_resources.sh [provider_name]
# Requires: terraform, jq
# Note: Run from an initialized Terraform directory (terraform init)
#
# Primary use case: azurerm provider — verify which resource types support
# Terraform Search (list_resource_schemas). If empty, use Manual Import.

set -euo pipefail

if [[ $# -gt 1 ]]; then
    echo "Usage: $0 [provider_name]" >&2
    exit 2
fi
PROVIDER="${1:-}"
if [[ "$PROVIDER" == "--help" || "$PROVIDER" == "-h" ]]; then
    echo "Usage: $0 [provider_name]"
    echo "Inspect schemas after caller-approved terraform init; never initializes or upgrades."
    exit 0
fi
command -v terraform >/dev/null
command -v jq >/dev/null

schema=$(terraform providers schema -json)
jq -e --arg provider "$PROVIDER" '
    if (.provider_schemas | type) != "object" then
        error("Missing or invalid provider_schemas")
    else .provider_schemas end
    | to_entries
    | map(select($provider == "" or (.key | split("/")[-1]) == $provider))
    | if $provider != "" and length == 0 then error("Provider not initialized") else . end
    | map({key: (.key | split("/")[-1]), value: (
        .value.list_resource_schemas
        | if . == null then {} else . end
        | if type != "object" then error("Invalid list_resource_schemas") else keys | sort end
    )})
    | from_entries
' <<< "$schema"
