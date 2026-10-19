---
description: "Native Copilot agent authoring: valid metadata, direct/delegated interaction, bounded worker outputs and preserved domain/approval contracts."
applyTo: "**/*.agent.md, **/*.prompt.md"
---

# Agent Authoring Standards

Target Copilot inside VS Code. The [authoring skill](../skills/apex-agent-authoring/SKILL.md)
contains optional detailed guidance; do not load its whole reference tree during production work.

## Frontmatter and native tools

- Use valid YAML, available tool IDs and concise descriptions.
- Active definitions omit model/effort pins; descriptive catalogs and legacy fixture pins remain compatible.
- Every user-invocable main explicitly includes native `ask_user`.
  Requirements, Architect, Design and Governance ask material questions when directly selected.
- Nonempty `agents` requires the `agent` capability. Leaf workers are hidden, `agents: []`,
  without question, delegation or parent-todo tools.
- Orchestrator, Deploy, Diagnose and manual Challenger disable implicit model invocation.
  This source policy is not proof of enforced routing or credential isolation.
- Active agents do not declare UI `handoffs`. The owner observed no controls with Probe Source
  selected in Copilot; native task results/explicit role selection are the supported APEX design.
  Historical handoff fixtures remain compatibility data, not production requirements.
- Never restore the intentionally retired repository runtime hooks.

## Body and interaction

Keep essential role, goal, success, scope, output and stop rules in the body.
Use concise Markdown, actual phase inputs/outputs and progressively loaded domain references.
Do not merely relocate the old complete body to a reference to claim optimization.
Source length is not a measurement of runtime tokens, latency or quality.

Use explicit caller `execution_mode: direct|delegated` and actual calling context.
Direct selection invokes `ask_user` with `message` and `requestedSchema.properties`;
batch independent fields, validate freeform answers and reuse current decisions.
Delegated mains return `USER_INPUT_REQUIRED`, stable `request_id`, phase and form to the parent.
Leaves return their role-specific input failure. No terminal questions or default owner answers.
Cancel stops; decline never approves. Autopilot may auto-answer, so form/task output is not
independent human signoff, Azure scope or risk-owner authorization.

Use actual native task results/handles and only supported same-task continuation.
No readiness nonce, custom worker execution envelope, model attestation or mandatory raw-log preflight.
Keep [native worker lifecycle](../skills/apex-workflow-engine/references/worker-readiness.md)
distinct from domain prerequisites, actual result validation and consequential permission.

## Independent review and durable state

Automatic review uses [one-shot review](../skills/apex-azure-defaults/references/one-shot-review.md).
Automatic and manual callers share the read-only `challenger-review-subagent`: JSON output,
no leaf writes or shell/code execution, and parent-owned recording of actual attributed events.
The reviewer-specific result receipt/freshness contract remains; never fabricate findings or source metadata.
Missing required reviewer returns the actual failure. Missing/empty output permits one identical-input
retry within current accounting, then a real recovery decision; no nested main wrapper fallback.
Preserve review verdicts, unresolved findings and budgets across workers/chats.
Delegated owners without nested tools return `REVIEW_REQUIRED` to an authorized interactive parent
for native sibling review, not self-review or a manual wrapper. Parent review recording uses actual identity.

Use `apex-recall` for project state and significant domain decisions, not direct state JSON edits.
Atomic state writes, review evidence and actual human approvals remain independent.
Changed reviewed inputs require revalidation, not restamping old hashes.

## Artifact and editing rules

### No-Direct-Markdownlint-on-Agent-Output Rule

Do not lint `agent-output/**` directly. Git artifact-validation and the designated review owner
enforce that content contract; repository agent runtime hooks are unrelated and retired.

### No-Shell-Writes-to-Agent-Output Rule

Use editing tools, not redirects/heredocs/tee, for generated artifacts. Preserve unrelated user work.
Validate non-Markdown shapes, actual command results and rendered outputs before completion.

### Challenger-Subagent Fallback Rule

Unavailable reviewer capability blocks the affected phase. Do not substitute self-review,
silently widen allowlists or request predetermined APPROVED/zero findings.
Optional manual Challenger is not an automatic fallback or fresh review allowance.

## Verification

Use focused native contract/frontmatter tests, then `npm run validate:agents`,
`npm run validate:skills`, `npm run validate:model-consistency` and relevant domain checks.
Update callers/tests/docs when body interaction or ownership changes.
Static validation is not native runtime certification; record exactly what was actually exercised.
