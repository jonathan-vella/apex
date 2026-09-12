<!-- ref:operational-safety-v1 -->
# Operational Procedure Boundary

Apply this boundary before executing a retained utility procedure. Local prompt
frontmatter remains the operation's routing contract; a shared reference does
not grant tools, change the active model, or select a recipient agent.

- Require current inputs and explicit scope. Missing tools, model evidence,
  source files, or user approvals block the operation. Report the blocker.
- Preserve the operation's allowed output paths and read-only source boundaries.
  Read-only audits may write their declared reports, not the reviewed sources.
- State flows through `apex-recall`; never directly read/write session-state
  JSON, fabricate completed steps, or treat reconstructed artifacts as review
  evidence. Frozen upstream files stay read-only.
- Before any specialist step, stop and request manual selection of the exact
  named owner with its configured model using the
  [workflow entry contract](workflow-entry.md). Never execute a Sol step inline
  under MAI or invoke it as a MAI subagent.
- A request for reviewer fan-out is not permission for unnamed default workers.
  Use only explicitly named, available reviewers permitted by the caller's
  allowlist and actual harness. If these are unavailable, stop and report the
  independent review as blocked; do not simulate independent passes inline.
- Workers use the [execution contract](execution-subagent.md): no user questions,
  parent todos, nested delegation, or automatic model fallback. Explicit caller
  allowlists control invocation despite recipient model-invocation flags.
- Do not enable experimental nesting or context forks. Human approval and
  required review gates do not depend on preview scoped hooks.
- Verify checks by actual results and distinguish static source evidence from
  runtime evidence. Native Agent Host discovery and execution are manual and
  unverified; Local prompts are not Host entrypoints.
