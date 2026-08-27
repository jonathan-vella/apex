<!-- ref:artifact-type-categories-v1 -->

# Additional Analysis Categories by Artifact Type

Extended analysis categories used by the `challenger-review-subagent` when the artifact type
provides domain-specific risk dimensions beyond the 7 core categories.

---

## `governance-constraints`

- Were ALL Azure Policies discovered (including management group-inherited)?
- Are `azurePropertyPath` translations correct for each Deny policy?
- Is the Deny vs Audit effect properly identified and classified?
- Are tag requirements complete (not just baseline 4)?
- Are `DeployIfNotExists` and `Modify` policies documented for downstream awareness?

## `iac-code`

- **Plan-to-code drift**: resources in the implementation plan but missing in code
- **Security hardening gaps**: governance constraints not reflected in resource properties
- **AVM module parameter correctness**: do parameter values match the module schema?
- **Naming convention violations**: CAF patterns not followed
- **Unique suffix strategy**: is `uniqueString()` / `random_string` generated once and shared?
- **Tag completeness**: are governance-discovered tags applied to all resources?
- **Deployment phase correctness**: does conditional logic match the planned phases?

## `cost-estimate`

- **Consumption assumptions**: are usage projections realistic or optimistic?
- **Hidden costs**: egress charges, transaction fees, log ingestion volume, IP addresses
- **SKU-to-requirement mismatch**: over/under-provisioned SKUs for the stated workload
- **Free-tier production risk**: features or limits that don't scale to production
- **Missing line items**: services in architecture but absent from cost estimate
- **Price source verification**: are figures from Azure Resource Manager MCP or guessed?

## `deployment-preview`

- **Blast radius**: how many resources change? What's the rollback strategy?
- **Resource deletion risks**: any unexpected Destroy operations?
- **Dependency ordering**: will resources deploy in the correct order?
- **Phase boundary correctness**: are phase gates in the right places?
- **State drift**: does the plan output match expected infrastructure?
