<!-- ref:schema-evolution-v1 -->

# Workflow Graph Schema Evolution (D1)

> Policy governing changes to
> [`templates/workflow-graph.json`](../templates/workflow-graph.json)
> and its schema at
> [`tools/schemas/workflow-graph.schema.json`](../../../../tools/schemas/workflow-graph.schema.json).
> Single source of truth for the version: `metadata.version`
> (defect D-A0 — no parallel `schema_version` field).

## Versioning

`metadata.version` follows semver `major.minor` semantics.
`major` and `minor` are integers; we do not use patch for graph
schema changes.

| Change kind                                   | Bump  | Example                                        |
| --------------------------------------------- | ----- | ---------------------------------------------- |
| Additive (new optional field, new edge cond.) | minor | 2.1 → 2.2 (added `return_edges`, `challenger`) |
| Breaking (rename, semantics change, removal)  | major | 2.x → 3.0                                      |

Validators **MUST refuse to run** if `metadata.version`'s major
doesn't match their expected major. This forces opt-in upgrades and
prevents silent miscompare on cross-major drift.

## Additive change checklist

When making an additive change (most common case):

1. Add the new field to `templates/workflow-graph.json`.
2. Update `tools/schemas/workflow-graph.schema.json`:
   - Add the field under `properties` with type + description.
   - Add to `metadata.version` enum (e.g., `["2.1", "2.2", "2.3"]`).
3. Update `tools/scripts/validate-workflow-graph.mjs` to validate
   the new field.
4. Audit consumers (Phase A6 sweep):
   - `tools/scripts/generate-explorer-graph.mjs`
   - `tools/scripts/validate-workflow-table-sync.mjs`
   - `tools/scripts/validate-agent-registry.mjs`
   - `site/public/architecture-explorer-graph.json` (rebuild + diff)
   - `grep -rn "workflow-graph.json" .` to find any other readers
5. Run `npm run validate:workflow-graph && npm run build:explorer-graph`.

## Breaking change checklist

For breaking changes (rename, removal, semantics):

1. Bump major (`2.x → 3.0`).
2. Implement **dual-read** in `validate-workflow-graph.mjs`: accept
   both old and new shapes for at least one release cycle, with
   clear deprecation warnings.
3. Document the migration in this file with a "Migration: 2.x → 3.0"
   section: what changed, how to update graphs, when dual-read
   sunset is planned.
4. Update all consumers in lockstep.
5. Cut a coordinated PR; do not split across multiple PRs.

## Rollback (D2 graceful degradation)

If a Phase A change ships and a downstream consumer fails:

1. Revert `metadata.version` in `templates/workflow-graph.json` to
   the previous value (e.g., `"2.2"` → `"2.1"`).
2. The new fields' presence is harmless — old consumers ignore
   unknown top-level keys, and `validate-workflow-graph.mjs`
   accepts both 2.1 and 2.2 shapes via the version enum.
3. New rules in `validate-agents.mjs` short-circuit to `info` when
   `metadata.version < "2.2"` (see `isVersionAtLeast22()` in
   `tools/scripts/_lib/workflow-handoffs.mjs`).
4. File a follow-up issue capturing the consumer failure so the
   bump can be re-attempted with the consumer fixed.

## Version history

| Version | Date       | Change                                                                                                             |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 2.1     | (initial)  | Original schema with `nodes`, `edges`, per-node `challenger`, `metadata.version`.                                  |
| 2.2     | 2026-05-09 | Added top-level `challenger`, `return_edges`, `orchestrator_targets`, `ui_pseudo_targets`; condition may be array. |
