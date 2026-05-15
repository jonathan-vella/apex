<!-- ref:identity-resolution-v1 -->

# Identity Resolution (Wave 2)

Single source of truth for how APEX agents resolve **Azure identities** —
deployer object IDs, existing app registrations, system-assigned vs.
user-assigned managed identities — without baking environment-specific
GUIDs into the committed IaC tree.

> Loaded on demand by `05-IaC Planner`, `06b-Bicep CodeGen`,
> `06t-Terraform CodeGen`, `07b-Bicep Deploy`, and `07t-Terraform Deploy`
> when they touch identity. Source: workflow simplification plan, Workstream E.

---

## TL;DR contract

| Concept                     | Where it lives                                                                                                                | Why                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Deployer object ID          | `agent-output/{project}/04-environment-manifest.json`                                                                         | Per-environment; never in `infra/`.                                                |
| Existing app reg object IDs | `04-environment-manifest.json#environments.{env}.existing_app_reg_object_ids`                                                 | Default mode: `identity.entra_app_creation = existing`.                            |
| UAMI logical names          | `04-iac-contract.json#identity.uami_logical_names`                                                                            | Stable contract identifier; physical name resolves via CAF naming + unique suffix. |
| `system_assigned` flag      | Per-resource in `04-iac-contract.json#resources[].purpose` (planner hint) → CodeGen sets `identity: { type: SystemAssigned }` | Compute-only.                                                                      |
| New app reg (opt-in)        | `04-iac-contract.json#identity.entra_app_creation = create` + Graph permission preflight                                      | Opt-in; default is `existing` to avoid Graph blast radius.                         |

---

## Resolution mode A — `auto` (default for most workloads)

The Planner emits `identity.type` and `entra_app_creation = existing`.
CodeGen produces:

- **Bicep**: a single `param deployerObjectId string` and any
  `param existingApp{Name}ObjectId string` params required by the
  workload. The committed `main.bicep` never hard-codes a GUID; the
  param values come from a `*.bicepparam` file populated at deploy time
  from `04-environment-manifest.json`.
- **Terraform**: a `variable "deployer_object_id" {}` + per-app
  `variable "existing_app_{name}_object_id" {}` block. The deploy agent
  passes `-var-file=$(env)/main.tfvars.json` generated from the
  environment manifest.

The Planner asserts in the contract:

```json
"identity": {
  "type": "user_assigned",
  "uami_logical_names": ["uami-api"],
  "entra_app_creation": "existing",
  "entra_app_existing_id_param": "existingApiAppObjectId"
}
```

---

## Resolution mode B — `manual` (explicit override)

Set `decisions.identity_resolution = manual` in apex-recall before
Step 4. The Planner then:

1. Emits the contract with `entra_app_creation = existing` _and_
2. Lists every required object-ID input as a row in
   `05-required-inputs.json#environments.{env}.required_inputs[]` so
   the deploy agent halts with a clear "supply the following values"
   prompt at run time instead of silently substituting placeholders.

Useful when:

- The workload spans tenants and the deployer must rotate identities.
- A break-glass owner is supplied per environment by a security desk.

---

## App-registration creation (`entra_app_creation = create`)

Opt-in only. Gated by a **Graph permission preflight** that the deploy
agent runs before `azd provision` / `terraform apply`:

```text
required Graph roles → Application.ReadWrite.All (delegated or app)
                       Directory.Read.All
preflight cmd        → az ad signed-in-user show --query id
                       az rest -m GET --uri https://graph.microsoft.com/v1.0/me/oauth2PermissionGrants
on missing role      → BLOCK deploy, write 06-deployment-summary.md
                       "Graph permission preflight failed: missing
                       Application.ReadWrite.All".
```

Terraform-track caveats:

- `azuread_application` MUST be wrapped in a `lifecycle { prevent_destroy = true }`.
- Owners array MUST include the deployer object ID _and_ at least one
  break-glass principal from
  `environment-manifest.environments.{env}.principal_ids`.
- The created application's `display_name` MUST embed the project +
  environment so accidental cross-environment ownership is detectable.

---

## Why this matters

- **Repeatability.** No GUIDs in `infra/`; the same Bicep/Terraform tree
  deploys to dev, test, prod, and any tenant. Reviewed in plan's
  Repeatability section.
- **Audit.** L2 attestation (per-row in `05-iac-handoff.json`) shows
  exactly which identity rows the Step 5 code satisfies. L3 policy
  precheck reads `04-environment-manifest.json` to confirm Graph
  permissions exist.
- **Blast radius.** Default `existing` mode means the Graph permission
  surface is _read-only_ for the deploy agent. `create` is the explicit
  exception, never a silent fallback.

---

## Cross-references

- `tools/schemas/iac-contract.schema.json` → `identity` object
- `tools/schemas/environment-manifest.schema.json` →
  `environments.{env}.existing_app_reg_object_ids`
- `.github/skills/azure-bicep-patterns/references/bicepparam-pattern.md`
- `.github/skills/terraform-patterns/references/azuread-pattern.md`
- `tools/scripts/validate-environment-manifest.mjs`
