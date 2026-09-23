<!-- ref:agent-model-policy-v2 -->

# Agent Model Policy

## Source Of Truth

- Agent frontmatter is canonical.
- `tools/registry/agent-registry.json` mirrors frontmatter.
- `.github/model-catalog.json` authorizes labels and contains generated
  assignments.
- `node tools/scripts/generate-model-catalog.mjs` refreshes assignments.

Do not reorder prioritized models or change assignments without explicit
approval. Explain approved changes in the pull request.

Before propagating an unfamiliar identifier, verify one representative selection
in the supported harness and use its exact picker value. A catalog-consistency
pass proves only that local declarations agree, not runtime availability.
Keep family classification separate from identifier matching; do not normalize
spaces or provider suffixes away to make validation pass.

## Assignment Rationale

The catalog and approved agent frontmatter own the active map; do not duplicate it
here. Preserve exact picker labels, including spaces and provider suffixes, without inventing public
release dates, capability metadata, prices, or cost tiers. Unknown metadata is
represented by null with explicit provenance. Capability descriptors are not
runtime subagent cost tiers. No automatic model fallback is authorized.

Check all existing fallback labels and families, not only the preferred model.
Human handoffs select the named owner; an unavailable or unverified transition
must not be replaced by implicit delegation. Native Local/Host eligibility and
picker resolution remain manual acceptance gates, not conclusions from static tests.

## Reasoning Effort

- Follow the selected agent's current effort guidance; do not infer effort from a role or model family alone.
- The current Architect and IaC Planner recommend medium when supported by the active runtime.
- The current Bicep and Terraform CodeGen agents recommend max when supported by the active runtime.
- Validation, preview, and diagnostic workers retain their own task-specific effort guidance.

These are recommendations only where the selected model and harness
expose a supported effort control. Effort is not part of a model label; do not
invent a Sol effort API. Re-evaluate before escalating; effort does not replace
missing context or validation.

## Prompt Style

- Claude: role-first structured contracts and selective XML blocks.
- Sol, Terra, Luna: concise outcome-first Markdown and explicit stop rules as an
  APEX convention, informed by pinned generic OpenAI guidance, not a claim of
  model-specific vendor endorsement. Main agents retain Role, Goal, Success
  criteria, Constraints, Output, Stop rules, and existing H2 reference anchors.
- Leaf workers: role-specific inputs, activities, outputs, and bounded failure/
  return behavior. No mandatory personality or main-agent section boilerplate.
- MAI Code Flash: concise orchestrator routing structure.

For a vendor-specific audit, ask the user to invoke `/apex-vendor-prompting` explicitly.
Do not load that manual-only skill automatically; required model and vendor validators remain in force.
