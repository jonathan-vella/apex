<!-- ref:plan-consistency-checks-v1 -->

# Plan Self-Consistency Checks

Six deterministic rules the IaC Planner (Phase 2.5) applies to
`04-implementation-plan.md` after AVM verification. Each rule has a
deterministic trigger, a safe default the Planner may auto-apply, and an
escalation path to the Phase 3.5 design panel when no safe default
exists.

Rule resolution protocol (Phase 2.5):

- **Auto-pick safe default** → record via
  `apex-recall decide --key <rule_id> --value <choice> --rationale "<text>" --step 4`.
- **No safe default** → defer to Phase 3.5
  (`plan-design-decisions.md`) batched panel.

| Rule ID               | Trigger                                                                                               | Deterministic check                                                                                                                                                      | Safe default                                                       | Escalation                         |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------- |
| `zone_redundancy`     | Any resource with a `zone_redundant`/`zoneRedundant` knob OR App Service Plan P1v4+ in plan           | Number of declared instances ≥ 2 AND chosen SKU supports zone-redundancy in target region                                                                                | None (architectural decision)                                      | Phase 3.5 → `az_posture`           |
| `rbac_phase_ordering` | Phased deployment with role assignments                                                               | Every `Microsoft.Authorization/roleAssignments` (Bicep) or `azurerm_role_assignment` (TF) deploys in a phase ≥ phase of its principal identity AND its scope target      | Defer role assignments to the latest phase that owns the principal | None (mechanical fix; auto-apply)  |
| `deployment_script`   | Plan declares a `Microsoft.Resources/deploymentScripts` or AVM deployment-script wrapper              | Identity (`userAssignedIdentities`) declared, network access either `subnetResourceIds` set OR public access justified, container image pinned to digest (not `:latest`) | Pin image to a known-good digest; require `userAssignedIdentities` | Phase 3.5 → `script_runtime_image` |
| `public_edge_auth`    | Any public-edge resource (Front Door, Application Gateway, APIM, Container Apps ingress, App Service) | Auth model declared in plan (`waf_policy_id` + `managed_identity` for FD/AppGW; `oauth_provider` for App Service) AND `client_cert_required` set true/false explicitly   | None (architectural decision)                                      | Phase 3.5 → `public_edge_auth`     |
| `phased_param_wiring` | Plan declares phased deployment                                                                       | Every phase-gated resource references the same `var.deployment_phase` (Terraform) or `param phase string` (Bicep) parameter name AND has a phase-allowlist condition     | Wire each phase-gated resource to the declared phase parameter     | None (mechanical fix; auto-apply)  |
| `phase_monotonicity`  | Plan declares phased deployment                                                                       | Phase numbers (or labels) form a strictly increasing sequence with no gaps; every `depends_on` target's phase ≤ owner's phase                                            | Renumber phases to a strictly increasing sequence                  | None (mechanical fix; auto-apply)  |

## Rule details

### `zone_redundancy`

- **What it catches**: a plan that promises HA/zone-redundancy but
  declares a single instance, a non-zone-redundant SKU, or a region that
  does not expose zones.
- **Why it matters**: deploys succeed; runtime fails the first time a
  zone goes down. Discovery cannot catch this — it is a plan-internal
  contradiction between `02-architecture-assessment.md`'s reliability
  target and the chosen SKU/instance count.
- **Escalation**: send to Phase 3.5 batched panel under `az_posture`
  (single-zone MVP vs zone-redundant).

### `rbac_phase_ordering`

- **What it catches**: role assignment in Phase 2 referencing a
  managed identity created in Phase 4.
- **Auto-fix**: re-bucket role assignments to the latest phase that
  owns the principal AND its scope target. Record the move in
  `apex-recall decide`.

### `deployment_script`

- **What it catches**: ephemeral deployment scripts running with
  system-assigned identity (cannot grant RBAC pre-deploy), `:latest`
  image tags (non-reproducible), or public networking on a private
  workload.
- **Escalation**: send to Phase 3.5 batched panel under
  `script_runtime_image` (mcr.microsoft.com/azure-cli:2.x.x digest
  vs custom image).

### `public_edge_auth`

- **What it catches**: a public-edge resource without an explicit
  authentication contract (anonymous-by-default is the implicit
  failure mode).
- **Escalation**: Phase 3.5 batched panel under `public_edge_auth`
  (none / managed identity / OAuth provider / client cert).

### `phased_param_wiring`

- **What it catches**: phase-gated resources that read different param
  names (e.g. `phase` vs `deployment_phase`), making `--phase 2`
  silently deploy nothing.
- **Auto-fix**: rewrite every phase-gated resource to read the single
  declared phase parameter.

### `phase_monotonicity`

- **What it catches**: `Phase 1, Phase 2, Phase 4` (gap) or
  `Phase 1, Phase 3, Phase 2` (out-of-order), which break the deploy
  agent's "deploy next phase" handoff.
- **Auto-fix**: renumber phases monotonically; rewrite `depends_on`
  to honour the new numbering.

## How the Planner consumes this file

1. Phase 2.5 reads this reference once after AVM verification.
2. For each rule, run the deterministic check against the plan draft.
3. If the rule triggers AND a safe default exists → apply it; record
   the decision via `apex-recall decide`.
4. If the rule triggers AND there is no safe default → add the
   corresponding `plan-design-decisions.md` question to the Phase 3.5
   batched panel.
5. Re-run all six checks after the Phase 3.5 panel resolves.
6. Phase 4.3 challenger pass 1 (security-governance lens) verifies
   that no triggered rule is still unresolved.

## Anti-patterns

- Do not auto-apply `zone_redundancy`, `deployment_script`, or
  `public_edge_auth` — they are architectural decisions, not
  mechanical ones.
- Do not re-trigger these checks on revision loops if the rule already
  recorded a decision; reuse the prior `apex-recall decide` value.
- Do not write a new validator script for these rules in this PR — they
  ship as agent-enforced documentation. A future PR can add
  `npm run validate:plan-consistency` once 5+ projects use the
  schema.
