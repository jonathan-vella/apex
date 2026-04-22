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

Discovery runs inside an isolated subagent invoked via `#runSubagent`. The
subagent:

1. Verifies Azure connectivity via ARM token
2. Queries ALL policy assignments via REST API (including MG-inherited)
3. Drills into Deny/DeployIfNotExists definitions to verify actual impact
4. Classifies effects and returns a structured report

The authoritative output contract is defined in
[`tools/schemas/governance-constraints.schema.json`](../../tools/schemas/governance-constraints.schema.json).

> **DO NOT** read the subagent's `.agent.md` file into the parent agent's
> context. Doing so defeats context isolation and causes the parent to execute
> the subagent's internal script inline instead of delegating. Treat the
> subagent as opaque — interact with it only via `#runSubagent`.

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
