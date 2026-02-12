# Step 6: Deployment Summary - {project-name}

![Step](https://img.shields.io/badge/Step-6-blue)
![Status](https://img.shields.io/badge/Status-Draft-orange)
![Agent](https://img.shields.io/badge/Agent-Deploy-purple)

<details>
<summary><strong>📑 Table of Contents</strong></summary>

- [Preflight Validation](#preflight-validation)
- [Deployment Details](#deployment-details)
- [Deployed Resources](#deployed-resources)
- [Outputs (Expected)](#outputs-expected)
- [To Actually Deploy](#to-actually-deploy)
- [Post-Deployment Tasks](#post-deployment-tasks)
- [References](#references)

</details>

> Generated: {date}
> Status: **{STATUS}** (Succeeded/Failed/Simulated)

| ⬅️ Previous | 📑 Index | Next ➡️ |
| --- | --- | --- |
| [05-implementation-reference.md](05-implementation-reference.md) | [README](README.md) | [07-documentation-index.md](07-documentation-index.md) |

## Preflight Validation

| Property             | Value                                           | Status |
| -------------------- | ----------------------------------------------- | ------ |
| **Project Type**     | {azd-project \| standalone-bicep}               | ℹ️ |
| **Deployment Scope** | {resourceGroup \| subscription \| mg \| tenant} | ℹ️ |
| **Validation Level** | {Provider \| ProviderNoRbac}                    | ℹ️ |
| **Bicep Build**      | {result}                                        | ✅ / ❌ |
| **Bicep Lint**       | {result}                                        | ✅ / ⚠️ / ❌ |
| **What-If Status**   | {result}                                        | ✅ / ❌ / ⏭️ |

### Change Summary

| Change Type  | Count | Resources Affected |
| ------------ | ----- | ------------------ |
| Create (+)   | 0     | {resource-names}   |
| Delete (-)   | 0     | {resource-names}   |
| Modify (~)   | 0     | {resource-names}   |
| NoChange (=) | 0     | {resource-names}   |

### Validation Issues

{no-issues-found OR list of warnings/errors with remediation}

## Deployment Details

| Field               | Value |
| ------------------- | ----- |
| **Deployment Name** |       |
| **Resource Group**  |       |
| **Location**        |       |
| **Duration**        |       |
| **Status**          |       |

## Deployed Resources

| Resource   | Name | Type | Status   | Portal |
| ---------- | ---- | ---- | -------- | ------ |
| 💻 Resource 1 |      |      | ✅/❌/⏸️ | [View](https://portal.azure.com/#@/resource/{resource-id}) |
| 💾 Resource 2 |      |      | ✅/❌/⏸️ | [View](https://portal.azure.com/#@/resource/{resource-id}) |

## Outputs (Expected)

<details>
<summary><strong>Deployment Outputs JSON</strong></summary>

```json
{
  "output1": "value1",
  "output2": "value2"
}
```

</details>

## To Actually Deploy

<details>
<summary><strong>🟢 PowerShell (deploy.ps1)</strong></summary>

```powershell
# Navigate to Bicep directory
cd infra/bicep/{project-name}

# Preview changes
./deploy.ps1 -WhatIf

# Deploy
./deploy.ps1
```

</details>

<details>
<summary><strong>🚀 Azure CLI</strong></summary>

```bash
az deployment group create \
  --resource-group "rg-{project}-{env}" \
  --template-file main.bicep \
  --parameters main.bicepparam
```

</details>

## Post-Deployment Tasks

| Task | Owner | Status |
| ---- | ----- | ------ |
| Task 1 | {responsible party} | ⬜ |
| Task 2 | {responsible party} | ⬜ |
| Task 3 | {responsible party} | ⬜ |

---

## References

| Topic                      | Link                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Azure Deployment           | [ARM Deployments](https://learn.microsoft.com/azure/azure-resource-manager/templates/deployment-tutorial-pipeline) |
| Deployment Troubleshooting | [Common Errors](https://learn.microsoft.com/azure/azure-resource-manager/troubleshooting/common-deployment-errors) |
| What-If Operations         | [Preview Changes](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if)                   |

---

_Deployment summary for {project-name}._

---

| ⬅️ [05-implementation-reference.md](05-implementation-reference.md) | 🏠 [Project Index](README.md) | ➡️ [07-documentation-index.md](07-documentation-index.md) |
| --- | --- | --- |
