---
description: "Standards for Copilot custom agent definition files"
applyTo: "**/*.agent.md"
---

# Agent Definition Standards

These instructions apply to custom agent definition files (for example: `.github/agents/*.agent.md`).

Goals:

- Keep agent behavior consistent and predictable across the repo
- Avoid drift between agents and the authoritative standards in `.github/instructions/`
- Prevent invalid YAML front matter and broken internal links

## Front Matter (Required)

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

### `name`

- Clear, human-friendly display name.
- Keep it stable (renames can confuse users and docs).

### `description`

- Describe what the agent does, and what it does NOT do.
- Mention any required standards (WAF, AVM-first, default regions) if applicable.
- **MUST be a single-line inline string** — NOT a YAML block scalar (`>`, `>-`, `|`, `|-`).
  Block scalars break VS Code prompts-diagnostics-provider and silently degrade discovery.

### `tools`

- List only tool identifiers that are actually available in the environment.
- Prefer patterns when supported (for example: `azure-pricing/*`, `azure-mcp/*`).
- If the agent should not call tools, set `tools: []` explicitly.
- Use `agent` (not `agent/runSubagent`) as the tool ID for subagent delegation.
- For long tool lists, prefer multi-line YAML arrays for readability:

```yaml
tools: [read/readFile, edit/createFile, agent, "azure-mcp/*"]
```

### `argument-hint`

- Optional hint text shown in the chat input field to guide users.
- Keep it short and action-oriented (for example: `Describe the Azure workload you want to deploy`).

### `agents`

- List agent names available as subagents (must match `name` from target agent's frontmatter).
- Use `*` to allow all agents, or `[]` to prevent any subagent use.
- If `agents` is set, the `agent` tool MUST be included in `tools`.
- **Override rule**: Explicitly listing an agent in `agents` overrides that agent's
  `disable-model-invocation: true`. This lets coordinator agents access protected subagents.

### `handoffs`

- Use `handoffs` to connect workflow steps (for example: Architect -> Bicep Plan -> Bicep Code).
- Only reference agents that actually exist in the repo.
- Use Title Case for the `agent` value matching the agent's display `name` (from frontmatter).
  For example: `agent: Architect` (matching `name: Architect` in frontmatter).
- Do not set `model` on individual handoff entries unless the target agent requires a specific
  model that differs from the agent's own frontmatter `model` value.

### `user-invocable`

- Boolean (default `true`). Controls whether the agent appears in the agents dropdown.
- Set to `false` for subagents that should only be called by other agents.

### `disable-model-invocation`

- Boolean (default `false`). Prevents the agent from being invoked as a subagent by other agents.
- Use when an agent should only be directly user-invoked, never delegated to.

### `model`

**Model selection is intentional and must not be changed without explicit approval.**

Agents that specify `Claude Opus 4.6` as priority model do so deliberately:

- **Opus-first agents** (requirements, architect, bicep-plan, bicep-code) require advanced
  reasoning for accurate planning decisions, WAF assessments, governance discovery, and
  high-quality code generation
- **GPT-5.3-Codex agents** (deploy, as-built, subagents) prioritize speed for execution,
  documentation generation, and isolated validation tasks

Current model assignments:

| Agent        | Model                      | Rationale            |
| ------------ | -------------------------- | -------------------- |
| Requirements | Opus 4.6                   | Deep understanding   |
| Architect    | Opus 4.6                   | WAF analysis + cost  |
| Design       | GPT-5.3-Codex              | Diagram generation   |
| Bicep Plan   | Opus 4.6                   | Efficient planning   |
| Bicep Code   | Opus 4.6 / Sonnet 4.6      | Code generation      |
| Deploy       | Sonnet 4.6                 | Deployment execution |
| As-Built     | GPT-5.3-Codex              | Documentation gen    |
| Challenger   | GPT-5.4                    | Deep adversarial     |
| Subagents    | GPT-5.3-Codex / Sonnet 4.6 | Fast validation      |

**Rules:**

1. **Never reorder models** to put a speed-optimized model before Opus if Opus is currently first
2. **Planning accuracy trumps cost/speed** — incorrect plans waste more resources than Opus costs
3. When adding `model` arrays, match the pattern of similar workflow-stage agents
4. Document any model changes in PR description with justification

## Agent Hierarchy

### Top-Level Agents

Top-level agents live in `.github/agents/` and are `user-invocable: true`. They correspond to
the 7-step workflow:

| Step | Agent                | File                             |
| ---- | -------------------- | -------------------------------- |
| 1    | Requirements         | `02-requirements.agent.md`       |
| 2    | Architect            | `03-architect.agent.md`          |
| 3    | Design (optional)    | `04-design.agent.md`             |
| 4b   | Bicep Plan           | `05b-bicep-planner.agent.md`     |
| 5b   | Bicep Code           | `06b-bicep-codegen.agent.md`     |
| 6b   | Bicep Deploy         | `07b-bicep-deploy.agent.md`      |
| 4t   | Terraform Plan       | `05t-terraform-planner.agent.md` |
| 5t   | Terraform Code       | `06t-terraform-codegen.agent.md` |
| 6t   | Terraform Deploy     | `07t-terraform-deploy.agent.md`  |
| 7    | As-Built             | `08-as-built.agent.md`           |
| —    | InfraOps Conductor   | `01-conductor.agent.md`          |
| —    | Diagnose             | `09-diagnose.agent.md`           |
| —    | Challenger (wrapper) | `10-challenger.agent.md`         |

### Subagents

Subagents live in `.github/agents/_subagents/` and are `user-invocable: false`. They isolate
expensive or specialized work from their parent agent's context window.

| Subagent                           | Parent Agent                | Purpose                                                 |
| ---------------------------------- | --------------------------- | ------------------------------------------------------- |
| `challenger-review-subagent`       | All workflow agents         | Adversarial review pass 1 / comprehensive (GPT-5.4)     |
| `challenger-review-codex-subagent` | All workflow agents         | Adversarial review passes 2-3 (GPT-5.3-Codex)           |
| `challenger-review-batch-subagent` | All workflow agents         | Batched passes 2+3 for complex projects (GPT-5.3-Codex) |
| `cost-estimate-subagent`           | Architect                   | Pricing MCP queries                                     |
| `governance-discovery-subagent`    | Bicep Plan / Terraform Plan | Azure Policy REST API discovery                         |
| `bicep-lint-subagent`              | Bicep Code                  | `bicep build` + `bicep lint`                            |
| `bicep-review-subagent`            | Bicep Code                  | AVM/security/naming code review                         |
| `bicep-whatif-subagent`            | Bicep Deploy                | `az deployment group what-if`                           |
| `terraform-lint-subagent`          | Terraform Code              | `terraform fmt` + `terraform validate`                  |
| `terraform-review-subagent`        | Terraform Code              | AVM-TF/security/naming code review                      |
| `terraform-plan-subagent`          | Terraform Deploy            | `terraform plan` change preview                         |

Subagent definition rules:

- Set `user-invocable: false` — subagents are never called directly by users.
- Set `agents: []` — subagents do not chain to other agents.
- Keep tool lists minimal — only the tools needed for their specific task.
- Use `GPT-5.3-Codex` as the default model for fast, isolated execution.
- Return structured results (PASS/FAIL, APPROVED/NEEDS_REVISION, etc.) so the parent
  agent can act on the verdict without parsing free-form text.

### Deprecated: `infer`

The `infer` field is deprecated. Use `user-invocable` and `disable-model-invocation` instead.
If any agent still uses `infer`, migrate it to the new fields.

## Shared Defaults (Required)

All top-level workflow agents in `.github/agents/` MUST read the `azure-defaults` skill for shared
knowledge. Include a reference near the top of the agent body:

```text
Read `.github/skills/azure-defaults/SKILL.md` FIRST for regional standards, naming conventions,
security baseline, and workflow integration patterns common to all agents.
```

## Subagent Delegation Pattern

When an agent delegates work to a subagent, follow this pattern:

1. **Prepare inputs** — compile the data the subagent needs (resource list, file paths, etc.)
2. **Delegate** — call the subagent with a clear prompt containing the inputs
3. **Receive structured result** — the subagent returns a verdict/report
4. **Integrate** — use the subagent's output in the parent agent's artifact

**Context isolation**: Subagents don't inherit parent instructions or conversation
history. They receive only the task prompt. Pass all required context explicitly.
VS Code can run multiple subagents in parallel when tasks are independent.

## Authoritative Standards (Avoid Drift)

When an agent outputs a specific document type, it MUST treat these as authoritative:

- Cost estimates: `.github/instructions/cost-estimate.instructions.md`
- Workload docs: `.github/instructions/workload-documentation.instructions.md`
- Markdown style: `.github/instructions/markdown.instructions.md`
- Bicep: `.github/instructions/bicep-code-best-practices.instructions.md`

If an agent contains an embedded template in its body, it MUST match the relevant instruction file.

## Templates in Agent Bodies

- Prefer short templates that are easy to keep aligned with standards.
- If you include fenced code blocks inside a fenced template, use quadruple fences (` ```` `)
  for the outer fence to avoid accidental termination.
- Keep example templates realistic, but do not hardcode secrets, subscription IDs, or tenant IDs.

## Body Content Guidelines

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

## Links

- Prefer relative links for repo content.
- Verify links resolve from the agent file's directory (relative paths in Markdown are file-relative).
- Avoid linking to files that don't exist.

## Writing Style

- Use ATX headings (`##`, `###`).
- Keep markdown lines <= 120 characters.
- Use tables for decision matrices, comparisons, and checklists.

## Quick Self-Check (Before PR)

- `tools:` uses `agent` (not the deprecated `agent/runSubagent`) for subagent delegation
- `tools:` only contains valid tool IDs/patterns
- `handoffs:` only references real agents (including As-Built for Step 7)
- Handoff entries do not redundantly set `model` when the target agent already defines it
- The `azure-defaults` skill reference is correct
- Subagent files set `user-invocable: false` and `agents: []`
- Embedded templates match `.github/instructions/*` standards
- `npm run lint:md` passes
