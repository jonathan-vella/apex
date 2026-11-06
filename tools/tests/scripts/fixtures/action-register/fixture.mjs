/** Anonymized synthetic evidence for arithmetic and export tests, never customer quotes. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCostRequest,
  deriveReportingWindows,
  normalizeCostCollection,
  planCostQueries,
} from "../../../../scripts/assessment-cost.mjs";

export const AS_OF = "2026-11-06T10:00:00.000Z";
export const SCOPE = "/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic";
export const ACTUAL_RESOURCE = `${SCOPE}/providers/Microsoft.Compute/virtualMachines/actual`;
export const RETAIL_RESOURCE = `${SCOPE}/providers/Microsoft.Compute/virtualMachines/reference`;

export function fixture(root, { asOf = AS_OF, reporting } = {}) {
  fs.mkdirSync(path.join(root, "contracts"), { recursive: true });
  fs.mkdirSync(path.join(root, "evidence"), { recursive: true });
  const sources = new Map();
  const data = {
    schema_version: "action-register-v1",
    project: "synthetic",
    generated_at: asOf,
    as_of: reporting?.as_of ?? asOf,
    source: "azure",
    scopes: [SCOPE],
    evidence_refs: [],
    findings: [],
    resources: [],
    bases: [
      {
        id: "retail",
        source_type: "retail_reference",
        currency: "USD",
        period: "reference month",
        normalization: "730 hours",
        cost_view: "Retail",
        tax: "PreTaxCost",
        licensing: "No negotiated discounts or commitments assumed",
        region: "synthetic-region",
        assumptions: ["Synthetic supplied usage, not observed customer usage."],
      },
    ],
    actions: [],
    scenarios: [{ id: "base", name: "Proposed base recommendations", proposed: true, conditions: [], selections: [] }],
    coverage: {
      status: "assessed",
      reason: "Synthetic evidence complete for arithmetic tests; not workload evidence.",
    },
    assumptions: ["Synthetic test figures only; never Azure prices or customer quotes."],
  };
  const retain = (id, doc, kind = "support") => {
    const relative = `evidence/${id}.json`;
    const bytes = Buffer.from(JSON.stringify(doc));
    fs.writeFileSync(path.join(root, relative), bytes);
    sources.set(id, doc);
    const ref = {
      id,
      path: relative,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      collected_at: asOf,
      kind,
    };
    const existing = data.evidence_refs.findIndex((r) => r.id === id);
    if (existing >= 0) data.evidence_refs[existing] = ref;
    else data.evidence_refs.push(ref);
    return ref;
  };
  const waf = { findings: [{ id: "F1", pillars: ["Cost Optimization"], description: "Synthetic recommendation." }] };
  retain("waf", waf, "waf");
  data.findings.push({ id: "F1", pillars: ["Cost Optimization"], evidence_id: "waf", locator: "/findings/0" });
  const inventory = {
    resources: [ACTUAL_RESOURCE, RETAIL_RESOURCE].map((id) => ({
      id,
      name: id.split("/").at(-1),
      type: "Microsoft.Compute/virtualMachines",
      count: 1,
    })),
  };
  retain("inventory", inventory, "inventory");
  inventory.resources.forEach((resource, index) =>
    data.resources.push({ ...resource, evidence_id: "inventory", locator: `/resources/${index}` }),
  );
  const action = (id, finance, extras = {}) => {
    const row = {
      id,
      category: "Cost optimization and housekeeping",
      task: `Synthetic task ${id}`,
      pillars: ["Cost Optimization"],
      finding_ids: ["F1"],
      resource_ids: [],
      priority: "Medium",
      priority_rationale: "Supported synthetic planning priority, not reviewer severity.",
      impact: "Unknown",
      impact_rationale: "Business impact not captured.",
      effort: "Unknown",
      effort_rationale: "Implementation scope not captured.",
      dependencies: [],
      applicability: "unconditional",
      status: "Proposed - not started",
      comments: "",
      notes: ["Synthetic; no owner or implementation progress inferred."],
      target_window: "Weeks 2-4",
      window_rationale: "Proposed relative sequencing only.",
      finance: {
        basis_id: "retail",
        rationale: "Synthetic recurring comparison.",
        assumptions: ["Synthetic supplied usage."],
        confidence: "Medium",
        ledger: [],
        ...finance,
      },
      ...extras,
    };
    data.actions.push(row);
    data.scenarios[0].selections.push({
      action_id: id,
      included: true,
      reason: "Analytical recommendation, not owner approval.",
    });
    return row;
  };
  const retail = (id, monthly, resourceId, chargeId, basis = data.bases[0]) => {
    const leaf = {
      status: "COMPLETE",
      project_name: "synthetic",
      region: basis.region,
      currency: basis.currency,
      resources: [
        {
          name: "synthetic-line",
          service_name: "Synthetic Service",
          sku: "Synthetic SKU",
          region: basis.region,
          quantity: 1,
          notes: "Synthetic fixture supplied usage.",
          monthly_cost: monthly,
          resource_id: resourceId,
          charge_id: chargeId,
        },
      ],
      monthly_total: monthly,
      yearly_total: Number(monthly) * 12,
      optimization_notes: [],
      savings_status: "not_assessed",
      savings_reason: "Synthetic test",
      eligible_strategies: [],
      data_source: "Azure MCP pricing_get",
      queried_at: asOf,
      confidence: "Medium",
      unresolved_items: [],
      mcp_calls_used: 1,
      budget_exceeded: false,
      assumptions: basis.assumptions,
      assessment_basis: Object.fromEntries(
        ["period", "normalization", "cost_view", "tax", "licensing"].map((key) => [key, basis[key]]),
      ),
    };
    retain(id, leaf, "retail");
    return leaf;
  };
  const addRetail = (id, proposed, current = null, extras = {}) => {
    const resourceId = current === null ? `proposed:${id}` : RETAIL_RESOURCE;
    const chargeId = extras.charge ?? `charge-${id}`;
    retail(`${id}-proposed`, proposed, resourceId, chargeId);
    if (current !== null) retail(`${id}-current`, current, resourceId, chargeId);
    return action(
      id,
      {
        kind: current === null ? "new_service_gross" : "upgrade_delta",
        proposed_ref: `${id}-proposed`,
        ...(current === null ? {} : { current_ref: `${id}-current` }),
        ledger: [
          {
            resource_id: resourceId,
            charge_id: chargeId,
            evidence_id: `${id}-${current === null ? "proposed" : "current"}`,
            locator: "/resources/0",
          },
        ],
      },
      {
        resource_ids: current === null ? [] : [RETAIL_RESOURCE],
        ...Object.fromEntries(Object.entries(extras).filter(([key]) => key !== "charge")),
      },
    );
  };
  const addActual = (id = "actual-saving") => {
    const period = reporting ? reporting.periods[0] : deriveReportingWindows(asOf)[0];
    const request = reporting
      ? planCostQueries({ ...reporting, scopes: [SCOPE] }).requests[0].request
      : {
          id: "actual",
          scope: SCOPE,
          operation: "query",
          period,
          cost_type: "ActualCost",
          metric: "PreTaxCost",
          granularity: "None",
          group_by: ["ServiceName", "ResourceId"],
          expected_currency: "USD",
        };
    const collection = {
      source: "azure-cost-management",
      collected_at: asOf,
      request,
      pages: [
        {
          request_path: buildCostRequest(request, { approvedScopes: [SCOPE], asOf }).request_path,
          status_code: 200,
          body: {
            properties: {
              columns: [
                { name: "PreTaxCost", type: "Number" },
                { name: "Currency", type: "String" },
                ...request.group_by.map((name) => ({ name, type: "String" })),
                ...(request.granularity === "Daily" ? [{ name: "UsageDate", type: "Number" }] : []),
              ],
              rows: [
                [
                  "1000",
                  "USD",
                  ...request.group_by.map((name) => (name === "ResourceId" ? ACTUAL_RESOURCE : "Compute")),
                  ...(request.granularity === "Daily" ? [Number(period.from.slice(0, 10).replaceAll("-", ""))] : []),
                ],
              ],
              nextLink: null,
            },
          },
        },
      ],
    };
    const actualRef = retain("actual-collection", collection);
    const provenance = {
      path: actualRef.path,
      sha256: actualRef.sha256,
      collected_at: asOf,
      source: "azure-cost-management",
    };
    const evidence = normalizeCostCollection(collection, { approvedScopes: [SCOPE], asOf, provenance });
    const observedRef = retain("advisor-observed", {
      source: "azure-advisor",
      collected_at: asOf,
      scope: SCOPE,
      observations: [{ resource_id: ACTUAL_RESOURCE, data: { recommendation: "Synthetic rightsizing observation." } }],
    });
    const observed = {
      path: observedRef.path,
      sha256: observedRef.sha256,
      collected_at: asOf,
      source: "azure-advisor",
    };
    const savingsRef = retain("advisor-saving", {
      source: "azure-advisor",
      collected_at: asOf,
      scope: SCOPE,
      period,
      cost_type: "ActualCost",
      metric: "PreTaxCost",
      currency: "USD",
      resource_ids: [ACTUAL_RESOURCE],
      reduction_fraction: "0.15",
      method: "baseline_fraction",
      basis: { rationale: "Synthetic Advisor evidence.", evidence_refs: [observed] },
    });
    const opportunity = {
      id: "OP1",
      description: "Synthetic estimate only",
      baseline_evidence_id: request.id,
      resource_ids: [ACTUAL_RESOURCE],
      currency: "USD",
      reduction_fraction: "0.15",
      amount: "150",
      method: "baseline_fraction",
      provenance: { path: savingsRef.path, sha256: savingsRef.sha256, collected_at: asOf, source: "azure-advisor" },
    };
    const costReport = {
      schema_version: "1.0",
      as_of: data.as_of,
      generated_at: asOf,
      status: "complete",
      scopes: [SCOPE],
      periods: [period],
      evidence: [evidence],
      estimates: [],
      opportunities: [opportunity],
      exclusions: [],
      allocation_notes: ["No shared allocation claimed."],
      gaps: [],
    };
    retain("cost", costReport, "cost");
    if (!data.bases.some((b) => b.id === "actual"))
      data.bases.push({
        ...data.bases[0],
        id: "actual",
        source_type: "actual_closed_month",
        cost_view: "ActualCost",
        period: `${period.from}/${period.to}`,
        normalization: "closed calendar month",
      });
    return action(
      id,
      { kind: "savings", basis_id: "actual", opportunity: { evidence_id: "cost", opportunity_id: "OP1" } },
      { resource_ids: [ACTUAL_RESOURCE] },
    );
  };
  const save = () => {
    const input = path.join(root, "contracts/assessment-action-register.json");
    fs.writeFileSync(input, `${JSON.stringify(data, null, 2)}\n`);
    return input;
  };
  return { data, sources, retain, retail, action, addRetail, addActual, save };
}

export function exampleFixture(root, options) {
  const result = fixture(root, options);
  result.addRetail("addition-a", "1000");
  result.addRetail("addition-b", "200");
  result.addActual();
  const saving = result.addRetail("reference-saving", "50", "100");
  saving.finance.kind = "savings";
  result.save();
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2]);
  const created = exampleFixture(root);
  console.log(JSON.stringify({ root, input: created.save(), as_of: AS_OF }));
}
