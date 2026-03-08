<!-- markdownlint-disable MD013 MD033 MD041 -->

<a id="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![Azure][azure-shield]][azure-url]
[![Bicep][bicep-shield]][bicep-url]
[![Terraform][terraform-shield]][terraform-url]

<div align="center">
  <img
    src="https://capsule-render.vercel.app/api?type=waving&height=180&color=0:0A66C2,50:0078D4,100:00B7C3&text=Agentic%20InfraOps&fontSize=44&fontColor=FFFFFF&fontAlignY=34&desc=Azure%20infrastructure%20engineered%20by%20agents&descAlignY=56"
    alt="Agentic InfraOps banner" />
</div>

<br />
<div align="center">
  <a href="https://github.com/jonathan-vella/azure-agentic-infraops">
    <img
      src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Robot/3D/robot_3d.png"
      alt="Logo" width="120" height="120">
  </a>

  <h1 align="center">Agentic InfraOps</h1>

  <p align="center">
    <strong>A multi-agent orchestration system for Azure infrastructure development</strong>
    <br />
    <em>Requirements → Architecture → Plan → Code → Deploy → Documentation</em>
    <br /><br />
    <a href="#-quick-start"><strong>Quick Start »</strong></a>
    ·
    <a href="agent-output/">Sample Outputs</a>
    ·
    <a href="docs/prompt-guide/">Prompt Guide</a>
    ·
    <a href="https://github.com/jonathan-vella/azure-agentic-infraops/issues/new?labels=bug">Report Bug</a>
  </p>
</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">

<br />
<p align="left">
  💡 <b>Agentic InfraOps</b> coordinates specialized AI agents through a complete infrastructure development cycle. Instead of context-switching between requirements, architecture decisions, IaC authoring (Bicep <b>or</b> Terraform), and documentation, you get a <b>structured 7-step workflow</b> with built-in <b>WAF alignment, AVM-first code generation, and mandatory human approval gates</b>. Choose your IaC track — Bicep or Terraform — and the system routes to the right agents, subagents, and validation pipelines automatically.
</p>
<br />

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">

<details>
<summary><b>📖 Table of Contents</b></summary>
<br>

- [🤖 Agentic Workflow](#-agentic-workflow)
- [⚡ Quick Start](#-quick-start)
- [🤖 Agents Roster](#-agents-roster)
- [🧩 MCP Integration](#-mcp-integration)
- [🌐 Related Repositories](#-related-repositories)
- [🤝 Contributing & License](#-contributing--license)

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">

## 🤖 Agentic Workflow

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant C as 🎼 Conductor
    participant R as 📋 Requirements
    participant X as ⚔️ Challenger
    participant A as 🏛️ Architect
    participant IaC as 📐 IaC Plan
    participant Gen as ⚒️ IaC Code
    participant D as 🚀 Deploy
    participant W as 📚 As-Built

    Note over C: ORCHESTRATION LAYER<br/>AI prepares. Humans decide.

    %% --- Step 1: Requirements ---
    U->>C: Describe infrastructure intent
    C->>R: Translate intent into structured requirements
    R-->>C: 01-requirements.md (includes iac_tool selection)
    C->>X: Challenge requirements
    X-->>C: challenge-findings.json
    C->>U: Present requirements + challenge findings

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 HUMAN APPROVAL GATE
    U-->>C: Approve requirements
    end

    %% --- Step 2: Architecture Assessment ---
    C->>A: Assess architecture (WAF + Cost)
    Note right of A: cost-estimate-subagent<br/>handles pricing queries
    A-->>C: 02-assessment.md + 03-cost-estimate.md
    C->>X: Challenge architecture
    X-->>C: challenge-findings.json
    C->>U: Present architecture + challenge findings

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 HUMAN APPROVAL GATE
    U-->>C: Approve architecture
    end

    %% --- Step 4: Planning & Governance ---
    C->>IaC: Create implementation plan + governance
    Note right of IaC: governance-discovery-subagent<br/>queries Azure Policy via REST API
    Note right of IaC: Bicep → bicep-planner<br/>Terraform → terraform-planner
    IaC-->>C: 04-plan.md + governance constraints
    C->>X: Challenge implementation plan
    X-->>C: challenge-findings.json
    C->>U: Present plan + challenge findings

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 HUMAN APPROVAL GATE
    U-->>C: Approve plan
    end

    %% --- Step 5: IaC Generation & Validation ---
    C->>Gen: Generate IaC templates (AVM-first)
    Note right of Gen: Bicep → bicep-codegen<br/>Terraform → terraform-codegen
    Gen-->>C: infra/bicep/{project} or infra/terraform/{project}

    rect rgba(0, 150, 255, 0.08)
    Note over C,Gen: 🔍 Subagent Validation Loop
    Note right of Gen: Bicep: lint → review subagents<br/>Terraform: lint → review subagents
    alt ✅ Validation passes
        C->>U: Present templates for deployment
        rect rgba(255, 200, 0, 0.15)
        Note over U,C: 🛑 HUMAN APPROVAL GATE
        U-->>C: Approve for deployment
        end
    else ⚠️ Validation fails
        C->>Gen: Revise with feedback
    end
    end

    %% --- Step 6: Deployment ---
    C->>D: Execute deployment
    Note right of D: Bicep: whatif-subagent<br/>Terraform: plan-subagent
    D-->>C: 06-deployment-summary.md
    C->>U: Present deployment summary

    rect rgba(255, 200, 0, 0.15)
    Note over U,D: 🛑 HUMAN VERIFICATION
    U-->>C: Verify deployment
    end

    %% --- Step 7: As-Built Documentation ---
    C->>W: Generate workload documentation
    Note right of W: Reads all prior artifacts (01-06)<br/>+ queries deployed resource state
    W-->>C: 07-*.md documentation suite
    C->>U: Present as-built docs

    Note over U,W: ✅ AI Orchestrated. Human Governed. Azure Ready.
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">
<div align="right"><a href="#readme-top"><b>⬆️ Back to Top</b></a></div>

## ⚡ Quick Start

> [!IMPORTANT]
> **Prerequisites:** Docker Desktop (or Podman/Rancher), VS Code with Dev Containers, GitHub Copilot.

```bash
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
cd azure-agentic-infraops
code .
```

1. Press `F1` → **Dev Containers: Reopen in Container** _(first build: ~2-3 min, all tools pre-installed)_
2. Enable the required VS Code setting:
   ```json
   { "chat.customAgentInSubagent.enabled": true }
   ```
3. Press `Ctrl+Shift+I` → select **InfraOps Conductor** → describe your infrastructure

```text
Create a web app with Azure App Service, Key Vault, and SQL Database
```

The Conductor guides you through all 7 steps with approval gates.

📖 **[Full Quick Start Guide →](docs/quickstart.md)**

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">
<div align="right"><a href="#readme-top"><b>⬆️ Back to Top</b></a></div>

## 🤖 Agents Roster

<details>
<summary>View full agent roster</summary>

### 🎼 Conductor

| Agent                  | Role                                      |
| ---------------------- | ----------------------------------------- |
| **InfraOps Conductor** | Master orchestrator — manages all 7 steps |

### 🧠 Core Agents

Steps 1-3 and 7 are shared. Steps 4-6 have **Bicep** and **Terraform** variants.

| Step | Agent               | Role                                              |
| ---- | ------------------- | ------------------------------------------------- |
| 1    | `requirements`      | Captures functional, NFR, and compliance needs    |
| 2    | `architect`         | WAF assessment, design decisions, cost estimate   |
| 3    | `design`            | Architecture diagrams and ADRs (optional)         |
| 4b   | `bicep-planner`     | Bicep implementation planning with governance     |
| 4t   | `terraform-planner` | Terraform implementation planning with governance |
| 5b   | `bicep-codegen`     | AVM-first Bicep template generation               |
| 5t   | `terraform-codegen` | AVM-TF Terraform configuration generation         |
| 6b   | `bicep-deploy`      | Bicep deployment via deploy.ps1                   |
| 6t   | `terraform-deploy`  | Terraform deployment via bootstrap.sh / deploy.sh |
| 7    | `as-built`          | As-built documentation suite                      |

### 🕵️ Subagents

| Subagent                        | Track     | Role                                          |
| ------------------------------- | --------- | --------------------------------------------- |
| `cost-estimate-subagent`        | Shared    | Azure Pricing MCP queries                     |
| `governance-discovery-subagent` | Shared    | Azure Policy REST API discovery               |
| `bicep-lint-subagent`           | Bicep     | Syntax validation (bicep lint, bicep build)   |
| `bicep-review-subagent`         | Bicep     | Code review (AVM standards, security, naming) |
| `bicep-whatif-subagent`         | Bicep     | Deployment preview (az deployment what-if)    |
| `terraform-lint-subagent`       | Terraform | Syntax validation (terraform validate, fmt)   |
| `terraform-review-subagent`     | Terraform | Code review (AVM-TF, security, naming)        |
| `terraform-plan-subagent`       | Terraform | Deployment preview (terraform plan)           |

### 🐺 Standalone Agents

| Agent        | Role                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| `challenger` | Adversarial reviewer — challenges requirements, architecture, and plans for blind spots |
| `diagnose`   | Resource health assessment and troubleshooting                                          |

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">
<div align="right"><a href="#readme-top"><b>⬆️ Back to Top</b></a></div>

## 🧩 MCP Integration

| MCP Server                                                                                        | Purpose                                                 |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [Azure MCP Server](https://github.com/microsoft/mcp/blob/main/servers/Azure.Mcp.Server/README.md) | 40+ Azure service tools — governance, monitoring, RBAC  |
| [Pricing MCP](mcp/azure-pricing-mcp/)                                                             | Real-time Azure retail pricing for cost-aware decisions |
| [Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server)                         | Terraform registry, plan/apply, workspace management    |
| [GitHub MCP Server](https://github.com/github/github-mcp-server)                                  | Issues, PRs, repositories, Actions (MCP-first approach) |
| [Microsoft Learn MCP Server](https://github.com/MicrosoftDocs/microsoft-learn-mcp)                | Official Microsoft documentation search and fetch       |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">
<div align="right"><a href="#readme-top"><b>⬆️ Back to Top</b></a></div>

## 🌐 Related Repositories

### 🚀 [Accelerator Patterns](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator)

A curated collection of pre-built, production-ready Azure infrastructure patterns generated and
validated by the Agentic InfraOps workflow. Use it as a starting point for common workload
archetypes—each pattern ships with Bicep templates, agent artifacts, and deployment scripts.

### 🎓 [Training Workshops](https://jonathan-vella.github.io/microhack-agentic-infraops/)

Hands-on workshop material for teams and individuals learning the Agentic InfraOps workflow.
Structured labs walk you through each of the 7 steps with guided exercises, sample prompts, and
reference solutions—from first Conductor run to full deployment.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">
<div align="right"><a href="#readme-top"><b>⬆️ Back to Top</b></a></div>

## 🤝 Contributing & License

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
MIT License — see [LICENSE](LICENSE) for details.

Built upon [copilot-orchestra](https://github.com/ShepAlderson/copilot-orchestra) and
[Github-Copilot-Atlas](https://github.com/bigguy345/Github-Copilot-Atlas).

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="divider">

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/jonathan-vella">Jonathan Vella</a></p>
</div>

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/jonathan-vella/azure-agentic-infraops.svg?style=for-the-badge
[contributors-url]: https://github.com/jonathan-vella/azure-agentic-infraops/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/jonathan-vella/azure-agentic-infraops.svg?style=for-the-badge
[forks-url]: https://github.com/jonathan-vella/azure-agentic-infraops/network/members
[stars-shield]: https://img.shields.io/github/stars/jonathan-vella/azure-agentic-infraops.svg?style=for-the-badge
[stars-url]: https://github.com/jonathan-vella/azure-agentic-infraops/stargazers
[issues-shield]: https://img.shields.io/github/issues/jonathan-vella/azure-agentic-infraops.svg?style=for-the-badge
[issues-url]: https://github.com/jonathan-vella/azure-agentic-infraops/issues
[license-shield]: https://img.shields.io/github/license/jonathan-vella/azure-agentic-infraops.svg?style=for-the-badge
[license-url]: https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/LICENSE
[azure-shield]: https://img.shields.io/badge/Azure-Ready-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white
[azure-url]: https://azure.microsoft.com
[bicep-shield]: https://img.shields.io/badge/Bicep-Native-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white
[bicep-url]: https://learn.microsoft.com/azure/azure-resource-manager/bicep/
[terraform-shield]: https://img.shields.io/badge/Terraform-Supported-844FBA?style=for-the-badge&logo=terraform&logoColor=white
[terraform-url]: https://www.terraform.io/

<div align="right"><a href="#readme-top"><b>⬆️ Back to Top</b></a></div>
