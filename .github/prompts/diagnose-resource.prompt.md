---
description: "Diagnose Azure resource health issues with guided troubleshooting and remediation planning."
agent: "09-Diagnose"
---

# Diagnose Azure Resource

Interactive diagnostic workflow for Azure resource health assessment.

# Goal

Guide the 09-Diagnose agent through an approval-first Azure resource health investigation for one
target resource or resource group, then produce a concise diagnostic report.

# Success criteria

- Confirm the target resource, symptom or hypothesis, and active subscription before checks begin.
- Validate Azure CLI authentication with `az account show` after the target is known.
- Run only approved diagnostic checks against the confirmed target.
- Use `.github/skills/azure-diagnostics/SKILL.md` for diagnostic patterns and KQL templates.
- Classify findings by severity and provide remediation proposals without executing changes.
- Save the report and return a short summary with next-step options.

# Constraints

- Analyze one resource at a time unless the user explicitly expands scope.
- Explain what will be checked before running any command.
- Keep diagnosis read-only until the user explicitly approves a remediation command.
- Ask which resource to investigate first when the user describes symptoms without a target.
- Use `apex-recall show <project> --json` for project context when available; do not read or write
  `00-session-state.json` directly.

# Output

- `agent-output/{project}/08-resource-health-report.md` with scope, checks run, severity-tagged
  findings, KQL queries used, and recommended remediations.
- A short user-facing summary with top findings and next-step options.

# Stop rules

- Stop and ask for the target when no resource, resource group, or resource ID is known.
- Stop before each Azure CLI, KQL, or remediation command until the user approves it.
- Stop if authentication, RBAC, missing telemetry, or unsupported metrics prevent reliable
  diagnosis; report the blocker and recommended next action.

## Workflow

1. Ask the user which Azure resource or resource group to diagnose, plus the symptom or hypothesis.
2. Validate Azure CLI authentication with `az account show`.
3. Run approved read-only health checks against the target:
   - Resource provisioning state
   - Activity log errors from the last 24 hours
   - Metric anomalies for CPU, memory, latency, or error rate
   - Diagnostic settings configuration
   - Network connectivity when applicable
4. Use KQL templates from `azure-diagnostics` for Log Analytics queries.
5. Classify findings by severity and produce remediation proposals.
6. Save the diagnostic report to `agent-output/{project}/08-resource-health-report.md`.
