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

### Review Routing

Read [workflow-graph.json](../templates/workflow-graph.json) and current
`apex-recall show <project> --json` evidence. Use `decisions.review_depth = "deep"`
or an explicit user request to opt into deep review, never complexity alone.
Reuse valid completed reviews; recover missing inputs and rerun invalidated reviews.
Step 2 always needs both architecture and separate independent cost-feasibility
reviews. Step 5 is opt-in; Step 6 has no Challenger review requirement.
Missing/stale evidence or unresolved blocking findings keep the gate closed.

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
  `.github/skills/apex-azure-defaults/references/adversarial-review-protocol.md`):
  show `✓ {accepted}, ✗ {rejected}, ⏸ {deferred} (of {total} findings)` —
  counts derived from `decisions[].action`.
- **Legacy / pre-protocol artifacts** (no sidecar): fall back to
  `{PASS | ⚠️ {N} must-fix / {N} should-fix findings}`.

**Gate 1 must include current Challenger findings.** If required review is missing,
STOP and request a human handoff to `10-Challenger`. The Orchestrator cannot invoke
reviewers. Never fabricate an inline review or treat a fallback display as approval.

### Gate 2: After Architecture

```text
🏗️ ARCHITECTURE ASSESSMENT COMPLETE
Artifact: agent-output/{project}/02-architecture-assessment.md
Cost Estimate: agent-output/{project}/03-des-cost-estimate.md
✅ Next: Governance Discovery (Step 3.5) or Design Artifacts (Step 3, optional)
💡 SESSION BREAK REQUIRED after approval: Open a fresh chat,
   switching the chat agent picker to `01-Orchestrator`, and sending
   `resume <project>` to continue from Step 3.5.
❓ Review WAF assessment, both reviews, and confirm the graph-selected next step
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
Dependency Diagram: agent-output/{project}/04-dependency-diagram.{py,png,svg}
Runtime Diagram: agent-output/{project}/04-runtime-diagram.{py,png,svg}
Deployment: {Phased (N phases) | Single}
✅ Next: IaC Implementation (Step 5)
💡 SESSION BREAK REQUIRED after approval: Start a fresh chat for IaC code generation.
   Switch the chat agent picker to `01-Orchestrator` and send
   `resume <project>` — context restores via `apex-recall show`.
❓ Review plan and required reviews, then confirm to proceed
```

### Gate 4: After Implementation

```text
🔍 IMPLEMENTATION COMPLETE
Templates: infra/bicep/{project}/ (Bicep) or infra/terraform/{project}/ (Terraform)
Reference: agent-output/{project}/05-implementation-reference.md
✅ Next: Azure Deployment (Step 6)
❓ Confirm handoff to Deploy; preflight, preview and evidence-bound final apply approval still follow
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
- `## Skill Context` — canonical guidance paths and current decision references;
  do not copy defaults or suppress missing required guidance recovery
- `## Artifacts` — bulleted list of files in `agent-output/{project}/` and `infra/`

**Rules**: Overwrite on each gate · paths only (never embed content) · under 60 lines · only unresolved must_fix items.

## Step Delegation

All production main agents, including `10-Challenger`, are human-selected
entry points with `disable-model-invocation: true`. The Orchestrator uses
human handoffs only (`agents: []`), never nested main-agent dispatch.
Frontmatter owns model assignments; names and catalog tiers do not establish
runtime cost-tier eligibility. Unknown or unsupported routing requires STOP,
not automatic model fallback. Local and Agent Host support need separate verification.

### Step → Handoff Button (orchestrator → step agent)

| Step | Handoff button label                                                        | Notes                                 |
| ---- | --------------------------------------------------------------------------- | ------------------------------------- |
| 1    | `Step 1: Gather Requirements`                                               | Uses `askQuestions` in Phases 1–4     |
| 2    | `Step 2: Architecture Assessment`                                           | —                                     |
| 3    | `Step 3: Design Artifacts`                                                  | Optional                              |
| 3.5  | `Step 3.5: Governance Discovery`                                            | —                                     |
| 4    | `Step 4: IaC Plan (Bicep)` **or** `Step 4: IaC Plan (Terraform)` | Routed by `decisions.iac_tool`        |
| 5    | `Step 5: Generate Bicep` / `Step 5: Generate Terraform`                     | Routed by `decisions.iac_tool`        |
| 6    | `Step 6: Deploy (Bicep)` / `Step 6: Deploy (Terraform)`                      | Routed by `decisions.iac_tool`        |
| 7    | `Step 7: As-Built Documentation`                                            | —                                     |
| —    | `🔍 Run Challenger Review`                                                  | Surface at any gate that needs review |

**Handoff Presentation Rule**: When directing the user to click a handoff
button, refer to it by its **exact label** as shown in the UI (e.g.,
_"Click **Step 1: Gather Requirements** below to start."_). Do NOT add
agent names, arrows, or internal references like "→ @02-Requirements" —
these are invisible to the user and create confusion.

### Leaf Worker Calls

Use current parent allowlists and the [execution contract](execution-subagent.md).
Leaf workers return missing inputs to their parent, without questions, todo
management, or nested calls. Required reviewer unavailable: human handoff to
`10-Challenger`, never a nested wrapper. Missing or empty reviewer output allows
exactly one identical-input retry, then human escalation. No prose table grants permissions.

### Subagent Integration

For the full subagent matrix, read `.github/skills/apex-workflow-engine/references/subagent-integration.md`.
Key points: the graph owns default and opt-in reviews; cost-estimate-subagent handles pricing
at Steps 2 and 7; the `apex-azure-governance-discovery` skill runs at Step 3.5 (Governance agent).

**Pricing Accuracy Gate (Steps 2 & 7)**: All prices must originate from
`cost-estimate-subagent` (Azure Resource Manager MCP). Never write dollar
figures from parametric knowledge.
