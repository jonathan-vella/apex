---
toc_depth: 2
---

<div align="center">
  <img src="../assets/images/hero-prompt-guide.jpg"
    width="100%" height="250" style="object-fit: cover; border-radius: 10px;"
    alt="Digital code matrix visualization"/>
</div>

# :material-console: Prompt Guide

Best-practices prompt examples for all Agentic InfraOps agents and skills.

This guide provides ready-to-use prompt examples for every agent and skill in the
Agentic InfraOps project. It is written for **end users** — those who interact with
the agents through VS Code Copilot Chat to design, build, and deploy Azure
infrastructure.

**Prerequisites**: Complete the [Quickstart](../quickstart.md) first
(Dev Container running, subagent invocation enabled).

<div class="grid cards" markdown>

- :material-lightbulb:{ .lg .middle } **Best Practices**

  ***

  How to write effective prompts — patterns, anti-patterns, and validation tips.

  [:octicons-arrow-right-24: Best practices](best-practices.md)

- :material-format-list-numbered:{ .lg .middle } **Workflow Prompts**

  ***

  Ready-to-use prompts for every workflow step plus standalone agents.

  [:octicons-arrow-right-24: Workflow prompts](workflow-prompts.md)

- :material-bookshelf:{ .lg .middle } **Skill & Subagent Reference**

  ***

  Reference prompts for each skill and subagent, plus advanced patterns.

  [:octicons-arrow-right-24: Reference](reference.md)

</div>

## Quick Reference

### Agents

| Agent                  | Codename      | Step | Purpose                                        |
| ---------------------- | ------------- | ---- | ---------------------------------------------- |
| **Orchestrator** | 🧠 Orchestrator    | All  | Orchestrates the full multi-step workflow      |
| **Requirements**       | 📜 Scribe     | 1    | Captures business and technical requirements   |
| **Architect**          | 🏛️ Oracle     | 2    | WAF assessment, cost estimates, SKU comparison |
| **Design**             | 🎨 Artisan    | 3    | Architecture diagrams and ADRs (optional step) |
| **IaC Planner**      | 📐 Strategist | 4b   | Bicep implementation plan with governance      |
| **IaC Planner**  | 📐 Strategist | 4t   | Terraform implementation plan with governance  |
| **Bicep CodeGen**      | ⚒️ Forge      | 5b   | Generates production-ready Bicep templates     |
| **Terraform CodeGen**  | ⚒️ Forge      | 5t   | Generates production-ready Terraform configs   |
| **Bicep Deploy**       | 🚀 Envoy      | 6b   | What-if analysis and Bicep deployment          |
| **Terraform Deploy**   | 🚀 Envoy      | 6t   | Terraform plan preview and apply               |
| **As-Built**           | 📚 Chronicler | 7    | Generates post-deployment documentation        |
| **Diagnose**           | 🔍 Sentinel   | —    | Resource health and troubleshooting            |
| **Challenger**         | ⚔️ Challenger | —    | Reviews plans for gaps and weaknesses          |

### Skills

| Skill                  | Purpose                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| `azure-defaults`       | Regions, tags, naming, AVM, security, governance                                |
| `azure-artifacts`      | H2 template structures for agent output files                                   |
| `drawio`               | Draw.io architecture diagrams via MCP server (700+ Azure icons, batch creation) |
| `excalidraw`           | Hand-drawn whiteboarding, brainstorming, wireframes                             |
| `python-diagrams`      | WAF/cost/compliance charts (matplotlib)                                         |
| `mermaid`              | Inline Mermaid diagrams for markdown                                            |
| `azure-adr`            | Architecture Decision Records                                                   |
| `azure-bicep-patterns` | Reusable Bicep patterns (hub-spoke, PE, diagnostics)                            |
| `terraform-patterns`   | Reusable Terraform patterns (hub-spoke, PE, AVM-TF)                             |
| `azure-diagnostics`    | KQL templates, health checks, remediation playbooks                             |
| `github-operations`    | Branch naming, conventional commits, PRs, CLI                                   |
| `github-operations`    | GitHub issues, PRs, CLI, Actions, releases                                      |
| `docs-writer`          | Documentation generation and maintenance                                        |
| `make-skill-template`  | Scaffold new skills from a template                                             |

### Subagents

| Subagent                        | Called By         | Purpose                                         |
| ------------------------------- | ----------------- | ----------------------------------------------- |
| `bicep-validate-subagent`       | Bicep CodeGen     | Lint + AVM/security code review                 |
| `bicep-whatif-subagent`         | Bicep Deploy      | Runs `az deployment group what-if` preview      |
| `terraform-validate-subagent`   | Terraform CodeGen | Lint + AVM-TF/security code review              |
| `iac-planner-subagent`       | Terraform Deploy  | Runs `terraform plan` change preview            |
| `cost-estimate-subagent`        | Architect         | Queries Azure Pricing MCP for real-time pricing |
| `governance-discovery-subagent` | IaC Planners      | Discovers Azure Policy constraints via REST API |

### Prompt Files

Reusable `.prompt.md` files in `.github/prompts/` provide one-click access
to pre-configured agent workflows. In VS Code, type `/` in Copilot Chat
to see available prompts.

#### Core Workflow Prompts

| Prompt File             | Agent              | Step | Purpose                               |
| ----------------------- | ------------------ | ---- | ------------------------------------- |
| `01-orchestrator`          | Orchestrator | All  | End-to-end multi-step orchestration   |
| `02-requirements`       | Requirements       | 1    | Business-first requirements discovery |
| `03-architect`          | Architect          | 2    | WAF assessment with cost estimates    |
| `04-design`             | Design             | 3    | Python architecture diagrams and ADRs |
| `04g-governance`        | Governance         | 3.5  | Azure Policy governance discovery     |
| `05-iac-planner`        | IaC Planner        | 4    | Governance discovery and IaC planning |
| `06b-bicep-codegen`     | Bicep CodeGen      | 5b   | AVM-first Bicep template generation   |
| `06t-terraform-codegen` | Terraform CodeGen  | 5t   | AVM-TF Terraform config generation    |
| `07b-bicep-deploy`      | Bicep Deploy       | 6b   | What-if analysis and Bicep deployment |
| `07t-terraform-deploy`  | Terraform Deploy   | 6t   | Terraform plan preview and apply      |
| `08-as-built`           | As-Built           | 7    | As-built documentation suite          |
| `diagnose-resource`     | Diagnose           | —    | Resource health diagnostics           |

#### Utility Prompts

| Prompt File           | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `git-commit-push`     | Diff-aware conventional commit and push      |
| `doc-gardening`       | Documentation maintenance and freshness      |
| `plan-docsPeerReview` | Multi-pass documentation peer review         |
| `challenger-review`   | Standalone adversarial review of an artifact |
| `context-audit`       | Agent context window utilization audit       |
| `resume-workflow`     | Resume an interrupted workflow session       |
