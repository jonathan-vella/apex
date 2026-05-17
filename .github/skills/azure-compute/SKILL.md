---
name: azure-compute
description: '**ANALYSIS SKILL** — Recommend Azure VM sizes and VMSS for workload, performance, and budget. Uses public docs and the Azure Retail Prices API. WHEN: "recommend VM size", "choose Azure VM", "GPU VM", "compare VM sizes", "VMSS vs VM", "autoscale VMs". DO NOT USE FOR: provisioning VMs (azure-prepare), VM pricing for budgets (azure-pricing MCP).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.2"
---

# Azure Compute Skill

Recommend Azure VM sizes, VM Scale Sets (VMSS), and configurations by analyzing workload type, performance requirements, scaling needs, and budget. No Azure subscription required — all data comes from public Microsoft documentation and the unauthenticated Retail Prices API.

## When to Use This Skill

- User asks which Azure VM or VMSS to choose for a workload
- User needs VM size recommendations for web, database, ML, batch, HPC, or other workloads
- User wants to compare VM families, sizes, or pricing tiers
- User asks about trade-offs between VM options (cost vs performance)
- User needs a cost estimate for Azure VMs without an Azure account
- User asks whether to use a single VM or a scale set
- User needs autoscaling, high availability, or load-balanced VM recommendations
- User asks about VMSS orchestration modes (Flexible vs Uniform)

## Rules

- **Always verify against live docs** — call `web_fetch` against `learn.microsoft.com` before finalizing recommendations; warn the user when `web_fetch` fails
- **Default to General Purpose D-series** when workload type is unclear
- **Default region** follows the canonical declaration in [copilot-instructions.md](../../copilot-instructions.md#azure-defaults-canonical); prices vary by region
- **Default to single VM** when scaling needs are unclear; recommend VMSS only when autoscale, fleet, or mixed-size requirements are explicit
- **VMSS pricing** = VM pricing × instance count (no extra VMSS charge)
- **Reservation pricing** is recommended for long-lived production VMs (1y/3y commitments)
- **No deployment** — this skill recommends sizes; for provisioning use `azure-prepare`

## Steps

The full 6-step procedure (with all decision tables, dichotomy tree, and `web_fetch` URLs) lives in **[references/recommendation-workflow.md](references/recommendation-workflow.md)**. Load it on demand. Summary:

1. **Gather requirements** — workload type, vCPU/RAM, GPU, storage, budget, OS, region, instance count, scaling, HA, load balancing
2. **Determine VM vs VMSS** — VMSS for autoscale / fleet / mixed sizes (Flexible orchestration); VM for single long-lived servers, jumpboxes, AD DCs. Default to single VM when unsure
3. **Select VM family** — pick 2–3 candidates from [vm-families.md](references/vm-families.md), then verify specs via `web_fetch` against `learn.microsoft.com`
4. **Look up pricing** — Azure Retail Prices API per [retail-prices-api.md](references/retail-prices-api.md); for VMSS multiply by instance count
5. **Present 2–3 recommendations** — include hosting model, VM size, vCPU/RAM, instance count, $/hr, fit, trade-off
6. **Offer next steps** — reservation pricing, [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/), VMSS autoscale + networking docs

> **Critical**: always verify recommendations against live `learn.microsoft.com` docs via `web_fetch`. If `web_fetch` fails, proceed with reference-file guidance and warn the user data may be stale.

## Error Handling

| Scenario                        | Action                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| API returns empty results       | Broaden filters — check `armRegionName`, `serviceName`, `armSkuName` spelling                                                           |
| User unsure of workload type    | Ask clarifying questions; default to General Purpose D-series                                                                           |
| Region not specified            | Use the canonical default from [copilot-instructions.md](../../copilot-instructions.md#azure-defaults-canonical); prices vary by region |
| Unclear if VM or VMSS needed    | Ask about scaling and instance count; default to single VM if unsure                                                                    |
| User asks VMSS pricing directly | Use same VM pricing API — VMSS has no extra charge; multiply by instance count                                                          |

## References

- [Recommendation Workflow](references/recommendation-workflow.md) — Full 6-step procedure with decision tables and `web_fetch` URLs
- [VM Family Guide](references/vm-families.md) — Family-to-workload mapping and selection
- [Retail Prices API Guide](references/retail-prices-api.md) — Query patterns, filters, and examples
- [VMSS Guide](references/vmss-guide.md) — When to use VMSS, orchestration modes, and autoscale patterns

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                               | When to Load                                     |
| --------------------------------------- | ------------------------------------------------ |
| `references/recommendation-workflow.md` | Full Steps 1–6 (decision tables, web_fetch URLs) |
| `references/retail-prices-api.md`       | Pricing queries (Step 4)                         |
| `references/vm-families.md`             | VM family selection (Step 3)                     |
| `references/vmss-guide.md`              | VMSS vs VM decision (Step 2)                     |
