# S09: Orchestration Test Scenario

> End-to-end test scenario for VS Code 1.109 agent orchestration validation.

## Overview

This scenario validates the full 7-step agentic workflow using a simple Storage Account + Key Vault infrastructure.
Designed for quick validation of:

- Conductor pattern orchestration
- Subagent invocation between steps
- Approval gate enforcement
- Artifact generation at each step
- MCP integration for cost estimation

## Infrastructure Scope

| Resource | Purpose | SKU |
|----------|---------|-----|
| **Resource Group** | Container for all resources | N/A |
| **Storage Account** | Blob storage for application data | Standard_LRS |
| **Key Vault** | Secrets management | Standard |

**Estimated Cost**: ~$25/month (Dev/Test)

---

## Pre-Requisites

1. VS Code 1.109+ with Copilot extensions
2. Devcontainer rebuilt with latest settings
3. Azure CLI authenticated (`az login`)
4. Run `npm run test:1109` to validate configuration

---

## Test Execution

### Step 0: Start Conductor

1. Open Copilot Chat (`Ctrl+Shift+I`)
2. Select **InfraOps Conductor** from agent dropdown
3. Enter prompt:

```text
Create a minimal Azure infrastructure with a Storage Account and Key Vault
for a development environment. Use resource group rg-s09-test in swedencentral.
Project name: s09-orchestration-test
```

---

### Step 1: Requirements (Gate 1)

**Expected Agent**: Requirements (Scribe)

**Expected Artifact**: `agent-output/s09-orchestration-test/01-requirements.md`

**Success Criteria**:

- [ ] Requirements agent invoked automatically
- [ ] Artifact saved with correct H2 structure
- [ ] Conductor pauses for approval
- [ ] User approves to continue

---

### Step 2: Architecture (Gate 2)

**Expected Agent**: Architect (Oracle)

**Expected Artifacts**:

- `agent-output/s09-orchestration-test/02-architecture-assessment.md`
- `agent-output/s09-orchestration-test/03-des-cost-estimate.md`

**Success Criteria**:

- [ ] Architect agent invoked after requirements approval
- [ ] WAF assessment includes all 5 pillars
- [ ] Cost estimate generated (MCP integration)
- [ ] Conductor pauses for approval

---

### Step 3: Design (Optional)

**Expected Agent**: Design (Artisan)

**Expected Artifacts**:

- `agent-output/s09-orchestration-test/03-des-diagram.py`
- `agent-output/s09-orchestration-test/03-des-diagram.png`

**Success Criteria**:

- [ ] Design agent invoked if requested
- [ ] Python diagram generated
- [ ] PNG rendered successfully

---

### Step 4: Planning (Gate 3)

**Expected Agent**: Bicep Plan (Strategist)

**Expected Artifacts**:

- `agent-output/s09-orchestration-test/04-implementation-plan.md`
- `agent-output/s09-orchestration-test/04-governance-constraints.md`

**Success Criteria**:

- [ ] Bicep Plan agent invoked
- [ ] Implementation plan lists all resources
- [ ] AVM modules identified
- [ ] Governance constraints discovered via ARG
- [ ] Conductor pauses for approval

---

### Step 5: Implementation

**Expected Agent**: Bicep Code (Forge)

**Expected Artifacts**:

- `infra/bicep/s09-orchestration-test/main.bicep`
- `infra/bicep/s09-orchestration-test/main.bicepparam`
- `infra/bicep/s09-orchestration-test/modules/*.bicep`
- `agent-output/s09-orchestration-test/05-implementation-reference.md`

**Success Criteria**:

- [ ] Bicep Code agent invoked
- [ ] main.bicep uses AVM modules
- [ ] uniqueSuffix pattern applied
- [ ] Required tags included
- [ ] `bicep lint` passes
- [ ] `bicep build` succeeds

---

### Step 6: Deployment (Gate 4 & 5)

**Expected Agent**: Deploy (Envoy)

**Expected Artifact**: `agent-output/s09-orchestration-test/06-deployment-summary.md`

**Success Criteria**:

- [ ] Pre-deploy what-if analysis runs
- [ ] Conductor pauses at Gate 4 (pre-deploy)
- [ ] Deployment executes successfully
- [ ] Resources created in Azure
- [ ] Conductor pauses at Gate 5 (post-deploy)

**Verification**:

```bash
# Verify resources created
az resource list --resource-group rg-s09-test --output table
```

---

### Step 7: Documentation

**Expected Agent**: Skills (azure-workload-docs)

**Expected Artifacts**:

- `agent-output/s09-orchestration-test/07-design-document.md`
- `agent-output/s09-orchestration-test/07-operations-runbook.md`
- `agent-output/s09-orchestration-test/07-resource-inventory.md`

**Success Criteria**:

- [ ] Design document generated
- [ ] Operations runbook with procedures
- [ ] Resource inventory with deployed resources

---

## Cleanup

```bash
# Delete test resources
az group delete --name rg-s09-test --yes --no-wait

# Remove generated artifacts (optional)
rm -rf agent-output/s09-orchestration-test
rm -rf infra/bicep/s09-orchestration-test
```

---

## Expected Artifact Structure

```
agent-output/s09-orchestration-test/
├── 01-requirements.md
├── 02-architecture-assessment.md
├── 03-des-cost-estimate.md
├── 03-des-diagram.py (optional)
├── 03-des-diagram.png (optional)
├── 04-implementation-plan.md
├── 04-governance-constraints.md
├── 05-implementation-reference.md
├── 06-deployment-summary.md
├── 07-design-document.md
├── 07-operations-runbook.md
└── 07-resource-inventory.md

infra/bicep/s09-orchestration-test/
├── main.bicep
├── main.bicepparam
└── modules/
    ├── key-vault.bicep
    └── storage-account.bicep
```

---

## Test Results

| Step | Gate | Agent | Status | Notes |
|------|------|-------|--------|-------|
| 1 | Gate 1 | Requirements | ☐ | |
| 2 | Gate 2 | Architect | ☐ | |
| 3 | - | Design | ☐ | Optional |
| 4 | Gate 3 | Bicep Plan | ☐ | |
| 5 | - | Bicep Code | ☐ | |
| 6 | Gate 4/5 | Deploy | ☐ | |
| 7 | - | Skills | ☐ | |

### Overall Result

- [ ] **PASS**: All steps completed, all gates enforced
- [ ] **FAIL**: Issues found (document below)

### Issues Found

_Document any issues or unexpected behavior:_

---

## Related Documentation

- [VS Code 1.109 Testing Checklist](../../docs/testing/vscode-1109-checklist.md)
- [Troubleshooting Guide](../../docs/troubleshooting.md)
- [Workflow Documentation](../../docs/workflow.md)

---

> Last updated: 2026-02-05
