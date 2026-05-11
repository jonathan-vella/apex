<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Governance Discovery Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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
> _See SKILL.md for full content._

## Steps

```bash
python .github/skills/azure-governance-discovery/scripts/discover.py \
    --project my-project \
    --out agent-output/my-project/04-governance-constraints.json
```

Flags:
> _See SKILL.md for full content._

## Output Contract

The script writes a JSON envelope conforming to
[`tools/schemas/governance-constraints.schema.json`](../../../tools/schemas/governance-constraints.schema.json)
(`schema_version: governance-constraints-v1`). Findings include both
`bicepPropertyPath` and `azurePropertyPath`, plus three additive fields:

- `category` — `properties.metadata.category` from the definition; `"Uncategorized"` if absent.
- `exemption` — nullable object with `exemptionCategory` (`Waiver`|`Mitigated`),
> _See SKILL.md for full content._

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
> _See SKILL.md for full content._

## Testing

```bash
pytest .github/skills/azure-governance-discovery/scripts/test_discover.py
# or
npm run test:governance-discovery
```

Fixtures live in `scripts/fixtures/` and simulate `az rest` responses via
> _See SKILL.md for full content._
