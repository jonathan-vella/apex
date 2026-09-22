---
name: apex-azure-governance-discovery
user-invocable: true
disable-model-invocation: false
argument-hint: "project, subscription scope and discovery or refresh"
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
- **Use compact status for routing**, then targeted envelope reads for decisions; recover all required evidence and diagnostics
- **Schema compliance is mandatory** — envelope MUST conform to `tools/schemas/governance-constraints.schema.json` (`schema_version: governance-constraints-v1`)
- **Property paths are always strings** — use `""` for unresolvable paths, never `null`
- **Defender filtering is narrow** — the collector retains enforcement-bearing assignments; `--include-defender-auto` retains all
- **Exit codes are contract** — `0` = COMPLETE, `1` = PARTIAL, `2` = FAILED; argparse errors also return nonzero. COMPLETE is collection status, not planning approval
- **No artifact writing** — the script emits JSON + a `.preview.md`; the agent owns the final `04-governance-constraints.md` content and traffic-light rendering
- **Reuse only current scoped evidence** — project, subscription, options, schema, COMPLETE status, valid TTL and exemptions must match
- **Resolve confirmations before review** — all topics require current evidence-bound answers; unknowns block. See [inline resolution](references/inline-resolution-gate.md)

## Steps

```bash
python .github/skills/apex-azure-governance-discovery/scripts/discover.py \
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
| `2`  | Invalid arguments (argparse), distinguished from failures by diagnostics |

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
apex-azure-artifacts template. The agent copies this to
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

- The collector traverses paginated assignments, definitions, initiatives and
  exemptions, resolving referenced definitions as needed; do not assume a fixed call count.
- Cache reuse checks project/subscription/options and COMPLETE envelope freshness,
  including positive TTL, nonfuture timestamp and still-valid scoped exemptions.
  `--arch` regenerates the preview from current architecture even on a cache hit.
- Signature verification, confirmation bindings and current review inputs remain
  consumer gates; the collector's cache hit alone cannot attest them.
- Filtering is based on assignment metadata and effective enforcement, not display-name claims.
  Review discovery_summary and diagnostics; do not claim an unmeasured reduction.

## Testing

```bash
pytest .github/skills/apex-azure-governance-discovery/scripts/test_discover.py
# or
npm run test:governance-discovery
```

Fixtures live in `scripts/fixtures/` and simulate `az rest` responses via
`subprocess.check_output` monkeypatching — no Azure account required for tests.
