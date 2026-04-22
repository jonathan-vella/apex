<!-- digest:auto-generated from SKILL.md — do not edit manually -->

---

name: azure-governance-discovery
description: "Deterministic Azure Policy discovery script (discover.py) used by 04g-Governance Phase 1."
compatibility: Python 3.10+, Azure CLI on PATH.

---

# Azure Governance Discovery — Digest

Deterministic replacement for the legacy `governance-discovery-subagent`.

## Invoke

```bash
python .github/skills/azure-governance-discovery/scripts/discover.py \
    --project $PROJECT \
    --out agent-output/$PROJECT/04-governance-constraints.json
```

Optional: `--refresh`, `--include-defender-auto`, `--subscription <id>`.

## Contract

- Stdout line 1 = JSON: `{"status":"COMPLETE|PARTIAL|FAILED","cache_hit":bool,"assignment_total":N,"blockers":N,"auto_remediate":N,"exempted":N,"out_path":"..."}`
- Exit 0/1/2/3 = COMPLETE / PARTIAL / FAILED / bad args
- File output conforms to `schemas/governance-constraints.schema.json`
- Also writes `04-governance-constraints.preview.md` sibling (H2-structured markdown)

## Envelope keys

- `findings` — all Deny/Modify/DINE findings
- `policies` — alias (same reference) of `findings`
- `tags_required` — extracted tag-enforcement findings `[{name, source_policy}]`
- `allowed_locations` — from location-constraint policies
- `assignment_inventory` — all kept assignments for audit trail
- Property paths are always `""` (empty string) when unresolvable, never `null`
- `tags_required[].name` = actual tag key from assignment params (e.g., "Environment"),
  or `[unresolved: {policy}]` when params unavailable
- `allowed_locations` = actual location values from assignment params

## References

- `references/terminal-commands.md` — **MANDATORY**: pre-built batched commands (Cmd 1–7)
  for the entire governance phase. Use these instead of composing jq queries.
- `references/effect-classification.md` — policy effect → classification mapping
- `references/schema.md` — JSON schema documentation

## Additive fields per finding

- `category` — from `properties.metadata.category` (default `"Uncategorized"`)
- `exemption` — nullable; populated when a `policyExemptions` record matches
- `classification` — `"blocker"` | `"auto-remediate"` | `"informational"`
  (exempted blockers downgrade to informational)

## Defender filter

Assignments with `properties.metadata.assignedBy == "Security Center"` are
excluded by default. Use `--include-defender-auto` to retain them. Every
filtered assignment is logged to stderr.

## Never in this skill

- Artifact writing (`04-governance-constraints.md`)
- Architecture cross-reference
- Challenger orchestration
