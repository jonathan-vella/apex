---
description: "Gather Azure workload requirements through interactive discovery"
agent: "Requirements"
model: "Claude Opus 4.6"
tools:
  - edit/createFile
  - edit/editFiles
  - vscode/askQuestions
---

# Plan Requirements

Conduct an interactive requirements discovery session for a new Azure workload.
Guide the user through the 5-phase discovery flow using UI question pickers
and produce a complete `01-requirements.md` artifact.

## Mission

Discover and capture comprehensive Azure workload requirements by asking
targeted questions in sequence — first understanding business context,
then detecting workload patterns, recommending services, and confirming
security posture before generating the artifact.

## Scope & Preconditions

- User has a project concept but may not have documented requirements
- Output will be saved to `agent-output/${input:projectName}/01-requirements.md`
- Follow the template structure from `.github/templates/01-requirements.template.md`
- Use the Service Recommendation Matrix from `_shared/defaults.md`

## Inputs

| Variable               | Description                             | Default  |
| ---------------------- | --------------------------------------- | -------- |
| `${input:projectName}` | Project name (kebab-case)               | Required |
| `${input:projectType}` | Web App, API, Data Platform, IoT, AI/ML | Web App  |

## Workflow

Follow the agent's 5-phase interactive discovery flow:

### Phase 1: Business Discovery

Use `askQuestions` UI to gather:

1. **Project name** — kebab-case identifier
2. **Business problem** — what this workload solves
3. **Target environments** — dev, staging, prod
4. **Timeline** — target go-live date

### Phase 2: Workload Pattern Detection

Use `askQuestions` UI to identify:

1. **Workload pattern** — Static Site, N-Tier, API-First, Serverless, Data Platform, IoT
2. **Expected user scale** — concurrent users
3. **Monthly budget** — approximate Azure spend
4. **Data sensitivity** — public, confidential, PII, PCI, HIPAA

### Phase 3: Service Recommendations

Based on pattern + budget, use `askQuestions` UI to present:

1. **Service tier options** — Cost-Optimized / Balanced / Enterprise from the matrix
2. **SLA target** — 99.0% to 99.99%
3. **Recovery targets** — RTO/RPO combinations
4. **N-Tier layers** (if applicable) — frontend, API, workers, DB, cache, queue

### Phase 4: Security & Compliance Posture

Use `askQuestions` UI for:

1. **Compliance frameworks** — GDPR, SOC 2, PCI-DSS, HIPAA, ISO 27001, None
2. **Security controls** — recommended controls with user confirmation
3. **Authentication method** — Entra ID, B2C, third-party, API keys
4. **Deployment region** — swedencentral (default) or alternatives

### Phase 5: Draft & Confirm

1. Run research subagent for additional Azure context
2. Generate `01-requirements.md` with all sections populated from Phases 1-4
3. Present draft for user review
4. Iterate on feedback until approved

## Output Expectations

Generate `agent-output/{projectName}/01-requirements.md` with:

1. All H2 sections from the template populated
2. `### Architecture Pattern` subsection with selected workload + service tier
3. `### Recommended Security Controls` subsection with confirmed controls
4. Summary section ready for architecture assessment handoff

### File Structure

```text
agent-output/{projectName}/
├── 01-requirements.md    # Generated requirements document
└── README.md             # Project folder README
```

## Quality Assurance

Before completing, verify:

- [ ] All 5 discovery phases completed
- [ ] Project name follows naming convention
- [ ] Workload pattern identified and service tier selected
- [ ] SLA/RTO/RPO specified
- [ ] Security controls confirmed by user
- [ ] Compliance requirements identified
- [ ] Budget provided
- [ ] Primary region confirmed

## Next Steps

After requirements are captured and approved:

1. User invokes `@architect` for architecture assessment
2. Architecture agent validates requirements and produces WAF assessment
3. Workflow continues through remaining 5 steps
---
