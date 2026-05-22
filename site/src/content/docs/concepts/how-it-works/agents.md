---
title: "Agent Architecture"
description: "Agent roles, orchestration, and delegation model"
---

## Agent Anatomy

Every agent definition follows a standard structure:

```yaml
# Frontmatter
---
name: 06b-Bicep CodeGen
description: Expert Azure Bicep IaC specialist...
model: ["Claude Sonnet 4.6"] # (1)!
tools: [list of allowed tools] # (2)!
handoffs:
  - label: "Step 6: Deploy"
    agent: 07b-Bicep Deploy # (3)!
    prompt: "Deploy the Bicep templates..."
---
# Body (≤ 500 lines)
## MANDATORY: Read Skills First
1. **Read** `.github/skills/azure-defaults/SKILL.md` # (4)!
2. **Read** `.github/skills/azure-artifacts/SKILL.md`
```

1. Model selection — the Orchestrator can override this based on task complexity
2. Tool allowlist — agents only access tools they need
3. Handoff target — the next agent in the workflow
4. Skills are loaded on demand to preserve context budget

The frontmatter is machine-readable metadata. The body is the agent's full operating
manual — the runtime loads it into the system prompt at invocation.

### Tools

Agents interact with external systems through **tools** — structured interfaces provided
by MCP servers and the VS Code runtime. Each agent's frontmatter declares a `tools:`
allowlist that restricts which tools it can call. Common tool categories:

- **MCP tools**: Cloud API wrappers (Azure pricing queries, GitHub operations, Terraform registry lookups)
- **File tools**: Read and write workspace files (create artifacts, read prior step outputs)
- **Terminal tools**: Execute CLI commands (Bicep build, Terraform validate, Azure CLI)
- **Subagent tools**: Delegate to specialised subagents via `#runSubagent`

### Handoffs

Agents do not communicate directly. Instead, each agent produces **artifact files**
in `agent-output/{project}/` that the next agent reads as input. The Orchestrator
orchestrates this by delegating to one agent at a time, collecting its output,
and routing to the next step. At approval gates, the Orchestrator writes a
`00-handoff.md` summary document that enables session resume.

## Top-Level Agents

| Agent                 | Role                                            | Primary Skills                                 |
| --------------------- | ----------------------------------------------- | ---------------------------------------------- |
| 01-Orchestrator       | Master orchestrator                             | workflow-engine, apex-recall                   |
| 02-Requirements       | Captures project requirements                   | azure-defaults, azure-artifacts                |
| 03-Architect          | WAF assessment and cost estimation              | azure-defaults                                 |
| 04-Design             | Diagrams and ADRs                               | drawio, python-diagrams, azure-adr             |
| 04g-Governance        | Policy discovery and compliance                 | azure-defaults                                 |
| 05-IaC Planner        | IaC implementation planning (Bicep & Terraform) | azure-bicep-patterns, terraform-patterns       |
| 06b-Bicep CodeGen     | Bicep template generation                       | azure-bicep-patterns                           |
| 06t-Terraform CodeGen | Terraform configuration generation              | terraform-patterns                             |
| 07b-Bicep Deploy      | Bicep deployment execution                      | azure-validate, iac-common                     |
| 07t-Terraform Deploy  | Terraform deployment execution                  | azure-validate, iac-common, terraform-patterns |
| 08-As-Built           | Post-deployment documentation                   | azure-artifacts, drawio, python-diagrams       |
| 09-Diagnose           | Azure resource troubleshooting                  | azure-diagnostics                              |
| 10-Challenger         | Standalone adversarial review                   | —                                              |
| 11-Context Optimizer  | Context window audit and optimisation           | context-management                             |
| e2e-orchestrator      | Prompt-invoked end-to-end validation driver     | workflow-engine, apex-recall                   |

For a live, always-current roster, see the
[Architecture Explorer](../../../reference/architecture-explorer/). The count is
computed from `tools/registry/count-manifest.json` and the source of truth is the
`.github/agents/*.agent.md` files on disk.

## First-run project decisions (`iac_tool`, `review_depth`)

The **01-Orchestrator** captures two project-scoped decisions the first
time a project boots (or during the first approval gate after `apex-recall
init`). Both are persisted to `apex-recall` and **never re-asked** —
every downstream agent reads them via `apex-recall show <project>
--json`.

| Decision        | Default                                              | When asked                             | Persistence key         |
| --------------- | ---------------------------------------------------- | -------------------------------------- | ----------------------- |
| `iac_tool`      | none (must be chosen)                                | Step 1 (Requirements), Phase 2         | `decisions.iac_tool`    |
| `review_depth`  | `default` — single-pass `comprehensive` (recommended) | Project boot or first gate after init  | `decisions.review_depth` |

**`review_depth` values**:

- `default` — one comprehensive challenger pass at Steps 1, 2, 4 (plus
  `governance-reconciliation` at Step 3.5). Right for most workshops,
  MVPs, and single-region projects.
- `deep` — rotating-lens multi-pass cascade per
  [`adversarial-review-protocol.md`](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/skills/azure-defaults/references/adversarial-review-protocol.md)
  (Pass 1 security-governance → Pass 2 architecture-reliability →
  conditional Pass 3 cost-feasibility). Worth the ~3× challenger
  cost for regulated workloads (HIPAA/PCI), prod migrations, or
  multi-region designs.

**Changing the value later** — `01-Orchestrator` writes once and never
re-prompts. To switch a project from `default` to `deep` (or vice
versa) after boot, edit the persisted decision directly:

```bash
apex-recall decide <project> --key review_depth --value deep --rationale "Escalated to deep review after Step 2 reliability gap" --json
```

Alternatively, escalate a **single** artifact without flipping the
whole project by invoking the `10-Challenger` user-invocable agent
manually — it runs the rotating-lens passes against one file on
demand.

Authoritative contract: [01-orchestrator.agent.md
→ `Computing decisions.review_depth`](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/.github/agents/01-orchestrator.agent.md#computing-decisionsreview_depth-project-scoped-opt-in).

## Per-Step User Gates (Architect, Design, Governance)

Each user-facing step raises a small, predictable set of questions
before continuing to the next step. The questions exist to keep
creative AI decisions in the user's hands; the agent never
silently assumes a non-default value.

| Step | Gate                              | Question type                                                    | Decision key recorded               |
| ---- | --------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| 2    | SKU confirmation (before pricing) | Approve / Revise / Discuss                                       | `sku_confirmation_status`           |
| 2    | Budget gate (after pricing)       | Approve / Revise SKUs / Revise requirements                      | `budget_decision`                   |
| 2    | Per-finding decisions             | Accept / Skip / Defer (one question per finding — never batched) | `decision_log`                      |
| 3    | Diagram tool choice (one-time)    | Draw.io (default) / Python diagrams                              | `diagram_tool`                      |
| 3.5  | Phase 2.7 resolution              | RG tag keys + casing, allowed locations (two questions)          | `tag_contract`, `governance_status` |

The full registry of valid decision keys lives at
`tools/apex-recall/docs/decision-keys.md`; the validator
`tools/scripts/validate-decision-keys.mjs` enforces that every
`apex-recall decide --key` reference in an agent file appears in the
registry.

**Tag schema (greenfield projects)**: when Governance Discovery finds
no tag policy at any inherited scope, projects use the lowercase
`environment, owner, costcenter, project` set per CAF tag-strategy
guidance (see `.github/skills/azure-defaults/references/tag-strategy.md`).
The legacy PascalCase 4-tag set (`Environment`, `ManagedBy`,
`Project`, `Owner`) is a deprecated convention retained only for
backward compatibility on existing projects.

**SKU manifest MD ↔ JSON sync**: the human-readable
`agent-output/{project}/sku-manifest.md` is rendered deterministically
from `sku-manifest.json` via
`node tools/scripts/render-sku-manifest-md.mjs <project>`. Agents
mutate the JSON; the renderer (wired into `lefthook` pre-commit and
CI) re-emits the MD. Hand-editing the MD is forbidden and reverted on
the next commit.

## Subagents

Subagents are not user-invocable. They are delegated to by parent agents for isolated,
specific tasks:

| Subagent                    | Purpose                            | Invoked By          |
| --------------------------- | ---------------------------------- | ------------------- |
| challenger-review-subagent  | Adversarial review of artifacts    | Steps 1, 2, 4, 5, 6 |
| cost-estimate-subagent      | Azure Pricing MCP queries          | Steps 2, 7          |
| bicep-validate-subagent     | Lint + AVM/security code review    | Step 5 (Bicep)      |
| bicep-whatif-subagent       | `az deployment what-if` preview    | Step 6 (Bicep)      |
| terraform-validate-subagent | Lint + AVM-TF/security code review | Step 5 (Terraform)  |
| terraform-plan-subagent     | `terraform plan` preview           | Step 6 (Terraform)  |

## The Challenger Pattern

:::note[Adversarial Review]
The Challenger finds what everyone else missed — untested assumptions,
governance gaps, WAF blind spots, and architectural weaknesses.
:::

The `challenger-review-subagent` implements adversarial review at critical workflow steps.
It operates with rotating lenses:

:::note[Challenger Selection Rules]
Pass 1 (security-governance) always uses `challenger-review-subagent`.
Additional passes also use `challenger-review-subagent` for
architecture-reliability and cost-feasibility lenses.
See `.github/skills/azure-defaults/references/adversarial-review-protocol.md`
(`## Lenses`, `## Default flow`, `## Opt-in: Deep adversarial review`) for
the full routing table and conditional skip rules.
:::

- **1-pass review** (comprehensive): A single review covering all dimensions. This is the
  **default for all steps**. Used for requirements (Step 1), architecture (Step 2), deploy (Step 6),
  and optionally for planning (Step 4) and code (Step 5).
- **Multi-pass review** (rotating lenses, opt-in): Multiple separate reviews, each focused on a
  specific dimension (security, reliability, cost). Available for architecture (Step 2),
  planning (Step 4), and code (Step 5) when explicitly requested. Recommended for complex projects.

Findings are classified as `must_fix` (blocking) or `should_fix` (advisory). Only
`must_fix` findings block workflow progression.

**Conditional passes (when multi-pass is opted in)**: Pass 3 of the rotating lens review is
conditional — it only runs if Pass 2 returned ≥1 `must_fix` finding. If Pass 2 returns zero
`must_fix` items, Pass 3 is skipped entirely, saving approximately 4 minutes per review cycle.

**Context Shredding for Challenger Inputs**: The challenger is instructed to apply
context compression tiers when loading predecessor artefacts for review:

| Context Usage | Loading Strategy                                               |
| ------------- | -------------------------------------------------------------- |
| < 60%         | Full artefact                                                  |
| 60–80%        | Key H2 sections only (resource list, SKUs, WAF scores, budget) |
| > 80%         | Decision summary from `00-session-state.json` + resource list  |

:::caution[Reliability note]
The tier selection above depends on the LLM estimating its own context usage —
there is no runtime API to measure actual token consumption. The LLM may not
apply compression consistently. The **`compact_for_parent` carry-forward** (below)
is the part that reliably works because it is a structural contract in the
subagent's JSON output format, not a voluntary LLM behaviour.
:::

After each review pass, only the `compact_for_parent` string (~200 characters) is carried
forward — not the full JSON findings. This prevents context bloat across multi-pass reviews
and is enforced by the output schema.

:::tip[If a challenger review hangs]
If a review takes >10 minutes with no output, restart the chat session and
resume from the failed gate. Use `00-session-state.json` to verify the last
completed step.
:::

**New Challenger Checklists**: Two mandatory checklist categories were added:

- **Cost Monitoring**: Budget resource, forecast alerts at 80/100/120%, anomaly detection.
- **Repeatability**: Parameterised values, multi-tenant deploy, `projectName` required.

## Handoffs and Delegation

Agents communicate through artefact files, not direct message passing. The Orchestrator
delegates to a step agent, which produces output files in `agent-output/{project}/`.
The next agent reads those files as input. This design:

- Eliminates context leakage between agents
- Enables resume from any point (artefacts are persistent)
- Allows human review at every gate (artefacts are human-readable markdown)
- Supports parallel development of different steps

**Phase Handoff Document**: At each approval gate, the Orchestrator writes a
`00-handoff.md` file containing a summary of what was completed, key decisions
made, what comes next, and (at Gates 2 and 3) a session break recommendation.
This enables resume from any gate without needing to re-read all prior artefacts.

---

## Creating a Custom Agent

This section walks through creating a new agent from scratch.

### Step 1: Choose Agent Type and Model

| Type            | File Location                               | User-Invocable | Use When                                  |
| --------------- | ------------------------------------------- | -------------- | ----------------------------------------- |
| Top-level agent | `.github/agents/{name}.agent.md`            | Yes            | User-facing workflow steps                |
| Subagent        | `.github/agents/_subagents/{name}.agent.md` | No             | Isolated tasks delegated by parent agents |

Model selection depends on the task. Use `tools/registry/agent-registry.json` as the
source of truth, but the current repo pattern is:

- **Planning agents** (accuracy-first) — typically `Claude Opus 4.7` at high reasoning effort
- **Orchestrator** — `GPT-5.4 mini` with the OpenAI outcome-first prompting style
  (Role / Personality / Goal / Success / Constraints / Output / Stop). Standard
  tier suits handoff-only routing without creative generation.
- **Design + Code generation** — `Claude Sonnet 4.6` for Anthropic XML-tagged
  output contracts and stronger verbatim invariant retention (security baseline,
  AVM contract, HARD GATE language)
- **Governance + Challenger** — `GPT-5.5` for balanced execution quality with
  explicit retrieval budgets and stopping conditions
- **Execution, deploy, and validation subagents** — model varies; consult `tools/registry/agent-registry.json`
- **Adversarial review** — use a different model family than the artifact author when possible

### Step 2: Create the Agent File

Create a `.agent.md` file with the required frontmatter:

```yaml
---
name: My Custom Agent
description: >-
  One-line description of what this agent does.
  USE FOR: keyword triggers. DO NOT USE FOR: anti-triggers.
model:
  - GPT-5.5
tools:
  - read_file
  - create_file
  - replace_string_in_file
  - run_in_terminal
  - runSubagent
handoffs:
  - label: "Next Step"
    agent: next-agent-name
    prompt: "Hand off with context..."
---
```

Required frontmatter fields: `name`, `description`, `model`, `tools`.
Optional: `handoffs`, `user-invocable` (defaults to `true` for top-level).

See `.github/instructions/agent-authoring.instructions.md` for the
complete frontmatter specification.

### Step 3: Write the Agent Body

The body (below the frontmatter) is the agent's operating manual:

```markdown
## MANDATORY: Read Skills First

1. **Read** `.github/skills/azure-defaults/SKILL.md`

## DO (required behaviours)

- Always check for existing session state before starting
- Load skills progressively (SKILL.md first, then references/ on demand)

## DO NOT (prohibited behaviours)

- Do not skip approval gates
- Do not hardcode project-specific values
```

Keep the body under 350 lines. Use skill references for deep domain
knowledge rather than inlining it.

### Step 4: Register the Agent

Update the registry file:

1. **`tools/registry/agent-registry.json`** — add the agent's role, file path,
   model, and skill list

### Step 5: Validate

```bash
# Validate frontmatter syntax, body size, and language quality
npm run validate:agents

# Verify registry consistency
npm run validate:agent-registry
```

### Troubleshooting

| Problem                     | Cause                           | Fix                                                 |
| --------------------------- | ------------------------------- | --------------------------------------------------- |
| Agent not appearing in chat | Missing or invalid frontmatter  | Run `npm run validate:agents`                       |
| Tool not available          | Tool not in `tools:` allowlist  | Add the tool name to frontmatter                    |
| Handoff not triggering      | Wrong agent name in `handoffs:` | Verify target agent file exists                     |
| Skills not loading          | Typo in skill path              | Check path matches `.github/skills/{name}/SKILL.md` |

---

:::tip[Further Reading]

- [Core Concepts](../four-pillars/) — the four knowledge layers (agents, skills, instructions, registries)
- [Skills & Instructions](../skills-and-instructions/) — progressive skill loading and glob-based enforcement
- [Workflow Engine & Quality](../workflow-engine/) — DAG model, approval gates, circuit breakers
- [MCP Integration](../mcp-integration/) — MCP servers and their tool catalogs
- [Validation & Linting](../../../reference/validation-reference/) — all validation scripts and hooks

  :::
