<!-- ref:lesson-schema-v1 -->

# Lesson Schema Reference

Single source of truth for the `09-lessons-learned.json` structure.
Both production and E2E orchestrators use this schema.

## Root Object

```json
{
  "workflow_mode": "production | e2e",
  "project": "{project-name}",
  "lessons": [
    /* array of lesson entries */
  ]
}
```

| Field           | Type   | Required | Description                                       |
| --------------- | ------ | -------- | ------------------------------------------------- |
| `workflow_mode` | string | Yes      | `"production"` or `"e2e"` — distinguishes context |
| `project`       | string | Yes      | Project folder name                               |
| `lessons`       | array  | Yes      | Array of lesson entry objects (may be empty)      |

## Lesson Entry

```json
{
  "id": "LL-001",
  "step": 2,
  "category": "factual-accuracy",
  "severity": "high",
  "title": "Short description of the issue",
  "observation": "What happened",
  "expected": "What should have happened",
  "root_cause": "Why it happened",
  "self_corrected": true,
  "iterations_to_fix": 1,
  "recommendation": "Actionable fix with file paths",
  "applies_to": ["03-Architect"],
  "applies_to_paths": [".github/agents/03-architect.agent.md"],
  "status": "new"
}
```

### Required Fields

| Field              | Type   | Description                                  |
| ------------------ | ------ | -------------------------------------------- |
| `id`               | string | Sequential `LL-NNN` within the run           |
| `step`             | number | Workflow step where the issue occurred (1–7) |
| `category`         | string | One of the categories below                  |
| `severity`         | string | `critical`, `high`, `medium`, or `low`       |
| `title`            | string | Short description (one line)                 |
| `observation`      | string | What happened (factual)                      |
| `root_cause`       | string | Why it happened (analysis)                   |
| `recommendation`   | string | Actionable fix                               |
| `applies_to`       | array  | Agent or skill names affected                |
| `applies_to_paths` | array  | File paths to change                         |
| `status`           | string | `new`, `resolved`, or `deferred`             |

### Optional Fields

| Field                | Type    | Description                                  |
| -------------------- | ------- | -------------------------------------------- |
| `expected`           | string  | What should have happened                    |
| `self_corrected`     | boolean | Whether the issue was auto-fixed             |
| `iterations_to_fix`  | number  | How many retries to resolve (0 if not fixed) |
| `azure_error_codes`  | array   | Azure RP error codes (deployment failures)   |
| `failed_deployments` | array   | Deployment names that failed                 |

### Valid Categories

| Category             | When to Use                                                |
| -------------------- | ---------------------------------------------------------- |
| `agent-behavior`     | Agent did something unexpected or wrong                    |
| `skill-gap`          | Missing knowledge in a skill reference                     |
| `prompt-quality`     | Ambiguous or unclear prompt caused confusion               |
| `validation-gap`     | Validator missed something it should catch                 |
| `workflow-design`    | Workflow structure or timing issue                         |
| `context-budget`     | Context window pressure caused quality loss                |
| `artifact-quality`   | Generated artifact missing content or structure            |
| `factual-accuracy`   | Hallucinated Azure property, wrong SKU, deprecated service |
| `deployment-failure` | Template passed build but failed at Azure RP level         |
