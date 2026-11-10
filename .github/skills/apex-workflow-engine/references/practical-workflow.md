<!-- ref:practical-workflow-v1 -->
# Practical workflow contract

`practical-v1` is the default for new projects, not a lightweight mode. Existing
projects remain legacy until explicit owner-approved adoption. Stage approvals,
independent lenses, both IaC tracks and production deployment approvals remain.

## Authority and material changes

| Concern | Authority | Routine work |
| --- | --- | --- |
| Policy facts and prices | Original discovery and pricing evidence | Never replace with a human preference |
| Material choices | Recall `decisions.material_inputs`; history in `decision_log` | Reuse captured values; never infer approval from free text |
| Phase scope | Explicit owner-granted `decisions.phase_scopes` | Rendering and mechanical owned repairs only |
| Current assessment | Derived immutable projection of consumed material inputs | Regenerate related views together; completion checks the binding |
| Review verdict | Actual attributed reviewer result | Never edit, restamp or force approval |

Protected choices include target/environment, subscriptions, topology/SKUs, budgets,
usage, residency, security/network access, exceptions, approval and review allowance.
Every material input is protected regardless of its field name. A routine repair
cannot change its value, scope, owner or provenance. Unstructured semantic changes
are not mechanically proven safe: return them to their owner or independent review.
No extra classification worker or runtime hook is introduced.

Record scope once through the existing stage/start interaction. A request ID records
provenance; it does not prove owner authority, enlarge role permissions or authorize
Azure operations. Cancel stops and decline never approves.

## Input request provenance

For material-input records, `request_id` is an APEX correlation key, not a required SDK-issued ID.
Native `ask_user` may return answers without an interaction ID; that absence alone is not a workflow blocker.
This does not relax actual-answer evidence, owner/environment scope, independent reviews or human gates.
Reviewer invocation IDs and signed risk-authorization provenance retain their separate contracts.

- **New questions:** `requirements-discovery.mjs` emits an APEX-local `request_id` and
  `request_id_source: "apex-local"` outside `form`. Persist the envelope in authorized project `_meta/` scratch
  before display. Validate `form` with its separate `context`; send only `form.message` and
  `form.requestedSchema` to `ask_user`. Keep the saved ID through delegation, retries and continuation;
  regenerating a form creates a new request, not the identity of an earlier response.
- **Returned answers:** retain a project-local receipt with that ID, its local origin, the actual response,
  respondent, applicable environments and source locator where available. Record only explicitly supplied
  material values with `decide --input-record`, using the same ID. Preserve custom answers and explicit unknowns.
  Do not fill omitted fields from defaults/evidence, treat decline as an answer, or record cancellation as consent.
  A receipt records what was returned; Autopilot output still does not establish independent human authority.
- **Recovery:** when real earlier answers exist but no request ID was retained, allocate a new local capture ID
  in a receipt labelled `capture_mode: "recovered"`. Cite the existing conversation response and/or owned
  answer snapshot, preserve original values, owner and environment scope, and record the recovery time now.
  This ID identifies recovery of those actual answers; never call it a native ID, claim the receipt predated
  the response or attach answers to a newly generated but unasked form. Do not re-question settled inputs
  solely to manufacture an ID. Missing/conflicting answers or unknown owner/scope still block affected records.
- **Approvals:** a capture ID or receipt is not a stage/start approval, Azure read/write permission, signed
  authorization or review result. Record actual approvals separately; input recovery cannot grant or widen them.

The receipt stays outside the exact recall input-record schema below. Recall receives its existing
`input_id`, `value`, `environments`, `owner` and `request_id` fields; no schema bypass or state-file edit is needed.

## Complete-stage work package

At the existing stage/start interaction, scope the complete owned work: reconciliation, reports/projections,
focused validation, required independent lenses and ordinary closure if needed. Do not reduce a full-stage request
to collector-only or draft-only work and repeatedly return the unfinished stage to the owner.
Read-only, evidence-only and initialization-only requests retain their explicit narrower boundary.

Use the handoff's `blocked_prerequisites`, per-artifact review state and current `review_cycles` to identify
the actual recovery work before asking. Reuse an existing scope-matching grant. Otherwise batch missing stage
scope, genuinely applicable material choices and any necessary bounded review extensions into one contextual form,
with distinct fields where the inputs are independent. No approval defaults or administrative disposition fields.
Persist the actual response/receipt and use the existing phase-scope and `decide --review-extension` contracts;
the owner does not prepare JSON, calculate projection hashes or manage cycle IDs.
Do not replace an unchanged phase-scope request ID for bookkeeping; record review extensions separately.

When Architecture explicitly uses Corp assumptions, explain and scope the expected later target-policy reconciliation
at that same interaction. An owner may explicitly preauthorize one bounded follow-up per affected required lens,
including its maximum additional calls and DEV/PROD boundary. Save that actual grant with its receipt; after target
evidence and choices are final, record only a necessary extension against the existing cycle/current projection.
Do not silently grant future calls, infer read permission, raise limits on every resume or reset historical usage.
Existing projects and narrower grants gain no new authority from a kit update.
Phase-scope/cycle-extension APIs are practical-only; legacy projects retain their existing scope, accounting
and recovery contract unless explicitly adopted. Complete-stage batching itself grants no permission or allowance.

Collect complete current target evidence before final policy-sensitive reviews when actual read scope is available.
For explicitly deferred target evidence, retain the assumption qualification instead of pretending tenant verification.
Repair and freeze final inputs before spending an affected review allowance. Freeze exact immutable consumed files;
do not use a mutable research, `_meta` or retail-evidence folder merely for convenience. A directory that is itself
the defined review target, such as an IaC code tree, retains its real tree hash. New required inputs or changed
consumed bytes still invalidate affected reuse; this is not permission to ignore hashes or restamp old results.

Applicability and phase matter. Informational Audit observations normally become concrete planning/verification
requirements, not automatic deployment denials. Missing runtime proof for not-yet-deployed resources is Unverified,
not fabricated compliance and not by itself a reason to block design. Confirmed Deny/security conflicts and material
residency, ownership, cost or exception questions still require evidence and the appropriate owner decision.
Use bounded targeted read permission only when genuinely needed; do not broaden discovery or reprice unchanged scope.

After an actual grant, the coordinator routes each repair to its owning agent, records current attributed reviews
and presents the existing human stage gate. Do not rewrite earlier approvals, turn a findings disposition into
closure, self-review or continue into consequential operations. Exhausted bounds or persistent blockers produce
one consolidated escalation with the actual next decision, not a bare repeat of the resume command.

## Ordinary review cycle

Each required artifact/lens has one initial and at most one closure dispatch within
its explicit phase scope. All actual dispatches consume allowance, including empty,
malformed, timed-out or failed invocations. A preflight failure before dispatch does
not. Empty-output recovery retains its eligibility checks and consumes a remaining
slot; it is not a free third call. A valid result with failed publication is not
approval; recover the same attributed result only when the existing recorder permits.

Batch routine owned repairs, validate and freeze all affected inputs before closure.
Clean initial results need no closure. Preserve original findings and select current
evidence only through a verified same-cycle relationship. Persistent blockers,
material changes or exhausted bounds produce one consolidated escalation.
Further calls require an explicit bounded extension linked to the same cycle and
history, never a new filename, session, worker or migration budget reset.

## Evidence precedence

1. A supported data format permits reading, not approval.
2. Material input/scope or policy drift blocks affected reuse.
3. Repository-reviewed explicit compatibility can permit editorial guidance changes;
   unknown compatibility blocks. Original hashes remain provenance.
4. Workflow adoption selects behavior, not new permission or reviewer allowance.

A legacy readable review with unknown compatibility remains historical. Adoption
preserves all consumed attempts and approvals; it cannot invent an editorial mapping.
A DEV acceptance expanded to PROD changes material scope even if guidance is compatible.

## Internal routing and user questions

For explicit `workflow_mode=assessment`, the
[standalone assessment profile](standalone-assessment.md) supplies scope authorization and one final
bundle acceptance instead of the delivery stage gates below. It retains this contract's captured-input,
actual-review, freshness and allowance rules. No assessment acceptance authorizes Governance or deployment.
Existing projects are never silently migrated by a new default.

Keep existing final stage gates. Ask only for missing material choices, scope changes
or operations beyond permission. Do not ask users to approve synchronizing records,
fixing counts/cross-references, or an already granted ordinary closure call.
Independent findings remain visible; suggestions are not automatically new questions.
For existing-workload Assessment, follow the intake contract: ask only about material ambiguity in scope,
read authorization or business intent. Missing targets, controls and implementation details remain explicit
gaps; do not require per-finding dispositions or imply approval of remediation. Gate 1 approves the recorded
assessment requirements and scope only.

After requirements scope is authorized, select the
[policy source](../../apex-azure-governance-discovery/references/policy-source.md) once.
New delivery projects use `corp-policy-v1`; existing projects adopt only through an actual source choice.
Explicit hash-bound shared Corp assumptions may support Architecture approval without target identifiers;
the architecture remains tenant-unverified. Otherwise Governance collects preliminary policy feasibility
from authorized targets before Architecture approval, without completing Step 3.5.
Formal Governance reuses current evidence and captured scope, performs reconciliation and retains its approval gate.
Planning completion, CodeGen and deployment under the new contract require target-verified current evidence.
All Defender assignments are collected; presentation can suppress noise after analysis.

DEV/PROD readiness is action- and target-scoped. Keep a PROD hold visible while allowing
DEV only when shared-resource dependencies permit it. Deployment approval always names
the actual preview, environment and operation.
New-contract CodeGen/deployment entry also requires its own granted phase scope to consume current policy-source
and read inputs within their authorized environments. Capture that scope from the actual stage/start approval before
`start-step` or transition; a DEV-only policy grant never authorizes PROD entry.
Private policy-backed reviews freeze opaque private supporting references and every bound snapshot through the
[policy-source procedure](../../apex-azure-governance-discovery/references/policy-source.md#freeze-private-evidence-for-independent-review).

## Maintainer compatibility checklist

- Classify changed review guidance as normative or editorial in the PR.
- Declare exact old/new guidance snapshots when editorial compatibility is reviewed.
- Never declare material-input, security or evidence-coverage changes editorial.
- Test legacy records, interruption, concurrent writers and explicit scope expansion.
- Report synthetic question counts separately from observed session telemetry.

## Existing recall interfaces

New projects initialized with recall adopt this contract. For an existing project:

```bash
apex-recall decide <project> --adopt-workflow practical-v1 --dry-run --json
```

This reports legacy decisions/consumed attempts without writing. Actual owner-approved
adoption uses the same command without `--dry-run` and with `--rationale "<owner approval>"`.
It preserves all history; unattributed legacy attempts block new cycles until the owner
resolves attribution. It never grants fresh calls.

Record one captured material input with `decide --input-record <record.json>`:

```json
{
  "input_id": "diagnostic_acceptance",
  "value": "DEV accepted; PROD remains held for residency resolution",
  "environments": ["dev"],
  "owner": "platform-owner",
  "request_id": "actual-owner-response"
}
```

Record an existing phase/start approval with `decide --phase-scope <scope.json> --step <step>`:

```json
{
  "request_id": "actual-phase-scope-response",
  "input_ids": ["diagnostic_acceptance"],
  "environments": ["dev"]
}
```

Do not invent provenance or solicit a separate administrative approval when the existing
stage/start request already grants this scope. A phase-scope change needs actual new
approval provenance. Neither scope nor its revision renews review history.

Within granted write scope, `checkpoint <project> <step> <phase> --sync-assessment --json`
renders `assessment-step-<step>.json` and a matching Markdown block. Governance also
receives the derived `project_assessment` annotation without changing discovered findings
or the discovery signature. Completion rechecks both against current authority.
Read-only roles never run this writer.

For a review, freeze that JSON projection as a supporting input. Use existing
`record-review.mjs --preflight --request <request.json>`, then:

```bash
apex-recall review-audit <project> <step> --review-request <request.json> \
  --attempt-kind invocation --attempt-outcome started --json
```

Retain the request/digest. Record the actual outcome with that same request, and
`--review-result <published-findings.json>` only after successful attributed recording.
For closure supply `--closure-of <initial-request-id>` and a separate output path,
preserving the original review. Empty-output retry eligibility remains separate.
The CLI selects only validated current cycle evidence, not the newest-looking file.

Recording a returned review is not another reviewer dispatch. Native parent task records
may arrive after the worker completes; the recorder joins them by identity and uses its
existing bounded flush wait. A recording failure does not authorize a rerun or bypass.
If publication failed, retry recording the same attributed result once evidence is available,
then select it with the completed attempt's `--review-result`; do not add another start,
reset calls, refresh metadata or edit logs. If publication already succeeded, validate and
select that existing sidecar instead of overwriting it. Missing or conflicting evidence still blocks.

A further owner-approved `decide --review-extension <extension.json>` names `cycle_id`,
the new absolute `max_calls`, the current `projection_sha256` and actual approval
`request_id`. It appends history and cannot disguise spent calls.

Hold an action using a material input whose value contains `blocked_actions` and
`release_condition`; record its affected environments and owner normally.
`shared_with` names additionally affected environments. Missing shared-dependency
analysis is not proof of DEV/PROD independence. `show` exposes environment readiness,
consumed decisions and stale assessment views without repairing them.

Preliminary collection uses `04-policy-feasibility.json`; checkpoint with
`--policy-feasibility <snapshot.json>` validates it offline against the captured
`azure_read_scope` material input's `subscription_id` and explicit
`policy_read_scope: "subscription-and-inherited"`. No new read permission is
created. Formal Governance uses the same current full-coverage snapshot.

For equivalent pricing scenarios:

```bash
node tools/scripts/cost-estimate.mjs scenarios --input <verified-estimate.json> --request <scenarios.json>
```

The request maps scenario names to resource-name overrides of `quantity`/`usage_amount`.
New SKU/meter/region/commitment or ambiguous multi-meter usage returns to the pricing owner.
Output is comparison-only with original provenance and zero new queries. The committed
SKU manifest and mandatory cost-feasibility review remain authoritative.
