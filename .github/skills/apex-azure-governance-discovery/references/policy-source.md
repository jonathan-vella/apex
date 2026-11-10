<!-- ref:policy-source-v1 -->

# Policy source before Architecture

New delivery projects record `decisions.policy_evidence_contract=corp-policy-v1`.
Existing projects adopt this contract only by an explicit `policy-source` choice; source maintenance
does not rewrite their approvals, completed steps, review histories or allowances.
Standalone assessments keep their own intake and terminal acceptance contract.

## Select evidence, not an administrative file format

After Requirements approval, reuse any captured current policy source. Otherwise the interactive owner
asks one material choice: use target-verified policy evidence, or explicitly accept the standard
Azure Landing Zones Corp policy assumptions for Architecture.
Recommend the shared assumptions when no target is ready; never select them automatically.
Explain that corporate custom assignments, parameters, exclusions and exemptions remain unverified.
Do not require a tenant/subscription or a manually prepared JSON file for assumed Architecture.

The shared source is `.github/data/alz-corp-policy-baseline.json.gz`, pinned to the public ALZ library.
The separate `.github/data/governance-policy-baseline.json.gz` is reserved for adopter-owned tenant evidence;
it must never synchronize upstream. A fixture is test data, not a workflow policy source.
Read the accepted shared source directly through `governance_baseline.py --alz-default`.
Do not render its synthetic subscription as a real target or create a tenant-verified feasibility envelope.

Record the actual source answer and its existing request provenance:

```bash
apex-recall policy-source <project> --assumed-corp \
  --owner "<actual-owner-role>" --request-id "<actual-request-id>" --environment dev --json
```

This binds the exact shared file hash. Changed or missing data requires a new owner source decision;
an old generation timestamp is library provenance, not a tenant discovery freshness claim.
Retain an **Assumed Corp policies — not tenant-verified** label in Architecture, pricing qualifications,
the independent review inputs and Gate 2. Both independent reviews and human approval still apply.

## Capture an actual target through native inputs

Only when the tenant-evidence route is selected, ask missing non-secret tenant/subscription identifiers,
environments and explicit subscription-plus-inherited-policy read authorization through native `ask_user`.
Reuse captured answers; do not ask for a custom scope-file path, credentials or a redundant second authorization.
Decline/cancel and missing owner authority never authorize reads. A CLI flag records an actual response;
it cannot manufacture human authorization or change the caller's role/tool permissions.

For private/anonymized projects, do not persist identifying native answers in project-local receipts.
Use the managed capture command with the actual response instead:

```bash
apex-recall policy-source <project> --tenant "<confirmed-tenant-guid>" \
  --subscription "<confirmed-subscription-guid>" --authorize-policy-read \
  --owner "<actual-owner-role>" --request-id "<actual-request-id>" --environment dev --json
```

Repeat `--subscription` and `--environment` only for actually authorized additional targets.
The command creates owner-only scope storage outside the repository under the local state directory.
Repository state, history, receipts and projections contain an opaque reference and digest, not Azure identifiers.
The command also prepares the private subscription/path index and returns its `evidence_path`.
It performs no Azure reads and outputs only opaque paths/references. No user-authored JSON is needed.
Changing scope supersedes the captured input and invalidates earlier evidence; it does not widen permission.
`XDG_STATE_HOME`, when used, must be absolute and outside the repository.

## Governance-owned collection and private evidence

Resolve existing paths and verify the current tenant without displaying identifying values:

```bash
apex-recall policy-source <project> --show-private-scope --json
apex-recall policy-source <project> --verify-tenant --json
```

A tenant mismatch blocks; do not log in, change credentials or choose the active subscription.
Within actual authorized read scope, Governance consumes the generated private scope file and invokes
the existing deterministic `discover.py` for each subscription. Keep `umask 077`; pass confirmed subscription IDs
explicitly and write snapshots, previews and diagnostics inside that private directory.
Use `discover.py --retain-rule-evidence` for these private snapshots and formal Governance.
This keeps full raw policy objects and effective assignment/member/parameter lineage inside each snapshot,
including Audit and Disabled rules; its existing opaque file hash binds the entire archive.
Before semantic reconciliation, run the same command with `--validate-only --retain-rule-evidence`.
Missing bodies or digest/coverage drift block reuse. A summary-only cache needs an explicitly bounded refresh
within actual authorization, not a repeated discovery command or an inferred new allowance.
When a bound `subscription-N.json` already has verified full-rule evidence, use
`render_cached_governance.py --retain-rule-evidence` with that actual private input and the canonical private
Governance output. Resolve the snapshot through the managed index; the index itself is not a rule envelope.
This offline path preserves the collection timestamp and performs no additional Azure reads.
Use non-identifying names: `subscription-1.json`, `subscription-2.json`, and
`04-policy-feasibility.json` for the index. The index retains the existing subscription/path shape privately.
Managed capture prepares the index even for a single subscription; fill its generated snapshot paths,
then bind that index. The legacy non-private single-subscription path still accepts a direct snapshot.
Keep original signatures, timestamps, policy parameters, inheritance and full Defender coverage.
Never sanitize raw evidence in place, hand-merge envelopes or publish raw private previews.

Bind the generated snapshot/index with the existing `checkpoint --policy-feasibility` option.
Recall accepts external evidence only inside this exact authorized, owner-only private scope and stores
relative non-identifying references/hashes. Missing private files, drift, TTL expiry, partial coverage,
scope changes or assumed envelopes block verified readiness. The complete raw evidence remains available
locally; it is not replaced by a success-shaped sanitized summary.

Formal Governance keeps its separate reconciliation, review and approval. For a single target, generate
the canonical `04-governance-constraints.json` in the same private directory. The shared Python and Node
contract resolvers select that private contract instead of falling back to public or stale evidence.
Public Markdown is an anonymized owner-authored summary; do not copy the identifying private preview.
Reviewers must have actual approved access to required private evidence or return a capability/scope blocker.
Multi-subscription formal Governance retains separate snapshots and its existing full-coverage contract;
never substitute one subscription's canonical file for the others.

## Freeze private evidence for independent review

Keep the review primary as the public anonymized summary. For tenant-backed Architecture, cost, Governance,
planning or code reviews, the exact bound private index and every subscription snapshot are mandatory
`supporting_inputs`. Governance also freezes its canonical private JSON.
Use opaque paths such as `apex-private-policy://<project>/<scope_ref>/subscription-1.json` with exact file hashes.
`requiredPrivateReviewInputs` derives this set from the current authorized scope and evidence binding.
Do not supply absolute private paths as persisted input identities or copy raw evidence into the repository.

Native request preflight returns a transient `private_inputs` reference/read-path mapping for the interactive owner.
Pass only these actual authorized locations to the read-only worker along with their opaque identities and hashes.
Keep the mapping, native identifying diagnostics and raw event logs in approved private storage, not public receipts.
Require the worker's public findings to use opaque policy references without identifying values; preserve its actual
judgment. A privacy or read-capability failure blocks publication rather than authorizing copied or rewritten evidence.
The recorder validates the complete supporting set against current scope, and recall digests/watches the same files.
Omitted evidence, altered scope, private-byte drift or a changed project blocks reuse; editorial mappings cannot waive it.
Existing reviewer attribution, freshness, closure budgets and human approval requirements remain unchanged.

## Gate meaning

- `assumed_corp_not_tenant_verified`: explicit assumptions may support Architecture approval only.
- `current`: exact target-bound, complete, fresh evidence; still not resource-write or deployment permission.
- `provisional_no_authorized_target`: no source acceptance/target; new-contract implementation Architecture blocks.
- Actual validation errors remain blockers, not automatic fallback to shared assumptions.

New-contract IaC planning completion, CodeGen entry/completion and deployment entry/completion require `current`.
Source acceptance is never a policy exemption, security waiver, reviewer approval or Azure write authorization.
All existing human gates and unresolved findings remain in force.
Each consuming phase scope must include its current policy-source/read inputs and their authorized environments,
so changing the source invalidates the assessment/review projection rather than bypassing it.
Before CodeGen or deployment entry, record that target phase's scope from actual granted stage/start authorization,
including `policy_source` and `azure_read_scope` inputs. Every target environment must be authorized by those records.
Do this before `start-step` or an atomic transition into the phase. Reuse actual captured approval, not a copied
earlier-step scope; ask only when the next operation was not authorized. Missing scope blocks entry, not just completion.
