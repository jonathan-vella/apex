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
- [ ] **Approval block present and populated** (issue #425): five-line
      block with `creates`/`modifies`/`deletes`, `destructive`,
      `deploy_gate`, `cost_delta` vs envelope, and a `decision:` gate.
      Persisted to `06-deploy-approval.json` conforming to
      `deployment-preview-v1`.
- [ ] **Retry loop bounded ≤3 with named escalation options** (issue #425):
      every retry path (governance, what-if/plan, validate, deploy) caps
      at 3 attempts and escalates with `proceed-with-substitute` /
      `change-region` / `abort`. Flag unbounded loops as `must_fix`.
- [ ] **Step boundaries use `apex-recall transition`** (issue #425,
      post-merge audit): when a workflow run hands off between steps
      AND records decisions at the same boundary, the agent invoked
      `apex-recall transition` (single atomic write). A chained
      `decide && checkpoint && complete-step` at a boundary is a
      `should_fix` — those are separate writes and can drift on crash.
      Standalone `complete-step` (no decisions, no next-step start)
      remains valid.

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
- [ ] **D-V1 VNet trigger honored** — when the trigger contract holds
      (any `services[].requires[] ∈ {vnet-integration, private-endpoints}`
      OR any `services[].service_name` in the vnet-attached whitelist
      in [`vnet-planning.md`](vnet-planning.md)), the plan emits a
      VNet resource OR references an existing one via `existing_vnet_id`
      with a verified live address space.
- [ ] **D-V2 Address space valid** — `vnet_address_space` is at least
      `/22`; subnet CIDRs are non-overlapping and all inside
      `vnet_address_space`; **5 Azure-reserved IPs** accounted for per
      subnet (network, default gateway, two DNS, broadcast).
- [ ] **D-V3 Subnet sizing per SKU** — every subnet meets the per-SKU
      (min, recommended) row in
      [`vnet-planning.md`](vnet-planning.md#subnet-sizing-matrix).
      Specifically: App Gateway v2 ≥ `/26`, APIM stv2 ≥ `/28` (single) /
      `/27` (multi), AKS Azure CNI Overlay ≥ formula result, PE ≥ `/29`,
      App Service VNet integration ≥ `/28`, Bastion ≥ `/26` (any SKU),
      Firewall `/26`, Gateway ≥ `/27`.
- [ ] **D-V4 Reserved subnet names** — `AzureBastionSubnet` /
      `AzureFirewallSubnet` / `GatewaySubnet` / `RouteServerSubnet`
      only emitted when the respective resource is in scope; names use
      exact case-sensitive form.
- [ ] **D-V5 Governance precedence honored** — when
      `04-governance-constraints.json` `network_constraints` declares
      allowed address ranges, required subnet names, mandatory
      NSG/UDR, or no-public-IP, every plan element conforms; conflicts
      surface as `must_fix` reconciliation findings from
      04g-Governance.
- [ ] **D-V6 Deprecated services flagged** — if `subnet_plan` infers
      AKS kubenet (or any service in
      [`deprecated-services.md`](deprecated-services.md)), a
      `should_fix` finding is emitted with the retirement date.
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
      without that exception block are an automatic must_fix. Validators:
      `npm run validate:avm-versions:freeze` (contract JSON) **and**
      `npm run validate:plan-avm-pins` (plan markdown).
      **Enumeration requirement (anti partial-fix loop)**: when this
      rule triggers, the finding's `verification_anchors[]` MUST list
      every location the rule applies to in the plan, not just the
      first match. For implementation-plan artifacts that includes:
      (1) the Resource Inventory table, (2) the Module Structure table,
      (3) **every `avm:` line inside the YAML blocks under Implementation
      Tasks** (typically 15–25 occurrences), and (4) the
      `modules.bicep[].version` / `modules.terraform[].version` arrays
      in `04-iac-contract.json`. The same enumeration discipline
      applies to **diagnostic settings** (every resource that supports
      them — KV, Storage, SQL, App Service, networking — not just App
      Service) and **`publicNetworkAccess: Disabled`** (every
      data-plane resource that supports it).
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
- [ ] **D-1 Cost monitoring — budget present** — plan emits a
      Consumption Budget resource (`Microsoft.Consumption/budgets`
      Bicep / `azurerm_consumption_budget_{rg,subscription,management_group}`
      TF) at the Planner-declared `cost_monitoring_scope`. Skipped
      only when `cost_monitoring_mode = deferred` (and D-7 verified).
- [ ] **D-2 Cost monitoring — threshold contract** — notification
      count is ≤5 and matches the contract: Actual 80% / 100% / 125%
      + Forecast 100% / 125% (or the discovered governance override
      in `04-governance-constraints.json` `cost_monitoring.thresholds`).
- [ ] **D-3 Cost monitoring — recipient routing** — when
      `cost_monitoring_mode ≠ minimal`, every notification block
      carries both `contactRoles: ["Owner"]` AND `contactGroups:
      [<actionGroupId>]` (Bicep) / `contact_roles` + `contact_groups`
      (TF). When no human RBAC `Owner` exists at the scope, the
      Owner-role fallback is satisfied (`cost_alert_emails` non-empty
      AND Action Group has email receivers).
- [ ] **D-4 Cost monitoring — Action Group mode** —
      `decisions.cost_action_group_mode ∈ {create, existing}` is set
      and the IaC matches: `existing` ⇒ Bicep `existing` keyword or
      TF `data "azurerm_monitor_action_group"`, both reading the
      `existing_action_group_id`. `create` ⇒ AVM module emits the AG
      with one email receiver per `cost_alert_emails[]` entry.
- [ ] **D-5 Cost monitoring — anomaly contract** — Bicep plan emits
      `Microsoft.CostManagement/scheduledActions` (kind
      `InsightAlert`, subscription-scoped, with `properties.viewId`,
      `properties.notification.to = cost_alert_emails`, and
      `properties.notificationEmail`); Terraform plan emits
      `azurerm_cost_anomaly_alert` (subscription-scoped only, with
      `email_addresses = cost_alert_emails`). RG-scope anomaly is
      not expected (deferred).
- [ ] **D-5a Cost monitoring — Bicep InsightAlert provider
      constraints** (Bicep stack only; provider rejects at
      what-if). All four must hold:
      1. The module hosting `scheduledActions` declares
         `targetScope = 'subscription'` and is called with
         `scope: subscription()` from `main.bicep` — never nested
         inside an RG-scoped module.
      2. `properties.displayName` is ≤ 25 characters when fully
         interpolated (verify against the resolved `project` /
         `environment` values, not the template literal).
      3. `properties.viewId` is a subscription-scope built-in
         (`ms:DailyAnomalyByResource`,
         `ms:DailyAnomalyBySubscription`, or `MS-DailyCosts`).
         RG-scope views (e.g. `ms:DailyAnomalyByResourceGroup`) are
         rejected.
      4. `schedule.startDate` and `schedule.endDate` are UTC
         midnight (`T00:00:00Z`) and `endDate − startDate` ≤ 1 year.
         Hard-coded far-future dates (`2099-…`, `2036-…` with
         non-midnight time) are rejected. Prefer
         `utcNow('yyyy-MM-dd')` + `dateTimeAdd(..., 'P1Y', ...)`.
      Cite `cost-alerts-bicep.md` §6 hard prerequisites.
- [ ] **D-6 Cost monitoring — governance precedence** — any value in
      `04-governance-constraints.json` `cost_monitoring.*` (thresholds,
      required_scope, required_action_group_id, min_emails,
      deferred_allowed) is reflected in the plan; merge is faithful.
- [ ] **D-7 Cost monitoring — deferred exception** — when
      `cost_monitoring_mode = deferred`, the plan's exceptions
      section carries a `cost_monitoring_exception` record with
      non-empty `rationale` and a future `expiry_date` (YYYY-MM-DD).
      Environment must be `dev` or `sandbox`; reject for `prod` or
      `staging`.
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
