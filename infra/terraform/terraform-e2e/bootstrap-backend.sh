#!/usr/bin/env bash
# Bootstrap Azure Storage Account for Terraform remote state
set -euo pipefail

RESOURCE_GROUP="${1:-rg-tfstate-dev}"
STORAGE_ACCOUNT="${2:-sttfstatedev}"
CONTAINER="${3:-tfstate}"
LOCATION="${4:-swedencentral}"

echo "╔════════════════════════════════════════════════╗"
echo "║   terraform-e2e — Bootstrap State Backend      ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "Resource Group:  $RESOURCE_GROUP"
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Container:       $CONTAINER"
echo "Location:        $LOCATION"
echo ""

# Verify Azure CLI authentication
if ! az account get-access-token --output none 2>/dev/null; then
  echo "ERROR: Azure CLI not authenticated. Run 'az login' first."
  exit 1
fi

# Resource group (idempotent — 9 RG tags required by JV-Enforce RG Tags v3 Deny policy)
echo "→ Creating resource group '$RESOURCE_GROUP'..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags \
    environment=dev \
    owner=team-terraform \
    costcenter=terraform-e2e \
    application=terraform-e2e \
    workload=tfstate \
    sla=99.9 \
    backup-policy=default \
    maint-window=weekends \
    technical-contact=team-terraform \
  --output none

# Storage account (idempotent — governance: no public blob, HTTPS, TLS 1.2)
if az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  echo "→ Storage account '$STORAGE_ACCOUNT' already exists."
else
  echo "→ Creating storage account '$STORAGE_ACCOUNT'..."
  az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --min-tls-version TLS1_2 \
    --https-only true \
    --allow-blob-public-access false \
    --tags Environment=dev ManagedBy=Terraform Project=terraform-e2e Owner=team-terraform \
    --output none
fi

# Blob container (idempotent)
if az storage container show --name "$CONTAINER" --account-name "$STORAGE_ACCOUNT" --auth-mode login --output none 2>/dev/null; then
  echo "→ Container '$CONTAINER' already exists."
else
  echo "→ Creating blob container '$CONTAINER'..."
  az storage container create \
    --name "$CONTAINER" \
    --account-name "$STORAGE_ACCOUNT" \
    --auth-mode login \
    --output none
fi

echo ""
echo "✅ State backend ready."
echo "   Run: terraform init \\"
echo "     -backend-config=\"resource_group_name=$RESOURCE_GROUP\" \\"
echo "     -backend-config=\"storage_account_name=$STORAGE_ACCOUNT\" \\"
echo "     -backend-config=\"container_name=$CONTAINER\""
