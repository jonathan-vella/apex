<!-- ref:sku-manifest-details-v1 -->

# SKU Manifest — Tooling Details

Validator, renderer and projection mechanics for
[`sku-manifest.instructions.md`](../../../instructions/sku-manifest.instructions.md), which owns
the authoring rules. Agents write `sku-manifest.json`; these tools derive, render and check it.

## Coverage Rules

`validate:sku-iac-coverage` checks both directions:

- **Manifest → IaC**: every `services[].iac_logical_names.{bicep|terraform}`
  must appear in `infra/{bicep|terraform}/{project}/` source.
- **IaC → manifest**: every effective SKU (explicit literals **plus**
  AVM module defaults when the consumer doesn't pass a SKU param) must
  trace back to a manifest entry — unless the surrounding resource
  matches the instruction's exclude list.

AVM-default resolution is wired through
[`tools/scripts/_lib/avm-default-skus.mjs`](../../../../tools/scripts/_lib/avm-default-skus.mjs).
Add a row to that table when a new AVM module ships with a default SKU.

## Rollout

Both validators are **hard-fail**; there is no warn-only window.
Legacy projects that predate the manifest may opt out by placing a
`.sku-manifest.skip` sentinel file in `agent-output/{project}/`; the coverage validator
then skips with info instead of erroring. Remove the sentinel once the project has a real manifest.

## Governance Allowlist Projection

`04g-Governance` derives a normalized SKU allowlist projection from
`04-governance-constraints.json` after Phase 2 by invoking
`node tools/scripts/derive-sku-allowlist.mjs <project>`. The script
walks `findings[]` for `effect: "deny"` entries whose
`azurePropertyPath` ends in `.sku.name` / `.skuName` / `.sku_name` /
`.vmSize`, maps `resource_types[]` to canonical service names, and
writes the projection into the manifest's `sku_allowlist_snapshot`
(allowed_skus + denied_skus, pattern-matched with `*`/`?` globs).

`validate:sku-manifest` cross-checks every `services[].size` against
the projection. The derive script is idempotent — re-running it on
unchanged input is a no-op.

## Pricing Freshness + Manifest Staleness

`validate:sku-manifest` emits WARN when:

- `services[].cost_estimated_at` is older than `APEX_SKU_PRICING_TTL_DAYS`
  (default 30 days). `cost-estimate-subagent` writes both
  `cost_estimate_monthly_usd` and `cost_estimated_at` atomically via
  manifest writeback, so this warning indicates pricing should be refreshed.
- The manifest's top-level `updated_at` is older than
  `APEX_SKU_MANIFEST_TTL_DAYS` (default 90 days).

These thresholds are env-tunable for projects with different cadence.

## Multi-Stamp Manifests

Optional `stamps[]` field at the manifest top level represents
independent deployments of the same workload (per-tenant, per-region
overlays). Each stamp has:

- `id` (unique within `stamps[]`)
- `regions[]` (may differ from `default_region`)
- optional `environments[]` (subset of top-level `environments[]`)
- optional `service_overrides` (map of `services[].id` → sparse
  `envOverride` shape, applied on top of base entry + env override)

The validator checks `id` uniqueness, environment subset, and that
`service_overrides` keys reference real `services[].id` entries. When
`stamps[]` is absent the manifest behaves as a single-stamp project.

## MD ↔ JSON Sync Enforcement

[`tools/scripts/render-sku-manifest-md.mjs`](../../../../tools/scripts/render-sku-manifest-md.mjs)
is idempotent: running it twice on the same JSON yields byte-equal output.
The lefthook pre-commit hook re-renders and auto-stages the MD.
`validate:sku-manifest` hard-fails when the MD is missing, its "Current revision" Overview
cell is absent, or that cell does not equal the JSON's `current_revision`.
CI (`.github/workflows/ci.yml`) runs the renderer and `git diff --exit-code` on
`**/sku-manifest.md`, so a PR fails if the MD drifted out of sync with the JSON.
