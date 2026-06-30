---
description: "Shared operating frame for main step agents — read SKILL.md once, use apex-recall for cached lookups, never edit upstream artifacts. Pairs with each agent's body-level Operating frame H2."
applyTo: ".github/agents/*.agent.md"
---

# Agent Operating Frame — Shared Rules

> **Scope**: this file is auto-loaded for every main agent in
> `.github/agents/*.agent.md` (single-star glob — `_subagents/` is
> deliberately excluded). It captures the project-wide operating
> rules that previously lived as 4 near-identical H2 sections
> (`## Context Awareness`, `## Scope Fencing`, `## Subagent Budget`,
> `## Investigate Before Answering`) inside each agent body.
>
> Each agent now ships a tight body-level `## Operating frame`
> section (≤ 6 lines) that lists only the agent-specific subagents
> and the one-line scope statement, and pulls everything else from
> here.

---

## Read each SKILL.md once

- When a SKILL.md is named in an agent's mandatory-read list, read it
  exactly once at boot — never re-read mid-session.
- The same applies to `references/*.md` files. If you have already
  read a reference in this conversation, do not call `read_file`
  on it again — use the content already in context.
- Re-reading the same file is the single biggest avoidable source of
  input-token bloat. See
  [`agent-authoring.instructions.md`](agent-authoring.instructions.md#context-hygiene-token-efficiency).

## Use `apex-recall` for cached lookups

- Use `apex-recall show <project> --json` to retrieve cached
  decisions, findings, and artifact state instead of re-reading
  predecessor artifacts after the boot read.
- The `--json` flag is canonical — never parse the human-readable
  output. Schema and jq templates:
  [`tools/apex-recall/docs/show-schema.md`](../../tools/apex-recall/docs/show-schema.md).
- If `apex-recall` returns useful context, **skip** redundant file
  reads. If it returns empty or errors, proceed normally — it is a
  convenience, not a blocker.

## Investigate before answering

- Read the implementation plan, governance constraints, and prior
  artifacts (via `apex-recall show`) before generating any new
  content for the current step.
- Verify external contracts (AVM module schemas, Azure REST APIs,
  policy effects) via the preflight or validate subagent named in
  the agent's `## Operating frame`. Do not assume.

## Never edit upstream artifacts

- Each step owns specific artifacts. Never edit an artifact owned
  by an earlier step — the workflow graph enforces this via
  `metadata.plan_lock` after gate-3 (Plan Approval).
- Drift between phases must unwind to the owning agent (governance
  → 04g, plan → 04/05, code → 06b/06t). Do not patch in place.

## Validate every artifact after writing

Immediately after writing any non-markdown artifact, run the matching
shape-check command. Fail closed: fix and re-run before handing off.
The canonical table lives in the `azure-artifacts` skill
([Post-write validation](../skills/azure-artifacts/SKILL.md#post-write-validation));
the rows below are an inline cheat sheet so agents never need to chase
the link mid-write.

| Artifact type                              | Validator command (run after each write)                                |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `*.json`                                   | `python -m json.tool <file> >/dev/null`                                 |
| `*.bicep`                                  | `bicep build --stdout <file> >/dev/null`                                |
| `*.tf` (inside a module dir)               | `terraform fmt -check <file>` then `terraform validate`                 |
| `challenge-findings-*.json` (sidecar JSON) | `node tools/scripts/validate-challenger-findings.mjs <file>`            |
| `challenge-findings-*-decisions.json` (per-finding sidecar) | `node tools/scripts/validate-challenge-findings-decisions.mjs <file>` |
| `*.md` artifact                            | Delegated to lefthook `artifact-validation` — do NOT invoke directly  |

Markdown artifacts are validated by the lefthook `artifact-validation`
pre-commit hook — do not invoke `lint:artifact-templates` /
`markdownlint-cli2` directly.

## Subagent budget — agent-specific

- Every main agent declares its subagent budget in its body-level
  `## Operating frame` section. The budget lists subagents the agent
  is allowed to invoke and the role each plays (lint, validate,
  challenger review, cost estimate, etc.).
- Cross-family model calls (e.g., GPT-5.5 → Claude Sonnet 5
  `bicep-whatif-subagent`) preserve JSON-shaped contracts verbatim;
  no parsing changes are required at the parent agent.
- The canonical model mix is tracked in repo memory
  (`codegen-model-mix-2026.md`); refer to it for which subagent
  runs on which model.

## Out of scope for this file

- Per-agent role boundaries — kept in each agent's own
  `## Operating frame`.
- The verbatim `## Completion Handoff` contract — owned by
  [`compression-templates.md`](../skills/context-management/references/compression-templates.md#gate-boundary-clear-handoff-contract)
  and grep-locked by `tools/scripts/validate_orchestrator_handoff.py`.
- Mid-step `/clear` between challenger passes — owned by the
  orchestrator's Session Break Protocol.
