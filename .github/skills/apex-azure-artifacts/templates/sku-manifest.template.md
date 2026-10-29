# 📦 SKU Manifest - {project-name}

![Artifact](https://img.shields.io/badge/Artifact-SKU%20Manifest-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Draft-orange?style=for-the-badge)
![Schema](https://img.shields.io/badge/Schema-sku--manifest--v1-purple?style=for-the-badge)

<details open>
<summary><strong>📑 Manifest Contents</strong></summary>

- [Overview](#overview)
- [Environments](#environments)
- [Subscriptions](#subscriptions)
- [Stamps](#stamps)
- [Services](#services)
- [Revision History](#revision-history)
- [Open Substitutions](#open-substitutions)

</details>

> Generated/updated by {agent} at Step {step} | {date}
>
> **Companion JSON**: [`sku-manifest.json`](sku-manifest.json) — the
> machine-readable source of truth. This markdown view is a rendering
> for human review; agents read the JSON programmatically.

## Overview

| Field            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Project          | `{project-name}`                                           |
| Default region   | `{default_region}` (per-service `regions[]` inherits this) |
| Schema version   | `sku-manifest-v1`                                          |
| Current revision | `{current_revision}`                                       |
| Last updated     | `{updated_at}`                                             |
| Environments     | `{environments[]}` (comma-separated)                       |
| Service count    | `{services.length}`                                        |

**Scope**: creative SKU decisions only — App Service plans, VMs/VMSS, SQL,
Cosmos, AKS pools, Redis, APIM, App Gateway, Storage replication tiers.

**Out of scope** (do not add to `services[]`): bandwidth, Log Analytics,
vnet, subnet, NSG, route table, public IP, diagnostics. See
[`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md).

## Environments

| Environment | In scope | Notes                    |
| ----------- | -------- | ------------------------ |
| dev         | ✅ / ❌  | {dev environment notes}  |
| test        | ✅ / ❌  | {test environment notes} |
| prod        | ✅ / ❌  | {prod environment notes} |

## Subscriptions

> Optional: omit this section and its TOC entry when `subscriptions[]` is empty or absent.
> Logical IDs are unique; optional Azure GUIDs are unique ignoring case.

| `id` | Display name | Azure subscription GUID | Role |
| ---- | ------------ | ----------------------- | ---- |
| `{subscription-logical-id}` | {display-name} | `{subscription_id}` | {role} |

## Stamps

> Optional: omit this section and its TOC entry when `stamps[]` is empty or absent.
> Each stamp deploys every service. Subscription inherits the service attribution when absent;
> simultaneous stamp/service declarations must agree.

| `id` | Label | Subscription | Environments | Regions | Service overrides | Notes |
| ---- | ----- | ------------ | ------------ | ------- | ----------------- | ----- |
| `{stamp-id}` | {label} | `{subscription-logical-id}` / Per service | `{environments[]}` | `{regions[]}` | {service-overrides} | {notes} |

## Services

> Rendered from `sku-manifest.json` `services[]`. Per-environment values
> reflect `environment_overrides` on top of the base entry.
> `Observed SKU` preserves intake evidence while `Size (base)` may become the
> Architect's recommendation. Omit the Observed SKU column when no service has
> `observed_sku`; omit Subscription when no service, stamp or inventory declares subscription context.
> An unspecified service subscription renders as "Per stamp / unspecified".

| `id` | Service | Size (base) | Observed SKU | Subscription | Capacity | Zonal | Regions | SLA target / achieved | Commitment | Source | Rev |
| ---- | ------- | ----------- | ------------ | ------------ | -------- | ----- | ------- | --------------------- | ---------- | ------ | --- |
| `{id}` | {service} | `{size}` | `{observed_sku}` / — | `{subscription-logical-id}` | `{mode}: {min}-{max} (default {default})` | ✅/❌ | `{primary}, {failover}` | `{sla_target}` / `{sla_achieved}` | `{type}` (`{term_years}yr`) | `user-pin` \| `observed-current` \| `architect-derived` \| `deploy-substitute` | `{last_modified_rev}` |

`observed-current` at rev 1 uses `source_step: "1"` and required `observed_sku`.
Architect may change `size` and `source` to `architect-derived`, retaining
`observed_sku` and the original creation step. Explicit `user-pin` choices remain locks.

### Per-environment overrides

Only services with non-empty `environment_overrides` appear below.

| `id`   | Env     | Size              | Capacity | Zonal | Regions | Commitment | Notes |
| ------ | ------- | ----------------- | -------- | ----- | ------- | ---------- | ----- |
| `{id}` | `{env}` | `{override.size}` | ...      | ...   | ...     | ...        | ...   |

### Feature requirements

| `id`   | `requires[]`                                                | Verified at Step 4 |
| ------ | ----------------------------------------------------------- | ------------------ |
| `{id}` | `vnet-integration`, `private-endpoints`, `managed-identity` | ✅ / ❌            |

### Cost estimate (USD/month)

> Populated by `cost-estimate-subagent` via `manifest_writeback[]` —
> Architect never types prices from parametric knowledge.

| `id`   | `cost_estimate_monthly_usd` | Confidence (from cost JSON) |
| ------ | --------------------------- | --------------------------- |
| `{id}` | `${cost}`                   | `{confidence}`              |

### As-built actual SKUs

> Populated by `08-As-Built` from deployed Azure state. Empty cells
> indicate drift or undeployed environments.

| `id`   | Env     | Region     | Planned `size` | `actual_sku`   | Drift               |
| ------ | ------- | ---------- | -------------- | -------------- | ------------------- |
| `{id}` | `{env}` | `{region}` | `{size}`       | `{actual_sku}` | ✅ match / ⚠️ drift |

## Revision History

> Append-only. Each row is metadata about a git commit / apex-recall
> checkpoint — not a free-form changelog.

| `rev` | Step | Agent             | Created (UTC) | Summary                                | Changed `id`s | Commit  | Checkpoint |
| ----- | ---- | ----------------- | ------------- | -------------------------------------- | ------------- | ------- | ---------- |
| `1`   | `1`  | `02-Requirements` | `{ts}`        | User pins / observed-current inventory (if any) | `{ids}` | `{sha}` | `{ckpt}` |
| `2`   | `2`  | `03-Architect`    | `{ts}`        | Full SKU authoring from candidate sets | `{ids}`       | `{sha}` | `{ckpt}`   |
| `3`   | `4`  | `05-IaC Planner`  | `{ts}`        | Reconciled with governance findings    | `{ids}`       | `{sha}` | `{ckpt}`   |

## Open Substitutions

> Captured at Step 6 (Deploy) when a planned SKU is unavailable due to
> quota / region capacity. Resolved via orchestrator escalation.
> Mirrors `decisions.sku_overrides[]` in `00-session-state.json`.

| `id`   | Env / Region             | Planned `size` | Substituted | Reason          | Resolution                                                            |
| ------ | ------------------------ | -------------- | ----------- | --------------- | --------------------------------------------------------------------- |
| `{id}` | `prod` / `swedencentral` | `{old}`        | `{new}`     | quota exhausted | `revert_to_plan` \| `accept_substitute` \| `change_region` \| `abort` |

> **None open** if all SKUs deployed as planned.

---

## References

- Schema: [`tools/schemas/sku-manifest.schema.json`](../../tools/schemas/sku-manifest.schema.json)
- Authoring rules: [`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md)
- Validators: `npm run validate:sku-manifest` + `npm run validate:sku-iac-coverage`
- Lifecycle: `01-Orchestrator` → Step 1 user pins / observed-current inventory → Step 2 Architect authoring →
  Step 3.5 governance findings → Step 4 reconciliation + `requires[]` check →
  Step 5 CodeGen reads JSON → Step 6 Deploy escalates on conflict →
  Step 7 As-Built drift detection.
