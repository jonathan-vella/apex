---
title: "Skill and Subagent Reference"
description: "Complete skills and subagent reference"
---

## Skills

Skills load according to their invocation flags. Eligible skills can load automatically;
manual-only skills require explicit invocation. Skills inherit the caller's model/tools,
not a new agent identity or permissions. See [Repository Slash Prompts](../repository-prompts/)
for Local adapters and manual Host entries.

### apex-agent-authoring

Creates, restructures, and audits Copilot agents while keeping enforceable
rules in thin authoring instructions and optional guidance on demand. Owns agent fleet
and `.github` authoring assessments; each produces a plan and stops before edits.
Assessment design history is reference-only. Supplied runtime profiles inform scores,
but log capture and context audits remain with `apex-context-management`.

```text
Use the apex-agent-authoring skill to reduce the fixed context cost of
.github/agents/03-architect.agent.md without changing its runtime contract.
```

### apex-azure-defaults

Provides regions, tags, naming conventions, AVM module references, and
security baselines. This is the foundational skill — agents read it before
every task.

```text
@workspace What are the default required tags from apex-azure-defaults?
```

### apex-python-diagrams

Generates architecture diagrams and WAF/cost/compliance charts with Python.

```text
Generate an architecture diagram for infra/bicep/my-project/ using apex-python-diagrams.
```

### apex-azure-bicep-patterns

Provides reusable Bicep patterns: hub-spoke networking, private endpoints,
diagnostic settings, conditional deployments, and AVM module composition.

```text
@workspace Show me the private endpoint pattern from apex-azure-bicep-patterns.
```

### apex-terraform-patterns

Provides reusable Terraform patterns: hub-spoke networking, private endpoints,
diagnostic settings, AVM-TF module composition, and known AVM pitfalls.

```text
@workspace Show me the hub-spoke pattern from apex-terraform-patterns.
```

### apex-azure-diagnostics

KQL templates, metric thresholds, health checks, and remediation playbooks
for diagnosing Azure resource issues.

```text
@workspace What KQL queries are available in apex-azure-diagnostics?
```

### apex-azure-adr

Creates Architecture Decision Records following a structured template.

```text
Document the decision to use Azure Front Door instead of
Application Gateway as an ADR.
```

### apex-github-operations

Full contribution lifecycle: branch naming, conventional commits, GitHub issues,
PRs, Actions, and releases. Uses `gh` CLI first for GitHub operations, with MCP fallback
under the owning skill's tool contract. Commit and push remain explicitly requested operations.

```text
@workspace What commit message format does this repo use?
```

```text
Create a GitHub issue for adding monitoring to the payment gateway.
Label it with 'enhancement' and 'infrastructure'.
```

### apex-docs-writer

Maintains documentation and owns doc gardening, docs peer review, and Astro docs review.
Peer review is read-only; Astro review is report-only unless `--apply-fixes` explicitly
enables its narrow allow-list. Quality-score and debt updates require human review.

```text
Update the docs to reflect the new Diagnose agent we added.
```

### apex-azure-artifacts

Artifact template structures, H2 compliance rules, and documentation
styling for all agent outputs (all steps).

```text
@workspace What H2 headings are required in the implementation plan template?
```

### apex-context-management

Unified context-window management. Two modes: **runtime compression**
(full / summarised / minimal artefact tiers used by orchestrator and
codegen agents) and **diagnostic audit** (post-mortem token profiling
and hand-off gap analysis used by the 11-Context Optimizer agent).
Owns debug-log export and context-audit procedures. Authoring assessments live in
`apex-agent-authoring`; runtime data is never inferred from static checks.

```text
@workspace What compression tiers does apex-context-management define
for the architecture assessment artifact?
```

### apex-golden-principles

The agent-first operating principles governing how agents work in
this repository. See the [canonical principles][golden-principles] for governance invariants and philosophy.

[golden-principles]: https://github.com/jonathan-vella/apex/blob/main/.github/skills/apex-golden-principles/SKILL.md

```text
@workspace What are the golden principles for agent behaviour?
```

### apex-iac-common

Shared IaC patterns for deploy agents: CLI auth validation, deployment
strategies, known issues, and governance-to-code property mapping.

```text
@workspace What are the known deployment issues in apex-iac-common?
```

### apex-workflow-engine

Machine-readable workflow DAG for the multi-step pipeline. Defines node
types, edge conditions, gates, and fan-out patterns. Owns shared workflow entry and
recovery. On Host, select `01-Orchestrator`, invoke `apex-host-workflow-start`, and
explicitly choose `resume` to recover an existing project. It does not approve or
advance gates automatically. Docs procedures belong to `apex-docs-writer`.

```text
@workspace Show the workflow graph edges and gate conditions.
```

## Subagents

:::note[Not user-invocable]
Subagents are delegated to automatically by parent agents. You cannot
select them from the agent picker (`Ctrl+Shift+A`). See
[Workflow Prompts](/reference/prompts/workflow-prompts/) for end-user scenarios.
:::

Subagents are called automatically by the **Bicep CodeGen**, **Terraform CodeGen**,
**Bicep Deploy**, **Terraform Deploy**, **Architect**, and **IaC Planner** agents.
You do not invoke them directly, but understanding their output helps you
interpret validation results.

### bicep-validate-subagent

Runs `bicep lint` and `bicep build` to validate template syntax, then reviews
templates against AVM standards, naming conventions, security baselines, and
best practices. Returns a structured PASS/FAIL + APPROVED/NEEDS_REVISION result.

### bicep-whatif-subagent

Runs `az deployment group what-if` to preview deployment changes. Analyzes
policy violations, resource changes, and cost impact. Returns a structured
change summary.

### terraform-validate-subagent

Runs `terraform fmt -check` and `terraform validate`, then reviews
configs against AVM-TF standards, CAF naming conventions, security baselines,
and governance compliance. Returns a structured PASS/FAIL + APPROVED/NEEDS_REVISION
result.

### terraform-plan-subagent

Runs `terraform plan` to preview infrastructure changes. Classifies resources
into create/update/destroy/replace, highlights destructive operations,
and returns a structured change summary.

### cost-estimate-subagent

Queries Azure Resource Manager MCP for retail SKU pricing. Compares regions
and returns a structured cost breakdown.

## When Validation Fails

Use the parent agent to repair the artifact that failed validation or preview.

1. Copy the exact failing output from `bicep build`, `terraform validate`,
   `what-if`, or `terraform plan`.
2. Re-run the parent step with that output and the path to the affected artifact.
3. Re-check the generated files before moving to the next gate.

For environment or auth failures, start with
[Troubleshooting](/guides/troubleshooting/) and
[Validation & Linting](/reference/validation-reference/).

## Tips and Patterns

### Context Priming

:::tip[Open Files Before Prompting]
Open relevant artifact files before starting a complex workflow step.
Copilot uses open files as context, giving agents better awareness of
your project state.
:::

Before starting a complex workflow, open relevant files so Copilot has context:

1. Open the requirements document (`01-requirements.md`)
2. Open the architecture assessment (`02-architecture-assessment.md`)
3. Then ask the IaC Planner agent to create the implementation plan

### Chaining Agents

You can chain agents manually by using handoff buttons in the chat, or run
the Orchestrator for automatic orchestration. Manual chaining gives you more
control over each step.

**Bicep track**:

1. Run **Requirements** → review and approve `01-requirements.md`
2. Run **Architect** → review WAF scores and cost estimate
3. Run **IaC Planner** → review governance constraints and plan
4. Run **Bicep CodeGen** → review generated templates
5. Run **Bicep Deploy** → review what-if before approving deployment
6. Run **As-Built** → generate post-deployment documentation

## Next Steps

- [Workflow Prompts](/reference/prompts/workflow-prompts/) — follow the step-by-step workflow templates
- [Troubleshooting](/guides/troubleshooting/) — recover from validation, auth, and setup failures
- [Validation & Linting](/reference/validation-reference/) — understand the checks behind each gate

**Terraform track**:

1. Run **Requirements** → review and approve `01-requirements.md`
2. Run **Architect** → review WAF scores and cost estimate
3. Run **IaC Planner** → review governance constraints and plan
4. Run **Terraform CodeGen** → review generated configs
5. Run **Terraform Deploy** → review plan output before applying
6. Run **As-Built** → generate post-deployment documentation

### Recovering from Errors

If an agent produces incorrect output, use specific follow-up prompts:

```text
The VNet address space conflicts with our on-premises range (10.0.0.0/8).
Change the hub VNet to 172.16.0.0/16 and spoke VNets to 172.17.0.0/16.
```

### Working with Existing Infrastructure

Agents can work with existing deployments, not just greenfield projects:

```text
I have an existing resource group rg-legacy-app-prod with 15 resources.
Generate as-built documentation for this infrastructure.
```

```text
Review the existing Bicep templates in infra/bicep/legacy-app/
and suggest improvements for WAF alignment.
```

## References

- [GitHub Copilot Best Practices](https://docs.github.com/en/copilot/get-started/best-practices)
- [Prompt Engineering for Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/prompt-engineering-for-copilot-chat)
- [VS Code Copilot Prompt Crafting](https://code.visualstudio.com/docs/copilot/prompt-crafting)
- [APEX Quickstart](/getting-started/quickstart/)
- [Agent Workflow Reference](/concepts/workflow/)
