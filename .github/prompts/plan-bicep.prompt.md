---
description: "Create a Bicep implementation plan with governance discovery"
agent: "Bicep Plan"
model: "Claude Opus 4.6"
tools:
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
  - bicep/list_avm_metadata
  - bicep/get_az_resource_type_schema
argument-hint: Provide the project name to plan implementation for
---

# Plan Bicep Implementation

Create a comprehensive, machine-readable implementation plan by discovering
governance constraints, verifying AVM module availability, and designing the
complete Bicep template structure.

## Mission

Read the architecture assessment, run mandatory governance discovery via
Azure REST API, verify AVM modules for every resource, check for service
deprecations, and produce a structured implementation plan with deployment
strategy.

## Scope & Preconditions

- `agent-output/${input:projectName}/02-architecture-assessment.md` must exist
- Azure CLI must be authenticated (`az account show`)
- Read `.github/skills/azure-defaults/SKILL.md` for governance discovery patterns
- Read `.github/skills/azure-artifacts/SKILL.md` for template H2 structure
- Governance discovery is a **hard gate** — cannot proceed without policy data

## Inputs

| Variable               | Description                                      | Default  |
| ---------------------- | ------------------------------------------------ | -------- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |

## Workflow

### Step 1: Prerequisites Check

1. Verify Azure CLI authentication: `az account show`
2. Read `02-architecture-assessment.md` for resource list and SKUs
3. Read `01-requirements.md` for compliance context

### Step 2: Governance Discovery (MANDATORY GATE)

Use REST API (not just `az policy assignment list`) to discover ALL
policies including management group-inherited ones:

```bash
az rest --method GET \
  --url "/subscriptions/{subId}/providers/Microsoft.Authorization/policyAssignments?api-version=2022-06-01"
```

Classify each policy by effect: `Deny` = blocker, `Audit` = warning.

### Step 3: AVM Module Verification

For EACH resource in the architecture:

1. Query `bicep/list_avm_metadata` for AVM availability
2. If AVM exists: note module path and required parameters
3. If no AVM: plan raw Bicep resource definition
4. Check for known AVM parameter type mismatches

### Step 4: Deprecation Check

Research deprecation status for non-AVM resources and any
custom SKU selections that override AVM defaults.

### Step 5: Deployment Strategy

Ask user to choose (phased recommended for >5 resources):

- **Phased deployment** — resources grouped by dependency
- **Single deployment** — all resources in one operation

### Step 6: Generate Artifacts

Save to `agent-output/{projectName}/`:

- `04-implementation-plan.md` — resource inventory, module structure,
  deployment phases, parameter specifications
- `04-dependency-diagram.py` + `04-dependency-diagram.png` — Step 4 dependency view
- `04-runtime-diagram.py` + `04-runtime-diagram.png` — Step 4 runtime-only flow view
- `04-governance-constraints.md` — discovered policies and adaptations
- `04-governance-constraints.json` — machine-readable policy data

## Output Expectations

Implementation plan must include YAML-structured task specifications
for each resource with: module reference, dependencies, parameters,
and deployment phase assignment.

## Quality Assurance

- [ ] Governance discovery completed via REST API (not CLI alone)
- [ ] Every resource has AVM verification result
- [ ] Deny-effect policies have explicit adaptations documented
- [ ] Deployment strategy confirmed by user
- [ ] All H2 headings match azure-artifacts template
- [ ] Required tags documented (Environment, ManagedBy, Project, Owner)
