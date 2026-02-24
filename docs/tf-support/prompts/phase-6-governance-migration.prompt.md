---
mode: agent
description: Implements Phase 6 — Governance Property Migration (Bicep side, deferrable). Migrates existing Bicep agents from bicepPropertyPath to azurePropertyPath. Only start after Phases 0-5 are proven working.
---

# Phase 6 — Governance Property Migration (Bicep Side)

> **This phase is DEFERRABLE.** Do not start until Phases 0-5 are fully working
> and you have validated end-to-end Terraform flow at least once.
> The dual-field output from Phase 1 (item 1.10) means Bicep agents continue
> working with `bicepPropertyPath` during the transition — there is no regression.

## Prerequisites

- Phases 0-5 complete and merged
- End-to-end test: Requirements → Terraform Planner → Code Gen → Deploy works at least once
- End-to-end test: Bicep flow still works (regression check passes)

## Context Load

1. `docs/tf-support/PROGRESS.md` — confirm Phase 6 is active (not deferred)
2. `.github/agents/06-bicep-code-generator.agent.md` — Phase 1.5 governance section
3. `.github/agents/_subagents/bicep-review-subagent.agent.md` — Governance Compliance section
4. `scripts/validate-governance-refs.mjs` — existing Bicep check groups
5. `agent-output/` — any `04-governance-constraints.json` files to update

## Item 6.31 — Migrate Bicep agents to `azurePropertyPath`

### 6.31a — `06-bicep-code-generator.agent.md`

Find Phase 1.5 (Governance Compliance Mapping). Update it to:
- READ `azurePropertyPath` as primary field
- FALLBACK to `bicepPropertyPath` if `azurePropertyPath` not present (backward compat)
- Translate `azurePropertyPath` to Bicep resource property path:
  - `storageAccount.properties.minimumTlsVersion` → `storageAccount::properties.minimumTlsVersion`

### 6.31b — `bicep-review-subagent.agent.md`

Find section 7 (Governance compliance). Update references from:
- `bicepPropertyPath` → `azurePropertyPath` (with `bicepPropertyPath` as fallback)

### 6.31c — `validate-governance-refs.mjs`

Update the existing Bicep check groups:
- Change checks that strictly require `bicepPropertyPath` to accept `azurePropertyPath` as primary
- Only warn (not fail) if only `bicepPropertyPath` is present (backward compat)
- Add a check that `governance-discovery-subagent` produces `azurePropertyPath`

### 6.31d — Update existing governance constraint files

For any `04-governance-constraints.json` in `agent-output/`:
```bash
find agent-output/ -name "04-governance-constraints.json"
```

Add `azurePropertyPath` alongside the existing `bicepPropertyPath` in each policy entry.
This is a data migration, not a code change.

### 6.31e — Documentation

Add a note to `docs/tf-support/PROGRESS.md` under Blockers & Notes:
"Phase 6 complete — `bicepPropertyPath` still present for backward compat,
`azurePropertyPath` is now the primary field. Remove `bicepPropertyPath`
in a future cleanup PR when all consumers confirmed migrated."

## Validation

```bash
npm run lint:governance-refs
npm run validate:all
```

Also test both flows end-to-end at least conceptually:
- Bicep: governance-discovery → produces both fields → bicep-code-gen reads azurePropertyPath ✓
- Terraform: governance-discovery → produces both fields → terraform-code-gen reads azurePropertyPath ✓

## Commit

```bash
git add .github/agents/06-bicep-code-generator.agent.md \
        .github/agents/_subagents/bicep-review-subagent.agent.md \
        scripts/validate-governance-refs.mjs \
        agent-output/
git commit -m "refactor(agents): migrate Bicep agents to azurePropertyPath (backward-compat)

- 06-bicep-code-generator: read azurePropertyPath, fallback to bicepPropertyPath
- bicep-review-subagent: update § 7 to use azurePropertyPath
- validate-governance-refs: azurePropertyPath as primary, bicepPropertyPath as fallback
- agent-output: add azurePropertyPath to existing governance constraint files"
```

## Update PROGRESS.md

Check off `6.31`. Phase 6 → `✅ Complete`, `active_phase: 7`. Commit.
