---
title: "Cost Governance Guide"
description: "Budget alerts, forecasts, and cost anomaly detection"
---

> Budget alerts, forecast notifications, and anomaly detection for every deployment.

## Why Cost Governance Is Mandatory

Every IaC deployment in this project **must** include cost monitoring resources.
This is enforced by `iac-bicep-best-practices.instructions.md`
and `iac-terraform-best-practices.instructions.md`, which apply to
all `.bicep`, `.tf`, and implementation plan files.

The rule is simple: **no budget, no merge**. Challenger reviews verify cost
monitoring exists, and CI validators flag missing budget resources.

## Budget Alert Setup

Every deployment implements the governed cost-monitoring contract: a
scope-appropriate Azure Budget, actual and forecast notifications, Action Group
routing, and anomaly detection. Governance constraints override repository
defaults.

The canonical contract and implementation examples are maintained in one place:

- [Cost monitoring baseline](https://github.com/jonathan-vella/apex/blob/main/.github/skills/azure-defaults/references/cost-alerts-baseline.md)
- [Bicep implementation](https://github.com/jonathan-vella/apex/blob/main/.github/skills/azure-defaults/references/cost-alerts-bicep.md)
- [Terraform implementation](https://github.com/jonathan-vella/apex/blob/main/.github/skills/azure-defaults/references/cost-alerts-terraform.md)

Budget amounts and notification recipients remain parameters. Do not copy
thresholds or notification blocks into documentation; the canonical contract
changes independently of this guide.

## Per-Environment Budgets

Use parameterised budgets that scale by environment:

| Environment | Typical Budget | Rationale                       |
| ----------- | -------------- | ------------------------------- |
| `dev`       | Low            | Minimal resources, short-lived  |
| `staging`   | Medium         | Production-like but limited use |
| `prod`      | Full           | Production workload capacity    |

Set the budget amount via `.bicepparam` or `terraform.tfvars` —
never hardcode it in the template.

## Azure Resource Manager MCP Tools

The **cost-estimate-subagent** uses the hosted Azure Resource Manager MCP server
during architecture review and as-built documentation:

| Tool | Purpose |
| --- | --- |
| `get_retail_prices` | Query public retail catalog rows |
| `query_costs` | Query actual costs for an authorized scope |
| `query_aks_costs` | Break down deployed AKS costs |
| `forecast_costs` | Forecast costs for a deployed scope |
| `get_benefit_recommendations` | Retrieve reservation and savings-plan recommendations |

The subagent calculates estimates from returned meter units and explicit usage.
It cannot call ARM deployment, resource mutation, or budget creation tools.

The **Microsoft Learn documentation tools** (exposed through the Azure MCP
`documentation` router, e.g. `mcp_azure-mcp_documentation` with
`command: "microsoft_docs_search"`) are used for looking up service-specific
pricing documentation.

## Repeatability Rules

The cost governance instruction enforces **zero hardcoded values**:

- `projectName` must be a parameter with no default
- All tag values must reference parameters
- Budget amounts must be parameterised
- `.bicepparam` / `terraform.tfvars` is the only place for project defaults

## Adversarial Review Checklist

The Challenger reviews verify two mandatory cost categories:

**Cost Monitoring:**

- [ ] Budget resource exists
- [ ] Notifications comply with the governed cost-monitoring contract
- [ ] Anomaly detection configured
- [ ] Notification recipients are parameterised

**Repeatability:**

- [ ] No hardcoded project names or values
- [ ] `projectName` is a required parameter
- [ ] Template deploys to any tenant/region/subscription

## Post-Deployment Validation

After deployment, verify budget alerts are active:

```bash
# List budgets in the resource group
az consumption budget list \
  --resource-group rg-${PROJECT}-${ENV}

# Check budget notifications
az consumption budget show \
  --budget-name budget-${PROJECT}-${ENV} \
  --resource-group rg-${PROJECT}-${ENV}
```

---

:::tip[Further Reading]

- The mandatory IaC best-practices instructions
  (`.github/instructions/iac-bicep-best-practices.instructions.md` and `iac-terraform-best-practices.instructions.md`)
  enforce these patterns automatically via glob matching
- **Reusable budget patterns** are available in the IaC pattern skills:
  - Bicep: `.github/skills/azure-bicep-patterns/references/budget-pattern.md`
  - Terraform: `.github/skills/terraform-patterns/references/budget-pattern.md`
- [MCP Integration](/concepts/how-it-works/mcp-integration/)
  — Azure Resource Manager MCP pricing and cost tools
- [Workflow](/concepts/workflow/) — how cost estimation fits into the agent workflow

  :::

## Related

- [Quickstart](/getting-started/quickstart/) — install and run your first project
- [Workflow](/concepts/workflow/) — how agents collaborate across steps
- [Troubleshooting](/guides/troubleshooting/) — diagnose failed deploys
