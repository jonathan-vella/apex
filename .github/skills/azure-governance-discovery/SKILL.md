---
name: azure-governance-discovery
description: "**ANALYSIS SKILL** — Azure Policy discovery: effective assignments (incl. MG-inherited), definitions/exemptions, effect classification, emits governance-constraints JSON. WHEN: 'Azure policy discovery', 'effective policy assignments', 'governance constraints', '04g-Governance Phase 1', 'refresh governance JSON'. DO NOT USE FOR: artifact writing, architecture mapping."
compatibility: Requires Python 3.14, Azure CLI on PATH, read access to the target subscription.
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

## Rules

- **Stay deterministic** — the discovery script is a single batched REST traversal; no LLM calls, no retries that hide errors, no inferred policy effects
- **Never pull raw Azure REST responses into LLM context** — stdout is exactly one machine-readable JSON status line; the parent agent reads only this line
- **Schema compliance is mandatory** — envelope MUST conform to `tools/schemas/governance-constraints.schema.json` (`schema_version: governance-constraints-v1`)
- **Property paths are always strings** — use `""` for unresolvable paths, never `null`
- **Filter Defender auto-assignments by default** — they create policy noise that masks real governance constraints; opt-in via `--include-defender-auto`
- **Exit codes are contract** — `0` = COMPLETE, `1` = PARTIAL, `2` = FAILED, `3` = invalid args; the parent agent routes solely on these codes
- **No artifact writing** — the script emits JSON + a `.preview.md`; the agent owns the final `04-governance-constraints.md` content and traffic-light rendering
- **Re-run with `--refresh`** when policy state has changed; otherwise honor the existing JSON

## Steps

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
[`tools/schemas/governance-constraints.schema.json`](../../../tools/schemas/governance-constraints.schema.json)
(`schema_version: governance-constraints-v1`). Each finding carries both
`bicepPropertyPath` and `azurePropertyPath` (always strings — empty `""` when
unresolvable, never `null`), plus `category`, `exemption`, and `classification`
(`"blocker"` | `"auto-remediate"` | `"informational"`; exempted Deny/Modify
blockers downgrade to `"informational"`). Top-level envelope also includes
`policies` (alias of `findings`), `tags_required`, `allowed_locations`, and
`discovery_metadata` (**L0 attestation envelope — MANDATORY**).

For the full per-finding schema and additive fields, read
[`references/schema.md`](references/schema.md).

For the L0 envelope spec (shape, completeness-signature algorithm,
end-of-discovery self-check, refresh handoff, consumer protocol,
backward-compatibility rules), read
[`references/l0-envelope.md`](references/l0-envelope.md).

For the effect classification table and Defender-filter rationale, read
[`references/effect-classification.md`](references/effect-classification.md).

### Preview Markdown

The script also writes a sibling `.preview.md` file (e.g.,
`04-governance-constraints.preview.md`) with the H2 structure matching the
azure-artifacts template. The agent copies this to
`04-governance-constraints.md` and annotates placeholder sections only.

## Reference Index

References are split into two tiers so the agent loads only what it
needs:

**Load-always** (the minimum to drive the core workflow):

- `references/terminal-commands.md` — pre-built batched commands
  (Cmd 1–8) for the entire phase.

**Load-on-demand** (read only when the relevant decision point is
reached):

- `references/effect-classification.md` — effect-to-classification mapping, exemption downgrade, Defender filter rationale
- `references/schema.md` — output JSON envelope, `findings[]` structure, additive fields
- `references/l0-envelope.md` — canonical L0 envelope spec (shape,
  signature algorithm, self-check, refresh handoff, consumer protocol)
- `references/inline-resolution-gate.md` — Phase 2.7 protocol +
  signature/TTL short-circuit
- `references/baseline-check.md` — Phase 0.45 cached-baseline procedure
- `references/policy-override-pattern.md` — structured `override` object shape
- `references/reconciliation-disposition.md` — Phase 2.5 disposition rules
- `references/resume-checks.md` — Phase 0.4 short-circuit conditions (signature, TTL, confirmations)
- `references/discover-output.md` — `discover.py` stdout shape, exit codes, anti-patterns, discovery-signature persistence

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
