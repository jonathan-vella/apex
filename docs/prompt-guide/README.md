# Prompt Guide

> Version 8.2.0 | Best-practices prompt examples for all Agentic InfraOps agents and skills

This guide provides ready-to-use prompt examples for every agent and skill in the
Agentic InfraOps project. It is written for **end users** — those who interact with
the agents through VS Code Copilot Chat to design, build, and deploy Azure
infrastructure.

**Prerequisites**: Complete the [Quickstart](../quickstart.md) first
(Dev Container running, subagent invocation enabled).

---

## Quick Reference

### Agents

| Agent | Persona | Step | Purpose |
| --- | --- | --- | --- |
| **InfraOps Conductor** | 🎼 Maestro | All | Orchestrates the full 7-step workflow |
| **Requirements** | 📜 Scribe | 1 | Captures business and technical requirements |
| **Architect** | 🏛️ Oracle | 2 | WAF assessment, cost estimates, SKU comparison |
| **Design** | 🎨 Artisan | 3 | Architecture diagrams and ADRs (optional step) |
| **Bicep Plan** | 📐 Strategist | 4 | Implementation plan with governance discovery |
| **Bicep Code** | ⚒️ Forge | 5 | Generates production-ready Bicep templates |
| **Deploy** | 🚀 Envoy | 6 | What-if analysis and phased deployment |
| **Diagnose** | 🔍 Sentinel | — | Resource health and troubleshooting |

### Skills

| Skill | Purpose |
| --- | --- |
| `azure-defaults` | Regions, tags, naming, AVM, security, governance |
| `azure-artifacts` | H2 template structures for agent output files |
| `azure-diagrams` | Python architecture diagram generation |
| `azure-adr` | Architecture Decision Records |
| `git-commit` | Conventional commit message conventions |
| `github-operations` | GitHub issues, PRs, CLI, Actions, releases |
| `docs-writer` | Documentation generation and maintenance |
| `make-skill-template` | Scaffold new skills from a template |

### Subagents

| Subagent | Called By | Purpose |
| --- | --- | --- |
| `bicep-lint-subagent` | Bicep Code | Runs `bicep lint` and `bicep build` validation |
| `bicep-review-subagent` | Bicep Code | Reviews templates against AVM standards |
| `bicep-whatif-subagent` | Bicep Code | Runs `az deployment group what-if` preview |

---

## General Prompting Best Practices

### Choose the Right Interface

| Interface | Best For |
| --- | --- |
| **Inline suggestions** (Tab) | Completing code snippets, variable names, repetitive blocks |
| **Copilot Chat** | Questions, generating larger sections, debugging |
| **Agentic InfraOps Agents** | Multi-step workflows, end-to-end projects |

### Break Down Complex Tasks

Do not ask for an entire landing zone in one prompt. Start small and iterate.

```text
❌ Create a complete Azure landing zone with networking, identity, security,
   and governance

✅ Create a hub VNet with:
   - Address space: 10.0.0.0/16
   - Subnets: GatewaySubnet, AzureFirewallSubnet, SharedServicesSubnet
   - NSG on SharedServicesSubnet with deny-all default
```

### Be Specific About Requirements

```text
❌ Create a storage account

✅ Create a Bicep module for Azure Storage with:
   - SKU: Standard_ZRS
   - HTTPS only, TLS 1.2 minimum
   - No public blob access
   - Soft delete: 30 days
```

### Provide Context in Your Prompts

Include target environment, compliance requirements, naming conventions,
and region in every prompt:

```text
Create a Bicep module for Azure SQL Database.

Context:
- Environment: production
- Compliance: HIPAA (audit logging required)
- Region: swedencentral
- Naming: sql-{projectName}-{environment}-{uniqueSuffix}
- Authentication: Azure AD only (no SQL auth)

Requirements:
- Zone redundant
- Geo-replication to germanywestcentral
- 35-day backup retention
```

### Use Chat Variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `@workspace` | Search entire workspace | `@workspace Find all Key Vault references` |
| `#file` | Reference specific file | `#file:main.bicep Explain this module` |
| `#selection` | Current selection | Select code, then ask about it |
| `#terminalLastCommand` | Last terminal output | `#terminalLastCommand Why did this fail?` |

### Prompt Patterns

**Explain Then Generate**:

```text
First, explain best practices for App Service networking with private endpoints.
Then, create a Bicep module that implements these practices.
```

**Review Then Fix**:

```text
Review this Bicep template for:
1. Security issues
2. Well-Architected Framework alignment
3. Missing outputs

Then provide a corrected version.
```

**Compare Approaches**:

```text
Show two approaches for deploying Azure Container Apps:
1. Using native Bicep resources
2. Using Azure Verified Modules (AVM)

Compare pros/cons for a production HIPAA workload.
```

**Incremental Refinement**:

```text
Prompt 1: Create a basic VNet module
Prompt 2: Add NSGs to each subnet with deny-all default
Prompt 3: Add diagnostic settings for all NSG flow logs
Prompt 4: Make the address space configurable via parameters
```

### Anti-Patterns to Avoid

| Anti-Pattern | Problem | Better Approach |
| --- | --- | --- |
| "Generate everything" | Output too broad | Break into small requests |
| Accepting without review | Bugs, security issues | Always validate and test |
| Ignoring context | Generic suggestions | Open relevant files, use `@workspace` |
| One-shot complex prompts | Incomplete output | Iterate with follow-ups |
| Not providing examples | Inconsistent formatting | Show the pattern you want |

### Always Validate AI Output

| Check | Why |
| --- | --- |
| API versions are recent (2023+) | Older versions lack features |
| `supportsHttpsTrafficOnly: true` | Security baseline |
| `minimumTlsVersion: 'TLS1_2'` | Compliance requirement |
| Unique names use `uniqueString()` | Avoid naming collisions |
| Outputs include both ID and name | Downstream modules need both |

```bash
# Validate Bicep syntax
bicep build main.bicep

# Lint for best practices
bicep lint main.bicep

# Preview deployment
az deployment group what-if \
  --resource-group myRG \
  --template-file main.bicep
```

---

## 7-Step Workflow Prompts

The Agentic InfraOps workflow follows seven steps. Use the **InfraOps Conductor** to
run all steps end-to-end, or invoke individual agents directly.

### End-to-End (Conductor)

Select the **InfraOps Conductor** agent in Copilot Chat, then describe your project:

```text
I need Azure infrastructure for a patient portal web application.
The company is a mid-size healthcare provider (500 staff, 50k patients).
We need HIPAA compliance and expect 10k daily active users.
```

The Conductor delegates to each agent in sequence with approval gates between steps.

```text
Resume the workflow from where we left off. Check agent-output/patient-portal/
for existing artifacts.
```

---

### Step 1: Requirements — 📜 Scribe

Select the **Requirements** agent. Start with business context, not technical specs.

```text
We're a fintech startup building a payment processing gateway.
30 developers, Series B, launching in 3 months.
Must be PCI-DSS compliant. Expect 1M transactions/month at launch.
```

```text
We're migrating an on-premises .NET ERP system to Azure.
Currently running on 12 VMware VMs with SQL Server 2019.
300 concurrent users, 99.9% uptime SLA required.
```

The agent guides you through 5 discovery phases (business, technical, compliance,
operational, budget) using interactive questions, then generates
`agent-output/{project}/01-requirements.md`.

---

### Step 2: Architecture — 🏛️ Oracle

Select the **Architect** agent. It reads the requirements and produces a WAF
assessment with cost estimates.

```text
Review the requirements in agent-output/payment-gateway/01-requirements.md
and create a comprehensive architecture assessment.
```

```text
Compare SKU options for the App Service plan — we need to understand
the cost difference between P1v3 and P2v3 for our expected load.
```

```text
Deep dive into the Security pillar. Our CISO wants to know
specifically how we handle data encryption at rest and in transit.
```

---

### Step 3: Design — 🎨 Artisan (Optional)

Select the **Design** agent. This step is optional — skip to Step 4 if you
do not need diagrams or ADRs.

**Architecture diagram**:

```text
Generate a Python architecture diagram for the payment gateway.
Include all Azure resources from the architecture assessment,
network topology, and data flow paths.
```

**Architecture Decision Record**:

```text
Create an ADR documenting the decision to use Azure Container Apps
instead of AKS. Include WAF trade-offs from the assessment.
```

**Cost estimate** (delegates to Architect):

```text
Generate a detailed cost estimate using Azure Pricing MCP tools.
Include monthly and yearly totals for each resource.
```

---

### Step 4: Planning — 📐 Strategist

Select the **Bicep Plan** agent. It discovers governance constraints and
creates a machine-readable implementation plan.

```text
Create an implementation plan for the payment gateway architecture.
Check AVM module availability for every resource.
```

```text
Re-query Azure Resource Graph for updated policy assignments.
Our platform team added new policies last week.
```

The agent runs governance discovery (Azure Policy via REST API), checks AVM module
availability, then asks you to choose a deployment strategy (phased vs. single)
before generating `04-implementation-plan.md`.

---

### Step 5: Implementation — ⚒️ Forge

Select the **Bicep Code** agent. It reads the plan and generates production-ready
Bicep templates.

```text
Implement the Bicep templates according to the implementation plan
in agent-output/payment-gateway/04-implementation-plan.md.
Use AVM modules, generate deploy.ps1, and save to infra/bicep/payment-gateway/.
```

```text
Fix the validation errors from bicep build. Re-run lint after fixes.
```

The agent runs a preflight check, generates templates with AVM modules, applies
security baseline and required tags, then validates with `bicep build` and
`bicep lint`.

---

### Step 6: Deployment — 🚀 Envoy

Select the **Deploy** agent. It runs preflight validation, what-if analysis,
and deploys with approval gates.

```text
Deploy the payment gateway Bicep templates. Run what-if first.
```

```text
Deploy the next phase from the implementation plan.
```

```text
Verify the deployed resources using Azure Resource Graph.
Check resource health status.
```

The agent always presents the what-if change summary and waits for your explicit
approval before deploying. For phased deployments, it pauses between each phase.

---

### Step 7: Documentation

After deployment, the Deploy agent can generate as-built documentation:

```text
Generate comprehensive workload documentation for the deployed
payment gateway infrastructure.
```

This produces documentation files in `agent-output/{project}/07-*.md`:
design document, operations runbook, cost estimate, compliance matrix,
backup/DR plan, and resource inventory.

---

## Standalone Agent Reference

### InfraOps Conductor — 🎼 Maestro

Use the Conductor for end-to-end projects where you want the full 7-step
workflow with approval gates.

```text
Start a new project for a static website with CDN and custom domain.
```

```text
Review all generated artifacts in agent-output/my-project/
and provide a summary of current project state.
```

### Diagnose — 🔍 Sentinel

Use Diagnose for troubleshooting deployed Azure resources. It works outside
the 7-step workflow.

```text
Check the health of all resources in resource group rg-payment-gateway-prod.
```

```text
My App Service is returning 503 errors. The resource is
app-payment-api-prod in resource group rg-payment-gateway-prod.
Help me diagnose the issue.
```

```text
Expand the diagnostic scope to include resources connected to
my App Service (Key Vault, SQL Database, Storage).
```

---

## Skill Reference

Skills are invoked automatically by agents, but you can also reference them
directly in prompts.

### azure-defaults

Provides regions, tags, naming conventions, AVM module references, and
security baselines. Agents read this skill before every task.

```text
@workspace What are the default required tags from azure-defaults?
```

### azure-diagrams

Generates Python architecture diagrams using the `diagrams` library.

```text
Generate an architecture diagram for the infrastructure in
infra/bicep/my-project/ using the azure-diagrams skill.
```

### azure-adr

Creates Architecture Decision Records following a structured template.

```text
Document the decision to use Azure Front Door instead of
Application Gateway as an ADR.
```

### git-commit

Provides conventional commit message conventions for this repository.

```text
@workspace What commit message format does this repo use?
```

### github-operations

Manages GitHub issues, PRs, Actions, and releases. Uses MCP tools first,
falls back to `gh` CLI.

```text
Create a GitHub issue for adding monitoring to the payment gateway.
Label it with 'enhancement' and 'infrastructure'.
```

### docs-writer

Generates and maintains documentation following repository standards.

```text
Update the docs to reflect the new Diagnose agent we added.
```

### make-skill-template

Scaffolds a new skill directory from the template.

```text
Create a new skill called 'azure-monitoring' for Application Insights
and Log Analytics best practices.
```

---

## Subagent Reference

Subagents are called automatically by the **Bicep Code** agent during Step 5.
You do not invoke them directly, but understanding their output helps you
interpret validation results.

### bicep-lint-subagent

Runs `bicep lint` and `bicep build` to validate template syntax. Returns a
structured PASS/FAIL result with error counts and details.

### bicep-review-subagent

Reviews Bicep templates against AVM standards, naming conventions, security
baselines, and best practices. Returns an APPROVED, NEEDS_REVISION, or FAILED
verdict with actionable feedback.

### bicep-whatif-subagent

Runs `az deployment group what-if` to preview deployment changes. Analyzes
policy violations, resource changes, and cost impact. Returns a structured
change summary.

---

## Tips and Patterns

### Context Priming

Before starting a complex workflow, open relevant files so Copilot has context:

1. Open the requirements document (`01-requirements.md`)
2. Open the architecture assessment (`02-architecture-assessment.md`)
3. Then ask the Bicep Plan agent to create the implementation plan

### Chaining Agents

You can chain agents manually by using handoff buttons in the chat, or run
the Conductor for automatic orchestration. Manual chaining gives you more
control over each step:

1. Run **Requirements** → review and approve `01-requirements.md`
2. Run **Architect** → review WAF scores and cost estimate
3. Run **Bicep Plan** → review governance constraints and plan
4. Run **Bicep Code** → review generated templates
5. Run **Deploy** → review what-if before approving deployment

### Recovering from Errors

If an agent produces incorrect output, use specific follow-up prompts:

```text
The VNet address space conflicts with our on-premises range (10.0.0.0/8).
Change the hub VNet to 172.16.0.0/16 and spoke VNets to 172.17.0.0/16.
```

### Working with Existing Infrastructure

Agents can work with existing deployments, not just greenfield projects:

```text
I have an existing resource group rg-legacy-app-prod with 15 resources.
Generate as-built documentation for this infrastructure.
```

```text
Review the existing Bicep templates in infra/bicep/legacy-app/
and suggest improvements for WAF alignment.
```

---

## References

- [GitHub Copilot Best Practices](https://docs.github.com/en/copilot/get-started/best-practices)
- [Prompt Engineering for Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/prompt-engineering-for-copilot-chat)
- [VS Code Copilot Prompt Crafting](https://code.visualstudio.com/docs/copilot/prompt-crafting)
- [Agentic InfraOps Quickstart](../quickstart.md)
- [Agent Workflow Reference](../workflow.md)
