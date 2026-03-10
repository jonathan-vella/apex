<!-- ref:state-file-schema-v2 -->

# State File Schema: `00-session-state.json`

## Schema Versions

| Version | Description                                                             |
| ------- | ----------------------------------------------------------------------- |
| `1.0`   | Original schema — status tracking, decisions, sub-step checkpoints      |
| `2.0`   | Adds `lock` object, per-step `claim`, `stale_threshold_ms`, `event_log` |

> **Backwards compatibility**: v1.0 files without `lock` still validate.
> New files should use `"schema_version": "2.0"`.

## Full Template (v2.0)

```json
{
  "schema_version": "2.0",
  "project": "{project-name}",
  "iac_tool": "Bicep | Terraform",
  "region": "swedencentral",
  "branch": "main",
  "updated": "2026-03-02T10:00:00Z",
  "current_step": 1,
  "stale_threshold_ms": 300000,
  "lock": {
    "owner_id": null,
    "heartbeat": null,
    "attempt_token": null,
    "acquired": null
  },
  "decisions": {
    "region": "swedencentral",
    "compliance": "None",
    "budget": "~$50/mo",
    "architecture_pattern": "",
    "deployment_strategy": "",
    "complexity": ""
  },
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
      "context_files_used": [],
      "claim": {
        "owner_id": null,
        "heartbeat": null,
        "attempt_token": null,
        "retry_count": 0,
        "event_log": []
      }
    },
    "2": {
      "name": "Architecture",
      "agent": "03-Architect",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": [],
      "claim": {
        "owner_id": null,
        "heartbeat": null,
        "attempt_token": null,
        "retry_count": 0,
        "event_log": []
      }
    },
    "3": {
      "name": "Design",
      "agent": "04-Design",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": [],
      "claim": {
        "owner_id": null,
        "heartbeat": null,
        "attempt_token": null,
        "retry_count": 0,
        "event_log": []
      }
    },
    "4": {
      "name": "IaC Plan",
      "agent": "05b-Bicep Planner | 05t-Terraform Planner",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": [],
      "claim": {
        "owner_id": null,
        "heartbeat": null,
        "attempt_token": null,
        "retry_count": 0,
        "event_log": []
      }
    },
    "5": {
      "name": "IaC Code",
      "agent": "06b-Bicep CodeGen | 06t-Terraform CodeGen",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": [],
      "claim": {
        "owner_id": null,
        "heartbeat": null,
        "attempt_token": null,
        "retry_count": 0,
        "event_log": []
      }
    },
    "6": {
      "name": "Deploy",
      "agent": "07b-Bicep Deploy | 07t-Terraform Deploy",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": [],
      "claim": {
        "owner_id": null,
        "heartbeat": null,
        "attempt_token": null,
        "retry_count": 0,
        "event_log": []
      }
    },
    "7": {
      "name": "As-Built",
      "agent": "08-As-Built",
      "status": "pending",
      "sub_step": null,
      "started": null,
      "completed": null,
      "artifacts": [],
      "context_files_used": [],
      "claim": {
        "owner_id": null,
        "heartbeat": null,
        "attempt_token": null,
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
| `schema_version`                      | string         | `"1.0"` or `"2.0"` — increment on breaking changes                                                                                |
| `project`                             | string         | Project folder name (kebab-case)                                                                                                  |
| `iac_tool`                            | string         | `"Bicep"` or `"Terraform"` — set after Step 1                                                                                     |
| `region`                              | string         | Primary Azure region                                                                                                              |
| `branch`                              | string         | Active Git branch                                                                                                                 |
| `updated`                             | ISO string     | Last modification timestamp                                                                                                       |
| `current_step`                        | integer        | Step number currently in progress (1-7)                                                                                           |
| `stale_threshold_ms`                  | integer        | Milliseconds before a lock heartbeat is considered stale (v2.0)                                                                   |
| `lock`                                | object         | Top-level workflow lock (v2.0)                                                                                                    |
| `lock.owner_id`                       | string or null | Session ID holding the global lock                                                                                                |
| `lock.heartbeat`                      | ISO or null    | Last heartbeat from the lock owner                                                                                                |
| `lock.attempt_token`                  | UUID or null   | Optimistic concurrency token for the lock                                                                                         |
| `lock.acquired`                       | ISO or null    | When the lock was first acquired                                                                                                  |
| `decisions`                           | object         | Key project decisions (accumulated across steps)                                                                                  |
| `decisions.complexity`                | string         | `"simple"`, `"standard"`, `"complex"`, or `""` — set by Requirements agent, defaults to `"standard"` if missing (backward compat) |
| `open_findings`                       | array          | Unresolved `must_fix` challenger findings (titles only)                                                                           |
| `steps.N.status`                      | string         | `pending` / `in_progress` / `complete` / `skipped`                                                                                |
| `steps.N.sub_step`                    | string or null | Current sub-step checkpoint identifier (e.g. `"phase_2_waf"`)                                                                     |
| `steps.N.artifacts`                   | array          | File paths produced by this step                                                                                                  |
| `steps.N.claim`                       | object         | Per-step claim lock (v2.0)                                                                                                        |
| `steps.N.claim.owner_id`              | string or null | Session ID that claimed this step                                                                                                 |
| `steps.N.claim.heartbeat`             | ISO or null    | Last heartbeat from the step claimant                                                                                             |
| `steps.N.claim.attempt_token`         | UUID or null   | Optimistic concurrency token for the step claim                                                                                   |
| `steps.N.claim.retry_count`           | integer        | Number of retries attempted for this step                                                                                         |
| `steps.N.claim.event_log`             | array          | Audit trail of claim/release/recovery events                                                                                      |
| `review_audit`                        | object         | Optional — adversarial review audit trail per step                                                                                |
| `review_audit.step_N.complexity`      | string         | Complexity tier used for this step's review                                                                                       |
| `review_audit.step_N.passes_planned`  | integer        | Number of passes planned based on complexity matrix                                                                               |
| `review_audit.step_N.passes_executed` | integer        | Number of passes actually executed                                                                                                |
| `review_audit.step_N.skipped`         | array          | Pass numbers that were skipped (e.g. `[2, 3]`)                                                                                    |
| `review_audit.step_N.skip_reasons`    | array          | Reasons for each skip (e.g. `["pass 1: 0 must_fix, 1 should_fix"]`)                                                               |
| `review_audit.step_N.models_used`     | array          | Models used per pass (e.g. `["GPT-5.4", "GPT-5.3-Codex"]`)                                                                        |
