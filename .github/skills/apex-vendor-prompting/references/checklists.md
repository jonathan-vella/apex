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
- [ ] Every fallback is an exact catalog label. Unknown release/cost metadata stays unknown; no fallback was added.
- [ ] Empty `agents: []` needs no agent tool; nonempty lists require it.
      Workers have no question, parent-todo or nested-delegation tools. Explicit
      allowlists can override target `disable-model-invocation: true`.
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

### Claude Opus 5.5

- [ ] **R-CL-3** If body > 350 lines, includes `<context_awareness>`.
      _(rule `legacy-003`)_
      Hint: `wc -l <file>` and `grep "<context_awareness>" <file>`.
- [ ] **R-CL-2** Research agents include `<investigate_before_answering>`.
      _(rule `legacy-004`)_
- [ ] **R-CL-2 counter** ONE-SHOT agents (Requirements, Challenger
      subagent) DO NOT include `<investigate_before_answering>`.
      _(rule `claude-oneshot-001`)_
- [ ] **R-CL-4** No prefill instructions.
      _(rule `claude-no-prefill-001`)_
      Hint: `grep -iE "prefill|prefilled" <file>`.
- [ ] **R-CL-5** Artifact-producing agents include `<output_contract>`.
      _(rule `claude-output-contract-001`)_
- [ ] **R-CL-8** No "think step by step / think carefully / show your reasoning" lines.
      _(rule `claude-reasoning-extraction-001`)_
      Hint: `grep -iE "think (step|carefully|hard)|your reasoning|chain[- ]of[- ]thought" <file>`.
- [ ] **R-CL-9** Long-running agents name unwanted early stops and the wanted ones
      (approval gates, blocking inputs). _(rule `claude-early-stop-001`, reviewer-only)_
- [ ] **R-CL-10** Pasted or external text is tag-marked and treated as data.
      _(rule `claude-pasted-content-001`, reviewer-only)_
- [ ] **R-CL-12** No generic "double-check / re-verify" instructions; required validators kept.
      _(rule `claude-self-verification-001`, reviewer-only)_
- [ ] **R-CL-13** Narrow tasks state their scope. _(rule `claude-task-scope-001`, reviewer-only)_
- [ ] **R-CL-14** Delegating agents say when to spawn subagents and cap them.
      _(rule `claude-subagent-control-001`, reviewer-only)_
- [ ] **R-CL-15** Artifact length calibrated; review prompts ask for full coverage.
      _(rule `claude-deliverable-length-001`, reviewer-only)_
- [ ] **R-CL-1** Few-shot examples wrapped in `<example>` tags (reviewer-only).

### GPT-6 Sol/Luna And GPT-5.6 Terra

- [ ] **R-GPT-1** Nonempty Role, Goal, Success criteria, Constraints, Output and
      Stop rules sections. _(rule `gpt-outcome-contract-001`)_
      Hint:
      `grep -E "^##? (Role|Goal|Success criteria|Constraints|Output|Stop rules)" <file>`.
- [ ] Leaf workers instead have Inputs, Outputs, and bounded failure/return rules.
- [ ] **R-GPT-5** Personality present only on user-facing agents.
      _(rule `personality-scoping-001`)_
- [ ] **R-GPT-2** Stop rules body is non-empty.
      _(rule `gpt-stop-rules-non-empty-001`)_
- [ ] **R-GPT-4** No Claude-only XML blocks; Markdown replacements keep their constraints.
      _(rule `gpt-no-claude-xml-001`)_
- [ ] **R-GPT-6** Approval policy stated once; authorized reversible work done before asking.
      _(rules `gpt-approval-repetition-001`, `gpt-initiative-001`)_
      Hint: `grep -ciE "ask first|wait for (user )?approval|get approval|do not mutate" <file>` ≤ 3.
- [ ] **R-GPT-7** (GPT-6) Skill-vs-user precedence stated, with APEX invariants carved out.
      _(rule `gpt-skill-precedence-001`, reviewer-only)_
- [ ] **R-GPT-8** (GPT-6) Verification calibrated to change size; required validators kept.
      _(rule `gpt-testing-calibration-001`, reviewer-only)_
- [ ] **R-GPT-9** User-facing output names concrete style choices, not blanket "be concise".
      _(rule `gpt-writing-style-001`, reviewer-only)_
- [ ] **R-GPT-10** (GPT-6) Agents with subagents state when and how much to delegate.
      _(rule `gpt-subagent-delegation-001`, reviewer-only)_
- [ ] **R-GPT-11** Retrieval-heavy agents embed a retrieval budget; no repeated rules (reviewer-only).

### Decision logging

- [ ] **R-X-5** Significant decisions recorded through `apex-recall decide`
      without direct session-state writes (reviewer-only).

---

## Prompt Checklist (`*.prompt.md`)

### Cross-vendor

- [ ] **R-X-3** Explicit frontmatter `model:` is string form, not array.
      _(rule `frontmatter-model-style-001`)_
- [ ] **R-X-1** Custom-agent prompt inherits its known target model; generic
      Local prompts may inherit picker selection. _(rule `prompt-model-source-001`)_
      Hint: `node tools/scripts/validate-agents.mjs --only=vendor-prompting`.
- [ ] **R-X-8** Model is not on the deprecation list.
      _(rule `model-deprecation-001`)_

### Claude Opus 5.5 (when prompt resolves to Claude)

- [ ] **R-CL-4** No prefill instructions.
      _(rule `claude-no-prefill-001`)_
- [ ] **R-CL-8** No visible-reasoning instructions.
      _(rule `claude-reasoning-extraction-001`)_
- [ ] **R-CL-10** Pasted input is tag-marked. _(rule `claude-pasted-content-001`, reviewer-only)_

### GPT-6 Sol/Luna And GPT-5.6 Terra

- [ ] Reviewer-only: prompt states the outcome instead of over-specifying procedure.
- [ ] **R-GPT-9** Output style is named concretely. _(rule `gpt-writing-style-001`, reviewer-only)_

---

## Verdict template

After completing both columns, fill in:

```text
File:            <path>
Model family:    <claude-opus-5.5 | gpt-6-sol | gpt-6-luna | gpt-5.6-terra | mai-code>
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
