<!-- ref:avm-module-index-v1 -->

# AVM Module Index (`.github/data/avm-module-index.json`)

This reference is loaded on demand by `05-iac-planner.agent.md` during
Phase 2 (resource inventory + AVM selection) and by Bicep/Terraform
CodeGen agents (06b/06t) when they need to confirm a module exists
before pinning it.

It documents the **canonical, repo-local mirror of the AVM module
indexes** maintained by the Azure Verified Modules team.

## Files

| Path                                       | Format    | Source of truth                                                                                    |
| ------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------- |
| `.github/data/avm-bicep-modules.csv`       | Upstream CSV (verbatim) | https://azure.github.io/Azure-Verified-Modules/module-indexes/BicepResourceModules.csv     |
| `.github/data/avm-terraform-modules.csv`   | Upstream CSV (verbatim) | https://azure.github.io/Azure-Verified-Modules/module-indexes/TerraformResourceModules.csv |
| `.github/data/avm-module-index.json`       | Derived, agent-friendly | Generated from the two CSVs above by `tools/scripts/refresh-avm-module-index.mjs` |
| `tools/scripts/_data/avm-module-cache.json` | Per-module version cache | MCR + `registry.terraform.io`, pre-warmed by the same refresh script               |

The refresh script + the **Weekly Maintenance** workflow
(`refresh-avm-module-index` job) keep all four files current via
auto-merge PRs. There is no need to hand-edit them.

## What's in `avm-module-index.json`

```jsonc
{
  "schema_version": "avm-module-index-v1",
  "generated_at": "<ISO-8601>",
  "sources": { "bicep": "<url>", "terraform": "<url>" },
  "module_counts": { "bicep": 200, "terraform": 200 },
  "modules": [
    {
      "tool": "bicep",                                // "bicep" | "terraform"
      "module_name": "avm/res/key-vault/vault",       // canonical AVM path
      "source": "br/public:avm/res/key-vault/vault",  // ready-to-paste registry reference
      "provider_namespace": "Microsoft.KeyVault",     // CAF/ARM provider
      "resource_type": "vaults",                      // child resource type
      "module_status": "Available",                   // see lifecycle table below
      "display_name": "Key Vault",
      "repo_url": "https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/key-vault/vault",
      "alternative_names": "Keyvault"
    }
    // … one entry per AVM module, both tools.
  ]
}
```

For Terraform entries the `source` field uses the AVM TF convention
(`Azure/{module_name}/azurerm`), matching what `terraform-patterns`
codegen emits.

## When agents must consult the index

| Situation                                                              | Required action                                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Picking an AVM module for a given `Microsoft.X/Y` resource type        | Look up the row matching `provider_namespace` + `resource_type`; reuse its `source`.                            |
| Module is referenced but `module_status` ≠ `Available`                 | **Refuse** the pin. `Proposed` modules are not yet published; `Orphaned` modules lack an owner. Escalate to user. |
| User invents a module path that does not appear in the index           | **Refuse** the pin. Either the path is wrong or the module does not exist.                                      |
| About to record `plan_status=APPROVED`                                 | Hand off to [`avm-version-freeze-gate.md`](avm-version-freeze-gate.md) — the freeze gate consumes the version cache. |

## Module lifecycle (`module_status`)

| Status       | Meaning (from the AVM team)                                              | Agent treatment                                          |
| ------------ | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `Available`  | Published to MCR / Terraform Registry, owners assigned.                  | OK to pin.                                               |
| `Proposed`   | Reserved name, not yet implemented.                                      | Refuse — there is nothing to pin.                        |
| `Orphaned`   | Previously available, ownership lost; future-versioning at risk.         | Refuse — escalate to user; prefer a sibling module.      |
| (other)      | Anything not in the three above (e.g. `Deprecated`).                     | Treat as "not Available"; escalate to user.              |

## Refresh contract

```bash
# Index + version cache (full refresh, weekly cron):
npm run refresh:avm-module-index

# CSV + JSON index only — skip MCR/registry calls (fast local sanity check):
npm run refresh:avm-module-index:dry
```

The refresh script (`tools/scripts/refresh-avm-module-index.mjs`):

1. Downloads both upstream CSVs and writes them verbatim under `.github/data/`.
2. Parses them, emits the agent-friendly `avm-module-index.json` (modules
   sorted by `tool` then `module_name`, stable on every run).
3. For each `Available` module, calls
   [`resolveLatest()`](../../../../tools/scripts/_lib/avm-module-resolver.mjs)
   to populate `tools/scripts/_data/avm-module-cache.json`. That cache is
   what `validate:avm-versions:freeze` reads in fail-closed mode.

The cache JSON deliberately lives outside `.github/data/` because it is
a validator-internal artifact (different schema, frequently rewritten);
agents should never read it directly. Read `avm-module-index.json`
instead.

## Why this exists (rationale)

Before this index, agents either guessed module paths or made one-off
MCR calls during Phase 2 — both produced drift (kebab-case mismatches,
typos, references to `Proposed` modules). The CSV is the AVM team's
single source of truth for "what modules exist"; mirroring it locally:

- Removes a network call from the agent's hot path.
- Lets the freeze gate be deterministic (`freeze` mode requires the
  per-module cache to be ≤ 14 days old, which the weekly refresh
  guarantees).
- Gives reviewers a stable artifact to diff in PRs (the index JSON is
  sorted, the cache JSON has a `_meta` block).

## See also

- [`avm-version-freeze-gate.md`](avm-version-freeze-gate.md) — Phase 4.4 freeze gate that consumes the version cache populated by this refresh.
- [`.github/workflows/README.md`](../../../workflows/README.md#weekly-maintenance) — workflow that schedules the refresh.
- `tools/scripts/refresh-avm-module-index.mjs` — implementation.
