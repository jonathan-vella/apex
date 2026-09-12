<!-- ref:cost-estimate-parent-contract-v1 -->

# Cost-Estimate Subagent — Parent Contract

Caller-side delegation rules every parent agent that emits dollar
figures MUST follow when invoking
[`cost-estimate-subagent`](../../../agents/_subagents/cost-estimate-subagent.agent.md).
Applies today to [`03-architect`](../../../agents/03-architect.agent.md)
(planned costs) and [`08-as-built`](../../../agents/08-as-built.agent.md)
(as-built costs). Any future agent that surfaces Azure pricing in a
user-facing artifact MUST read this file before invocation.

## Model And Harness Contract

Agent frontmatter owns assignments; this is a current routing summary, not an override:
`03-Architect` uses `gpt-5.6-sol`, `08-As-Built` uses `GPT-5.6-Terra`, and
`cost-estimate-subagent` uses `GPT-5.6-Luna`. Keep the independently required
cost-feasibility review with `challenger-review-subagent` (`GPT-5.6-Terra`).
These labels do not establish runtime cost-tier eligibility, model availability,
or API parameters. Do not infer effort settings or pricing from their names.
If the active harness cannot invoke the declared worker, STOP and notify the user;
never substitute models, a nested main-agent wrapper, or parent-authored prices.
Local prompt metadata is not an Agent Host routing contract; skills inherit caller
model/tools and require explicit selection of the owning agent.

---

## Pricing Accuracy Gate (HARD)

Parent-side model evaluation found agents hallucinating Azure SKU prices
(e.g., AKS Standard at $0.60/hr instead of $0.10/hr) when writing from
parametric knowledge. **ALL dollar figures in user-facing artifacts MUST
come from `cost-estimate-subagent` (ARM MCP-verified).**
Never write a price that did not originate from a subagent response.

## Delegation Procedure (5 steps)

1. **Prepare a resource list** — compile resource types, SKUs, region,
   and quantities from the upstream source, preserving each environment,
   region, and independent stamp plus effective overrides and explicit usage:
   - **03-architect**: from the WAF assessment / sku-manifest.
   - **08-as-built**: from `az resource list` + Azure Resource Graph
     queries against the actual deployed environment (NOT the plan).
2. **Check current pricing evidence**, then delegate only when needed.
   Reuse a persisted COMPLETE worker result only after the freshness and
   full-input equivalence checks in [pricing guidance](pricing-guidance.md#evidence-reuse).
   Missing evidence, changed deployment inputs, expiry, or explicit refresh
   requires `cost-estimate-subagent`; never infer current prices from a path
   or restamp reused rates. Reuse preserves the independent cost-feasibility review.
   Invoke with:
   - `resource_list`, `project_name`, `region`
   - `output_path` = `agent-output/{project}/<artifact>-cost-estimate.json`
     (per-agent: `02-cost-estimate.json` for 03, `07-ab-cost-estimate.json` for 08)
   - `overwrite` = `false` (set to `true` only when re-running after revisions)
   - Optional: `compare_regions: true`, `include_ri_savings: true`
3. **Receive the compact summary** — the subagent writes the full JSON
   breakdown to `output_path` and returns a ≤15-line summary (or use the
   equivalent persisted result after the checks above)
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

| Tool | Purpose | Context |
| --- | --- | --- |
| `get_retail_prices` | Planned-resource retail prices | Primary |
| `query_costs` | Actual cost by Azure scope | Deployed only |
| `query_aks_costs` | Actual AKS cost breakdown | Deployed only |
| `forecast_costs` | Scope cost forecast | Optional, deployed only |
| `get_benefit_recommendations` | Reservation and savings-plan analysis | Optional |

The subagent deduplicates identical service, ARM SKU, region, meter, price-type,
and currency queries within its MCP call budget. Include explicit usage for
non-hourly meters. Canonical query and calculation rules live in
[`pricing-guidance.md`](pricing-guidance.md).

The subagent returns only `COMPLETE` or `FAILED`; it never returns `PARTIAL`.
Treat `FAILED` as a hard stop and surface `unresolved_items[]` to the user.

## No Parametric Fallback (HARD)

**No fallback to parametric knowledge or the Azure Pricing Calculator.**
If `cost-estimate-subagent` fails or is unavailable, STOP and notify
the user. Do NOT write dollar figures from memory. Do NOT proceed to
artifact generation without subagent-verified prices.
