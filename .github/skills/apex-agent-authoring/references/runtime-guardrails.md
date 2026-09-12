<!-- ref:agent-runtime-guardrails-v2 -->

# Runtime Guardrails

## Context Hygiene

- Reuse unchanged content still available in the conversation. Source changes,
  compaction, or a new chat require refreshing only the needed material.
- Batch independent reads. User-facing parents may batch questions; leaf workers
    return missing inputs to the parent instead of asking questions or managing todos.
- Prefer exact or regex search plus bounded reads for known targets.
- Use semantic search only for exploratory discovery.
- Keep router descriptions concise.
- Use apex-context-management compression tiers for large artifacts.

Prefer targeted edits. Rewrite only for a new artifact, template migration, H2
reordering, or a change affecting most of a file. Record the reason through
`apex-recall`.

## Artifact Ownership

Do not lint `agent-output/**` directly; lefthook and `10-Challenger` own artifact
validation. Do not write artifacts through heredocs, redirects, or `tee`; use
file-editing tools.

## Execution Subagent Prompts

Use `tools/apex-prompts/utility-prompts/execution-subagent.prompt.md`:

1. `## Inputs` identifies paths and required state.
2. `## Activities` lists exact commands or tools.
3. `## Outputs` names the schema, verdict, bounded report, and failure mode.

## Challenger Fallback

1. If a required reviewer is unavailable, stop and request a human handoff to
    `10-Challenger`.
2. Missing or empty reviewer output permits exactly one identical-input retry,
    then stop and request a human handoff to `10-Challenger`. Report the runtime
    error when available.
3. Never invoke a nested main-agent wrapper or fabricate an inline review.
    Production main agents, including `10-Challenger`, require human selection;
    explicit caller allowlists must not override this production boundary.

## User-Scope Discovery

Repository settings cannot disable extension-contributed agents. Do not modify
contributor profiles automatically. Use the dev-container hygiene guide for
manual cleanup.
