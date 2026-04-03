<!-- ref:orchestrator-handoff-guide-v1 -->

# Orchestrator Handoff Guide

Gate templates, delegation rules, and handoff presentation rules
for the Orchestrator agent.

## Approval Gates

### IaC Routing Logic

Read `iac_tool` from `agent-output/{project}/01-requirements.md` before routing Steps 4-6:

| `iac_tool` value  | Step 4 Agent     | Step 5 Agent            | Step 6 Agent           |
| ----------------- | ---------------- | ----------------------- | ---------------------- |
| `Bicep` (default) | `05-IaC Planner` | `06b-Bicep CodeGen`     | `07b-Bicep Deploy`     |
| `Terraform`       | `05-IaC Planner` | `06t-Terraform CodeGen` | `07t-Terraform Deploy` |

> If `01-requirements.md` does not exist when the user enters at Step 4 directly, ask once:
> "Should I use **Bicep** or **Terraform**?" (default: Bicep). This is the ONLY scenario
> where the Orchestrator asks about IaC tool. In normal flow, Requirements Phase 2 captures it.

### Complexity Routing

After Step 1 (Requirements), read `decisions.complexity` from `00-session-state.json`.
If missing (old sessions), default to `"standard"`.

When dispatching Steps 2, 4, 5, and 6, the Orchestrator defaults to **1-pass comprehensive review**.
Multi-pass adversarial review is **opt-in** — at each gate, check `decisions.complexity`:

- **simple/standard**: Present single-pass result directly. Do not prompt for additional review.
- **complex**: Ask the user: _"Run additional adversarial review? (recommended for complex projects)"_
  If the user opts in, use the full complexity matrix from `adversarial-review-protocol.md`.
  If declined, proceed with the single-pass result.

**Runtime validation**: If `complexity_matrix` key in `workflow-graph.json` does not contain an
entry for the current complexity value, STOP with error and ask user to classify the project.

**Write `00-handoff.md` at every gate before presenting it to the user.**
See [Phase Handoff Document](#phase-handoff-document) for the format.
This enables the user to start a fresh chat thread at any gate without losing context.

### Gate 1: After Requirements

```text
📋 REQUIREMENTS COMPLETE
Artifact: agent-output/{project}/01-requirements.md
🔍 Challenger Review: {PASS | ⚠️ {N} must-fix / {N} should-fix findings}
   Findings: agent-output/{project}/challenge-findings-requirements.json
✅ Next: Architecture Assessment (Step 2)
❓ Review requirements (and any Challenger findings) and confirm to proceed
```

**Gate 1 must include Challenger findings.** If the Requirements agent did not run
`challenger-review-subagent`, invoke it now before presenting this gate.

### Gate 2: After Architecture

```text
🏗️ ARCHITECTURE ASSESSMENT COMPLETE
Artifact: agent-output/{project}/02-architecture-assessment.md
Cost Estimate: agent-output/{project}/03-des-cost-estimate.md
✅ Next: Governance Discovery (Step 3.5) or Design Artifacts (Step 3, optional)
💡 SESSION BREAK RECOMMENDED: Context is growing. Consider opening a fresh chat
   and running @01-Orchestrator with the project name to resume from Step 3.5.
❓ Review WAF assessment and confirm to proceed (same session or fresh chat)
```

### Gate 2.5: After Governance

```text
🔒 GOVERNANCE DISCOVERY COMPLETE
Artifact: agent-output/{project}/04-governance-constraints.md
JSON: agent-output/{project}/04-governance-constraints.json
Blockers: {N} Deny policies | Warnings: {N} Audit policies
🔍 Challenger Review: {PASS | ⚠️ {N} must-fix / {N} should-fix findings}
✅ Next: Implementation Planning (Step 4)
❓ Review governance constraints and confirm to proceed
```

### Gate 3: After Planning

```text
📝 IMPLEMENTATION PLAN COMPLETE
Artifact: agent-output/{project}/04-implementation-plan.md
Dependency Diagram: agent-output/{project}/04-dependency-diagram.drawio
Runtime Diagram: agent-output/{project}/04-runtime-diagram.drawio
Deployment: {Phased (N phases) | Single}
✅ Next: IaC Implementation (Step 5)
💡 SESSION BREAK RECOMMENDED: Start a fresh chat for IaC code generation.
   Run @01-Orchestrator with the project name — context restores from 00-session-state.json.
❓ Review plan and confirm to proceed (same session or fresh chat)
```

### Gate 4: After Implementation

```text
🔍 IMPLEMENTATION COMPLETE
Templates: infra/bicep/{project}/ (Bicep) or infra/terraform/{project}/ (Terraform)
Reference: agent-output/{project}/05-implementation-reference.md
✅ Next: Azure Deployment (Step 6)
❓ Confirm to deploy (Deploy agent runs preflight automatically)
```

### Gate 5: After Deployment

```text
🚀 DEPLOYMENT COMPLETE
Summary: agent-output/{project}/06-deployment-summary.md
✅ Next: Documentation Generation (Step 7)
❓ Verify deployment and confirm to generate docs
```

## Phase Handoff Document

At every approval gate, write `agent-output/{project}/00-handoff.md`
**before presenting the gate** (compact state snapshot for thread resumption).

### Format

Header: `# {Project} — Handoff (Step {N} complete)` with metadata line (`Updated: {ISO} | IaC: {tool} | Branch: {branch}`).

**Required H2 sections:**

- `## Completed Steps` — checklist with artifact paths (e.g., `- [x] Step 1 → agent-output/{project}/01-requirements.md`)
- `## Key Decisions` — region, compliance, budget, IaC tool, architecture pattern
- `## Open Challenger Findings (must_fix only)` — unresolved must_fix titles or "None"
- `## Context for Next Step` — 1-3 sentences for next agent
- `## Skill Context` — pre-extracted facts from skills so step agents
  can skip re-reading skill files (region, tags, naming_prefix, security
  baseline, AVM-first, complexity, review matrix row)
- `## Artifacts` — bulleted list of files in `agent-output/{project}/` and `infra/`

**Rules**: Overwrite on each gate · paths only (never embed content) · under 60 lines · only unresolved must_fix items.

## Step Delegation

### Interactive Steps (use handoffs, NOT `#runSubagent`)

Steps that call `askQuestions` to interact with the user **cannot run as
subagents** — subagents are autonomous and have no access to the
`askQuestions` UI. These steps MUST be delegated via **handoff buttons**
so the user interacts directly with the step agent:

- **Step 1 (Requirements)** — uses `askQuestions` in Phases 1-4
- **Step 4 (IaC Plan)** — uses `askQuestions` for Deployment Strategy Gate

For these steps, present the handoff button and let the user click it.
Do NOT call `#runSubagent` with the step agent name. Do NOT pre-fill
answers or add "do not ask questions" to the prompt.

**Handoff Presentation Rule**: When directing the user to click a handoff
button, refer to it by its **exact label** as shown in the UI (e.g.,
_"Click **Step 1: Gather Requirements** below to start."_). Do NOT add
agent names, arrows, or internal references like "→ @02-Requirements" —
these are invisible to the user and create confusion.

### Autonomous Steps (use `#runSubagent`)

Steps that work from existing artifacts without user interaction can be
delegated via `#runSubagent`:

- **Step 2 (Architecture)** — reads `01-requirements.md`, produces assessment
- **Step 3 (Design)** — optional, reads architecture, produces diagrams
- **Step 5 (IaC Code)** — reads plan, generates templates
- **Step 6 (Deploy)** — runs deployment scripts
- **Step 7 (As-Built)** — reads all prior artifacts, generates docs

Step→Agent mapping follows the handoff labels above;
Terraform path (Steps 4†/5†/6†) used when
`iac_tool: Terraform` in `01-requirements.md`.

**NEVER call `#runSubagent` for an agent that needs `askQuestions`.**
The `askQuestions` tool presents interactive UI panels that require
direct user participation. Subagents run autonomously and cannot
present these panels — the questions will be silently skipped,
producing low-quality artifacts with fabricated defaults.

### Subagent Integration

For the full subagent matrix, read `.github/skills/workflow-engine/references/subagent-integration.md`.
Key points: Challenger runs 1-pass comprehensive review by default at Steps 1, 2, 4, 5, 6;
multi-pass rotating lens reviews are opt-in for complex projects; cost-estimate-subagent handles pricing
at Steps 2 and 7; governance-discovery-subagent runs at Step 3.5 (Governance agent).

**Pricing Accuracy Gate (Steps 2 & 7)**: All prices must originate from
`cost-estimate-subagent` (Codex + Azure Pricing MCP). Never write dollar
figures from parametric knowledge.
