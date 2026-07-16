# 📦 SKU Manifest - vnext-qualification

![Artifact](https://img.shields.io/badge/Artifact-SKU%20Manifest-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Draft-orange?style=for-the-badge)
![Schema](https://img.shields.io/badge/Schema-sku--manifest--v1-purple?style=for-the-badge)

<details open>
<summary><strong>📑 Manifest Contents</strong></summary>

- [Overview](#overview)
- [Environments](#environments)
- [Services](#services)
- [Revision History](#revision-history)
- [Open Substitutions](#open-substitutions)

</details>

> Rendered from `sku-manifest.json` (rev 3) by `tools/scripts/render-sku-manifest-md.mjs`.
>
> **Do not hand-edit this file.** Mutate `sku-manifest.json` and re-run
> the renderer (wired into lefthook + CI). Authoring rules:
> [`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md).

## Overview

| Field            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Project          | `vnext-qualification`                                        |
| Default region   | `swedencentral` (per-service `regions[]` inherits this) |
| Schema version   | `sku-manifest-v1`                                          |
| Current revision | `3`                               |
| Last updated     | `2026-07-15T19:15:00Z`                                     |
| Environments     | `test` (comma-separated)                              |
| Service count    | `1`                                        |

**Scope**: creative SKU decisions only — App Service plans, VMs/VMSS, SQL,
Cosmos, AKS pools, Redis, APIM, App Gateway, Storage replication tiers.

**Out of scope** (do not add to `services[]`): bandwidth, Log Analytics,
vnet, subnet, NSG, route table, public IP, diagnostics. See
[`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md).

## Environments

| Environment | In scope | Notes |
| ----------- | -------- | ----- |
| `test` | ✅ | — |

## Services

> Rendered from `sku-manifest.json` `services[]`. Per-environment values
> reflect `environment_overrides` on top of the base entry.

| `id` | Service | Size (base) | Capacity | Zonal | Regions | SLA target / achieved | Commitment | Source | Rev |
| ---- | ------- | ----------- | -------- | ----- | ------- | --------------------- | ---------- | ------ | --- |
| `qualification-storage` | Storage Account | `Standard_LRS` | `fixed (default 1)` | ❌ | `swedencentral` | `Non-production qualification` / `—` | `on-demand` | `architect-derived` | `3` |

### Per-environment overrides

_No services declare environment overrides._

### Feature requirements

| `id` | `requires[]` | Verified at Step 4 |
| ---- | ------------ | ------------------ |
| `qualification-storage` | — | ✅ / ❌ |

### Cost estimate (USD/month)

> Populated by `cost-estimate-subagent` via `manifest_writeback[]` —
> Architect never types prices from parametric knowledge.

| `id` | `cost_estimate_monthly_usd` | Confidence |
| ---- | --------------------------- | ---------- |
| _none priced yet_ | — | — |

## Revision History

> Append-only. Each row is metadata about a git commit / apex-recall checkpoint.

| `rev` | Step | Agent | Created (UTC) | Summary | Changed `id`s | Commit | Checkpoint |
| ----- | ---- | ----- | ------------- | ------- | ------------- | ------ | ---------- |
| `1` | `1` | `02-Requirements` | `2026-07-15T12:00:00Z` | No user-pinned SKU; use a cost-optimized ephemeral qualification sandbox. | — | — | `vnext-qualification:1:sku-preferences` |
| `2` | `2` | `03-Architect` | `2026-07-15T12:30:00Z` | Selected Standard LRS for the backend and equivalent Bicep and Terraform storage markers. | `qualification-storage` | — | `vnext-qualification:2:storage-sku` |
| `3` | `4` | `05-IaC Planner` | `2026-07-15T19:15:00Z` | Reconciled the Standard LRS decision across the isolated Bicep and Terraform implementations. | `qualification-storage` | `908c536` | `vnext-qualification:4:dual-track-reconciliation` |

## Open Substitutions

> Captured at Step 6 (Deploy) when a planned SKU is unavailable due to
> quota / region capacity. Mirrors `decisions.sku_overrides[]` in
> `00-session-state.json`.

> **None open** — all SKUs deployed as planned.

---

## References

- Schema: [`tools/schemas/sku-manifest.schema.json`](../../tools/schemas/sku-manifest.schema.json)
- Authoring rules: [`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md)
- Renderer: `node tools/scripts/render-sku-manifest-md.mjs <project>`
- Validators: `npm run validate:sku-manifest` + `npm run validate:sku-iac-coverage`
