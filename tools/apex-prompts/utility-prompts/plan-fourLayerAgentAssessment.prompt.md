# Plan: 4-Layer Per-Agent Assessment Harness

Build reusable tooling that scores **every agent** (main + subagents) across all
four layers and emits a per-agent scorecard plus a ranked fleet report — then run
it once. Layers 1–2 mechanical parts are deterministic (a script reusing existing
validators); the judgment parts (qualitative Layer 2 + Layer 4 adversarial) fan out
to `Explore` subagents against fixed rubrics; Layer 3 reuses the debug-log profiler.
A read-only plan with an approval gate before any agent edits — mirroring the
`tools/apex-prompts/utility-prompts/assess-github-folder.prompt.md` pattern.

**Why this shape:** the challenger (Layer 4) is artifact-type scoped to
`agent-output/` infra artifacts and **cannot target `.agent.md`** — so Layer 4 uses
a generic adversarial pass with a new agent-definition checklist instead of
extending the challenger schema.

## Locked decisions

- **Deliverable:** reusable tooling (assess-agents prompt + script + rubric refs) + a first run.
- **Layer 4:** generic adversarial pass via `Explore` subagent + a NEW agent-definition
  checklist (the `challenger-review-subagent` cannot target `.agent.md`).
- **Scope:** ALL agents — main `.github/agents/*.agent.md` + subagents under
  `.github/agents/_subagents/`. Derive the agent list from the filesystem walk
  (`tools/scripts/_lib/workspace-index.mjs#getAgents`), then enrich with
  `tools/registry/agent-registry.json` (no hard-coded counts).

## The 4 layers (grounded)

- **L1 Mechanical** (deterministic, existing validators): `validate:agents`
  (frontmatter / structural / model-alignment / vendor-prompting / workflow-handoffs),
  `validate:agent-registry`, `validate:model-consistency`, `validate:deprecated-models`,
  `validate:model-catalog`, `validate:workflow-graph`, `lint:workflow-table-sync`,
  `lint:glob-audit`, `lint:orphaned-content`, `check:context-redundancy`,
  `lint:safe-shell`, `snapshot:baseline` / `diff:baseline`.
- **L2 Static rubric** (mechanical + judgment). ENFORCED limits (`tools/scripts/_lib/paths.mjs`):
  body ≤ 600 (`MAX_BODY_LINES`), description ≤ 350 chars, Claude body > 350 needs
  `<context_awareness>` (`legacy-003`), research agents (03/05/11) need
  `<investigate_before_answering>` (`legacy-004`), ONE-SHOT agents (02-Requirements,
  challenger-subagent) MUST NOT have the investigate block (`claude-oneshot-001`),
  artifact agents need `<output_contract>`, `applyTo:"**"` instr ≤ 50, broad-md ≤ 200,
  SKILL no-refs ≤ 200. SOFT (not enforced): tools ≤ 30, handoffs ≤ 8 (orchestrators
  exempt), skill-reads ≤ 5, instr ≤ 150. GPT-5.5 agents need H1 sections
  `# Goal` / `# Success criteria` / `# Constraints` / `# Output` / `# Stop rules`.
  Operating-frame (main agents only, NOT subagents): read SKILL.md once, use apex-recall,
  never edit upstream artifacts.
- **L3 Runtime** (debug-log dependent): `tools/scripts/profile_debug_log.py` (OTel JSON →
  tokens / dup-reads / tool-payloads / askQuestions / subagent walltime / errors;
  `npm run profile:debug-log`), `.github/skills/context-management/scripts/parse-chat-logs.py`
  (ccreq text → latency / model distribution), `11-Context Optimizer` agent +
  `context-audit.prompt.md`. Logs live at
  `~/.vscode-server/data/logs/*/exthost1/GitHub.copilot-chat/`. Latency bands map to
  context size.
- **L4 Adversarial** (judgment, NEW checklist for `.agent.md`): role overlap / boundary,
  missing guardrails (destructive without a gate), prompt-injection surface (untrusted
  tool/file output), instruction conflicts, handoff integrity (target exists, no silent
  model downgrade), tool over-grant, failure modes (subagent fail / validation fail /
  ceiling), stop-rule completeness.

## Deliverables (new files)

1. `tools/scripts/assess-agents.mjs` — deterministic harness. Enumerate agents via the
   filesystem walk (`tools/scripts/_lib/workspace-index.mjs#getAgents`); enrich with the
   registry; run L1 validators (reuse `tools/scripts/_lib` modules + `paths.mjs` constants,
   don't reimplement); attribute failures per agent; compute mechanical L2 metrics per
   agent (body lines, tool count, handoff count, skill-read lines, description length,
   model family, regex presence of `<context_awareness>` / `<investigate_before_answering>`
   / `<output_contract>`, GPT H1 sections); optionally ingest a `profile_debug_log.py`
   JSON for L3. Emit per-agent scorecard JSON + `fleet-summary.{json,md}` to
   `agent-output/_baselines/agent-assess-{ts}/` (gitignored). Wire `npm run assess:agents`.
2. `tools/schemas/agent-scorecard.schema.json` — JSON schema for a scorecard
   (ajv-validatable; mirrors `tools/schemas/lesson-log.schema.json` style).
3. `tools/apex-prompts/utility-prompts/assess-agents.prompt.md` — orchestrating prompt
   (`model:` explicit Claude Opus; `agent: agent`; tools read / search / execute / agent /
   todo; `argument-hint` scope). Phases: **0** run the script (L1 + mechanical L2 + optional
   L3); **1** fan out one `Explore` per agent for qualitative L2 vs the rubric; **2** L3
   runtime (profile logs if provided, else N/A + how-to-capture); **3** L4 adversarial
   fan-out (`Explore` per agent vs the checklist); **4** aggregate → per-agent scorecards +
   ranked fleet plan; **GATE** before edits. `output_contract` + resumable plan. Follows the
   `assess-github-folder.prompt.md` pattern (read-only plan, approval gate).
4. `tools/apex-prompts/utility-prompts/references/agent-scorecard-rubric.md` — L2 qualitative
   dimensions + 0–5 scoring bands + subagent-reduced variant + weights.
5. `tools/apex-prompts/utility-prompts/references/agent-adversarial-checklist.md` — L4
   red-team lenses for `.agent.md` / subagents / prompts.

## Scorecard schema (per agent)

Dimensions → `{score 0-5 | pass/warn/fail, evidence, severity blocker/high/med/low, layer}`:

1. **Mechanical contract (L1)** — validator pass/fail attributed; any hard fail ⇒ blocker
   flag (caps composite).
2. **Frontmatter & model integrity (L2)** — required fields, model-consistency,
   description ≤ 350.
3. **Context efficiency (L2)** — body vs 600/350, tools vs 30, handoffs vs 8 (orchestrator
   exempt), skill-reads vs 5.
4. **Vendor prompting (L2)** — Claude blocks per model family OR GPT H1 sections; ONE-SHOT
   correctness.
5. **Role clarity & boundary (L2 judgment)** — does/doesn't-do, single responsibility,
   overlap with neighbors.
6. **Operating-frame & safety (L2; frame N/A for subagents)** — SKILL once, apex-recall,
   never edit upstream; destructive gating, no interactive shell, no secrets.
7. **Runtime behavior (L3; N/A if no logs)** — token cost, dup reads, latency band,
   askQuestions batching.
8. **Adversarial (L4)** — red-team findings with severity.

Composite weights: L1 .20 (hard fail caps), ctx .15, vendor .15, role .15, frame+safety .10,
runtime .10, adversarial .15. Fleet roll-up ranks agents by risk (blockers first, then
weighted composite ascending).

## Phases

- **A. Harness script + schema** (`assess-agents.mjs`, `agent-scorecard.schema.json`) +
  npm wire. Depends on nothing.
- **B. Rubric + adversarial checklist refs.** Parallel with A.
- **C. Orchestrating prompt** (`assess-agents.prompt.md`). Depends on A + B (references them).
- **D. First run:** `npm run assess:agents` → then prompt phases 1 + 3 (`Explore` fan-out)
  → aggregate. Depends on A + B + C.
- **E. Validate tooling:** `validate:agents` (prompt rules), `lint:md`, `lint:safe-shell`,
  `lint:vendor-prompting`, `lint:js`, ajv schema check, `validate:no-hardcoded-counts`.
  Depends on A–D.

## Verification

- `npm run validate:agents` — the new prompt passes frontmatter + vendor-prompting +
  `prompt-model-source-001`.
- `npm run lint:md` + `lint:safe-shell` + `lint:vendor-prompting` on the new prompt/refs.
- `npm run lint:js` on `assess-agents.mjs` (eslint clean, `--max-warnings=0` under `tools/scripts`).
- `node -e` ajv-validate a sample scorecard vs `agent-scorecard.schema.json`.
- `npm run assess:agents` emits N scorecards (N derived) + `fleet-summary.md`, no crash;
  outputs land in `agent-output/_baselines/`.
- Spot-check attribution: `01-orchestrator` scorecard shows handoffs > 8 as soft-only
  (not blocker); a clean agent scores high; a Claude agent > 350 lines without
  `<context_awareness>` shows a vendor fail.
- `npm run validate:no-hardcoded-counts` passes (fleet summary derives counts, no literal counts).

## Scope boundaries

- **Included:** assessment tooling (read-only plan + scorecards), first run, validation of
  the new tooling.
- **Excluded (separate gated pass):** applying any agent fixes the assessment surfaces;
  extending the challenger schema; new committed agent; modifying existing agents. Outputs
  are gitignored baselines unless the user asks to commit the tooling.

## Further considerations

1. **Home for rubric/checklist:** references next to the prompt (lighter, chosen) vs. a new
   skill (more discoverable, needs trigger tests). Recommend references now.
2. **L1 attribution:** `validate-agents.mjs` prints text, not per-agent JSON. Prefer importing
   `_lib` validator functions; fallback parse of stderr. Risk noted.
3. **L3 realism:** needs real debug logs to be non-N/A. The first run may mark L3 N/A + emit
   capture instructions unless the user provides a log.
