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
return to the owning Requirements worker for recovery within its existing review budget.
If that delegated worker cannot nest tasks, it returns `REVIEW_REQUIRED` and the interactive
Orchestrator invokes the same native `challenger-review-subagent` automatically as a sibling task.
Capture actual inputs/record actual results using the shared one-shot contract and existing budget.
Only an actually unavailable parent reviewer or failed/invalid execution needs human recovery.
`10-Challenger` is optional manual recovery, not the normal review path.
Never fabricate an inline review or treat a fallback display as approval.

### Gate 2: After Architecture

```text
🏗️ ARCHITECTURE ASSESSMENT COMPLETE
Artifact: agent-output/{project}/02-architecture-assessment.md
Cost Estimate: agent-output/{project}/03-des-cost-estimate.md
✅ Next: Governance Discovery (Step 3.5) or Design Artifacts (Step 3, optional)
💡 After human approval, checkpoint and verify the graph-selected next SDK worker.
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
💡 After human approval, checkpoint and verify the selected CodeGen worker.
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

Only `01-Orchestrator` dispatches main workers after human gate approval,
current graph preconditions and the [native task lifecycle](worker-readiness.md).
Active definitions omit model and effort pins; model selection belongs to the
operator and runtime. Missing required native results/tools blocks the affected execution;
continuation is used only when supported. Never perform specialist work
inline or choose a fixed-model fallback.

### Step → Named Worker

| Step | Named worker | Notes |
| ---- | --------------------------------------------------------------------------- | ------------------------------------- |
| 1 | `02-Requirements` | Parent mediates discovery forms |
| 2 | `03-Architect` | Separate architecture and cost reviews |
| 3 | `04-Design` | Optional |
| 3.5 | `04g-Governance` | Effective policy discovery |
| 4 | `05-IaC Planner` | Shared planner |
| 5 | `06b-Bicep CodeGen` / `06t-Terraform CodeGen` | `decisions.iac_tool` |
| 6 | `07b-Bicep Deploy` / `07t-Terraform Deploy` | Separate final apply approval |
| 7 | `08-As-Built` | Observed deployment state |

Present the exact owner, scope and pending human gate. Active APEX agents omit UI
handoff metadata; it is not an SDK execution dependency or permission. Automatic technical
handoffs return to the same Orchestrator with artifact paths, recall checkpoints,
actual validation results, unresolved findings and pending forms. They do not
require manual agent switching. Human approval remains a separate gate.

For a new or resumed chat, explicitly select `01-Orchestrator` and verify current
owner selection. An idle cross-chat message may clear host agent selection;
it is not a supported way to retain or select the owner. Recover with a direct
human turn in the selected owner chat, not a textual ownership assertion or
session-database edit.

### Leaf Worker Calls

Use current parent allowlists and the [execution contract](execution-subagent.md).
Leaf workers return missing inputs to their parent, without questions, todo
management, or nested calls. Automatic reviews use
[shared structured review](../../apex-azure-defaults/references/one-shot-review.md).
Required reviewer unavailable: return the error to the interactive parent,
never a nested wrapper. `10-Challenger` remains optional. Missing or empty reviewer output allows
exactly one identical-input retry, then human escalation. No prose table grants permissions.

### Subagent Integration

For the full subagent matrix, read `.github/skills/apex-workflow-engine/references/subagent-integration.md`.
Key points: the graph owns default and opt-in reviews; cost-estimate-subagent handles pricing
at Steps 2 and 7; the `apex-azure-governance-discovery` skill runs at Step 3.5 (Governance agent).

**Pricing Accuracy Gate (Steps 2 & 7)**: All prices must originate from
`cost-estimate-subagent` (Azure MCP `pricing_get`). Never write dollar
figures from parametric knowledge.
