# Glossary

Quick reference for terms used throughout Agentic InfraOps documentation.

## A

### ADR (Architecture Decision Record)

A document that captures an important architectural decision along with its context and consequences.
Used to record "why" decisions were made for future reference.

📁 **Output**: `agent-output/{project}/03-des-adr-*.md`, `07-ab-adr-*.md`

### Agent (Custom)

A specialized AI assistant defined in `.github/agents/` that focuses on specific workflow steps.
Invoked via `Ctrl+Shift+A`. This project includes 15 top-level agents (including two Conductor
variants and a Context Optimizer) plus 9 validation subagents.

📁 **See**: [.github/agents/](https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/.github/agents)

### Agentic InfraOps

The methodology of using coordinated AI agents and skills to transform requirements into deploy-ready
Azure infrastructure. Combines GitHub Copilot with custom agents and reusable skills.

### AVM (Azure Verified Modules)

Microsoft's official library of pre-built, tested IaC modules that follow Azure best
practices. Available for both Bicep (`br/public:avm/res/`) and Terraform
(`registry.terraform.io/Azure/avm-res-*/azurerm`). Using AVM modules ensures
policy compliance and reduces custom code.

🔗 **External**: [Azure Verified Modules Registry](https://aka.ms/avm)

### AVM-TF (Azure Verified Modules for Terraform)

The Terraform variant of Azure Verified Modules, published to the Terraform Registry
under the `Azure` namespace. Module sources follow the pattern
`Azure/avm-res-<provider>-<resource>/azurerm`.

🔗 **External**: [AVM-TF on Terraform Registry](https://registry.terraform.io/namespaces/Azure)

## B

### Bicep

Azure's domain-specific language (DSL) for deploying Azure resources declaratively. Compiles to ARM
templates but with cleaner syntax and better tooling support.

🔗 **External**: [Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)

### Bicep Lint

Static analysis tool that checks Bicep files for best practices, security issues, and common mistakes.
Run with `bicep lint main.bicep` or automatically via VS Code extension.

## C

### Challenger

Adversarial review agent that challenges requirements, architecture assessments, and
implementation plans. Finds untested assumptions, governance gaps, WAF blind spots,
and architectural weaknesses. Returns structured JSON findings with severity ratings.
Auto-invoked by the Conductor after Steps 1, 2, and 4.

📁 **See**: [.github/agents/10-challenger.agent.md](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/10-challenger.agent.md)

### Copilot Chat

The conversational interface for GitHub Copilot in VS Code. Accessed via `Ctrl+Shift+I`. Supports
custom agents via the agent picker dropdown (`Ctrl+Shift+A`).

### Conductor

See [InfraOps Conductor](#infraops-conductor).

### Content Tabs

A MkDocs Material feature that renders tabbed content blocks using `=== "Tab Name"` syntax.
Used in this documentation to show Bicep and Terraform examples side-by-side without
duplicating page structure.

🔗 **External**: [MkDocs Material Content Tabs](https://squidfunk.github.io/mkdocs-material/reference/content-tabs/)

### Context Shredding

Runtime context compression technique for agents approaching model context limits.
Defines three tiers — `full`, `summarized`, and `minimal` — with per-artifact
compression templates. Managed by the `context-shredding` skill.

📁 **See**: `.github/skills/context-shredding/SKILL.md`

### Circuit Breaker

A failure-handling pattern in the `iac-common` skill that defines mandatory stopping
rules for deploy agents. Classifies failures into 6 categories with anomaly detection
thresholds to prevent cascading deployment failures.

📁 **See**: [.github/skills/iac-common/](https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/.github/skills/iac-common)

## D

### Design Agent

Step 3 agent that generates architecture diagrams and Architecture Decision Records (ADRs).
Optional step in the workflow. Uses `azure-diagrams` and `azure-adr` skills.

📁 **Output**: `agent-output/{project}/03-des-*.{py,png,md}`

### Dev Container

A Docker-based development environment defined in `.devcontainer/`. Provides consistent tooling
(Azure CLI, Bicep, PowerShell) across all machines.

🔗 **External**: [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)

## F

### Fast Path

An experimental conductor variant (`01-Conductor (Fast Path)`) optimized for simple Azure
projects with 3 or fewer resources, single environment, and no custom policies. Combines
the Plan and Code steps with a single-pass review for faster delivery.

📁 **See**: [.github/agents/01-conductor-fastpath.agent.md](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/01-conductor-fastpath.agent.md)

## G

### Governance Constraints

Azure Policies and organizational rules that affect resource deployment. Discovered during the
planning step and documented in `04-governance-constraints.md`.

## H

### HCL (HashiCorp Configuration Language)

The declarative language used by Terraform to define infrastructure resources.
File extension: `.tf`. Supports variables, modules, data sources, and provider blocks.

🔗 **External**: [HCL Documentation](https://developer.hashicorp.com/terraform/language)

### HIPAA (Health Insurance Portability and Accountability Act)

US regulation governing protected health information (PHI). Azure provides HIPAA-compliant services
when properly configured. S04 Service Validation scenario demonstrates HIPAA-compliant architecture.

### Hub-Spoke Network

Azure networking pattern where a central "hub" VNet contains shared services (firewall, VPN gateway)
and "spoke" VNets contain workloads. Spokes peer with the hub for connectivity.

## I

### InfraOps Conductor

The master orchestrator agent that coordinates all 7 steps of the infrastructure workflow with
mandatory human approval gates. Implements the Conductor pattern from VS Code 1.109's agent
orchestration features.

📁 **See**: [.github/agents/01-conductor.agent.md](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/01-conductor.agent.md)

### IaC (Infrastructure as Code)

Practice of managing infrastructure through code files (Bicep, Terraform, ARM) rather than manual
portal clicks. Enables version control, automation, and repeatability. This project supports two
IaC tracks: **Bicep** (Azure-native DSL) and **Terraform** (multi-cloud HCL).

## K

### KQL (Kusto Query Language)

Query language used in Azure Monitor, Log Analytics, and Application Insights. Used for
troubleshooting and diagnostics (see S05 Troubleshooting scenario).

🔗 **External**: [KQL Reference](https://learn.microsoft.com/azure/data-explorer/kusto/query/)

## M

### MCP (Model Context Protocol)

Protocol for extending AI assistants with external tools and data sources. The Azure Pricing MCP
server provides real-time Azure pricing to Copilot.

📁 **See**: [mcp/azure-pricing-mcp/](https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/mcp/azure-pricing-mcp)

### MTTR (Mean Time To Recovery)

Average time to restore service after an incident. Key SRE metric. Copilot-assisted troubleshooting
reduces MTTR by 73-85% (see Time Savings Evidence).

## N

### NSG (Network Security Group)

Azure resource that filters network traffic with allow/deny rules. Applied to subnets or NICs.
Essential for microsegmentation and defense-in-depth.

## P

### PCI-DSS (Payment Card Industry Data Security Standard)

Security standard for organizations handling credit card data. S04 Service Validation scenario
demonstrates PCI-DSS compliant architecture patterns.

### Private Endpoint

Azure feature that assigns a private IP address to a PaaS service (Storage, SQL, Key Vault),
removing public internet exposure. Essential for zero-trust architectures.

## S

### SBOM (Software Bill of Materials)

Inventory of all software components in an application, including dependencies and versions.
Required for supply chain security. S06 SBOM Generator scenario demonstrates SBOM generation.

### SI Partner (System Integrator Partner)

Microsoft partner organization that implements Azure solutions for customers. Primary audience
for Agentic InfraOps methodology.

### Skill (Copilot)

A reusable knowledge module stored in `.github/skills/` that agents can invoke. Unlike agents,
skills don't have their own chat persona — they provide domain knowledge that agents use.
14 skills are organized across conventions, document creation, infrastructure patterns,
workflow automation, troubleshooting, and Microsoft docs integration categories.

📁 **See**: [.github/skills/](https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/.github/skills)

### Subagent

A specialized validation agent invoked by other agents for specific tasks (lint, what-if/plan,
review). Eight exist: `cost-estimate-subagent`, `governance-discovery-subagent`,
`bicep-lint-subagent`, `bicep-review-subagent`, `bicep-whatif-subagent`,
`terraform-lint-subagent`, `terraform-review-subagent`, `terraform-plan-subagent`.

📁 **See**: [.github/agents/\_subagents/](https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/.github/agents/_subagents)

## T

### Tags (Azure Resource Tags)

Key-value pairs applied to Azure resources for organization, cost tracking, and policy enforcement.
Baseline tags: Environment, ManagedBy, Project, Owner.
Governance constraints may require additional tags.
See `bicep-code-best-practices.instructions.md` or `terraform-code-best-practices.instructions.md`
for the canonical tag rule.

### Terraform

HashiCorp's open-source Infrastructure as Code tool using HCL (HashiCorp Configuration Language).
Supports multi-cloud deployments. In this project, Terraform is the alternative IaC track
alongside Bicep, sharing requirements, architecture, and design steps (1-3) before diverging
into Terraform-specific planning, code generation, and deployment (steps 4-6).

Provider pin: `~> 4.0` (AzureRM). Backend: Azure Storage Account.

🔗 **External**: [Terraform Documentation](https://developer.hashicorp.com/terraform)

### TFLint

A pluggable Terraform linter that enforces best practices, naming conventions, and
resource-specific rules. Used by the `terraform-lint-subagent` during Step 5 validation.

🔗 **External**: [TFLint](https://github.com/terraform-linters/tflint)

### Terraform State

The JSON file that tracks the mapping between Terraform configuration and real-world
resources. Stored remotely in an Azure Storage Account for team collaboration.
State locking prevents concurrent modifications.

## U

### UAT (User Acceptance Testing)

Final testing phase where end users verify the system meets business requirements.

## W

### WAF (Well-Architected Framework)

Microsoft's guidance for building reliable, secure, efficient Azure workloads. Five pillars:
Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency.

🔗 **External**: [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)

### What-If Deployment

Azure deployment preview that shows what resources will be created, modified, or deleted without
making actual changes. Run with `az deployment group create --what-if`.

## Numbers & Symbols

### 7-Step Agentic Workflow

The core Agentic InfraOps workflow: `requirements` → `architect` → Design Artifacts →
IaC Plan → IaC Code → Deploy → Documentation. Steps 1-3 and 7 are shared;
steps 4-6 diverge into **Bicep track** (`bicep-planner` → `bicep-codegen` → `bicep-deploy`)
or **Terraform track** (`terraform-planner` → `terraform-codegen` → `terraform-deploy`).
Each step produces artifacts in `agent-output/`.

📁 **See**: [Workflow Guide](workflow.md)

## Quick Reference Table

| Term    | Full Name                                    | Category       |
| ------- | -------------------------------------------- | -------------- |
| ADR     | Architecture Decision Record                 | Documentation  |
| Agent   | Copilot Custom Agent                         | AI             |
| AVM     | Azure Verified Modules                       | IaC            |
| AVM-TF  | Azure Verified Modules for Terraform         | IaC            |
| HCL     | HashiCorp Configuration Language             | IaC            |
| IaC     | Infrastructure as Code                       | Methodology    |
| KQL     | Kusto Query Language                         | Monitoring     |
| MCP     | Model Context Protocol                       | AI Integration |
| MTTR    | Mean Time To Recovery                        | Operations     |
| NSG     | Network Security Group                       | Networking     |
| PCI-DSS | Payment Card Industry Data Security Standard | Compliance     |
| SBOM    | Software Bill of Materials                   | Security       |
| Skill   | Copilot Skill Module                         | AI             |
| TFLint  | Terraform Linter                             | IaC            |
| UAT     | User Acceptance Testing                      | QA             |
| WAF     | Well-Architected Framework                   | Architecture   |

_Missing a term? [Open an issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues) or add it via PR._
