<!-- ref:deploy-script-template-v1 -->

# Deploy Script Templates (Deprecated)

> **⚠️ Deprecated.** `azd provision` is the default deployment method for all projects.
> These deploy scripts are retained for backward compatibility only. New projects
> should use `azure.yaml` with azd hooks for phased deployment workflows.

Deployment scripts for Terraform projects. Generate BOTH `deploy.sh`
(Bash) AND `deploy.ps1` (PowerShell) for every project.

## Requirements

- Parameter validation (`RESOURCE_GROUP`, `LOCATION`, `ENVIRONMENT`,
  and optionally `DEPLOYMENT_PHASE` if phased plan)
- **Phase-aware execution** (if phased plan):
  - Accept phase name as parameter (default: `all`)
  - Pass `-var deployment_phase={phase}` to `terraform plan`/`apply`
  - For full deploy: loop through phases with approval prompts
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
    -backend-config="key={project}.terraform.tfstate"

# Plan
terraform plan `
    -var="environment=$Environment" `
    -var="deployment_phase=$Phase" `
    -out=tfplan

# Approval gate
$confirm = Read-Host "Apply this plan? (yes/no)"
if ($confirm -ne "yes") { exit 0 }

# Apply
terraform apply tfplan
terraform output
```

## Phase-Aware Looping (Full Deploy)

When `PHASE=all` and the project uses phased deployment, loop through
phases sequentially:

```bash
PHASES=("foundation" "security" "data" "compute" "edge")
for phase in "${PHASES[@]}"; do
    echo "=== Deploying phase: $phase ==="
    terraform plan -var="deployment_phase=$phase" -out="tfplan-${phase}"
    read -rp "Apply phase $phase? (yes/no): " CONFIRM
    [[ "$CONFIRM" == "yes" ]] && terraform apply "tfplan-${phase}"
done
```
