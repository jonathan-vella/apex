<!-- ref:governance-drift-routing-v1 -->

# Governance Drift Routing Matrix

Single canonical table every governance-aware agent reads when a drift
signal triggers. No agent fixes a governance issue locally — drift
always unwinds to the owning agent per the four-layer attestation
stack (L0 envelope → L1 plan matrix → L2 code attestation → L3 live
policy precheck).

## Architectural contract (recap)

| Layer | Owner          | What it checks                                                                     | Source of truth                                                  |
| ----- | -------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| L0    | 04g-Governance | Discovery envelope (status, scope, page counts, signature, TTL)                    | `04-governance-constraints.json.discovery_metadata`              |
| L1    | 05-IaC Planner | Every Deny policy mapped to a plan row                                             | `04-implementation-plan.md` → Governance Compliance Matrix       |
| L2    | 06b / 06t      | Rendered IaC satisfies every matrix row's `requiredValue` at the declared property | `infra/{tool}/{project}/` + `*-validate-subagent` output         |
| L3    | 07b / 07t      | Rendered ARM/TF plan vs live Azure Policy state + what-if `--validate-only`        | `az policy state list` + `Microsoft.PolicyInsights/policyStates` |

## Drift routing matrix

| Detected at             | Drift type                                                        | Returns to                                       |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| L0 (any consumer)       | Envelope invalid / stale / partial                                | 04g-Governance                                   |
| L1 (Planner challenger) | Matrix row unsatisfiable                                          | 04g-Governance                                   |
| L1 (Planner challenger) | Matrix row missing for a Deny                                     | 05-IaC Planner                                   |
| L2 (CodeGen validator)  | Code violates a matrix row                                        | 06b/06t (self-fix — mechanical)                  |
| L2 (CodeGen validator)  | Code violates a policy not in matrix                              | 05-IaC Planner                                   |
| L2 (CodeGen validator)  | Property path doesn't exist in AVM module                         | 04g-Governance + 05-IaC Planner                  |
| L3 (Deploy precheck)    | Envelope STALE                                                    | 04g-Governance                                   |
| L3 (Deploy precheck)    | INFORMATIONAL drift — non-deny effects missing or timestamp churn | Proceed (no handoff). Log to governance backlog. |
| L3 (Deploy precheck)    | INFORMATIONAL drift accepted via `residual_drift_acceptance`      | Proceed (no handoff). Acceptance is the gate.    |
| L3 (Deploy precheck)    | BLOCKING drift — Deny-effect policy missing from constraints      | 04g-Governance                                   |
| L3 (Deploy precheck)    | BLOCKING drift — what-if returns ARM policy violation             | 04g-Governance + 05-IaC Planner                  |
| Runtime (deployment)    | Policy denies a resource                                          | Should be impossible after L3; escalate to human |

### Verdict precedence (L3)

Deploy agents MUST read `deploy_gate` (PROCEED | BLOCK) from the L3
JSON output and use it as the authoritative apply decision. `status`
is informational only and may show `INFORMATIONAL` while `deploy_gate`
remains `PROCEED`. See
[`iac-common/references/policy-precheck-contract.md`](policy-precheck-contract.md)
for the deterministic derivation rule.

> **Why this split exists** — initiative assignments (MCSB, MCAPSGov,
> ALZ) reference hundreds of child policy definitions. `az policy state
list` returns child IDs; the constraints envelope's `findings[]`
> filters to Deny + auto-remediate effects only. Without the split
> rule, every deploy on a real subscription would loop indefinitely
> through `▶ Refresh Governance` even when no blocking drift exists.
> Discovery emits `member_policy_index` to suppress most of this noise
> automatically; the routing split handles the residual.

## Handoff labels per route

| Returns to     | Handoff label                           | Restart phase                                |
| -------------- | --------------------------------------- | -------------------------------------------- |
| 04g-Governance | `▶ Refresh Governance`                  | Phase 0.45 (skip cache)                      |
| 05-IaC Planner | `↩ Return to Step 4` or `▶ Revise Plan` | Phase 3 (matrix emission)                    |
| 06b / 06t      | self-loop `▶ Fix Validation Errors`     | Phase 2 round affecting the failing resource |

## Rules

1. **Inputs are immutable** after their gate (req at gate-1, arch at
   gate-2, governance at gate-2_5).
2. **Derived artifacts are read-only to downstream consumers**.
   Plan-lock enforces Planner → CodeGen; this matrix extends it to
   CodeGen → Deploy.
3. **Drift unwinds to the offended layer** — never fix downstream.
   CodeGen disagreeing with the plan returns to Planner; Deploy
   disagreeing with constraints returns to Governance.

## Common scenarios

- **L0 envelope expired (>= `ttl_days`)** → consumer agent (Planner,
  CodeGen, Deploy) emits `▶ Refresh Governance` and stops. The
  Governance agent re-runs discovery and emits a fresh envelope; the
  consumer resumes.
- **L1 Planner challenger pass-1 finds a Deny without a matrix row** →
  Planner self-loops; do not invoke 04g-Governance unless the
  challenger reports the Deny is unsatisfiable in any plan shape.
- **L2 CodeGen validator says property path missing in AVM module** →
  return to 04g-Governance and 05-IaC Planner in parallel. The
  Planner needs a new property path candidate; Governance needs to
  record the AVM gap so the next refresh re-evaluates.
- **L3 Deploy precheck reports INFORMATIONAL drift** (audit /
  auditIfNotExists / modify / deployIfNotExists / manual effects
  missing OR timestamp churn) → `deploy_gate=PROCEED`. The parent
  deploy agent surfaces the drift summary as informational context
  and continues. No handoff. The governance team should refresh
  discovery at the next scheduled cycle to expand `member_policy_index`
  coverage.
- **L3 Deploy precheck reports BLOCKING drift** (Deny effect missing
  OR what-if violation) → `deploy_gate=BLOCK`, route to
  `▶ Refresh Governance`. Never proceed.

## Anti-patterns

- Do not edit `04-governance-constraints.{md,json}` from any agent
  other than 04g-Governance. This includes "small fixes" to matrix
  rows.
- Do not bypass L3 in Deploy agents — even with a fresh L0 envelope,
  the live API can lag or surface assignments that discovery filtered.
- Do not record a `governance_trace` attestation without all four
  layers cleared (L0 envelope OK, L1 matrix complete, L2 validator
  APPROVED, L3 precheck clean).
