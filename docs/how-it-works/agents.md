---
toc_depth: 3
---

# :material-robot: Agent Architecture

## :material-card-account-details-outline: Agent Anatomy

Every agent definition follows a standard structure:

```yaml
# Frontmatter
---
name: 06b-Bicep CodeGen
description: Expert Azure Bicep IaC specialist...
model: ["Claude Opus 4.6"] # (1)!
tools: [list of allowed tools] # (2)!
handoffs:
  - label: "Step 6: Deploy"
    agent: 07b-Bicep Deploy # (3)!
    prompt: "Deploy the Bicep templates..."
---
# Body (≤ 350 lines)
## MANDATORY: Read Skills First
1. **Read** `.github/skills/azure-defaults/SKILL.md` # (4)!
2. **Read** `.github/skills/azure-artifacts/SKILL.md`
```

1. :material-brain: Model selection — the Conductor can override this based on task complexity
2. :material-tools: Tool allowlist — agents only access tools they need
3. :material-swap-horizontal: Handoff target — the next agent in the workflow
4. :material-book-open-variant: Skills are loaded on demand to preserve context budget

The frontmatter is machine-readable metadata. The body is the agent's operating manual,
loaded into the system prompt when the agent is invoked.

## :material-account-supervisor-outline: Top-Level Agents (14)

| Agent                    | Role                                  | Primary Skills                  |
| ------------------------ | ------------------------------------- | ------------------------------- |
| 01-Conductor             | Master orchestrator                   | workflow-engine, session-resume |
| 01-Conductor (Fast Path) | Simplified path for ≤3 resources      | session-resume, azure-defaults  |
| 02-Requirements          | Captures project requirements         | azure-defaults, azure-artifacts |
| 03-Architect             | WAF assessment and cost estimation    | azure-defaults, microsoft-docs  |
| 04-Design                | Diagrams and ADRs                     | azure-diagrams, azure-adr       |
| 05b-Bicep Planner        | Bicep implementation planning         | azure-bicep-patterns            |
| 05t-Terraform Planner    | Terraform implementation planning     | terraform-patterns              |
| 06b-Bicep CodeGen        | Bicep template generation             | azure-bicep-patterns            |
| 06t-Terraform CodeGen    | Terraform configuration generation    | terraform-patterns              |
| 07b-Bicep Deploy         | Bicep deployment execution            | iac-common                      |
| 07t-Terraform Deploy     | Terraform deployment execution        | iac-common, terraform-patterns  |
| 08-As-Built              | Post-deployment documentation         | azure-artifacts, azure-diagrams |
| 09-Diagnose              | Azure resource troubleshooting        | azure-troubleshooting           |
| 10-Challenger            | Standalone adversarial review         | —                               |
| 11-Context Optimizer     | Context window audit and optimisation | context-optimizer               |

## :material-account-cog-outline: Subagents (9)

Subagents are not user-invocable. They are delegated to by parent agents for isolated,
specific tasks:

| Subagent                      | Purpose                                | Invoked By          |
| ----------------------------- | -------------------------------------- | ------------------- |
| challenger-review-subagent    | Adversarial review of artifacts        | Steps 1, 2, 4, 5, 6 |
| cost-estimate-subagent        | Azure Pricing MCP queries              | Steps 2, 7          |
| governance-discovery-subagent | Azure Policy discovery via REST API    | Step 4              |
| bicep-lint-subagent           | `bicep build` + `bicep lint`           | Step 5 (Bicep)      |
| bicep-review-subagent         | Code review against AVM standards      | Step 5 (Bicep)      |
| bicep-whatif-subagent         | `az deployment what-if` preview        | Step 6 (Bicep)      |
| terraform-lint-subagent       | `terraform fmt` + `terraform validate` | Step 5 (Terraform)  |
| terraform-review-subagent     | Code review against AVM-TF standards   | Step 5 (Terraform)  |
| terraform-plan-subagent       | `terraform plan` preview               | Step 6 (Terraform)  |

## :material-sword-cross: The Challenger Pattern

!!! abstract "Adversarial Review"

    The Challenger finds what everyone else missed — untested assumptions,
    governance gaps, WAF blind spots, and architectural weaknesses.

The `challenger-review-subagent` implements adversarial review at critical workflow steps.
It operates with rotating lenses:

- **1-pass review** (comprehensive): A single review covering all dimensions. Used for
  requirements (Step 1) and deploy (Step 6).
- **3-pass review** (rotating lenses): Three separate reviews, each focused on a specific
  dimension (security, reliability, cost). Used for architecture (Step 2), planning (Step 4),
  and code (Step 5).

Findings are classified as `must_fix` (blocking) or `should_fix` (advisory). Only
`must_fix` findings block workflow progression.

## :material-swap-horizontal: Handoffs and Delegation

Agents communicate through artefact files, not direct message passing. The Conductor
delegates to a step agent, which produces output files in `agent-output/{project}/`.
The next agent reads those files as input. This design:

- Eliminates context leakage between agents
- Enables resume from any point (artefacts are persistent)
- Allows human review at every gate (artefacts are human-readable markdown)
- Supports parallel development of different steps
