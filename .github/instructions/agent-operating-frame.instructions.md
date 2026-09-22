---
description: "Shared operating frame for main step agents — read SKILL.md once, use apex-recall for cached lookups, never edit upstream artifacts. Pairs with each agent's body-level Operating frame H2."
applyTo: ".github/agents/*.agent.md"
---

# Agent Operating Frame — Shared Rules

Applies when authoring main agent files; `_subagents/` is excluded by the glob.
An `applyTo` match does not establish runtime attachment when executing that agent.
Keep essential role, approval, stop, and output constraints in its body; use this
shared guidance when attached or explicitly loaded, not as an assumed inherited prompt.

## Read each SKILL.md once

- Load each required skill at the phase specified by the agent; defer optional references.
- Reuse unchanged content still available in context. After a source change,
  compaction, or a new chat, load only the missing or changed material needed for the task.
- Do not repeat a complete read for an already available section.

## Use `apex-recall` for cached lookups

- Use `apex-recall show <project> --json` for decisions, findings, and artifact state.
  Read response fields under `session`; schema:
  [`show-schema.md`](../../tools/apex-recall/docs/show-schema.md).
- Reuse sufficient, current recall results. A path inventory is not the full artifact;
  read required missing sections directly. Empty or failed recall is not permission
  to skip prerequisites, approvals, or recovery checks.

## Investigate before answering

- Read only the current phase's required inputs. Requirements must not wait for
  a future architecture or plan; CodeGen must have the approved plan and governance inputs.
- Missing required predecessors block the step and return to their owner.
  Do not generate substitutes or load all prior artifacts for an unrelated lookup.
- Verify external contracts (AVM module schemas, Azure REST APIs,
  policy effects) via the preflight or validate subagent named in
  the agent's `## Operating frame`. Do not assume.

## Never edit upstream artifacts

- Respect graph-declared artifact ownership and mutations, including the shared SKU manifest.
  The approved implementation plan is locked under `metadata.plan_lock` after gate-3.
- Return drift to its owner (governance → 04g, plan → 05, code → 06b/06t).
  Do not patch upstream artifacts in place without an explicit mutation contract.

## Validate every artifact after writing

Immediately after writing any non-markdown artifact, run the matching
shape-check command. Fail closed: fix and re-run before handing off.
Load the canonical [Post-write validation](../skills/apex-azure-artifacts/SKILL.md#post-write-validation)
commands before writing; do not duplicate the table in agent bodies.
For incremental IaC, preserve the readiness checks and build cadence in
[`codegen-shared-workflow.md`](../skills/apex-iac-common/references/codegen-shared-workflow.md).
Deferred checks are not passes and block completion until resolved.

Markdown artifacts are validated by the lefthook `artifact-validation`
pre-commit hook — do not invoke `lint:artifact-templates` /
`markdownlint-cli2` directly.

## Subagent budget — agent-specific

- Follow the agent's declared subagent budget; the orchestrator uses handoff buttons only.
- Main agents, including `10-Challenger`, use `disable-model-invocation: true`.
  If a required worker is unavailable, stop and request a human handoff; never
  invoke a main agent as a nested wrapper or widen the caller's allowlist.
- Reviewer discovery failure requires a human handoff to `10-Challenger`.
  Missing or empty reviewer output permits exactly one identical-input retry,
  then a human handoff; follow the
  [review protocol](../skills/apex-azure-defaults/references/adversarial-review-protocol.md#subagent-discovery-fallback-default--deep).
- Preserve structured output contracts across model families.
- Agent frontmatter owns model assignments; the registry mirrors them. Do not use
  repository memory or duplicated prose as an alternative model authority.
- Model labels do not establish runtime cost-tier eligibility or API parameters.
  If the active harness cannot honor required tools or model routing, stop.

## Out of scope for this file

- Per-agent role boundaries — kept in each agent's own
  `## Operating frame`.
- The verbatim `## Completion Handoff` contract — owned by
  [`compression-templates.md`](../skills/apex-context-management/references/compression-templates.md#gate-boundary-clear-handoff-contract)
  and grep-locked by `tools/scripts/validate_orchestrator_handoff.py`.
- Mid-step `/clear` between challenger passes — owned by the
  orchestrator's Session Break Protocol.
