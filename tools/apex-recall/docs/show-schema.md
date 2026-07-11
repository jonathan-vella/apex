# `apex-recall show --json` Output Schema

Canonical shape of the JSON document emitted by `apex-recall show <project> --json`.
This file is the source of truth for downstream `jq` queries and tooling.

> **Scope**: This documents the **stable contract** that callers may rely on.
> Internal fields not listed here may change without notice; do not depend on
> them.

## Top-level shape

```jsonc
{
  "project": "<project-name>",
  "session": {/* see below */},
  "artifacts": [/* array of artifact records */],
  "artifact_count": 0,
}
```

### `session`

Always present. When no `00-session-state.json` exists, `session` is `{}`
(empty object) — callers must guard for empty.

| Field           | Type    | Notes                                                                      |
| --------------- | ------- | -------------------------------------------------------------------------- |
| `current_step`  | integer | 0–7 (3_5 maps to 3 for `current_step`; use `steps` for sub-step status).   |
| `iac_tool`      | string  | `"Bicep"`, `"Terraform"`, or empty.                                        |
| `region`        | string  | Azure region key (e.g. `"swedencentral"`).                                 |
| `updated`       | string  | ISO-8601 timestamp (UTC).                                                  |
| `decisions`     | object  | Free-form decision-key map. See `decision-keys.md` for canonical keys.     |
| `open_findings` | array   | Live findings recorded via `apex-recall finding`.                          |
| `decision_log`  | array   | Append-only decision history.                                              |
| `steps`         | object  | **Per-step status map keyed by string IDs**. Defaults to `{}` when absent. |

### `session.steps`

Keys are **strings** (`"1"`, `"2"`, `"3"`, `"3_5"`, `"4"`, `"5"`, `"6"`, `"7"`).
Each value is an object describing the step's lifecycle:

```jsonc
{
  "name": "IaC Code",
  "agent": "06b-Bicep CodeGen",
  "status": "complete", // pending | in-progress | complete | failed
  "sub_step": "phase_4_validation",
  "started": "2026-05-12T11:00:00Z",
  "completed": "2026-05-12T11:30:00Z",
  "artifacts": ["infra/bicep/<project>/main.bicep"],
  "context_files_used": ["01-requirements.md"],
}
```

## Canonical `jq` queries

> **Important**: keys are strings, not numbers. Use string comparisons
> (`.key == "5"`) — do **not** call `tonumber`.

### Status of Steps 5 and 6

```bash
apex-recall show <project> --json \
  | jq '.session.steps
        | to_entries[]
        | select(.key == "5" or .key == "6")
        | {step: .key, status: .value.status, sub_step: .value.sub_step}'
```

Returns 0 entries when neither step has been started — the query is
safe on an empty session because `steps` defaults to `{}`.

### Verify a step is complete (for skip-validation shortcuts)

```bash
apex-recall show <project> --json \
  | jq -r '.session.steps["5"].status // "missing"'
```

Emits `"complete"`, `"pending"`, or `"missing"` — never errors on absent step.

### List artifacts produced at a specific step

```bash
apex-recall show <project> --json \
  | jq -r '.session.steps["6"].artifacts[]?'
```

## History

- **2026-05-13**: Added `steps` to the contract (Phase G3 / F1a of the
  nordic-foods lessons plan). Previously `show.py` omitted `steps`,
  causing `jq '.session.steps | to_entries[]'` to iterate over null.
