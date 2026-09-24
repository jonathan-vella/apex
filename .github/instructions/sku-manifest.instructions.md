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
Templates: `.github/skills/apex-azure-artifacts/templates/sku-manifest.template.{md,json}`
Tooling details (coverage rules, legacy opt-out, governance allowlist projection, pricing TTLs,
multi-stamp manifests, MD/JSON sync enforcement):
[`sku-manifest-details.md`](../skills/apex-azure-artifacts/references/sku-manifest-details.md)

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

- `user-pin` — Step 1 (Requirements). Captured via the mandatory Phase 3j
  SKU/sizing preference elicitation (see
  [Mandatory Elicitation at Step 1](#mandatory-elicitation-at-step-1)).
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

| Status      | Set by            | Meaning                                                                                                |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| (empty)     | —                 | Manifest not yet created                                                                               |
| `draft`     | `02-Requirements` | Rev 1 written. Phase 3j SKU/sizing elicitation complete; `decisions.sku_preferences_captured = true`. |
| `reviewed`  | `03-Architect`    | Rev 2 written with architect-derived entries                                                           |
| `locked`    | `05-IaC Planner`  | Rev 3 reconciled with governance findings                                                              |
| `deploying` | `07b`/`07t`       | Pre-flight quota/region check started                                                                  |
| `deployed`  | `07b`/`07t`       | Deployment succeeded                                                                                   |
| `drift`     | `08-As-Built`     | `actual_sku` differs from planned `size`                                                               |

## Mandatory Elicitation at Step 1

`02-Requirements` MUST elicit SKU and sizing preferences from the user
for every project, regardless of complexity, workload pattern, or whether
the user has any pins. Explicit preferences or "no preference" supplied in the brief satisfy
their applicable classes; never reconfirm them or infer unanswered preferences.
Ask only for missing/conflicting classes via the Phase 3j batched `askQuestions` call defined in
[`service-class-menu.md` § 3j](../skills/apex-azure-defaults/references/service-class-menu.md#3j-sku-and-sizing-preferences-mandatory-for-every-project).

Outcomes:

- Any **Pinned SKU/size** or **Tier floor** answer is written to
  `services[]` with `source: "user-pin"`, `source_step: "1"`,
  `last_modified_rev: 1`. Tier floors land in `notes` plus a
  representative `size`.
- **No preference** answers do not create manifest entries; Architect
  fills them in at Step 2 with `source: "architect-derived"`.
- After Phase 3j completes (regardless of pin count), the writer records
  `decisions.sku_preferences_captured = true` via
  `apex-recall decide`. This flag distinguishes "user opted out of every
  pin" (valid) from "agent skipped the elicitation" (validator-blocked).

An empty `services[]` at rev 1 is valid **only** when
`decisions.sku_preferences_captured = true` is set. The validator may be
tightened to enforce this; until then, missing flags trigger a WARN.

## Block-with-Escalation Pattern (Step 6)

When a pre-flight quota or SKU availability check fails (`RESTRICTED`,
`NOT_OFFERED` or insufficient quota, per the
[SKU availability](../skills/apex-azure-quotas/references/sku-availability.md)
status contract):

1. Surface to human via the orchestrator. Include only substitutes that are
   `AVAILABLE` with sufficient quota, from the `apex-azure-quotas` skill.
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
outside this set are a validator error. Optional `stamps[]` (per-tenant or per-region
overlays) follow the multi-stamp rules in the tooling reference.

## Derived Fields and Coverage

- `sku_allowlist_snapshot` is written by `node tools/scripts/derive-sku-allowlist.mjs <project>`
  (run by `04g-Governance`); never hand-edit it. `services[].size` must satisfy it.
- Pricing fields (`cost_estimate_monthly_usd`, `cost_estimated_at`) are written by
  `cost-estimate-subagent`; stale pricing or manifests produce validator warnings.
- `validate:sku-iac-coverage` is hard-fail in both directions (manifest ↔ IaC, including
  AVM default SKUs); only the exclude list above is exempt.

## MD ↔ JSON Sync

Agents write **JSON only**; `sku-manifest.md` is a deterministic rendering by
`tools/scripts/render-sku-manifest-md.mjs` and hand edits are overwritten. After any rev-N
JSON mutation (Architect at Step 2, Planner at Step 4, Deploy at Step 6, As-Built at Step 7),
run `node tools/scripts/render-sku-manifest-md.mjs <project>` and stage the MD in the same
commit. Pre-commit, validator and CI sync checks are described in the tooling reference.

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
