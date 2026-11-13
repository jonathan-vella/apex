# APEX

Agentic Platform Engineering eXperience for Azure.

APEX turns Azure platform engineering requirements and live subscription evidence into
Well-Architected assessments, evidence-backed cost reports, and deployable Bicep or Terraform
in VS Code with GitHub Copilot.

- [Documentation](https://apexops.pro/) and [documentation source](https://github.com/jonathan-vella/apex-docs)
- [Accelerator template](https://github.com/jonathan-vella/apex-accelerator)
- [MicroHack](https://microhack.apexops.pro/)
- [Contributing guide](https://apexops.pro/project/contributing/)

## Two ways to use APEX

### 1. Infrastructure delivery workflow

`01-Orchestrator` coordinates specialized agents and subagents across Requirements, Architecture
and Cost, Optional Design, Governance, IaC Planning, Bicep or Terraform Code Generation,
Deployment, and As-Built Documentation. Independent `challenger-review-subagent` checks and human
approval gates govern each stage before changes advance.

Early Architecture can start against shared Azure Landing Zones Corp policy assumptions under
`corp-policy-v1`, while IaC planning completion, code generation, and deployment require
target-verified private policy capture. Cost estimates pair workload SKUs with evidence-backed
retail pricing from Azure MCP. Read the [workflow overview](https://apexops.pro/concepts/workflow/).

### 2. Standalone WAF assessment

Run `/waf-assess-existing` in `01-Orchestrator` in `evidence_only` or `requirements_led` mode
against read-only Azure subscriptions, local IaC and diagrams, or both. The assessment generates
a five-pillar Well-Architected report, existing-state SVG and PNG diagrams, Azure Cost
Management analysis with visual charts, and a prioritized Excel and Markdown action register.
Independent quality reviews run before final bundle acceptance. Read the
[WAF assessment guide](https://apexops.pro/guides/waf-assessment/).

## Start here

For new Azure delivery or assessment projects, start from the Accelerator template rather than
cloning this upstream repository:

1. Create a private repository from the
   [Accelerator template](https://github.com/jonathan-vella/apex-accelerator).
2. Clone the new repository to the host machine. Microsoft employees must exit all VS Code
   windows and run `.devcontainer/open-microsoft.ps1` on Windows or
   `bash .devcontainer/open-microsoft.sh` on Linux, macOS, and WSL before starting the
   container. Read [Package Sources](.devcontainer/README.md#package-sources) for host feed
   setup. Everyone else can run `code .`.
3. Reopen the folder in the dev container and follow the
   [quickstart guide](https://apexops.pro/getting-started/quickstart/).

To contribute to APEX, read [AGENTS.md](AGENTS.md) for local setup, repository conventions, and
the `npm run validate:all` validation suite, plus the
[contributing guide](https://apexops.pro/project/contributing/).

## Delivery workflow

```mermaid
%%{init: {'theme':'neutral'}}%%
sequenceDiagram
  autonumber
  participant U as User
  participant C as Orchestrator
  participant R as Requirements
  participant X as Challenger
  participant A as Architect
  participant G as Governance
  participant IaC as IaC Plan
  participant Gen as IaC Code
  participant D as Deploy
  participant W as As-Built

  Note over C: ORCHESTRATION LAYER<br/>AI prepares. Humans decide.

  U->>C: Describe infrastructure intent
  C->>R: Translate intent into structured requirements
  R-->>C: 01-requirements.md (includes iac_tool selection)
  C->>X: Challenge requirements
  X-->>C: challenge-findings-requirements.json
  C->>U: Present requirements + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve requirements
  end

  C->>A: Assess architecture (WAF + Cost)
  Note right of A: cost-estimate-subagent<br/>handles pricing queries
  A-->>C: 02-architecture-assessment.md + 03-des-cost-estimate.md
  C->>X: Challenge architecture
  X-->>C: challenge-findings-architecture.json
  C->>X: Independently review cost feasibility
  X-->>C: challenge-findings-cost-estimate.json
  C->>U: Present architecture + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve architecture
  end

  C->>G: Discover policy constraints
  G-->>C: 04-governance-constraints.json and Markdown
  C->>X: Reconcile constraints with approved architecture
  X-->>C: challenge-findings-governance-constraints-pass1.json
  C->>U: Review governance constraints and confirmations
  U-->>C: Approve governance
  C->>IaC: Create implementation plan using approved inputs
  Note right of IaC: Unified IaC Planner (05)<br/>routes based on decisions.iac_tool
  IaC-->>C: 04-implementation-plan.md
  C->>X: Challenge implementation plan
  X-->>C: challenge-findings-plan.json
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

## What this repository contains

- Specialized agents, subagents, [skills](.github/skills/README.md), and instruction files for VS Code Copilot
- Reference implementations for Azure Verified Modules in Bicep and Terraform
- `apex-recall` CLI for project session state, step transitions, and review gates
- Validation scripts, MCP configuration, artifact templates, and Architecture Explorer graph metadata

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[MIT](LICENSE)
