---
description: 'Create an Architecture Decision Record for the project'
agent: 'Design'
model: 'GPT-5.3-Codex'
tools:
  - read/readFile
  - edit/createFile
  - search/codebase
argument-hint: Provide the project name and decision topic
---

# Create Architecture Decision Record

Document a key architectural decision as a formal ADR following the
azure-adr skill format with WAF pillar mapping and alternatives analysis.

## Mission

Identify or accept a decision topic from the user, research the alternatives,
map trade-offs to WAF pillars, and generate a structured ADR document that
captures the rationale for the chosen approach.

## Scope & Preconditions

- `agent-output/${input:projectName}/02-architecture-assessment.md` must exist
- Read `.github/skills/azure-adr/SKILL.md` for ADR format and conventions
- Read `.github/skills/azure-defaults/SKILL.md` for Azure service context
- ADRs are numbered sequentially starting from 0001

## Inputs

| Variable | Description | Default |
| --- | --- | --- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |
| `${input:decisionTopic}` | The architectural decision to document | Required |

## Workflow

### Step 1: Read Context

Read `agent-output/{projectName}/02-architecture-assessment.md` for the
architecture context, WAF scores, and service recommendations.

### Step 2: Research Alternatives

For the decision topic, identify 2-4 alternatives:

- Current recommended approach (from architecture assessment)
- Viable alternatives with their trade-offs
- Rejected options with clear rationale

### Step 3: WAF Pillar Mapping

Map each alternative against the 5 WAF pillars:

| Alternative | Security | Reliability | Performance | Cost | Operations |
| --- | --- | --- | --- | --- | --- |

### Step 4: Document Decision

Follow the azure-adr skill template:

- **Status**: Proposed / Accepted / Deprecated / Superseded
- **Context**: Problem statement and constraints
- **Decision**: Chosen approach with justification
- **Consequences**: Positive, negative, and neutral outcomes
- **Alternatives Considered**: Each with WAF trade-off analysis

### Step 5: Determine Next ADR Number

Check existing ADR files in `agent-output/{projectName}/` to find the
next sequential number (e.g., `03-des-adr-0002-*` if 0001 exists).

### Step 6: Save Artifact

Save to `agent-output/{projectName}/03-des-adr-NNNN-{slug}.md` where
`{slug}` is the kebab-case decision topic.

## Output Expectations

Single ADR file following the azure-adr skill structure with all required
sections populated.

## Quality Assurance

- [ ] ADR number is sequential (no gaps or duplicates)
- [ ] All 5 WAF pillars addressed in alternatives analysis
- [ ] At least 2 alternatives considered
- [ ] Consequences section includes positive AND negative impacts
- [ ] Decision rationale is specific to the project (not generic)
- [ ] Status field is set correctly
