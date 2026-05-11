<!-- ref:plan-design-decisions-v1 -->

# Plan Design Decisions Panel

Canonical question set for the IaC Planner's Phase 3.5 batched
`askQuestions` panel. Replaces the previous freeform Phase 1.5
deployment-context prompt and the Phase 3.5 deployment-strategy gate's
loose tail with a single structured panel. Every answer persists via
`apex-recall decide --key <id> --value <choice>` so downstream CodeGen
phases can consume it without re-asking.

## When the Planner reads this file

- Phase 3.5 (Deployment Strategy Gate): builds one `askQuestions` panel
  from the four canonical questions below, prepending any deferred
  rules from `plan-consistency-checks.md` (e.g. `zone_redundancy`).

## Canonical questions

### 1. `identity_model`

- **Question**: "Which identity model should generated resources use?"
- **Options**:
  - `system-assigned` (default for single-workload projects)
  - `user-assigned-shared` (recommended for multi-resource workloads;
    one identity reused across modules)
  - `user-assigned-per-resource` (when fine-grained RBAC scoping is
    mandatory)
- **Persistence key**: `identity_model`
- **Downstream consumers**:
  - CodeGen Phase 1.5 — governance compliance mapping uses this to
    decide where `principalId` lives.
  - CodeGen Phase 2 — Bicep `managedIdentities` block / Terraform
    `azurerm_user_assigned_identity` count.

### 2. `public_edge_auth`

- **Question**: "How should public-edge resources authenticate
  callers?"
- **Options**:
  - `none-private` (no public edge — all ingress private)
  - `managed-identity` (downstream service auth, no public auth)
  - `oauth-entra` (Entra ID OAuth via App Service Auth /
    Container Apps Auth / APIM OAuth)
  - `client-cert` (mTLS at Application Gateway / Front Door)
- **Persistence key**: `public_edge_auth`
- **Downstream consumers**:
  - CodeGen Phase 2 — App Service / Container Apps auth block,
    Application Gateway listener config, APIM identity provider.
  - Plan consistency rule `public_edge_auth` (resolved by this
    answer).

### 3. `script_runtime_image`

- **Question**: "Which container image should deployment scripts use?"
- **Options**:
  - `mcr.microsoft.com/azure-cli:2.65.0` (pinned digest;
    recommended)
  - `mcr.microsoft.com/azure-cli:latest` (NOT recommended — non-
    reproducible; only choose if user explicitly opts in)
  - `custom` (user supplies digest; Planner emits a follow-up
    question for the digest string)
- **Persistence key**: `script_runtime_image`
- **Downstream consumers**:
  - CodeGen Phase 2 — `Microsoft.Resources/deploymentScripts` /
    `azurerm_resource_group_template_deployment` script container
    config.
  - Plan consistency rule `deployment_script` (resolved by this
    answer).

### 4. `az_posture`

- **Question**: "What is the target Availability Zone posture?"
- **Options**:
  - `single-zone-mvp` (cheapest; acceptable for non-prod)
  - `zone-redundant` (recommended for prod; requires P1v4+/v2+ SKUs
    and 2+ instances)
  - `regional-pair` (zone-redundant primary + read-only or warm
    standby in paired region)
- **Persistence key**: `az_posture`
- **Downstream consumers**:
  - CodeGen Phase 2 — App Service Plan tier/instance count, SQL/
    PostgreSQL HA mode, Storage replication SKU.
  - Plan consistency rule `zone_redundancy` (resolved by this
    answer).
  - Step 7 Backup/DR plan (consumes `az_posture` to scope RPO/RTO).

## Persistence protocol

For each answer the user gives:

```bash
apex-recall decide <project> \
  --key {persistence_key} \
  --value {chosen_option} \
  --rationale "Phase 3.5 design panel" \
  --step 4 \
  --json
```

If the user picks `custom` (where allowed), follow up with one
free-text `askQuestions` to capture the custom value, then persist as
`{persistence_key}_custom = "<value>"`.

## Downstream consumer impact table

| Persistence key        | 06b-Bicep CodeGen Phase      | 06t-Terraform CodeGen Phase  | 07b/07t Deploy Phase |
| ---------------------- | ---------------------------- | ---------------------------- | -------------------- |
| `identity_model`       | Phase 2 (scaffold + modules) | Phase 2 (scaffold + modules) | — (read-only)        |
| `public_edge_auth`     | Phase 2 (edge modules)       | Phase 2 (edge modules)       | — (read-only)        |
| `script_runtime_image` | Phase 2 (deployment scripts) | Phase 2 (deployment scripts) | — (read-only)        |
| `az_posture`           | Phase 2 (compute/data)       | Phase 2 (compute/data)       | Phase 4 (verify)     |

## Rules

- The panel is **single-shot**: one `askQuestions` call with up to 4
  questions (plus any deferred plan-consistency questions). Never split
  into multiple turns.
- Recommended defaults are pre-selected; the user clicks to confirm or
  change.
- If `apex-recall show` already records a value for one of these keys
  (e.g. from a resume), omit that question from the panel.
- Do not ask for `identity_model` when the project has zero compute
  resources; default to `none` and persist that.

## Anti-patterns

- Do not present these questions in chat text; always use
  `askQuestions`.
- Do not introduce a fifth question without updating this file
  first — the panel cap is 4 + deferred consistency rules.
- Do not record the persistence key under a different name (e.g.
  `identity` instead of `identity_model`) — downstream consumers read
  the exact key.
