---
title: "Deployment Overview"
description: "Preflight validation results, deployment details, and SKU adaptation from the Deploy Agent for the Malta catering infrastructure"
sidebar:
  order: 7
---

:::tip[Editorial Context]
This artifact was produced by the **Bicep Deploy Agent** (Step 6 of the APEX pipeline).
The Deploy Agent executes the generated Bicep templates against the live Azure subscription
using `azd provision`. It performs preflight validation (bicep build, lint, what-if preview),
runs the actual deployment, and documents the results including any runtime adaptations.
In this case, the agent autonomously switched the App Service Plan from S1 to P0v3 after
discovering that S1 Linux was unavailable in the target subscription.
:::

## Preflight Validation

| Property             | Value                          | Status |
| -------------------- | ------------------------------ | ------ |
| **Project Type**     | `azd` project                  | Info   |
| **Deployment Scope** | `resourceGroup`                | Info   |
| **Validation Level** | `azd provision --preview`      | Info   |
| **Bicep Build**      | Passed before deployment       | Pass   |
| **Bicep Lint**       | Passed before deployment       | Pass   |
| **What-If Status**   | Preview succeeded before apply | Pass   |

## Deployment Details

| Field               | Value                                       |
| ------------------- | ------------------------------------------- |
| **Deployment Name** | `azd provision --no-prompt`                 |
| **Resource Group**  | `rg-malta-catering-dev`                     |
| **Location**        | `swedencentral`                             |
| **Duration**        | `5 minutes 1 second` (successful final run) |
| **Status**          | `Succeeded`                                 |

:::caution[SKU Adaptation]
The first App Service Plan deployment attempt failed because `S1` Linux was not available
to this subscription in `swedencentral`. The Deploy Agent autonomously adapted and the
successful deployment used `P0v3` instead. This is documented in the deployment summary
and reflected in the final outputs.
:::
