# Copilot Tips for Infrastructure

> Best practices for using GitHub Copilot with Azure infrastructure-as-code

## Choose the Right Tool

### Inline Suggestions (Tab Completion)

**Best for:** Completing code snippets, variable names, repetitive blocks

```bicep
// Type a comment, get the implementation:
// Create an NSG rule allowing HTTPS from the internet
```

### Copilot Chat

**Best for:** Questions, generating larger sections, debugging, troubleshooting

```text
You are a Senior Azure Architect focused on security.
Review this Bicep module for HIPAA compliance issues.
```

### Agentic InfraOps Agents

**Best for:** Multi-step workflows, end-to-end projects

| Task | Agent |
|------|-------|
| New infrastructure project | 🎼 **Conductor** (full workflow) |
| Requirements capture | 📜 **Scribe** (requirements) |
| WAF assessment | 🏛️ **Oracle** (architect) |
| Implementation plan | 📐 **Strategist** (bicep-plan) |
| Bicep generation | ⚒️ **Forge** (bicep-code) |
| Deployment | 🚀 **Envoy** (deploy) |
| Troubleshooting | 🔍 **Sentinel** (diagnose) |

---

## Create Thoughtful Prompts

### Break Down Complex Tasks

❌ **Too broad:**

```text
Create a complete Azure landing zone with networking, identity, security, and governance
```

✅ **Better — start with one piece:**

```text
Create a hub VNet with:
- Address space: 10.0.0.0/16
- Subnets: GatewaySubnet, AzureFirewallSubnet, SharedServicesSubnet
- NSG on SharedServicesSubnet with deny-all default
```

### Be Specific About Requirements

❌ **Vague:**

```text
Create a storage account
```

✅ **Specific:**

```text
Create a Bicep module for Azure Storage with:
- SKU: Standard_ZRS
- HTTPS only, TLS 1.2 minimum
- No public blob access
- Soft delete: 30 days
```

### Provide Examples

```text
Generate parameter validation for a Bicep template.
Follow this pattern:

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

Apply the same pattern for: location, sku, resourceGroupName
```

### Reference Repository Context

```text
@workspace How does the ecommerce Bicep deployment handle unique naming?
Apply the same pattern to create a new Key Vault module.
```

---

## Always Validate AI Output

### Review Checklist for Bicep

| Check | Why |
|-------|-----|
| API versions are recent (2023+) | Older versions lack features |
| `supportsHttpsTrafficOnly: true` | Security baseline |
| `minimumTlsVersion: 'TLS1_2'` | Compliance requirement |
| Unique names use `uniqueString()` | Avoid naming collisions |
| Outputs include both ID and name | Downstream modules need both |

### Validation Commands

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

### Common Copilot Mistakes

| Issue | How to Catch | Fix |
|-------|--------------|-----|
| Outdated API versions | Review `@` versions | Update to latest |
| Missing security defaults | Check for HTTPS, TLS | Add security properties |
| Hardcoded names | Search for strings | Use parameters + uniqueString |
| Missing dependencies | `bicep build` errors | Add `dependsOn` |

---

## Guide Copilot with Context

### Chat Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `@workspace` | Search entire workspace | `@workspace Find all Key Vault references` |
| `#file` | Reference specific file | `#file:main.bicep Explain this module` |
| `#selection` | Current selection | Select code, then ask about it |
| `#terminalLastCommand` | Last terminal output | `#terminalLastCommand Why did this fail?` |

### IT Pro Context Tips

Include in your prompts:

- **Target environment:** dev, staging, prod
- **Compliance requirements:** HIPAA, SOC2, internal policies
- **Naming conventions:** `st{project}{env}{suffix}`, `kv-{project}-{env}`
- **Default region:** swedencentral (or germanywestcentral)

**Example with full context:**

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

---

## Prompt Patterns

### Pattern 1: Explain Then Generate

```text
First, explain best practices for App Service networking with private endpoints.
Then, create a Bicep module that implements these practices.
```

### Pattern 2: Review Then Fix

```text
Review this Bicep template for:
1. Security issues
2. Well-Architected Framework alignment
3. Missing outputs

[paste code]

Then provide a corrected version.
```

### Pattern 3: Compare Approaches

```text
Show two approaches for deploying Azure Container Apps:
1. Using native Bicep resources
2. Using Azure Verified Modules (AVM)

Compare pros/cons for a production HIPAA workload.
```

### Pattern 4: Incremental Refinement

```text
Prompt 1: Create a basic VNet module
Prompt 2: Add NSGs to each subnet with deny-all default
Prompt 3: Add diagnostic settings for all NSG flow logs
Prompt 4: Make the address space configurable via parameters
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| "Generate everything" | Output too broad | Break into small requests |
| Accepting without review | Bugs, security issues | Always validate and test |
| Ignoring context | Generic suggestions | Open relevant files, use @workspace |
| One-shot complex prompts | Incomplete output | Iterate with follow-ups |
| Not providing examples | Inconsistent formatting | Show the pattern you want |

---

## References

- [GitHub Copilot Best Practices](https://docs.github.com/en/copilot/get-started/best-practices)
- [Prompt Engineering for Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/prompt-engineering-for-copilot-chat)
- [VS Code Copilot Prompt Crafting](https://code.visualstudio.com/docs/copilot/prompt-crafting)
