<!-- ref:core-workflows-v1 -->

# Core Quota Workflows

Detailed step-by-step workflows for common quota management scenarios.

## Workflow 1: Check Quota for a Specific Resource

**Scenario:** Verify quota limit and current usage before deployment

```bash
# 1. Install quota extension (if not already installed)
az extension add --name quota

# 2. List all quotas for the provider to find the quota resource name
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus

# 3. Show quota limit for a specific resource
az quota show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus

# 4. Show current usage
az quota usage show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus
```

**Example Output Analysis:**

- Quota limit: 350 vCPUs
- Current usage: 50 vCPUs
- Available capacity: 300 vCPUs (350 - 50)

> **📖 See also:** [az quota show](./commands.md#az-quota-show), [az quota usage show](./commands.md#az-quota-usage-show)

## Workflow 2: Compare Quotas Across Regions

**Scenario:** Find the best region for deployment based on available capacity

```bash
# Define candidate regions
REGIONS=("eastus" "eastus2" "westus2" "centralus")
VM_FAMILY="standardDSv3Family"
SUBSCRIPTION_ID="<subscription-id>"

# Check quota availability across regions
for region in "${REGIONS[@]}"; do
  echo "=== Checking $region ==="

  # Get limit
  LIMIT=$(az quota show \
    --resource-name $VM_FAMILY \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.limit.value" -o tsv)

  # Get current usage
  USAGE=$(az quota usage show \
    --resource-name $VM_FAMILY \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.usages.value" -o tsv)

  # Calculate available
  AVAILABLE=$((LIMIT - USAGE))

  echo "Region: $region | Limit: $LIMIT | Usage: $USAGE | Available: $AVAILABLE"
done
```

> **📖 See also:** [Multi-region comparison scripts](./commands.md#multi-region-comparison) (Bash & PowerShell)

## Workflow 3: Request Quota Increase

**Scenario:** Current quota is insufficient for deployment

```bash
# Request increase for VM quota
az quota update \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus \
  --limit-object value=500 \
  --resource-type dedicated

# Check request status
az quota request status list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus
```

**Approval Process:**

- Most adjustable quotas are auto-approved within minutes
- Some requests require manual review (hours to days)
- Non-adjustable quotas require Azure Support ticket

> **📖 See also:** [az quota update](./commands.md#az-quota-update), [az quota request status](./commands.md#az-quota-request-status-list)

## Workflow 4: List All Quotas for Planning

**Scenario:** Understand all quotas for a resource provider in a region

```bash
# List all compute quotas in East US (table format)
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus \
  --output table

# List all network quotas
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Network/locations/eastus \
  --output table

# List all Container Apps quotas
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.App/locations/eastus \
  --output table
```

> **📖 See also:** [az quota list](./commands.md#az-quota-list)
