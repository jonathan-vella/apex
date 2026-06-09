# `apex-recall` Decision Keys Registry

> Canonical list of valid `decisions.<key>` values written by
> `apex-recall decide --key <k> --value <v>`. New keys are added here
> first; the validator `tools/scripts/validate-decision-keys.mjs`
> rejects any `apex-recall decide --key` call in an agent file whose
> key is absent from this registry.

## Phase I of the nordic-foods lessons plan

This registry was introduced to prevent silent typos and forked key
namespaces across agents. Before this registry, decision keys were
free-form strings — a typo (`sku_confirmation_satus`) would write
silently and never read back. The lint catches that at PR time.

## Backward compatibility / migration policy

**Behavioural changes introduced by the nordic-foods lessons plan
apply only to projects whose Step 1 starts after the plan is merged.**
In-flight projects (those with `current_step > 0` at merge time)
continue with their existing gates to avoid mid-stream surprises. New
decision keys are backward-compatible: agents treat absent keys as
"default behaviour".

Specifically:

- Projects whose `00-session-state.json` was created **before** the
  merge commit of this plan continue with the old gates (no SKU
  confirmation, no budget gate, old 3-question governance Phase 2.7,
  etc.). The agents detect this by checking session-state `created` /
  `updated` timestamps against the merge commit date.
- Projects created **after** merge use the new gates from Step 1.
- The migration is one-way; in-flight projects do not retroactively
  acquire the new gates.

## Canonical key registry

### Workflow routing keys

| Key             | Valid values                                                                                    | Default behaviour if absent     | Set by          | Read by                                             |
| --------------- | ----------------------------------------------------------------------------------------------- | ------------------------------- | --------------- | --------------------------------------------------- |
| `iac_tool`      | `Bicep` \| `Terraform`                                                                          | Orchestrator prompts the user   | 01-Orchestrator | 05-IaC Planner, 06b/06t CodeGen, 07b/07t Deploy     |
| `region`        | Azure region ID (e.g. `swedencentral`)                                                          | `swedencentral`                 | 02-Requirements | All Azure-resource-emitting agents                  |
| `complexity`    | `low` \| `medium` \| `high`                                                                     | `medium`                        | 02-Requirements | Challenger lens selection                           |
| `review_depth`  | `default` \| `deep`                                                                             | `default` (single-pass reviews) | 01-Orchestrator | All adversarial review invocations                  |
| `skip_design`   | `true` \| `false`                                                                               | `false` (Design runs)           | 01-Orchestrator | 03-Architect approval gate routing message          |
| `relational_db` | `azure-sql` \| `postgresql-flex` \| `mysql-flex` \| `sql-managed-instance` \| `none` \| `other` | n/a (Phase 3d question)         | 02-Requirements | 03-Architect (SKU), 05-IaC Planner, 06b/06t CodeGen |

### Challenger-loop keys (Plan 01 Phase 2b)

Per-step counters + override flags that enforce the
`review_depth`-aware challenger ceiling defined in
`01-orchestrator.agent.md` ("Challenger-invocation ceiling").
The `<step>` suffix is the integer step number (`1`, `2`, `3_5`, `4`).

| Key                             | Valid values                      | Default behaviour if absent                                 | Set by          | Read by         |
| ------------------------------- | --------------------------------- | ----------------------------------------------------------- | --------------- | --------------- |
| `challenger_invocations_<step>` | integer ≥ 0                       | `0` (no challenger pass yet for step)                       | 01-Orchestrator | 01-Orchestrator |
| `challenger_override_<step>`    | `true` \| `false`                 | `false` (no override authorised)                            | 01-Orchestrator | 01-Orchestrator |
| `challenger_decision_<step>`    | `accept` \| `override` \| `abort` | n/a (only set when the ceiling-recovery askQuestions fires) | 01-Orchestrator | 01-Orchestrator |

### Step 2 (Architecture) keys — new in this plan

| Key                       | Valid values                                                              | Default behaviour if absent        | Set by          | Read by                                  |
| ------------------------- | ------------------------------------------------------------------------- | ---------------------------------- | --------------- | ---------------------------------------- |
| `sku_confirmation_status` | `approved` \| `revising`                                                  | Architect raises 6a gate           | 03-Architect    | 03-Architect step 7 pricing precondition |
| `budget_cap_known`        | `true` \| `false`                                                         | `false` (skip budget gate)         | 02-Requirements | 03-Architect step 9a budget gate         |
| `budget_decision`         | `approve_overage` \| `revise_sku` \| `revise_reqs`                        | n/a (only set when 9a fires)       | 03-Architect    | 03-Architect routing                     |
| `budget_revise_count`     | integer 0..3                                                              | `0`                                | 03-Architect    | 03-Architect 3-iteration cap             |
| `cost_feasibility_review` | `run` \| `skip`                                                           | n/a (only set after lens decision) | 03-Architect    | 03-Architect challenger invocation       |
| `sku_manifest_status`     | `draft` \| `reviewed` \| `locked` \| `deploying` \| `deployed` \| `drift` | n/a                                | various         | 05/06/07 agents                          |
| `sku_manifest_revision`   | integer ≥ 1                                                               | `1`                                | various         | sku-manifest validators                  |
| `sku_preferences_captured`| `true` \| `false`                                                         | `false` (Phase 3j elicitation skipped) | 02-Requirements | 03-Architect, sku-manifest validators    |

### Step 3 (Design) keys — new in this plan

| Key            | Valid values                   | Default behaviour if absent          | Set by    | Read by                                             |
| -------------- | ------------------------------ | ------------------------------------ | --------- | --------------------------------------------------- |
| `design_scope` | `diagrams` \| `adrs` \| `both` | Design Phase 00 gate raises question | 04-Design | 04-Design workflow routing (Phase 0 + Sections 1/2) |
| `diagram_tool` | `drawio` \| `python`           | Design Phase 0 gate raises question  | 04-Design | 04-Design workflow routing                          |

### Step 3.5 (Governance) keys

| Key                 | Valid values                                       | Default behaviour if absent | Set by         | Read by         |
| ------------------- | -------------------------------------------------- | --------------------------- | -------------- | --------------- |
| `governance_status` | `discovered` \| `pending_resolution` \| `complete` | n/a                         | 04g-Governance | 05-IaC Planner  |
| `tag_strategy`      | `policy` \| `greenfield-lowercase-9tag`            | `policy` (live discovery)   | 04g-Governance | 06b/06t CodeGen |

### Step 4 (IaC Plan) keys

| Key                    | Valid values                                                                 | Default behaviour if absent | Set by                         | Read by                                |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------- | ------------------------------ | -------------------------------------- |
| `discovery_signature`  | string (commit-sha-like fingerprint of governance JSON)                      | n/a                         | 05-IaC Planner, 04g-Governance | 05-IaC Planner, 04g-Governance         |
| `deployment_note`      | free-form text (e.g. quota workaround, region rationale)                     | n/a                         | 05-IaC Planner                 | 06b/06t Deploy, 08-As-Built            |
| `identity_model`       | `managed-identity` \| `service-principal` \| `workload-identity` \| `hybrid` | n/a                         | 05-IaC Planner                 | 06b/06t CodeGen, 07b/07t Deploy        |
| `public_edge_auth`     | `entra-only` \| `app-gateway-waf` \| `front-door` \| `apim` \| `none`        | n/a                         | 05-IaC Planner                 | 06b/06t CodeGen                        |
| `script_runtime_image` | container image ref (e.g. `mcr.microsoft.com/azure-cli:2.x`)                 | n/a                         | 05-IaC Planner                 | 06b/06t CodeGen (deployment scripts)   |
| `az_posture`           | `private-only` \| `hybrid` \| `public-restricted`                            | n/a                         | 05-IaC Planner                 | 06b/06t CodeGen, 04g-Governance review |

### Step 6 (Deploy) keys

| Key                       | Valid values                                                          | Default behaviour if absent | Set by         | Read by         |
| ------------------------- | --------------------------------------------------------------------- | --------------------------- | -------------- | --------------- |
| `deployment_strategy`     | `azd_provision` \| `az_deployment` \| `terraform_apply`               | n/a                         | 07b/07t Deploy | Step 7 As-Built |
| `sku_conflict_resolution` | `revert_to_plan` \| `accept_substitute` \| `change_region` \| `abort` | n/a (per-conflict)          | Orchestrator   | 07b/07t Deploy  |

### Cost monitoring baseline keys

Owned by `.github/skills/azure-defaults/references/cost-alerts-baseline.md`.
All keys are emitted by Planner Phase 4 (or 02-Requirements for the
two user-facing keys) and consumed by 06b/06t CodeGen Wave 4.

| Key                         | Valid values                                            | Default behaviour if absent                           | Set by                              | Read by                         |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- | ------------------------------- |
| `cost_monitoring_scope`     | `rg` \| `sub` \| `mg`                                   | Planner derives from deployment topology              | 05-IaC Planner                      | 06b/06t CodeGen                 |
| `cost_action_group_mode`    | `create` \| `existing`                                  | Planner runs preflight `az monitor action-group show` | 05-IaC Planner                      | 06b/06t CodeGen                 |
| `existing_action_group_id`  | Azure resource ID (string)                              | n/a (required only when mode = `existing`)            | 05-IaC Planner                      | 06b/06t CodeGen                 |
| `action_group_short_name`   | string ≤12 chars                                        | `cost${suffix}`                                       | 02-Requirements (optional override) | 06b/06t CodeGen                 |
| `cost_alert_emails`         | list of email addresses                                 | `[<git config user.email>]`                           | 02-Requirements                     | 06b/06t CodeGen, 03-Architect   |
| `cost_monitoring_mode`      | `enforced` \| `minimal` \| `deferred`                   | `enforced` (prod); prompted in non-prod               | 02-Requirements                     | 05-IaC Planner, 06b/06t CodeGen |
| `cost_monitoring_exception` | object `{ rationale: string, expiry_date: YYYY-MM-DD }` | n/a (required only when mode = `deferred`)            | 02-Requirements / 05-IaC Planner    | 10-Challenger (D-7)             |

### VNet planning keys (Architect Phase 6b)

Owned by [`.github/skills/azure-defaults/references/vnet-planning.md`](../../../.github/skills/azure-defaults/references/vnet-planning.md).
Emitted by 03-Architect Phase 6b when the trigger contract holds
(any `services[].requires[] ∈ {vnet-integration, private-endpoints}`
OR any `services[].service_name` in the vnet-attached whitelist).
Consumed by 05-IaC Planner, 06b/06t CodeGen, and 04g-Governance.

| Key                   | Valid values                                            | Default behaviour if absent                         | Set by         | Read by                                            |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------- | -------------- | -------------------------------------------------- |
| `vnet_planning_mode`  | `guided` \| `fast` \| `deferred`                        | `guided`                                            | 03-Architect   | 03-Architect Phase 6b, 04g-Governance, 05/06b/06t  |
| `vnet_mode`           | `create-new` \| `use-existing`                          | n/a (required when gate fires)                      | 03-Architect   | 05-IaC Planner, 06b/06t CodeGen                    |
| `existing_vnet_id`    | Azure resource ID (string)                              | n/a (required when `vnet_mode = use-existing`)      | 03-Architect   | 05-IaC Planner, 06b/06t CodeGen                    |
| `vnet_address_space`  | CIDR string (e.g. `10.0.0.0/16`)                        | `10.0.0.0/16` (greenfield)                          | 03-Architect   | 05-IaC Planner, 06b/06t CodeGen, 04g-Governance    |
| `subnet_plan`         | JSON array conforming to `tools/schemas/subnet-plan.schema.json` | n/a (gate emits placeholder `[]` in `deferred`)     | 03-Architect   | 05-IaC Planner, 06b/06t CodeGen, 04g-Governance    |
| `vnet_plan_decision`  | `confirmed` \| `edited` \| `deferred`                   | n/a (only set after gate fires)                     | 03-Architect   | 05-IaC Planner, 04g-Governance, 10-Challenger      |

`validate:decision-keys` loads `subnet-plan.schema.json` and validates
any project's `decisions.subnet_plan` against it; a soft warning fires
when the trigger contract holds but `subnet_plan` is absent.

### Free-form decision-log entries

The `apex-recall decide --decision "<text>" --rationale "<why>"` form
records a free-form decision-log entry (no `--key` flag). These are
**not** keys and are exempt from this registry.

## Validator

`tools/scripts/validate-decision-keys.mjs` greps every `.agent.md` file
for `apex-recall decide --key <k>` patterns and asserts that `<k>`
appears in this registry. New keys MUST be added here before being
used in an agent file. Run via `npm run validate:decision-keys` (wired
into `npm run validate:all` and `lefthook`).
