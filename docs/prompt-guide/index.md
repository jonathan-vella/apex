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

  Ready-to-use prompts for all 7 workflow steps plus standalone agents.

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
| **InfraOps Conductor** | 🎼 Maestro    | All  | Orchestrates the full 8-step workflow          |
| **Requirements**       | 📜 Scribe     | 1    | Captures business and technical requirements   |
| **Architect**          | 🏛️ Oracle     | 2    | WAF assessment, cost estimates, SKU comparison |
| **Design**             | 🎨 Artisan    | 3    | Architecture diagrams and ADRs (optional step) |
| **Bicep Planner**      | 📐 Strategist | 4b   | Bicep implementation plan with governance      |
| **Terraform Planner**  | 📐 Strategist | 4t   | Terraform implementation plan with governance  |
| **Bicep CodeGen**      | ⚒️ Forge      | 5b   | Generates production-ready Bicep templates     |
| **Terraform CodeGen**  | ⚒️ Forge      | 5t   | Generates production-ready Terraform configs   |
| **Bicep Deploy**       | 🚀 Envoy      | 6b   | What-if analysis and Bicep deployment          |
| **Terraform Deploy**   | 🚀 Envoy      | 6t   | Terraform plan preview and apply               |
| **As-Built**           | 📚 Chronicler | 7    | Generates post-deployment documentation        |
| **Diagnose**           | 🔍 Sentinel   | —    | Resource health and troubleshooting            |
| **Challenger**         | ⚔️ Challenger | —    | Reviews plans for gaps and weaknesses          |

### Skills

| Skill                   | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `azure-defaults`        | Regions, tags, naming, AVM, security, governance     |
| `azure-artifacts`       | H2 template structures for agent output files        |
| `azure-diagrams`        | Python architecture diagram generation               |
| `azure-adr`             | Architecture Decision Records                        |
| `azure-bicep-patterns`  | Reusable Bicep patterns (hub-spoke, PE, diagnostics) |
| `terraform-patterns`    | Reusable Terraform patterns (hub-spoke, PE, AVM-TF)  |
| `azure-troubleshooting` | KQL templates, health checks, remediation playbooks  |
| `git-commit`            | Conventional commit message conventions              |
| `github-operations`     | GitHub issues, PRs, CLI, Actions, releases           |
| `docs-writer`           | Documentation generation and maintenance             |
| `make-skill-template`   | Scaffold new skills from a template                  |

### Subagents

| Subagent                        | Called By         | Purpose                                         |
| ------------------------------- | ----------------- | ----------------------------------------------- |
| `bicep-lint-subagent`           | Bicep CodeGen     | Runs `bicep lint` and `bicep build` validation  |
| `bicep-review-subagent`         | Bicep CodeGen     | Reviews templates against AVM standards         |
| `bicep-whatif-subagent`         | Bicep Deploy      | Runs `az deployment group what-if` preview      |
| `terraform-lint-subagent`       | Terraform CodeGen | Runs `terraform fmt`, `validate`, and TFLint    |
| `terraform-review-subagent`     | Terraform CodeGen | Reviews configs against AVM-TF standards        |
| `terraform-plan-subagent`       | Terraform Deploy  | Runs `terraform plan` change preview            |
| `cost-estimate-subagent`        | Architect         | Queries Azure Pricing MCP for real-time pricing |
| `governance-discovery-subagent` | IaC Planners      | Discovers Azure Policy constraints via REST API |

### Prompt Files

Reusable `.prompt.md` files in `.github/prompts/` provide one-click access
to pre-configured agent workflows. In VS Code, type `/` in Copilot Chat
to see available prompts.

!!! warning "Planned prompt files"

    The prompt files listed below are planned additions. Currently, only
    `doc-gardening`, `git-commit-push`, and `plan-docsPeerReview` exist
    in `.github/prompts/`. The remaining prompts will be added in a future release.

#### Core Workflow Prompts

| Prompt File           | Agent              | Step | Purpose                                     |
| --------------------- | ------------------ | ---- | ------------------------------------------- |
| `run-conductor`       | InfraOps Conductor | All  | End-to-end 8-step orchestration             |
| `plan-requirements`   | Requirements       | 1    | Business-first requirements discovery       |
| `assess-architecture` | Architect          | 2    | WAF assessment with cost estimates          |
| `design-diagram`      | Design             | 3    | Python architecture diagram generation      |
| `design-adr`          | Design             | 3    | Architecture Decision Record creation       |
| `plan-bicep`          | Bicep Planner      | 4b   | Governance discovery and Bicep planning     |
| `plan-terraform`      | Terraform Planner  | 4t   | Governance discovery and Terraform planning |
| `generate-bicep`      | Bicep CodeGen      | 5b   | AVM-first Bicep template generation         |
| `generate-terraform`  | Terraform CodeGen  | 5t   | AVM-TF Terraform config generation          |
| `deploy`              | Bicep Deploy       | 6b   | What-if analysis and Bicep deployment       |
| `deploy-terraform`    | Terraform Deploy   | 6t   | Terraform plan preview and apply            |
| `generate-docs`       | As-Built           | 7    | As-built documentation suite                |
| `diagnose-resources`  | Diagnose           | —    | Resource health diagnostics                 |

#### Demo Prompts

| Prompt File                 | Agent              | Purpose                                      |
| --------------------------- | ------------------ | -------------------------------------------- |
| `conductor-demo`            | InfraOps Conductor | Full workflow demo (Static Web App scenario) |
| `plan-req-demo-interactive` | Requirements       | Interactive EU ecommerce migration demo      |
