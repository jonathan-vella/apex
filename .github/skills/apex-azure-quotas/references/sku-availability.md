<!-- ref:sku-availability-v1 -->

# SKU Availability

Check whether a SKU is offered to the selected subscription in the target region
and zones. This is a third check, separate from quota headroom
([commands](commands.md#quota-evidence-and-fallback)) and from allocation capacity,
which stays unknown until deployment. An available SKU with enough quota can still
fail with `AllocationFailed` or `ZonalAllocationFailed`.

## Status Contract

| Status        | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `AVAILABLE`   | Listed for the region and required zones, with no applicable restriction |
| `RESTRICTED`  | Listed, but restricted for this subscription, region or required zones   |
| `NOT_OFFERED` | Not listed for the region                                                |
| `UNKNOWN`     | No SKU-level source, a failed command or unreadable output               |

- Never report `AVAILABLE` from missing, partial or unreadable evidence.
- `UNKNOWN` from a failed or unreadable check: fix the cause and re-run once;
  never proceed as if available. `UNKNOWN` because no SKU-level source exists:
  record the region-level evidence and report the SKU as unverified to the caller.
- Record per `(service, environment, region)`: SKU, required zones, command,
  collection time (UTC), status and reason.
- Check zones whenever the design requires zone redundancy.
- Suggest a substitute only when it is `AVAILABLE` and
  [quota headroom](commands.md#checked-headroom) is sufficient.

## Checks By Service

Run every command with the confirmed subscription and region.

| Service                               | Command                                                                                                 | Read                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| VM, VMSS, AKS node pools, disks       | `az vm list-skus --all --location <region> --size <sku> --output json`                                  | [Checked SKU Availability](#checked-sku-availability) helper                   |
| Storage accounts                      | `az storage sku list --output json`                                                                     | Same helper; filter by `kind` first when a SKU exists for several kinds        |
| App Service plans                     | `az appservice list-locations --sku <sku> [--linux-workers-enabled] --output json`                      | Region display name present (compare lowercase without spaces)                 |
| Azure SQL Database                    | `az sql db list-editions --location <region> --available --edition <tier> --service-objective <slo> -o json` | Non-empty result with the requested service objective                    |
| PostgreSQL / MySQL flexible server    | `az postgres flexible-server list-skus --location <region> -o json` (or `az mysql ...`)                 | SKU under the requested tier; zone-redundant HA support when required          |
| Container Apps workload profiles      | `az containerapp env workload-profile list-supported --location <region> -o json`                        | Profile `name` present; Consumption follows service availability              |
| AKS Kubernetes versions               | `az aks get-versions --location <region> -o json`                                                       | Requested version present; node sizes use the VM check                         |
| Other services (Redis, Cosmos DB, ...) | `az provider show --namespace <namespace> --query "resourceTypes[?resourceType=='<type>'].locations"` | Region-level only: SKU status stays `UNKNOWN` unless a service-specific source exists |

`--all` includes sizes the subscription can't use, so restrictions stay visible
instead of silently disappearing from the list.

## Checked SKU Availability

This Bash helper reads `az vm list-skus` or `az storage sku list` JSON saved to a
file. The optional fourth argument lists required zones, for example `1,2,3`.
Exit 0 means `AVAILABLE`, 1 `RESTRICTED` or `NOT_OFFERED`, 2 `UNKNOWN`. It always
reports allocation capacity as unknown.

```bash
sku_availability() {
  local file="$1" region="$2" sku="$3" zones="${4:-}"
  if [[ ! "$region" =~ ^[a-z0-9]+$ || ! "$sku" =~ ^[A-Za-z0-9_.-]+$ || ! "$zones" =~ ^([1-9](,[1-9])*)?$ ]]; then
    echo "UNKNOWN: invalid region, SKU or zone list" >&2
    return 2
  fi
  local result
  if ! result=$(jq -er --arg region "$region" --arg sku "$sku" --arg zones "$zones" '
    def here: any(.[]?; ascii_downcase == $region);
    if type != "array" then error("not a SKU list") else . end
    | map(select((.name | ascii_downcase) == ($sku | ascii_downcase) and (.locations | here)))
    | if length == 0 then "NOT_OFFERED: \($sku) is not listed in \($region)"
      else .[0] as $entry
      | ([$entry.restrictions[]? | select((.type == "Location") and ((.restrictionInfo.locations // .values) | here))] | first) as $blocked
      | if $blocked then "RESTRICTED: \($blocked.reasonCode // "unspecified reason")"
        else ([$entry.locationInfo[]? | select((.location | ascii_downcase) == $region) | .zones[]?]) as $offered
        | ([$entry.restrictions[]? | select((.type == "Zone") and ((.restrictionInfo.locations // .values) | here)) | .restrictionInfo.zones[]?]) as $restricted
        | ($zones | split(",") | map(select(length > 0))) as $required
        | ($required - ($offered - $restricted)) as $missing
        | if ($missing | length) > 0 then "RESTRICTED: zones \($missing | join(",")) unavailable"
          else "AVAILABLE" end
        end
      end' "$file" 2>/dev/null); then
    echo "UNKNOWN: unreadable SKU evidence" >&2
    return 2
  fi
  echo "$result; allocation capacity: unknown"
  [[ "$result" == AVAILABLE ]]
}
```

Example: save the listing, then check the SKU with three required zones.

```bash
az vm list-skus --all --location <region> --size Standard_D4s_v5 --output json > skus.json
sku_availability skus.json <region> Standard_D4s_v5 1,2,3
```

## At Deployment

`SkuNotAvailable`, `AllocationFailed`, `ZonalAllocationFailed` and
`OverconstrainedAllocationRequest` mean the pre-flight evidence was stale or
capacity was short. Record the error with the pre-flight record and follow the
caller's escalation path; don't retry with a different SKU or region without approval.
