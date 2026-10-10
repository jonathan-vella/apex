# Explicit Lab Risk Authorizations

Risk acceptance is not technical closure. The original review remains `NEEDS_REVISION`, with unchanged findings,
severity, files and hashes. A current authorization can make only named gates `exception-authorized`.
Ordinary finding decisions, chat consent, `accepted_risks` and review selection confer no risk-owner authority.

## Supported Scope

Version 1 supports default-mode comprehensive Step 4 Plan findings for explicitly authorized non-production labs.
Requirements, Architecture, Governance and deep-review exceptions are unsupported and fail closed.
Normal workflows retain their existing gates. Authorization never overrides a failed contract, security validator,
policy precheck, provider constraint, deployment preview or missing required review.

Kit authorization permits only `plan-complete`, `codegen` and `code-complete` when explicitly listed. It establishes
maintainer authority over reusable kit authoring, not adopter authority over any tenant. Production reuse is prohibited.

Deployment needs a separate adopter authorization, including actual tenant/subscription, event, operation, tree/input
hashes and phase. The environment must be `non-production-lab`. Event expiry, cleanup owner, teardown deadline and an
accountable after-teardown obligation are mandatory. Kit authorization never permits deployment.

## Trust Boundary

An operator provisions an external, protected `risk-trust-v1` configuration and pins its exact bytes at process launch:

```bash
export APEX_RISK_TRUST_CONFIG=/protected/operator/risk-trust.json
export APEX_RISK_TRUST_SHA256=<operator-verified-full-sha256>
```

The agent must not create the trust file, compute a replacement pin to approve its own edits, or change these variables
to make authorization pass. Trust config must be outside the workspace, without symlink traversal or group/world writes.
Operator-controlled CI and Local/Host processes must use the same approved trust snapshot. Missing trust blocks only
exception workflows; it is not needed for normal reviewed workflows.

Trust grants contain `key_id`, Ed25519 `public_key`, accountable `principal`, exact `projects` and `actions`, roles,
tenant/subscription allowlists, `authority_evidence`, and a UTC validity window. No wildcards are supported. Roles are
`kit-maintainer`, `deployment-risk-owner`, `human-gate-approver`, `eligibility-reviewer` and `mandatory-exception-owner`.
`lifecycle-verifier` independently attests actual execution and teardown observations.
The operator must verify the real delegation and tenant/risk-owner authority before installing a grant; a role string
or subscription RBAC membership alone does not establish risk-acceptance authority.

The trust snapshot includes `revoked_ids`, `revoked_keys`, `not_before` and `expires_at`. Expired/unavailable snapshots
fail closed. Revocation distribution is operator-owned: provision and pin a new snapshot in every consumer, and expire
the previous snapshot at the agreed maximum offline interval. This is an offline trust mechanism, not a live tenant
identity or instantaneous revocation service. The threat boundary assumes trusted runtime code and operator launch
configuration; it cannot defend against an administrator replacing the evaluator or both the trust file and its pin.

Accepted limit for non-production labs: the trust file only needs to be owned by the running user and protected from
group/world writes. An AI agent or script running as that same user and controlling the launch environment could
create its own trust file and keys. The signatures therefore protect against honest mistakes and other users, not
against a misbehaving agent on the same account. Keep the trust file and its pin outside the agent's control (a
different account, a read-only mount or CI secrets) wherever that matters, and treat this feature as lab-only.

## Signed Contracts

Authoritative shapes are in [risk-authorization.schema.json](../../schemas/risk-authorization.schema.json).
External authorized signers issue `risk-envelope-v1` files:

```json
{
  "schema_version": "risk-envelope-v1",
  "key_id": "externally-provisioned-key-id",
  "payload": "<base64 of exact UTF-8 JSON payload bytes>",
  "signature": "<base64 Ed25519 signature over those exact payload bytes>"
}
```

Use an established external signing service or Node `crypto.sign(null, payloadBytes, privateKey)` in the protected
signer's environment. Never put signing keys in the repository, project artifacts, chat or model-visible tool output.
APEX verifies envelopes; it does not issue authority or sign on an owner's behalf.

`risk-authorization-v1` payloads require:

- Unique authorization ID, project, explicit scope/operation and exact permitted actions.
- `issued_at`, `not_before`, `expires_at` and exact enforced `revocation_conditions`: `input-change`, `scope-change`,
  `authority-revoked`, `authorization-revoked`, `validity-expired`.
- `authority_evidence` matching the independently provisioned trust grant.
- Review bindings: review byte reference, reviewed artifact reference, unchanged `cache_inputs`, complete
  `supporting_inputs`, and individually selected findings with rationale, residual impact and accountable owner.
- Verification obligations with ID, phase, owner and requirement.
- `preserved_reviews`: byte-pinned original reviews when a later explicit confirmation is selected; an empty array
  when the bound current review is itself the original. Altering an original blocks every consumer of that authorization.

Every binding must select exactly its current unresolved must-fix IDs. Extra/unlisted findings or reviews block.
Partial acceptance can be recorded externally, but cannot make a gate ready while another blocker remains uncovered.
Each Plan review must already declare supporting coverage for the IaC contract, policy property map, environment
manifest and both governance artifacts, the Plan's frozen inputs. The SKU manifest is excluded because Deploy and
As-Built mutate it after Plan. Legacy reviews without that coverage remain unchanged and are
ineligible until a separately authorized new review supplies it. Never restamp or expand a historical review's coverage.

Each finding's `eligibility_evidence` references a signed `risk-eligibility-v1` assessment from an independently trusted
reviewer whose principal differs from the accepting owner. It binds exact review bytes, finding ID, rule reference,
classification and source evidence. Applicable law, technical impossibility and unresolved eligibility block.
Mandatory requirements cannot be relabeled as guidance. `mandatory-with-exception` also requires a signed
`risk-mandatory-exception-v1`, from the actual rule authority with an exact `rules` grant and identical operation scope.
That attestation documents a valid exception; it cannot make a denied or technically impossible deployment executable.
Best-practice guidance alone is not a mandatory requirement.

## Authorization Then Human Approval

1. Obtain the independent eligibility assessment and owner-issued authorization without altering reviewed inputs.
2. Evaluate it read-only before presenting the separate human gate:

   ```bash
   apex-recall check-gate example-lab --action plan-complete --authorization-only \
     --risk-authorization agent-output/example-lab/risk-authorization.json --json
   ```

3. Present the original findings, residual impacts, exact permitted actions and evaluator result. A current result is
   eligibility for human approval, not approval itself. Have the authorized human separately issue
   `risk-gate-approval-v1`, binding the authorization envelope SHA-256, project, actions, approval time and validity.
   `verified_obligations` binds each required obligation to actual evidence bytes.
4. After that distinct approval, use the owner completion path:

   ```bash
   apex-recall complete-step example-lab 4 \
     --risk-authorization agent-output/example-lab/risk-authorization.json \
     --risk-approval agent-output/example-lab/risk-gate-approval.json --json
   ```

5. CodeGen still requires completed Step 4, frozen inputs and its normal checks. Before every entry/resume:

   ```bash
   apex-recall check-gate example-lab --action codegen --json
   ```

`transition --complete` accepts the same options and validates completion and destination actions before one write.
`start-step` checks downstream entry. Saved selections are revalidated, not treated as cached permission.
Both actions must be listed to transition directly from Plan to CodeGen. Plan approval alone permits stopping there.
Combining risk authorization with the missing-review bypass is prohibited.

## Deployment And Teardown

Use `--risk-authorization`, `--risk-approval` and `--deployment-context` for a separately authorized lab deployment.
The context must bind actual `tenant_id`, `subscription_id`, `event_id`, `environment`, `operation`, `tree_hash`,
`inputs_hash` and `phase`. Deployment consumers must reconcile those values with the actual account, handoff and
resolved runtime inputs before invoking `check-gate --action deploy`, and again immediately before any write.
All existing live policy, security, preview and final human deployment gates remain required; never apply on BLOCK.

Before-deployment obligations require verified evidence before deployment. After-execution and after-teardown evidence
is not a pre-deployment prerequisite: collect actual execution/cleanup observations afterward, then obtain a new
human approval envelope with the corresponding verified evidence for `deployment-complete` or `teardown-complete`.
Never fabricate teardown success in advance. Event expiry prevents deployment; cleanup/completion actions need their
own still-valid authorization window beyond the event and do not silently extend deployment permission.

The deployment context also requires `tree: {path, sha256}` for the actual project IaC directory and `input_refs` for
actual runtime input files. The evaluator recomputes the tree hash with the same rule as the deploy handoff gate
(`validate-iac-handoff.mjs --tree-hash <dir>`), so tool output such as `tfplan`, `*.tfstate`, `.terraform/` and
compiled JSON beside a Bicep file does not invalidate an approval. It also recomputes `inputs_hash`: SHA-256 over
UTF-8 JSON of sorted
`[workspaceRelativePath, sha256]` pairs. Placeholders, a different tree, changed inputs or a changed context block.

Completion evidence for after-execution/after-teardown obligations must be a signed `risk-lifecycle-receipt-v1` from
an independently provisioned `lifecycle-verifier`, not the accepting owner. Bind the exact scope, context hash,
execution ID, phase, `started_at`, `finished_at`, `observed_at` and hashed real source observations. A teardown receipt
also binds `prior_execution` to the same execution event. The verifier must observe actual completion before signing,
and the separate human completion approval must be issued after those observations. Runtime completion also checks the
receipt follows the recorded deployment start. Receipt signatures attest evidence provenance, not cloud execution
by APEX; the externally accountable verifier owns truthful observation. No pre-existing general proof can substitute.

All lifecycle obligations must reference the same canonical execution receipt, including teardown's prior execution.
Different receipt bytes or execution IDs block regardless of verification-entry order.
Successful Step 6 completion persists the canonical execution path, hash and ID in its `risk-selection-v1` record.
Later completion replays and teardown checks must match that identity, even when a new action authorization is issued.
Checking teardown remains read-only; it cannot silently replace the completed run or reactivate an old authority grant.
A later completion authorization may acknowledge the already preserved execution receipt without requiring the prior
authorization to remain active. Only that prior authorization ID may be inactive: the receipt signer's
`lifecycle-verifier` grant must still exist, be current and not be revoked. This applies only to the exact saved
execution path, hash and ID; it never permits first-time completion under retroactive deployment authority or
substitution of another run.

A teardown receipt must finish by the authorization's `teardown_due_at`; a later finish blocks the teardown gate.

## Reporting, Failure And Migration

`show --json` returns `risk_authorizations`, `effective_reviews` and per-action `gate_readiness`. Review validity and
gate status are separate. Exception completion records `plan_status=EXCEPTION_AUTHORIZED`, never changes a review to
APPROVED, and leaves unresolved findings visible. Handoffs carry findings and action limits without granting permission.

Changed hashes, revoked/expired evidence, authority ambiguity, unavailable validation or wrong scope/action block before
state mutation, including replays of previously completed steps. Atomic revision checks cover review, authorization,
eligibility, approval, trust and evidence files; expiry and revisions are rechecked after staging/fsync immediately
before publication. Evidence must be published as immutable snapshots; arbitrary external editors are not locked,
so this is not a multi-file transaction or an instantaneous live revocation guarantee. Index failure after commit still
returns `committed_but_index_stale`; reindex rather than repeating the mutation.

Run `npm run validate:risk-authorizations -- example-lab` for CI checks; the existing challenger-presence hook also runs
the shared read-only runtime gate for the current phase/action. Superseded grants remain audit history; consumers
evaluate the requested action, never reuse a revoked grant or require an expired historical permission for a new action.
Unavailable authority validation blocks the runtime commands. In CI and the pre-commit hook, lab-exception problems
(including an unavailable `apex-recall` or trust pin) are reported as warnings and do not fail the build, because
those environments often lack the operator-pinned trust. `complete-step`, `transition`, `start-step` and `check-gate`
still block progression on the same evidence.
Historical review schema scans remain separate from present authorization evaluation.

Contracts use explicit `*-v1` versions. State adds optional `risk-selection-v1` records without changing legacy records;
the graph adds v2.5 exception readiness. Unknown versions fail closed. No existing project, prose decision or review is
automatically migrated. An owner must explicitly supply signed current evidence. Do not run exception-bearing projects
with pre-feature consumers: rollback disables progression until all consumers understand the contract, not permission
to delete authorization history. Existing `review-selection-v1` and missing-review protections remain intact.
Ordinary audited missing-review skips remain supported across completion, entry and resume. They do not waive
invalid present reviews and cannot combine with risk authorization. CI rejects missing authorization history when
an exception status or audit marker remains. Completion resolves only explicit permissions for its current action.

Release note: added explicit, externally authorized non-production-lab risk gates for Plan/CodeGen and separately
scoped deployments, with unchanged review evidence, independent eligibility and human approval, and atomic fail-closed
completion. This document is the maintainer/CLI contract; published product documentation belongs to apex-docs.

## Independent Code Review

The final independent read-only adversarial review returned `PASS` on October 10, 2026, after rejecting earlier drafts.
This is a code-review result, not an APPROVED project review, risk authorization or deployment approval.

The review drove fixes for staged-write expiry/input checks, unsupported transitions, preserved original review hashes,
post-execution receipt chronology, canonical run correlation within and across lifecycle actions, same-run renewal,
ordinary audited-skip compatibility, missing authorization history and action-specific resume/handoff/CI agreement.

The final reviewer executed the real-CLI renewal/substitution regression, risk-gate/reliability and transition suites,
Node evaluator/handoff suites and scoped schema assertions. The implementation validation also passed the complete
recall package suite and focused Node regressions, Ruff, ESLint, agent/vendor/model checks, workflow/Explorer checks,
Markdown and documentation freshness checks. Published documentation drafts passed content, build and local-link checks.

Live deployment, native Agent Host behavior, instantaneous revocation and full CI execution were not verified.
The accepted boundary remains operator-pinned offline trust, truthful independent attestations and immutable evidence
publication. No real project state, university pass9, review files or Azure resources were changed during implementation.

Working synthetic signed bundles are in
[the evaluator tests](../../tests/scripts/test_risk_authorization.mjs) and
[the real-CLI regression fixtures](../tests/test_risk_gate.py). Their generated keys are test-only and confer no authority.
