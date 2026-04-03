---
description: "Lesson collection and retrospective protocol for orchestrator agents. Captures process observations during workflow execution and generates lessons-learned artifacts at completion."
applyTo: "**/*orchestrator*.agent.md"
---

# Lesson Collection Protocol

Orchestrators collect process observations during workflow execution and
generate `09-lessons-learned.json` + `09-lessons-learned.md` as **workflow
completion artifacts** (same pattern as `00-handoff.md` and `00-session-state.json`).

## Initialization

At workflow start (when creating `00-session-state.json`), also create:

```json
// agent-output/{project}/09-lessons-learned.json
{
  "workflow_mode": "production",
  "project": "{project}",
  "lessons": []
}
```

Set `workflow_mode` to `"e2e"` for the E2E Orchestrator.

## When to Record a Lesson

### Production Orchestrator Triggers

- Challenger review returns `must_fix` findings
- User rejects an artifact and requests revision (log what was wrong)
- Subagent returns `NEEDS_REVISION` verdict
- Deployment what-if reveals Azure Policy violations
- User explicitly flags an issue or concern during approval

### E2E Orchestrator Triggers (superset of production)

All production triggers PLUS:

- Step needs >1 iteration (self-correction fired)
- Validator fails on first pass
- Pre-validation fails (agent returned empty/garbage)
- `bicep build` or `terraform validate` fails with hallucinated properties
  → category `factual-accuracy`
- Step exceeds timing threshold → category `workflow-design`

## Lesson Schema

Read `.github/skills/session-resume/references/lesson-schema.md` for the
full JSON schema. Required fields per entry: `id`, `step`, `category`,
`severity`, `title`, `observation`, `root_cause`, `recommendation`,
`applies_to`, `applies_to_paths`, `status`.

## Completion Protocol

After the final workflow step completes (Step 7 for production, Phase H
for E2E), generate the lessons-learned artifacts:

1. **Read** `09-lessons-learned.json` — the accumulated lesson entries
2. **Generate** `09-lessons-learned.md` narrative using the H2 structure
   from `azure-artifacts/templates/09-lessons-learned.template.md`
3. If zero lessons were captured, write a "clean run" summary:
   all steps passed without revision, no challenger must_fix findings
4. Update `00-session-state.json` — add `09-lessons-learned.json` and
   `09-lessons-learned.md` to the artifacts list
