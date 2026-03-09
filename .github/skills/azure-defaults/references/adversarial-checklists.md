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
