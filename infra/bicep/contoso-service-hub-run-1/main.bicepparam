// main.bicepparam — Dev environment parameter file for Contoso Service Hub
// Usage: az deployment sub create --template-file main.bicep --parameters main.bicepparam
//        azd provision (reads azure.yaml → main.bicep → main.bicepparam)

using 'main.bicep'

// ─────────────────────────────── Deployment Scope ────────────────────────────

param location = 'swedencentral'
param environment = 'dev'
param deploymentPhase = 1

// ─────────────────────────────── Project Identity ────────────────────────────

param projectName = 'contoso-svchub'
param owner = 'Contoso'

// ─────────────────────────────── Budget ──────────────────────────────────────
// Dev budget: $1,500/month (per implementation plan)
// Staging: $2,100 | Production: $7,500 — use separate .bicepparam files

param budgetAmount = 1500
param budgetContactEmails = [
  'platform@contoso.com'
]

// ─────────────────────────────── DNS ─────────────────────────────────────────
// Dev environment public DNS zone — delegate from domain registrar after deployment

param publicDnsZoneName = 'dev.contoso-svchub.com'

// ─────────────────────────────── Phase 2: Data ───────────────────────────────
// PostgreSQL admin credentials — password auth is disabled via Entra-only auth policy.
// The ARM API requires these fields for server creation; the password is not usable
// once authConfig.passwordAuth = 'Disabled' is enforced.
// In production, store the initial password in Key Vault before deployment.

param postgresAdminLogin = 'pgadmin'
param postgresAdminPassword = 'PlaceholderDev#2026!'  // Dev only — blocked by Entra-only auth
