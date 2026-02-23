# Glossary

> [Current Version](../VERSION.md) | Quick reference for terms used throughout Agentic InfraOps documentation.

---

## A

### ADR (Architecture Decision Record)

A document that captures an important architectural decision along with its context and consequences.
Used to record "why" decisions were made for future reference.

📁 **Output**: `agent-output/{project}/03-des-adr-*.md`, `07-ab-adr-*.md`

### Agent (Custom)

A specialized AI assistant defined in `.github/agents/` that focuses on specific workflow steps.
Invoked via `Ctrl+Shift+A`. This project includes agents: requirements, architect, design, bicep-plan,
bicep-code, deploy, diagnose, InfraOps Conductor.

📁 **See**: [.github/agents/](../.github/agents/)

### Agentic InfraOps

The methodology of using coordinated AI agents and skills to transform requirements into deploy-ready
Azure infrastructure. Combines GitHub Copilot with custom agents and reusable skills.

### AVM (Azure Verified Modules)

Microsoft's official library of pre-built, tested Bicep modules that follow Azure best
practices. Using AVM modules ensures policy compliance and reduces custom code.

🔗 **External**: [Azure Verified Modules Registry](https://aka.ms/avm)

---

## B

### Bicep

Azure's domain-specific language (DSL) for deploying Azure resources declaratively. Compiles to ARM
templates but with cleaner syntax and better tooling support.

🔗 **External**: [Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)

### Bicep Lint

Static analysis tool that checks Bicep files for best practices, security issues, and common mistakes.
Run with `bicep lint main.bicep` or automatically via VS Code extension.

---

## C

### Copilot Chat

The conversational interface for GitHub Copilot in VS Code. Accessed via `Ctrl+Shift+I`. Supports
custom agents via the agent picker dropdown (`Ctrl+Shift+A`).

### Conductor

See [InfraOps Conductor](#infraops-conductor).

---

## D

### Design Agent

Step 3 agent that generates architecture diagrams and Architecture Decision Records (ADRs).
Optional step in the workflow. Uses `azure-diagrams` and `azure-adr` skills.

📁 **Output**: `agent-output/{project}/03-des-*.{py,png,md}`

### Dev Container

A Docker-based development environment defined in `.devcontainer/`. Provides consistent tooling
(Azure CLI, Bicep, PowerShell) across all machines.

🔗 **External**: [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)

---

## G

### Governance Constraints

Azure Policies and organizational rules that affect resource deployment. Discovered during the
planning step and documented in `04-governance-constraints.md`.

---

## H

### HIPAA (Health Insurance Portability and Accountability Act)

US regulation governing protected health information (PHI). Azure provides HIPAA-compliant services
when properly configured. S04 Service Validation scenario demonstrates HIPAA-compliant architecture.

### Hub-Spoke Network

Azure networking pattern where a central "hub" VNet contains shared services (firewall, VPN gateway)
and "spoke" VNets contain workloads. Spokes peer with the hub for connectivity.

---

## I

### InfraOps Conductor

The master orchestrator agent that coordinates all 7 steps of the infrastructure workflow with
mandatory human approval gates. Implements the Conductor pattern from VS Code 1.109's agent
orchestration features.

📁 **See**: [.github/agents/01-conductor.agent.md](../.github/agents/01-conductor.agent.md)

### IaC (Infrastructure as Code)

Practice of managing infrastructure through code files (Bicep, ARM) rather than manual
portal clicks. Enables version control, automation, and repeatability.

---

## K

### KQL (Kusto Query Language)

Query language used in Azure Monitor, Log Analytics, and Application Insights. Used for
troubleshooting and diagnostics (see S05 Troubleshooting scenario).

🔗 **External**: [KQL Reference](https://learn.microsoft.com/azure/data-explorer/kusto/query/)

---

## M

### MCP (Model Context Protocol)

Protocol for extending AI assistants with external tools and data sources. The Azure Pricing MCP
server provides real-time Azure pricing to Copilot.

📁 **See**: [mcp/azure-pricing-mcp/](../mcp/azure-pricing-mcp/)

### MTTR (Mean Time To Recovery)

Average time to restore service after an incident. Key SRE metric. Copilot-assisted troubleshooting
reduces MTTR by 73-85% (see Time Savings Evidence).

---

## N

### NSG (Network Security Group)

Azure resource that filters network traffic with allow/deny rules. Applied to subnets or NICs.
Essential for microsegmentation and defense-in-depth.

---

## P

### PCI-DSS (Payment Card Industry Data Security Standard)

Security standard for organizations handling credit card data. S04 Service Validation scenario
demonstrates PCI-DSS compliant architecture patterns.

### Private Endpoint

Azure feature that assigns a private IP address to a PaaS service (Storage, SQL, Key Vault),
removing public internet exposure. Essential for zero-trust architectures.

---

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
Skills are organized across document creation, workflow automation, and utility categories.

📁 **See**: [.github/skills/](../.github/skills/)

### Subagent

A specialized validation agent invoked by other agents for specific tasks (lint, what-if, review).
Three exist: `bicep-lint-subagent`, `bicep-review-subagent`, `bicep-whatif-subagent`.

📁 **See**: [.github/agents/\_subagents/](../.github/agents/_subagents/)

---

## T

### Tags (Azure Resource Tags)

Key-value pairs applied to Azure resources for organization, cost tracking, and policy enforcement.
Baseline tags: Environment, ManagedBy, Project, Owner.
Governance constraints may require additional tags.
See `bicep-code-best-practices.instructions.md` for the canonical tag rule.

---

## U

### UAT (User Acceptance Testing)

Final testing phase where end users verify the system meets business requirements.

---

## W

### WAF (Well-Architected Framework)

Microsoft's guidance for building reliable, secure, efficient Azure workloads. Five pillars:
Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency.

🔗 **External**: [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)

### What-If Deployment

Azure deployment preview that shows what resources will be created, modified, or deleted without
making actual changes. Run with `az deployment group create --what-if`.

---

## Numbers & Symbols

### 7-Step Agentic Workflow

The core Agentic InfraOps workflow: `requirements` → `architect` → Design Artifacts →
`bicep-plan` → `bicep-code` → `deploy` → Documentation. Each step produces artifacts in `agent-output/`.
Steps 3 (Design Artifacts) and 7 (Documentation) use skills rather than agents.

📁 **See**: [Workflow Guide](workflow.md)

---

## Quick Reference Table

| Term    | Full Name                                    | Category       |
| ------- | -------------------------------------------- | -------------- |
| ADR     | Architecture Decision Record                 | Documentation  |
| Agent   | Copilot Custom Agent                         | AI             |
| AVM     | Azure Verified Modules                       | IaC            |
| IaC     | Infrastructure as Code                       | Methodology    |
| KQL     | Kusto Query Language                         | Monitoring     |
| MCP     | Model Context Protocol                       | AI Integration |
| MTTR    | Mean Time To Recovery                        | Operations     |
| NSG     | Network Security Group                       | Networking     |
| PCI-DSS | Payment Card Industry Data Security Standard | Compliance     |
| SBOM    | Software Bill of Materials                   | Security       |
| Skill   | Copilot Skill Module                         | AI             |
| UAT     | User Acceptance Testing                      | QA             |
| WAF     | Well-Architected Framework                   | Architecture   |

---

_Missing a term? [Open an issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues) or add it via PR._
