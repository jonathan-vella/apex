<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Compute Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

- User asks which Azure VM or VMSS to choose for a workload
- User needs VM size recommendations for web, database, ML, batch, HPC, or other workloads
- User wants to compare VM families, sizes, or pricing tiers
- User asks about trade-offs between VM options (cost vs performance)
- User needs a cost estimate for Azure VMs without an Azure account
- User asks whether to use a single VM or a scale set
- User needs autoscaling, high availability, or load-balanced VM recommendations
- User asks about VMSS orchestration modes (Flexible vs Uniform)

## Workflow

> Use reference files for initial filtering

> **CRITICAL: then always verify with live documentation** from learn.microsoft.com before making final recommendations. If `web_fetch` fails, use reference files as fallback but warn the user the information may be stale.

### Step 1: Gather Requirements

Ask the user for (infer when possible):

| Requirement            | Examples                                                           |
| ---------------------- | ------------------------------------------------------------------ |
| **Workload type**      | Web server, relational DB, ML training, batch processing, dev/test |
| **vCPU / RAM needs**   | "4 cores, 16 GB RAM" or "lightweight" / "heavy"                    |
| **GPU needed?**        | Yes → GPU families; No → general/compute/memory                    |
| **Storage needs**      | High IOPS, large temp disk, premium SSD                            |
| **Budget priority**    | Cost-sensitive, performance-first, balanced                        |

> _See SKILL.md for full content._

## Error Handling

| Scenario                        | Action                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------ |
| API returns empty results       | Broaden filters — check `armRegionName`, `serviceName`, `armSkuName` spelling  |
| User unsure of workload type    | Ask clarifying questions; default to General Purpose D-series                  |
| Region not specified            | Use `eastus` as default; note prices vary by region                            |
| Unclear if VM or VMSS needed    | Ask about scaling and instance count; default to single VM if unsure           |
| User asks VMSS pricing directly | Use same VM pricing API — VMSS has no extra charge; multiply by instance count |

## References

- [VM Family Guide](references/vm-families.md) — Family-to-workload mapping and selection
- [Retail Prices API Guide](references/retail-prices-api.md) — Query patterns, filters, and examples
- [VMSS Guide](references/vmss-guide.md) — When to use VMSS, orchestration modes, and autoscale patterns

## Reference Index

Load these on demand — do NOT read all at once:

| Reference | When to Load |
| --------- | ------------ |
| `references/retail-prices-api.md` | Retail Prices Api |
| `references/vm-families.md` | Vm Families |
| `references/vmss-guide.md` | Vmss Guide |
