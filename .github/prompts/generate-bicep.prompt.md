---
description: "Generate production-ready Bicep templates from the implementation plan"
agent: "Bicep Code"
model: "GPT-5.3-Codex"
tools:
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
  - agent
  - bicep/list_avm_metadata
  - bicep/get_az_resource_type_schema
  - bicep/get_bicep_file_diagnostics
  - bicep/format_bicep_file
argument-hint: Provide the project name to generate Bicep templates for
---

# Generate Bicep Templates

Implement production-ready Bicep templates from the implementation plan,
using Azure Verified Modules, security baselines, and automated validation.

## Mission

Read the implementation plan, run a preflight check against AVM schemas,
progressively generate Bicep modules, create a deployment script, validate
with lint and review subagents, and produce an implementation reference.

## Scope & Preconditions

- `agent-output/${input:projectName}/04-implementation-plan.md` must exist
- `agent-output/${input:projectName}/04-governance-constraints.md` must exist
- Read `.github/skills/azure-defaults/SKILL.md` for naming, tags, AVM, security
- Read `.github/skills/azure-artifacts/SKILL.md` for template H2 structure
- Templates saved to `infra/bicep/${input:projectName}/`

## Inputs

| Variable               | Description                                      | Default  |
| ---------------------- | ------------------------------------------------ | -------- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |

## Workflow

### Step 1: Preflight Check

Before writing ANY Bicep code:

1. Read `04-implementation-plan.md` for resource inventory
2. Read `04-governance-constraints.md` for policy adaptations
3. Query AVM metadata for each planned resource
4. Cross-check planned parameters against AVM schemas
5. Document findings in `agent-output/{projectName}/04-preflight-check.md`

### Step 2: Progressive Implementation

Generate templates following dependency order from the plan:

1. **main.bicep** — orchestrator with `uniqueSuffix` variable, parameters,
   conditional phase deployment (if phased strategy)
2. **main.bicepparam** — parameter file for default environment
3. **modules/** — one module per resource, AVM-first approach
4. Apply to ALL resources:
   - Required tags: `Environment`, `ManagedBy`, `Project`, `Owner`
   - Security baseline: TLS 1.2, HTTPS-only, managed identity
   - CAF naming conventions with `take()` for length constraints

### Step 3: Deployment Script

Generate `deploy.ps1` PowerShell script with:

- Parameter validation
- Resource group creation
- What-if analysis option
- Phased deployment support (if applicable)
- Error handling and rollback guidance

### Step 4: Validation

1. Run `bicep build main.bicep` — fix any errors
2. Run `bicep lint main.bicep` — fix any warnings
3. Invoke `bicep-lint-subagent` for automated validation
4. Invoke `bicep-review-subagent` for AVM standards review

### Step 5: Generate Reference

Save `agent-output/{projectName}/05-implementation-reference.md` with:

- File structure overview
- Module inventory with AVM versions
- Parameter documentation
- Validation results

## Output Expectations

```text
infra/bicep/{projectName}/
├── main.bicep
├── main.bicepparam
├── modules/
│   ├── {resource1}.bicep
│   ├── {resource2}.bicep
│   └── ...
└── deploy.ps1
```

## Quality Assurance

- [ ] AVM modules used for every resource that has one
- [ ] `uniqueSuffix` generated once, passed to all modules
- [ ] All 4 required tags applied to every resource
- [ ] Security baseline enforced (TLS 1.2, HTTPS-only, managed identity)
- [ ] `bicep build` passes with zero errors
- [ ] `bicep lint` passes with zero warnings
- [ ] No deprecated settings (e.g., `APPINSIGHTS_INSTRUMENTATIONKEY`)
- [ ] No hyphens in Storage Account names
