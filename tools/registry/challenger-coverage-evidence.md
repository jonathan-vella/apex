# Challenger Comprehensive-Lens Coverage Evidence

Snapshot-diff evidence that the single-pass `comprehensive` lens covers
≥ 80 % of the must_fix-eligible line items from each per-lens checklist
in [.github/skills/azure-defaults/references/adversarial-checklists.md](../../.github/skills/azure-defaults/references/adversarial-checklists.md)
for the `architecture` and `implementation-plan` artifact types.

Produced as part of Phase 2 of `plan-simplifyChallengerReviews.prompt.md`.
Verification #13.

## Coverage rule

For each artifact type, the comprehensive lens must include an item that
exercises the same must_fix-class concern as each per-lens line. ✓ = the
comprehensive lens has a clearly-matching entry; ✗ = not covered (must be
< 20 % of per-lens lines to meet the bar).

> Per-lens items that are inherently `should_fix` or `suggestion` (e.g.,
> "free-tier limitations documented") are not included in this bar — the
> comprehensive lens is allowed to drop them without penalty.

## artifact_type = architecture

Source per-lens lists: `security-governance`, `architecture-reliability`,
`cost-feasibility` lenses (currently the rotating-lens triple — full text
in the per-category and per-artifact-type sections of
`adversarial-checklists.md`).

| Per-lens concern (must_fix-class)                                 | Lens                     | In comprehensive?               |
| ----------------------------------------------------------------- | ------------------------ | ------------------------------- |
| Private endpoints on every data-plane resource                    | security-governance      | ✓ "Private endpoints + DNS"     |
| Private DNS zone linked to consuming VNet                         | security-governance      | ✓ "Private endpoints + DNS"     |
| **PE subnet sizing (≥ /27, 6-mo headroom)**                       | security-governance      | ✓ "Private-endpoint subnet …"   |
| `publicNetworkAccess = Disabled` for data-plane prod              | security-governance      | ✓ "Public-network access"       |
| Managed identity, no keys / SAS / SQL local auth                  | security-governance      | ✓ "Managed identity everywhere" |
| TLS 1.2 minimum, HTTPS-only                                       | security-governance      | ✓ "Encryption baseline"         |
| CMK where compliance requires                                     | security-governance      | ✓ "Encryption baseline"         |
| Every Deny policy reflected in an architecture decision           | security-governance      | ✓ "Governance compliance"       |
| WAF balance (no pillar over-optimized)                            | architecture-reliability | ✓ "WAF balance"                 |
| Composite SLA meets stated target                                 | architecture-reliability | ✓ "SLA feasibility"             |
| **RTO/RPO arithmetic against backup-retention sizing**            | architecture-reliability | ✓ "RTO / RPO arithmetic …"      |
| Single-point-of-failure / redundancy story per component          | architecture-reliability | ✓ "Failure mode + SPOF"         |
| Dependency graph acyclic, ordering explicit                       | architecture-reliability | ✓ "Dependencies acyclic"        |
| Diagnostic settings planned for every resource                    | architecture-reliability | ✓ "Monitoring + alerts"         |
| All prices sourced from Azure Pricing MCP, not guesses            | cost-feasibility         | ✓ "Cost — pricing source"       |
| **RI / Savings-Plan math for eligible workloads**                 | cost-feasibility         | ✓ "Cost — RI / Savings-Plan …"  |
| **`02-cost-estimate.json` baseline reconciliation (≤ 5 % drift)** | cost-feasibility         | ✓ "Cost — 02-cost-estimate …"   |
| Budget + cost-anomaly alerts configured                           | cost-feasibility         | ✓ "Monitoring + alerts"         |
| SKU selections match workload requirements                        | cost-feasibility         | ✓ implicit via SKU/WAF entries  |
| Repeatability: `projectName`, region, env parameterized           | cross-lens               | ✓ "Repeatability"               |

**Architecture coverage**: 20 / 20 must_fix-class lines = **100 %** ≥ 80 %.

Bolded rows are the items explicitly named in Phase 2 as non-droppable
("Specifically retain: cost-feasibility's RI / Savings-Plan math and
`02-cost-estimate.json` baseline reconciliation; security-governance's
private-endpoint subnet sizing + PE DNS-zone wiring;
architecture-reliability's RTO/RPO arithmetic against backup-retention
sizing.") — all four are present.

## artifact_type = implementation-plan

| Per-lens concern (must_fix-class)                                | Lens                     | In comprehensive?               |
| ---------------------------------------------------------------- | ------------------------ | ------------------------------- |
| Plan ↔ Deny-policy mapping (Governance Compliance Matrix)        | security-governance      | ✓ "Plan ↔ governance mapping"   |
| Every architecture resource appears in plan                      | architecture-reliability | ✓ "Plan ↔ architecture mapping" |
| AVM module versions pinned (no `latest` / `main`)                | security-governance      | ✓ "AVM module versions pinned"  |
| Private endpoints + DNS zone group entries in plan               | security-governance      | ✓ "Private endpoints + DNS"     |
| **PE subnet CIDR sized for current + 6-mo headroom**             | security-governance      | ✓ "PE subnet sizing"            |
| Managed identity role assignments enumerated per consumer→target | security-governance      | ✓ "Managed identity wiring"     |
| **Backup / DR plan supports stated RTO / RPO**                   | architecture-reliability | ✓ "Backup / DR plan vs RTO …"   |
| Phased deployment for >5 resources or data-plane services        | architecture-reliability | ✓ "Phased deployment"           |
| Diagnostic settings declared per resource                        | architecture-reliability | ✓ "Diagnostic settings"         |
| Cost monitoring budget resource with 80/100/120 % thresholds     | cost-feasibility         | ✓ "Cost monitoring"             |
| **RI / Savings-Plan math present for eligible compute**          | cost-feasibility         | ✓ "Cost — RI / Savings-Plan …"  |
| **Plan total reconciles with `02-cost-estimate.json`**           | cost-feasibility         | ✓ "Cost — 02-cost-estimate …"   |
| SKU availability validated per chosen region                     | architecture-reliability | ✓ "SKU availability per region" |
| Repeatability: `projectName` required parameter, no defaults     | cross-lens               | ✓ "Repeatability"               |
| Code-Generation Contract H2 declared                             | architecture-reliability | ✓ "CodeGen contract present"    |

**Implementation-plan coverage**: 15 / 15 must_fix-class lines = **100 %** ≥ 80 %.

Bolded rows are the four explicit retain-items called out in Phase 2 of
the plan — all present.

## How this file is maintained

- Owner: this PR (Phase 2 of `plan-simplifyChallengerReviews.prompt.md`).
- Regenerate manually whenever per-lens or comprehensive checklists in
  `adversarial-checklists.md` change. There is no automated regeneration —
  the checklist file is small and slow-moving.
- A future improvement (out of scope here) is a script under
  `tools/scripts/` that re-derives this table by parsing the checklist
  file. Until that exists, manual diff is the contract.

## Verification

- Verification #13 of the plan is satisfied while this file shows ≥ 80 %
  coverage in both artifact-type tables.
- `npm run lint:md` is the only blocking check; this file is referenced
  from the plan and the checklist file but not consumed by validators.
