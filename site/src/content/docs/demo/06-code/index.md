---
title: "Infra-as-Code Overview"
description: "Overview of generated Bicep templates, file structure, and AVM module usage from the CodeGen Agent for the Malta catering infrastructure"
sidebar:
  order: 6
---

:::tip[Editorial Context]
This artifact was produced by the **Bicep CodeGen Agent** (Step 5 of the APEX pipeline).
The CodeGen Agent takes the implementation plan from Step 4 and generates production-ready
Bicep templates using Azure Verified Modules (AVM). It creates the full file structure,
validates the output with `bicep build`, `bicep lint`, and the IaC security baseline
scanner, then produces an implementation reference documenting all generated artifacts.
:::

## IaC Templates Location

Code Location: `infra/bicep/malta-catering/`

## File Structure

```text
infra/bicep/malta-catering/
├── main.bicep
├── main.bicepparam
├── azure.yaml
├── deploy.ps1
└── modules/
    ├── app-insights.bicep
    ├── app-service-plan.bicep
    ├── budget.bicep
    ├── container-registry.bicep
    ├── key-vault.bicep
    ├── log-analytics.bicep
    ├── private-dns-zones.bicep
    ├── storage.bicep
    ├── virtual-network.bicep
    └── web-app.bicep
```

~12 resources provisioned across networking, compute, data, security, and monitoring — generated from the 10-module architecture defined in the implementation plan.
