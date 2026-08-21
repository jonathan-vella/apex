<!-- ref:agent-runtime-guardrails-v2 -->

# Runtime Guardrails

## Context Hygiene

- Never reread content already present in the conversation.
- Batch independent reads and `askQuestions` prompts.
- Prefer exact or regex search plus bounded reads for known targets.
- Use semantic search only for exploratory discovery.
- Keep router descriptions concise.
- Use context-management compression tiers for large artifacts.

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

1. Retry direct challenger resolution once through `10-Challenger`.
2. If it also fails, report the verbatim runtime error and stop.
3. Never replace the missing subagent with an inline parent-context review.

## User-Scope Discovery

Repository settings cannot disable extension-contributed agents. Do not modify
contributor profiles automatically. Use the dev-container hygiene guide for
manual cleanup.
