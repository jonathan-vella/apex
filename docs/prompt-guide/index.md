# Prompt Guide

Best-practices prompt examples for all Agentic InfraOps agents and skills.

This guide provides ready-to-use prompt examples for every agent and skill in the
Agentic InfraOps project. It is written for **end users** — those who interact with
the agents through VS Code Copilot Chat to design, build, and deploy Azure
infrastructure.

**Prerequisites**: Complete the [Quickstart](../quickstart.md) first
(Dev Container running, subagent invocation enabled).

## Quick Reference

### Agents

| Agent                  | Persona       | Step | Purpose                                        |
| ---------------------- | ------------- | ---- | ---------------------------------------------- |
| **InfraOps Conductor** | 🎼 Maestro    | All  | Orchestrates the full 7-step workflow          |
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
| **Challenger**         | ⚔️ Adversary  | —    | Reviews plans for gaps and weaknesses          |

### Skills

| Skill                      | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `azure-defaults`           | Regions, tags, naming, AVM, security, governance     |
| `azure-artifacts`          | H2 template structures for agent output files        |
| `azure-diagrams`           | Python architecture diagram generation               |
| `azure-adr`                | Architecture Decision Records                        |
| `azure-bicep-patterns`     | Reusable Bicep patterns (hub-spoke, PE, diagnostics) |
| `terraform-patterns`       | Reusable Terraform patterns (hub-spoke, PE, AVM-TF)  |
| `azure-troubleshooting`    | KQL templates, health checks, remediation playbooks  |
| `git-commit`               | Conventional commit message conventions              |
| `github-operations`        | GitHub issues, PRs, CLI, Actions, releases           |
| `docs-writer`              | Documentation generation and maintenance             |
| `make-skill-template`      | Scaffold new skills from a template                  |
| `microsoft-docs`           | Query official Microsoft/Azure documentation         |
| `microsoft-code-reference` | Verify SDK methods and find code samples             |
| `microsoft-skill-creator`  | Create hybrid skills for Microsoft technologies      |

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

#### Core Workflow Prompts

| Prompt File           | Agent              | Step | Purpose                                     |
| --------------------- | ------------------ | ---- | ------------------------------------------- |
| `run-conductor`       | InfraOps Conductor | All  | End-to-end 7-step orchestration             |
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

## General Prompting Best Practices

### Choose the Right Interface

| Interface                    | Best For                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| **Inline suggestions** (Tab) | Completing code snippets, variable names, repetitive blocks |
| **Copilot Chat**             | Questions, generating larger sections, debugging            |
| **Agentic InfraOps Agents**  | Multi-step workflows, end-to-end projects                   |

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

✅ Create a Terraform module for Azure Storage with:
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

| Variable               | Purpose                 | Example                                    |
| ---------------------- | ----------------------- | ------------------------------------------ |
| `@workspace`           | Search entire workspace | `@workspace Find all Key Vault references` |
| `#file`                | Reference specific file | `#file:main.bicep Explain this module`     |
| `#selection`           | Current selection       | Select code, then ask about it             |
| `#terminalLastCommand` | Last terminal output    | `#terminalLastCommand Why did this fail?`  |

### Prompt Patterns

!!! example "Effective prompt structures"

    These patterns work well across all agents. Combine them for best results.

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

!!! warning "Common mistakes that reduce output quality"

    Avoid these patterns — they lead to incomplete, generic, or incorrect AI output.

| Anti-Pattern             | Problem                 | Better Approach                       |
| ------------------------ | ----------------------- | ------------------------------------- |
| "Generate everything"    | Output too broad        | Break into small requests             |
| Accepting without review | Bugs, security issues   | Always validate and test              |
| Ignoring context         | Generic suggestions     | Open relevant files, use `@workspace` |
| One-shot complex prompts | Incomplete output       | Iterate with follow-ups               |
| Not providing examples   | Inconsistent formatting | Show the pattern you want             |

### Always Validate AI Output

| Check                                               | Why                          |
| --------------------------------------------------- | ---------------------------- |
| API versions are recent (2023+)                     | Older versions lack features |
| `supportsHttpsTrafficOnly: true`                    | Security baseline            |
| `minimumTlsVersion: 'TLS1_2'`                       | Compliance requirement       |
| Unique names use `uniqueString()` / `random_string` | Avoid naming collisions      |
| Outputs include both ID and name                    | Downstream modules need both |

```bash
# Validate Bicep syntax
bicep build main.bicep

# Lint for best practices
bicep lint main.bicep

# Preview Bicep deployment
az deployment group what-if \
  --resource-group myRG \
  --template-file main.bicep

# Validate Terraform syntax
terraform fmt -check
terraform validate

# Lint Terraform with TFLint
tflint --init && tflint

# Preview Terraform deployment
terraform plan -out=tfplan
```

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

### Step 4: Planning — 📐 Strategist

Select the **Bicep Planner** or **Terraform Planner** agent depending on your
IaC tool preference. Both discover governance constraints and create a
machine-readable implementation plan.

=== "Bicep"

    ```text
    Create an implementation plan for the payment gateway architecture.
    Check AVM module availability for every resource.
    ```

=== "Terraform"

    ```text
    Create a Terraform implementation plan for the payment gateway.
    Use AVM-TF modules from the Terraform Registry where available.
    ```

```text
Re-query Azure Resource Graph for updated policy assignments.
Our platform team added new policies last week.
```

The agent runs governance discovery (Azure Policy via REST API), checks AVM module
availability, then asks you to choose a deployment strategy (phased vs. single)
before generating `04-implementation-plan.md`.

### Step 5: Implementation — ⚒️ Forge

Select the **Bicep CodeGen** or **Terraform CodeGen** agent. It reads the plan
and generates production-ready templates.

=== "Bicep"

    ```text
    Implement the Bicep templates according to the implementation plan
    in agent-output/payment-gateway/04-implementation-plan.md.
    Use AVM modules, generate deploy.ps1, and save to infra/bicep/payment-gateway/.
    ```

=== "Terraform"

    ```text
    Implement the Terraform configuration according to the implementation plan
    in agent-output/payment-gateway/04-implementation-plan.md.
    Use AVM-TF modules, generate bootstrap.sh and deploy.sh,
    and save to infra/terraform/payment-gateway/.
    ```

```text
Fix the validation errors from bicep build. Re-run lint after fixes.
```

The agent runs a preflight check, generates templates with AVM modules, applies
security baseline and required tags, then validates with the appropriate tool
(`bicep build` / `terraform validate`).

### Step 6: Deployment — 🚀 Envoy

Select the **Bicep Deploy** or **Terraform Deploy** agent. Both run preflight
validation, preview changes, and deploy with approval gates.

=== "Bicep"

    ```text
    Deploy the payment gateway Bicep templates. Run what-if first.
    ```

=== "Terraform"

    ```text
    Deploy the payment gateway Terraform configuration. Run terraform plan first.
    ```

```text
Deploy the next phase from the implementation plan.
```

```text
Verify the deployed resources using Azure Resource Graph.
Check resource health status.
```

The agent always presents a change summary (what-if or plan output) and waits for
your explicit approval before deploying. For phased deployments, it pauses between
each phase.

### Step 7: Documentation — 📚 Chronicler

After deployment, the **As-Built** agent generates comprehensive workload
documentation:

```text
Generate comprehensive workload documentation for the deployed
payment gateway infrastructure.
```

This produces documentation files in `agent-output/{project}/07-*.md`:
design document, operations runbook, cost estimate, compliance matrix,
backup/DR plan, and resource inventory.

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

### Challenger — ⚔️ Adversary

Use Challenger to stress-test plans and architectures before implementation.
It finds untested assumptions, governance gaps, and WAF blind spots.

```text
Challenge the implementation plan in
agent-output/payment-gateway/04-implementation-plan.md.
Look for governance gaps, security blind spots, and cost risks.
```

```text
Review the architecture assessment for single points of failure
and missing disaster recovery considerations.
```

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

### azure-bicep-patterns

Provides reusable Bicep patterns: hub-spoke networking, private endpoints,
diagnostic settings, conditional deployments, and AVM module composition.

```text
@workspace Show me the private endpoint pattern from azure-bicep-patterns.
```

### terraform-patterns

Provides reusable Terraform patterns: hub-spoke networking, private endpoints,
diagnostic settings, AVM-TF module composition, and known AVM pitfalls.

```text
@workspace Show me the hub-spoke pattern from terraform-patterns.
```

### azure-troubleshooting

KQL templates, metric thresholds, health checks, and remediation playbooks
for diagnosing Azure resource issues.

```text
@workspace What KQL queries are available in azure-troubleshooting?
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

### microsoft-docs

Queries official Microsoft/Azure documentation to understand concepts,
find tutorials, and get current best practices.

```text
@workspace Use the microsoft-docs skill to look up Azure Container Apps
networking modes and limitations.
```

### microsoft-code-reference

Verifies SDK methods, finds working code samples, and catches hallucinated
API calls by querying official documentation.

```text
@workspace Use microsoft-code-reference to find the correct Azure SDK
method for listing Key Vault secrets in Python.
```

## Subagent Reference

Subagents are called automatically by the **Bicep CodeGen**, **Terraform CodeGen**,
**Bicep Deploy**, **Terraform Deploy**, **Architect**, and **IaC Planner** agents.
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

### terraform-lint-subagent

Runs `terraform fmt -check`, `terraform validate`, and TFLint to validate
configuration syntax. Returns a structured PASS/FAIL result with diagnostics.

### terraform-review-subagent

Reviews Terraform configs against AVM-TF standards, CAF naming conventions,
security baselines, and governance compliance. Returns APPROVED, NEEDS_REVISION,
or FAILED verdict with actionable feedback.

### terraform-plan-subagent

Runs `terraform plan` to preview infrastructure changes. Classifies resources
into create/update/destroy/replace, highlights destructive operations,
and returns a structured change summary.

### cost-estimate-subagent

Queries Azure Pricing MCP tools for real-time SKU pricing. Compares regions
and returns a structured cost breakdown.

### governance-discovery-subagent

Queries Azure Policy assignments via REST API (including management group-
inherited policies). Classifies policy effects and returns structured governance
constraints.

## Tips and Patterns

### Context Priming

Before starting a complex workflow, open relevant files so Copilot has context:

1. Open the requirements document (`01-requirements.md`)
2. Open the architecture assessment (`02-architecture-assessment.md`)
3. Then ask the Bicep Planner agent to create the implementation plan

### Chaining Agents

You can chain agents manually by using handoff buttons in the chat, or run
the Conductor for automatic orchestration. Manual chaining gives you more
control over each step.

**Bicep track**:

1. Run **Requirements** → review and approve `01-requirements.md`
2. Run **Architect** → review WAF scores and cost estimate
3. Run **Bicep Planner** → review governance constraints and plan
4. Run **Bicep CodeGen** → review generated templates
5. Run **Bicep Deploy** → review what-if before approving deployment
6. Run **As-Built** → generate post-deployment documentation

**Terraform track**:

1. Run **Requirements** → review and approve `01-requirements.md`
2. Run **Architect** → review WAF scores and cost estimate
3. Run **Terraform Planner** → review governance constraints and plan
4. Run **Terraform CodeGen** → review generated configs
5. Run **Terraform Deploy** → review plan output before applying
6. Run **As-Built** → generate post-deployment documentation

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

## References

- [GitHub Copilot Best Practices](https://docs.github.com/en/copilot/get-started/best-practices)
- [Prompt Engineering for Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/prompt-engineering-for-copilot-chat)
- [VS Code Copilot Prompt Crafting](https://code.visualstudio.com/docs/copilot/prompt-crafting)
- [Agentic InfraOps Quickstart](../quickstart.md)
- [Agent Workflow Reference](../workflow.md)
