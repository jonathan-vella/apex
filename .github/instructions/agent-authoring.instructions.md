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
- Active production agents omit both `model` and `reasoning-effort`. The
  operator and runtime control selection, including Auto and HydraFusion.
  Keep optional fixed-model support for isolated fixtures and legacy validation.
- Prompt models use quoted string form. Registry model values are optional
  legacy mirrors; catalog assignments are generated only for explicit pins.
- Use only available tool IDs. Delegation uses `agent`, not
  `agent/runSubagent`.
- A nonempty `agents` list requires `agent` in `tools`; `agents: []` does not.
  Leaf workers set `user-invocable: false` and `agents: []`, without delegation,
  user-question, or parent-todo tools. Return missing inputs to the parent.
- `01-Orchestrator` remains a human-selected entry point with
  `disable-model-invocation: true`. Other main agents are user-invocable and
  model-invocable only through Orchestrator's approved, verified background dispatch.
  Step agents allowlist only their authorized leaves; leaves never delegate.
- Routine approved delegated project work uses direct `WORKER_EXECUTE` dispatch
  and `--phase execute` attribution (`EXECUTE_VERIFIED`) under
  [`worker-readiness.md`](../skills/apex-workflow-engine/references/worker-readiness.md).
  Tool-free handshake and same-worker continuation are diagnostic-only, not routine prerequisites.
  A frontmatter label, allowlist or catalog entry does not prove worker readiness.
- Automatic review callers may allowlist built-in `rubber-duck`. Use the
  [one-shot contract](../skills/apex-azure-defaults/references/one-shot-review.md),
  not resumable handshake/ACK. Require attributed completion and recorded,
  schema-valid, fresh findings; no inline self-review or human-gate bypass.
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
- Do not set `handoffs[].model` for active production targets; they are unpinned.
  Retain explicit handoff model values only for isolated legacy fixtures.
- Every handoff prompt names its input and expected output.
- Use the workflow DAG rather than adding an inline handoff taxonomy.

Validation details:
[`apex-workflow-engine/references/handoff-validation-rules.md`](../skills/apex-workflow-engine/references/handoff-validation-rules.md).

## Model Policy

Active production agent definitions must not pin a model or reasoning effort.
The operator and runtime control selection, including Auto and HydraFusion.
Readiness is model-agnostic: model names, effort, picker selection and model-source
labels are optional diagnostics. Missing metadata, unknown source labels or
configured/dispatched model differences do not block readiness. Require worker
identity and parent/dispatch linkage. Diagnostic handshakes additionally require
tool-free turns and exact same-worker continuation.
Leave caller model, effort and context overrides unset. Keep catalog labels and
metadata unchanged for descriptive and pinned-fixture compatibility.

### Reasoning-Effort Policy

Active production definitions omit `reasoning-effort`; the operator-selected
runtime controls effort. Do not infer effective effort from role, model label,
catalog entry, or omitted frontmatter. Report observed effort only when runtime
telemetry supplies it. Pinned fixture tests may retain effort values for
legacy validation. Rationale:
[`apex-agent-authoring/references/model-policy.md`](../skills/apex-agent-authoring/references/model-policy.md).

Repository structure and sourced vendor advice are distinguished in
[`vendor-prompting.instructions.md`](vendor-prompting.instructions.md).

## Body Rules

- The body is prepended to every turn; keep it concise and action-oriented.
- Follow the size limits in [`context-optimization.instructions.md`](context-optimization.instructions.md).
- Move long templates and phase-specific detail to references.
- Use `#tool:<tool-name>` for tool references.
- Prefer relative links and verify they resolve from the agent file.
- Read only skills needed for the current phase; reuse unchanged content still in context.
- Keep embedded templates aligned with their canonical source.
- Active main agents use either the APEX Markdown contract (one H1 plus nonempty
  Role, Goal, Success criteria, Constraints, Output, and Stop rules H2s) or the
  existing structured contract (one H1, nonempty `## Role`, and nonempty
  `<scope_fencing>`, `<output_contract>`, and `<stop_conditions>` blocks).
  Validation is body-structure based, not selected-model based. Preserve approval
  gates, output ownership, and workflow-specific stop rules.
- Leaf workers use a role-specific input/activity/output/failure contract, not
  mandatory main-agent sections or personality. Preserve checks and stop rules;
  optional style advice must not override safety or role requirements.

Workflow, hierarchy, delegation, and PR checklist:
[`apex-agent-authoring/SKILL.md`](../skills/apex-agent-authoring/SKILL.md).

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
[`execution-subagent.md`](../skills/apex-workflow-engine/references/execution-subagent.md).

### No-Shell-Writes-to-Agent-Output Rule

Never write `agent-output/**` through heredocs, redirects, or `tee`. Use file
editing tools; shell inspection remains read-only.

### Challenger-Subagent Fallback Rule

If a required reviewer is unavailable, stop and return the actual failure to the
interactive parent. Missing or empty reviewer output permits exactly one
identical-input retry within the existing budget, then stop for a human decision.
`10-Challenger` remains optional manual recovery, not an automatic pipeline dependency.
Never invoke a nested main-agent wrapper or fabricate an inline review; explicit
caller allowlists must not override this production boundary. Report the runtime
error when available. Full procedure:
[`apex-agent-authoring/references/runtime-guardrails.md`](../skills/apex-agent-authoring/references/runtime-guardrails.md#challenger-fallback).

## Decision Logging

Interactive sessions use `ask_user` with `message` and
`requestedSchema.properties`, one typed field per independent question.
Use `enum`/`oneOf` for choices and `array`/`items` for multi-select; defaults
are suggestions, not approvals. Delegated steps return `USER_INPUT_REQUIRED`
with that form to their interactive parent. Cancel aborts; decline never approves.

Record significant architecture, SKU, deployment, IaC, security, networking, or
trade-off decisions through `apex-recall`; omit minor implementation choices.
Commands and decision shape:
[`apex-agent-authoring/references/decision-logging.md`](../skills/apex-agent-authoring/references/decision-logging.md).

## Model-Prompt Alignment

Validate every fallback label and family in order, without adding fallbacks.
Archive-only prompt fixtures retain their historical model rules. Active SDK
workers use runtime-managed model selection. Readiness verifies the exact named
worker dispatch and continuation, not model selection. Avoid
redundant handoff overrides and follow the matching rules:

- [`vendor-prompting.instructions.md`](vendor-prompting.instructions.md)
- [`apex-vendor-prompting/references/family-support.md`](../skills/apex-vendor-prompting/references/family-support.md)
- [`apex-vendor-prompting/references/cross-model-rules.md`](../skills/apex-vendor-prompting/references/cross-model-rules.md)

## Verification

Run `npm run validate:agents`, `npm run lint:vendor-prompting`, and
`npm run validate:model-consistency` after changing an agent or prompt.
