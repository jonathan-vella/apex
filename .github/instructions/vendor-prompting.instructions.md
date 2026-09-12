---
description: "Sourced vendor advice and APEX authoring conventions for agent and prompt files. Rule IDs map to apex-vendor-prompting/rules.json; validator: npm run lint:vendor-prompting."
applyTo: "**/*.agent.md, **/*.prompt.md"
---

# Vendor Prompting Rules

This file is the **enforcement** thin layer. For full audit
guidance, examples, and source citations, load the
[apex-vendor-prompting skill](../skills/apex-vendor-prompting/SKILL.md).

The machine-readable rule registry is
[rules.json](../skills/apex-vendor-prompting/rules.json). Validator:
`npm run lint:vendor-prompting`.

## Hard rules (errors)

These enforce the repository contract; not every violation is a platform parsing failure:

- **`frontmatter-model-style-001`** — `.agent.md` must use array
  form for `model:` (e.g., `model: ["Claude Opus 4.7"]`).
  `.prompt.md` uses string form when explicit. YAML parentheses are valid;
  ordinary model labels still require exact catalog keys. Documented platform
  qualifiers are allowed on handoff overrides only. Validate every fallback.

## Vendor rules

### Anthropic Claude (claude-opus, claude-sonnet, claude-haiku)

Applies when frontmatter `model:` matches `claude` (case-insensitive).

- **`legacy-003`** — Body > 350 lines requires `<context_awareness>`.
- **`legacy-004`** — Research agents (Architect, IaC Planner,
  Context Optimizer) include `<investigate_before_answering>`.
- **`claude-oneshot-001`** — ONE-SHOT agents (Requirements,
  Challenger subagent) MUST NOT include
  `<investigate_before_answering>`.
- **`claude-no-prefill-001`** — MUST NOT instruct prefilling the
  assistant turn ("prefill the assistant", "assistant prefill",
  "prefilled response"). Prefill is no longer supported on Claude
  4.6+.
- **`claude-output-contract-001`** — Artifact-producing agents
  (handoffs reference `agent-output/`) include `<output_contract>`.

### Sol, Terra, And Luna: APEX Convention

Concise outcome-first Markdown is a repository convention informed by pinned
generic OpenAI guidance, not a model-specific vendor claim. Preserve exact
user-confirmed `gpt-5.6-sol`; release, capabilities, and runtime cost tiers remain
unknown where unverified. No vendor source refresh is implied by local edits.

- **`gpt55-skeleton-001`** — Required H1 sections present (any order):
  `# Goal`, `# Success criteria`, `# Constraints`, `# Output`,
  `# Stop rules`, with a Role declaration. Leaf workers instead keep a bounded
  role contract with Inputs, Outputs, and failure/return rules. Personality is
  optional and never required for a leaf worker.
- **`gpt55-stop-rules-non-empty-001`** — `# Stop rules` body must
  contain ≥1 non-blank line.
- **`gpt-no-claude-xml-001`** — Replace legacy Claude-style
  XML blocks (`<investigate_before_answering>`,
  `<context_awareness>`, `<scope_fencing>`,
  `<empty_result_recovery>`, `<subagent_budget>`,
  `<output_contract>`) with Markdown while preserving their content and H2 anchors.
  This is not a claim that GPT cannot interpret XML.
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
  [validate-models.mjs](../../tools/scripts/validate-models.mjs) (`--only=deprecated`).
- **`prompt-model-source-001`** — HARD rule (severity `error`):
  prompts targeting a custom agent (e.g. `agent: "02-Requirements"`)
  MUST NOT declare `model:` — let the agent's `model:` apply.
  Prompts using a built-in agent (or no `agent:`) may declare an
  explicit `model:` to override picker selection; omission is valid inheritance.
  Unknown custom-agent targets remain errors. The validator resolves a prompt's effective
  family via its target agent when `model:` is omitted, so the
  per-prompt rules above (`claude-no-prefill-001`,
  `model-deprecation-001`) keep firing on agent-targeting prompts.

## Family overrides

| Family          | Status        | Effect                                         |
| --------------- | ------------- | ---------------------------------------------- |
| `claude-opus`   | enforced      | All Claude rules at default severity           |
| `claude-sonnet` | enforced      | All Claude rules at default severity           |
| `claude-haiku`  | warn-only     | Severity downgrades to warn                    |
| `gpt-5.6-sol`   | enforced      | APEX outcome contract; unknown vendor metadata |
| `gpt-5.6-terra` | enforced      | APEX outcome contract at default severity      |
| `gpt-5.6-luna`  | enforced      | APEX outcome contract at default severity      |
| `gpt-5.5`       | enforced      | Legacy compatibility                           |
| `gpt-5.4`       | enforced      | Shared OpenAI outcome-first rules              |
| `gpt-codex`     | reviewer-only | Legacy compatibility                           |
| `gpt-4o`        | reviewer-only | No new enforcement                             |
| `unknown`       | enforced      | Explicit labels need catalog authorization; inherited prompts are valid |

Structural errors and catalog deprecation findings never downgrade because of
family status. Style warnings are advisory; do not remove safety invariants to
satisfy density or formatting heuristics. Historical promotion dates do not
automatically change the current rule severity.

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
# All apex-vendor-prompting rules across all agents/prompts
npm run lint:vendor-prompting

# JSON output for tooling
node tools/scripts/validate-agents.mjs \
  --only=vendor-prompting --format=json

# Show every registered rule (cross-checked against rules.json)
node tools/scripts/validate-agents.mjs --list-rules
```

For deep guidance, audit procedures, and source citations, load the
[apex-vendor-prompting skill](../skills/apex-vendor-prompting/SKILL.md).
