---
applyTo: "**/sku-manifest.{md,json}"
description: "Authoring rules for the SKU Manifest artifact (sku-manifest-v1)"
---

# SKU Manifest Authoring Rules

`agent-output/{project}/sku-manifest.{json,md}` is the single source of
truth for creative SKU decisions across environments and regions. The
JSON is canonical; the markdown is a rendering for human review.

Schema: `tools/schemas/sku-manifest.schema.json`
Validators: `npm run validate:sku-manifest` + `npm run validate:sku-iac-coverage`
Templates: `.github/skills/azure-artifacts/templates/sku-manifest.template.{md,json}`

## Scope — what belongs in `services[]`

**In scope** (creative SKU decisions only):

- App Service Plans / Web Apps / Function Apps
- Virtual Machines / VM Scale Sets (VMSS)
- SQL Database / Managed Instance
- Cosmos DB accounts and containers (where throughput is a SKU)
- AKS node pools (per-pool VM SKU)
- Redis Cache
- API Management
- Application Gateway
- Storage Account replication tier (LRS/ZRS/GRS/RA-GRS)

**Out of scope — never add to `services[]`** (the explicit exclude list):

- Bandwidth / egress
- Log Analytics workspaces
- Virtual networks, subnets, NSGs, route tables
- Public IP addresses
- Diagnostic settings
- Resource groups, management groups, subscriptions
- Action Groups, Budgets, Policy assignments

These remain documented in `02-architecture-assessment.md` prose or in
the implementation plan narrative. The coverage validator
(`validate:sku-iac-coverage`) treats SKU literals in these resource
categories as legitimate non-manifest entries.

## Revision Rules

`revisions[]` is append-only metadata about git commits / apex-recall
checkpoints — **not** a free-form changelog.

- `rev` starts at 1 and increases monotonically.
- `current_revision` always equals the max `revisions[].rev`.
- Each service's `last_modified_rev` must reference an existing
  revision.
- `commit_sha` is stamped post-commit by
  `tools/scripts/stamp-sku-manifest-commit.mjs` (wired via
  `lefthook.yml post-commit`).
- `apex_recall_checkpoint` is set by the writer before commit. Pattern:
  `{project}:{step}:{sub_step}`.

## Source Provenance

`services[].source` is one of:

- `user-pin` — Step 1 (Requirements). User volunteered a hard constraint.
  Never auto-changed by downstream agents. If a planner/deploy step
  needs to alter a user-pin SKU, escalate to Architect via the
  `step-N → step-2` return edge.
- `architect-derived` — Step 2 (Architecture). Chosen by `03-Architect`
  from priced `candidate_sets[]`. May be revised at Step 4 (Planner)
  for governance reconciliation; revision keeps `source: architect-derived`.
- `deploy-substitute` — Step 6 (Deploy). Substituted by `07b`/`07t`
  during the block-with-escalation pre-flight when quota/region capacity
  forces a change. Always paired with an entry in
  `decisions.sku_overrides[]`.

`source_step` records when the entry was first created.

## Lifecycle (per `00-session-state.json` `decisions.sku_manifest_status`)

| Status      | Set by            | Meaning                                      |
| ----------- | ----------------- | -------------------------------------------- |
| (empty)     | —                 | Manifest not yet created                     |
| `draft`     | `02-Requirements` | Rev 1 written with user pins (or empty)      |
| `reviewed`  | `03-Architect`    | Rev 2 written with architect-derived entries |
| `locked`    | `05-IaC Planner`  | Rev 3 reconciled with governance findings    |
| `deploying` | `07b`/`07t`       | Pre-flight quota/region check started        |
| `deployed`  | `07b`/`07t`       | Deployment succeeded                         |
| `drift`     | `08-As-Built`     | `actual_sku` differs from planned `size`     |

## Block-with-Escalation Pattern (Step 6)

When a pre-flight quota or region SKU check fails:

1. Surface to human via the orchestrator. Include available substitutes
   from `azure-quotas` skill.
2. Human responds with one of four `sku_conflict_resolution` enum
   values:
   - `revert_to_plan` — restart deploy with original SKU after quota fix
   - `accept_substitute` — accept the substitute SKU
   - `change_region` — redeploy to a different region
   - `abort` — abandon the deployment
3. After **N=3** orchestrator round-trips with no acceptable substitute,
   surface `abort` as an explicit option to break deadlock.
4. On resolution, append one entry to `decisions.sku_overrides[]`
   (array — never dynamic keys) and write a new manifest revision with
   `source: "deploy-substitute"`.

## Feature Requirements (`requires[]`)

`services[].requires[]` lists feature dependencies the SKU must
support. Cross-checked at Step 4 by `05-IaC Planner`. Common entries:

- `vnet-integration` — App Service ≥ Standard (S1+); not on Basic.
- `private-endpoints` — Storage Account GPv2 (not v1); SQL DB ≥ Standard.
- `managed-identity` — supported by most modern Azure services; flag
  legacy SKUs that don't.
- `zone-redundant` — requires `zonal: true` and region with AZ support.
- `customer-managed-keys` — premium tiers only on most services.

Unmet `requires[]` → `must_fix` finding at Step 4 adversarial review.

## Per-Environment Overrides

`services[].environment_overrides.{env}` is a **sparse map**. Include
only fields that differ from the base entry. Common patterns:

- `dev`: smaller `size`, `capacity.mode: "fixed"`, `zonal: false`,
  `commitment: { type: "on-demand" }` (no reserved capacity).
- `test`: usually identical to dev or one tier up.
- `prod`: matches base entry (no override needed) OR upgrades
  `commitment` to a reserved instance.

The `environments[]` top-level set is the allowlist. Override keys
outside this set are a validator error.

## Coverage Rules

`validate:sku-iac-coverage` checks both directions:

- **Manifest → IaC**: every `services[].iac_logical_names.{bicep|terraform}`
  must appear in `infra/{bicep|terraform}/{project}/` source.
- **IaC → manifest**: every effective SKU (explicit literals **plus**
  AVM module defaults when the consumer doesn't pass a SKU param) must
  trace back to a manifest entry — unless the surrounding resource
  matches the exclude list above.

AVM-default resolution is wired through
[`tools/scripts/_lib/avm-default-skus.mjs`](../../tools/scripts/_lib/avm-default-skus.mjs).
Add a row to that table when a new AVM module ships with a default SKU.

## Rollout

Both validators are **hard-fail**. There is no warn-only window.

Legacy projects that predate the manifest may opt out by placing a
`.sku-manifest.skip` sentinel file in their `agent-output/{project}/`
directory; the coverage validator will then skip-with-info instead of
erroring. Remove the sentinel once the project has a real manifest.

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
  Mode B writeback, so this warning indicates pricing should be
  refreshed.
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

## MD ↔ JSON Sync

The companion `sku-manifest.md` is a **deterministic rendering** of
`sku-manifest.json`, produced by
[`tools/scripts/render-sku-manifest-md.mjs`](../../tools/scripts/render-sku-manifest-md.mjs).

**Rules**:

- Agents write **JSON only**. The renderer is the only legitimate writer
  of `sku-manifest.md`. Hand-editing the MD is forbidden and will be
  overwritten on the next commit (lefthook pre-commit auto-stages the
  re-rendered MD).
- After any rev-N JSON mutation (Architect at Step 2, Planner at Step 4,
  Deploy at Step 6, As-Built at Step 7), the author MUST run
  `node tools/scripts/render-sku-manifest-md.mjs <project>` and stage
  the MD change in the same commit.
- The renderer is idempotent: running it twice on the same JSON yields
  byte-equal output.
- `validate:sku-manifest` hard-fails when MD is missing, its "Current
  revision" Overview cell is absent, or that cell does not equal the
  JSON's `current_revision`. Re-render to fix.

CI enforcement: a `.github/workflows/*` job runs the renderer and
`git diff --exit-code` on `**/sku-manifest.md` — the PR fails if MD
drifted out of sync with JSON.

## Anti-Patterns

| Don't                                                | Do                                                  |
| ---------------------------------------------------- | --------------------------------------------------- |
| Type SKU prices into `02-architecture-assessment.md` | Let `cost-estimate-subagent` writeback prices       |
| Add bandwidth / Log Analytics / NSG to `services[]`  | Document them in plan narrative                     |
| Mutate `source: "user-pin"` entries downstream       | Escalate to Architect via the step-2 return edge    |
| Use dynamic keys like `sku_overrides.app_plan_web`   | Use the array form `sku_overrides[]`                |
| Re-derive SKUs from plan prose in CodeGen agents     | Read `sku-manifest.json` programmatically           |
| Edit `revisions[]` to "fix" history                  | Append a new revision documenting the correction    |
| Skip the coverage validator on a legacy project      | Drop a `.sku-manifest.skip` sentinel until migrated |
| Hand-edit `sku_allowlist_snapshot`                   | Re-run `derive-sku-allowlist.mjs`                   |
