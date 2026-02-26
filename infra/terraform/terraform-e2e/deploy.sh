#!/usr/bin/env bash
# Deploy terraform-e2e infrastructure to Azure
set -euo pipefail

echo "╔════════════════════════════════════════════════╗"
echo "║   terraform-e2e — Terraform Deploy             ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Defaults
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-tfstate-dev}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-sttfstatedev}"
CONTAINER="${CONTAINER:-tfstate}"
LOCATION="${LOCATION:-swedencentral}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
DEPLOYMENT_PHASE="${DEPLOYMENT_PHASE:-3}"

echo "Backend RG:       $RESOURCE_GROUP"
echo "Storage Account:  $STORAGE_ACCOUNT"
echo "Container:        $CONTAINER"
echo "Location:         $LOCATION"
echo "Environment:      $ENVIRONMENT"
echo "Deployment Phase: $DEPLOYMENT_PHASE"
echo ""

# Verify Azure CLI authentication
if ! az account get-access-token --output none 2>/dev/null; then
  echo "ERROR: Azure CLI not authenticated. Run 'az login' first."
  exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Subscription:     $SUBSCRIPTION_ID"
echo ""

# Initialize Terraform with backend config
echo "═══ terraform init ═══"
terraform init \
  -backend-config="resource_group_name=$RESOURCE_GROUP" \
  -backend-config="storage_account_name=$STORAGE_ACCOUNT" \
  -backend-config="container_name=$CONTAINER"

# Validate configuration
echo ""
echo "═══ terraform validate ═══"
terraform validate

# Plan
echo ""
echo "═══ terraform plan ═══"
terraform plan \
  -var="subscription_id=$SUBSCRIPTION_ID" \
  -var="environment=$ENVIRONMENT" \
  -var="location=$LOCATION" \
  -var="deployment_phase=$DEPLOYMENT_PHASE" \
  -out=tfplan

# Approval gate
echo ""
echo "─────────────────────────────────────────────────"
echo "Review the plan above. Continue with apply?"
echo "─────────────────────────────────────────────────"
read -r -p "Type 'yes' to apply: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# Apply
echo ""
echo "═══ terraform apply ═══"
terraform apply tfplan

# Output
echo ""
echo "═══ terraform output ═══"
terraform output

echo ""
echo "✅ Deployment complete (phase $DEPLOYMENT_PHASE)."
