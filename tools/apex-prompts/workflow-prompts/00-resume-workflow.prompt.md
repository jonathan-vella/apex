---
description: "Resume the multi-step workflow after a `/clear` (or any fresh chat) by reading session state and routing to the correct agent."
agent: "01-Orchestrator"
---

# Resume Workflow

Resume the multi-step Azure platform engineering workflow from the last
checkpoint. **This is the canonical recovery path after the user runs
`/clear`** — the step agents emit a verbatim handoff line
(`Run /clear, then switch the chat agent picker to 01-Orchestrator and
send resume <project> to continue Step N+1.`) at completion, and this
prompt is what runs next.

# Goal

Read session state for an existing project under `agent-output/`, determine
the next workflow node from the DAG, and hand off to the correct agent —
without re-executing completed work or losing earlier decisions.

# Success criteria

- Correct project identified (auto-selected if only one; otherwise user-picked).
- `current_step`, step statuses, sub-step checkpoint, and `decisions.iac_tool`
  read from session state.
- Next workflow node resolved against
  `.github/skills/workflow-engine/templates/workflow-graph.json`.
- User shown the current workflow status before any agent invocation.
- Next agent surfaced as a **handoff button** (matching the label in the
  `01-Orchestrator` agent's `handoffs:` frontmatter). The user clicks the
  button to enter the next agent. The orchestrator never auto-invokes a step
  agent or the challenger via `#runSubagent` (Bicep vs Terraform routing
  respected when picking which handoff label to surface).

# Constraints

- **Post-`/clear` invariant**: the chat ring is empty. Do NOT attempt to
  recall prior turns, artifact contents, or subagent results from memory.
  All recovery flows through `apex-recall show <project> --json` plus the
  artifact files on disk under `agent-output/{project}/`.
- **First tool call MUST be `apex-recall show <project> --json`** — never
  start with `read_file` against `00-handoff.md`, `01-requirements.md`, or
  any other artifact. Only read artifacts after `show` returns, and only
  the ones the resolved next-node requires.
- At least one project folder exists under `agent-output/` with
  `00-session-state.json`.
- Read `agent-output/{project}/00-session-state.json` and the workflow graph
  on every resume — do not cache stale state.
- **Handoff-only routing.** The `01-Orchestrator` runs at codex tier; per the
  VS Code [subagent cost-tier rule](https://code.visualstudio.com/docs/copilot/agents/subagents),
  any `#runSubagent` call would silently downgrade higher-tier step agents.
  This prompt therefore **never** wraps a step agent or the challenger in
  `#runSubagent`. After resolving the next node, present its matching
  handoff button (from the orchestrator's `handoffs:` list) and stop.
- Routing rules:
  - `complete` → follow `on_complete` edges → find next node.
  - `in_progress` → resume from `sub_step` checkpoint.
  - `pending` → execute this node.
  - `skipped` → follow `on_skip` edges.
- Gate nodes require user approval before continuing.
- Do not re-execute completed steps unless the user explicitly asks.
- Do not change decisions made in earlier steps (IaC tool, region, compliance).

# Output

- A status summary printed for the user (project, current step, next agent).
- The matching **handoff button** for the next workflow node, surfaced from
  the orchestrator's `handoffs:` list. No content is auto-injected into the
  next agent — the user clicks the button to enter that agent at its native
  tier.

# Stop rules

- Stop and ask if multiple projects exist and the user did not specify one.
- Stop if `00-session-state.json` is missing or fails schema validation.
- Stop at any gate node that requires approval.
- Stop after surfacing the next handoff button — do not call `#runSubagent`.
- Do not invent a `decisions.iac_tool` value when it is missing — ask the
  user (or route back to the relevant Step 4 agent).

## Graph Node → State Key Mapping

The workflow graph uses hyphenated node IDs; the session state JSON uses quoted string keys.
Step 3_5 (Governance) uses underscores in both systems to avoid `parseInt("3.5")` issues.

| Graph Node ID | State Steps Key | State review_audit Key | Agent                 | Condition                           |
| ------------- | --------------- | ---------------------- | --------------------- | ----------------------------------- |
| `step-1`      | `"1"`           | `step_1`               | 02-Requirements       | —                                   |
| `step-2`      | `"2"`           | `step_2`               | 03-Architect          | —                                   |
| `step-3`      | `"3"`           | (none — optional)      | 04-Design             | optional                            |
| `step-3_5`    | `"3_5"`         | `step_3_5`             | 04g-Governance        | —                                   |
| `step-4`      | `"4"`           | `step_4`               | 05-IaC Planner        | —                                   |
| `step-5b`     | `"5"`           | `step_5`               | 06b-Bicep CodeGen     | `decisions.iac_tool == "Bicep"`     |
| `step-5t`     | `"5"`           | `step_5`               | 06t-Terraform CodeGen | `decisions.iac_tool == "Terraform"` |
| `step-6b`     | `"6"`           | `step_6`               | 07b-Bicep Deploy      | `decisions.iac_tool == "Bicep"`     |
| `step-6t`     | `"6"`           | `step_6`               | 07t-Terraform Deploy  | `decisions.iac_tool == "Terraform"` |
| `step-7`      | `"7"`           | (none)                 | 08-As-Built           | —                                   |

## Graph Node → Handoff Button Label

When the next node has been resolved, surface the matching handoff button
from the `01-Orchestrator` `handoffs:` frontmatter — never call
`#runSubagent`.

| Graph Node ID | Handoff button label                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `step-1`      | `Step 1: Gather Requirements`                                                                             |
| `step-2`      | `Step 2: Architecture Assessment`                                                                         |
| `step-3`      | `Step 3: Design Artifacts` (optional — may be skipped to `step-3_5`)                                      |
| `step-3_5`    | `Step 3.5: Governance Discovery`                                                                          |
| `step-4`      | `Step 4: Implementation Plan` (Bicep) **or** `Step 4: IaC Plan (Terraform)` based on `decisions.iac_tool` |
| `step-5b`     | `Step 5: Generate Bicep`                                                                                  |
| `step-5t`     | `Step 5: Generate Terraform`                                                                              |
| `step-6b`     | `Step 6: Deploy`                                                                                          |
| `step-6t`     | `Step 6: Deploy (Terraform)`                                                                              |
| `step-7`      | `Step 7: As-Built Documentation`                                                                          |
| Challenger    | `🔍 Run Challenger Review` — surface at any gate that needs review                                        |

If the resolved node has no matching handoff label (e.g., a custom or
deprecated node), STOP and ask the user how to proceed instead of falling
back to `#runSubagent`.

## Recognising the `/clear`-handoff message

When a step agent finishes, it ends its final message with this exact line:

```text
Run `/clear`, then switch the chat agent picker to `01-Orchestrator` and send `resume <project>` to continue Step N+1.
```

The user runs `/clear` (wiping chat context), switches the chat agent
picker back to `01-Orchestrator`, and sends `resume <project>` in the
new chat. That reply invokes this prompt with `<project>` as the
target. Treat any incoming message that begins by switching to
`01-Orchestrator` and sending `resume *` as the canonical entry point —
no free-form preamble is needed before the `apex-recall show` call.

> VS Code custom agents activate via the agent picker, not via `@name`
> chat-participant syntax. See
> <https://code.visualstudio.com/docs/copilot/customization/custom-agents>.

Same flow applies to the mid-step variant emitted by the orchestrator
between challenger passes:

```text
Run `/clear`, then switch the chat agent picker to `01-Orchestrator` and send `resume <project>` to continue challenger Pass <N+1>.
```

For the challenger-pass variant, `apex-recall show` will report
`sub_step` at the pass-N checkpoint; resolve the next node to the same
step and re-surface the Challenger handoff button rather than the
next-step button.

