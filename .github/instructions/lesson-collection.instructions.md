---
description: "Lesson collection and retrospective protocol for orchestrator agents. Captures process observations during workflow execution and generates lessons-learned artifacts at completion."
applyTo: "**/*orchestrator*.agent.md"
---

# Lesson Collection Protocol

Orchestrators collect process observations during workflow execution and
generate `09-lessons-learned.json` + `09-lessons-learned.md` as **workflow
completion artifacts** (same pattern as `00-handoff.md` and `00-session-state.json`).

## Initialization

Initialize session state with `apex-recall init <project> --json`; never read or
edit `00-session-state.json` directly. On resume, recover state with
`apex-recall show <project> --json` and preserve existing lesson entries.
Create `09-lessons-learned.json` with file-editing tools only when absent:

```json
{
  "workflow_mode": "production",
  "project": "{project}",
  "lessons": []
}
```

New workflow logs use `"production"`. The schema's historical `"e2e"` value
and existing lesson artifacts remain valid compatibility evidence; do not
rewrite them or infer a runnable E2E workflow from that retained value.

The CLI has no `apex-recall lessons` subcommand. Append schema-compliant entries
to the lesson artifact with file-editing tools; session findings are not a
replacement for the structured lesson log. Register the artifact through recall:

```bash
apex-recall checkpoint <project> <step> lessons \
   --artifact agent-output/<project>/09-lessons-learned.json --json
```

## When to Record a Lesson

### Production Orchestrator Triggers

- Challenger review returns `must_fix` findings
- User rejects an artifact and requests revision (log what was wrong)
- Subagent returns `NEEDS_REVISION` verdict
- Deployment what-if reveals Azure Policy violations
- User explicitly flags an issue or concern during approval

## Lesson Schema

Formal JSON Schema: `tools/schemas/lesson-log.schema.json`.
Required fields per entry: `id`, `step`, `category`,
`severity`, `title`, `observation`, `root_cause`, `recommendation`,
`applies_to`, `applies_to_paths`, `status`.

## Completion Protocol

After the final production workflow step completes (Step 7), generate the
lessons-learned artifacts:

1. **Read** `09-lessons-learned.json` — the accumulated lesson entries
2. **Generate** `09-lessons-learned.md` narrative using the H2 structure
   from `apex-azure-artifacts/templates/09-lessons-learned.template.md`
3. If zero lessons were captured, state "no lessons recorded". Claim a clean
   run only when step/review evidence also proves no revisions or must_fix
   findings; otherwise report the collection gap.
4. Register each output using `apex-recall checkpoint <project> 7 lessons_json`
   or `lessons_markdown`, respectively, with `--artifact <path> --json`.
   The checkpoint command appends each path to the step's artifact list;
   never patch session state directly.
