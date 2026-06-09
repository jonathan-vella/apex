---
description: "Score every agent (main + subagents) across the four assessment layers — deterministic L1/L2 via the assess-agents harness, judgment L2 role clarity + L4 adversarial via Explore fan-out, optional L3 runtime from a debug-log profile. Produces per-agent scorecards + a ranked fleet plan. Plans only — never edits an agent in the same pass."
model: "Claude Opus 4.8"
agent: agent
tools:
  - read
  - search
  - execute
  - agent
  - todo
argument-hint: "Optional: a scope filter (main | subagents | all) and/or --profile=<debug-log.json> for L3. Defaults to all, L3 = N/A."
---

# 4-Layer Per-Agent Assessment → Fleet Plan

<investigate_before_answering>
This is a static + behavioral audit of agent definitions. Findings are unreliable if scores are
guessed from memory. Before proposing ANY finding, confirm:

- The deterministic harness (Phase 0) has actually run and written scorecards.
- Each judgment finding cites a concrete line, field, handoff, or metric — never a vibe.
- Role-clarity findings name the overlapping neighbor; adversarial findings name the lens.

Do NOT edit any `.agent.md`, prompt, skill, or instruction in this pass. This prompt produces a
PLAN; execution is a separate, gated pass.
</investigate_before_answering>

<context>
This repo is APEX (Azure Agentic Platform Engineering eXperience). Scope is the agent fleet:

- `.github/agents/*.agent.md` (main, user-invocable)
- `.github/agents/_subagents/*.agent.md` (subagents, non-invocable)

The four layers (see `references/agent-scorecard-rubric.md` for bands + weights):

- L1 Mechanical — validator contract (frontmatter, structural, handoffs). Deterministic.
- L2 Static — body/tool/handoff/skill-read limits, frontmatter & model integrity, vendor-prompting
  blocks (deterministic) **plus** role clarity & boundary (judgment).
- L3 Runtime — token cost, duplicate reads, latency, subagent wall-time from a debug-log profile.
- L4 Adversarial — red-team pass against `references/agent-adversarial-checklist.md` (judgment).

The deterministic slices are produced by `tools/scripts/assess-agents.mjs`
(`npm run assess:agents`). The judgment slices (L2 role clarity, L4 adversarial) fan out to `Explore`
subagents against the fixed rubric + checklist references next to this prompt.

Why L4 is a generic adversarial pass: the `challenger-review-subagent` is artifact-type scoped to
`agent-output/` infrastructure artifacts and **cannot target `.agent.md`**. So Layer 4 uses an
`Explore` subagent against the new agent-definition checklist instead of extending the challenger
schema.

Authoritative rule sources (read on demand, do not restate):

- `references/agent-scorecard-rubric.md`, `references/agent-adversarial-checklist.md`
- `.github/instructions/context-optimization.instructions.md`,
  `.github/instructions/agent-authoring.instructions.md`,
  `.github/instructions/vendor-prompting.instructions.md`
- `tools/registry/agent-registry.json`, `tools/registry/count-manifest.json`

Do NOT hard-code fleet counts — derive them from the harness output (which walks the filesystem).
`{ts}` in output paths is a UTC timestamp: `$(date -u +%Y%m%dT%H%M%SZ)`.
</context>

<task>
Run phases in order. Stop at the Gate; require approval before any edit pass.

## Argument-hint scoping

If the user supplied `main` or `subagents`, still run **Phase 0** over the whole fleet (the harness
always scores all agents), then evaluate only the matching scope in Phases 1 + 3, and scope Phase 4's
plan to that subset. If a `--profile=<path>` was supplied, pass it through in Phase 0 for L3.

## Phase 0 — Deterministic harness (run it)

- Run `npm run assess:agents` (append `-- --profile=<path>` when a debug-log profile was supplied).
- Capture the printed output directory: `agent-output/_baselines/agent-assess-{ts}/`.
- Read `fleet-summary.md` and every `scorecards/<agent_id>.json`. These carry L1, the deterministic
  L2 metrics + vendor results, the L3 slot, and `role_clarity` + `adversarial` as `pending`.
- Note the harness-derived fleet counts and any `blocker` agents — do not recount by hand.

## Phase 1 — L2 role clarity (Explore fan-out)

For each in-scope agent, dispatch one `Explore` (quick/medium thoroughness) with a fixed task: read
the agent body + its workflow neighbors and same-track siblings, then score `role_clarity` per the
rubric. Batch related agents per call to control cost. Require each Explore to return JSON:

```json
{ "agent_id": "...", "role_clarity": { "score": 0, "severity": "none|low|medium|high",
  "evidence": ["names the overlapping neighbor / cites the anti-scope gap"] } }
```

## Phase 2 — L3 runtime

If a profile was supplied, confirm the harness attributed per-subagent wall-time and summarize token
cost, duplicate reads, latency band, and askQuestions batching per the rubric. If no profile was
supplied, mark L3 `na` for every agent and record the capture how-to: run a workflow with debug
logging, then `npm run profile:debug-log -- <log.json> --json > profile.json` and re-run Phase 0 with
`--profile=profile.json`.

## Phase 3 — L4 adversarial (Explore fan-out)

For each in-scope agent, dispatch one `Explore` against `references/agent-adversarial-checklist.md`
(all eight lenses; subagents use the reduced variant). Require each Explore to return JSON findings:

```json
{ "agent_id": "...", "adversarial": { "score": 0, "severity": "none|low|medium|high|blocker",
  "findings": [ { "lens": "...", "severity": "...", "evidence": "...", "recommendation": "..." } ] } }
```

## Phase 4 — Aggregate → scorecards + ranked plan

- Write the resolved `role_clarity` and `adversarial` dimensions back into each
  `scorecards/<agent_id>.json`, then recompute the final `composite` over all seven buckets per the
  rubric weights (any `blocker` caps it at 49). Clear `judgment_pending`.
- Produce `assessment-plan.md`: a ranked remediation plan — each item = finding, affected agent(s),
  blast radius, proposed change, layer, severity, effort. Group by severity (blocker / high / medium
  / low) and rank the fleet (blockers first, then ascending composite).

## Gate — Approval before execution

Present the plan and the top highest-leverage fixes. Do NOT edit any agent until the user approves
and explicitly starts an execution pass.
</task>

<output_contract>

- `agent-output/_baselines/agent-assess-{ts}/scorecards/<agent_id>.json` — per-agent scorecards with
  all four layers resolved (validated by `tools/schemas/agent-scorecard.schema.json`).
- `agent-output/_baselines/agent-assess-{ts}/fleet-summary.{json,md}` — harness deterministic roll-up.
- `agent-output/_baselines/agent-assess-{ts}/assessment-plan.md` — ranked plan, resumable from a
  fresh chat (findings table + decisions log).
- A chat summary with the fleet count, blocker count, and the top 5 highest-leverage changes.
  </output_contract>

<rules>

- Read-only. No edits to any agent, prompt, skill, or instruction in this pass.
- Every finding cites a rule (file + limit), a metric, or a concrete line — no vibes.
- Derive fleet counts from the harness output; obey `no-hardcoded-counts`.
- Batch `Explore` calls and keep each scoped to the rubric / checklist — do not let a subagent edit.
- L3 stays `na` unless a debug-log profile is supplied; never fabricate runtime numbers.
  </rules>
