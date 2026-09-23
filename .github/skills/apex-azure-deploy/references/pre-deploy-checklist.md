<!-- ref:pre-deploy-checklist-v1 -->

# Pre-Deployment Checklist

Generic application deployments only. APEX callers return to `07b-Bicep Deploy` or `07t-Terraform Deploy`
before initialization, regeneration, or execution; they use approved APEX handoff/readiness contracts.
Validation-only and preview-only requests do not authorize any provisioning or automatic preparation here.

> **CRITICAL**: Before running ANY provisioning commands, you MUST complete this checklist IN ORDER.
>
> ⛔ **DO NOT** run `azd up` until ALL steps are complete. Trial-and-error wastes time and creates orphan resources.

## Step 0: Resolve Recipe And Approval

Read the approved plan and select AZD, Terraform, Bicep or AZCLI before running any checklist command.
Missing plan, recipe, validation evidence or explicit deployment approval blocks execution.
Preparation-only, validation-only and preview-only requests stop at their respective boundaries.
This checklist never provisions or deploys. AZD-specific steps apply only to the AZD recipe;
pure Terraform/Bicep/AZCLI callers skip environment initialization and AZD variables entirely.
Missing infrastructure or manifest returns to preparation with separate authorization, not automatic regeneration.

## Step 1: Check Current Subscription

Use the Azure MCP tool to get current subscription:

```
mcp_azure-mcp_subscription_list
```

**CLI fallback:**

```bash
az account show --query "{name:name, id:id}" -o json
```

## Step 2: Verify Subscription Confirmation

Apply [confirmation reuse](../../apex-azure-prepare/references/azure-context.md#confirmation-reuse).
Reuse unchanged confirmed subscription/region for the same project and environment;
re-ask when confirmation is missing or invalidated. Keep all current checks and
deployment approval. When asking, show the actual subscription name and ID;
the detected default is a recommendation, not confirmation.

✅ **Correct — show actual name and ID as a choice:**

```
ask_user(
  question: "Which Azure subscription would you like to deploy to?",
  choices: [
    "Use current: <subscription-name> (<subscription-id>) (Recommended)",
    "Let me specify a different subscription"
  ]
)
```

❌ **Wrong — never use freeform input for subscription:**

```
ask_user(
  question: "Which Azure subscription should I deploy to? I'll need the subscription name or ID."
)
```

## Step 3: Ensure AZD Environment Exists FIRST (AZD Only)

Reuse the selected environment when it matches the confirmed project context.
Run initialization below only when an environment is missing or the user requested a new one.

> ⚠️ **MANDATORY** — An environment must exist BEFORE setting variables or running `azd up`.
>
> ⛔ **DO NOT** manually create `.azure/` folder with `mkdir` or `New-Item`. Let `azd` create it.
> The `.azure/` folder is created per-project inside `infra/{iac}/{project}/` when you run `azd env new`.

**For new projects (no azure.yaml):** Stop and return to preparation; do not initialize from deployment preflight.

**For existing projects (azure.yaml exists):**

```bash
azd env new <environment-name>
```

Both commands create:

- `.azure/<env-name>/` folder with config files (inside the project directory, e.g., `infra/{iac}/{project}/.azure/{project}-{env}/`)
- Set the environment as default

The environment name becomes part of the resource group name (`rg-<env-name>`).

## Step 4: Check if Resource Group Already Exists

> ⛔ **CRITICAL** — Skip this and you'll hit "Invalid resource group location" errors.

Use the Azure MCP tool to list resource groups:

```
mcp_azure-mcp_group_list
  subscription: <subscription-id>
```

Resolve the exact resource group from the approved recipe and plan; never infer it from an AZD environment
for a pure Terraform, Bicep or AZCLI deployment. Check that exact group in the selected subscription.

**CLI fallback:**

```bash
az group show --subscription <approved-subscription-id> --name <approved-resource-group> --query "{location:location}" -o json
```

**If RG exists:**

- If its location matches confirmed compatible context, continue without asking.
- If it conflicts, use `ask_user` to offer choices:
  1. Use existing RG location (show the location)
  2. Choose a different environment name
  3. Delete the existing RG and start fresh

**If RG doesn't exist:** Proceed to location confirmation/reuse only after a confirmed not-found response.
Authorization, connectivity and malformed-request failures block readiness; they do not mean the group is absent.

## Step 5: Check for Tag Conflicts (AZD only)

> ⚠️ AZD uses `azd-service-name` tags to find deployment targets **within the target resource group**. Multiple resources with the same tag in the same RG cause failures. Tags in other RGs are fine.

```bash
az resource list --resource-group rg-<env-name> --tag azd-service-name=<service-name> --query "[].name" -o table
```

Check for each service in `azure.yaml`. If duplicates exist **in the target RG**:

1. **Fresh environment**: Obtain approval for the changed target and cost scope before creating another environment; restart validation.
2. **Alternative — Delete conflicts**: Use `ask_user` to confirm deletion of old resources (required by global rules).

## Step 6: Verify Location Confirmation

Reuse unchanged confirmed location under the same confirmation-reuse rules.
If missing or invalidated, use `ask_user` with regions that support ALL services
in the architecture. Service and capacity changes still require affected checks.

See [Region Availability](region-availability.md) for service-specific limitations.

## Step 7: Verify Environment Variables (AZD Only)

> ⚠️ **Set ALL variables BEFORE running `azd up`** — not during error recovery.

Environment should already be configured during **apex-azure-validate**. Inspect only non-secret context keys.

Verify settings:

```bash
azd env get-value AZURE_SUBSCRIPTION_ID
azd env get-value AZURE_LOCATION
```

## Step 8: Complete Service Checks Before Handoff

Complete the service-specific checks below and verify that approval still covers these exact artifacts and target.
Return readiness evidence to the selected [deployment recipe](recipes/README.md); execute nothing in this checklist.

---

## Quick Reference: Correct Sequence

Approved recipe and target -> recipe-specific environment checks -> service checks -> current validation evidence
-> explicit deployment approval -> selected recipe handoff. No preflight command applies infrastructure.

## Common Mistakes to Avoid

| ❌ Wrong                              | ✅ Correct                                                       |
| ------------------------------------- | ---------------------------------------------------------------- |
| `azd up --location eastus2`           | `azd env set AZURE_LOCATION eastus2` then `azd up`               |
| Running `azd up` without environment  | `azd env new <name>` first                                       |
| Assuming location without checking RG | Check `az group show` before choosing                            |
| Ignoring tag conflicts in target RG   | Check `az resource list --resource-group rg-<env>` before deploy |

---

## Service-Specific Checks

### Container Apps — Existing Environments

If the plan includes Container Apps and the target resource group already
exists, list its environments before deploying (read-only):

```bash
az containerapp env list --resource-group rg-<env-name> \
  --query "[].{name:name, location:location, provisioningState:properties.provisioningState}" -o table
```

Without this check, azd can create an extra environment with an unexpected name.
If a usable environment (`Succeeded`) exists, use `ask_user` to choose between
reusing it and creating a new one; `Failed` or `Deleting` environments are not
reusable. The choice changes the target, so the approval must cover it.

### Container Apps With ACR — AcrPull Before App Deploy

When a Container App pulls from Azure Container Registry with a managed identity,
confirm the IaC declares `AcrPull` on the registry with
`principalType: 'ServicePrincipal'`, then deploy in two phases:

1. `azd provision --no-prompt` (the app starts from a placeholder image).
2. Confirm `AcrPull` has propagated with the read-only check in
   [Container App Revision Timeout](recipes/azd/errors.md#container-app-revision-timeout).
3. `azd deploy --no-prompt`.

APEX deploy agents apply the same order inside their already-approved phases; the
check adds no approval gate.

### Durable Functions — Verify DTS Backend

> **⛔ MANDATORY**: If the plan includes Durable Functions, verify infrastructure uses **Durable Task Scheduler** (DTS), NOT Azure Storage.

Check the selected IaC track's actual DTS resources or verified module outputs, not only Bicep text:

- `Microsoft.DurableTask/schedulers` resource
- `Microsoft.DurableTask/schedulers/taskHubs` child resource
- `Durable Task Data Contributor` RBAC role assignment
- `DURABLE_TASK_SCHEDULER_CONNECTION_STRING` app setting

For Terraform, validate the approved provider/module's scheduler and task-hub interface, identity role and emitted
connection setting. A missing supported interface is a blocker; never create Bicep files to satisfy this checklist.

If any are missing, **STOP** and report the preparation gap. Regeneration requires separate preparation authorization.

---

## Non-AZD Deployments

**For Azure CLI / Bicep:**

```bash
az account set --subscription <subscription-id-or-name>
# Pass location as parameter: --location <location>
```

**For Terraform:**

```bash
az account set --subscription <subscription-id-or-name>
# Set in terraform.tfvars or -var="location=<location>"
```
