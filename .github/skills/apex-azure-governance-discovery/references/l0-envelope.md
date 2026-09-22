<!-- ref:l0-envelope-v1 -->

# L0 Discovery Envelope (Canonical)

Canonical specification of the `discovery_metadata` envelope emitted by
`discover.py` (live path) and `render_cached_governance.py` (cached
path). This is the L0 attestation layer in the four-layer governance
stack — every downstream consumer (Planner, CodeGen, Deploy) reads this
object FIRST and STOPS if any field is missing or stale.

> Ownership note: this spec lives inside `apex-azure-governance-discovery`
> because the skill owns the contract. `apex-azure-defaults` keeps only a
> one-line cross-reference to this file (Phase 7 of
> plan-optimiseGovernanceAgent — narrower ownership = simpler change
> control when the envelope evolves).

## Envelope shape

```jsonc
{
  "discovery_metadata": {
    "discovery_status": "COMPLETE", // COMPLETE | PARTIAL | FAILED
    "discovered_at": "2026-05-11T11:15:08Z",
    "scope": {
      "subscription_id": "00000000-0000-0000-0000-000000000000",
      "management_groups": ["mg-root", "mg-prod"],
    },
    "api_versions": {
      "policyAssignments": "2022-06-01",
      "policyDefinitions": "2021-06-01",
      "policyExemptions": "2022-07-01-preview",
    },
    "page_counts": {
      "policyAssignments": 3,
      "policyDefinitions": 12,
      "policyExemptions": 1,
    },
    "completeness_signature": "sha256:...", // see below
    "ttl_days": 7,
  },
  "policies": [
    /* ... */
  ],
  "findings": [
    /* ... */
  ],
}
```

## Field reference

| Field                     | Required | Notes                                                                                                    |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `discovery_status`        | yes      | `COMPLETE` allows downstream consumption; `PARTIAL`/`FAILED` blocks it.                                  |
| `discovered_at`           | yes      | ISO-8601 UTC timestamp at which the deterministic discovery completed.                                   |
| `scope.subscription_id`   | yes      | Target subscription ID. `"unknown"` when discovery ran offline against a fixture.                        |
| `scope.management_groups` | yes      | Ordered ancestry; empty array allowed only when the subscription has no MG ancestry.                     |
| `api_versions.*`          | yes      | API version actually used for each REST surface. Pin to the constants in `render_governance.py`.         |
| `page_counts.*`           | yes      | Collected item totals per REST surface, retained under the historical field name; not page totals.      |
| `completeness_signature`  | yes      | `sha256:<hex>` over canonically sorted policy tuples, including assignment/member identity when present. |
| `ttl_days`                | yes      | Staleness threshold. Default `7`. Downstream consumers compute `age_days = (now - discovered_at)/86400`. |

## Completeness signature

Algorithm (must be deterministic across runs — implemented once in
`render_governance._completeness_signature`, shared by both live and
cached paths per the F2 decision in plan-optimiseGovernanceAgent):

1. Build a list of tuples `(policy_id, effect, scope, params)` for every
  entry in `findings[]`. Include `assignment_id` and
  `policy_definition_reference_id` when those fields are present.
2. Serialise each tuple as a compact JSON object with sorted keys. Sort
  by `policy_id`, then by the entire serialised tuple to break ties.
3. Concatenate with `\n` separators.
4. `sha256` the result. Emit as `sha256:<hex>`.

This signature is the value 04g-Governance records via
`apex-recall decide --key discovery_signature` after every successful
envelope write (live or cached). 05-IaC Planner reads it on entry and
re-asserts the same value idempotently. CodeGen and Deploy agents
cross-check this signature against the envelope on disk and STOP on
mismatch.

## End-of-discovery self-check

Before writing the envelope, `discover.py` MUST:

1. Re-fetch all pages of `policyAssignments` using the original scope/filter.
2. Compare the complete count and canonical assignment records with the
  original collection. Reordering alone is not drift; changed identities
  or parameters are drift even when counts match.
3. On mismatch or an invalid, failed, or cyclic pagination response, set
  `discovery_status: "PARTIAL"` and append a
   stderr warning naming the drifted REST surface.

Initial malformed list responses fail discovery instead of becoming empty
successful inventories. Missing referenced definitions or unresolved effects
also produce `PARTIAL`; resolved findings and assignment inventory are retained.

## Refresh handoff is non-skippable

When invoked via `▶ Refresh Governance` from any downstream consumer,
04g-Governance MUST run a full re-discovery (`--refresh`), not a cache
hit. Stale-cache returns are the failure mode this rule prevents.

## Consumer protocol (Planner / CodeGen / Deploy)

1. Read `discovery_metadata` from disk.
2. STOP and traverse `▶ Refresh Governance` if any of:
   - File missing or `discovery_metadata` absent.
   - `discovery_status != "COMPLETE"`.
   - `age_days > ttl_days`.
   - `completeness_signature` differs from the cached
     `discovery_signature` decision.
   - `policies[]` is empty AND any `page_counts.*` > 0.
3. Otherwise proceed.

## Backward compatibility

Existing `04-governance-constraints.json` files without
`discovery_metadata` are accepted as `discovery_status: "PARTIAL"` by
consumer agents (warning only) for 30 days after rollout. After 30 days,
absence is a hard stop. Migration is non-destructive: re-run
04g-Governance with `--refresh`.

The cached renderer (`render_cached_governance.py`) can synthesise metadata
for historical baselines only when an original, timezone-aware discovery
timestamp is present. It preserves that timestamp, including its original
age. File mtime and render time are never discovery evidence. Missing,
malformed, timezone-less, or future timestamps return `FAILED` with
`error: discovery-provenance` without overwriting existing output.

Assignment-aware signature ordering can change a digest from older collectors.
An existing non-empty baseline signature is preserved, not silently rewritten
as a new attestation. A live refresh computes the current canonical signature.
