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

| Field                         | Type           | Description                                                     |
| ----------------------------- | -------------- | --------------------------------------------------------------- |
| `schema_version`              | string         | `"1.0"` or `"2.0"` — increment on breaking changes              |
| `project`                     | string         | Project folder name (kebab-case)                                |
| `iac_tool`                    | string         | `"Bicep"` or `"Terraform"` — set after Step 1                   |
| `region`                      | string         | Primary Azure region                                            |
| `branch`                      | string         | Active Git branch                                               |
| `updated`                     | ISO string     | Last modification timestamp                                     |
| `current_step`                | integer        | Step number currently in progress (1-7)                         |
| `stale_threshold_ms`          | integer        | Milliseconds before a lock heartbeat is considered stale (v2.0) |
| `lock`                        | object         | Top-level workflow lock (v2.0)                                  |
| `lock.owner_id`               | string or null | Session ID holding the global lock                              |
| `lock.heartbeat`              | ISO or null    | Last heartbeat from the lock owner                              |
| `lock.attempt_token`          | UUID or null   | Optimistic concurrency token for the lock                       |
| `lock.acquired`               | ISO or null    | When the lock was first acquired                                |
| `decisions`                   | object         | Key project decisions (accumulated across steps)                |
| `open_findings`               | array          | Unresolved `must_fix` challenger findings (titles only)         |
| `steps.N.status`              | string         | `pending` / `in_progress` / `complete` / `skipped`              |
| `steps.N.sub_step`            | string or null | Current sub-step checkpoint identifier (e.g. `"phase_2_waf"`)   |
| `steps.N.artifacts`           | array          | File paths produced by this step                                |
| `steps.N.claim`               | object         | Per-step claim lock (v2.0)                                      |
| `steps.N.claim.owner_id`      | string or null | Session ID that claimed this step                               |
| `steps.N.claim.heartbeat`     | ISO or null    | Last heartbeat from the step claimant                           |
| `steps.N.claim.attempt_token` | UUID or null   | Optimistic concurrency token for the step claim                 |
| `steps.N.claim.retry_count`   | integer        | Number of retries attempted for this step                       |
| `steps.N.claim.event_log`     | array          | Audit trail of claim/release/recovery events                    |
