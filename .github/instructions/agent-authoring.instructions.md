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

#### `user-invocable`

- Boolean (default `true`). Controls whether the agent appears in the agents dropdown.
- Set to `false` for subagents that should only be called by other agents.

#### `disable-model-invocation`

- Boolean (default `false`). Prevents the agent from being invoked as a subagent by other agents.
- Use when an agent should only be directly user-invoked, never delegated to.

#### `model`

**Model selection is intentional and must not be changed without explicit approval.**

Agents that specify `Claude Opus 4.6` as priority model do so deliberately:

- **Opus-first agents** (requirements, architect, iac-plan, diagnose,
  context-optimizer) require deeper reasoning for architecture decisions,
  WAF assessments, planning accuracy, and complex analysis
- **GPT-5.4 workflow and execution agents** (orchestrator, governance,
  as-built, challenger wrapper, e2e-orchestrator, codegen, deploy) prioritize
  strong general reasoning for orchestration, diagrams, governance synthesis,
  documentation generation, code generation, deployment execution, and structured reviews
- **Claude Sonnet 4.6 agents** (orchestrator fast path, design, and validation/preview subagents) balance
  speed with strong execution quality for implementation
- **GPT-5.3-Codex subagents** handle narrow, high-throughput validation or preview tasks

Current model assignments:

| Agent / Group            | Model                             | Rationale                 |
| ------------------------ | --------------------------------- | ------------------------- |
| Orchestrator             | GPT-5.4                           | Orchestration             |
| Orchestrator (Fast Path) | Claude Sonnet 4.6                 | Streamlined orchestration |
| Requirements             | Claude Opus 4.6                   | Deep understanding        |
| Architect                | Claude Opus 4.6                   | WAF analysis + cost       |
| Design                   | Claude Sonnet 4.6                 | Diagram generation        |
| Governance               | GPT-5.4                           | Governance discovery      |
| IaC Planner (unified)    | Claude Opus 4.6                   | Planning accuracy         |
| Bicep / Terraform Code   | GPT-5.4                           | Code generation           |
| Deploy                   | GPT-5.4                           | Deployment execution      |
| As-Built                 | GPT-5.4                           | Documentation generation  |
| Diagnose                 | Claude Opus 4.6                   | Complex troubleshooting   |
| Context Optimizer        | Claude Opus 4.6                   | Deep analysis             |
| Challenger wrapper       | GPT-5.4                           | Review orchestration      |
| Subagents                | Claude Sonnet 4.6 / GPT-5.3-Codex | Isolated validation       |

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

| Subagent                        | Parent Agent        | Purpose                                              |
| ------------------------------- | ------------------- | ---------------------------------------------------- |
| `challenger-review-subagent`    | All workflow agents | Adversarial review (comprehensive + rotating lenses) |
| `cost-estimate-subagent`        | Architect           | Pricing MCP queries                                  |
| `governance-discovery-subagent` | IaC Planner         | Azure Policy REST API discovery                      |
| `bicep-validate-subagent`       | Bicep Code          | Lint + AVM/security code review                      |
| `bicep-whatif-subagent`         | Bicep Deploy        | `az deployment group what-if`                        |
| `terraform-validate-subagent`   | Terraform Code      | Lint + AVM-TF/security code review                   |
| `terraform-plan-subagent`       | Terraform Deploy    | `terraform plan` change preview                      |

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
- **GPT family**: any value containing `GPT-5.4`, `GPT-5.3-Codex`, or `GPT-4o`

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

#### Reasoning Effort

Add an HTML comment after the first `#` heading:

```markdown
<!-- Recommended reasoning_effort: high -->
```

Use `high` for planning/architecture agents, `medium` for execution/validation agents.

#### Language Calibration

- Keep absolute language (`MUST`, `NEVER`, `HARD RULE`) at: approval gates,
  security baseline (TLS/HTTPS/MI), governance compliance, ONE-SHOT gates
- Prefer direct phrasing elsewhere: "Do X" instead of "You MUST always do X"
- Remove duplicate emphasis where adjacent prose already conveys the same rule

### GPT-Specific Patterns

Sources: OpenAI prompt engineering documentation, GPT-5.4 system prompt guidance.

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
frontmatter `model:` value. If the agent uses `GPT-5.4`, the prompt must too.

Run `npm run lint:model-alignment` to catch mismatches.

#### Few-Shot Examples

For agents making routing or scoring decisions, add one structured example
in `<example>` tags (Claude) or a fenced block (GPT) showing:

- Input state
- Decision logic
- Expected output format

Keep examples under 12 lines. Place them at the end of the agent body.

[claude-guide]: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
