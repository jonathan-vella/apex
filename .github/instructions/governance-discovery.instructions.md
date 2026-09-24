---
applyTo: "**/04-governance-constraints.md, **/04-governance-constraints.json"
description: "MANDATORY Azure Policy discovery requirements for governance constraints"
---

# Governance Discovery Instructions

**CRITICAL**: Governance constraints MUST come from the live Azure environment —
either directly through `discover.py` during the current run, or indirectly
through the approved scheduled workflow baseline generated from live Azure and
committed under `.github/data/governance-policy-baseline.json.gz`.
**GATE**: This is a mandatory gate. If Azure connectivity fails or policies
cannot be retrieved during live discovery, STOP and inform the user.
Do NOT generate governance constraints from assumptions.
Do NOT accept arbitrary static files as governance input — only the approved
workflow output file (`.github/data/governance-policy-baseline.json.gz`) is valid
for cached baseline mode.

## Why This Matters

Assumed governance constraints cause deployment failures. Example:

- **Assumed**: 4 tags required (Environment, ManagedBy, Project, Owner)
- **Actual**: 9 tags required via Azure Policy
- **Result**: Deployment denied by Azure Policy

**Management group-inherited policies are invisible to basic queries.**
Use REST API (not `az policy assignment list`) to capture all inherited policies.

## Discovery Runs Through discover.py

`04g-Governance` runs the deterministic
[`discover.py`](../skills/apex-azure-governance-discovery/SKILL.md) (live) or
`render_cached_governance.py` (approved baseline). The script verifies ARM
connectivity, queries all effective assignments via REST (including
MG-inherited), drills into Deny/DeployIfNotExists definitions, classifies
effects and writes `04-governance-constraints.json`. Do not re-create or
hand-populate that file.

The authoritative output contract is
[`tools/schemas/governance-constraints.schema.json`](../../tools/schemas/governance-constraints.schema.json)
and the skill's [field reference](../skills/apex-azure-governance-discovery/references/schema.md).

## Fail-Safe: If Discovery Fails

If the envelope's `discovery_status` is PARTIAL or FAILED, or the script exits non-zero:

1. **STOP** — Do NOT proceed to implementation planning
2. Document the failure in the governance constraints file
3. Mark all constraints as "UNVERIFIED - Query Failed"
4. Add warning: "GATE BLOCKED: Deployment CANNOT proceed"
5. **Do NOT generate assumed/best-practice policies as a fallback**

## Deep Reference

For misleading policy names, plan adaptation examples, the validation
checklist, anti-patterns and the mandatory Discovery Source section, read:
`.github/instructions/references/governance-discovery-reference.md`

## Downstream Enforcement

Discovered policies do not stop at documentation — they MUST flow through
to the Code Generator and validation subagents:

1. Code Generators (Phase 1.5) read `04-governance-constraints.json`
   and build a compliance map before writing any code
2. Review subagents verify every Deny policy constraint is satisfied
3. Both require `bicepPropertyPath`, `azurePropertyPath`, and
   `requiredValue` fields in the JSON for programmatic verification

See `.github/instructions/references/iac-policy-compliance.md` for the
full enforcement mandate.
