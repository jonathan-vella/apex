# GitHub Copilot Best Practices

> **Version 5.3.0** | [Back to Guides](README.md)
>
> Get the most out of Copilot for infrastructure-as-code work.
>
> These practices are based on
> [GitHub's official best practices](https://docs.github.com/en/copilot/get-started/best-practices)
> with IT Pro-specific guidance for Bicep, Terraform, and PowerShell.

---

## Choose the Right Tool

Copilot offers multiple interfaces. Use the right one for each task:

### Inline Suggestions (Tab Completion)

**Best for:**

- Completing code snippets as you type
- Variable names and function signatures
- Repetitive resource blocks
- Test-driven development (write tests first)

**Example:** Type a comment, get the implementation:

```bicep
// Create an NSG rule allowing HTTPS from the internet
```

Copilot suggests the complete rule block.

### Copilot Chat

**Best for:**

- Asking questions about code
- Generating larger sections of code
- Explaining existing code
- Debugging and troubleshooting
- Using specific personas or roles

**Example prompt with persona:**

```
You are a Senior Azure Architect focused on security and compliance.
Review this Bicep module for HIPAA compliance issues.
[paste code]
```

### Custom Agents (Agentic InfraOps)

**Best for:**

- Multi-step infrastructure workflows
- Well-Architected Framework assessments
- End-to-end project generation
- Coordinated planning and implementation

**When to use agents:**

| Task                       | Use Agent                                                      |
| -------------------------- | -------------------------------------------------------------- |
| New infrastructure project | `architect` → `bicep-plan` → `bicep-code` |
| Quick code fix             | Inline or Chat                                                 |
| Architecture review        | `architect`                                    |
| Generate diagrams          | `diagram`                                            |

---

## Create Thoughtful Prompts

Prompt quality directly impacts output quality. Follow these principles:

### 1. Break Down Complex Tasks

❌ **Too broad:**

```
Create a complete Azure landing zone with networking, identity, security, and governance
```

✅ **Better — start with one piece:**

```
Create a hub VNet with:
- Address space: 10.0.0.0/16
- Subnets: GatewaySubnet, AzureFirewallSubnet, SharedServicesSubnet
- NSG on SharedServicesSubnet with deny-all default
- Diagnostic settings to Log Analytics
```

### 2. Be Specific About Requirements

❌ **Vague:**

```
Create a storage account
```

✅ **Specific:**

```
Create a Bicep module for Azure Storage with:
- SKU: Standard_ZRS
- HTTPS only, TLS 1.2 minimum
- No public blob access
- Soft delete: 30 days
- Include outputs for ID and primary endpoint
```

### 3. Provide Examples

When you need a specific format or pattern:

```
Generate parameter validation for a Bicep template.
Follow this pattern:

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

Apply the same pattern for: location, sku, resourceGroupName
```

### 4. Reference Repository Context

Use `@workspace` to give Copilot context from your codebase:

```
@workspace How does the ecommerce Bicep deployment handle unique naming?
Apply the same pattern to create a new Key Vault module.
```

---

## Check Copilot's Work

**Always validate AI-generated code.** Copilot is powerful but can make mistakes.

### Understand Before You Accept

- **Ask Copilot to explain:** "Explain what this code does line by line"
- **Verify resource types and API versions** are current
- **Check security settings** match your requirements

### Review Checklist for Bicep

| Check                             | Why                          |
| --------------------------------- | ---------------------------- |
| API versions are recent (2023+)   | Older versions lack features |
| `supportsHttpsTrafficOnly: true`  | Security baseline            |
| `minimumTlsVersion: 'TLS1_2'`     | Compliance requirement       |
| Unique names use `uniqueString()` | Avoid naming collisions      |
| Outputs include both ID and name  | Downstream modules need both |

### Use Automated Validation

```bash
# Validate Bicep syntax
bicep build main.bicep

# Lint for best practices
bicep lint main.bicep

# Terraform validation
terraform validate
terraform fmt -check

# Security scanning
tfsec .
checkov -d .
```

### Watch for Common Copilot Mistakes

| Issue                     | How to Catch                      | Fix                                  |
| ------------------------- | --------------------------------- | ------------------------------------ |
| Outdated API versions     | Review `@` versions               | Update to latest                     |
| Missing security defaults | Check for HTTPS, TLS              | Add security properties              |
| Hardcoded names           | Search for strings without params | Use parameters + uniqueString        |
| Missing dependencies      | `bicep build` errors              | Add `dependsOn` or use symbolic refs |
| Wrong property names      | Lint errors                       | Check ARM template reference         |

---

## Guide Copilot with Context

### Open Relevant Files

Copilot uses open files as context. Before prompting:

- **Open** files related to your task
- **Close** unrelated files that might confuse context
- **Pin** important reference files

### Use Chat Variables

| Variable               | Purpose                 | Example                                           |
| ---------------------- | ----------------------- | ------------------------------------------------- |
| `@workspace`           | Search entire workspace | `@workspace Find all Key Vault references`        |
| `#file`                | Reference specific file | `#file:main.bicep Explain this module`            |
| `#selection`           | Current selection       | Select code, then `#selection Add error handling` |
| `#terminalLastCommand` | Last terminal output    | `#terminalLastCommand Why did this fail?`         |

### IT Pro Context Tips

For infrastructure work, include:

- **Target environment:** dev, staging, prod
- **Compliance requirements:** HIPAA, SOC2, internal policies
- **Naming conventions:** `st{project}{env}{suffix}`, `kv-{project}-{env}`
- **Default region:** swedencentral (or germanywestcentral)

**Example with full context:**

```
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
- Auditing to Log Analytics workspace
```

---

## Prompt Patterns for IT Pros

### Pattern 1: Explain Then Generate

```
First, explain best practices for Azure App Service networking with private endpoints.
Then, create a Bicep module that implements these practices.
```

### Pattern 2: Review Then Fix

```
Review this Bicep template for:
1. Security issues
2. Well-Architected Framework alignment
3. Missing outputs

[paste code]

Then provide a corrected version.
```

### Pattern 3: Compare Approaches

```
Show two approaches for deploying Azure Container Apps:
1. Using native Bicep resources
2. Using Azure Verified Modules (AVM)

Compare pros/cons for a production HIPAA workload.
```

### Pattern 4: Incremental Refinement

```
Prompt 1: Create a basic VNet module
Prompt 2: Add NSGs to each subnet with deny-all default
Prompt 3: Add diagnostic settings for all NSG flow logs
Prompt 4: Make the address space configurable via parameters
```

---

## Common Anti-Patterns

| Anti-Pattern             | Problem                                  | Better Approach                     |
| ------------------------ | ---------------------------------------- | ----------------------------------- |
| "Generate everything"    | Output too broad, misses requirements    | Break into small, specific requests |
| Accepting without review | Bugs, security issues, outdated patterns | Always validate and test            |
| Ignoring context         | Generic suggestions                      | Open relevant files, use @workspace |
| One-shot complex prompts | Incomplete or wrong output               | Iterate with follow-up prompts      |
| Not providing examples   | Inconsistent formatting                  | Show the pattern you want           |

---

## Stay Current

Copilot features evolve rapidly. Stay updated:

- [GitHub Copilot Changelog](https://github.blog/changelog/label/copilot/)
- [VS Code Copilot Updates](https://code.visualstudio.com/updates)
- [Model Selection Guide](copilot-model-selection.md) — model capabilities change

---

## Next Steps

- **Workflow guide** → [Seven-Step Agent Workflow](../reference/workflow.md)
- **First scenario** → [S01 Bicep Baseline](../../scenarios/S01-bicep-baseline/)
- **Troubleshooting** → [Troubleshooting Guide](troubleshooting.md)

---

## References

- [GitHub Copilot Best Practices (Official)](https://docs.github.com/en/copilot/get-started/best-practices)
- [Prompt Engineering for Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/prompt-engineering-for-copilot-chat)
- [VS Code Copilot Prompt Crafting](https://code.visualstudio.com/docs/copilot/prompt-crafting)
