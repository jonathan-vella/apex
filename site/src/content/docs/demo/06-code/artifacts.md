---
title: "Generated Artifacts"
sidebar:
  order: 1
---

## 🗂️ File Structure

```text
infra/bicep/nordic-fresh-foods/
├── main.bicep              # Main orchestration — uniqueSuffix, phased deployment
├── main.bicepparam         # Production parameters
├── main.dev.bicepparam     # Development parameters
├── deploy.ps1              # PowerShell deployment script (5 phases)
└── modules/
    ├── budget.bicep        # Consumption budget + forecast alerts
    ├── compute.bicep       # App Service Plan + App Service + RBAC + Autoscale
    ├── dns.bicep           # Private DNS Zones (SQL, Blob, KV) + VNet links
    ├── keyvault.bicep      # Key Vault + PE + diagnostics
    ├── monitoring.bicep    # Log Analytics + Application Insights
    ├── network.bicep       # VNet + Subnets + NSGs (AVM)
    ├── sql.bicep           # SQL Server + Database + PE
    └── storage.bicep       # Storage Account + containers + PE
```
