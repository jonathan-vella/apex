---
toc_depth: 2
---

# :material-lightbulb-on-outline: Prompting Best Practices

## :material-cursor-default-click-outline: Choose the Right Interface

| Interface                    | Best For                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| **Inline suggestions** (Tab) | Completing code snippets, variable names, repetitive blocks |
| **Copilot Chat**             | Questions, generating larger sections, debugging            |
| **Agentic InfraOps Agents**  | Multi-step workflows, end-to-end projects                   |

## :material-puzzle-outline: Break Down Complex Tasks

Do not ask for an entire landing zone in one prompt. Start small and iterate.

```text
❌ Create a complete Azure landing zone with networking, identity, security,
   and governance

✅ Create a hub VNet with:
   - Address space: 10.0.0.0/16
   - Subnets: GatewaySubnet, AzureFirewallSubnet, SharedServicesSubnet
   - NSG on SharedServicesSubnet with deny-all default
```

## :material-target: Be Specific About Requirements

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

## :material-text-box-search-outline: Provide Context in Your Prompts

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

## :material-variable: Use Chat Variables

| Variable               | Purpose                 | Example                                    |
| ---------------------- | ----------------------- | ------------------------------------------ |
| `@workspace`           | Search entire workspace | `@workspace Find all Key Vault references` |
| `#file`                | Reference specific file | `#file:main.bicep Explain this module`     |
| `#selection`           | Current selection       | Select code, then ask about it             |
| `#terminalLastCommand` | Last terminal output    | `#terminalLastCommand Why did this fail?`  |

## :material-shape-outline: Prompt Patterns

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

## :material-close-octagon-outline: Anti-Patterns to Avoid

!!! warning "Common mistakes that reduce output quality"

    Avoid these patterns — they lead to incomplete, generic, or incorrect AI output.

| Anti-Pattern             | Problem                 | Better Approach                       |
| ------------------------ | ----------------------- | ------------------------------------- |
| "Generate everything"    | Output too broad        | Break into small requests             |
| Accepting without review | Bugs, security issues   | Always validate and test              |
| Ignoring context         | Generic suggestions     | Open relevant files, use `@workspace` |
| One-shot complex prompts | Incomplete output       | Iterate with follow-ups               |
| Not providing examples   | Inconsistent formatting | Show the pattern you want             |

## :material-check-decagram-outline: Always Validate AI Output

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
