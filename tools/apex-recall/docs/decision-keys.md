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

### Step 3 (Design) keys — new in this plan

| Key            | Valid values                   | Default behaviour if absent          | Set by    | Read by                                             |
| -------------- | ------------------------------ | ------------------------------------ | --------- | --------------------------------------------------- |
| `design_scope` | `diagrams` \| `adrs` \| `both` | Design Phase 00 gate raises question | 04-Design | 04-Design workflow routing (Phase 0 + Sections 1/2) |
| `diagram_tool` | `drawio` \| `python`           | Design Phase 0 gate raises question  | 04-Design | 04-Design workflow routing                          |

### Step 3.5 (Governance) keys

| Key                 | Valid values                                       | Default behaviour if absent | Set by         | Read by         |
| ------------------- | -------------------------------------------------- | --------------------------- | -------------- | --------------- |
| `governance_status` | `discovered` \| `pending_resolution` \| `complete` | n/a                         | 04g-Governance | 05-IaC Planner  |
| `tag_strategy`      | `policy` \| `greenfield-lowercase-4tag`            | `policy` (live discovery)   | 04g-Governance | 06b/06t CodeGen |

### Step 4 (IaC Plan) keys

| Key                    | Valid values                                                                 | Default behaviour if absent | Set by         | Read by                                |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------- | -------------- | -------------------------------------- |
| `discovery_signature`  | string (commit-sha-like fingerprint of governance JSON)                      | n/a                         | 05-IaC Planner | 05-IaC Planner re-entry detection      |
| `deployment_note`      | free-form text (e.g. quota workaround, region rationale)                     | n/a                         | 05-IaC Planner | 06b/06t Deploy, 08-As-Built            |
| `identity_model`       | `managed-identity` \| `service-principal` \| `workload-identity` \| `hybrid` | n/a                         | 05-IaC Planner | 06b/06t CodeGen, 07b/07t Deploy        |
| `public_edge_auth`     | `entra-only` \| `app-gateway-waf` \| `front-door` \| `apim` \| `none`        | n/a                         | 05-IaC Planner | 06b/06t CodeGen                        |
| `script_runtime_image` | container image ref (e.g. `mcr.microsoft.com/azure-cli:2.x`)                 | n/a                         | 05-IaC Planner | 06b/06t CodeGen (deployment scripts)   |
| `az_posture`           | `private-only` \| `hybrid` \| `public-restricted`                            | n/a                         | 05-IaC Planner | 06b/06t CodeGen, 04g-Governance review |

### Step 6 (Deploy) keys

| Key                       | Valid values                                                          | Default behaviour if absent | Set by         | Read by         |
| ------------------------- | --------------------------------------------------------------------- | --------------------------- | -------------- | --------------- |
| `deployment_strategy`     | `azd_provision` \| `az_deployment` \| `terraform_apply`               | n/a                         | 07b/07t Deploy | Step 7 As-Built |
| `sku_conflict_resolution` | `revert_to_plan` \| `accept_substitute` \| `change_region` \| `abort` | n/a (per-conflict)          | Orchestrator   | 07b/07t Deploy  |

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
