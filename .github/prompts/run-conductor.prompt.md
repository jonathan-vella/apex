---
description: "Run the full 7-step Azure infrastructure workflow end-to-end"
agent: "InfraOps Conductor"
model: "Claude Opus 4.6"
tools:
  - agent
  - edit/createFile
  - edit/editFiles
  - read/readFile
  - search/listDirectory
  - execute/runInTerminal
  - vscode/askQuestions
argument-hint: Describe the Azure infrastructure project you want to build
---

# Run InfraOps Conductor — End-to-End Workflow

Orchestrate the complete 7-step Azure infrastructure development workflow
for a new project, delegating to specialized agents with mandatory human
approval gates between each step.

## Mission

Guide a project from business description through deployed, documented
infrastructure using the full agent pipeline: Requirements → Architect →
Design → Bicep Plan → Bicep Code → Deploy → As-Built Documentation.

## Scope & Preconditions

- User describes their project in business terms or technical terms
- All artifacts are saved to `agent-output/${input:projectName}/`
- Bicep templates are saved to `infra/bicep/${input:projectName}/`
- Each step produces artifacts that feed the next step
- NEVER proceed past an approval gate without explicit user confirmation

## Inputs

| Variable                      | Description                                       | Default  |
| ----------------------------- | ------------------------------------------------- | -------- |
| `${input:projectName}`        | Project name (kebab-case)                         | Required |
| `${input:projectDescription}` | Business or technical description of the workload | Required |

## Workflow

### Step 1: Requirements

Delegate to **Requirements** agent with the project description.
Wait for `01-requirements.md` to be generated.

**APPROVAL GATE**: Present requirements summary. Wait for user confirmation.

### Step 2: Architecture Assessment

Delegate to **Architect** agent to review requirements and produce
WAF assessment with cost estimates.

**APPROVAL GATE**: Present WAF scores and cost summary. Wait for confirmation.

### Step 3: Design Artifacts (Optional)

Ask user if they want architecture diagrams and/or ADRs.
If yes, delegate to **Design** agent.
If no, skip to Step 4.

### Step 4: Implementation Planning

Delegate to **Bicep Plan** agent for governance discovery and
implementation planning.

**APPROVAL GATE**: Present governance findings and plan summary. Wait for confirmation.

### Step 5: Bicep Code Generation

Delegate to **Bicep Code** agent to generate templates from the plan.

**VALIDATION GATE**: Verify `bicep build` and `bicep lint` pass.

### Step 6: Deployment

Delegate to **Deploy** agent for what-if analysis and deployment.

**APPROVAL GATE**: Present what-if summary. Wait for explicit deploy approval.

### Step 7: As-Built Documentation

Delegate to **Deploy** agent (documentation mode) to generate the
`07-*.md` documentation suite.

## Output Expectations

```text
agent-output/{projectName}/
├── 01-requirements.md
├── 02-architecture-assessment.md
├── 03-des-cost-estimate.md
├── 03-des-diagram.py          (if Step 3 selected)
├── 03-des-adr-*.md            (if Step 3 selected)
├── 04-governance-constraints.md
├── 04-implementation-plan.md
├── 04-dependency-diagram.py
├── 04-dependency-diagram.png
├── 04-runtime-diagram.py
├── 04-runtime-diagram.png
├── 04-preflight-check.md
├── 05-implementation-reference.md
├── 06-deployment-summary.md
├── 07-*.md                    (documentation suite)
└── README.md

infra/bicep/{projectName}/
├── main.bicep
├── main.bicepparam
├── modules/
└── deploy.ps1
```

## Quality Assurance

Before completing each step, verify:

- [ ] Artifact file exists and follows the H2 template from azure-artifacts skill
- [ ] No stale references to previous steps
- [ ] User has explicitly approved at each gate
- [ ] All validation commands pass before proceeding
