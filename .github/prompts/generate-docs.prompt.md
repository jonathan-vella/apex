---
description: 'Generate as-built workload documentation suite (Step 7)'
agent: 'Deploy'
model: 'GPT-5.3-Codex'
tools:
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
argument-hint: Provide the project name to generate documentation for
---

# Generate As-Built Documentation

Produce the comprehensive Step 7 documentation suite for a deployed Azure
workload, covering design, operations, cost, compliance, disaster recovery,
and resource inventory.

## Mission

Read all existing project artifacts (Steps 1-6) and deployed resource state,
then generate the complete `07-*.md` documentation suite following the
azure-artifacts skill templates.

## Scope & Preconditions

- `agent-output/${input:projectName}/06-deployment-summary.md` must exist
  (project must be deployed)
- Read `.github/skills/azure-defaults/SKILL.md` for configuration
- Read `.github/skills/azure-artifacts/SKILL.md` for template H2 structures
- Read all prior artifacts for context (01 through 06)
- Optionally query Azure Resource Graph for live resource state

## Inputs

| Variable | Description | Default |
| --- | --- | --- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |

## Workflow

### Step 1: Gather Context

Read all existing artifacts in `agent-output/{projectName}/`:

- `01-requirements.md` — business context, NFRs, compliance
- `02-architecture-assessment.md` — WAF scores, service recommendations
- `04-implementation-plan.md` — resource inventory, deployment strategy
- `05-implementation-reference.md` — template structure, validation results
- `06-deployment-summary.md` — deployed resources, endpoints

### Step 2: Query Live State (Optional)

If Azure CLI is authenticated, query Resource Graph for current
resource state, configuration, and health status.

### Step 3: Generate Documentation Suite

Create each document following the corresponding azure-artifacts template:

| File | Content |
| --- | --- |
| `07-design-document.md` | Architecture overview, component details, data flow |
| `07-operations-runbook.md` | Monitoring, alerting, scaling, incident response |
| `07-ab-cost-estimate.md` | Actual deployed cost vs. estimated cost |
| `07-compliance-matrix.md` | Control mapping to compliance frameworks |
| `07-backup-dr-plan.md` | Backup schedule, RTO/RPO validation, DR procedures |
| `07-resource-inventory.md` | All deployed resources with IDs, SKUs, config |
| `07-documentation-index.md` | Index of all project artifacts with descriptions |

### Step 4: Generate As-Built Diagram (Optional)

If requested, invoke the Design agent to generate an as-built
architecture diagram saved as `07-ab-diagram.py`.

## Output Expectations

```text
agent-output/{projectName}/
├── 07-design-document.md
├── 07-operations-runbook.md
├── 07-ab-cost-estimate.md
├── 07-compliance-matrix.md
├── 07-backup-dr-plan.md
├── 07-resource-inventory.md
├── 07-documentation-index.md
└── 07-ab-diagram.py           (optional)
```

## Quality Assurance

- [ ] All 7 documentation files generated
- [ ] Each file follows the H2 template from azure-artifacts skill
- [ ] Attribution headers match template pattern
- [ ] Resource inventory matches deployment summary
- [ ] Compliance matrix maps controls to specific Azure configurations
- [ ] Operations runbook includes actionable commands (not placeholders)
- [ ] Documentation index references all project artifacts
