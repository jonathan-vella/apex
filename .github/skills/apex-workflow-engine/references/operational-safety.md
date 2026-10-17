<!-- ref:operational-safety-v1 -->
# Operational Procedure Boundary

Apply this boundary before a utility procedure in the VS Code Copilot SDK harness.
The owning agent and approved scope control execution; a skill/reference does
not grant tools, change the active model, or select a recipient.

- Require current inputs and explicit scope. Missing tools, required worker readiness,
  source files, or user approvals block the operation. Report the blocker.
- Preserve the operation's allowed output paths and read-only source boundaries.
  Read-only audits may write their declared reports, not the reviewed sources.
- State flows through `apex-recall`; never directly read/write session-state
  JSON, fabricate completed steps, or treat reconstructed artifacts as review
  evidence. Frozen upstream files stay read-only.
- Follow the [workflow entry contract](workflow-entry.md): Orchestrator alone
  dispatches approved main workers after [verified readiness](worker-readiness.md).
  Direct owner selection remains supported. Model selection belongs to the
  operator and runtime; model telemetry and picker selection are diagnostics only.
  Never do specialist work inline or accept unlinked worker identity as evidence.
- A request for reviewer fan-out is not permission for unnamed default workers.
  Use only explicitly named, available reviewers permitted by the caller's
  allowlist and actual harness. If these are unavailable, stop and report the
  independent review as blocked; do not simulate independent passes inline.
- Leaf workers use the [execution contract](execution-subagent.md): no user questions,
  parent todos, nested delegation or model fallback. Step workers may call their
  authorized leaves; pending user forms return to the interactive parent.
- Do not enable experimental skill context forks. Human approval and
  required review gates do not depend on preview scoped hooks.
- Verify checks by actual results and distinguish static source evidence from
  runtime evidence. Static contracts do not certify actual native discovery,
  routing or permissions; archived Local prompts are not entrypoints.
