---
toc_depth: 2
---

# Workflow Prompts

The Agentic InfraOps workflow follows seven steps. Use the **InfraOps Conductor** to
run all steps end-to-end, or invoke individual agents directly.

## End-to-End (Conductor)

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

## Step 1: Requirements — 📜 Scribe

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

## Step 2: Architecture — 🏛️ Oracle

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

## Step 3: Design — 🎨 Artisan (Optional)

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

## Step 4: Planning — 📐 Strategist

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

## Step 5: Implementation — ⚒️ Forge

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

## Step 6: Deployment — 🚀 Envoy

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

## Step 7: Documentation — 📚 Chronicler

After deployment, the **As-Built** agent generates comprehensive workload
documentation:

```text
Generate comprehensive workload documentation for the deployed
payment gateway infrastructure.
```

This produces documentation files in `agent-output/{project}/07-*.md`:
design document, operations runbook, cost estimate, compliance matrix,
backup/DR plan, and resource inventory.

## Standalone Agents

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
