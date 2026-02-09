# Azure Service Lifecycle Validation

> **Purpose**: Zero-maintenance guardrails to prevent deprecated SKU/service selection.
> Agents MUST follow this pattern instead of relying on static blocklists.

## AVM-First Policy (Zero Maintenance)

Azure Verified Modules are maintained by Microsoft and automatically exclude deprecated SKUs.

### Rule

```
1. ALWAYS check AVM availability first (mcp_bicep_list_avm_metadata)
2. Use AVM module defaults for SKUs when available
3. If custom SKU needed, require live deprecation research (see below)
4. NEVER hardcode SKUs without validation
```

### AVM Default Trust

When using AVM modules with default SKU parameters:

- ✅ Trust the AVM default - Microsoft maintains these
- ✅ No additional deprecation research needed for defaults
- ⚠️ If overriding SKU parameter, run deprecation research

## Live Deprecation Research (For Non-AVM Resources)

When AVM is unavailable OR custom SKUs required, agents MUST fetch live information.

### Research Sources (Priority Order)

| Source | Query Pattern | Reliability |
|--------|---------------|-------------|
| **Azure Updates** | `https://azure.microsoft.com/updates/?query={service}+deprecated` | High |
| **Microsoft Learn** | Check "Important" and "Note" callouts on service pages | High |
| **Azure CLI** | `az provider show --namespace {provider}` for API versions | Medium |
| **Resource Provider** | Check available SKUs in target region | High |

### Deprecation Research Template

```markdown
## Service Lifecycle Check: {Service Name}

**AVM Available**: Yes/No
**AVM Version Used**: {version} or N/A
**SKU Selection Method**: AVM Default / Custom Override / Raw Bicep

### If Custom SKU or Raw Bicep:

- [ ] Checked Azure Updates for deprecation notices
- [ ] Verified SKU availability in target region
- [ ] Confirmed no sunset announcements in last 12 months
- [ ] Documented replacement recommendation if deprecated

**Result**: ✅ Current | ⚠️ Deprecated | ❓ Unknown (requires user decision)
```

## Agent-Specific Responsibilities

### Requirements Agent (Step 1)

When user mentions specific Azure services:

```markdown
## Research Checklist
- [ ] Check if service has known deprecation path (e.g., "CDN Classic" → "Azure Front Door")
- [ ] Note service maturity: Preview | GA | Deprecated
- [ ] If deprecated alternative needed, document in requirements
```

### Architect Agent (Step 2)

In WAF assessment, include service lifecycle in evaluation:

```markdown
## Service Maturity Assessment

| Service | Maturity | Deprecation Status | Notes |
|---------|----------|-------------------|-------|
| Azure CDN | GA | ⚠️ Classic SKUs deprecated | Use Standard_AzureFrontDoor |
| Static Web Apps | GA | ✅ Current | - |
```

### Bicep Plan Agent (Step 4)

Before finalizing SKU selection:

1. **Check AVM availability** for each resource
2. **If AVM exists**: Use default SKU unless requirements specify otherwise
3. **If no AVM or custom SKU**: Run deprecation research template
4. **Document in plan**: Include "SKU Validation Status" column

```markdown
## Resource Inventory

| Resource | AVM | SKU | Validation Status |
|----------|-----|-----|-------------------|
| CDN Profile | ❌ No AVM | Standard_AzureFrontDoor | ✅ Verified current |
| Key Vault | ✅ 0.11.0 | standard (AVM default) | ✅ AVM maintained |
| Storage | ✅ 0.14.0 | Standard_LRS | ⚠️ Custom - verified current |
```

### Bicep Code Agent (Step 5)

Before generating code, validate SKUs in plan are still current:

```markdown
## Pre-Code Validation
- [ ] All AVM modules use current versions
- [ ] Custom SKUs verified against Azure Updates
- [ ] No deprecated resource types in plan
```

## Known Deprecation Patterns

These patterns indicate potential deprecation - trigger additional research:

| Pattern | Example | Research Action |
|---------|---------|-----------------|
| "Classic" in name | CDN Classic, ASM Classic | Likely deprecated - verify |
| "v1" suffix | Application Gateway v1 | Check for v2 availability |
| "Standard" tier only | Certain App Service plans | Verify zone-redundancy support |
| Old API versions | 2020-xx-xx or earlier | Check for newer API |

## What-If Warning Parser

Deploy agent SHOULD scan what-if output for deprecation signals:

```bash
# Keywords to detect in what-if output
deprecated|sunset|end.of.life|no.longer.supported|classic.*not.*supported|retiring
```

If detected, STOP and report before deployment.

## Auto-Generated Deprecation Report

See `.github/data/azure-deprecations.json` for automatically maintained list.

- Updated daily via GitHub Actions
- Sources: Azure Updates RSS, AVM changelog, Azure CLI metadata
- Used as supplementary check, not primary source
