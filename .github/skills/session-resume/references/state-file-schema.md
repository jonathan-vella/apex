<!-- ref:state-file-schema-v3 -->

# State File Schema: `00-session-state.json`

## Schema Versions

| Version | Description                                                        |
| ------- | ------------------------------------------------------------------ |
| `1.0`   | Original schema — status tracking, decisions, sub-step checkpoints |
| `2.0`   | Added `lock` object, per-step `claim` (removed in v3.0)            |
| `3.0`   | Simplified — removed lock/claim (serial execution only)            |

> **Migration**: v1.0 and v2.0 files are auto-migrated to v3.0 on first read.
> Lock/claim fields are stripped during migration.

## Full Template (v3.0)

```json
{
  "schema_version": "3.0",
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
    "deployment_strategy": "",
    "complexity": ""
  },
  "decision_log": [],
  "open_findings": [],
  "review_audit": {
    "step_1": {
      "complexity": "",
      "passes_planned": 0,
      "passes_executed": 0,
      "skipped": [],
      "skip_reasons": [],
      "models_used": []
    },
    "step_2": {
      "complexity": "",
      "passes_planned": 0,
      "passes_executed": 0,
      "skipped": [],
      "skip_reasons": [],
      "models_used": []
    },
    "step_4": {
      "complexity": "",
      "passes_planned": 0,
      "passes_executed": 0,
      "skipped": [],
      "skip_reasons": [],
      "models_used": []
    },
    "step_5": {
      "complexity": "",
      "passes_planned": 0,
      "passes_executed": 0,
      "skipped": [],
      "skip_reasons": [],
      "models_used": []
    },
    "step_6": {
      "complexity": "",
      "passes_planned": 0,
      "passes_executed": 0,
      "skipped": [],
      "skip_reasons": [],
      "models_used": []
    }
  },
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
      "agent": "05-IaC Planner",
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

        "retry_count": 0,
        "event_log": []
      }
    }

}
}

```

## Field Definitions

| Field                                 | Type           | Description                                                                                                                       |
| ------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version`                      | string         | `"3.0"` — increment on breaking changes                                                                                           |
| `project`                             | string         | Project folder name (kebab-case)                                                                                                  |
| `iac_tool`                            | string         | `"Bicep"` or `"Terraform"` — set after Step 1                                                                                     |
| `region`                              | string         | Primary Azure region                                                                                                              |
| `branch`                              | string         | Active Git branch                                                                                                                 |
| `updated`                             | ISO string     | Last modification timestamp                                                                                                       |
| `current_step`                        | integer        | Step number currently in progress (1-7)                                                                                           |
| `decisions`                           | object         | Key project decisions (accumulated across steps)                                                                                  |
| `decisions.complexity`                | string         | `"simple"`, `"standard"`, `"complex"`, or `""` — set by Requirements agent, defaults to `"standard"` if missing (backward compat) |
| `decision_log`                        | array          | Sequential log of cross-agent decisions with rationale — see `agent-authoring.instructions.md` for entry schema                  |
| `decision_log[].id`                   | string         | Sequential ID (`D001`, `D002`, …) — matches pattern `^D\d+$`                                                                      |
| `decision_log[].step`                 | number         | Workflow step where the decision was made (1–7)                                                                                   |
| `decision_log[].agent`                | string         | Agent that made the decision                                                                                                      |
| `decision_log[].title`                | string         | Short decision title                                                                                                              |
| `decision_log[].choice`               | string         | What was chosen                                                                                                                   |
| `decision_log[].rationale`            | string         | Why this choice was made                                                                                                          |
| `decision_log[].alternatives`         | array          | Optional — what was rejected                                                                                                      |
| `decision_log[].impact`               | string         | Optional — downstream effect on later steps                                                                                       |
| `decision_log[].timestamp`            | ISO string     | Optional — when the decision was made                                                                                             |
| `open_findings`                       | array          | Unresolved `must_fix` challenger findings (titles only)                                                                           |
| `steps.N.status`                      | string         | `pending` / `in_progress` / `complete` / `skipped`                                                                                |
| `steps.N.sub_step`                    | string or null | Current sub-step checkpoint identifier (e.g. `"phase_2_waf"`)                                                                     |
| `steps.N.artifacts`                   | array          | File paths produced by this step                                                                                                  |
| `steps.N.started`                     | ISO or null    | When the step started                                                                                                             |
| `steps.N.completed`                   | ISO or null    | When the step completed                                                                                                           |
| `steps.N.context_files_used`          | array          | Files loaded during this step (for resume)                                                                                        |
| `review_audit`                        | object         | Optional — adversarial review audit trail per step                                                                                |
| `review_audit.step_N.complexity`      | string         | Complexity tier used for this step's review                                                                                       |
| `review_audit.step_N.passes_planned`  | integer        | Number of passes planned based on complexity matrix                                                                               |
| `review_audit.step_N.passes_executed` | integer        | Number of passes actually executed                                                                                                |
| `review_audit.step_N.skipped`         | array          | Pass numbers that were skipped (e.g. `[2, 3]`)                                                                                    |
| `review_audit.step_N.skip_reasons`    | array          | Reasons for each skip (e.g. `["pass 1: 0 must_fix, 1 should_fix"]`)                                                               |
| `review_audit.step_N.models_used`     | array          | Models used per pass (e.g. `["GPT-5.4", "GPT-5.3-Codex"]`)                                                                        |
```
