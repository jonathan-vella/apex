---
description: "Diagnose Azure resource health issues with guided troubleshooting and remediation planning."
agent: "09-Diagnose"
---

# Diagnose Azure Resource

Interactive diagnostic workflow for Azure resource health assessment.

## Prerequisites

- Active Azure CLI session (`az account show` succeeds)
- Target resource name, resource group, or resource ID known by user

## Instructions

1. Ask the user which Azure resource or resource group to diagnose.
2. Read `.github/skills/azure-diagnostics/SKILL.md` for diagnostic patterns.
3. Validate Azure CLI authentication: `az account show`.
4. Run health checks against the target resource:
   - Resource provisioning state
   - Activity log errors (last 24h)
   - Metric anomalies (CPU, memory, latency, errors)
   - Diagnostic settings configuration
   - Network connectivity (if applicable)
5. Use KQL templates from the troubleshooting skill for Log Analytics queries.
6. Present findings with severity classification and remediation steps.
7. Save the diagnostic report to `agent-output/{project}/diagnostic-report-{resource}.md`.

## Constraints

- Approval-first: always explain what will be checked before running any command.
- Analyze one resource at a time — do not attempt bulk diagnostics.
- Never modify resources during diagnosis — read-only operations only.
- Remediation steps are recommendations only — require user approval before execution.
