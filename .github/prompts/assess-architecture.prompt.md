---
description: 'Assess architecture using Well-Architected Framework with cost estimates'
agent: 'Architect'
model: 'Claude Opus 4.6'
tools:
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - search/codebase
  - web/fetch
  - azure-pricing/azure_cost_estimate
  - azure-pricing/azure_price_search
  - azure-pricing/azure_price_compare
  - azure-pricing/azure_sku_discovery
argument-hint: Provide the project name to assess
---

# Assess Architecture — WAF Assessment & Cost Estimate

Evaluate the captured requirements against the Azure Well-Architected Framework
and produce a comprehensive architecture assessment with cost estimates.

## Mission

Read the project requirements, score all 5 WAF pillars (Security, Reliability,
Performance Efficiency, Cost Optimization, Operational Excellence), recommend
Azure services with SKU selections, and generate a cost estimate using Azure
Pricing MCP tools.

## Scope & Preconditions

- `agent-output/${input:projectName}/01-requirements.md` must exist
- Read `.github/skills/azure-defaults/SKILL.md` for configuration
- Read `.github/skills/azure-artifacts/SKILL.md` for template H2 structure
- Use Azure Pricing MCP tools with EXACT service names from azure-defaults skill
- Search Microsoft docs for each Azure service recommendation

## Inputs

| Variable | Description | Default |
| --- | --- | --- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |

## Workflow

### Step 1: Read Requirements

Read `agent-output/{projectName}/01-requirements.md` for business context,
architecture pattern, NFRs, compliance, budget, and scale requirements.

### Step 2: WAF Assessment

Score each pillar 1-10 with confidence level (High/Medium/Low):

- **Security** — identity, network, data protection, threat detection
- **Reliability** — SLA, redundancy, disaster recovery, fault tolerance
- **Performance Efficiency** — scaling, caching, CDN, compute optimization
- **Cost Optimization** — right-sizing, reserved instances, auto-scaling
- **Operational Excellence** — monitoring, alerting, IaC, CI/CD

### Step 3: Service Recommendations

For each Azure resource:

1. Recommend specific SKU with justification
2. Map to WAF pillar trade-offs
3. Check service maturity (GA, Preview, Deprecated)
4. Note AVM module availability

### Step 4: Cost Estimate

Use Azure Pricing MCP tools to generate monthly and yearly estimates.
Break down by resource, include reserved instance savings options.

### Step 5: Generate Artifacts

Save to `agent-output/{projectName}/`:

- `02-architecture-assessment.md` — WAF scores, service recommendations
- `03-des-cost-estimate.md` — detailed cost breakdown

## Output Expectations

Both artifacts must follow the H2 template structure from the azure-artifacts
skill. Include attribution header, badges, TOC, and navigation links.

## Quality Assurance

- [ ] All 5 WAF pillars scored with justification
- [ ] No pillar scored 10/10 without exceptional justification
- [ ] Cost estimate uses real pricing data from MCP tools
- [ ] Service maturity assessed for every recommended service
- [ ] All recommendations are specific to the workload (no generic advice)
- [ ] H2 headings match template exactly
