<!-- MkDocs landing page — source of truth is this file -->

# Agentic InfraOps

![Version](https://img.shields.io/badge/version-0.10.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Transform Azure infrastructure requirements into deploy-ready IaC code (Bicep or Terraform)
using coordinated AI agents and reusable skills, aligned with the Azure Well-Architected
Framework and Azure Verified Modules.

**Who is this for?** DevOps engineers, platform engineers, and IT Pros who want to
accelerate Azure infrastructure delivery with AI-assisted workflows.

[Get Started](quickstart.md){ .md-button .md-button--primary }
[Use the Template](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator){ .md-button }

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant C as 🎼 Conductor Agent
    participant Agents as 🤖 Agents
    participant X as ⚔️ Challenger Agent

    Note over C: AI prepares · Humans decide

    U->>C: Describe infrastructure intent
    C->>Agents: 📋 Gather requirements
    Agents-->>C: 01-requirements.md
    C->>X: Challenge requirements
    X-->>C: Findings
    C->>U: Present for review

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 APPROVAL GATE
    U-->>C: ✅ Approve
    end

    C->>Agents: 🏛️ Architecture + 💰 Cost
    Agents-->>C: 02-assessment.md
    C->>X: Challenge architecture
    C->>U: Present for review

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 APPROVAL GATE
    U-->>C: ✅ Approve
    end

    C->>Agents: 📐 IaC Plan + Governance
    Note right of Agents: Bicep or Terraform track
    Agents-->>C: 04-plan.md + constraints
    C->>X: Challenge plan
    C->>U: Present for review

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 APPROVAL GATE
    U-->>C: ✅ Approve
    end

    C->>Agents: ⚒️ Generate IaC (AVM-first)
    Note right of Agents: lint → review → validate
    Agents-->>C: infra/{bicep,terraform}/{project}

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 APPROVAL GATE
    U-->>C: ✅ Approve for deploy
    end

    C->>Agents: 🚀 Deploy to Azure
    Note right of Agents: what-if / plan preview first
    Agents-->>C: 06-deployment-summary.md

    rect rgba(255, 200, 0, 0.15)
    Note over U,C: 🛑 VERIFICATION
    U-->>C: ✅ Verify resources
    end

    C->>Agents: 📚 Generate as-built docs
    Agents-->>C: 07-*.md documentation suite
    C->>U: Present complete documentation

    Note over U,Agents: ✅ AI Orchestrated · Human Governed · Azure Ready
```

---

## :material-compass-outline: Explore the Documentation

<div class="grid cards" markdown>

- :material-rocket-launch:{ .lg .middle } **Getting Started**

  ***

  Set up from the Accelerator template and run your first agent workflow in 10 minutes.

  [:octicons-arrow-right-24: Quickstart](quickstart.md)

- :material-cog-outline:{ .lg .middle } **How It Works**

  ***

  Understand the multi-agent architecture, skills system, and 8-step workflow.

  [:octicons-arrow-right-24: How It Works](how-it-works/index.md)

- :material-chart-timeline-variant:{ .lg .middle } **Workflow**

  ***

  The 8-step journey from requirements to deployed infrastructure with approval gates.

  [:octicons-arrow-right-24: Workflow](workflow.md)

- :material-console:{ .lg .middle } **Prompt Guide**

  ***

  Ready-to-use prompt examples for every agent and skill.

  [:octicons-arrow-right-24: Prompt Guide](prompt-guide/index.md)

- :material-wrench-outline:{ .lg .middle } **Troubleshooting**

  ***

  Common issues, diagnostic decision tree, and solutions.

  [:octicons-arrow-right-24: Troubleshooting](troubleshooting.md)

- :material-book-open-variant:{ .lg .middle } **Glossary**

  ***

  Quick reference for terms used throughout the documentation.

  [:octicons-arrow-right-24: Glossary](GLOSSARY.md)

- :material-frequently-asked-questions:{ .lg .middle } **FAQ**

  ***

  Answers to common questions about the project, models, and customization.

  [:octicons-arrow-right-24: FAQ](faq.md)

- :material-heart-outline:{ .lg .middle } **Contributing**

  ***

  Guidelines for contributing agents, skills, documentation, and IaC patterns.

  [:octicons-arrow-right-24: Contributing](CONTRIBUTING.md)

</div>

---

## :material-chart-box-outline: Key Facts

|                 |                                       |
| --------------- | ------------------------------------- |
| **Agents**      | 16 primary + 11 subagents             |
| **Skills**      | Reusable domain knowledge modules     |
| **IaC Tracks**  | Bicep and Terraform (dual-track)      |
| **MCP Servers** | Azure, Pricing, Terraform, GitHub     |
| **Workflow**    | 8 steps with mandatory approval gates |

## :material-star-outline: Highlights

See the [Changelog](CHANGELOG.md) for the full release history.

- **v0.10.0** — Workflow Engine DAG, Context Shredding, Circuit Breaker pattern, session lock model
- **v0.9.0** — Dual IaC Track (Bicep + Terraform), Challenger Agent, 20 skills, Fast Path Conductor

---

## :material-lifebuoy: Getting Help

- **Issues**: [GitHub Issues](https://github.com/jonathan-vella/azure-agentic-infraops/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jonathan-vella/azure-agentic-infraops/discussions)
- **Troubleshooting**: [Troubleshooting Guide](troubleshooting.md)
- **MicroHack**: [Hands-on guided challenge](https://jonathan-vella.github.io/microhack-agentic-infraops/)
  — build Azure infrastructure end-to-end using AI agents

---

## :material-presentation-play: Resources

<div class="grid cards" markdown>

- :material-youtube:{ .lg .middle } **Watch the Demo**

  ***

  See Agentic InfraOps in action — full workflow walkthrough from requirements to deployment.

  <div class="video-wrapper">
    <iframe width="100%" height="315"
      src="https://www.youtube.com/embed/Hao3F52sZUc"
      title="Agentic InfraOps Demo" frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen></iframe>
  </div>

- :material-presentation:{ .lg .middle } **Presentation Deck**

  ***

  Download the slide deck for stakeholder presentations and team introductions.

  [:material-download: Download PPTX](assets/downloads/agentic-infraops.PPTX){ .md-button }

</div>
