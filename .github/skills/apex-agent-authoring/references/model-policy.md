<!-- ref:agent-model-policy-v4 -->

# Agent Model Policy

## Source Of Truth

Active production agent definitions omit both `model` and `reasoning-effort`.
The operator and runtime control selection, including Auto and HydraFusion.
Do not impose a particular picker identifier, underlying model or effort as a
readiness requirement, and do not add per-call model, effort or context overrides.

`tools/registry/agent-registry.json` describes role paths and workflow steps.
Its optional `model` mirror is retained only for legacy pinned fixtures.
`.github/model-catalog.json` preserves descriptive model metadata; generated
assignments include only explicit legacy pins and are normally empty for active
production agents. Run `node tools/scripts/generate-model-catalog.mjs` after
changing a deliberately pinned fixture.

Readiness is model-agnostic. Model names, effort, picker selection and model-source
labels are optional diagnostics; missing values, unknown source labels or
configured/dispatched/response model differences never block readiness.
This supports runtime-managed selection and multi-model workflows without
hard-coded routing profiles. Use the actual native task result and returned handle,
not tool-free turns, nonce exchanges or mandatory log replay.
Required tool/input/approval failures remain blockers under the
[native task lifecycle](../../apex-workflow-engine/references/worker-readiness.md).

## Catalog Metadata

Model catalog entries are descriptive metadata and legacy fixture compatibility,
not an active assignment map. Preserve exact labels and unknown metadata without
inventing public release dates, capabilities, prices, or cost tiers. Capability
descriptors are not runtime subagent cost tiers. No automatic fixed-model fallback
is authorized.

Explicit user selection or native tasks select the named owner; an unavailable required transition
must not be replaced by implicit permission expansion. Native Copilot routing,
tool binding and same-worker continuation require runtime acceptance, not
conclusions from static catalog checks. Picker selection and model attestation
are not acceptance gates.

## Reasoning Effort

Active definitions omit `reasoning-effort`; the operator-selected runtime
controls effort. Do not infer effective effort from role, model label, catalog
metadata, or omitted frontmatter. Report observed effort only when runtime
telemetry supplies it. Pinned values may remain in isolated compatibility
fixtures to test legacy validation.

## Prompt Style

- Active main agents use the APEX Markdown contract: one H1 matching the name and
  nonempty Role, Constraints, Output and Stop rules H2s (including recognized aliases).
  `validateProductionAgentBody` enforces these independently of runtime model selection;
  Goal and Success criteria remain useful authoring guidance, not additional enforced sections.
  Legacy XML examples do not satisfy the active production contract.
  Keep approval and workflow contracts explicit.
- Leaf workers: role-specific inputs, activities, outputs, and bounded failure/
  return behavior. No mandatory personality or main-agent section boilerplate.
- The Orchestrator retains a concise routing structure and human-selected entry.

For a vendor-specific audit, ask the user to invoke `/apex-vendor-prompting` explicitly.
Do not load that manual-only skill automatically; model-neutral structural checks and applicable vendor validators remain in force.
