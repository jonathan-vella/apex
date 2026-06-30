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

After Step 1 (Requirements), read `decisions.complexity` from `apex-recall show <project> --json`.
If missing (old sessions), default to `"standard"`.

When dispatching Steps 2, 4, 5, and 6, the Orchestrator defaults to **1-pass comprehensive review**.
Multi-pass adversarial review is **opt-in** — at each gate, check `decisions.complexity`:

- **simple/standard**: Present single-pass result directly. Do not prompt for additional review.
- **complex**: Ask the user: _"Run additional adversarial review? (recommended for complex projects)"_
  If the user opts in, use the full complexity matrix from `adversarial-review-protocol.md`.
  If declined, proceed with the single-pass result.

**Runtime validation**: `opt_in_matrix` MAY contain a subset of `{simple,
standard, complex}` — a missing tier means "no recommended multi-pass shape
for that tier; default single-pass comprehensive applies". Treat a missing
entry as a fall-through to default behaviour, not as a STOP condition.
Only stop and ask the user to classify the project when `decisions.complexity`
itself is unset AND the session has progressed past Step 1.

**Write `00-handoff.md` at every gate before presenting it to the user.**
See [Phase Handoff Document](#phase-handoff-document) for the format.
This enables the user to start a fresh chat thread at any gate without losing context.

### Gate 1: After Requirements

```text
📋 REQUIREMENTS COMPLETE
Artifact: agent-output/{project}/01-requirements.md
🔍 Challenger Review: ✓ {N} accepted, ✗ {N} rejected, ⏸ {N} deferred (of {total} findings)
   Findings: agent-output/{project}/challenge-findings-requirements.json
   Decisions: agent-output/{project}/challenge-findings-requirements-decisions.json
✅ Next: Architecture Assessment (Step 2)
❓ Review requirements (and any Challenger findings) and confirm to proceed
```

**Challenger Review line format**:

- **When a `challenge-findings-{type}-decisions.json` sidecar exists** (per the
  Per-Finding Decision Protocol in
  `.github/skills/azure-defaults/references/adversarial-review-protocol.md`):
  show `✓ {accepted}, ✗ {rejected}, ⏸ {deferred} (of {total} findings)` —
  counts derived from `decisions[].action`.
- **Legacy / pre-protocol artifacts** (no sidecar): fall back to
  `{PASS | ⚠️ {N} must-fix / {N} should-fix findings}`.

**Gate 1 must include Challenger findings.** If the Requirements agent did not run
`challenger-review-subagent`, invoke it now before presenting this gate.

### Gate 2: After Architecture

```text
🏗️ ARCHITECTURE ASSESSMENT COMPLETE
Artifact: agent-output/{project}/02-architecture-assessment.md
Cost Estimate: agent-output/{project}/03-des-cost-estimate.md
✅ Next: Governance Discovery (Step 3.5) or Design Artifacts (Step 3, optional)
💡 SESSION BREAK RECOMMENDED: Context is growing. Consider opening a fresh chat,
   switching the chat agent picker to `01-Orchestrator`, and sending
   `resume <project>` to continue from Step 3.5.
❓ Review WAF assessment and confirm to proceed (same session or fresh chat)
```

### Gate 2.5: After Governance

```text
🔒 GOVERNANCE DISCOVERY COMPLETE
Artifact: agent-output/{project}/04-governance-constraints.md
JSON: agent-output/{project}/04-governance-constraints.json
Blockers: {N} Deny policies | Warnings: {N} Audit policies
🔍 Challenger Review: ✓ {N} accepted, ✗ {N} rejected, ⏸ {N} deferred (of {total} findings)
   Decisions: agent-output/{project}/challenge-findings-governance-decisions.json
✅ Next: Implementation Planning (Step 4)
❓ Review governance constraints and confirm to proceed
```

Use the same sidecar-aware / legacy fallback rule documented under Gate 1.

### Gate 3: After Planning

```text
📝 IMPLEMENTATION PLAN COMPLETE
Artifact: agent-output/{project}/04-implementation-plan.md
Dependency Diagram: agent-output/{project}/04-dependency-diagram.drawio
Runtime Diagram: agent-output/{project}/04-runtime-diagram.drawio
Deployment: {Phased (N phases) | Single}
✅ Next: IaC Implementation (Step 5)
💡 SESSION BREAK RECOMMENDED: Start a fresh chat for IaC code generation.
   Switch the chat agent picker to `01-Orchestrator` and send
   `resume <project>` — context restores via `apex-recall show`.
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

The orchestrator (`01-Orchestrator`) runs
at **codex** tier. Per the VS Code [subagent cost-tier rule](https://code.visualstudio.com/docs/copilot/agents/subagents),
`#runSubagent` cannot raise the subagent above the parent's tier — higher-tier
targets silently fall back to codex.

For this reason, **all step delegation by the orchestrator uses handoff
buttons** — never `#runSubagent`. Step agents own their own subagent calls
(cost-estimate, validate, what-if/plan, challenger), and run those at their
own tiers (medium / high), which stay within the tier ceiling because step
agents themselves run at medium or high.

### Step → Handoff Button (orchestrator → step agent)

| Step | Handoff button label                                                        | Notes                                 |
| ---- | --------------------------------------------------------------------------- | ------------------------------------- |
| 1    | `Step 1: Gather Requirements`                                               | Uses `askQuestions` in Phases 1–4     |
| 2    | `Step 2: Architecture Assessment`                                           | —                                     |
| 3    | `Step 3: Design Artifacts`                                                  | Optional                              |
| 3.5  | `Step 3.5: Governance Discovery`                                            | —                                     |
| 4    | `Step 4: Implementation Plan` (Bicep) **or** `Step 4: IaC Plan (Terraform)` | Routed by `decisions.iac_tool`        |
| 5    | `Step 5: Generate Bicep` / `Step 5: Generate Terraform`                     | Routed by `decisions.iac_tool`        |
| 6    | `Step 6: Deploy` / `Step 6: Deploy (Terraform)`                             | Routed by `decisions.iac_tool`        |
| 7    | `Step 7: As-Built Documentation`                                            | —                                     |
| —    | `🔍 Run Challenger Review`                                                  | Surface at any gate that needs review |

**Handoff Presentation Rule**: When directing the user to click a handoff
button, refer to it by its **exact label** as shown in the UI (e.g.,
_"Click **Step 1: Gather Requirements** below to start."_). Do NOT add
agent names, arrows, or internal references like "→ @02-Requirements" —
these are invisible to the user and create confusion.

### `#runSubagent` Inside Step Agents (allowed)

Step agents themselves are free to use `#runSubagent` for the helper
subagents that match their own tier or below:

| Step agent (tier)               | Subagents it dispatches via `#runSubagent`                        |
| ------------------------------- | ----------------------------------------------------------------- |
| 02-Requirements (Sonnet 5)      | challenger-review-subagent (GPT-5.5 — within ceiling)             |
| 03-Architect (Opus)             | cost-estimate-subagent (codex), challenger-review-subagent        |
| 05-IaC Planner (Opus)           | challenger-review-subagent                                        |
| 06b-Bicep CodeGen (Sonnet 5)    | bicep-validate-subagent, bicep-whatif-subagent (Sonnet 5)         |
| 06t-Terraform CodeGen (Sonnet 5)| terraform-validate-subagent, terraform-plan-subagent (Sonnet 5)   |
| 07b-Bicep Deploy (GPT-5.5)      | bicep-whatif-subagent (Sonnet 5)                                  |
| 07t-Terraform Deploy (GPT-5.5)  | terraform-plan-subagent (Sonnet 5)                                |
| 04g-Governance (GPT-5.5)        | challenger-review-subagent                                        |

**NEVER call `#runSubagent` from within an agent for a target that needs
`askQuestions`.** The `askQuestions` tool presents interactive UI panels
that require direct user participation. Subagents run autonomously and
cannot present these panels — questions will be silently skipped,
producing low-quality artifacts with fabricated defaults.

### Subagent Integration

For the full subagent matrix, read `.github/skills/workflow-engine/references/subagent-integration.md`.
Key points: Challenger runs 1-pass comprehensive review by default at Steps 1, 2, 4, 5, 6;
multi-pass rotating lens reviews are opt-in for complex projects; cost-estimate-subagent handles pricing
at Steps 2 and 7; the `azure-governance-discovery` skill runs at Step 3.5 (Governance agent).

**Pricing Accuracy Gate (Steps 2 & 7)**: All prices must originate from
`cost-estimate-subagent` (Codex + Azure Pricing MCP). Never write dollar
figures from parametric knowledge.
