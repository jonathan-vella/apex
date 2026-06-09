<!-- ref:checklists-v1 -->

# Audit Checklists

Copy-paste reviewer checklists. Each item has:

- A Yes/No question
- Its `rules.json` rule ID
- A verification hint (grep pattern, command, or visual cue)

Two parallel checklists: agent (`*.agent.md`) and prompt
(`*.prompt.md`).

---

## Agent Checklist (`*.agent.md`)

### Cross-vendor (apply to every agent)

- [ ] **R-X-3** Frontmatter `model:` is array form, not bareword.
      _(rule `frontmatter-model-style-001`)_
      Hint: `head -10 <file>` and confirm `model: [...]`.
- [ ] **R-X-2** No `handoffs[].model` overrides match the target
      agent's own model. _(rule `legacy-002`)_
      Hint: `--only=vendor-prompting` flags `legacy-002`.
- [ ] **R-X-4** Every `handoffs[].prompt` contains both an Input
      reference and an Output reference. _(rule `handoff-enrichment-001`)_
      Hint: `grep -A1 "prompt:" <file> | grep -E "agent-output|Input:|Output:"`.
- [ ] **R-X-7** Absolute words density (ALWAYS/NEVER/MUST/HARD RULE)
      ≤ 0.05 outside security/governance/approval-gate paragraphs.
      _(rule `cross-language-density-001`)_
      Hint: `grep -ciE "ALWAYS|NEVER|MUST|HARD RULE" <file>` and divide
      by `wc -l`.
- [ ] **R-X-8** Model is not on the deprecation list.
      _(rule `model-deprecation-001`)_
      Hint: `node tools/scripts/validate-models.mjs --only=deprecated`.

### Claude family (Opus / Sonnet / Haiku)

- [ ] **R-CL-3** If body > 350 lines, includes `<context_awareness>`.
      _(rule `legacy-003`)_
      Hint: `wc -l <file>` and `grep "<context_awareness>" <file>`.
- [ ] **R-CL-2** Research agents (Architect, IaC Planner,
      Context Optimizer) include `<investigate_before_answering>`.
      _(rule `legacy-004`)_
      Hint: `grep "<investigate_before_answering>" <file>`.
- [ ] **R-CL-2 counter** ONE-SHOT agents (Requirements, Challenger
      subagent) DO NOT include `<investigate_before_answering>`.
      _(rule `claude-oneshot-001`)_
- [ ] **R-CL-4** No prefill instructions ("prefill the assistant",
      "assistant prefill", "prefilled response").
      _(rule `claude-no-prefill-001`)_
      Hint: `grep -iE "prefill|prefilled" <file>`.
- [ ] **R-CL-5** Artifact-producing agents include `<output_contract>`.
      _(rule `claude-output-contract-001`)_
      Hint: `grep -E "agent-output/" <file>` then
      `grep "<output_contract>" <file>`.
- [ ] **R-CL-1** Few-shot examples wrapped in `<example>` tags
      (reviewer-only).
      Hint: `grep -E "Example|<example>" <file>`.

### GPT-5.5 family

- [ ] **R-GPT-1** All outcome-first skeleton sections present:
      `# Goal`, `# Success criteria`, `# Constraints`, `# Output`,
      `# Stop rules`. _(rule `gpt55-skeleton-001`)_
      Hint:
      `grep -E "^# (Goal|Success criteria|Constraints|Output|Stop rules)" <file>`.
- [ ] **R-GPT-1** `# Personality` present ONLY if user-facing
      Orchestrator. _(rule `personality-scoping-001`)_
      Hint: check `frontmatter.user-invocable` and `frontmatter.name`.
- [ ] **R-GPT-2** `# Stop rules` body is non-empty.
      _(rule `gpt55-stop-rules-non-empty-001`)_
      Hint: read the section; reject if only contains the heading.
- [ ] **R-GPT-4** No Claude-only XML blocks present
      (`<investigate_before_answering>`, `<context_awareness>`,
      `<scope_fencing>`, `<empty_result_recovery>`,
      `<subagent_budget>`, `<output_contract>`).
      _(rule `gpt-no-claude-xml-001`)_
      Hint: `grep -E "<investigate_before_answering>|<context_awareness>|<scope_fencing>|<empty_result_recovery>|<subagent_budget>|<output_contract>" <file>`.
- [ ] **R-GPT-6** Retrieval-heavy agents embed an explicit retrieval
      budget (reviewer-only).

### Decision logging

- [ ] **R-X-5** Significant decisions appended to
      `decision_log` in `00-session-state.json` (reviewer-only).

---

## Prompt Checklist (`*.prompt.md`)

### Cross-vendor

- [ ] **R-X-3** Frontmatter `model:` is string form, not array.
      _(rule `frontmatter-model-style-001`)_
- [ ] **R-X-1** Prompt `model:` matches target agent's `model:`.
      _(rule `legacy-001` / `prompt-model-sync-001`)_
      Hint: `node tools/scripts/validate-agents.mjs --only=vendor-prompting`.
- [ ] **R-X-8** Model is not on the deprecation list.
      _(rule `model-deprecation-001`)_

### Claude family (when prompt targets a Claude agent)

- [ ] **R-CL-4** No prefill instructions.
      _(rule `claude-no-prefill-001`)_

### GPT-5.5 family (when prompt targets a GPT-5.5 agent)

- [ ] Reviewer-only: prompt does not over-specify procedure when the
      target agent should describe the destination.

---

## Verdict template

After completing both columns, fill in:

```text
File:            <path>
Model family:    <claude-opus | claude-sonnet | gpt-5.5 | ...>
Errors:          <count>      ← rule IDs at severity error
Warnings:        <count>      ← rule IDs at severity warn
Info:            <count>      ← rule IDs at severity info
Reviewer notes:  <freeform>

Verdict:         APPROVED | NEEDS_REVISION | REJECTED
```

Apply gate from
[audit-procedure.md](audit-procedure.md):

- APPROVED if errors == 0 AND warnings ≤ 5
- NEEDS_REVISION otherwise
- REJECTED if any rule violation indicates the agent will fail at
  runtime (e.g., `frontmatter-model-style-001`,
  `claude-no-prefill-001` on a Claude 4.6+ target)
