<!-- ref:assessment-cost-contract-v1 -->

# Standalone assessment cost contract

Use this branch for the explicitly selected standalone WAF assessment, not the general subscription
optimization workflow. Architect owns actual Cost Management Query/Forecast operations using its existing
execution tools and separately authorized billing scope. The existing pricing leaf remains retail-only.
This reference and the offline helper confer no Azure permissions, execution capability or approval.
IaC-only work needs no Azure authentication. Do not query Azure while implementing or testing this contract.

## Deliverables and coverage

Write `contracts/03-cost-management.json` and `03-cost-management-report.md` under the assessment project.
The JSON contract is `tools/schemas/assessment-cost.schema.json`; the Markdown explains the same evidence,
coverage, exclusions and uncertainty. It is not the legacy retail-estimate artifact or a SKU decision.

The report contains:

- `schema_version: "1.0"`, immutable reporting `as_of`, `generated_at` and `status`.
- Exact billing `scopes[]`, explicit `periods[]`, normalized actual `evidence[]`, separate `estimates[]`.
- Evidence-backed `opportunities[]`, shared/resource `exclusions[]`, `allocation_notes[]` and `gaps[]`.

Coverage is `complete`, `partial` or `not_assessed`, independently of lifecycle completion and report acceptance.
Honest inaccessible cost evidence can be a valid final deliverable. Never substitute retail estimates for missing
actual spend, invent a zero charge, or describe an API forecast as realized spend. No workload-wide combined total
exists in this contract. Keep currencies, metrics, cost views, scopes and forecast/actual row statuses separate.
For combined Azure/IaC evidence, correlate only evidenced resource identities; estimates are not duplicate charges,
proven deployed drift, or savings against the actual bill.
The [Assessment Action Register](../../apex-azure-artifacts/references/assessment-action-register.md)
models proposed recurring additions, upgrade deltas and savings separately. Cost-report opportunities are
referenced inputs to its contribution ledger, never an additional independent sum.
Do not weaken this report's actual-baseline opportunity checks to accept a new-service retail fee.

`source_kind: "actual"` identifies Cost Management API evidence, including separately labelled forecast rows.
`source_kind: "estimate"` identifies retail pricing evidence. Neither label is runtime tool-provenance certification:
the owner must retain the actual authorized operation/task result; independent review checks that attribution.

## Offline helper and CLI

`tools/scripts/assessment-cost.mjs` has no network client, credential handling, discovery or remediation.
All commands emit JSON to stdout; integrity/input failures emit `{ "valid": false, "errors": [...] }` and exit nonzero.
The helper does not execute the produced paths/bodies.
There is **no `publish` operation, `--output` option or automatic file writer**. `plan` and `normalize` return JSON
to stdout. The owner saves the pruned response envelope first using permitted editing tools, normalizes it,
then persists the returned record in the final report's `evidence[]`, creates the Markdown and validates before review.
Do not invoke a nonexistent publishing command or change hashes after review.

```bash
node tools/scripts/assessment-cost.mjs windows --as-of 2026-03-15T12:30:00Z
node tools/scripts/assessment-cost.mjs plan --input _meta/cost/plan.json
node tools/scripts/assessment-cost.mjs normalize --input _meta/cost/cost-pages.json \
  --root . --scope /subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic \
  --as-of 2026-03-15T12:30:00Z
node tools/scripts/assessment-cost.mjs validate --input contracts/03-cost-management.json \
  --root . --as-of 2026-03-15T12:30:00Z \
  --scope /subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic
```

Examples use synthetic identifiers only. `--root` is the **project directory**, for example `agent-output/example`,
not the repository/workspace root. The input file argument is resolved from the invoking process's working directory;
`provenance.path` is resolved relative to `--root`. From the repository directory, use
`--input agent-output/example/contracts/03-cost-management.json --root agent-output/example`.
New layout-v2 examples use `_meta/cost/` for saved responses and retained cost evidence.
Reference existing verified leaf output at its actual project-relative path; do not move or rewrite reviewed output
to match an example.
Always pass `--root` explicitly when normalizing saved files under that subdirectory; it remains the project directory.
Repeat `--scope`
for independent approved billing scopes; normalize requires it. Pass captured authorized scopes to validate,
or compare them externally: without `--scope`, validation checks only the report's declared scope list.
For readiness, optionally pass `--approved-plan '<JSON>'` with the actual captured plan configuration
(`as_of`, `scopes`, reporting periods/metric/currency settings). It rejects omitted or altered cost requests,
even when the edited report is internally consistent. Never derive that approval input from the report being checked.
Project-relative source paths cannot traverse or resolve through symlinks outside that root.
Do not pass authorization headers, access tokens, personal billing details or secret-bearing paths.

`--as-of` on validation/normalization is an explicit **current validation clock**, not an old reporting date.
Never pass `report.as_of` automatically to make stale sources pass. Normalized source bytes and report-generation
timestamps are rechecked at readiness; actual/utilization evidence expires after seven days, retail after thirty.
Timestamps require timezone-qualified ISO strings with at most millisecond precision; Python callers use
`datetime.isoformat(timespec="milliseconds")`, not implicit microseconds.
The final report's original hashes and reviewed bytes remain frozen; refresh requires the normal review contract.

Pure exports:

| Export | Contract |
| --- | --- |
| `deriveReportingWindows(asOf, {includePriorMtd})` | Resolve UTC calendar/reporting boundaries from an explicit timezone-qualified timestamp |
| `validateScopes(scopes)` | Exact ARM subscription/RG paths with GUID; reject duplicates/overlap and excessive fan-out |
| `buildCostRequest(request, {approvedScopes,asOf})` | Validate request and return `{request_path,body}` only |
| `planCostQueries(config)` | Return resolved periods and bounded per-scope Query/Forecast request plans |
| `allowedPaginationPath(nextLink, request)` | Return only the same authorized scope/operation/API-version path, never an arbitrary URL |
| `normalizeCostCollection(collection, {approvedScopes,asOf,provenance})` | Normalize supplied pruned saved pages without IO |
| `createNotAssessedEvidence(request, reason)` | Record an unattempted/unavailable operation without amounts |
| `sumCosts(values)` | Exact decimal addition, returned as a decimal string |
| `compareCostEvidence(current, previous, currency)` | Compare only matching complete historical scope/metric/type/currency windows |
| `assessmentCostStatus(evidence, estimates, gaps)` | Derive report coverage without conflating it with acceptance |
| `validateAssessmentCost(report, {asOf,readEvidence,approvedScopes,approvedPlan})` | Return `{valid,errors}`; injected reader returns original local bytes; approved plan binds captured reporting settings |

## Calendar and request planning

Plan input is `{as_of,scopes,periods?,cost_type?,metric?,expected_currency?,group_by?}`.
The JSON Schema supplies **no defaults** and the validator does not insert/coerce missing fields.
Only the plan helper defaults `cost_type=ActualCost`, `metric=PreTaxCost`, `granularity=Daily`,
query `group_by=["ServiceName","ResourceId"]` and forecast `group_by=[]`.
`expected_currency` has no default: omit it to preserve returned currencies without inventing conversion or empty-query zero.
The defaults are last completed calendar month, preceding calendar month, month-to-date through the as-of
instant, and current-calendar-month API forecast. Boundaries use UTC, including explicit millisecond-inclusive
month ends; an offset in `as_of` is converted to the corresponding UTC instant before resolving the calendar.
No local timezone, current machine clock, rolling thirty-day approximation or annual flat projection is substituted.

Each period is `{id,kind,from,to}`. Kinds are `closed_month`, `month_to_date`, `custom`, `forecast`.
Configured historical ranges must be ordered, start at a UTC day boundary, end no later than as-of,
and stay within the bounded ninety-two-day history/span. Reject invalid dates rather than shifting them.
For an optional comparable prior MTD period, explicitly request `includePriorMtd` from the window helper:
it is not an implicit additional query. A shorter preceding month truncates the period and is not comparable.
Adjacent completed calendar months may differ in length; custom/MTD comparisons require equal elapsed durations.
Zero prior spend produces an absolute change but no percentage.

Each request is:

```json
{
  "id": "previous",
  "scope": "/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic",
  "operation": "query",
  "period": {
    "id": "previous_month",
    "kind": "closed_month",
    "from": "2026-02-01T00:00:00.000Z",
    "to": "2026-02-28T23:59:59.999Z"
  },
  "cost_type": "ActualCost",
  "metric": "PreTaxCost",
  "granularity": "Daily",
  "group_by": ["ServiceName", "ResourceId"],
  "expected_currency": "USD"
}
```

Supported cost types are `ActualCost` and `AmortizedCost`; supported monetary metrics are `PreTaxCost` and `Cost`.
`expected_currency` is an expectation only: the API payload does not fabricate conversion or a currency filter.
Returned currencies remain separate. Only bounded non-personal service/resource dimensions are supported.
Forecast uses Daily/Monthly granularity without grouping, requests actual history alongside the forecast,
and excludes fresh partial costs. It must return explicit `CostStatus` to support a quantitative forecast.

Only exact approved subscription/RG scopes are supported. Tenant, management-group, billing-account and
parent-subscription fallback are forbidden. Authorized sibling RGs can be reported independently.
An authorized subscription and its child RG must use separate reports rather than an overlapping collection.
Do not widen collection to complete coverage; missing access is a gap. Do not read negotiated price sheets,
invoices, billing accounts or personal cost details unless separately and explicitly scoped.

## Saved Cost Management responses

Persist a pruned owner-operation envelope:

```json
{
  "source": "azure-cost-management",
  "collected_at": "2026-03-15T12:30:00.000Z",
  "request": {},
  "pages": [
    {
      "request_path": "/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic/providers/Microsoft.CostManagement/query?api-version=2023-11-01",
      "status_code": 403,
      "body": { "error": { "code": "AuthorizationFailed" } }
    }
  ]
}
```

Replace `request: {}` with the validated complete request above. Do not save raw CLI headers, credentials,
error messages, personal dimensions, tags or unrelated response metadata. Successful bodies retain only
`properties.columns`, `properties.rows` and `properties.nextLink`. Preserve original returned monetary columns,
their order/types, dates, currency, grouping and forecast row status. Retain all authorized pages.
Opaque API continuation values are not credentials; retain them only in scoped evidence, not in the Markdown report.

Normalize attaches provenance `{path,sha256,collected_at,source}`, where the SHA-256 covers the exact saved envelope
bytes. Validation rereads those bytes and recomputes normalization; editing an amount, request, status, collection time,
scope or referenced artifact cannot be hidden behind a report-only assertion. Pruning must occur before hashing/review.

Forecast requests for `Cost` may return either `Cost` or the documented `PreTaxCost` monetary column.
Resolve exactly one supported column while retaining the original requested metric in provenance;
both columns together are ambiguous and rejected. Query responses retain exact metric matching.

API row values are interpreted using declared columns, not fixed indices. Decimal amounts are strings in normalized
`series[]`, each partitioned by `{currency,cost_status}`, with exact sums and attributed `groups[]`.
Dates remain in each group's dimensions. Actual charge credits/refunds and net totals may be negative:
the signed decimal schema and exact sums preserve them, including fully offset zero totals.
Retail nonnegative validation is not applied to actual spend. Never drop credits to inflate costs or savings.
No separate per-service and per-resource query totals are added together.

Before calling a query complete, follow every valid `nextLink` at the same authorized scope, operation and API version.
Only `https://management.azure.com` and the validated relative path are supported; no credentials, alternate host/port,
extra query parameters or repeated continuations. The helper returns an allowed continuation **path**, not a command.
Repeated/missing/extra pages, duplicate rows and invalid columns produce explicit integrity gaps and cannot inflate totals.
Pagination is bounded; do not loop indefinitely or bypass denial with a wider scope or another interface.

Denied, throttled, missing/malformed responses and absent pages are `not_assessed`, or `partial` if a valid subtotal exists.
Literal empty rows count as zero only for an explicitly successful, fully paginated historical query with known reporting
currency and valid columns. Empty forecasts remain unavailable; history-only Forecast responses are not projections.
Unfinished pagination is never an invoice total. MTD amounts carry billing-latency/revision caveats.
Do not invent a numeric forecast from monthly retail rates or extrapolate history when the API is unavailable.

## Retail estimates and opportunities

`estimates[]` references the existing cost-estimate-subagent's independently verified output by exact relative path
and raw-byte hash, `source: "cost-estimate-subagent"`, original `queried_at` as `collected_at`, matching currency,
explicit usage assumptions, and an unchanged `monthly_total` decimal string. This helper validates the existing leaf
output contract; it does not invent meters, recalculate prices, or certify an actual leaf invocation.
The owner retains that invocation and its existing retail evidence checks. Candidate-only, empty, failed, stale or
changed pricing output cannot support a numeric workload total. Unresolved expressions/modules/unpriced components
stay in gaps. A failed estimate can be referenced with `monthly_total: null`, `status: "not_assessed"` and stated gaps.

Do not implement speculative rightsizing. Qualitative opportunities and missing utilization evidence belong in the
Markdown findings/gaps. Quantitative entries require a complete closed-month resource-attributed actual baseline,
matching currency, a separately authorized saved Advisor/utilization source and an explicit method.
Supported deterministic arithmetic is `baseline_fraction`: sum the named resources' observed baseline,
then multiply by the evidenced reduction fraction in `(0,1]`. It is potential, not realized, savings.
The supporting owner evidence must substantiate the fraction; utilization alone does not establish a safe smaller SKU.
Independent review verifies that substance and the actual tool attribution; a locally asserted source label is not proof.

The supporting envelope is bound exactly to:
`{source,collected_at,scope,period,cost_type,metric,currency,resource_ids,reduction_fraction,method,basis}`.
`basis` contains a substantive `rationale` and `evidence_refs[]` pointing to distinct, hashed, current captured
observations; a source label and asserted fraction alone cannot support savings. Each observation envelope retains
`{source,collected_at,scope,observations:[{resource_id,data}]}`. `data` is the pruned actual tool evidence,
not an invented recommended SKU or a safe-size conclusion inferred from low utilization. Every savings target must
appear in these scoped observations. The owner and independent reviewer establish the method's substantive validity;
the helper verifies lineage, freshness, target presence and arithmetic, not infrastructure suitability.
The supporting envelope's exact byte hash and timestamp are referenced in the opportunity's `provenance`.
The helper rejects unsupported methods/amounts, missing sources, retail/forecast/partial baselines, absent resources,
currency changes, excluded/shared allocations and repeated resource savings. No savings grand total is produced:
recommendations for the same resource cannot be stacked across periods, scopes or ActualCost/AmortizedCost views.
If source evidence or a defensible method is missing, omit the numeric opportunity and explain the gap instead.

## Minimal envelope examples

These are synthetic shapes, not billing evidence or permission to query. A minimal plan configuration is:

```json
{
  "as_of": "2026-03-15T12:30:00.000Z",
  "scopes": ["/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic"],
  "expected_currency": "USD"
}
```

`plan --input <configuration-file>` returns `{as_of,scopes,periods,requests}`.
Each `requests[]` item is `{request,request_path,body}`. Copy its complete `request` unchanged into the saved
response envelope, and save the exact path used for each owner-executed page. For example, a **minimal custom
historical query** with no grouping has this complete saved actual-source shape (not the grouped default plan):

```json
{
  "source": "azure-cost-management",
  "collected_at": "2026-03-15T12:30:00.000Z",
  "request": {
    "id": "previous",
    "scope": "/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic",
    "operation": "query",
    "period": {
      "id": "previous_month",
      "kind": "closed_month",
      "from": "2026-02-01T00:00:00.000Z",
      "to": "2026-02-28T23:59:59.999Z"
    },
    "cost_type": "ActualCost",
    "metric": "PreTaxCost",
    "granularity": "None",
    "group_by": [],
    "expected_currency": "USD"
  },
  "pages": [
    {
      "request_path": "/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic/providers/Microsoft.CostManagement/query?api-version=2023-11-01",
      "status_code": 200,
      "body": {
        "properties": {
          "columns": [{ "name": "PreTaxCost", "type": "Number" }, { "name": "Currency", "type": "String" }],
          "rows": [[12.5, "USD"]],
          "nextLink": null
        }
      }
    }
  ]
}
```

Normalization returns the complete `evidence[]` entry, including computed SHA-256 provenance, source request,
`source_kind:"actual"`, status, `series[]`, page count, safe continuation path and gaps. Do not hand-author its hash.
For literal successful empty `rows: []`, that entry contains a zero USD Actual series only after complete pagination.
For HTTP 403 with `body:{"error":{"code":"AuthorizationFailed"}}`, or schema-allowed unknown `body:{}`,
it instead contains `status:"not_assessed"`, `series:[]` and explicit gaps, not zero.

A minimal **retail estimate entry** belongs only in `estimates[]`:

```json
{
  "id": "iac-estimate",
  "source_kind": "estimate",
  "status": "complete",
  "provenance": {
    "path": "_meta/cost/retail-output.json",
    "sha256": "<replace with exact 64-character raw-byte SHA-256>",
    "collected_at": "2026-03-15T12:30:00.000Z",
    "source": "cost-estimate-subagent"
  },
  "currency": "USD",
  "monthly_total": "12",
  "assumptions": ["Explicit owner-supplied usage; retail estimate, not actual billing"],
  "gaps": []
}
```

The hash placeholder is intentionally not valid evidence; supply the exact retained, independently verified
leaf output's hash and original query timestamp. `"12"` is illustrative and must exactly match that output.
For an unavailable/failed estimate, use `monthly_total:null`, `status:"not_assessed"` and nonempty gaps.

A minimal **whole-report not-assessed envelope**, valid for an IaC run with no billing scope or usable estimate:

```json
{
  "schema_version": "1.0",
  "as_of": "2026-03-15T12:30:00.000Z",
  "generated_at": "2026-03-15T12:30:00.000Z",
  "status": "not_assessed",
  "scopes": [],
  "periods": [
    {
      "id": "previous_month",
      "kind": "closed_month",
      "from": "2026-02-01T00:00:00.000Z",
      "to": "2026-02-28T23:59:59.999Z"
    }
  ],
  "evidence": [],
  "estimates": [],
  "opportunities": [],
  "exclusions": [],
  "allocation_notes": ["No allocation assessed"],
  "gaps": ["IaC expressions remain unresolved; no complete retail output is available"]
}
```

For actual reports, populate `scopes`, retain the authorized `periods`, put normalized entries in `evidence`,
and derive `status` using `assessmentCostStatus`. Every declared Azure scope/period needs an actual or explicit
missing-data record; use `createNotAssessedEvidence(request, reason)` for an unattempted operation.
For estimate-only reports, keep `scopes:[]`, `evidence:[]`, populate `estimates`, and retain explicit reporting periods.
Keep every required top-level array, including empty `opportunities` and `exclusions`, and meaningful allocation notes.
