---
applyTo: "**/04-governance-constraints.md, **/04-governance-constraints.json"
description: "MANDATORY Azure Policy discovery requirements for governance constraints"
---

# Governance Discovery Instructions

**CRITICAL**: Governance constraints MUST be discovered from the live Azure
environment, NOT assumed from best practices.
**GATE**: This is a mandatory gate. If Azure connectivity fails or policies
cannot be retrieved, STOP and inform the user.
Do NOT generate governance constraints from assumptions.

## Why This Matters

Assumed governance constraints cause deployment failures. Example:

- **Assumed**: 4 tags required (Environment, ManagedBy, Project, Owner)
- **Actual**: 9 tags required via Azure Policy
- **Result**: Deployment denied by Azure Policy

**Management group-inherited policies are invisible to basic queries.**
Use REST API (not `az policy assignment list`) to capture all inherited policies.

## Discovery Is Delegated to Subagent

The `governance-discovery-subagent` handles all procedural work:

1. Verifies Azure connectivity via ARM token
2. Queries ALL policy assignments via REST API (including MG-inherited)
3. Drills into Deny/DeployIfNotExists definitions to verify actual impact
4. Classifies effects and returns a structured report

See `.github/agents/_subagents/governance-discovery-subagent.agent.md` for the complete
discovery procedure, REST API commands, and output format.

## Fail-Safe: If Discovery Fails

If the subagent returns PARTIAL or FAILED status:

1. **STOP** — Do NOT proceed to implementation planning
2. Document the failure in the governance constraints file
3. Mark all constraints as "UNVERIFIED - Query Failed"
4. Add warning: "GATE BLOCKED: Deployment CANNOT proceed"
5. **Do NOT generate assumed/best-practice policies as a fallback**

## Deep Reference

For policy effect decision trees, plan adaptation examples, validation
checklists, anti-patterns, and file format schema, read:
`.github/instructions/references/governance-discovery-reference.md`

## Downstream Enforcement

Discovered policies do not stop at documentation — they MUST flow through
to the Code Generator and review subagent:

1. Code Generators (Phase 1.5) read `04-governance-constraints.json`
   and build a compliance map before writing any code
2. Review subagents verify every Deny policy constraint is satisfied
3. Both require `bicepPropertyPath`, `azurePropertyPath`, and
   `requiredValue` fields in the JSON for programmatic verification

See `.github/instructions/references/iac-policy-compliance.md` for the
full enforcement mandate.
