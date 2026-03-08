<!-- MkDocs landing page — source of truth is this file -->

# Agentic InfraOps

Transform Azure infrastructure requirements into deploy-ready IaC code (Bicep or Terraform)
using coordinated AI agents and reusable skills, aligned with the Azure Well-Architected
Framework and Azure Verified Modules.

[Get Started](quickstart.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/jonathan-vella/azure-agentic-infraops){ .md-button }

---

## Explore the Documentation

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **Getting Started**

    ---

    Set up your dev container and run your first agent workflow in 10 minutes.

    [:octicons-arrow-right-24: Quickstart](quickstart.md)

-   :material-cog-outline:{ .lg .middle } **How It Works**

    ---

    Understand the multi-agent architecture, skills system, and 7-step workflow.

    [:octicons-arrow-right-24: How It Works](how-it-works.md)

-   :material-chart-timeline-variant:{ .lg .middle } **Workflow**

    ---

    The 7-step journey from requirements to deployed infrastructure with approval gates.

    [:octicons-arrow-right-24: Workflow](workflow.md)

-   :material-console:{ .lg .middle } **Prompt Guide**

    ---

    Ready-to-use prompt examples for every agent and skill.

    [:octicons-arrow-right-24: Prompt Guide](prompt-guide/index.md)

-   :material-wrench-outline:{ .lg .middle } **Troubleshooting**

    ---

    Common issues, diagnostic decision tree, and solutions.

    [:octicons-arrow-right-24: Troubleshooting](troubleshooting.md)

-   :material-book-open-variant:{ .lg .middle } **Glossary**

    ---

    Quick reference for terms used throughout the documentation.

    [:octicons-arrow-right-24: Glossary](GLOSSARY.md)

</div>

---

## Key Facts

| | |
|---|---|
| **Agents** | 15 primary + 9 validation subagents |
| **Skills** | 20 reusable domain knowledge modules |
| **IaC Tracks** | Bicep and Terraform (dual-track) |
| **MCP Servers** | Azure, Pricing, Terraform, GitHub, Microsoft Learn |
| **Workflow** | 7 steps with mandatory approval gates |

## What's New

The project now supports **two parallel IaC tracks** — Bicep and Terraform — sharing
common requirements, architecture, and design steps (1-3) before diverging into
track-specific planning, code generation, and deployment (steps 4-6).

- **Dual IaC Track** — choose Bicep or Terraform at requirements time; the Conductor routes automatically
- **Challenger Agent** — adversarial reviewer that challenges requirements, architecture, and plans
- **20 Skills** — including `terraform-patterns`, `context-optimizer`, `workflow-engine`

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/jonathan-vella/azure-agentic-infraops/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jonathan-vella/azure-agentic-infraops/discussions)
- **Troubleshooting**: [troubleshooting.md](troubleshooting.md)

