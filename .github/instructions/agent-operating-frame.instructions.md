---
description: "Shared main-agent authoring guidance: native interaction, scoped domain inputs, actual validation and durable recovery."
applyTo: ".github/agents/*.agent.md"
---

# Agent Operating Frame

An authoring `applyTo` match does not prove runtime attachment. Keep essential constraints in the agent body.

## Native interaction

Every directly selected main can use actual `ask_user` for material missing inputs.
Requirements, Architect, Design and Governance retain their interactive discovery/clarification role.
Batch independent fields, validate freeform values and reuse current answers.
Native `requestedSchema` contains only `properties`; root `type`, `required` and `additionalProperties`
are not tool parameters. Direct `ask_user` receives only `message` and `requestedSchema`.
Delegated envelopes keep unresolved names outside the schema in `needed_inputs`.
Delegated mains return a stable `USER_INPUT_REQUIRED` form to the interactive parent and stop the phase.
Leaves never ask users, delegate or manage parent todos.
An absent question tool blocks a required decision; no guessed defaults or terminal prompts.
Native Autopilot can answer questions; a form return is not independent human authorization.

## Scope and current evidence

- Load only current-phase skills/references, reuse available unchanged sections and recover missing
  required guidance after source changes, compaction or a new chat.
- Recover project state through `apex-recall show <project> --json`; no direct state JSON reads/writes.
  A file inventory is not artifact content or approval evidence.
- Respect domain ownership/frozen inputs and actual governance/security. Return drift to its owner,
  not an inline upstream replacement.
- User instructions outrank skill style/workflow choices, not security/governance/approval requirements.
  Name the path and exact blocking requirement when relevant.
- Validate written non-Markdown shapes and actual commands before passing results.
  Markdown artifact validation follows the designated Git/review owner.

## Native tasks

Use explicit scope, inputs, outputs and failure criteria in actual native task prompts.
Consume actual results and only supported same-task handles; one-shot tasks are not universally resumable.
No worker-ready turn, custom execution envelope, per-worker log gate or handoff-button dependency.
The graph defines domain prerequisites/owners, not permission or native UI transitions.
Runtime hooks are retired and must not be restored.

Independent reviewers retain the existing actual-result receipt/freshness contract and review budgets.
Automatic and manual review use the same read-only structured leaf; only the parent records its actual JSON.
One identical-input missing/empty review retry may apply; missing capability returns an explicit blocker.
No nested main wrapper, model substitution, fabricated findings or counter reset.

## Recovery and completion

Preserve checkpoints, actual output paths, unresolved findings and separate approval references.
`00-handoff.md` is a durable recovery summary, not UI handoff metadata.
Model labels and source allowlists are not runtime attestation or credential isolation.
A valid worker result, accepted finding or completed phase does not approve the next consequential action.
