---
description: "Enforceable structural and runtime rules for Copilot agent and prompt files"
applyTo: "**/*.agent.md, **/*.prompt.md"
---

# Agent Authoring Standards

Keep this auto-loaded file limited to rules that affect runtime correctness or
repository validation. For agent creation, structural rewrites, model selection,
or deep audits, load `.github/skills/apex-agent-authoring/SKILL.md`.

## Frontmatter Rules

- Use valid YAML between `---` delimiters with spaces, not tabs.
- Keep `description` on one line as the repository discovery convention.
- Keep `description` at or below 350 characters; aim for 300 or fewer.
- Agent models use array form; prompt models use quoted string form.
- Agent frontmatter is the canonical model assignment. Mirror it in
  `tools/registry/agent-registry.json`; catalog assignments are generated.
- Use only available tool IDs. Delegation uses `agent`, not
  `agent/runSubagent`.
- A nonempty `agents` list requires `agent` in `tools`; `agents: []` does not.
  Leaf workers set `user-invocable: false` and `agents: []`, without delegation,
  user-question, or parent-todo tools. Return missing inputs to the parent.
- Production main agents, including `10-Challenger`, use
  `disable-model-invocation: true` and require human selection. Explicit caller
  allowlists must not override this production boundary.
- Replace deprecated `infer` with `user-invocable` and
  `disable-model-invocation`.

Complete field reference:
[`apex-agent-authoring/references/agent-file-structure.md`](../skills/apex-agent-authoring/references/agent-file-structure.md).

### Frontmatter Description Length

Router descriptions need trigger keywords, not full scope documentation. Move
extended scope tables into the body or an on-demand reference.

## Handoff Rules

- Target an existing agent using its exact frontmatter `name`.
- Use only `label`, `agent`, `prompt`, `send`, `showContinueOn`, and `model`.
- Omit `handoffs[].model` when it matches the target agent's own model.
- Every handoff prompt names its input and expected output.
- Use the workflow DAG rather than adding an inline handoff taxonomy.

Validation details:
[`apex-workflow-engine/references/handoff-validation-rules.md`](../skills/apex-workflow-engine/references/handoff-validation-rules.md).

## Model Policy

Model selection is intentional. Do not change model order or assignments without
explicit approval. Reasoning effort is a per-agent or per-call policy, never a
model-label suffix.

Preserve the user-confirmed exact label `gpt-5.6-sol`. Unknown release/cost/capability
metadata stays unknown. Ordinary labels match the catalog exactly; documented
platform qualifiers are permitted only for handoff model overrides.

### Reasoning-Effort Policy

Use higher effort for creative, multi-artifact decisions and default or medium
effort for structured execution. Assignments and rationale:
[`apex-agent-authoring/references/model-policy.md`](../skills/apex-agent-authoring/references/model-policy.md).

Repository structure and sourced vendor advice are distinguished in
[`vendor-prompting.instructions.md`](vendor-prompting.instructions.md).

## Body Rules

- The body is prepended to every turn; keep it concise and action-oriented.
- Follow the limits in `context-optimization.instructions.md`.
- Move long templates and phase-specific detail to references.
- Use `#tool:<tool-name>` for tool references.
- Prefer relative links and verify they resolve from the agent file.
- Read only skills needed for the current phase; reuse unchanged content still in context.
- Keep embedded templates aligned with their canonical source.
- For Sol, Terra, and Luna main agents, use concise Markdown: Role, Goal,
  Success criteria, Constraints, Output, and Stop rules. Keep existing H2 anchors
  and unique workflow contracts. Replace XML wrappers without deleting their content.
- Leaf workers use a role-specific input/activity/output/failure contract, not
  mandatory main-agent sections or personality. Preserve checks and stop rules;
  optional style advice must not override safety or role requirements.

Workflow, hierarchy, delegation, and PR checklist:
[`apex-agent-authoring/SKILL.md`](../skills/apex-agent-authoring/SKILL.md).
Context budgets and size limits:
[`context-optimization.instructions.md`](context-optimization.instructions.md).

## Context Hygiene (Token Efficiency)

### No-Duplicate-Read Rule

Do not call `read_file` again for unchanged content still available in context.
After source changes, compaction, or a new chat, refresh only the needed material.
Batch independent reads and questions; prefer targeted search for known symbols.
Detailed guidance:
[`apex-agent-authoring/references/runtime-guardrails.md`](../skills/apex-agent-authoring/references/runtime-guardrails.md).

### No-Direct-Markdownlint-on-Agent-Output Rule

Never run Markdown lint directly against `agent-output/**`. Artifact validation
belongs to the lefthook `artifact-validation` hook and `10-Challenger` review.

### Execution-subagent invocation contract

Execution subagent prompts use `## Inputs`, `## Activities`, and `## Outputs`,
including a bounded failure mode. Canonical template:
[`tools/apex-prompts/utility-prompts/execution-subagent.prompt.md`](../../tools/apex-prompts/utility-prompts/execution-subagent.prompt.md).

### No-Shell-Writes-to-Agent-Output Rule

Never write `agent-output/**` through heredocs, redirects, or `tee`. Use file
editing tools; shell inspection remains read-only.

### Challenger-Subagent Fallback Rule

If a required reviewer is unavailable, stop and request a human handoff
to `10-Challenger`. Missing or empty reviewer output permits exactly one
identical-input retry, then stop and request a human handoff to `10-Challenger`.
Never invoke a nested main-agent wrapper or fabricate an inline review; explicit
caller allowlists must not override this production boundary. Report the runtime
error when available. Full procedure:
[`apex-agent-authoring/references/runtime-guardrails.md`](../skills/apex-agent-authoring/references/runtime-guardrails.md#challenger-fallback).

## Decision Logging

Record significant architecture, SKU, deployment, IaC, security, networking, or
trade-off decisions through `apex-recall`; omit minor implementation choices.
Commands and decision shape:
[`apex-agent-authoring/references/decision-logging.md`](../skills/apex-agent-authoring/references/decision-logging.md).

## Model-Prompt Alignment

Validate every fallback label and family in order, without adding fallbacks.
Custom-agent prompts inherit the target model; generic Local prompts may inherit
the picker selection. Avoid redundant handoff overrides and follow the matching rules:

- [`vendor-prompting.instructions.md`](vendor-prompting.instructions.md)
- [`apex-vendor-prompting/references/family-support.md`](../skills/apex-vendor-prompting/references/family-support.md)
- [`apex-vendor-prompting/references/cross-model-rules.md`](../skills/apex-vendor-prompting/references/cross-model-rules.md)

## Verification

Run `npm run validate:agents`, `npm run lint:vendor-prompting`, and
`npm run validate:model-consistency` after changing an agent or prompt.
