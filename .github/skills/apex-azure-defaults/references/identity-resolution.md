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

### Resolve before asking

Use this procedure in Planner, both CodeGen agents and both Deploy agents before parameter rendering or preview.
An unset process variable is not a missing requirement. Read `apex-recall show <project> --json` and inspect
`session.decisions` and `session.decision_log`, not invented fields such as `approved_step5_decision`.
Reuse current approved values from the manifest and exact recorded decisions. A free-text decision is evidence
for the caller to interpret and cite; do not turn arbitrary prose into automatic approval or silently migrate state.

1. Verify the active subscription and tenant against approved governance scope. Resolve the authenticated principal
  object ID read-only, distinguishing user, service principal and managed identity; client ID is not object ID.
  Do not switch subscriptions or identities automatically. Authentication/discovery failure is not absence.
2. For SQL, retain Entra-only authentication. Offer an existing administrator security-group ID or explicitly
  authorized group creation through its permitted owner. Verify group ID, tenant, security-enabled status and
  display name; use `Group`, not a new authentication choice. No CodeGen directory/membership/role mutations.
3. Reuse approved tag values and required policy keys; fallback keys do not supply business values. A policy's
  exception parameters do not mandate a bypass tag. Ask only for unresolved values or actual conflicts, in one panel.
4. Supply approved and discovered evidence to `node tools/scripts/resolve-deployment-inputs.mjs --input <snapshot>`.
  It is read-only and does not query Azure or authorize operations. Exit 0 means resolved; exit 1 means blocked.
  Default output omits values. `--include-values` explicitly emits only resolved non-secret parameter values;
  use process-local handling, not committed rendered parameters. Never put credentials in its snapshot.

Snapshot fields: `environment`, explicit `required` field names, existing `manifest`, normalized `approved` values,
`expected_context: {subscription_id, tenant_id}`, and `discovery` containing `account`, `principal` and `sql_group`.
`account` has `subscription_id`/`tenant_id`; `principal` has `object_id`, `tenant_id` and
`type: User|ServicePrincipal|ManagedIdentity`; `sql_group` has `id`, `displayName`, `securityEnabled`, `tenant_id`.
Set `required_tag_keys` from current policy or the applicable fallback contract. `mode: manual` disables discovery
fallback, not scope verification. Normalized `approved` values must cite the actual authorization in the caller's
evidence; the helper validates consistency, not approval provenance. Source snapshots are local/private evidence.

Supported fields: `project`, `subscription_id`, `tenant_id`, `primary_region`, `deployer_object_id`,
`sql_admin_object_id`, `sql_admin_login`, `sql_admin_principal_type`, `tags`, `alert_emails`, `budget_monthly_usd`.
Zero GUIDs, redaction markers and malformed recipients are not deployment values. Group creation needs separate
authorization; when the deployer is not a human, clarify the intended human group member rather than adding automation.
Resolve once for both IaC tracks; map the returned values only to the approved Bicep/Terraform parameter contract.

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
- `.github/skills/apex-azure-bicep-patterns/references/bicepparam-pattern.md`
- `.github/skills/apex-terraform-patterns/references/azuread-pattern.md`
- `tools/scripts/validate-environment-manifest.mjs`
