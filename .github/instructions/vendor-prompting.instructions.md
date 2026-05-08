---
description: "Vendor prompting best-practice rules for Anthropic Claude and OpenAI GPT-5.5 agents and prompts. Each rule cites a rule ID in the vendor-prompting skill rules.json registry. Validator: npm run lint:vendor-prompting."
applyTo: "**/*.agent.md, **/*.prompt.md"
---

# Vendor Prompting Rules

This file is the **enforcement** thin layer. For full audit
guidance, examples, and source citations, load the
[vendor-prompting skill](../skills/vendor-prompting/SKILL.md).

The machine-readable rule registry is
[rules.json](../skills/vendor-prompting/rules.json). Validator:
`npm run lint:vendor-prompting`.

## Hard rules (errors)

These break runtime if violated:

- **`frontmatter-model-style-001`** — `.agent.md` must use array
  form for `model:` (e.g., `model: ["Claude Opus 4.7"]`).
  `.prompt.md` must use string form. Bareword form for labels with
  parenthetical qualifiers (e.g., `model: Claude Foo (suffix)`) breaks YAML.

## Vendor rules

### Anthropic Claude (claude-opus, claude-sonnet, claude-haiku)

Applies when frontmatter `model:` matches `claude` (case-insensitive).

- **`legacy-003`** — Body > 350 lines requires `<context_awareness>`.
- **`legacy-004`** — Research agents (Architect, IaC Planner,
  Diagnose, Context Optimizer) include `<investigate_before_answering>`.
- **`claude-oneshot-001`** — ONE-SHOT agents (Requirements,
  Challenger subagent) MUST NOT include
  `<investigate_before_answering>`.
- **`claude-no-prefill-001`** — MUST NOT instruct prefilling the
  assistant turn ("prefill the assistant", "assistant prefill",
  "prefilled response"). Prefill is no longer supported on Claude
  4.6+.
- **`claude-output-contract-001`** — Artifact-producing agents
  (handoffs reference `agent-output/`) include `<output_contract>`.

### OpenAI GPT-5.5

Applies when frontmatter `model:` matches `gpt-5.5`.

- **`gpt55-skeleton-001`** — Required H1 sections present (any order):
  `# Goal`, `# Success criteria`, `# Constraints`, `# Output`,
  `# Stop rules`. `# Personality` only on user-facing Orchestrator
  agents.
- **`gpt55-stop-rules-non-empty-001`** — `# Stop rules` body must
  contain ≥1 non-blank line.
- **`gpt-no-claude-xml-001`** — MUST NOT contain Claude-specific
  XML blocks (`<investigate_before_answering>`,
  `<context_awareness>`, `<scope_fencing>`,
  `<empty_result_recovery>`, `<subagent_budget>`,
  `<output_contract>`).
- **`personality-scoping-001`** — `# Personality` block forbidden
  on internal pipeline agents (info-only).

### Cross-vendor

- **`legacy-001` / `prompt-model-sync-001`** — Prompt `model:` must
  match its target agent's `model:`.
- **`legacy-002`** — `handoffs[].model` must NOT be set when it
  matches the target agent's own `model:`.
- **`handoff-enrichment-001`** — Every `handoffs[].prompt` contains
  BOTH an Input reference (artifact path or "Input:") AND an Output
  reference (save path or "Output:").
- **`cross-language-density-001`** — Absolute words density
  (ALWAYS / NEVER / MUST / HARD RULE) ≤ 0.05 outside permitted
  prose contexts (security baseline, governance, approval gate,
  non-negotiable). Info-only on first release.
- **`model-deprecation-001`** — Cross-references
  [validate-deprecated-models.mjs](../../tools/scripts/validate-deprecated-models.mjs).
- **`prompt-model-source-001`** — HARD rule (severity `error`):
  prompts targeting a custom agent (e.g. `agent: "02-Requirements"`)
  MUST NOT declare `model:` — let the agent's `model:` apply.
  Prompts using `agent: agent` (or no `agent:`) MUST declare an
  explicit `model:`. The validator resolves a prompt's effective
  family via its target agent when `model:` is omitted, so the
  per-prompt rules above (`claude-no-prefill-001`,
  `model-deprecation-001`) keep firing on agent-targeting prompts.

## Family overrides

| Family          | Status        | Effect                                         |
| --------------- | ------------- | ---------------------------------------------- |
| `claude-opus`   | enforced      | All Claude rules at default severity           |
| `claude-sonnet` | enforced      | All Claude rules at default severity           |
| `claude-haiku`  | warn-only     | Severity downgrades to warn                    |
| `gpt-5.5`       | enforced      | All GPT-5.5 rules at default severity          |
| `gpt-5.4`       | deprecated    | Retired 2026-05; no active assignments         |
| `gpt-codex`     | reviewer-only | No automated enforcement                       |
| `gpt-4o`        | reviewer-only | No new enforcement                             |
| `unknown`       | enforced      | ERROR — force explicit `model:` in frontmatter |

## When this instruction applies vs other instructions

This instruction defers to:

- [agent-authoring.instructions.md](agent-authoring.instructions.md)
  for frontmatter structure, handoff schema, and model-assignment
  decisions (canonical, structural).

This instruction outranks:

- [markdown.instructions.md](markdown.instructions.md) for any
  conflict on prose style.

See
[references/precedence-matrix.md](references/precedence-matrix.md)
for the full ordering.

## Verifying compliance

```bash
# All vendor-prompting rules across all agents/prompts
npm run lint:vendor-prompting

# JSON output for tooling
node tools/scripts/validate-agents.mjs \
  --only=vendor-prompting --format=json

# Show every registered rule (cross-checked against rules.json)
node tools/scripts/validate-agents.mjs --list-rules
```

For deep guidance, audit procedures, and source citations, load the
[vendor-prompting skill](../skills/vendor-prompting/SKILL.md).
