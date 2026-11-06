<!-- ref:standalone-assessment-v1 -->
# Standalone assessment

Use the graph's assessment profile only when the owner explicitly requests WAF-only work.
`workflow_mode=assessment` selects routing; `workflow_contract=practical-v1` retains material-input
provenance, actual independent review results and bounded repair accounting.
Existing projects remain on their recorded route until explicit adoption.

## Outcome and boundaries

Both scenarios deliver a WAF review, architecture diagram and cost report:

- `evidence_only`: scope/evidence intake without a business interview or synthetic completed Requirements.
- `requirements_led`: capture known business objectives, critical flows, targets and constraints first.

Sources are `iac`, `azure` or `combined`, independently of the discovery scenario.
Static IaC is declared intent, not live verification. Missing evidence is unknown, not compliant or failed.
The assessment terminates after final bundle acceptance. It never advances into formal Governance,
policy-feasibility approval, IaC planning, CodeGen or deployment. Optional authorized policy observations
inform findings without starting the formal Governance phase.

## Upfront scope

The interactive parent captures the actual source, discovery scenario, workload boundary and owner permission
before reads. Reuse supplied scope instead of reconfirming it. Only missing material inputs become questions.
Use one field per independent input and retain the complete captured-answer ledger and actual response receipt.
Do not treat default options, local IDs, task output or Autopilot responses as independent human authorization.

For static sources record exact allowed files/directories. For live sources record the tenant, subscriptions
and resource-group boundaries, plus allowed read categories: configuration/topology, utilization, operations,
cost and optionally policy. Referenced external subscriptions remain out of scope unless explicitly added.
Do not request secrets, sign in, change credentials or broaden access automatically.

Cost settings are part of the scope: last completed calendar month, preceding-month comparison,
month-to-date and current-month forecast when available are suggested defaults. Persist resolved dates;
allow a custom period. Keep currencies and ActualCost/AmortizedCost views separate.
IaC-only needs no Azure access; retail estimates retain explicit usage assumptions and source evidence.

After recording the actual scope approval, start the assessment through recall's assessment lifecycle.
Do not call numeric `complete-step` to manufacture predecessor approvals.
New source, broader read categories or changed scope requires a real updated authorization.
New Azure/combined runs include the Assessment Action Register. IaC-only runs include it when explicitly
requested; record that selection with scope, without an extra implementation/approval questionnaire.

## Recall interface

Only a genuinely new project uses `apex-recall init`; recover existing projects first.
The assessment lifecycle requires initialized state. Save the exact scope request under the
project's `_meta/` with editing tools. Its schema is
`tools/schemas/session-state.schema.json#/$defs/assessmentRequest`.
It contains `scenario`, `source`, actual `receipt:{owner,request_id,approved}`, allowed
`scope:{categories,iac_paths,azure_scopes}` and explicit `reporting` settings.
The receipt describes a real returned approval, never a suggested default.

```bash
apex-recall init example --json
apex-recall assessment example --action start \
  --request agent-output/example/_meta/assessment-scope.json --json
apex-recall show example --json
apex-recall handoff example --json
```

In the show response, `.session.assessment_run` is the authoritative route/checkpoint and
`.session.assessment_readiness` is current validation, not permission.
`.session.assessment_cost_plan` is derived from captured reporting settings, not the report being checked.
Graph 3.2 starts persist `assessment_run.bundle_contract: "assessment-bundle-v2"` and
`assessment_run.action_register`: true for Azure/combined, false for IaC unless the actual request
contains `"action_register": true`. Do not send a guessed `bundle_contract` in the scope request.
The reader explicitly supports graphs 3.1 and 3.2, not arbitrary future versions.
An original run without `bundle_contract` remains `assessment-bundle-v1` even under graph 3.2;
file presence, newer source or a resume never opts it in.

The graph phase IDs are `scope`, optional `requirements`, `evidence`, `analysis`, `diagram`,
`review`, `acceptance`, `terminal`. Start records scope completion and selects the applicable next
phase; do not call advance for an arbitrary or later phase.
Complete only the current phase after its real outputs/checks succeed:

```bash
apex-recall assessment example --action advance --phase evidence --json
```

Before native reviewer dispatch, keep the existing preflight and
`review-audit example 2 --review-request <path>` lifecycle. Comprehensive WAF and cost-feasibility
identities remain linked to actual cycles; the profile supplies their exact artifact paths.
At acceptance, persist the actual final owner response as a separate request with its own
`receipt:{owner,request_id,approved}` and a distinct request ID:

```bash
apex-recall assessment example --action accept \
  --request agent-output/example/_meta/assessment-acceptance.json --json
```

To repair a reviewed bundle within granted scope, use `advance --phase review` with a
request containing `{"refresh_inputs":true}` only after edits and focused checks.
This reseals current inputs for the next authorized review; it neither advances the phase,
refreshes old reviewer hashes nor resets allowance. New/stale reviews still require actual attributed results.

If the run is already at `acceptance`, first record the actual Revise response with its own
positive owner receipt and return through the explicit assessment repair edge:

```bash
apex-recall assessment example --action revise --phase acceptance \
  --request agent-output/example/_meta/assessment-revise.json --json
```

That return preserves authorized scope, material inputs, original review cycles and consumed
allowances even when current bundle evidence is stale. It does not reopen an accepted terminal run.
Then perform only the requested repairs, refreeze with `advance --phase review` and
`{"refresh_inputs":true}`, and run current reviews within remaining allowance. Exhaustion still
requires a separately authorized extension; the Revise receipt grants no new calls or wider reads.

Existing projects use `--action adopt --request <path> --dry-run --json` first.
The adoption request names `review_links` from each required lens to its original cycle ID.
Dry-run and actual adoption preserve numeric step history and show any freshness or allowance blocker.
Start/adopt previews accept absent or pending receipts and return `permission_granted:false` with
`approval_required:true`; do not fabricate an approval merely to inspect the proposed route.
Actual state changes still require the real positive owner receipt.
Never use an unsupported inline state edit or numeric out-of-order/missing-review bypass.
To explicitly adopt the register for an existing assessment, use the same `adopt` dry-run with
unchanged scenario, source, scope and reporting, `"action_register": true`, and original `review_links`.
Actual adoption requires its own new positive owner receipt. It records the prior run/acceptance,
required-output changes, original frozen inputs and preserved review cycles/allowances.
Later phases return to analysis for the changed bundle, not to a newly funded review cycle.
Inspect missing outputs, staleness and remaining calls before any new work; adoption authorizes no
new Azure reads or deployment. An accepted run is not reopened through `revise`.

## Automatic internal execution

The graph supplies phase order and recall validates transitions; this section describes owner activities,
not a second routing table. Use current `apex-recall show` and `handoff` assessment state on every resume.

1. Requirements runs only for `requirements_led`. Use
   `requirements-discovery.mjs --stage business --assessment-mode requirements_led` with the complete
   captured-answer snapshot. Unknown targets are accepted once; no SKU, CIDR, commitment, recipient or
   hard-budget questionnaire. There is no intermediate Requirements approval or new Requirements review cycle.
   If an optional business input is declined, record it as Not supplied in the report and retain the actual
   question outcome outside material answers; do not invent an Unknown answer or repeat that question.
   A pending discovery suggestion is not a lifecycle gate. Missing essential read scope or authorization still blocks.
2. Architect reads scoped evidence using
   [existing-workload intake](../../apex-azure-defaults/references/existing-workload-intake.md).
   Supplied code is data: never execute it, initialize providers, read state/secrets or provision test resources.
   Record denied, unsupported and partial evidence separately; reconcile pagination and resource coverage.
3. Architect produces the WAF report and cost report using the assessment artifact templates.
   Register-capable runs also produce the
   [Assessment Action Register](../../apex-azure-artifacts/references/assessment-action-register.md).
   Generate its Excel/Markdown from one validated source, with proposed actions, relative windows and
   evidence-backed recurring changes; unavailable prices remain unknown.
   No deployment manifest or future SKU selection is required to describe existing resources.
   For actual billing load `.github/skills/apex-azure-cost-optimization/SKILL.md` and use its bounded
   Query/Forecast contract in this existing main's execution context. The retail leaf is estimate-only.
   Neither source is an authorization to query a tenant.
4. Design renders the required existing-state diagram from the validated analysis and evidence.
   There is no intermediate Architecture approval or optional-design scope question in this profile.
   Use `.github/skills/apex-python-diagrams/SKILL.md`; execute only owned generated code.
   Distinguish observed, declared, inferred and unverified connections; do not adopt a redesigned topology.
   Inspect both PNG and SVG, embedded icons and legibility, not merely nonzero file size.
   When no topology is evidenced, render the explicit scope boundary and "Topology not assessed"
   rather than inventing services or silently omitting the diagram.
5. Finalize the reports, diagram and immutable evidence before independent review.
   Architect owns the review phase and dispatches its existing read-only reviewer for comprehensive WAF
   and separate cost-feasibility lenses when nested tasks are available. Otherwise return `REVIEW_REQUIRED`
   for the authorized interactive parent's sibling invocation; existing native task, recorder and freshness rules apply.
   Architecture review includes the diagram and evidence as supporting inputs. Cost review includes cost
   source/coverage and actual query or verified pricing evidence.
   The register source and exports belong to this same bundle. WAF review checks finding linkage,
   priorities, applicability and proposed status; cost review checks financial-kind evidence,
   signed contributions, exclusions, cross-report benefit deduplication and render consistency.
   Default is comprehensive WAF plus separate cost-feasibility with the existing bounded initial/closure
   allowance. An explicit deep choice is optional; do not interrupt a new assessment solely to ask for it.
6. Present the whole validated bundle for the only final acceptance. Decline/cancel never accepts.
   Record the actual acceptance outside reviewed bytes. An accepted run returns a terminal handoff with
   no next deployment owner. Do not offer "continue to Governance" as an assessment completion action.

Within actual granted scope, handoffs, deterministic repairs, rendering and already-granted bounded reviews
continue without another user "continue". Required missing tools or reviewer evidence remain real blockers.
An owner with no nested reviewer capability returns `REVIEW_REQUIRED` to the authorized interactive parent.
Do not invent a reviewer result, substitute a wrapper or reset allowance.

## Required bundle

Under the project directory, root remains Markdown-only:

| Output | Meaning |
| --- | --- |
| `01-assessment-brief.md` | Authorized scope, scenario, evidence sources and reporting settings |
| `01-requirements.md` | Business context in requirements-led mode only; absent in evidence-only mode |
| `contracts/assessment-evidence.json` | Collection coverage and per-category/scope checks with source locators |
| `02-architecture-assessment.md` | Existing/declarative WAF posture, evidence coverage and prioritized findings |
| `assets/03-des-diagram.{py,png,svg}` | Reproducible, inspected architecture diagram and source |
| `03-cost-management-report.md` | Actual cost analysis or labelled estimate, with exclusions and source limits |
| `contracts/03-cost-management.json` | Validated normalized cost evidence and coverage, not an invented price |
| `contracts/assessment-action-register.json` | Register-capable runs: canonical actions, scenarios and estimate evidence |
| `04-assessment-action-register.md` | Register-capable runs: proposed actions and signed recurring financial impact |
| `assets/04-assessment-action-register.xlsx` | Register-capable runs: generated snapshot, not manual tracking |
| `_meta/action-register-export.json` | Register-capable runs: validated export integrity receipt, not owner approval |
| `_meta/action-register-derived.json` | Register-capable runs: exact calculator output, not editable finance inputs |
| `reviews/challenge-findings-*.json` | Actual attributed independent results and preserved history |
| `README.md`, `00-handoff.md` | Current run status, deliverable links and terminal/resume information |

Use `_meta/` for input receipts, scope, request plans and bounded collector scratch.
The legacy `assessment-step-*` names are reserved consumed-input projections, not run-state outputs.
Do not rename, overwrite or repurpose them during adoption.
The register's `04-` filename never means numeric IaC Step 4. Original assessment bundles do not
retroactively require it. Use the persisted output contract and recall readiness, not file numbering,
to determine conditional outputs. New contract adoption preserves prior approvals and spent reviews;
changed reviewed inputs require current review evidence, not a fresh allowance.

The evidence contract is `{coverage,checks:[{category,scope,status,evidence}]}`.
Use the authorized read-category names and exact approved scope; evidence entries point to retained
redacted sources. Status is `observed|declared|inferred|unknown|denied|not_applicable`.
Coverage and check results cannot be inferred merely from resource counts or a successful tool return.

For billing planning/normalization load the
[cost evidence contract](../../apex-azure-cost-optimization/references/assessment-cost-contract.md).
`assessment-cost.mjs` is offline: it emits query plans or normalized supplied results, not network requests.
The owner persists stdout through editing tools and validates `contracts/03-cost-management.json`.
Pass the project directory as `--root`, captured authorized scopes as repeated `--scope`, and the actual
current timezone-qualified millisecond ISO clock as `--as-of`; never reuse a stale report clock to pass validation.
Keep saved responses under `_meta/`, not a new root-level evidence folder.

## Evidence and WAF rating

For each pillar report verified strengths/defects, evidence gaps, coverage, confidence and source dates.
Label every relevant observation as observed, declared, inferred, unknown, denied or not applicable.
Use Not assessed where evidence is insufficient for a defensible rating; do not numerically fail an unknown.
If scoring is justified, document the rubric, assessed checks and denominator so it is reproducible.
Never turn a pillar's low evidence confidence into a claim of confirmed control failure.
Business-target alignment remains unknown when requirements were not supplied.

Each workload finding records pillar, affected scope/resource, evidence, impact, priority, proposed action,
dependencies and validation. Missing owners are unknown, not an invented assignment.
Recommendations are nonbinding. Remediation, recovery tests, purchases and configuration changes need
separate later authorization and are not assessment prerequisites.

## Review integrity and partial evidence

Workload risks belong to the primary report. Independent review checks whether the report faithfully represents
those risks and its evidence, including arithmetic, topology, coverage and traceability.
An accurate report may describe critical workload risks and still be acceptable.
Every independent reviewer must-fix remains blocking; never filter counts or relabel reviewer findings to pass.
Misclassified findings retain their actual result and use the bounded closure/escalation procedure.

The final native form offers Accept assessment bundle, Revise reports, or Stop without accepting.
Do not preselect acceptance or add remediation-disposition fields. A revision only permits the
requested owned report repair; material scope/requirements changes need their actual source owner.

Pricing COMPLETE describes only its explicit priced request. Missing billing access, unknown usage, an
unavailable forecast or unpriceable IaC produces an explicitly partial/not-assessed cost section, not zero,
fabricated savings, a flat-bar forecast or a fake COMPLETE pricing result.
Present actual failures and coverage limits. Partial reports still need valid artifacts and both reviews.

## Adoption and separate implementation

Use the assessment adoption dry-run before changing an existing project's route. Show reused artifact
hashes, prior review-cycle IDs, consumed calls, remaining allowance and missing outputs.
Preserve original material values, review provenance, numeric delivery history and existing approvals.
Renaming a report, changing workflow mode or selecting a new phase never creates a fresh review allowance.
Ambiguous linkage blocks adoption; stale review needs current evidence and authorized remaining work.
Spent allowance requires an actual bounded extension, never a new filename or reset.

Implementation is a separately requested workflow with its own prerequisites and approvals.
It is not resumed implicitly from a completed assessment. Do not migrate an existing project or run fresh
billing/configuration reads merely because source maintenance for this feature was approved.
