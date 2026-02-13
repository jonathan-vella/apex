---
description: 'Diagnose Azure resource health issues and generate a remediation report'
agent: 'Diagnose'
model: 'GPT-5.3-Codex'
tools:
  - read/readFile
  - edit/createFile
  - execute/runInTerminal
  - search/codebase
  - vscode/askQuestions
argument-hint: Provide the resource group name or resource to diagnose
---

# Diagnose Azure Resources

Run the 6-phase diagnostic workflow to assess resource health, identify
issues, and generate a remediation report with actionable recommendations.

## Mission

Guide the user through interactive Azure resource health assessment using
an approval-first approach. Discover target resources, check health metrics,
analyze logs, classify issues by severity, and produce a diagnostic report
with remediation steps.

## Scope & Preconditions

- Azure CLI must be authenticated (`az account show`)
- Read `.github/skills/azure-defaults/SKILL.md` for security baseline context
- This agent operates outside the 7-step workflow (supplementary)
- ALL Azure CLI commands require user approval before execution
- Report saved to `agent-output/${input:projectName}/08-resource-health-report.md`

## Inputs

| Variable | Description | Default |
| --- | --- | --- |
| `${input:resourceGroup}` | Target resource group name | Required |
| `${input:projectName}` | Project name for report output folder | Same as resource group |

## Workflow

### Phase 1: Resource Discovery

Use Azure Resource Graph to identify target resources:

```bash
az graph query -q "Resources | where resourceGroup =~ '{resourceGroup}' | project name, type, location, id"
```

Present the resource inventory and confirm scope with user.

### Phase 2: Health Assessment

Run resource-type-specific health checks:

| Resource Type | Key Metrics |
| --- | --- |
| Web App / Function | Http5xx, ResponseTime, availability |
| VM | CPU%, Memory%, disk IO, boot diagnostics |
| Storage | Availability, Latency, transaction errors |
| SQL Database | DTU%, CPU%, Storage%, deadlocks |
| Key Vault | ServiceApiHit, ServiceApiLatency |

Present health summary with severity ratings (Critical/Warning/Healthy).

### Phase 3: Log Analysis

Query activity logs and diagnostic logs for errors:

- Resource health events
- Failed operations
- Throttling or quota issues
- Configuration changes

### Phase 4: Issue Classification

Categorize findings by:

- **Critical** — service down, data loss risk
- **Warning** — degraded performance, approaching limits
- **Info** — optimization opportunities, best practice gaps

### Phase 5: Remediation Planning

For each issue, provide:

- Root cause analysis
- Recommended fix with specific commands or config changes
- Risk level and estimated effort
- Rollback guidance

### Phase 6: Generate Report

Save diagnostic report to `agent-output/{projectName}/08-resource-health-report.md`.

## Output Expectations

Structured report with health summary table, issue inventory sorted by
severity, remediation steps, and next-action recommendations.

## Quality Assurance

- [ ] User approved every Azure CLI command before execution
- [ ] All resources in scope were assessed
- [ ] Issues classified by severity with clear remediation steps
- [ ] No destructive operations performed without explicit approval
- [ ] Report saved to correct output location
