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

Use `.github/skills/apex-workflow-engine/references/execution-subagent.md`
after the [verified worker handshake](../../apex-workflow-engine/references/worker-readiness.md):

1. `## Inputs` identifies paths and required state.
2. `## Activities` lists exact commands or tools.
3. `## Outputs` names the schema, verdict, bounded report, and failure mode.

## Challenger Fallback

Automatic review uses [one-shot rubber-duck](../../apex-azure-defaults/references/one-shot-review.md),
not the resumable worker handshake. Record actual independent output and validate
freshness before reporting success. The optional manual Challenger workflow
retains its own worker contract.

1. If a required reviewer is unavailable, stop and return the failure to the interactive parent.
2. Missing or empty reviewer output permits exactly one identical-input retry,
    then stop for a human recovery decision. Report the runtime
    error when available.
3. Never invoke a nested main-agent wrapper or fabricate an inline review.
    Only Orchestrator may dispatch approved, readiness-verified main workers;
    step-agent allowlists never authorize another main-agent wrapper.
4. `10-Challenger` is optional, never a required automatic recovery hop.
    If it is already active, stop and request human intervention
    rather than a self-handoff. Preserve exhausted retry status across handoffs
    and resumed sessions; human selection does not renew the retry allowance.

## User-Scope Discovery

Repository settings cannot disable extension-contributed agents. Do not modify
contributor profiles automatically. Use the dev-container hygiene guide for
manual cleanup.
