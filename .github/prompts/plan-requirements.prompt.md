---
description: "Gather Azure workload requirements through business-first discovery"
agent: "Requirements"
model: "Claude Opus 4.6"
tools:
  - edit/createFile
  - edit/editFiles
  - vscode/askQuestions
---

# Plan Requirements

Conduct a business-first requirements discovery session for a new Azure workload.
The user may describe their needs in business terms (industry, company size, what
they want to achieve) — NOT necessarily in technical Azure terms. Your job is to
translate business context into infrastructure requirements.

## Mission

Discover and capture comprehensive Azure workload requirements by starting with
business context, adaptively deepening the conversation based on how much the user
already knows, inferring technical patterns from business signals, and confirming
recommendations before generating the artifact.

## Scope & Preconditions

- User has a business need but may not know Azure services or architecture patterns
- Support both business-level prompts ("modernize my ecommerce") and technical
  prompts ("3-tier web app with SQL")
- Output will be saved to `agent-output/${input:projectName}/01-requirements.md`
- Follow the template structure from `.github/templates/01-requirements.template.md`
- Use the Service Recommendation Matrix and Business Domain Signals from `_shared/defaults.md`

## Inputs

| Variable               | Description                                          | Default  |
| ---------------------- | ---------------------------------------------------- | -------- |
| `${input:projectName}` | Project name (kebab-case) — asked in Phase 5         | Required |
| `${input:businessDesc}` | Describe your business need (or select from guided options) | Required |

## Workflow

Follow the agent's 5-phase business-first discovery flow:

### Phase 1: Business Discovery (Adaptive Depth)

Use `askQuestions` UI to gather:

1. **Industry / vertical** — Retail, Healthcare, Finance, etc.
2. **Company size** — Startup, Mid-Market, Enterprise
3. **System type** — guided picker (ecommerce, portal, website, analytics, API, automation)
4. **Scenario** — greenfield, migration, modernization, or extension

**Adaptive Round 2** (if needed):

- If **migration/modernization**: current platform, pain points, what to preserve

### Phase 2: Workload Pattern Detection (Agent-Inferred)

The agent infers the workload pattern from business context — do NOT ask the user
to pick from technical categories like "N-Tier" or "Event-Driven".

1. **Agent recommends** a pattern based on Business Domain Signals
2. **User confirms** or rejects the recommendation
3. **Daily users** — in business terms ("How many people use this daily?")
4. **Budget** — approximate monthly cloud spend
5. **Data sensitivity** — personal data, payment data, health records, etc.

### Phase 3: Service Recommendations (Business-Friendly)

Based on pattern + budget, use `askQuestions` UI to present:

1. **Service tier options** — business descriptions with Azure names in parentheses
2. **Availability** — in business terms ("How important is uptime?")
3. **Recovery** — in business terms ("How fast must you recover?")
4. **Application layers** (if N-Tier) — business descriptions

### Phase 4: Security & Compliance Posture

Use `askQuestions` UI, pre-selecting frameworks based on industry:

1. **Compliance frameworks** — pre-checked based on industry from Phase 1
2. **Security controls** — business-friendly labels with Azure terms in parentheses
3. **Authentication** — in business terms ("How will people log in?")
4. **Hosting region** — business-friendly location names

### Phase 5: Operational Details & Draft

1. **Project name, environments, timeline** — captured here, not Phase 1
2. Run research subagent for additional Azure context
3. Generate `01-requirements.md` with all sections including `### Business Context`
4. Present draft for review, iterate on feedback

## Output Expectations

Generate `agent-output/{projectName}/01-requirements.md` with:

1. All H2 sections from the template populated
2. `### Business Context` subsection under Project Overview (industry, size, drivers)
3. `### Architecture Pattern` subsection with inferred workload + service tier
4. `### Recommended Security Controls` subsection with confirmed controls
5. Summary section ready for architecture assessment handoff

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
