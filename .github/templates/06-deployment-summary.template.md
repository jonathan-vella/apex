# Step 6: Deployment Summary - {project-name}

> Generated: {date}  
> Status: **{STATUS}** (Succeeded/Failed/Simulated)

> [!NOTE]
> 📚 See [documentation-styling.md](../agents/_shared/documentation-styling.md) for visual standards.

## Preflight Validation

| Property             | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Project Type**     | {azd-project \| standalone-bicep}               |
| **Deployment Scope** | {resourceGroup \| subscription \| mg \| tenant} |
| **Validation Level** | {Provider \| ProviderNoRbac}                    |
| **Bicep Build**      | {✅ Pass \| ❌ Fail}                            |
| **What-If Status**   | {✅ Pass \| ❌ Fail \| ⏭️ Skipped}              |

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

| Resource   | Name | Type | Status   |
| ---------- | ---- | ---- | -------- |
| Resource 1 |      |      | ✅/❌/⏸️ |
| Resource 2 |      |      | ✅/❌/⏸️ |

## Outputs (Expected)

```json
{
  "output1": "value1",
  "output2": "value2"
}
```

## To Actually Deploy

```powershell
# Navigate to Bicep directory
cd infra/bicep/{project-name}

# Preview changes
./deploy.ps1 -WhatIf

# Deploy
./deploy.ps1
```

## Post-Deployment Tasks

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

---

## References

| Topic                      | Link                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Azure Deployment           | [ARM Deployments](https://learn.microsoft.com/azure/azure-resource-manager/templates/deployment-tutorial-pipeline) |
| Deployment Troubleshooting | [Common Errors](https://learn.microsoft.com/azure/azure-resource-manager/troubleshooting/common-deployment-errors) |
| What-If Operations         | [Preview Changes](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if)                   |

---

_Deployment summary for {project-name}._
