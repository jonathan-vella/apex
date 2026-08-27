---
description: "Enforceable structural and runtime rules for Copilot agent and prompt files"
applyTo: "**/*.agent.md, **/*.prompt.md"
---

# Agent Authoring Standards

Keep this auto-loaded file limited to rules that affect runtime correctness or
repository validation. For agent creation, structural rewrites, model selection,
or deep audits, load `.github/skills/agent-authoring/SKILL.md`.

## Frontmatter Rules

- Use valid YAML between `---` delimiters with spaces, not tabs.
- Keep `description` on one line; block scalars break agent discovery.
- Keep `description` at or below 350 characters; aim for 300 or fewer.
- Agent models use array form; prompt models use quoted string form.
- Agent frontmatter is the canonical model assignment. Mirror it in
  `tools/registry/agent-registry.json`; catalog assignments are generated.
- Use only available tool IDs. Delegation uses `agent`, not
  `agent/runSubagent`.
- If `agents` is present, include `agent` in `tools`. Leaf subagents set
  `user-invocable: false` and `agents: []`.
- Replace deprecated `infer` with `user-invocable` and
  `disable-model-invocation`.

Complete field reference:
[`agent-authoring/references/agent-file-structure.md`](../skills/agent-authoring/references/agent-file-structure.md).

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
[`workflow-engine/references/handoff-validation-rules.md`](../skills/workflow-engine/references/handoff-validation-rules.md).

## Model Policy

Model selection is intentional. Do not change model order or assignments without
explicit approval. Reasoning effort is a per-agent or per-call policy, never a
model-label suffix.

### Reasoning-Effort Policy

Use higher effort for creative, multi-artifact decisions and default or medium
effort for structured execution. Assignments and rationale:
[`agent-authoring/references/model-policy.md`](../skills/agent-authoring/references/model-policy.md).

Vendor-specific structure is enforced by
[`vendor-prompting.instructions.md`](vendor-prompting.instructions.md).

## Body Rules

- The body is prepended to every turn; keep it concise and action-oriented.
- Follow the limits in `context-optimization.instructions.md`.
- Move long templates and phase-specific detail to references.
- Use `#tool:<tool-name>` for tool references.
- Prefer relative links and verify they resolve from the agent file.
- Read only skills needed for the current phase; never reread one in-session.
- Keep embedded templates aligned with their canonical source.

Workflow, hierarchy, delegation, and PR checklist:
[`agent-authoring/SKILL.md`](../skills/agent-authoring/SKILL.md).
Context budgets and size limits:
[`context-optimization.instructions.md`](context-optimization.instructions.md).

## Context Hygiene (Token Efficiency)

### No-Duplicate-Read Rule

Do not call `read_file` again for content already in the conversation. Batch
independent reads and questions; prefer targeted search for known symbols.
Detailed guidance:
[`agent-authoring/references/runtime-guardrails.md`](../skills/agent-authoring/references/runtime-guardrails.md).

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

If direct challenger invocation fails, retry once through `10-Challenger`. If
that also fails, report the verbatim error and stop; never fabricate an inline
challenger pass. Full procedure:
[`agent-authoring/references/runtime-guardrails.md`](../skills/agent-authoring/references/runtime-guardrails.md#challenger-fallback).

## Decision Logging

Record significant architecture, SKU, deployment, IaC, security, networking, or
trade-off decisions through `apex-recall`; omit minor implementation choices.
Commands and decision shape:
[`agent-authoring/references/decision-logging.md`](../skills/agent-authoring/references/decision-logging.md).

## Model-Prompt Alignment

Classify behavior from the first frontmatter model. Align prompt and target-agent
models, avoid redundant handoff overrides, and follow the matching vendor rules:

- [`vendor-prompting.instructions.md`](vendor-prompting.instructions.md)
- [`vendor-prompting/references/family-support.md`](../skills/vendor-prompting/references/family-support.md)
- [`vendor-prompting/references/cross-model-rules.md`](../skills/vendor-prompting/references/cross-model-rules.md)

## Verification

Run `npm run validate:agents`, `npm run lint:vendor-prompting`, and
`npm run validate:model-consistency` after changing an agent or prompt.
