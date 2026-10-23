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

Keep existing final stage gates. Ask only for missing material choices, scope changes
or operations beyond permission. Do not ask users to approve synchronizing records,
fixing counts/cross-references, or an already granted ordinary closure call.
Independent findings remain visible; suggestions are not automatically new questions.

After requirements scope is authorized, Governance may collect preliminary policy
feasibility before Architecture approval, without completing Step 3.5. No target means
provisional architecture, not tenant compatibility. Formal Governance reuses current
evidence and captured scope, performs reconciliation and retains its approval gate.
All Defender assignments are collected; presentation can suppress noise after analysis.

DEV/PROD readiness is action- and target-scoped. Keep a PROD hold visible while allowing
DEV only when shared-resource dependencies permit it. Deployment approval always names
the actual preview, environment and operation.

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
