---
description: "Standards for Copilot custom agent definition files, decision logging, and model-specific prompt patterns"
applyTo: "**/*.agent.md, **/*.prompt.md"
---

# Agent Authoring Standards

---

## Agent Definition Standards

These instructions apply to custom agent definition files (for example: `.github/agents/*.agent.md`).

Goals:

- Keep agent behavior consistent and predictable across the repo
- Avoid drift between agents and the authoritative standards in `.github/instructions/`
- Prevent invalid YAML front matter and broken internal links

### Front Matter (Required)

Each `.agent.md` file MUST start with valid YAML front matter:

- Use `---` to open and close the front matter.
- Use spaces (no tabs).
- Keep keys simple and consistent.

Recommended minimum fields:

```yaml
---
name: { Human-friendly agent name }
description: { 1-2 sentences, specific scope }
tools:
  - { tool-id-or-pattern }
handoffs:
  - { other-agent-id }
---
```

For the complete frontmatter field reference (all supported keys, types, defaults),
see `.github/instructions/references/agent-file-structure.md`.

#### `name`

- Clear, human-friendly display name.
- Keep it stable (renames can confuse users and docs).

#### `description`

- Describe what the agent does, and what it does NOT do.
- Mention any required standards (WAF, AVM-first, default regions) if applicable.
- **MUST be a single-line inline string** — NOT a YAML block scalar (`>`, `>-`, `|`, `|-`).
  Block scalars break VS Code prompts-diagnostics-provider and silently degrade discovery.

#### `tools`

- List only tool identifiers that are actually available in the environment.
- Prefer patterns when supported (for example: `azure-pricing/*`, `azure-mcp/*`).
- If the agent should not call tools, set `tools: []` explicitly.
- Use `agent` (not `agent/runSubagent`) as the tool ID for subagent delegation.
- For long tool lists, prefer multi-line YAML arrays for readability:

```yaml
tools: [read/readFile, edit/createFile, agent, "azure-mcp/*"]
```

#### `argument-hint`

- Optional hint text shown in the chat input field to guide users.
- Keep it short and action-oriented (for example: `Describe the Azure workload you want to deploy`).

#### `agents`

- List agent names available as subagents (must match `name` from target agent's frontmatter).
- Use `*` to allow all agents, or `[]` to prevent any subagent use.
- If `agents` is set, the `agent` tool MUST be included in `tools`.
- **Override rule**: Explicitly listing an agent in `agents` overrides that agent's
  `disable-model-invocation: true`. This lets coordinator agents access protected subagents.

#### `handoffs`

- Use `handoffs` to connect workflow steps (for example: Architect -> IaC Plan -> Bicep Code).
- Only reference agents that actually exist in the repo.
- Use Title Case for the `agent` value matching the agent's display `name` (from frontmatter).
  For example: `agent: Architect` (matching `name: Architect` in frontmatter).
- Do not set `model` on individual handoff entries unless the target agent requires a specific
  model that differs from the agent's own frontmatter `model` value.

> **Schema note:** VS Code Copilot's handoff schema permits only
> `label`, `agent`, `prompt`, and the optional `send`,
> `showContinueOn`, `model` properties. Any other property (including
> `kind:`) is flagged as "Unknown property" by the editor. Workflow-
> handoff validation derives the relationship to the DAG structurally
> from `(label, agent)` instead of relying on an inline taxonomy
> field — see `.github/skills/workflow-engine/references/handoff-validation-rules.md`.

#### `user-invocable`

- Boolean (default `true`). Controls whether the agent appears in the agents dropdown.
- Set to `false` for subagents that should only be called by other agents.

#### `disable-model-invocation`

- Boolean (default `false`). Prevents the agent from being invoked as a subagent by other agents.
- Use when an agent should only be directly user-invoked, never delegated to.

#### `model`

**Model selection is intentional and must not be changed without explicit approval.**

**Source of truth:** the agent's frontmatter `model` field is canonical. The
[`tools/registry/agent-registry.json`](../../tools/registry/agent-registry.json) entry
mirrors it (verified by `validate-model-consistency.mjs`). The
[`.github/model-catalog.json`](../model-catalog.json) file is documentation only —
it records authorized models and intended use cases but is **not** enforced by any
validator. To change a model, update the agent frontmatter first, then mirror the
change in the registry.

**Frontmatter form:**

- Agents (`*.agent.md`): array form — `model: ["Claude Opus 4.7"]`
- Prompts (`*.prompt.md`): string form — `model: "Claude Opus 4.7"`
- Registry JSON: string form — `"model": "Claude Opus 4.7"`

**Do not** use the YAML bareword form (e.g., `model: Claude Opus 4.7`) when a
label contains parenthetical qualifiers — YAML misparses parens and breaks
frontmatter loading. Always quote (or use the array form for agents).

Agents that specify `Claude Opus 4.7` as priority model do so deliberately:

- **Opus-first agents** (requirements, architect, iac-plan, context-optimizer,
  diagnose) use `Claude Opus 4.7` for architecture decisions, WAF assessments,
  planning accuracy, and complex analysis. Reasoning effort is a per-agent
  policy (see "Reasoning-effort policy" below) — not encoded in the model
  label.
- **Claude Sonnet 4.6 agents** (design, plus the four IaC validation/preview
  subagents `bicep-validate`, `bicep-whatif`, `terraform-validate`,
  `terraform-plan`): Anthropic prompting style (XML-tagged blocks, role-first,
  quote-grounded review, checklist-driven structured output) suits both ADR +
  diagram authoring and the structured PASS/FAIL findings produced by the
  validation subagents. Default Sonnet 4.6 effort is `high`; the Design agent
  and the four subagents pin effort to `medium` for typical work and only
  raise it for large change sets.
- **GPT-5.5 agents** (orchestrator, orchestrator fast path, governance,
  bicep codegen, terraform codegen, challenger wrapper, challenger-review-subagent,
  deploy (Bicep + Terraform), as-built, e2e-orchestrator)
  use the OpenAI GPT-5.5 prompting style: explicit Role / Personality / Goal /
  Success / Constraints / Output / Stop sections, retrieval budgets, decision rules
  over absolutes, and stopping conditions. GPT-5.5 reasons more efficiently than
  predecessors — re-evaluate `low`/`medium` reasoning effort before escalating
- **GPT-5.3-Codex subagents** handle narrow, high-throughput tasks (cost estimation)

#### GPT-5.5 prompting style (summary)

The migrated GPT-5.5 cohort follows the OpenAI GPT-5.5 prompting guide:

- Outcome-first body skeleton: `Role` → `Personality` (user-facing agents only) →
  `Goal` → `Success criteria` → `Constraints` → `Output` → `Stop rules`.
- Existing required sections (`output_contract`, security baseline, workflow
  contracts, examples) stay verbatim — the skeleton wraps them, it does not
  replace them.
- Constraints replace ALWAYS/NEVER absolutes with scoped decision rules; gate
  enforcement language and security-baseline language stay verbatim.
- Personality blocks are present only on the user-facing Orchestrator and
  Orchestrator (Fast Path); internal pipeline agents (CodeGen, Governance,
  Challenger, subagent) get no personality block — output contracts rule.
- Reasoning effort defaults to the Copilot runtime default; do not request
  `high` reflexively.

Current model assignments:

| Agent / Group                       | Model             | Rationale                                    |
| ----------------------------------- | ----------------- | -------------------------------------------- |
| Orchestrator                        | GPT-5.5           | Outcome-first orchestration                  |
| Orchestrator (Fast Path)            | GPT-5.5           | Streamlined orchestration                    |
| Requirements                        | Claude Opus 4.7   | Deep understanding (high effort)             |
| Architect                           | Claude Opus 4.7   | WAF analysis + cost (high effort)            |
| Design                              | Claude Sonnet 4.6 | Diagram + ADR (Anthropic style)              |
| Governance                          | GPT-5.5           | Procedural discovery                         |
| IaC Planner (unified)               | Claude Opus 4.7   | Planning accuracy (high effort)              |
| Bicep / Terraform Code              | GPT-5.5           | Code generation                              |
| Deploy (Bicep + TF)                 | GPT-5.5           | Deployment execution (outcome-first)         |
| As-Built                            | GPT-5.5           | Documentation generation (outcome-first)     |
| Diagnose                            | Claude Opus 4.7   | Interactive troubleshooting (default effort) |
| Context Optimizer                   | Claude Opus 4.7   | Deep analysis (high effort)                  |
| E2E Orchestrator                    | GPT-5.5           | Autonomous benchmark loop                    |
| Challenger wrapper                  | GPT-5.5           | Structured review                            |
| Challenger subagent                 | GPT-5.5           | Structured review                            |
| Bicep/TF validate+preview subagents | Claude Sonnet 4.6 | Isolated validation (Anthropic style)        |
| Cost estimate subagent              | GPT-5.3-Codex     | High-throughput pricing                      |

#### Reasoning-effort policy

Reasoning effort is a **per-agent** policy, not a model-label suffix. The
catalog records one entry per Anthropic SKU (`Claude Opus 4.7`,
`Claude Sonnet 4.6`); whether an agent runs at default or high reasoning
effort is documented in this section and inferred from the agent's role:

- **High effort** — Requirements, Architect, IaC Planner, Context Optimizer.
  These agents tackle creative, multi-artifact decisions where extra
  reasoning produces measurably better outcomes (WAF trade-offs, plan
  accuracy, deep audits). Sonnet-tier agents pin to `medium` for typical work
  and only escalate for large change sets.
- **Default effort** — Diagnose. The interactive approval-first flow benefits
  from default effort: Diagnose alternates short reasoning bursts with user
  confirmations, so deep multi-step deliberation per turn would just slow the
  flow without improving accuracy.
- **Effort tuning is a per-call concern** — Copilot Chat / VS Code respects
  the user's per-turn reasoning-effort selector and any harness-level
  override. The policy above is the project's recommended default; no
  validator enforces it. If you change an agent's effort policy, update this
  table and the agent's body if the body explicitly references effort.

**Source-of-truth chain:**

- Agent frontmatter is canonical (`.github/agents/**/*.agent.md`).
- The agent registry mirrors frontmatter (enforced by
  `validate-model-consistency.mjs`).
- The model catalog (`.github/model-catalog.json`) authorizes labels via its
  hand-maintained `models` block and mirrors the canonical assignments via
  its auto-generated `assignments` block (enforced by
  `validate-model-catalog.mjs`).
- The `assignments` block is regenerated by
  `node tools/scripts/generate-model-catalog.mjs` and refreshed automatically
  by the lefthook pre-commit hook whenever an agent frontmatter file is
  staged.

**Rules:**

1. **Never reorder models** to put a speed-optimized model before Opus if Opus is currently first
2. **Planning accuracy trumps cost/speed** — incorrect plans waste more resources than Opus costs
3. When adding `model` arrays, match the pattern of similar workflow-stage agents
4. Document any model changes in PR description with justification

### Agent Hierarchy

#### Top-Level Agents

Top-level agents live in `.github/agents/` and are `user-invocable: true`. They correspond to
the multi-step workflow:

| Step | Agent                | File                             |
| ---- | -------------------- | -------------------------------- |
| 1    | Requirements         | `02-requirements.agent.md`       |
| 2    | Architect            | `03-architect.agent.md`          |
| 3    | Design (optional)    | `04-design.agent.md`             |
| 4    | IaC Plan             | `05-iac-planner.agent.md`        |
| 5b   | Bicep Code           | `06b-bicep-codegen.agent.md`     |
| 6b   | Bicep Deploy         | `07b-bicep-deploy.agent.md`      |
| 5t   | Terraform Code       | `06t-terraform-codegen.agent.md` |
| 6t   | Terraform Deploy     | `07t-terraform-deploy.agent.md`  |
| 7    | As-Built             | `08-as-built.agent.md`           |
| —    | Orchestrator         | `01-orchestrator.agent.md`       |
| —    | Diagnose             | `09-diagnose.agent.md`           |
| —    | Challenger (wrapper) | `10-challenger.agent.md`         |

#### Subagents

Subagents live in `.github/agents/_subagents/` and are `user-invocable: false`. They isolate
expensive or specialized work from their parent agent's context window.

| Subagent                      | Parent Agent        | Purpose                                              |
| ----------------------------- | ------------------- | ---------------------------------------------------- |
| `challenger-review-subagent`  | All workflow agents | Adversarial review (comprehensive + rotating lenses) |
| `cost-estimate-subagent`      | Architect           | Pricing MCP queries                                  |
| `bicep-validate-subagent`     | Bicep Code          | Lint + AVM/security code review                      |
| `bicep-whatif-subagent`       | Bicep Deploy        | `az deployment group what-if`                        |
| `terraform-validate-subagent` | Terraform Code      | Lint + AVM-TF/security code review                   |
| `terraform-plan-subagent`     | Terraform Deploy    | `terraform plan` change preview                      |

Subagent definition rules:

- Set `user-invocable: false` — subagents are never called directly by users.
- Set `agents: []` — subagents do not chain to other agents.
- Keep tool lists minimal — only the tools needed for their specific task.
- Use `GPT-5.3-Codex` as the default model for fast, isolated execution.
- Return structured results (PASS/FAIL, APPROVED/NEEDS_REVISION, etc.) so the parent
  agent can act on the verdict without parsing free-form text.

#### Deprecated: `infer`

The `infer` field is deprecated. Use `user-invocable` and `disable-model-invocation` instead.
If any agent still uses `infer`, migrate it to the new fields.

### Shared Defaults (Required)

All top-level workflow agents in `.github/agents/` MUST read the `azure-defaults` skill for shared
knowledge. Include a reference near the top of the agent body:

```text
Read `.github/skills/azure-defaults/SKILL.md` FIRST for regional standards, naming conventions,
security baseline, and workflow integration patterns common to all agents.
```

### Research Before Implementation

All agents gather context before producing output. This ensures complete, one-shot execution
without missing context or requiring multiple iterations.

Pre-implementation checklist:

1. Search the workspace for existing patterns (`agent-output/`, similar projects, templates).
2. Read relevant templates in `.github/skills/azure-artifacts/templates/`.
3. Query documentation via MCP tools (Azure docs, best practices) where applicable.
4. Confirm all required artifacts from previous workflow steps exist.
5. Check shared defaults in `.github/skills/azure-defaults/SKILL.md`.
6. Proceed only when you have sufficient context to produce a complete artifact.

Use read-only tools first — `semantic_search`, `grep_search`, `read_file`, `list_dir`, and the
Azure MCP tools — to build understanding before making changes. When extensive research is
needed, delegate to a subagent and instruct it to work autonomously and return findings without
pausing for user feedback.

Rules: research before creating files; read templates before generating output; query Azure docs
before recommending services; validate inputs before proceeding to the next step; ask for
clarification when context is insufficient rather than assuming.

### Subagent Delegation Pattern

When an agent delegates work to a subagent, follow this pattern:

1. **Prepare inputs** — compile the data the subagent needs (resource list, file paths, etc.)
2. **Delegate** — call the subagent with a clear prompt containing the inputs
3. **Receive structured result** — the subagent returns a verdict/report
4. **Integrate** — use the subagent's output in the parent agent's artifact

**Context isolation**: Subagents don't inherit parent instructions or conversation
history. They receive only the task prompt. Pass all required context explicitly.
VS Code can run multiple subagents in parallel when tasks are independent.

### Authoritative Standards (Avoid Drift)

When an agent outputs a specific document type, it MUST treat these as authoritative:

- Cost estimates: `.github/skills/azure-artifacts/references/cost-estimate-standards.md`
- Workload docs: `.github/skills/docs-writer/references/workload-documentation.md`
- Markdown style: `.github/instructions/markdown.instructions.md`
- Bicep: `.github/instructions/iac-bicep-best-practices.instructions.md`

If an agent contains an embedded template in its body, it MUST match the relevant instruction file.

### Templates in Agent Bodies

- Prefer short templates that are easy to keep aligned with standards.
- If you include fenced code blocks inside a fenced template, use quadruple fences (` ```` `)
  for the outer fence to avoid accidental termination.
- Keep example templates realistic, but do not hardcode secrets, subscription IDs, or tenant IDs.

### Body Content Guidelines

- The agent body is **prepended to every user chat prompt** — keep it concise to preserve
  context window budget.
- Use `#tool:<tool-name>` to reference tools in body text (the official VS Code syntax).
- Prefer plain Markdown over decorative formatting:
  - **Bold** (`**text**`) is effective for emphasis — the model responds to it.
  - `> [!CAUTION]` / `> [!IMPORTANT]` callouts render on GitHub but have no special
    behavior in the agent runtime. Use bold headings instead to save tokens.
  - Emoji prefixes (`✅`, `❌`) on list items are redundant when the list is already
    under a `### DO` / `### DON'T` heading. Omit them.
  - Step breadcrumb lines (e.g., `requirements → architect → [design] → ...`) duplicate
    the `description` field. Omit them.

### Links

- Prefer relative links for repo content.
- Verify links resolve from the agent file's directory (relative paths in Markdown are file-relative).
- Avoid linking to files that don't exist.

### Writing Style

- Use ATX headings (`##`, `###`).
- Keep markdown lines <= 120 characters.
- Use tables for decision matrices, comparisons, and checklists.

### Quick Self-Check (Before PR)

- `tools:` uses `agent` (not the deprecated `agent/runSubagent`) for subagent delegation
- `tools:` only contains valid tool IDs/patterns
- `handoffs:` only references real agents (including As-Built for Step 7)
- Handoff entries do not redundantly set `model` when the target agent already defines it
- The `azure-defaults` skill reference is correct
- Subagent files set `user-invocable: false` and `agents: []`
- Embedded templates match `.github/instructions/*` standards
- `npm run lint:md` passes

---

## Decision Logging

When you make a significant choice during your workflow step, append an entry to
the `decision_log` array in `00-session-state.json`.

### When to Log

Log decisions about: architecture pattern, SKU or tier selection, deployment
strategy, IaC tool choice, security approach, networking topology, or when you
reject a viable alternative with meaningful trade-offs.

Do NOT log: minor implementation details, formatting choices, file naming, or
decisions already captured in the `decisions` object fields.

### Entry Format

```json
{
  "id": "D001",
  "step": 2,
  "agent": "03-Architect",
  "timestamp": "2026-03-13T15:10:00Z",
  "title": "B1 App Service over Container Apps",
  "choice": "App Service Plan B1 (Linux)",
  "alternatives": ["Container Apps Consumption", "AKS"],
  "rationale": "Budget < EUR1000/mo; no container expertise; B1 meets 200 concurrent users NFR",
  "impact": "No container registry needed; simplifies deployment"
}
```

**Required fields**: `id`, `step`, `agent`, `title`, `choice`, `rationale`.
Use sequential IDs (`D001`, `D002`, ...) continuing from the last entry.
Set `timestamp` to the current ISO 8601 time. `alternatives` and `impact` are
optional but encouraged when rejecting a viable option.

---

## Model-Prompt Alignment

When creating or modifying an agent definition (`.agent.md`) or prompt file (`.prompt.md`),
apply the patterns below based on the `model:` field in the file's YAML frontmatter.

### Model Detection

Read the `model:` field from frontmatter and classify:

- **Claude family**: any value containing `Claude Opus`, `Claude Sonnet`, or `Claude Haiku`
- **GPT family**: any value containing `GPT-5.5`, `GPT-5.4`, `GPT-5.3-Codex`, or `GPT-4o`

If `model:` is an array, classify by the first entry.

### Claude-Specific Patterns

Sources: [Anthropic Claude Prompting Best Practices][claude-guide].

#### XML Blocks (selective — not every agent)

Add XML blocks only where they serve the agent's actual role. Each block should
be 3-5 lines. Place them after the first `#` heading, before the body content.

| Block                            | Add when                                                         | Do NOT add when                                                      |
| -------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `<investigate_before_answering>` | Agent researches before deciding (Architect, Planners, Diagnose) | ONE-SHOT agents (Requirements), procedural wrappers (lint subagents) |
| `<output_contract>`              | Agent produces a formal artifact with defined structure          | Agent has no structured output                                       |
| `<context_awareness>`            | Agent definition exceeds ~350 lines                              | Small agents, subagents                                              |
| `<scope_fencing>`                | Agent produces scoped artifacts where creep is a risk            | Agents whose job is comprehensive analysis (Architect)               |
| `<empty_result_recovery>`        | Agent queries Azure APIs that may return empty results           | Agents that don't call external APIs                                 |
| `<subagent_budget>`              | Agent orchestrates 3+ subagents                                  | Leaf agents that don't delegate                                      |

**Never add**: `<use_parallel_tool_calls>` (Claude does this natively),
`<avoid_overengineering>` on comprehensive-analysis agents.

#### Language Calibration

- Keep absolute language (`MUST`, `NEVER`, `HARD RULE`) at: approval gates,
  security baseline (TLS/HTTPS/MI), governance compliance, ONE-SHOT gates
- Prefer direct phrasing elsewhere: "Do X" instead of "You MUST always do X"
- Remove duplicate emphasis where adjacent prose already conveys the same rule

### GPT-Specific Patterns

Sources: OpenAI prompt engineering documentation, GPT-5.5 system prompt guidance.

#### Structure Over XML

GPT models follow markdown structure natively — use it instead of XML blocks:

- `##` headings for workflow phases and major sections
- Numbered lists for sequential steps (GPT excels at step-following)
- Tables for decision matrices and option comparisons
- Bold (`**text**`) for emphasis the model should not skip

#### Tool-Call-First Phrasing

Write instructions that lead with the action:

```markdown
Use `az account show` to verify authentication before proceeding.
```

Not: "Consider checking if the user is authenticated by possibly running..."

#### Structured Output Guidance

For agents with formal outputs, use a fenced code block showing the expected format
rather than an XML `<output_contract>`. GPT models reproduce fenced examples reliably.

### Cross-Model Rules (Always Apply)

#### Handoff Model Overrides

- **Do not** add `model:` to a handoff entry unless it intentionally routes to a
  different model than the target agent's own frontmatter declares.
- Redundant overrides (matching the target's model) become stale when models change —
  remove them.

#### Handoff Prompt Enrichment

Every handoff prompt should include:

1. **Input**: which artifact the target agent should read (with path pattern)
2. **Output**: what the target agent should produce

Example: `"Create a WAF assessment based on agent-output/{project}/01-requirements.md.
Output: 02-architecture-assessment.md and 03-des-cost-estimate.md."`

#### Prompt File Model Sync

The `model:` field in a `.prompt.md` file must match the corresponding agent's
frontmatter `model:` value. If the agent uses `GPT-5.5`, the prompt must too.

Run `npm run lint:model-alignment` to catch mismatches.

#### Few-Shot Examples

For agents making routing or scoring decisions, add one structured example
in `<example>` tags (Claude) or a fenced block (GPT) showing:

- Input state
- Decision logic
- Expected output format

Keep examples under 12 lines. Place them at the end of the agent body.

[claude-guide]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
