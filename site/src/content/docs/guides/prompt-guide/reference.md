---
title: "Skill and Subagent Reference"
description: "Complete skills and subagent reference"
---

## Skills

Skills are invoked automatically by agents, but you can also reference them
directly in prompts.

### azure-defaults

Provides regions, tags, naming conventions, AVM module references, and
security baselines. This is the foundational skill — agents read it before
every task.

```text
@workspace What are the default required tags from azure-defaults?
```

### drawio

Generates Draw.io architecture diagrams with 700+ Azure icons via MCP server.

```text
Generate an architecture diagram for the infrastructure in
infra/bicep/my-project/ using the drawio skill.
```

### python-diagrams

Generates WAF/cost/compliance charts using Python matplotlib.

```text
Generate a WAF pillar bar chart for the architecture assessment.
```

### azure-bicep-patterns

Provides reusable Bicep patterns: hub-spoke networking, private endpoints,
diagnostic settings, conditional deployments, and AVM module composition.

```text
@workspace Show me the private endpoint pattern from azure-bicep-patterns.
```

### terraform-patterns

Provides reusable Terraform patterns: hub-spoke networking, private endpoints,
diagnostic settings, AVM-TF module composition, and known AVM pitfalls.

```text
@workspace Show me the hub-spoke pattern from terraform-patterns.
```

### azure-diagnostics

KQL templates, metric thresholds, health checks, and remediation playbooks
for diagnosing Azure resource issues.

```text
@workspace What KQL queries are available in azure-diagnostics?
```

### azure-adr

Creates Architecture Decision Records following a structured template.

```text
Document the decision to use Azure Front Door instead of
Application Gateway as an ADR.
```

### github-operations

Full contribution lifecycle: branch naming, conventional commits, GitHub issues,
PRs, Actions, and releases. Uses MCP tools first, falls back to `gh` CLI.

```text
@workspace What commit message format does this repo use?
```

```text
Create a GitHub issue for adding monitoring to the payment gateway.
Label it with 'enhancement' and 'infrastructure'.
```

### docs-writer

Generates and maintains documentation following repository standards.

```text
Update the docs to reflect the new Diagnose agent we added.
```

### make-skill-template

Scaffolds a new skill directory from the template.

```text
Create a new skill called 'azure-monitoring' for Application Insights
and Log Analytics best practices.
```

### azure-artifacts

Artifact template structures, H2 compliance rules, and documentation
styling for all agent outputs (all steps).

```text
@workspace What H2 headings are required in the implementation plan template?
```

### context-optimizer

Audits agent context window usage via debug logs, token profiling,
and redundancy detection. Produces optimisation recommendations.

```text
Analyse the last Copilot Chat debug log and identify context waste.
```

### context-shredding

Runtime context compression with 3 tiers (full/summarised/minimal)
and per-artifact templates to keep agents within context limits.

```text
@workspace What compression tiers does context-shredding define
for the architecture assessment artifact?
```

### copilot-customization

Authoritative reference for VS Code Copilot customisation mechanisms:
instructions, prompt files, custom agents, skills, MCP servers, and hooks.

```text
I want to create a new custom agent for database migration tasks.
Walk me through the steps using copilot-customization.
```

### golden-principles

The 10 agent-first operating principles governing how agents work in
this repository. Defines governance invariants and philosophy.

```text
@workspace What are the golden principles for agent behaviour?
```

### iac-common

Shared IaC patterns for deploy agents: CLI auth validation, deployment
strategies, known issues, and governance-to-code property mapping.

```text
@workspace What are the known deployment issues in iac-common?
```

### workflow-engine

Machine-readable workflow DAG for the multi-step pipeline. Defines node
types, edge conditions, gates, and fan-out patterns.

```text
@workspace Show the workflow graph edges and gate conditions.
```

## Subagents

:::note[Not user-invocable]
Subagents are delegated to automatically by parent agents. You cannot
select them from the agent picker (`Ctrl+Shift+A`). See
[Workflow Prompts](../workflow-prompts/) for end-user scenarios.
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

Runs `terraform fmt -check`, `terraform validate`, and TFLint, then reviews
configs against AVM-TF standards, CAF naming conventions, security baselines,
and governance compliance. Returns a structured PASS/FAIL + APPROVED/NEEDS_REVISION
result.

### terraform-plan-subagent

Runs `terraform plan` to preview infrastructure changes. Classifies resources
into create/update/destroy/replace, highlights destructive operations,
and returns a structured change summary.

### cost-estimate-subagent

Queries Azure Pricing MCP tools for real-time SKU pricing. Compares regions
and returns a structured cost breakdown.

## When Validation Fails

Use the parent agent to repair the artifact that failed validation or preview.

1. Copy the exact failing output from `bicep build`, `terraform validate`,
   `what-if`, or `terraform plan`.
2. Re-run the parent step with that output and the path to the affected artifact.
3. Re-check the generated files before moving to the next gate.

For environment or auth failures, start with
[Troubleshooting](../../guides/troubleshooting/) and
[Validation & Linting](../../reference/validation-reference/).

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

- [Workflow Prompts](../workflow-prompts/) — follow the step-by-step workflow templates
- [Troubleshooting](../../guides/troubleshooting/) — recover from validation, auth, and setup failures
- [Validation & Linting](../../reference/validation-reference/) — understand the checks behind each gate

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
- [APEX Quickstart](../../../getting-started/quickstart/)
- [Agent Workflow Reference](../../../concepts/workflow/)
