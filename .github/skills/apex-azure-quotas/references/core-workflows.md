<!-- ref:core-workflows-v1 -->

# Core Quota Workflows

Detailed step-by-step workflows for common quota management scenarios.

First apply [quota evidence and fallback](commands.md#quota-evidence-and-fallback).
All scopes and candidate regions below are illustrative and must be replaced with
approved values. Do not infer deployment or change approval from a quota check.

## Workflow 1: Check Quota for a Specific Resource

**Scenario:** Verify quota limit and current usage before deployment

```bash
# 1. Install quota extension (if not already installed)
az extension add --name quota

# 2. List all quotas for the provider to find the quota resource name
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/<region>

# 3. Show quota limit for a specific resource
az quota show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/<region>

# 4. Show current usage
az quota usage show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/<region>
```

**Example Output Analysis:**

- Quota limit: 350 vCPUs
- Current usage: 50 vCPUs
- Quota headroom: 300 vCPUs (350 - 50); regional capacity remains unknown

> **📖 See also:** [az quota show](./commands.md#az-quota-show), [az quota usage show](./commands.md#az-quota-usage-show)

## Workflow 2: Compare Quotas Across Regions

**Scenario:** Compare quota headroom in approved candidate regions. First define
`quota_headroom` from [Checked Headroom](commands.md#checked-headroom) in the same
shell. SKU restrictions and actual allocation capacity are separate checks.

```bash
# Approved candidate regions (APEX default and failover)
REGIONS=("swedencentral" "germanywestcentral")
VM_FAMILY="standardDSv3Family"
SUBSCRIPTION_ID="<subscription-id>"
NEED_VCPUS="<normalized-vcpu-demand>"

# Check quota availability across regions
for region in "${REGIONS[@]}"; do
  echo "=== Checking $region ==="

  # Get limit
  LIMIT=$(az quota show \
    --resource-name "$VM_FAMILY" \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.limit.value" -o tsv) || { echo "Unknown quota: limit query failed" >&2; continue; }

  # Get current usage
  USAGE=$(az quota usage show \
    --resource-name "$VM_FAMILY" \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.usages.value" -o tsv) || { echo "Unknown quota: usage query failed" >&2; continue; }

  quota_headroom \
    "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    "$LIMIT" "$USAGE" "$NEED_VCPUS" || continue
done
```

> **📖 See also:** [Checked Headroom](commands.md#checked-headroom).

## Workflow 3: Request Quota Increase

**Scenario:** Current quota is insufficient for deployment

Obtain explicit approval for the target scope and requested limit before submitting.

```bash
# Request increase for VM quota
az quota update \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/<region> \
  --limit-object value=500 \
  --resource-type dedicated

# Check request status
az quota request status list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/<region>
```

**Approval Process:**

- Most adjustable quotas are auto-approved within minutes
- Some requests require manual review (hours to days)
- Non-adjustable quotas require Azure Support ticket

> **📖 See also:** [az quota update](./commands.md#az-quota-update), [az quota request status](advanced-commands.md#az-quota-request-status-list)

## Workflow 4: List All Quotas for Planning

**Scenario:** Understand all quotas for a resource provider in a region

```bash
# List all compute quotas in the target region (table format)
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/<region> \
  --output table

# List all network quotas
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Network/locations/<region> \
  --output table

# List all Container Apps quotas
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.App/locations/<region> \
  --output table
```

> **📖 See also:** [az quota list](./commands.md#az-quota-list)
