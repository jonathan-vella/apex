---
title: "Deployment Plan"
sidebar:
  order: 2
---

## 🚀 To Actually Deploy

```powershell
# Navigate to Bicep directory
cd infra/bicep/nordic-fresh-foods

# Preview changes
./deploy.ps1 -ResourceGroup rg-nordic-fresh-foods-prod -Environment prod -WhatIf

# Deploy (will prompt for approval at each phase in prod)
./deploy.ps1 -ResourceGroup rg-nordic-fresh-foods-prod -Environment prod
```

```bash
# Phase 1: Foundation
az deployment group create \
  --resource-group rg-nordic-fresh-foods-prod \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --parameters phase=foundation

# Repeat with: phase=observability, phase=security, phase=data, phase=compute
```

---
