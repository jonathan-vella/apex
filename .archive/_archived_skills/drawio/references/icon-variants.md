<!-- ref:icon-variants-v1 -->

# Azure Icon Variant Reference

Catalogue of common Azure service variants and prompt patterns so the agent
can disambiguate SKU/tier without guessing. Cross-references the variant
taxonomy in [`assets/drawio-libraries/azure-icons/manifest.json`](../../../../assets/drawio-libraries/azure-icons/manifest.json) `variants{}` (T-004).

This is the canonical reference for **T-017 (variant-aware MCP tool calls)**,
**T-032 (variant-aware shape ranker)**, and **T-035 (single-batch
search-shapes enforcement)**.

## When variants matter

The icon library is current (V23-November-2025) and distinguishes most service
families correctly. Variants matter only when:

- Prompt explicitly names a tier or SKU (`Premium`, `Standard S1`, `Managed Instance`, `Hyperscale`, `NC24ads_A100_v4`)
- Variant changes architectural meaning (e.g., ADLS Gen2 with HNS vs. plain Storage Account)
- Prompt has tiered alternatives present in the library

When the prompt does not specify a tier, use the family default (the unsuffixed
icon).

## Variant catalogue

### Compute

| Service family             | Variants in prompt                                        | Icon resolution                                                    | Label suffix                       |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| App Service Plan           | `Standard S1`, `Premium V3 P1v3`, `Isolated I1v2`         | `App Services` (single icon today)                                 | `(Standard S1)` etc. in cell label |
| Container Apps             | (no variants)                                             | `Container Apps`                                                   | (none)                             |
| Container Apps Environment | (no variants)                                             | `Container Apps Environments`                                      | (none)                             |
| Azure Functions            | `Consumption`, `Premium`, `Dedicated`, `Flex Consumption` | `Function Apps`                                                    | `(Consumption)` etc.               |
| AKS                        | `Public`, `Private`, `Azure CNI`, `Kubenet`               | `Kubernetes Services`                                              | `(Private, CNI)` etc.              |
| VM                         | `B-series`, `D-series`, `NC-series GPU`, `Confidential`   | `Virtual Machines` (B/D/etc.) or `Azure HPC Workbenches` (GPU/HPC) | `(NC24ads A100 v4)` etc.           |
| AML Compute                | `CPU cluster`, `GPU cluster`, `Inference cluster`         | `Machine Learning` (workspace) + `Azure HPC Workbenches` (compute) | `GPU Cluster (A100)`               |

### Data

| Service family       | Variants                                                                                                 | Icon resolution                                   | Label suffix          |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------- |
| SQL Database         | `Standard S1`, `Premium`, `Hyperscale`, `Serverless`                                                     | `SQL Database`                                    | `(Standard S1)` etc.  |
| SQL Managed Instance | `General Purpose`, `Business Critical`                                                                   | `SQL Managed Instances`                           | `(GP)` or `(BC)`      |
| Cosmos DB            | `NoSQL (single-region)`, `NoSQL (multi-region writes)`, `MongoDB API`, `Cassandra API`, `PostgreSQL API` | `Azure Cosmos DB`                                 | `(Multi-master)` etc. |
| Storage Account      | `LRS`, `ZRS`, `GZRS`, `RA-GZRS`                                                                          | `Storage Accounts`                                | `(GZRS)` etc.         |
| Storage (HNS)        | `ADLS Gen2 (Storage with HNS)`                                                                           | `Data Lake Storage Gen2` (NOT `Storage Accounts`) | `(HNS)`               |
| Cache for Redis      | `Basic`, `Standard`, `Premium`, `Enterprise`                                                             | `Cache Redis`                                     | `(Standard C1)` etc.  |

### Networking

| Service family          | Variants                       | Icon resolution                                         | Label suffix                       |
| ----------------------- | ------------------------------ | ------------------------------------------------------- | ---------------------------------- |
| Front Door              | `Standard`, `Premium`          | `Front Doors`                                           | `Front Door Premium` in cell label |
| Application Gateway     | `WAF v2`, `Standard v2`        | `Application Gateways`                                  | `(WAF v2)`                         |
| Azure Firewall          | `Basic`, `Standard`, `Premium` | `Firewalls`                                             | `(Premium)`                        |
| Bastion                 | `Basic`, `Standard`, `Premium` | `Bastions`                                              | `(Standard)`                       |
| Virtual Network Gateway | `VPN`, `ExpressRoute`          | `Virtual Network Gateways` (or `ExpressRoute Circuits`) | `ExpressRoute Gateway`             |
| Load Balancer           | `Basic`, `Standard`, `Gateway` | `Load Balancers`                                        | `(Standard)`                       |

### Security & identity

| Service family     | Variants                                          | Icon resolution                                              | Label suffix                |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Key Vault          | `Standard`, `Premium (HSM-backed)`                | `Key Vaults`                                                 | `(Premium)`                 |
| Managed HSM        | (single tier)                                     | `Key Vaults` (no separate icon) — label-only differentiation | `Managed HSM` in cell label |
| Microsoft Entra ID | (one core icon; `Entra External ID` for B2C/CIAM) | `Microsoft Entra` (or `Entra External ID`)                   | `(External ID)` for B2C     |

### Container Registry

| Service family | Variants                       | Icon resolution        | Label suffix |
| -------------- | ------------------------------ | ---------------------- | ------------ |
| ACR            | `Basic`, `Standard`, `Premium` | `Container Registries` | `(Premium)`  |

### Messaging

| Service family | Variants                                 | Icon resolution                                       | Label suffix          |
| -------------- | ---------------------------------------- | ----------------------------------------------------- | --------------------- |
| Service Bus    | `Basic`, `Standard`, `Premium`           | `Service Bus`                                         | `(Premium)`           |
| Event Hubs     | `Standard`, `Dedicated cluster`          | `Event Hubs` (or `Event Hubs Clusters` for dedicated) | `(Dedicated Cluster)` |
| Event Grid     | `System topic`, `Custom topic`, `Domain` | `Event Grid` (one icon)                               | `(System topic)` etc. |

### Observability

| Service family     | Variants                              | Icon resolution                | Label suffix |
| ------------------ | ------------------------------------- | ------------------------------ | ------------ |
| App Insights       | `Workspace-based`, `Classic` (legacy) | `Application Insights`         | (none)       |
| Log Analytics      | (single tier)                         | `Log Analytics Workspaces`     | (none)       |
| Sentinel           | (built on LA workspace)               | `Microsoft Sentinel`           | (none)       |
| Defender for Cloud | `Free`, `Standard`                    | `Microsoft Defender for Cloud` | (none)       |

## Single-batch search-shapes contract (T-035)

The skill says "one batched call" — the T-012 baseline showed drift in 4/7
captures (G3=3 calls, G4=4 calls). Encode this as an agent-body contract:

```text
THE FIRST search-shapes CALL MUST CONTAIN ALL ICON QUERIES.

If a follow-up shape need is discovered later in the run, the agent MUST
either:
  (a) add the missing icon to the next add-cells batch via shape_name
      (server resolves; no second search-shapes needed), or
  (b) accept that the icon batch is incomplete and document the gap in
      the run notes.

Splitting search-shapes across multiple calls is workflow drift — measured
as friction event #1 in the T-012 baseline. Do not do this.
```

## Variant disambiguation pattern

When the prompt mentions a tier/SKU but the icon library has only the family
icon, the variant lives in the **cell label**, not the icon. The label suffix
column above is the canonical pattern.

```json
{
  "type": "vertex",
  "shape_name": "Front Doors",
  "text": "Front Door Premium",
  "x": 200,
  "y": 100
}
```

vs. when prompt is generic:

```json
{
  "type": "vertex",
  "shape_name": "Front Doors",
  "text": "Front Door",
  "x": 200,
  "y": 100
}
```

## When the icon library lacks a variant

Three escalation paths in order of preference:

1. **Use the family icon** + label suffix (default — works for 90% of cases).
2. **Use a sibling category icon** when one exists (e.g., `Event Hubs Clusters`
   for the dedicated tier when `Event Hubs` would understate).
3. **File a manifest gap** in [`assets/drawio-libraries/azure-icons/manifest.json`](../../../../assets/drawio-libraries/azure-icons/manifest.json)
   for the next icon-set refresh.

Do **not**: invent custom icons, reuse generic shapes (rectangle, ellipse), or
omit the resource.

## Cross-references

- [`assets/drawio-libraries/azure-icons/manifest.json`](../../../../assets/drawio-libraries/azure-icons/manifest.json) — `variants{}` taxonomy (T-004)
- [`SKILL.md`](../SKILL.md) — Icon Handling section
- [`abstraction-rules.md`](abstraction-rules.md) — what to show / omit
- [`quality-rubric.md`](quality-rubric.md) — Dimension 1 (Icon correctness) anchored 0–4 scale
- T-012 baseline G4 capture: variant labels worked (`(A100)`, `(HNS)`, `Premium`) but icons stayed family-default — rubric anchor 3/4

## Change control

Adding a new variant family:

1. Append a row to the appropriate variant catalogue table.
2. Update `manifest.json` `variants{}` entry for the family.
3. Run [`tools/scripts/check-azure-icons-freshness.mjs`](../../../../tools/scripts/check-azure-icons-freshness.mjs) (T-005) to confirm no drift against MS Learn.
4. Update T-032 ranker test fixtures with at least one query that should boost the new variant.
