<!-- ref:adversarial-checklists-v1 -->

# Adversarial Review Checklists

Detailed checklists used by the `challenger-review-subagent` during adversarial passes.

## Azure Infrastructure Skepticism Surfaces

When challenging artifacts, be skeptical about:

- **Governance**: Does the plan rely on hardcoded tag lists or security settings instead of reading
  discovered Azure Policy constraints from `04-governance-constraints.json`?
- **AVM Modules**: Are resources planned with raw Bicep/Terraform when AVM modules exist?
- **Naming**: Do naming conventions follow CAF patterns from azure-defaults skill, or are they ad-hoc?
- **Region Availability**: Are all planned SKUs and services actually available in the target region?
- **WAF Balance**: Does the architecture over-optimize one WAF pillar at the expense of others?
- **Cost Estimates**: Are prices sourced from Azure Pricing MCP, or are they parametric guesses?
- **Security Baseline**: Is TLS 1.2 enforced? HTTPS-only? Managed identity over keys? Public access disabled?
- **Deployment Strategy**: Is a single deployment assumed for >5 resources? (Should be phased.)
- **Dependency Ordering**: Are resource dependencies acyclic and correct?
- **Compliance Gaps**: Do stated compliance requirements (PCI-DSS, SOC2, etc.) actually map to
  concrete controls in the architecture?

---

## Per-Category Checklists

For **every** artifact, ask:

### Governance & Compliance

- [ ] Does the artifact account for ALL Azure Policy constraints (not just a hardcoded subset)?
- [ ] Are required tags dynamic (from governance discovery) or hardcoded to the 4-tag baseline?
- [ ] If Deny policies exist, are they explicitly mapped to resource properties?
- [ ] Are compliance requirements (SOC2, PCI-DSS, ISO 27001) backed by concrete controls?
- [ ] Does the plan rely on features that might be blocked by subscription-level policies?

### Architecture & WAF

- [ ] Are all 5 WAF pillars addressed, or are some hand-waved?
- [ ] Is the SLA target achievable with the proposed architecture (single-region vs multi-region)?
- [ ] Are RTO/RPO targets backed by actual backup/replication configuration?
- [ ] Is the cost estimate realistic, or does it assume lowest-tier SKUs for production workloads?
- [ ] Are managed identities used everywhere, or do some resources still rely on keys/passwords?

### Implementation Feasibility

- [ ] Does every resource have a verified AVM module, or are some assumed?
- [ ] Are all planned SKUs available in the target region?
- [ ] Are resource dependencies acyclic and correctly ordered?
- [ ] Is the deployment strategy appropriate for the resource count?
- [ ] Are there circular dependencies or implicit ordering assumptions?

### Missing Pieces

- [ ] What happens if the deployment partially fails (rollback strategy)?
- [ ] Are Private Endpoints planned for all data-plane resources?
- [ ] Is monitoring/alerting defined, or just "planned for later"?
- [ ] Are diagnostic settings included for every resource?
- [ ] What networking assumptions remain unvalidated (VNet sizing, NSG rules, DNS)?

### Cost Monitoring (MANDATORY)

- [ ] Does the plan/code include an Azure Budget resource?
- [ ] Is the budget amount aligned to the Step 2 cost estimate?
- [ ] Are forecast alerts configured at 80%, 100%, and 120% thresholds?
- [ ] Is anomaly detection enabled?
- [ ] Are notification recipients parameterized (not hardcoded emails)?

### Repeatability (MANDATORY)

- [ ] Are ALL project-specific values parameterized (no hardcoded project/app names)?
- [ ] Can templates deploy to any tenant, region, subscription without source modification?
- [ ] Is `projectName` a required parameter with no default value?
- [ ] Are tag values derived from parameters (not inline strings)?
- [ ] Are short names derived from parameters or `take()` (not hardcoded)?

---

## Per-Artifact-Type Checklists

### Requirements-Specific (`artifact_type` = `requirements`)

- [ ] Are NFRs specific and measurable, or vague ("high availability")?
- [ ] Is the budget realistic for the stated requirements?
- [ ] Are there contradictory requirements (e.g., lowest cost + 99.99% SLA)?
- [ ] Are data residency and sovereignty requirements addressed?

### Governance-Constraints-Specific (`artifact_type` = `governance-constraints`)

- [ ] Were management group-inherited policies included (not just subscription-level)?
- [ ] Is the REST API policy count validated against Azure Portal total?
- [ ] Are `azurePropertyPath` values correct for each Deny policy?
- [ ] Are Deny vs Audit effects correctly classified?
- [ ] Are `DeployIfNotExists` auto-remediation resources documented?

### IaC-Code-Specific (`artifact_type` = `iac-code`)

- [ ] Does every resource in the implementation plan have corresponding code?
- [ ] Are all Deny policy constraints satisfied in resource configurations?
- [ ] Are AVM module parameters correct (no type mismatches)?
- [ ] Is the unique suffix generated once and passed to all modules?
- [ ] Are all governance-discovered tags applied (not just baseline 4)?
- [ ] Does phased deployment logic match the planned phases?

### Cost-Estimate-Specific (`artifact_type` = `cost-estimate`)

- [ ] Are all prices sourced from Azure Pricing MCP (not guessed)?
- [ ] Are egress, transaction, and log ingestion costs included?
- [ ] Do SKU selections match the stated workload requirements?
- [ ] Are free-tier limitations documented for production use?
- [ ] Does the monthly total match the sum of line items?

### Deployment-Preview-Specific (`artifact_type` = `deployment-preview`)

- [ ] Are any Destroy operations unexpected?
- [ ] Is the blast radius acceptable for the deployment scope?
- [ ] Is there a rollback strategy if deployment fails mid-way?
- [ ] Are phase boundaries correctly placed for phased deployments?
- [ ] Are deprecation signals present in the preview output?

---

## Lens: governance-reconciliation

`artifact_type` = `governance-constraints`. Single-pass lens run by
04g-Governance after policy discovery completes, to detect drift between
the approved architecture (Step 2) and the freshly discovered governance
constraints. Use as the **only** lens for Step 3.5 reconciliation review.

- [ ] Constraint-vs-architecture drift — does any Deny policy contradict
      an approved architecture decision (SKU, region, identity model)?
- [ ] Exemption gaps — does any in-scope resource type lack an explicit
      exemption or remediation path when blocked by Deny?
- [ ] Scope mismatch — are policy effects measured at the correct scope
      (subscription vs RG vs resource)? A subscription-scoped Deny still
      applies even if the RG was "scrubbed".
- [ ] Defender / built-in auto-assignments — are policies auto-applied by
      Microsoft Defender for Cloud treated as in-scope (they affect the
      plan) and not silently filtered out?
- [ ] Conflicting policy effects across MG inheritance — does an inherited
      MG policy with stricter effect override a more permissive sub-scope
      policy? Capture the effective (strictest) effect.
- [ ] Audit-vs-Deny mismatch — are Audit-only policies treated as no-ops
      when they should produce monitoring obligations / SIEM alerts?
- [ ] Missing parameter values — does any policy require parameters that
      are unbound, leaving effective behavior undefined?
- [ ] Exempt scope leaks — are exempt scopes still consuming resources
      that would otherwise be blocked? Are exemptions time-bounded?
- [ ] Region-restricted policies vs chosen region — does any
      `allowedLocations` policy exclude the planned primary or secondary
      region?
- [ ] Identity-policy gaps — does a "managed identity required" policy
      conflict with any approved architecture step that uses keys, shared
      access signatures, or local SQL auth?

---

## Lens: comprehensive (single-pass default)

Coverage bar: the comprehensive lens MUST cover ≥ 80 % of the must_fix
line items in the per-lens lists above for `architecture` and
`implementation-plan` artifact types. The items below explicitly retain
the high-impact must_fix patterns from each lens — do not drop them when
running a single-pass review.

### Comprehensive — `artifact_type` = `architecture`

Merged from `security-governance` + `architecture-reliability` +
`cost-feasibility` per-lens lists.

- [ ] **Private endpoints + DNS wiring** — every data-plane resource
      (Storage, Key Vault, SQL, Cosmos, ACR, MySQL/PostgreSQL) has a
      Private Endpoint AND the matching private DNS zone is linked to
      the consuming VNet.
- [ ] **Private-endpoint subnet sizing** — PE subnet has at least one
      free IP per resource currently planned PLUS headroom for the next
      6 months (typical recommendation: ≥ /27).
- [ ] **Public-network access** — all data services have
      `publicNetworkAccess = Disabled` for prod; any exception is
      called out with rationale.
- [ ] **Managed identity everywhere** — no Storage / SQL / Key Vault
      key or shared-access auth; all consumers use User-Assigned
      Managed Identity with least-privilege RBAC.
- [ ] **Encryption baseline** — TLS 1.2 minimum, HTTPS-only, CMK where
      required by compliance.
- [ ] **WAF balance** — no pillar over-optimized at expense of another
      (e.g., cheapest SKU defeats SLA, or 99.99 % SLA blows the
      budget).
- [ ] **SLA feasibility** — the composite SLA from declared services in
      the chosen topology meets the stated target (multi-region is
      explicit when needed).
- [ ] **RTO / RPO arithmetic vs backup retention** — backup retention
      and replication frequency mathematically permit the stated RTO
      and RPO; cross-check backup vault SKU + LRS/GRS choice.
- [ ] **Failure mode + SPOF** — every component has a redundancy story
      (zone-redundant SKU, paired-region replication, queueing in front
      of single instances).
- [ ] **Cost — pricing source** — every line item references a price
      pulled from Azure Pricing MCP, not a guessed dollar amount.
- [ ] **Cost — RI / Savings-Plan math** — for compute resources running
      ≥ 730 hours / month, 1-year Reserved Instance or Savings Plan
      math is shown (% saving + breakeven) OR an explicit "pay-as-you-go
      is intentional because …" note is attached.
- [ ] **Cost — 02-cost-estimate.json baseline reconciliation** —
      monthly total in the architecture matches the line-item sum in
      `02-cost-estimate.json`. No drift > 5 % without an explanation.
- [ ] **Governance compliance** — every Deny policy in
      `04-governance-constraints.json` is reflected in an architecture
      decision (or an exemption is explicitly noted).
- [ ] **Dependencies acyclic** — resource graph has no cycles; ordering
      is explicit where it matters (e.g., VNet → PE → resource).
- [ ] **Monitoring + alerts** — diagnostic settings are planned for
      every resource AND budget / cost-anomaly alerts are configured.
- [ ] **Repeatability** — `projectName`, region, environment are
      parameters; no hardcoded names.

### Comprehensive — `artifact_type` = `implementation-plan`

Merged from `security-governance` + `architecture-reliability` +
`cost-feasibility` per-lens lists.

- [ ] **Plan ↔ governance mapping** — every Deny policy maps to an
      explicit resource property in the plan's Governance Compliance
      Matrix.
- [ ] **Plan ↔ architecture mapping** — every resource in
      `02-architecture-assessment.md` has a corresponding row in the
      plan (no silent drops, no silent additions).
- [ ] **AVM module versions pinned to latest stable** — every module
      reference cites the **latest published stable version** at plan
      time, NOT `latest`/`main`, NOT a version copied from
      `azure-defaults/references/avm-modules.md`, NOT a version reused
      from a prior project. Resolve via MCR (Bicep) or
      `registry.terraform.io` (Terraform). Stale pins are accepted ONLY
      when the contract entry has a `pin_policy.mode = "exception"`
      block with `rationale`, `evidence_url_or_file`, and a future
      `review_after` date. Pins >90 days behind the latest stable
      without that exception block are an automatic must_fix. Validator:
      `npm run validate:avm-versions:freeze`.
- [ ] **Private endpoints + DNS** — every PE listed in the architecture
      appears in the plan with `privateLinkServiceConnections` AND a
      DNS-zone-group entry.
- [ ] **PE subnet sizing** — plan declares PE subnet CIDR with capacity
      for current + 6-month headroom.
- [ ] **Managed identity wiring** — every consumer→target pair has a
      role assignment ID listed; no leftover keys in the plan.
- [ ] **Backup / DR plan vs RTO / RPO** — the plan's backup retention,
      replication, and failover configuration mathematically supports
      the architecture's stated RTO / RPO targets.
- [ ] **Phased deployment** — for >5 resources or any data-plane
      service, the plan uses phased deployment with explicit phase
      ordering (foundation → security → data → compute → app → ops).
- [ ] **Cost monitoring** — plan includes a `Microsoft.Consumption/budgets`
      resource with thresholds at 80 %, 100 %, 120 % and parameterized
      recipients.
- [ ] **Cost — RI / Savings-Plan math** — same rule as architecture
      lens; quantitative saving + breakeven calculation is shown for
      eligible workloads.
- [ ] **Cost — 02-cost-estimate.json reconciliation** — the plan's
      total reconciles with `02-cost-estimate.json` (≤ 5 % drift
      without explanation).
- [ ] **SKU availability per region** — every SKU declared in the plan
      is available in the chosen primary region (and secondary, if
      multi-region).
- [ ] **Diagnostic settings** — every resource in the plan has a
      `Microsoft.Insights/diagnosticSettings` reference with
      `logAnalyticsDestinationType` set.
- [ ] **Repeatability** — `projectName` is a required parameter (no
      default value); tag values derive from parameters; unique suffix
      is generated once and passed.
- [ ] **CodeGen contract present** — the plan declares the
      Code-Generation Contract H2 and lists frozen inputs.
