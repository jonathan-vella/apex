# Agentic InfraOps

Azure infrastructure engineered by agents.

This repository is the source project for a multi-agent workflow that turns Azure
infrastructure requirements into deployable Bicep or Terraform with human approval
gates across the lifecycle.

The full documentation for this repository lives here:

- [Agentic InfraOps documentation](https://jonathan-vella.github.io/azure-agentic-infraops/)

Key entry points:

- [Accelerator template](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator)
- [MicroHack](https://jonathan-vella.github.io/microhack-agentic-infraops/)
- [Contributing guide](CONTRIBUTING.md)

## Workflow

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant C as Conductor
  participant R as Requirements
  participant X as Challenger
  participant A as Architect
  participant IaC as IaC Plan
  participant Gen as IaC Code
  participant D as Deploy
  participant W as As-Built

  Note over C: ORCHESTRATION LAYER<br/>AI prepares. Humans decide.

  U->>C: Describe infrastructure intent
  C->>R: Translate intent into structured requirements
  R-->>C: 01-requirements.md (includes iac_tool selection)
  C->>X: Challenge requirements
  X-->>C: challenge-findings.json
  C->>U: Present requirements + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve requirements
  end

  C->>A: Assess architecture (WAF + Cost)
  Note right of A: cost-estimate-subagent<br/>handles pricing queries
  A-->>C: 02-assessment.md + 03-cost-estimate.md
  C->>X: Challenge architecture
  X-->>C: challenge-findings.json
  C->>U: Present architecture + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve architecture
  end

  C->>IaC: Create implementation plan + governance
  Note right of IaC: governance-discovery-subagent<br/>queries Azure Policy via REST API
  Note right of IaC: Bicep planner or Terraform planner
  IaC-->>C: 04-plan.md + governance constraints
  C->>X: Challenge implementation plan
  X-->>C: challenge-findings.json
  C->>U: Present plan + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve plan
  end

  C->>Gen: Generate IaC templates (AVM-first)
  Note right of Gen: Bicep codegen or Terraform codegen
  Gen-->>C: infra/bicep/{project} or infra/terraform/{project}

  rect rgba(0, 150, 255, 0.08)
  Note over C,Gen: Validation loop
  alt Validation passes
    C->>U: Present templates for deployment
    rect rgba(255, 200, 0, 0.15)
    Note over U,C: HUMAN APPROVAL GATE
    U-->>C: Approve for deployment
    end
  else Validation fails
    C->>Gen: Revise with feedback
  end
  end

  C->>D: Execute deployment
  Note right of D: what-if or terraform plan preview first
  D-->>C: 06-deployment-summary.md
  C->>U: Present deployment summary

  rect rgba(255, 200, 0, 0.15)
  Note over U,D: HUMAN VERIFICATION
  U-->>C: Verify deployment
  end

  C->>W: Generate workload documentation
  Note right of W: Reads prior artifacts and deployed resource state
  W-->>C: 07-*.md documentation suite
  C->>U: Present as-built docs

  Note over U,W: AI orchestrated. Human governed. Azure ready.
```

## Start Here

For new projects, use the Accelerator template rather than cloning this repository
directly.

1. Create a repository from the [Accelerator template](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator).
2. Open that repository in VS Code and reopen it in the dev container.
3. Start with the published docs:
   [https://jonathan-vella.github.io/azure-agentic-infraops/](https://jonathan-vella.github.io/azure-agentic-infraops/)

## What This Repository Contains

- Agent definitions, skills, and instruction files for the workflow engine
- Reference implementations for Bicep and Terraform tracks
- Validation scripts, MCP configuration, and sample agent outputs
- Source content for the published documentation site

## License

MIT. See [LICENSE](LICENSE).
