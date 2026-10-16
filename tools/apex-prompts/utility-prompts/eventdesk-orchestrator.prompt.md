---
description: "Start the Eventdesk project with a fixed intake brief; the only question asked is Bicep or Terraform."
agent: "01-Orchestrator"
argument-hint: "Enter Bicep or Terraform"
---

# Start Eventdesk

Read the [shared entry contract][entry] with `01-Orchestrator` selected and its configured model
verified. Stop on missing owner, model or tools; do not widen tools or run under another agent.

Start the project with [Starting a New Project][start] using the brief below. Treat each value as an
owner decision and pass it to Requirements unchanged. The IaC tool is the only intake question. If
it is missing or neither Bicep nor Terraform, ask for it once and stop until answered. Do not ask any
other Step 1 intake question; if a value in the brief is contradictory or unsafe, stop and report it
instead of substituting. Never substitute one of these values to fit a budget or a default; stop and
state the owner's choice with the alternative priced. Report which Step 1 answers were inferred
rather than taken from this brief. Do not deploy; stop at the approval gate after the implementation
plan. If an earlier decision changes, state which steps become stale before proceeding.

Keep all work on the current branch `test/azure-mcp-3-e2e` (PR 764). Do not create or switch branches,
push, or open or update pull requests unless the user asks.

## Project brief

- Name: eventdesk
- Purpose and users: Eventdesk demo workload; an authenticated staff web portal for managing events
- Workload: one containerized web app, one SQL database, key vault, registry
- Scale: 500 concurrent users at peak
- Availability and recovery: SLA 99.9%, RTO 4 hours, RPO 1 hour, single instance in one zone, disaster
  recovery out of scope
- Environments: dev only
- Region: swedencentral
- Compliance and data: GDPR, EU-only personal data held in SQL, 30-day retention, no personal data in
  logs or telemetry
- Sign-in owner: application team owns Entra sign-in; the platform deploys no app registration
- SQL Entra admin group: sql-admins, object ID b792147a-b96c-4c03-a632-1341d156d4a8
- Operator access to private services: Azure Bastion Standard with a Linux jump VM (Standard_B2s_v2),
  Entra sign-in, no public IP on the VM
- Budget: 1000 USD per month, billed in USD
- Budget alert recipient: vella.jonathan@outlook.com, Owner role on the subscription: yes
- Cost monitoring: minimal for dev; operational alerts go to the same recipient
- Tags: owner=demo, costcenter=none, sla=99.9%, backup-policy=sql-pitr-30d-blob-recovery,
  maint-window=sat-02:00-04:00, technical-contact=vella.jonathan@outlook.com. Use these unless Azure
  Policy enforces a different set.
- IaC and SKUs: ${input:iac:Bicep or Terraform} with Azure Verified Modules, latest stable; no SKU pins.
  Recommend the cheapest option that meets the brief and show each price.

Design the jump host's outbound path for Entra sign-in and package access, and show the cost of
Bastion, the VM, its disk and any NAT Gateway or public IP.

[entry]: ../../../.github/skills/apex-workflow-engine/references/workflow-entry.md
[start]: ../../../.github/agents/01-orchestrator.agent.md#starting-a-new-project
