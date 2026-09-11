<!-- ref:azure-context-v1 -->

# Azure Context (Subscription & Location)

Detect and confirm Azure subscription and location before generating artifacts. Run region capacity check for customer selected location

## Confirmation reuse

Reuse unchanged user-confirmed subscription and region without asking again.
For APEX, obtain confirmation evidence through `apex-recall show <project> --json`
and the approved current inputs; for generic workflows, use the approved plan's
Azure Context and available conversation confirmation. Record the confirmation
source and selected environment with the values in the plan, not just detected defaults.

Compare that evidence with the current project, selected environment, configured
subscription/tenant, and region. A default or environment variable alone is not
confirmation. Re-ask only for missing confirmation, changed project/environment
or subscription/tenant/region, conflicting inputs, explicit user changes, or
invalidated evidence (access, policy, service availability, or capacity).
After compaction or a new chat, recover persisted confirmation before asking;
if it cannot be established, ask rather than infer approval.

Reuse skips only repeated selection questions. Still perform required current
permission, policy, availability, capacity, and resource-group compatibility
checks; refresh affected checks when inputs change. It does not authorize
deployment, destructive operations, or bypass plan approval.

---

## Step 1: Check for Existing AZD Environment

If the project already uses AZD, check for an existing environment with values already set:

```bash
azd env list
```

**If an environment is selected** (marked with `*`), check its values:

```bash
azd env get-values
```

If `AZURE_SUBSCRIPTION_ID` and `AZURE_LOCATION` match reusable confirmation,
skip selection questions and continue to Step 5 plus required current checks.
If values exist but confirmation is missing or invalidated, use `ask_user`:

```
Question: "I found an existing AZD environment with these settings. Would you like to continue with them?"

  Environment: {env-name}
  Subscription: {subscription-name} ({subscription-id})
  Location: {location}

Choices: [
  "Yes, use these settings (Recommended)",
  "No, let me choose different settings"
]
```

If user confirms → continue to Step 5, then **Record in Plan**. Otherwise → continue to Step 2.

---

## Step 2: Detect Defaults

Check for user-configured defaults:

```bash
azd config get defaults
```

Returns JSON with any configured defaults:

```json
{
  "subscription": "25fd0362-aa79-488b-b37b-d6e892009fdf",
  "location": "eastus2"
}
```

Use these as **recommended** values if present.

If no defaults, fall back to az CLI:

```bash
az account show --query "{name:name, id:id}" -o json
```

## Step 3: Confirm Subscription with User

When confirmation cannot be reused, use `ask_user` with the **actual subscription name and ID**:

✅ **Correct:**

```
Question: "Which Azure subscription would you like to deploy to?"
Choices: [
  "Use current: jongdevdiv (25fd0362-aa79-488b-b37b-d6e892009fdf) (Recommended)",
  "Let me specify a different subscription"
]
```

❌ **Wrong** (never do this):

```
Choices: [
  "Use default subscription",  // ← Does not show actual name
  "Let me specify"
]
```

If user wants a different subscription:

```bash
az account list --output table
```

---

## Step 4: Confirm Location with User

1. Consult [Region Availability](region-availability.md) for services with limited availability
2. Present only regions that support ALL selected services
3. Use `ask_user` only when location confirmation cannot be reused:
4. After customer selected region, do provisioning limit check, consult [Resource Limits and Quotas](resources-limits-quotas.md). For this also invoke apex-azure-quotas

```
Question: "Which Azure region would you like to deploy to?"
Based on your architecture ({list services}), these regions support all services:
Choices: [
  "eastus2 (Recommended)",
  "westus2",
  "westeurope"
]
```

⚠️ Do NOT include regions that don't support all services — deployment will fail.

---

## Step 5: Check Resource Provisioning Limits

1. **List resource types and quantities** that will be deployed from the planned architecture (e.g., 2x Standard D4s v3 VMs, 1x VNet, 3x Storage Accounts)

2. **Determine limits for each resource type** using the user-selected subscription and region:
   - Reference [./resources-limits-quotas.md](./resources-limits-quotas.md) for documented limits
   - Use **apex-azure-quotas** skill to check current quotas and usage for the selected subscription and region
   - If `az quota list` returns `BadRequest` error, the resource provider doesn't support quota API

3. **For resources that don't support quota API** (e.g., Microsoft.DocumentDB, or when you get `BadRequest` from `az quota list`):
   - Invoke **apex-azure-resources** skill (Mode A: Lookup) to count existing deployments of that resource type in the selected subscription and region
   - Use the count to calculate: `Total After Deployment = Current Count + Planned Deployment`
   - Reference [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) for the limit value
   - Document in provisioning checklist as "Fetched from: apex-azure-resources (Mode A: Lookup) + Official docs"

4. **Validate deployment capacity**:
   - Compare planned deployment quantities against available quota (limit - current usage)
   - If **insufficient capacity** is found, notify the customer and return to **Step 4** to select a different region
   - Use **apex-azure-quotas** skill to compare capacity across multiple regions and recommend alternatives

## Record in Plan

After confirmation, record in `infra/{iac}/{project}/.azure/plan.md`:

```markdown
## Azure Context

- **Subscription**: jongdevdiv (25fd0362-aa79-488b-b37b-d6e892009fdf)
- **Location**: eastus2
```

---

## Step 6: Apply to AZD Environment

> **⛔ CRITICAL for Aspire and azd projects**: After user confirms subscription and location, you **MUST** set these values in the azd environment immediately after running `azd init` or `azd env new`.
>
> **DO NOT** wait until validation or deployment. The Azure CLI and azd maintain separate configuration contexts.

**For Aspire projects using `azd init --from-code`:**

```bash
# 1. Run azd init
azd init --from-code -e <environment-name>

# 2. IMMEDIATELY set the user-confirmed subscription
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>

# 3. Set the location
azd env set AZURE_LOCATION <location>

# 4. Verify
azd env get-values
```

**For non-Aspire projects using `azd env new`:**

```bash
# 1. Create environment
azd env new <environment-name>

# 2. IMMEDIATELY set the user-confirmed subscription
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>

# 3. Set the location
azd env set AZURE_LOCATION <location>

# 4. Verify
azd env get-values
```

**Why this is critical:**

- `az account show` returns the Azure CLI's default subscription
- `azd` maintains its own configuration with potentially different defaults
- If you don't set `AZURE_SUBSCRIPTION_ID` explicitly, azd will use its own default
- This can result in deploying to the wrong subscription despite user confirmation
