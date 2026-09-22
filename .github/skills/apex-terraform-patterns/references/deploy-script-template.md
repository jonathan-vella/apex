<!-- ref:deploy-script-template-v1 -->

# Deploy Script Templates (Deprecated)

> **⚠️ Deprecated.** `azd provision` is the default deployment method for all projects.
> These deploy scripts are retained for backward compatibility only. New projects
> should use `azure.yaml` with azd hooks for phased deployment workflows.

Retain `deploy.sh` and `deploy.ps1` only for existing approved script workflows.
Neither these scripts nor azd may bypass preview, policy or human approval gates.

## Requirements

- Parameter validation (`RESOURCE_GROUP`, `LOCATION`, `ENVIRONMENT`,
  and optionally `DEPLOYMENT_PHASE` if phased plan)
- **Phase-aware execution** (if phased plan):
  - Accept phase name as parameter (default: `all`)
  - Pass `-var deployment_phase={phase}` to `terraform plan`/`apply`
  - For full deploy: loop through phases with approval prompts
- Shared-state phases must use the cumulative conditions in
  [project-scaffold.md](project-scaffold.md#key-pattern-phased-deployment).
  Never restart at foundation against later-phase state; resume the approved next
  phase. Any unexpected delete or replacement blocks progression.
- `terraform init` with backend config values
- `terraform plan -out=tfplan -var-file=...`
- User approval prompt before `terraform apply`
- `terraform apply tfplan`
- Output of `terraform output` after successful apply
- Error handling with meaningful messages

## Bash Template (`deploy.sh`)

Banner format:

```text
╔════════════════════════════════════════╗
║   {Project Name} - Terraform Deploy    ║
╚════════════════════════════════════════╝
```

Key sections:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Parse args
ENVIRONMENT="${1:-dev}"
PHASE="${2:-all}"
RESOURCE_GROUP="${3:-rg-{project}-${ENVIRONMENT}}"
LOCATION="${4:-swedencentral}"

# Init
terraform init \
  -backend-config="resource_group_name=rg-tfstate-${ENVIRONMENT}" \
  -backend-config="storage_account_name=sttfstate${SUFFIX}" \
  -backend-config="container_name=tfstate" \
  -backend-config="use_azuread_auth=true" \
  -backend-config="key={project}.terraform.tfstate"

# Plan
terraform plan \
  -var="environment=${ENVIRONMENT}" \
  -var="deployment_phase=${PHASE}" \
  -out=tfplan

# Approval gate
read -rp "Apply this plan? (yes/no): " CONFIRM
[[ "$CONFIRM" == "yes" ]] || exit 0

# Apply
terraform apply tfplan

# Output
terraform output
```

## PowerShell Template (`deploy.ps1`)

Banner mirrors Bash format. Key sections:

```powershell
param(
    [string]$Environment = "dev",
    [string]$Phase = "all",
    [string]$ResourceGroup = "rg-{project}-$Environment",
    [string]$Location = "swedencentral"
)
$ErrorActionPreference = "Stop"

# Init
terraform init `
    -backend-config="resource_group_name=rg-tfstate-$Environment" `
    -backend-config="storage_account_name=sttfstate$Suffix" `
    -backend-config="container_name=tfstate" `
    -backend-config="use_azuread_auth=true" `
    -backend-config="key={project}.terraform.tfstate"
  if ($LASTEXITCODE -ne 0) { throw "Terraform init failed" }

# Plan
terraform plan `
    -var="environment=$Environment" `
    -var="deployment_phase=$Phase" `
    -out=tfplan
  if ($LASTEXITCODE -ne 0) { throw "Terraform plan failed" }

# Approval gate
$confirm = Read-Host "Apply this plan? (yes/no)"
if ($confirm -ne "yes") { exit 0 }

# Apply
terraform apply tfplan
if ($LASTEXITCODE -ne 0) { throw "Terraform apply failed" }
terraform output
if ($LASTEXITCODE -ne 0) { throw "Terraform output failed" }
```

## Phase-Aware Looping (Full Deploy)

For an approved fresh phased deployment only, loop sequentially. A rerun against
later-phase state must resume its approved next phase, not start over. A single
full deployment uses `all` directly. The guard rejects both replacement orders;
intentional destruction needs a separately reviewed plan and authorization, not
an override of this loop. Declining any phase stops the entire loop.

```bash
set -euo pipefail
PHASES=("foundation" "security" "data" "compute" "edge")
for phase in "${PHASES[@]}"; do
    echo "=== Deploying phase: $phase ==="
    terraform plan -var="deployment_phase=$phase" -out="tfplan-${phase}"
  if ! terraform show -json "tfplan-${phase}" | jq -e '
    (.resource_changes | type == "array") and
    all(.resource_changes[]; (.change.actions | type == "array") and
    (.change.actions | index("delete") | not))
  ' >/dev/null; then
    echo "Plan unavailable or destructive; stop and review the phase/state boundary" >&2
    exit 1
  fi
    read -rp "Apply phase $phase? (yes/no): " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || exit 0
  terraform apply "tfplan-${phase}"
done
```
