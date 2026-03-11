---
toc_depth: 2
---

# :material-bookshelf: Skill and Subagent Reference

## :material-book-open-variant: Skills

Skills are invoked automatically by agents, but you can also reference them
directly in prompts.

### azure-defaults

Provides regions, tags, naming conventions, AVM module references, and
security baselines. Agents read this skill before every task.

```text
@workspace What are the default required tags from azure-defaults?
```

### azure-diagrams

Generates Python architecture diagrams using the `diagrams` library.

```text
Generate an architecture diagram for the infrastructure in
infra/bicep/my-project/ using the azure-diagrams skill.
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

### azure-troubleshooting

KQL templates, metric thresholds, health checks, and remediation playbooks
for diagnosing Azure resource issues.

```text
@workspace What KQL queries are available in azure-troubleshooting?
```

### azure-adr

Creates Architecture Decision Records following a structured template.

```text
Document the decision to use Azure Front Door instead of
Application Gateway as an ADR.
```

### git-commit

Provides conventional commit message conventions for this repository.

```text
@workspace What commit message format does this repo use?
```

### github-operations

Manages GitHub issues, PRs, Actions, and releases. Uses MCP tools first,
falls back to `gh` CLI.

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
styling for all agent outputs (Steps 1-7).

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

### session-resume

Session state tracking and resume protocol for the 8-step workflow.
Manages checkpoint recovery and session-state.json schema.

```text
Resume the workflow from step 4 using the existing session state.
```

### workflow-engine

Machine-readable workflow DAG for the 8-step pipeline. Defines node
types, edge conditions, gates, and fan-out patterns.

```text
@workspace Show the workflow graph edges and gate conditions.
```

## :material-robot-outline: Subagents

Subagents are called automatically by the **Bicep CodeGen**, **Terraform CodeGen**,
**Bicep Deploy**, **Terraform Deploy**, **Architect**, and **IaC Planner** agents.
You do not invoke them directly, but understanding their output helps you
interpret validation results.

### bicep-lint-subagent

Runs `bicep lint` and `bicep build` to validate template syntax. Returns a
structured PASS/FAIL result with error counts and details.

### bicep-review-subagent

Reviews Bicep templates against AVM standards, naming conventions, security
baselines, and best practices. Returns an APPROVED, NEEDS_REVISION, or FAILED
verdict with actionable feedback.

### bicep-whatif-subagent

Runs `az deployment group what-if` to preview deployment changes. Analyzes
policy violations, resource changes, and cost impact. Returns a structured
change summary.

### terraform-lint-subagent

Runs `terraform fmt -check`, `terraform validate`, and TFLint to validate
configuration syntax. Returns a structured PASS/FAIL result with diagnostics.

### terraform-review-subagent

Reviews Terraform configs against AVM-TF standards, CAF naming conventions,
security baselines, and governance compliance. Returns APPROVED, NEEDS_REVISION,
or FAILED verdict with actionable feedback.

### terraform-plan-subagent

Runs `terraform plan` to preview infrastructure changes. Classifies resources
into create/update/destroy/replace, highlights destructive operations,
and returns a structured change summary.

### cost-estimate-subagent

Queries Azure Pricing MCP tools for real-time SKU pricing. Compares regions
and returns a structured cost breakdown.

### governance-discovery-subagent

Queries Azure Policy assignments via REST API (including management group-
inherited policies). Classifies policy effects and returns structured governance
constraints.

## :material-lightbulb-group-outline: Tips and Patterns

### Context Priming

!!! tip "Open Files Before Prompting"

    Open relevant artifact files before starting a complex workflow step.
    Copilot uses open files as context, giving agents better awareness of
    your project state.

Before starting a complex workflow, open relevant files so Copilot has context:

1. Open the requirements document (`01-requirements.md`)
2. Open the architecture assessment (`02-architecture-assessment.md`)
3. Then ask the Bicep Planner agent to create the implementation plan

### Chaining Agents

You can chain agents manually by using handoff buttons in the chat, or run
the Conductor for automatic orchestration. Manual chaining gives you more
control over each step.

**Bicep track**:

1. Run **Requirements** → review and approve `01-requirements.md`
2. Run **Architect** → review WAF scores and cost estimate
3. Run **Bicep Planner** → review governance constraints and plan
4. Run **Bicep CodeGen** → review generated templates
5. Run **Bicep Deploy** → review what-if before approving deployment
6. Run **As-Built** → generate post-deployment documentation

**Terraform track**:

1. Run **Requirements** → review and approve `01-requirements.md`
2. Run **Architect** → review WAF scores and cost estimate
3. Run **Terraform Planner** → review governance constraints and plan
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

## :material-link-variant: References

- [GitHub Copilot Best Practices](https://docs.github.com/en/copilot/get-started/best-practices)
- [Prompt Engineering for Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/prompt-engineering-for-copilot-chat)
- [VS Code Copilot Prompt Crafting](https://code.visualstudio.com/docs/copilot/prompt-crafting)
- [Agentic InfraOps Quickstart](../quickstart.md)
- [Agent Workflow Reference](../workflow.md)
