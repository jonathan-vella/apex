<!-- ref:avm-version-freeze-gate-v1 -->

# AVM Version Freeze Gate (Phase 4.4)

This reference is loaded on demand by `05-iac-planner.agent.md` during
Phase 4.4. It documents the AVM module version freeze gate that runs
before `apex-recall complete-step 4` and protects downstream CodeGen
(06b/06t) and Deploy (07b/07t) agents from pinning unpublished or stale
AVM module versions.

## When to run

Immediately before recording `plan_status=APPROVED` for the project and
running `apex-recall complete-step 4`.

> Module existence + lifecycle (`Available` vs `Proposed`/`Orphaned`) is
> resolved earlier, in Phase 2, against the local AVM module index. See
> [`avm-module-index.md`](avm-module-index.md) for the contract. This
> freeze gate trusts that every module being pinned has already been
> shown to exist; it only validates the **version**.

## Command

```bash
# Contract JSON validator (existing)
npm run validate:avm-versions:freeze -- agent-output/{project}/04-iac-contract.json

# Plan markdown validator (catches stale pins in Implementation Tasks YAML)
npm run validate:plan-avm-pins -- agent-output/{project}/04-implementation-plan.md
```

Both validators are mandatory before `apex-recall complete-step 4`.
The contract validator covers `modules.bicep[].version` and
`modules.terraform[].version`; the plan validator covers every
`avm: avm/res/...:X.Y.Z` line in the markdown (Resource Inventory table,
Module Structure table, and the per-task YAML blocks). Each one alone
is insufficient — the trace of a recent Step-4 run shows pass-1
challenger fixed the summary tables but missed the 17 task-YAML pins;
the dedicated plan validator catches that case in <1 s, with zero LLM
tokens.

The contract validator script is `tools/scripts/validate-avm-module-versions.mjs`;
the plan validator script is `tools/scripts/validate-plan-avm-pins.mjs`;
both share the resolver at `tools/scripts/_lib/avm-module-resolver.mjs`.
In `freeze` mode the validator fails closed when:

- Any `modules.bicep[].version` does not exist as a tag in MCR for its
  `source`
- Any `modules.terraform[].version` is not exact semver, or does not
  exist on `registry.terraform.io`
- Any pin is older than the latest stable AND lacks a valid
  `pin_policy.mode = "exception"` block (rationale, evidence,
  future `review_after`)
- The resolver cannot reach the registry AND the cache entry is older
  than 14 days (freeze mode requires fresh data)

## Resolving findings

For each failing module, pick exactly one option:

### Option 1 — Bump to latest (preferred)

Re-resolve the latest stable version and update both the implementation
plan and `04-iac-contract.json`:

- Bicep: `curl -sf https://mcr.microsoft.com/v2/bicep/avm/res/{path}/tags/list`
- Terraform: `curl -sf https://registry.terraform.io/v1/modules/Azure/avm-res-{path}/azurerm/versions`
- Or use the corresponding MCP helpers.

Re-run the validator until exit code 0.

### Option 2 — Pin exception

Required when the latest stable has a regression that blocks upgrade
(e.g. AVM 0.12.x emits a `networkRuleSet` for ACR Basic SKU defaults that
violates an inherited Azure Policy). Add this block to the affected
`modules.bicep[]` or `modules.terraform[]` entry in
`04-iac-contract.json`:

```jsonc
{
  "source": "br/public:avm/res/...",
  "version": "<older stable>",
  "pin_policy": {
    "mode": "exception",
    "latest_seen": "<latest stable from registry>",
    "lookup_source": "mcr",
    "lookup_timestamp": "<ISO-8601 now>",
    "rationale": "<one-sentence reason for not upgrading>",
    "evidence_url_or_file": "<GitHub issue URL or repo path>",
    "review_after": "<YYYY-MM-DD future date>",
    "approved_by_step": "4",
  },
}
```

Then persist the exception via apex-recall so audit + as-built can
trace it:

```bash
apex-recall decide <project> \
  --key avm_pin_exception \
  --value '{"module":"<source>","pinned":"<v>","latest":"<v>","review_after":"<date>"}' \
  --rationale "<regression summary>" \
  --step 4 --json
```

### Option 3 — Block

If neither bump nor exception is acceptable (for example, the older
version itself is also broken), halt Step 4 and escalate to the user.
Do not silently downgrade or proceed.

## Cache behaviour

- Network lookups populate `tools/scripts/_data/avm-module-cache.json`
- The cache file is checked into the repo as a fallback when registries
  are unreachable
- In `freeze` mode, cache entries older than 14 days are rejected
- In `local` mode (default for ad-hoc runs), stale cache emits a warning
  instead of failing

## Checkpoint + complete-step

```bash
apex-recall checkpoint <project> 4 phase_4_4_avm_freeze --json
apex-recall complete-step <project> 4 --json
```

`apex-recall complete-step 4` is forbidden before this gate returns
exit 0 (or until every blocking finding has been resolved via Option 1
or Option 2).
