<!-- ref:agent-model-policy-v3 -->

# Agent Model Policy

## Source Of Truth

Active production agent definitions omit both `model` and `reasoning-effort`.
The operator explicitly selects Auto in the supported runtime; omission does
not force Auto. If the runtime selection is unavailable or unknown, stop rather
than silently pinning a model or effort.

`tools/registry/agent-registry.json` describes role paths and workflow steps.
Its optional `model` mirror is retained only for legacy pinned fixtures.
`.github/model-catalog.json` preserves descriptive model metadata; generated
assignments include only explicit legacy pins and are normally empty for active
production agents. Run `node tools/scripts/generate-model-catalog.mjs` after
changing a deliberately pinned fixture.

Static consistency checks and matching route telemetry do not prove that the
operator selected Auto, actual model availability, or runtime routing. Readiness
requires attributed telemetry showing a nonempty
configured model and matching first dispatched model from an explicitly
recognized SDK source. Recognized inherited/runtime-selected model sources may
be valid; unknown source values remain blocking until supported by observed
runtime evidence. Model labels and catalog metadata do not establish cost-tier
eligibility or API support.

The supplied SDK record establishes `custom_agent_definition` /
`agent_definition_default` for a historically pinned worker and `unset` /
`session_inheritance` for an unpinned worker. Accept the inherited profile only
when the task has no caller routing overrides and the worker's start,
configured and dispatched models all match the parent's observed session model.
This verifies the inherited route, not operator Auto selection; verify Auto in
the current runtime. Stale or mismatched parent session evidence blocks readiness.
Initial `MODEL_VERIFIED` never proves complete readiness; execution requires
complete-phase `READY_VERIFIED` and `continuation_verified: true` under the
[worker-readiness protocol](../../apex-workflow-engine/references/worker-readiness.md).

## Catalog Metadata

Model catalog entries are descriptive metadata and legacy fixture compatibility,
not an active assignment map. Preserve exact labels and unknown metadata without
inventing public release dates, capabilities, prices, or cost tiers. Capability
descriptors are not runtime subagent cost tiers. No automatic fixed-model fallback
is authorized.

Human handoffs select the named owner; an unavailable or unverified transition
must not be replaced by implicit delegation. Native Local/Host eligibility,
operator Auto selection and picker resolution remain manual/runtime acceptance
gates, not conclusions from static catalog checks.

## Reasoning Effort

Active definitions omit `reasoning-effort`; the operator-selected runtime
controls effort. Do not infer effective effort from role, model label, catalog
metadata, or omitted frontmatter. Report observed effort only when runtime
telemetry supplies it. Pinned values may remain in isolated compatibility
fixtures to test legacy validation.

## Prompt Style

- Active main agents use the APEX Markdown contract (one H1 plus nonempty Role,
  Goal, Success criteria, Constraints, Output, and Stop rules H2s) or the
  existing structured contract (one H1, nonempty `## Role`, and nonempty
  `<scope_fencing>`, `<output_contract>` and `<stop_conditions>` blocks).
  `validateProductionAgentBody` enforces either structure independently of
  runtime model selection. Keep approval and workflow contracts explicit.
- Leaf workers: role-specific inputs, activities, outputs, and bounded failure/
  return behavior. No mandatory personality or main-agent section boilerplate.
- The Orchestrator retains a concise routing structure and human-selected entry.

For a vendor-specific audit, ask the user to invoke `/apex-vendor-prompting` explicitly.
Do not load that manual-only skill automatically; model-neutral structural checks and applicable vendor validators remain in force.
