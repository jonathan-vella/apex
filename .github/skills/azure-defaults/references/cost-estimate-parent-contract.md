<!-- ref:cost-estimate-parent-contract-v1 -->

# Cost-Estimate Subagent — Parent Contract

Caller-side delegation rules every parent agent that emits dollar
figures MUST follow when invoking
[`cost-estimate-subagent`](../../../agents/_subagents/cost-estimate-subagent.agent.md).
Applies today to [`03-architect`](../../../agents/03-architect.agent.md)
(planned costs) and [`08-as-built`](../../../agents/08-as-built.agent.md)
(as-built costs). Any future agent that surfaces Azure pricing in a
user-facing artifact MUST read this file before invocation.

---

## Pricing Accuracy Gate (HARD)

Parent-side model evaluation found agents hallucinating Azure SKU prices
(e.g., AKS Standard at $0.60/hr instead of $0.10/hr) when writing from
parametric knowledge. **ALL dollar figures in user-facing artifacts MUST
come from `cost-estimate-subagent` (Codex-powered, MCP-verified).**
Never write a price that did not originate from a subagent response.

## Delegation Procedure (5 steps)

1. **Prepare a resource list** — compile resource types, SKUs, region,
   and quantities from the upstream source:
   - **03-architect**: from the WAF assessment / sku-manifest.
   - **08-as-built**: from `az resource list` + Azure Resource Graph
     queries against the actual deployed environment (NOT the plan).
2. **Delegate to `cost-estimate-subagent`** — invoke with:
   - `resource_list`, `project_name`, `region`
   - `output_path` = `agent-output/{project}/<artifact>-cost-estimate.json`
     (per-agent: `02-cost-estimate.json` for 03, `07-ab-cost-estimate.json` for 08)
   - `overwrite` = `false` (set to `true` only when re-running after revisions)
   - Optional: `compare_regions: true`, `include_ri_savings: true`
3. **Receive the compact summary** — the subagent writes the full JSON
   breakdown to `output_path` and returns a ≤15-line summary
   (`status`, `region`, `monthly_total`, `yearly_total`, `file_path`,
   `confidence`). **Do NOT paste subagent JSON inline** in your reply
   or your artifact prose.
   **Checkpoint** (MANDATORY): `apex-recall checkpoint <project> <step> phase_<n>_pricing --json`
4. **Read the JSON file** from `output_path` to populate your
   step-owned artifact(s). Copy figures **verbatim** — do NOT round,
   adjust, or "correct" them.
5. **Cross-check totals** — verify that the sum of
   `resources[].monthly_cost` equals `monthly_total`. Flag any
   discrepancy to the user before proceeding to the next phase.

## MCP Tools the subagent uses on your behalf

| Tool                     | Purpose                                             | Preferred |
| ------------------------ | --------------------------------------------------- | --------- |
| `azure_bulk_estimate`    | All resources in one call (**use this by default**) | ✅ Yes    |
| `azure_region_recommend` | Find cheapest region for compute SKUs               | Optional  |
| `azure_price_search`     | RI/SP pricing lookup only (not for base prices)     | Optional  |
| `azure_cost_estimate`    | Fallback for single resource if bulk fails          | Avoid     |
| `azure_sku_discovery`    | Only if SKU name is unknown                         | Avoid     |

**Tip**: The subagent targets ≤ 10 MCP calls total (1 bulk +
up to 8 per-line `azure_price_search` fallbacks + optional region/RI).
When you build `resource_list`, include `service_name`, SKU, region,
and quantity so the subagent can use `azure_bulk_estimate` in one call.
The subagent returns only `COMPLETE` or `FAILED` — it never returns
`PARTIAL`; treat `FAILED` as a hard stop and surface the
`unresolved_items[]` list to the user. Refer to the **azure-defaults**
skill for canonical `service_name` values.

## No Parametric Fallback (HARD)

**No fallback to parametric knowledge or the Azure Pricing Calculator.**
If `cost-estimate-subagent` fails or is unavailable, STOP and notify
the user. Do NOT write dollar figures from memory. Do NOT proceed to
artifact generation without subagent-verified prices.
