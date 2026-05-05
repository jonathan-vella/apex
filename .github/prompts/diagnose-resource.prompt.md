---
description: "Diagnose Azure resource health issues with guided troubleshooting and remediation planning."
agent: "09-Diagnose"
---

# Diagnose Azure Resource

Interactive diagnostic workflow for Azure resource health assessment.

<investigate_before_answering>
- Diagnostics is investigative work. Before running any check, confirm:
  (a) which resource (name, resource group, or resource ID) is in scope;
  (b) what symptom the user is reporting; (c) which subscription is active.
- If the user describes a symptom without naming a resource, ask which
  resource to investigate first; do not bulk-scan.
</investigate_before_answering>

<context>
- User has an active Azure CLI session (`az account show` succeeds).
- Target resource name, resource group, or resource ID is known.
- Read `.github/skills/azure-diagnostics/SKILL.md` for diagnostic patterns
  and KQL templates.
</context>

<task>
1. Ask the user which Azure resource (or resource group) to diagnose, plus
   the symptom or hypothesis.
2. Validate Azure CLI authentication (`az account show`).
3. Run read-only health checks against the target:
   - Resource provisioning state
   - Activity log errors (last 24 hours)
   - Metric anomalies (CPU, memory, latency, error rate)
   - Diagnostic settings configuration
   - Network connectivity (when applicable)
4. Use KQL templates from `azure-diagnostics` for Log Analytics queries.
5. Classify findings by severity and produce remediation steps (proposals,
   not executions).
6. Save the diagnostic report to
   `agent-output/{project}/diagnostic-report-{resource}.md`.
</task>

<rules>
- Approval-first: always explain what will be checked before running any
  command.
- Analyze one resource at a time — do not bulk-diagnose.
- Read-only operations only during diagnosis. Never modify resources.
- Remediation steps are recommendations; require explicit user approval
  before executing any change.
</rules>

<output_contract>
- `agent-output/{project}/diagnostic-report-{resource}.md` with: scope,
  checks run, findings (severity-tagged), KQL queries used, recommended
  remediations.
- A short summary returned to the user (top findings + next-step options).
</output_contract>
