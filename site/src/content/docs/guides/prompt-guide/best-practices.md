---
title: "Prompting Best Practices"
description: "Best practices for writing effective prompts"
---

## Choose the Right Interface

| Interface                    | Best For                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| **Inline suggestions** (Tab) | Completing code snippets, variable names, repetitive blocks |
| **Copilot Chat**             | Questions, generating larger sections, debugging            |
| **APEX Agents**              | Multi-step workflows, end-to-end projects                   |

## Break Down Complex Tasks

Do not ask for an entire solution in one prompt. Start with the business outcome,
then iterate on specifics.

```text
❌ Create a complete Azure landing zone with networking, identity, security,
   and governance

✅ We're launching a B2B SaaS product for 50 enterprise customers.
   Start with the networking foundation:
   - Hub VNet for shared services (firewall, DNS, monitoring)
   - Spoke VNet for the application workload
   - No direct internet access from the app tier

   (Then follow up: "Now add identity and RBAC for the platform team
   and two application teams")
```

## Be Specific About Requirements

```text
❌ Create a storage account

✅ Our e-commerce platform stores customer order documents that must be
   retained for 7 years (regulatory). We need:
   - Zone-redundant storage for durability
   - No public access (internal services only)
   - Soft delete enabled so ops can recover accidental deletions
   - HTTPS only, TLS 1.2 minimum
   Use Bicep with Azure Verified Modules.

✅ Our data analytics pipeline ingests CSV uploads from partner APIs.
   We need blob storage that:
   - Handles ~500 GB/month of incoming data
   - Automatically moves files older than 30 days to cool tier
   - Is accessible only from our processing VNet
   Use Terraform with Azure Verified Modules.
```

## Provide Context in Your Prompts

Include the business context, compliance requirements, and operational
constraints — not just the resource type:

```text
We're building the claims processing database for a healthcare insurer.

Business context:
- HIPAA-regulated environment, audit logging is mandatory
- 200 concurrent internal users, peak during open enrollment
- RPO < 1 hour, RTO < 4 hours (business continuity requirement)

Technical constraints:
- Region: swedencentral (EU data residency)
- Authentication: Azure AD only — no SQL credentials
- Naming follows our convention: sql-{projectName}-{environment}-{uniqueSuffix}

Create a Bicep module for Azure SQL Database that meets these requirements.
```

## Use Chat Variables

| Variable               | Purpose                 | Example                                    |
| ---------------------- | ----------------------- | ------------------------------------------ |
| `@workspace`           | Search entire workspace | `@workspace Find all Key Vault references` |
| `#file`                | Reference specific file | `#file:main.bicep Explain this module`     |
| `#selection`           | Current selection       | Select code, then ask about it             |
| `#terminalLastCommand` | Last terminal output    | `#terminalLastCommand Why did this fail?`  |

## Prompt Patterns

:::tip[Effective prompt structures]
These patterns work well across all agents. Combine them for best results.
:::

**Explain Then Generate**:

```text
Our team is new to private endpoints. First, explain the networking
concepts and security benefits for an App Service that serves an
internal HR portal. Then, create a Bicep module that implements
private endpoint access for the app.
```

**Review Then Fix**:

```text
Our compliance team flagged this Bicep template before go-live.
Review it against:
1. HIPAA security requirements
2. Well-Architected Framework reliability pillar
3. Missing outputs our CI pipeline needs

Then provide a corrected version.
```

**Compare Approaches**:

```text
We're deploying a containerised order-processing API.
Show two approaches:
1. Using native Bicep resources
2. Using Azure Verified Modules (AVM)

Compare cost, maintainability, and compliance coverage
for our PCI-DSS production workload.
```

**Incremental Refinement**:

```text
Prompt 1: We need a VNet for our customer-facing web tier — create the base module
Prompt 2: Add network security rules — only HTTPS inbound, deny everything else
Prompt 3: Add diagnostic settings so the SOC team gets NSG flow logs
Prompt 4: Make the address space configurable — we have 3 environments
```

## Anti-Patterns to Avoid

:::caution[Common mistakes that reduce output quality]
Avoid these patterns — they lead to incomplete, generic, or incorrect AI output.
:::

| Anti-Pattern             | Problem                 | Better Approach                                                                    |
| ------------------------ | ----------------------- | ---------------------------------------------------------------------------------- |
| "Generate everything"    | Output too broad        | Break into business capabilities: networking, then identity, then monitoring       |
| Accepting without review | Bugs, security issues   | Always run `bicep lint` / `terraform validate` and review for hardcoded secrets    |
| Ignoring context         | Generic suggestions     | Open relevant files first, use `@workspace` and `#file:` references                |
| One-shot complex prompts | Incomplete output       | Iterate: start with the core use case, add compliance, add monitoring, add DR      |
| Not providing examples   | Inconsistent formatting | Show the naming pattern or module structure you want the agent to follow           |
| Infrastructure-only asks | Misses constraints      | Lead with who uses it, compliance needs, and SLAs — let the agent derive the infra |

## Always Validate AI Output

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
