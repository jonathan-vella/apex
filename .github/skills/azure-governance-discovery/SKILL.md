---
name: azure-governance-discovery
description: "Deterministic Azure Policy discovery: lists effective policy assignments at subscription scope (including MG-inherited), pulls definitions and exemptions, classifies effects, filters Defender auto-assignments, and emits the governance-constraints JSON envelope via a Python script. USE FOR: 04g-Governance Phase 1 discovery, refreshing `04-governance-constraints.json`. DO NOT USE FOR: artifact writing, architecture mapping, traffic-light rendering, challenger orchestration — those stay in the parent agent."
compatibility: Requires Python 3.10+, Azure CLI on PATH, read access to the target subscription.
---

# Azure Governance Discovery Skill

Replaces the legacy `governance-discovery-subagent` with a deterministic script.
The skill exposes `scripts/discover.py` — a single batched REST traversal that
emits the schema-compliant `04-governance-constraints.json` envelope. The parent
agent (`04g-Governance`) invokes it via `run_in_terminal`, reads a compact
one-line JSON status from stdout, and proceeds to artifact writing without ever
pulling raw Azure REST responses into LLM context.

## When to Use

- Step 3.5 governance discovery for a project
- Refreshing the governance snapshot after policy changes
- Regenerating inputs for Step 4 (IaC Plan) and Step 5 (IaC Code)

## When NOT to Use

- Writing `04-governance-constraints.md` — that stays in the parent agent
- Cross-referencing architecture resources — parent-side LLM work
- Challenger review orchestration — parent-side LLM work
- Any workflow that is not 04g-Governance

## Usage

```bash
python .github/skills/azure-governance-discovery/scripts/discover.py \
    --project my-project \
    --out agent-output/my-project/04-governance-constraints.json
```

Flags:

| Flag                           | Meaning                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `--project <name>`             | Required. Used only for cache key and provenance.                  |
| `--out <path>`                 | Required. Full envelope written here (overwrites).                 |
| `--subscription <id\|default>` | Optional. `default` uses `az account show`.                        |
| `--refresh`                    | Force re-discovery even if `<out>` already exists.                 |
| `--include-defender-auto`      | Include Defender-for-Cloud auto-assignments (excluded by default). |

Exit codes:

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | `COMPLETE` — discovery succeeded                                |
| `1`  | `PARTIAL` — partial data written; parent should surface to user |
| `2`  | `FAILED` — auth/network/permission error                        |
| `3`  | Invalid arguments                                               |

Stdout — always exactly one machine-readable JSON line first, optional
human-readable preview after:

```json
{
  "status": "COMPLETE",
  "cache_hit": false,
  "assignment_total": 247,
  "blockers": 18,
  "auto_remediate": 12,
  "exempted": 3,
  "out_path": "agent-output/my-project/04-governance-constraints.json"
}
```

## Output Contract

The script writes a JSON envelope conforming to
[`schemas/governance-constraints.schema.json`](../../../schemas/governance-constraints.schema.json)
(`schema_version: governance-constraints-v1`). Findings include both
`bicepPropertyPath` and `azurePropertyPath`, plus three additive fields:

- `category` — `properties.metadata.category` from the definition; `"Uncategorized"` if absent.
- `exemption` — nullable object with `exemptionCategory` (`Waiver`|`Mitigated`),
  `expiresOn`, `description`, `policyDefinitionReferenceIds`, when a
  `Microsoft.Authorization/policyExemptions` record matches.
- `classification` — `"blocker"` | `"auto-remediate"` | `"informational"`.
  Exempted Deny/Modify blockers downgrade to `"informational"`.

Top-level envelope also includes:

- `policies` — alias (same reference) of `findings`; provided for downstream consumers.
- `tags_required` — extracted tag-enforcement findings as `[{name, source_policy}]`.
- `allowed_locations` — extracted from location-constraint policies.

Property paths (`azurePropertyPath`, `bicepPropertyPath`) are always strings —
empty `""` when unresolvable, never `null`.

### Preview Markdown

When invoked via CLI, the script also writes a sibling `.preview.md` file
(e.g., `04-governance-constraints.preview.md`) with the H2 structure matching
the azure-artifacts template. The agent copies this to `04-governance-constraints.md`
and annotates placeholder sections only — avoiding slow mega-patch generation.

See `references/effect-classification.md` for the full classification table.
See `references/schema.md` for the output JSON envelope and per-finding fields.

## Reference Index

- `references/effect-classification.md` — effect-to-classification mapping, exemption downgrade, Defender filter rationale
- `references/schema.md` — output JSON envelope, `findings[]` structure, additive fields

## Design Notes

- Three batched REST list calls only: `policyAssignments?$filter=atScope()`,
  `policyDefinitions` (subscription + tenant built-ins), `policySetDefinitions`.
  One more list for `policyExemptions?$filter=atScope()`.
- In-process classification and property-path extraction; no per-assignment GETs.
- Caches on the presence of `<out>` unless `--refresh` passed.
- Defender auto-assignments (`properties.metadata.assignedBy == "Security Center"`)
  are filtered by default — matches EPAC's default and trims typical tenant row
  counts by 30-60%. Every filtered assignment is logged to stderr.

## Testing

```bash
pytest .github/skills/azure-governance-discovery/scripts/test_discover.py
# or
npm run test:governance-discovery
```

Fixtures live in `scripts/fixtures/` and simulate `az rest` responses via
`subprocess.check_output` monkeypatching — no Azure account required for tests.
