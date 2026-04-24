#!/usr/bin/env bash
# shellcheck disable=SC2034,SC2155
# ─────────────────────────────────────────────────────────────────────────────
# APEX Environment Setup Wizard
#
# Fully automates Azure + GitHub environment configuration:
#   • Entra ID app registration + service principal
#   • OIDC federated credentials (main + dev/staging/prod)
#   • RBAC role assignments (Reader at MG, Contributor at subscription)
#   • GitHub secrets, variables, environments, Pages, auto-merge
#
# Usage:
#   npm run setup                          # Interactive (default)
#   npm run setup -- --non-interactive     # Headless (reads env vars)
#   npm run setup -- --reset              # Clear setup state and start fresh
#
# Idempotent — safe to re-run. Skips already-completed phases.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Configuration ───────────────────────────────────────────────────────────
INTERACTIVE=true
STATE_DIR=".azure/.setup-state"
OIDC_ISSUER="https://token.actions.githubusercontent.com"
OIDC_AUDIENCE="api://AzureADTokenExchange"
UUID_REGEX='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

# ─── Parse Arguments ────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --non-interactive) INTERACTIVE=false ;;
    --reset)
      echo -e "${YELLOW}Resetting setup state...${NC}"
      rm -rf "$STATE_DIR"
      echo -e "${GREEN}State cleared. Run again without --reset to start fresh.${NC}"
      exit 0
      ;;
    --help|-h)
      echo "APEX Environment Setup Wizard"
      echo ""
      echo "Usage: bash tools/scripts/setup-azure.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --non-interactive  Read all values from environment variables"
      echo "  --reset            Clear setup state and start fresh"
      echo "  -h, --help         Show this help"
      echo ""
      echo "Environment variables (for --non-interactive):"
      echo "  AZURE_TENANT_ID              Azure tenant ID"
      echo "  AZURE_SUBSCRIPTION_ID        Azure subscription ID"
      echo "  GOVERNANCE_MG_ID             Management Group ID"
      echo "  GOVERNANCE_MAX_SUBSCRIPTIONS  Max subscriptions (default: 100)"
      echo "  APP_DISPLAY_NAME             Entra app name (default: apex-github-oidc-{repo})"
      echo "  DEPLOY_ENVIRONMENTS          Comma-separated (default: dev,staging,prod)"
      exit 0
      ;;
  esac
done

# ─── Helpers ─────────────────────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
log_error()   { echo -e "${RED}❌${NC} $1"; }
log_phase()   { echo -e "\n${BOLD}${CYAN}━━━ Phase $1 ━━━${NC}\n"; }

prompt() {
  local var_name="$1" prompt_text="$2" default="${3:-}"
  if [[ "$INTERACTIVE" == true ]]; then
    local input
    read -rp "$(echo -e "${BOLD}$prompt_text${NC} [${default}]: ")" input
    printf -v "$var_name" '%s' "${input:-$default}"
  else
    local env_val="${!var_name:-$default}"
    if [[ -z "$env_val" ]]; then
      log_error "Required variable $var_name is not set (headless mode)"
      exit 1
    fi
    printf -v "$var_name" '%s' "$env_val"
  fi
}

confirm() {
  local prompt_text="$1"
  if [[ "$INTERACTIVE" == true ]]; then
    local input
    read -rp "$(echo -e "${BOLD}$prompt_text${NC} [Y/n]: ")" input
    [[ -z "$input" || "$input" =~ ^[Yy] ]]
  else
    return 0
  fi
}

phase_done() {
  local phase="$1" config_hash="$2"
  local marker="$STATE_DIR/${phase}.done"
  if [[ -f "$marker" ]]; then
    local stored_hash
    stored_hash=$(cat "$marker")
    if [[ "$stored_hash" == "$config_hash" ]]; then
      return 0
    fi
  fi
  return 1
}

mark_phase() {
  local phase="$1" config_hash="$2"
  mkdir -p "$STATE_DIR"
  echo "$config_hash" > "$STATE_DIR/${phase}.done"
}

# ─── Prerequisite Checks ────────────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║      APEX Environment Setup Wizard           ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}\n"

log_info "Checking prerequisites..."

# Check az CLI
if ! command -v az &>/dev/null; then
  log_error "Azure CLI (az) not found. Install: https://aka.ms/install-azure-cli"
  exit 1
fi
if ! az account show &>/dev/null 2>&1; then
  log_error "Not logged in to Azure CLI. Run: az login --use-device-code"
  exit 1
fi
log_success "Azure CLI authenticated"

# Check gh CLI
if ! command -v gh &>/dev/null; then
  log_error "GitHub CLI (gh) not found. Install: https://cli.github.com/"
  exit 1
fi
if ! gh auth status &>/dev/null 2>&1; then
  log_error "Not authenticated to GitHub CLI. Run: gh auth login"
  exit 1
fi
log_success "GitHub CLI authenticated"

# Check jq
if ! command -v jq &>/dev/null; then
  log_error "jq not found. Install: sudo apt-get install jq"
  exit 1
fi

# Check git repo with GitHub remote
if ! git remote get-url origin &>/dev/null 2>&1; then
  log_error "Not a git repo with an 'origin' remote. Clone your repo first."
  exit 1
fi
REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
if [[ -z "$REPO_SLUG" ]]; then
  log_error "Cannot detect GitHub repo. Ensure 'origin' points to a GitHub repository."
  exit 1
fi
REPO_OWNER="${REPO_SLUG%%/*}"
REPO_NAME="${REPO_SLUG##*/}"
log_success "GitHub repo: ${REPO_SLUG}"

# ─── Information Gathering ───────────────────────────────────────────────────
log_phase "0: Configuration"

# Auto-detect defaults with display names
DEFAULT_TENANT_ID=$(az account show --query tenantId -o tsv 2>/dev/null || echo "")
DEFAULT_TENANT_NAME=$(az account show --query tenantDisplayName -o tsv 2>/dev/null || echo "(unknown)")
DEFAULT_SUB_ID=$(az account show --query id -o tsv 2>/dev/null || echo "")
DEFAULT_SUB_NAME=$(az account show --query name -o tsv 2>/dev/null || echo "(unknown)")
DEFAULT_APP_NAME="apex-github-oidc-${REPO_NAME}"
DEFAULT_MAX_SUBS="100"
DEFAULT_DEPLOY_ENVS="dev,staging,prod"

if [[ "$INTERACTIVE" == true && -n "$DEFAULT_TENANT_ID" ]]; then
  log_info "Current Azure context:"
  echo "  Tenant:       ${DEFAULT_TENANT_NAME} (${DEFAULT_TENANT_ID})"
  echo "  Subscription: ${DEFAULT_SUB_NAME} (${DEFAULT_SUB_ID})"
  echo ""
fi

prompt AZURE_TENANT_ID "Azure Tenant ID" "$DEFAULT_TENANT_ID"
prompt AZURE_SUBSCRIPTION_ID "Azure Subscription ID" "$DEFAULT_SUB_ID"

# Validate UUID format
if [[ ! "$AZURE_TENANT_ID" =~ $UUID_REGEX ]]; then
  log_error "Invalid tenant ID format: $AZURE_TENANT_ID"
  exit 1
fi
if [[ ! "$AZURE_SUBSCRIPTION_ID" =~ $UUID_REGEX ]]; then
  log_error "Invalid subscription ID format: $AZURE_SUBSCRIPTION_ID"
  exit 1
fi

# Resolve display names for the confirmed IDs (may differ from defaults if user overrode)
if [[ "$AZURE_SUBSCRIPTION_ID" == "$DEFAULT_SUB_ID" ]]; then
  SUB_DISPLAY_NAME="$DEFAULT_SUB_NAME"
else
  SUB_DISPLAY_NAME=$(az account show --subscription "$AZURE_SUBSCRIPTION_ID" --query name -o tsv 2>/dev/null || echo "(unknown)")
fi
if [[ "$AZURE_TENANT_ID" == "$DEFAULT_TENANT_ID" ]]; then
  TENANT_DISPLAY_NAME="$DEFAULT_TENANT_NAME"
else
  TENANT_DISPLAY_NAME="(custom tenant)"
fi

# Management Group — list available if interactive
if [[ "$INTERACTIVE" == true ]]; then
  log_info "Available Management Groups:"
  az account management-group list --query '[].{Name:name, DisplayName:displayName}' -o table 2>/dev/null || log_warn "Cannot list MGs (may need permissions)"
  echo ""
fi
prompt GOVERNANCE_MG_ID "Management Group ID" "${GOVERNANCE_MG_ID:-}"

# Validate MG exists
if [[ -n "$GOVERNANCE_MG_ID" ]]; then
  if ! az account management-group show --name "$GOVERNANCE_MG_ID" &>/dev/null 2>&1; then
    log_error "Management Group '$GOVERNANCE_MG_ID' not found or not accessible"
    exit 1
  fi
  log_success "Management Group verified: $GOVERNANCE_MG_ID"
fi

prompt GOVERNANCE_MAX_SUBSCRIPTIONS "Max subscriptions to process" "$DEFAULT_MAX_SUBS"
prompt APP_DISPLAY_NAME "Entra app display name" "$DEFAULT_APP_NAME"
prompt DEPLOY_ENVIRONMENTS "Deploy environments (comma-separated)" "$DEFAULT_DEPLOY_ENVS"

# Parse environments into array
IFS=',' read -ra ENVS <<< "$DEPLOY_ENVIRONMENTS"

echo ""
log_info "Configuration summary:"
echo "  Tenant:          ${TENANT_DISPLAY_NAME} (${AZURE_TENANT_ID})"
echo "  Subscription:    ${SUB_DISPLAY_NAME} (${AZURE_SUBSCRIPTION_ID})"
echo "  Management Group: $GOVERNANCE_MG_ID"
echo "  App Name:        $APP_DISPLAY_NAME"
echo "  Repo:            $REPO_SLUG"
echo "  Environments:    ${ENVS[*]}"
echo ""

if ! confirm "Proceed with this configuration?"; then
  log_warn "Aborted by user."
  exit 0
fi

# Config hash for idempotency
CONFIG_HASH=$(echo "${AZURE_TENANT_ID}|${AZURE_SUBSCRIPTION_ID}|${GOVERNANCE_MG_ID}|${APP_DISPLAY_NAME}|${REPO_SLUG}|${DEPLOY_ENVIRONMENTS}" | sha256sum | cut -d' ' -f1)

# ─── Phase A: Entra ID App Registration ──────────────────────────────────────
log_phase "A: Entra ID App Registration"

PHASE_HASH_A=$(echo "A|${APP_DISPLAY_NAME}|${AZURE_TENANT_ID}" | sha256sum | cut -d' ' -f1)
if phase_done "A-entra-app" "$PHASE_HASH_A"; then
  APP_ID=$(az ad app list --display-name "$APP_DISPLAY_NAME" --query '[0].appId' -o tsv 2>/dev/null)
  log_success "Entra app already exists: $APP_ID (skipping)"
else
  # Check if app already exists
  APP_ID=$(az ad app list --display-name "$APP_DISPLAY_NAME" --query '[0].appId' -o tsv 2>/dev/null)

  if [[ -n "$APP_ID" ]]; then
    log_info "Reusing existing app registration: $APP_ID"
  else
    log_info "Creating app registration: $APP_DISPLAY_NAME"
    APP_ID=$(az ad app create --display-name "$APP_DISPLAY_NAME" --query appId -o tsv)
    log_success "App created: $APP_ID"
  fi

  # Ensure service principal exists
  if az ad sp show --id "$APP_ID" &>/dev/null 2>&1; then
    log_info "Service principal already exists"
  else
    log_info "Creating service principal..."
    az ad sp create --id "$APP_ID" -o none
    log_success "Service principal created"
  fi

  mark_phase "A-entra-app" "$PHASE_HASH_A"
fi

# Ensure we have the APP_ID for subsequent phases
if [[ -z "${APP_ID:-}" ]]; then
  APP_ID=$(az ad app list --display-name "$APP_DISPLAY_NAME" --query '[0].appId' -o tsv 2>/dev/null)
fi
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null)

# ─── Phase B: Federated Identity Credentials ────────────────────────────────
log_phase "B: Federated Identity Credentials (OIDC)"

PHASE_HASH_B=$(echo "B|${APP_ID}|${REPO_SLUG}|${DEPLOY_ENVIRONMENTS}" | sha256sum | cut -d' ' -f1)
if phase_done "B-federated-creds" "$PHASE_HASH_B"; then
  log_success "Federated credentials already configured (skipping)"
else
  # List existing credentials
  EXISTING_CREDS=$(az ad app federated-credential list --id "$APP_ID" --query '[].subject' -o tsv 2>/dev/null || echo "")

  # Main branch credential (governance workflow)
  MAIN_SUBJECT="repo:${REPO_SLUG}:ref:refs/heads/main"
  if echo "$EXISTING_CREDS" | grep -qF "$MAIN_SUBJECT"; then
    log_info "Credential for main branch already exists"
  else
    log_info "Creating credential: github-main (${MAIN_SUBJECT})"
    az ad app federated-credential create --id "$APP_ID" --parameters "{
      \"name\": \"github-main\",
      \"issuer\": \"${OIDC_ISSUER}\",
      \"subject\": \"${MAIN_SUBJECT}\",
      \"audiences\": [\"${OIDC_AUDIENCE}\"],
      \"description\": \"GitHub Actions OIDC for main branch (scheduled workflows)\"
    }" -o none
    log_success "Created: github-main"
  fi

  # Environment credentials
  for env in "${ENVS[@]}"; do
    env=$(echo "$env" | xargs)  # trim whitespace
    ENV_SUBJECT="repo:${REPO_SLUG}:environment:${env}"
    CRED_NAME="github-env-${env}"
    if echo "$EXISTING_CREDS" | grep -qF "$ENV_SUBJECT"; then
      log_info "Credential for environment '${env}' already exists"
    else
      log_info "Creating credential: ${CRED_NAME} (${ENV_SUBJECT})"
      az ad app federated-credential create --id "$APP_ID" --parameters "{
        \"name\": \"${CRED_NAME}\",
        \"issuer\": \"${OIDC_ISSUER}\",
        \"subject\": \"${ENV_SUBJECT}\",
        \"audiences\": [\"${OIDC_AUDIENCE}\"],
        \"description\": \"GitHub Actions OIDC for ${env} environment deployments\"
      }" -o none
      log_success "Created: ${CRED_NAME}"
    fi
  done

  mark_phase "B-federated-creds" "$PHASE_HASH_B"
fi

# ─── Phase C: RBAC Role Assignments ─────────────────────────────────────────
log_phase "C: RBAC Role Assignments"

PHASE_HASH_C=$(echo "C|${SP_OBJECT_ID}|${GOVERNANCE_MG_ID}|${AZURE_SUBSCRIPTION_ID}" | sha256sum | cut -d' ' -f1)
if phase_done "C-rbac" "$PHASE_HASH_C"; then
  log_success "RBAC assignments already configured (skipping)"
else
  echo ""
  log_info "The following role assignments will be created:"
  echo "  • Reader at Management Group: ${GOVERNANCE_MG_ID}"
  echo "  • Contributor at Subscription: ${AZURE_SUBSCRIPTION_ID}"
  echo ""

  if confirm "Assign these roles?"; then
    # Reader at MG scope
    MG_SCOPE="/providers/Microsoft.Management/managementGroups/${GOVERNANCE_MG_ID}"
    EXISTING_MG_ROLE=$(az role assignment list --assignee "$SP_OBJECT_ID" --scope "$MG_SCOPE" --role "Reader" --query 'length(@)' -o tsv 2>/dev/null || echo "0")
    if [[ "$EXISTING_MG_ROLE" -gt 0 ]]; then
      log_info "Reader at MG scope already assigned"
    else
      log_info "Assigning Reader at MG scope..."
      az role assignment create \
        --assignee-object-id "$SP_OBJECT_ID" \
        --assignee-principal-type ServicePrincipal \
        --role "Reader" \
        --scope "$MG_SCOPE" \
        -o none
      log_success "Reader assigned at MG: $GOVERNANCE_MG_ID"
    fi

    # Contributor at subscription scope
    SUB_SCOPE="/subscriptions/${AZURE_SUBSCRIPTION_ID}"
    EXISTING_SUB_ROLE=$(az role assignment list --assignee "$SP_OBJECT_ID" --scope "$SUB_SCOPE" --role "Contributor" --query 'length(@)' -o tsv 2>/dev/null || echo "0")
    if [[ "$EXISTING_SUB_ROLE" -gt 0 ]]; then
      log_info "Contributor at subscription scope already assigned"
    else
      log_info "Assigning Contributor at subscription scope..."
      az role assignment create \
        --assignee-object-id "$SP_OBJECT_ID" \
        --assignee-principal-type ServicePrincipal \
        --role "Contributor" \
        --scope "$SUB_SCOPE" \
        -o none
      log_success "Contributor assigned at subscription: $AZURE_SUBSCRIPTION_ID"
    fi

    mark_phase "C-rbac" "$PHASE_HASH_C"
  else
    log_warn "RBAC assignment skipped. You can assign roles manually later."
    log_info "Commands:"
    echo "  az role assignment create --assignee-object-id $SP_OBJECT_ID --assignee-principal-type ServicePrincipal --role Reader --scope /providers/Microsoft.Management/managementGroups/$GOVERNANCE_MG_ID"
    echo "  az role assignment create --assignee-object-id $SP_OBJECT_ID --assignee-principal-type ServicePrincipal --role Contributor --scope /subscriptions/$AZURE_SUBSCRIPTION_ID"
  fi
fi

# ─── Phase D: GitHub Repository Configuration ───────────────────────────────
log_phase "D: GitHub Repository Configuration"

PHASE_HASH_D=$(echo "D|${APP_ID}|${AZURE_TENANT_ID}|${AZURE_SUBSCRIPTION_ID}|${GOVERNANCE_MG_ID}|${DEPLOY_ENVIRONMENTS}" | sha256sum | cut -d' ' -f1)
if phase_done "D-github-config" "$PHASE_HASH_D"; then
  log_success "GitHub configuration already complete (skipping)"
else
  # Secrets
  log_info "Setting GitHub secrets..."
  gh secret set AZURE_CLIENT_ID --body "$APP_ID"
  gh secret set AZURE_TENANT_ID --body "$AZURE_TENANT_ID"
  gh secret set AZURE_SUBSCRIPTION_ID --body "$AZURE_SUBSCRIPTION_ID"
  log_success "Secrets set: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID"

  # Variables
  log_info "Setting GitHub variables..."
  gh variable set GOVERNANCE_BASELINE_ENABLED --body "true"
  gh variable set GOVERNANCE_MG_ID --body "$GOVERNANCE_MG_ID"
  gh variable set GOVERNANCE_MAX_SUBSCRIPTIONS --body "$GOVERNANCE_MAX_SUBSCRIPTIONS"
  log_success "Variables set: GOVERNANCE_BASELINE_ENABLED, GOVERNANCE_MG_ID, GOVERNANCE_MAX_SUBSCRIPTIONS"

  # Environments
  log_info "Creating GitHub environments..."
  for env in "${ENVS[@]}"; do
    env=$(echo "$env" | xargs)
    if gh api "repos/${REPO_SLUG}/environments/${env}" --method PUT --silent 2>/dev/null; then
      log_success "Environment created: ${env}"
    else
      log_warn "Could not create environment '${env}' (may need admin permissions)"
    fi
  done

  # GitHub Pages
  log_info "Enabling GitHub Pages (Actions source)..."
  if gh api "repos/${REPO_SLUG}/pages" --method POST \
    --input - --silent 2>/dev/null <<< '{"build_type":"workflow","source":{"branch":"main","path":"/"}}'; then
    log_success "GitHub Pages enabled"
  else
    log_info "GitHub Pages already enabled or requires manual setup"
  fi

  # Auto-merge
  log_info "Enabling auto-merge on repository..."
  if gh api "repos/${REPO_SLUG}" --method PATCH -f allow_auto_merge=true --silent 2>/dev/null; then
    log_success "Auto-merge enabled"
  else
    log_warn "Could not enable auto-merge (may need admin permissions)"
  fi

  mark_phase "D-github-config" "$PHASE_HASH_D"
fi

# ─── Phase E: Validation & Summary ──────────────────────────────────────────
log_phase "E: Validation & Summary"

ERRORS=0

# Verify secrets
SECRETS_LIST=$(gh secret list 2>/dev/null || echo "")
for secret in AZURE_CLIENT_ID AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID; do
  if echo "$SECRETS_LIST" | grep -q "$secret"; then
    log_success "Secret: $secret"
  else
    log_error "Missing secret: $secret"
    ERRORS=$((ERRORS + 1))
  fi
done

# Verify variables
VARS_LIST=$(gh variable list 2>/dev/null || echo "")
for var in GOVERNANCE_BASELINE_ENABLED GOVERNANCE_MG_ID GOVERNANCE_MAX_SUBSCRIPTIONS; do
  if echo "$VARS_LIST" | grep -q "$var"; then
    log_success "Variable: $var"
  else
    log_error "Missing variable: $var"
    ERRORS=$((ERRORS + 1))
  fi
done

# Verify federated credentials
CRED_COUNT=$(az ad app federated-credential list --id "$APP_ID" --query 'length(@)' -o tsv 2>/dev/null || echo "0")
EXPECTED_CREDS=$((1 + ${#ENVS[@]}))
if [[ "$CRED_COUNT" -ge "$EXPECTED_CREDS" ]]; then
  log_success "Federated credentials: ${CRED_COUNT} configured"
else
  log_warn "Federated credentials: ${CRED_COUNT} (expected ${EXPECTED_CREDS})"
fi

# Summary
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║            Setup Complete                    ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Resource Summary:${NC}"
echo "  ┌─────────────────────────────────────────────────────────────"
echo "  │ Entra App:      $APP_DISPLAY_NAME ($APP_ID)"
echo "  │ Tenant:         ${TENANT_DISPLAY_NAME} ($AZURE_TENANT_ID)"
echo "  │ Subscription:   ${SUB_DISPLAY_NAME} ($AZURE_SUBSCRIPTION_ID)"
echo "  │ MG Scope:       $GOVERNANCE_MG_ID"
echo "  │ OIDC Creds:     ${CRED_COUNT} federated credentials"
echo "  │ GitHub Secrets:  AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID"
echo "  │ GitHub Variables: GOVERNANCE_BASELINE_ENABLED, GOVERNANCE_MG_ID, GOVERNANCE_MAX_SUBSCRIPTIONS"
echo "  │ Environments:   ${ENVS[*]}"
echo "  └─────────────────────────────────────────────────────────────"
echo ""

if [[ "$ERRORS" -gt 0 ]]; then
  log_warn "${ERRORS} issue(s) detected. Review the output above."
  exit 1
fi

echo -e "${BOLD}Next steps:${NC}"
echo "  1. Run the governance baseline workflow:"
echo "     gh workflow run governance-policy-baseline.yml"
echo ""
echo "  2. Start your first project:"
echo "     Open Copilot Chat → Select Orchestrator → Describe your project"
echo ""
log_success "Environment setup complete!"
