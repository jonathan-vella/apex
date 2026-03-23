---
title: "System Architecture Overview"
description: "System architecture and component overview"
---

## The Multi-Step Workflow

The system follows a strict sequential workflow with mandatory human approval gates
between critical phases:

<div class="workflow-table not-content">

|     | Step | Phase             | Agent             | Output                               | Review     |
| :-: | :--: | ----------------- | ----------------- | ------------------------------------ | ---------- |
| 🔒  |  1   | 📜 Requirements   | 02-Requirements   | `01-requirements.md`                 | 1 pass     |
| 🔒  |  2   | 🏛️ Architecture   | 03-Architect      | `02-architecture-assessment.md`      | 3+1 passes |
|     |  3   | 🎨 Design _(opt)_ | 04-Design         | `03-des-*.{py,png,md}`               | —          |
| 🔒  | 3.5  | 🛡️ Governance     | 04g-Governance    | `04-governance-constraints.md`       | —          |
| 🔒  |  4   | 📐 IaC Plan       | 05b / 05t Planner | `04-implementation-plan.md`          | 1+3 passes |
|  ✔  |  5   | ⚒️ IaC Code       | 06b / 06t CodeGen | `infra/bicep/` or `infra/terraform/` | 3 passes   |
| 🔒  |  6   | 🚀 Deploy         | 07b / 07t Deploy  | `06-deployment-summary.md`           | 1 pass     |
|     |  7   | 📚 As-Built       | 08-As-Built       | `07-*.md` docs suite                 | —          |

</div>

<small>🔒 human approval gate · ✔ automated validation gate</small>

## The Conductor Pattern

<img
  src="https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=1200&auto=format&fit=crop"
  height="200"
  style="object-fit: cover; border-radius: 8px;"
  alt="Orchestra performance representing the Conductor pattern"
/>

The InfraOps Conductor (agent `01-Conductor`, also known as the Coordinator) is the master orchestrator. It does not
generate infrastructure code or documentation itself. Instead, it:

1. Reads the workflow DAG from `workflow-graph.json`
2. Resolves agent paths and models from `agent-registry.json`
3. Delegates each step to the appropriate specialised agent via `#runSubagent`
4. Enforces approval gates between steps
5. Maintains session state in `00-session-state.json`
6. Writes human-readable handoff documents (`00-handoff.md`) at every gate
7. Recommends session breaks at Gates 2 and 3 to prevent context exhaustion

The Conductor never touches infrastructure templates. It is a pure orchestrator and
state machine.

**Parse-and-confirm pattern**: The Conductor parses the project name from the user's
message and confirms inline, rather than using the `askQuestions` tool. It only falls
back to `askQuestions` if the message gives no clue.

**Session Break Protocol**: At Gates 2 and 3, the Conductor writes `00-handoff.md` +
updates `00-session-state.json`, then recommends the user start a fresh chat session.
This prevents context exhaustion in long-running sessions — real-world testing showed
that a 3h39m session experienced 5 forced context summarisations, losing critical
decision context. The new session resumes from the checkpoint by reading the state file.

**Model Selection**: The Conductor routes to different model tiers based on task complexity:

:::note[Model versions evolve]
The specific versions below reflect the current configuration. Check agent
frontmatter (`model:` field) for the latest selections.
:::

| Tier           | Model         | Used By                                          |
| -------------- | ------------- | ------------------------------------------------ |
| Primary        | Claude Opus   | Conductor, all workflow step agents              |
| Review         | Claude Sonnet | Challenger reviews, code reviews (A/B validated) |
| Heavy API Work | GPT Codex     | Governance discovery (batch REST API calls)      |
| Utility        | GPT-4o-mini   | Session state updates, lightweight tasks         |

**Subagent Integration Matrix**: The full mapping of which subagents are invoked by
which parent agents is externalised to the
[subagent-integration reference](../../.github/skills/workflow-engine/references/subagent-integration.md)
to keep the Conductor body under the 350-line limit.

## Dual IaC Tracks

<img
  src="https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=1200&auto=format&fit=crop"
  height="200"
  style="object-fit: cover; border-radius: 8px;"
  alt="Railway tracks diverging representing dual IaC tracks"
/>

Steps 1–3 (Requirements, Architecture, Design) are shared across both infrastructure
tracks. Step 3.5 (Governance) is also shared and mandatory. At Step 4, the workflow
diverges based on the `iac_tool` field in the requirements
document:

```mermaid
flowchart TD



    Shared["Steps 1-3\n(Shared)"]
    Decision{"iac_tool?"}
    Bicep["Steps 4-6\nBicep Track\n(05b → 06b → 07b)"]:::track
    Terraform["Steps 4-6\nTerraform Track\n(05t → 06t → 07t)"]:::track
    AsBuilt["Step 7\nAs-Built Docs\n(Shared)"]:::endNode

    Shared --> Decision
    Decision -->|Bicep| Bicep
    Decision -->|Terraform| Terraform
    Bicep --> AsBuilt
    Terraform --> AsBuilt
```

---

:::tip[Further Reading]

- [Core Concepts](four-pillars.md) — agents, skills, instructions, and configuration registries
- [Agent Architecture](agents.md) — top-level agents, subagents, Challenger pattern
- [Workflow Engine & Quality](workflow-engine.md) — DAG model, session state, circuit breakers
- [MCP Integration](mcp-integration.md) — MCP servers and tool catalogs
  :::
