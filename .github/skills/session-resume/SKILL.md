---
name: session-resume
description: "Session state tracking and resume protocol for the 7-step agent workflow. Defines the 00-session-state.json schema, context budget per step, sub-step checkpoints, and resume detection logic. Agents read this skill to persist progress and recover from mid-step interruptions, cross-step handoffs, or direct invocations in fresh chat threads."
compatibility: All agents (01-Conductor through 08-As-Built)
---

# Session Resume Skill

Enables any agent in the 7-step workflow to persist its progress to a
machine-readable JSON state file and resume from the last checkpoint after
an interruption — whether mid-step, cross-step, or via direct invocation.

---

## When to Use This Skill

- Starting any agent step (read state → detect resume vs fresh start)
- Completing a sub-step checkpoint (write state update)
- Finishing a step (mark complete, list produced artifacts)
- Conductor gate transitions (update state alongside `00-handoff.md`)
- Resuming work after a chat crash or thread switch

---

## Quick Reference

| Concept           | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| State file        | `agent-output/{project}/00-session-state.json`              |
| Human companion   | `agent-output/{project}/00-handoff.md` (unchanged)          |
| Resume detection  | Read JSON → check step status → branch accordingly          |
| Context budget    | Hard limit on files loaded at startup per step              |
| Sub-step tracking | Numbered checkpoints within each step for mid-step recovery |

---

## JSON Schema: `00-session-state.json`

```json
{
  "schema_version": "1.0",
  "project": "{project-name}",
  "iac_tool": "Bicep | Terraform",
  "region": "swedencentral",
  "branch": "main",
  "updated": "2026-03-02T10:00:00Z",
  "current_step": 1,
  "decisions": {
    "region": "swedencentral",
    "compliance": "None",
    "budget": "~$50/mo",
    "architecture_pattern": "",
    "deployment_strategy": ""
  },
  "open_findings": [],
  "steps": {
    "1": {
      "name": "Requirements",
      "agent": "02-Requirements",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": []
    },
    "2": {
      "name": "Architecture",
      "agent": "03-Architect",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": []
    },
    "3": {
      "name": "Design",
      "agent": "04-Design",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": []
    },
    "4": {
      "name": "IaC Plan",
      "agent": "05b-Bicep Planner | 05t-Terraform Planner",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": []
    },
    "5": {
      "name": "IaC Code",
      "agent": "06b-Bicep CodeGen | 06t-Terraform CodeGen",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": []
    },
    "6": {
      "name": "Deploy",
      "agent": "07b-Bicep Deploy | 07t-Terraform Deploy",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": []
    },
    "7": {
      "name": "As-Built",
      "agent": "08-As-Built",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": []
    }
  }
}
```

### Field Definitions

| Field               | Type           | Description                                                   |
| ------------------- | -------------- | ------------------------------------------------------------- |
| `schema_version`    | string         | Always `"1.0"` — increment on breaking changes                |
| `project`           | string         | Project folder name (kebab-case)                              |
| `iac_tool`          | string         | `"Bicep"` or `"Terraform"` — set after Step 1                 |
| `region`            | string         | Primary Azure region                                          |
| `branch`            | string         | Active Git branch                                             |
| `updated`           | ISO string     | Last modification timestamp                                   |
| `current_step`      | integer        | Step number currently in progress (1-7)                       |
| `decisions`         | object         | Key project decisions (accumulated across steps)              |
| `open_findings`     | array          | Unresolved `must_fix` challenger findings (titles only)       |
| `steps.N.status`    | string         | `pending` / `in_progress` / `complete` / `skipped`            |
| `steps.N.sub_step`  | string or null | Current sub-step checkpoint identifier (e.g. `"phase_2_waf"`) |
| `steps.N.artifacts` | array          | File paths produced by this step                              |

---

## Context Budget Table

Each agent loads ONLY the files listed below at startup. No exceptions.
Skills are loaded AFTER the prerequisites check, not at agent init.

| Step | Agent        | Max Files | Allowed Files                                                                            |
| ---- | ------------ | --------- | ---------------------------------------------------------------------------------------- |
| 1    | Requirements | 1         | `00-session-state.json`                                                                  |
| 2    | Architect    | 2         | `00-session-state.json` + `01-requirements.md`                                           |
| 3    | Design       | 2         | `00-session-state.json` + `02-architecture-assessment.md`                                |
| 4    | Planner      | 2         | `00-session-state.json` + `02-architecture-assessment.md`                                |
| 5    | CodeGen      | 3         | `00-session-state.json` + `04-implementation-plan.md` + `04-governance-constraints.json` |
| 6    | Deploy       | 2         | `00-session-state.json` + `05-implementation-reference.md`                               |
| 7    | As-Built     | 3         | `00-session-state.json` + `06-deployment-summary.md` + `02-architecture-assessment.md`   |

> Additional files (e.g. `04-governance-constraints.md` for CodeGen) may be
> loaded on-demand during a specific sub-step — never at startup.

---

## Resume Detection Protocol

Every agent MUST execute this protocol as its **first action** (before reading
skills, templates, or predecessor artifacts):

```text
1. Check if `agent-output/{project}/00-session-state.json` exists
   ├─ NO  → Fresh start. Create state file from template. Proceed normally.
   └─ YES → Read it. Check steps.{my_step}.status:
            ├─ "pending"      → First run of this step. Set to "in_progress". Proceed normally.
            ├─ "in_progress"  → RESUME. Read sub_step field:
            │                    ├─ null → Step started but no sub-step recorded. Restart step.
            │                    └─ "phase_X_..." → Skip to that checkpoint. Do NOT re-read
            │                       files already listed in context_files_used.
            ├─ "complete"     → Step already done. Inform user. Offer to re-run or return.
            └─ "skipped"      → Step was skipped (e.g. Step 3). Proceed to next.
```

### Direct Invocation Detection

When an agent is invoked directly (not via Conductor), it must also check
whether PRIOR steps are complete:

```text
1. Read 00-session-state.json
2. For each step < my_step:
   ├─ "complete" or "skipped" → OK
   └─ "pending" or "in_progress" → WARN user that prerequisites may be incomplete.
      Offer to: (a) proceed anyway, (b) hand off to the Conductor.
```

---

## Sub-Step Checkpoints

Each agent defines numbered internal phases. After completing each phase,
the agent writes the checkpoint to `steps.{N}.sub_step` in the JSON state.

### Step 1: Requirements (02-Requirements)

| Checkpoint          | After completing...                     |
| ------------------- | --------------------------------------- |
| `phase_1_discovery` | Phase 1 business discovery questions    |
| `phase_2_workload`  | Phase 2 workload pattern detection      |
| `phase_3_nfr`       | Phase 3 NFR and compliance questions    |
| `phase_4_technical` | Phase 4 technical questions             |
| `phase_5_artifact`  | Artifact generation + challenger review |

### Step 2: Architecture (03-Architect)

| Checkpoint           | After completing...                  |
| -------------------- | ------------------------------------ |
| `phase_1_prereqs`    | Prerequisites validated              |
| `phase_2_waf`        | WAF assessment drafted               |
| `phase_3_cost`       | Cost estimate generated via subagent |
| `phase_4_challenger` | Challenger reviews complete          |
| `phase_5_artifact`   | Final artifacts saved                |

### Step 3: Design (04-Design)

| Checkpoint         | After completing...            |
| ------------------ | ------------------------------ |
| `phase_1_prereqs`  | Prerequisites validated        |
| `phase_2_diagram`  | Architecture diagram generated |
| `phase_3_adr`      | ADR(s) drafted                 |
| `phase_4_artifact` | All design artifacts saved     |

### Step 4: IaC Plan (05b/05t Planner)

| Checkpoint           | After completing...                     |
| -------------------- | --------------------------------------- |
| `phase_1_governance` | Governance discovery complete           |
| `phase_2_avm`        | AVM module verification done            |
| `phase_3_plan`       | Implementation plan drafted             |
| `phase_3.5_strategy` | Deployment strategy confirmed by user   |
| `phase_4_diagrams`   | Dependency + runtime diagrams generated |
| `phase_5_challenger` | Challenger reviews complete             |
| `phase_6_artifact`   | All plan artifacts saved                |

### Step 5: IaC Code (06b/06t CodeGen)

| Checkpoint             | After completing...                      |
| ---------------------- | ---------------------------------------- |
| `phase_1_preflight`    | Preflight check complete                 |
| `phase_1.5_governance` | Governance compliance mapping done       |
| `phase_2_scaffold`     | Project scaffolded (main + modules dirs) |
| `phase_3_modules`      | All modules generated                    |
| `phase_4_lint`         | Lint + review subagents passed           |
| `phase_5_challenger`   | Challenger reviews complete              |
| `phase_6_artifact`     | Implementation reference saved           |

### Step 6: Deploy (07b/07t Deploy)

| Checkpoint         | After completing...                       |
| ------------------ | ----------------------------------------- |
| `phase_1_auth`     | Azure CLI auth validated                  |
| `phase_2_preview`  | What-if / plan output reviewed            |
| `phase_3_deploy`   | Deployment executed (per-phase if phased) |
| `phase_4_verify`   | Post-deployment verification done         |
| `phase_5_artifact` | Deployment summary saved                  |

### Step 7: As-Built (08-As-Built)

| Checkpoint          | After completing...                         |
| ------------------- | ------------------------------------------- |
| `phase_1_prereqs`   | All prior artifacts + deployed state read   |
| `phase_2_inventory` | Resource inventory generated                |
| `phase_3_docs`      | Design doc + runbook + compliance generated |
| `phase_4_cost`      | As-built cost estimate via subagent         |
| `phase_5_diagram`   | As-built diagram generated                  |
| `phase_6_index`     | Documentation index + README updated        |

---

## State Write Protocol

Agents update `00-session-state.json` at these moments:

1. **Step start**: Set `status: "in_progress"`, `started: {ISO timestamp}`
2. **Sub-step completion**: Update `sub_step` to the checkpoint name,
   append any new files to `artifacts`, update `updated` timestamp
3. **Step completion**: Set `status: "complete"`, `completed: {ISO timestamp}`,
   `sub_step: null`, finalize `artifacts` list
4. **Decision made**: Add to top-level `decisions` object
5. **Challenger finding**: Append unresolved `must_fix` titles to `open_findings`;
   remove resolved ones

> Always overwrite the file atomically (write complete JSON, not patches).
> Always update the `updated` field.

### Write Example (sub-step completion)

After completing Phase 2 (WAF assessment) in the Architect agent:

```json
{
  "steps": {
    "2": {
      "status": "in_progress",
      "sub_step": "phase_2_waf",
      "started": "2026-03-02T10:05:00Z",
      "artifacts": ["agent-output/{project}/02-architecture-assessment.md"],
      "context_files_used": ["00-session-state.json", "01-requirements.md"]
    }
  },
  "updated": "2026-03-02T10:15:00Z",
  "current_step": 2
}
```

---

## Conductor Integration

The Conductor agent has additional responsibilities:

1. **Project init**: Create `00-session-state.json` from template alongside
   the project directory. Set `project`, `branch`, initial `current_step: 1`.
2. **Gate transitions**: Update JSON state AND `00-handoff.md` at every gate.
   The JSON is the machine source of truth; the Markdown is for human review.
3. **Resume**: Read `00-session-state.json` FIRST (instant state recovery).
   Fall back to `00-handoff.md` → artifact scan only if JSON is missing.
4. **Routing**: Set `iac_tool` in JSON after Step 1 completes (determines
   which agent names populate steps 4-6).

---

## Portability

This skill is designed for reuse across projects:

- JSON schema is generic (no project-specific fields)
- Resume protocol works with any numbered step workflow
- Sub-step checkpoints are defined per agent, not per project
- Template file can be copied to bootstrap new workflows
