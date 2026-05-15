<!-- ref:azuread-pattern-v1 -->

# `azuread_*` Pattern (Wave 2)

Records the **only** APEX-sanctioned shape for Microsoft Entra (Azure
AD) identities in Terraform: existing app registrations are the default,
new app-registration creation is opt-in behind a permission preflight,
and the committed `infra/terraform/{project}/` tree never embeds a GUID.

> Loaded on demand by `06t-Terraform CodeGen` and `07t-Terraform Deploy`
> when they touch Entra identities. Source: workflow simplification
> plan, Workstream E.

---

## Default: `entra_app_creation = existing` (LOW Graph blast radius)

```hcl
variable "deployer_object_id" {
  type        = string
  description = "objectId of the service principal running terraform apply (from 04-environment-manifest.json)."
  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.deployer_object_id))
    error_message = "deployer_object_id must be a GUID."
  }
}

variable "existing_api_app_object_id" {
  type        = string
  description = "Pre-created API app registration objectId (from 04-environment-manifest.json#environments.{env}.existing_app_reg_object_ids.api)."
  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.existing_api_app_object_id))
    error_message = "existing_api_app_object_id must be a GUID."
  }
}

data "azuread_application" "api" {
  object_id = var.existing_api_app_object_id
}

resource "azurerm_role_assignment" "deployer_owner" {
  scope                = azurerm_resource_group.this.id
  role_definition_name = "Owner"
  principal_id         = var.deployer_object_id
}
```

The deploy agent renders a per-environment `*.tfvars.json` from
`04-environment-manifest.json` and passes it via
`terraform apply -var-file=$(env)/main.tfvars.json`. The
`*.tfvars.json` files are NOT committed — they live in the deploy
agent's run directory and are written through
`validate-environment-manifest.mjs --redact` before any transcript
emits them.

---

## Opt-in: `entra_app_creation = create` (HIGH Graph blast radius)

Set `decisions.entra_app_creation = create` in apex-recall **and**
`identity.entra_app_creation = "create"` in
`04-iac-contract.json#identity` before the planner emits a
contract that asks Terraform to create an `azuread_application`. The
deploy agent's preflight blocks the apply unless the signed-in principal
holds `Application.ReadWrite.All`.

```hcl
resource "azuread_application" "api" {
  display_name = "${var.project}-${var.environment}-api"  # env scope baked into name
  owners = distinct(concat(
    [var.deployer_object_id],
    [for p in var.break_glass_object_ids : p]
  ))

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [owners]  # owners managed out-of-band by IAM team
  }
}

resource "azuread_service_principal" "api" {
  client_id = azuread_application.api.client_id

  lifecycle {
    prevent_destroy = true
  }
}
```

Hard requirements when `create` is in effect:

1. `lifecycle.prevent_destroy = true` on `azuread_application` AND
   `azuread_service_principal`.
2. `display_name` MUST embed the project + environment so cross-tenant
   ownership confusion is impossible.
3. `owners` MUST include the deployer object ID AND at least one
   break-glass principal from `environment-manifest.environments.{env}.principal_ids`.
4. The deploy agent's preflight calls
   `az ad signed-in-user show --query id` and an
   `az rest -m GET --uri https://graph.microsoft.com/v1.0/me/oauth2PermissionGrants`
   to validate `Application.ReadWrite.All` is granted. Missing → BLOCK.

---

## Anti-patterns (blocked by `validate:iac-security-baseline`)

```hcl
# ❌ NEVER — GUID literal in source.
data "azuread_application" "api" {
  object_id = "11111111-2222-3333-4444-555555555555"
}

# ❌ NEVER — silent app-reg creation without prevent_destroy.
resource "azuread_application" "api" {
  display_name = "api"
  # missing lifecycle block — Terraform can destroy + recreate on owner drift
}

# ❌ NEVER — env-aware ternary baked into module body.
locals {
  app_object_id = var.environment == "prod"
    ? "AAAA…"
    : "BBBB…"
}
```

---

## L2 attestation rows

For every Deny-effect policy that touches Entra (e.g. "Require app reg
naming convention", "Block default access grants"),
`06t-Terraform CodeGen` MUST emit an attestation row in
`05-iac-handoff.json#governance_attestation.rows[]` pointing at the
exact `azuread_application` / `azuread_service_principal` block + line
that satisfies the policy. Deploy agent reads these instead of
re-walking the tree.

---

## Cross-references

- `tools/schemas/iac-contract.schema.json` → `identity.entra_app_creation`
- `tools/schemas/environment-manifest.schema.json` → `principal_ids`
- `.github/skills/azure-defaults/references/identity-resolution.md`
- `tools/scripts/validate-iac-handoff.mjs` (verifies attestation rows reference real lines)
