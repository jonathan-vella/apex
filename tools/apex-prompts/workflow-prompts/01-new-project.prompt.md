---
description: "Start a new APEX project from a complete intake brief, with owner decisions answered up front."
agent: "01-Orchestrator"
argument-hint: "Fill every input; type 'ask me' for a value you want to be asked about in Step 1"
---

# Start New Project

Read the [shared entry contract][entry] with `01-Orchestrator` selected and its configured model
verified. Stop on missing owner, model or tools; do not widen tools or run under another agent.

Start the project with [Starting a New Project][start] using the brief below. Treat each value as an
owner decision and pass it to Requirements unchanged. Ask only for entries that are `ask me`, missing
or contradictory, in one batch before Step 2 approval. Never substitute one of these values to fit a
budget or a default; stop and ask with the owner's choice and the alternative priced. Report which
Step 1 answers were inferred rather than taken from this brief. Do not deploy; stop at the approval
gate after the implementation plan. If an earlier decision changes, state which steps become stale
before proceeding.

## Project brief

- Name: ${input:project:short-kebab-case-name}
- Purpose and users: ${input:purpose:what the workload does and who uses it}
- Workload: ${input:workload:components, for example one containerized web app, one SQL database, key vault, registry}
- Scale: ${input:scale:total users, peak concurrent users, growth}
- Availability and recovery: ${input:availability:SLA, RTO, RPO, single instance or zones, disaster recovery in or out of scope}
- Environments: ${input:environments:dev only}
- Region: ${input:region:swedencentral}
- Compliance and data: ${input:compliance:GDPR, data kinds held, retention periods}
- Sign-in owner: ${input:authOwner:application team owns Entra sign-in; the platform deploys no app registration}
- SQL Entra admin group: ${input:sqlAdminGroup:group name}, object ID ${input:sqlAdminObjectId:object id}
- Operator access to private services: ${input:operatorAccess:Azure Bastion Basic with a Linux jump VM, Entra sign-in, no public IP; ask me before Standard}
- Budget: ${input:budget:1000} ${input:currency:USD} per month, billed in that currency
- Budget alert recipient: ${input:alertEmail:email}, Owner role on the subscription: ${input:alertEmailIsOwner:yes or no}. If they are not an Owner, state how alerts reach them.
- Cost monitoring: ${input:costMonitoring:minimal for dev; operational alerts go to the same recipient}
- Tags: owner=${input:tagOwner:owner}, costcenter=${input:tagCostcenter:costcenter}, sla=${input:tagSla:sla}, backup-policy=${input:tagBackup:backup-policy}, maint-window=${input:tagMaint:maintenance window}, technical-contact=${input:tagContact:contact email}. Use these unless Azure Policy enforces a different set.
- IaC and SKUs: ${input:iac:Bicep with Azure Verified Modules, latest stable}; no SKU pins unless listed here: ${input:skuPins:none}. Recommend the cheapest option that meets the brief and show each price.

Where the Operator access line names a jump host, design its outbound path for Entra sign-in and
package access, and show the cost of Bastion, the VM, its disk and any NAT Gateway or public IP.

[entry]: ../../../.github/skills/apex-workflow-engine/references/workflow-entry.md
[start]: ../../../.github/agents/01-orchestrator.agent.md#starting-a-new-project
