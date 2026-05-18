# Smoke-run harness — Plan 01 token-reduction acceptance

Minimal manual end-to-end test for Plan 01 Phase 2a / 2b / 2c
acceptance. A fake project taken through **Steps 1 → 2** of the APEX
workflow with deliberate `/clear` boundaries between gates. Captures
the four headline signals that prove the plan landed.

## What to capture

Per workflow run:

| Signal                        | How to capture                                                                                  | Plan 01 target                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| OTel log                      | Export from VS Code Copilot Chat: cmd palette → "Copilot: Export debug log"                     | Save under `logs/smoke-<date>.json` |
| `apex-recall` state           | `apex-recall show <project> --json > tmp/smoke-state.json`                                      | Captures resume contract            |
| askQuestions count            | `npm run profile:debug-log -- logs/smoke-<date>.json --json \| jq '.totals.askquestions_count'` | ≤ 20 (whole log; per-finding gates) |
| Challenger invocations        | Same profiler output: `.totals.challenger_invocations`                                          | ≤ 2 per step (default depth)        |
| Inter-`/clear` chat-span max  | `.compliance_metrics.max_chat_spans_between_clears`                                             | ≤ 50                                |
| Post-`/clear` first input tok | First `chat:*` span's `gen_ai.usage.input_tokens`                                               | ≤ 45 000                            |

## Steps

### 0. Prep

1. Fresh chat session — open VS Code Copilot Chat, no prior history.
2. **Review depth**: no action needed. `decisions.review_depth`
   defaults to `"default"` when absent (per
   `01-orchestrator.agent.md` → "Computing `decisions.review_depth`"
   → _"Default value when absent: `default`."_). The 2-pass ceiling
   applies automatically.

   _Only if you want the deep (4-pass) path instead_, run **after**
   the orchestrator initialises the project:

   ```sh
   apex-recall decide <project> --key review_depth --value deep \
     --rationale "Multi-pass adversarial review required" --json
   ```

### 1. Step 1 — Requirements (target Gate 1)

1. Switch the chat agent picker to `01-Orchestrator` and send a tiny
   project description (e.g. _"smoke-test, a small Node.js web app for
   an internal HR form, Sweden Central, prod-grade, Bicep"_).
2. Confirm the project name when prompted.
3. Orchestrator hands off to `02-Requirements`.
4. **Watch for the P0 batching directive** (Plan 01 Phase 4):
   Requirements should fire ONE `askQuestions` call with 6+
   questions, not 6 separate calls.
5. Accept Gate 1 when the orchestrator presents it.
6. **The orchestrator MUST end the message with the verbatim resume
   line** (Plan 01 Phase 2a):

   ```text
   Run `/clear`, then switch the chat agent picker to `01-Orchestrator` and send `resume smoke-test` to continue Step 2.
   ```

   If the line is missing or paraphrased → **smoke run fails**.

### 2. `/clear` and resume

1. Run `/clear` in the chat.
2. Switch the chat agent picker back to `01-Orchestrator` and send
   `resume smoke-test`.
3. **Watch the first turn's input-token count** (visible in the OTel
   log after export). It MUST be ≤ 45 000 — confirms the `/clear`
   actually dropped context.
4. The orchestrator's first tool call MUST be
   `apex-recall show smoke-test --json`. If it re-reads
   `01-requirements.md` instead, the resume path is broken.

### 3. Step 2 — Architecture (target Gate 2)

1. Click the **Step 2: Architecture Assessment** handoff.
2. Let the Architect run (cost-estimate subagent + WAF assessment).
3. **Challenger pass**: Gate 2 presentation should show
   `decisions.challenger_invocations_2 = 1`. If a second pass fires
   without an explicit Override decision → ceiling broken
   (Plan 01 Phase 2b).
4. Accept Gate 2.
5. Verify the same `/clear` resume line is emitted again, this time
   for Step 3.

### 4. Capture + verify

One-shot verifier — **auto-exports the live debug log** from VS Code
Copilot Chat's on-disk JSONL, converts to OTel, profiles, runs the
ceiling budget check, evaluates every acceptance target, and saves
the result:

```sh
npm run smoke:verify
```

That's it — no manual export, no date substitution. The script:

1. Discovers the newest `main.jsonl` under
   `~/.vscode-server/data/User/workspaceStorage/*/GitHub.copilot-chat/debug-logs/*/`.
2. Converts JSONL → OTel envelope and writes
   `logs/smoke-<today>.json`.
3. Prints a PASS / FAIL / WARN / SKIP row per acceptance target and a
   final verdict.
4. Saves the full profiler+computed JSON to
   `agent-output/_baselines/smoke-<today>.json`.

Exits `0` on all-pass, `1` on any FAIL. WARN-only rows do not fail
unless `--strict`.

Variants:

```sh
npm run smoke:verify -- logs/older-export.json   # use a specific log
npm run smoke:verify -- --no-auto-export         # require explicit path
npm run smoke:verify -- --strict                 # WARN counts as FAIL
```

For ad-hoc spot checks, the underlying tools still work standalone:

```sh
npm run profile:debug-log -- logs/smoke-<date>.json
npm run validate:review-ceiling -- --budget logs/smoke-<date>.json
```

## Acceptance criteria

A smoke run is **green** when ALL of these are true:

- [ ] askQuestions count ≤ 20 across the whole log (per-finding gates
      may legitimately fire multiple prompts per challenger pass)
- [ ] Challenger invocations ≤ 2 per step
- [ ] Inter-`/clear` chat-span max ≤ 50
- [ ] Post-`/clear` first chat-call input tokens ≤ 45 000
- [ ] Verbatim `/clear` resume line emitted at every accepted gate
- [ ] Orchestrator's first post-`/clear` tool call is
      `apex-recall show <project> --json` (not artifact reads)

## When this harness is used

- **Phase 2a acceptance**: must pass before merging Phase 2a to `main`.
- **Phase 2b acceptance**: must pass before merging Phase 2b to `main`.
- **Phase 4 acceptance**: askQuestions count is the headline check.
- **Phase 3 A/B pilot**: re-run on `test/challenger-sonnet` branch
  and compare findings to a baseline run on `main` — quality rubric
  is in `/memories/repo/codegen-model-mix-2026.md`.
- **Quarterly regression**: re-run to catch silent drift.
