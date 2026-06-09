# Agent Scorecard Rubric (L2 + composite)

Reference for `tools/apex-prompts/utility-prompts/assess-agents.prompt.md` and
`tools/scripts/assess-agents.mjs`. Defines the eight scored dimensions, their 0–5 bands, the
subagent-reduced variant, and the composite weights.

The harness scores the **deterministic** dimensions (L1 contract, L2 static metrics, L2 vendor,
L2 frame/safety mechanical signals, optional L3 runtime). The prompt's Explore fan-out resolves the
**judgment** dimensions (L2 role clarity, L4 adversarial), then aggregates the final composite.

## Scoring bands (shared legend)

Every dimension resolves to a `status`, a 0–5 `score`, and a `severity`.

- `pass` (5) — no issues; meets the contract cleanly.
- `warn` (3–4) — soft-limit breach or advisory gap; non-blocking.
- `fail` (0–1) — hard-limit breach, missing required field, or error-severity validator finding.
- `na` — not applicable (e.g. runtime with no profile, operating-frame on a subagent).
- `pending` — judgment dimension awaiting the Explore fan-out.

Severity ladder: `none` < `low` < `medium` < `high` < `blocker`. Any `blocker` sets the scorecard
`blocker` flag and caps `mechanical_composite` at 49.

## Dimensions

### 1. Mechanical contract — L1 (deterministic)

Does the agent pass the structural validator contract? Body within the hard ceiling
(`MAX_BODY_LINES`), required frontmatter present, no error-severity findings from
`validate-agents.mjs`.

- 5 — no findings; body under the hard ceiling.
- 3 — warnings only.
- 0 — any error-severity finding or body over the hard ceiling (blocker).

### 2. Frontmatter & model integrity — L2 (deterministic)

Required fields (`name`, `description`, `user-invocable`, `tools`), a `model` that classifies into a
known family, and a `description` within the 350-char cap.

- 5 — all required fields; model classifies; description ≤ 300.
- 4 — description 301–350, or no `model` field on a definition that should declare one.
- 1 — missing required field, unclassifiable model, or description > 350.

### 3. Context efficiency — L2 (deterministic)

Token footprint against the limits in `context-optimization.instructions.md`: body vs 600 hard / 350
guidance, tools ≤ 30, handoffs ≤ 8 (orchestrators exempt), skill-reads ≤ 5.

- 5 — every metric within budget.
- 2–4 — one or more soft/guidance breaches (one point off per breach, floor 2).
- 1 — body over the hard ceiling.

Orchestrators are exempt from the handoff ceiling — a high handoff count is reported as soft-only and
never reduces the score.

### 4. Vendor prompting — L2 (deterministic)

Model-family correctness: Claude bodies > 350 lines carry `<context_awareness>`; Claude research
agents carry `<investigate_before_answering>`; ONE-SHOT agents do **not**; GPT-5.5 agents carry the
`# Goal` / `# Success criteria` / `# Constraints` / `# Output` / `# Stop rules` skeleton; GPT agents
avoid Claude-only XML blocks.

- 5 — all family-appropriate blocks present and correct.
- 3 — one advisory block missing or a soft vendor warning.
- 1 — error-severity vendor finding (e.g. wrong `model:` style, ONE-SHOT carrying an investigate
  block).

### 5. Role clarity & boundary — L2 (judgment, `pending`)

Single, well-scoped responsibility; explicit does / doesn't-do; no overlap with neighboring agents.
Resolved by the Explore fan-out, which compares each agent's description and body against its
workflow neighbors.

- 5 — crisp single responsibility; explicit anti-scope; no overlap.
- 3 — responsibility clear but anti-scope thin, or minor overlap with one neighbor.
- 1 — diffuse responsibility or material overlap that invites mis-routing.

### 6. Operating-frame & safety — L2 (deterministic signals + judgment refine)

Mechanical signals: no interactive-shell patterns (`mv -i`, `rm -i`, `cp -i`, `read -p`), no
hard-coded secrets, and — for main step agents only — operating-frame references (reads `SKILL.md`
once, uses `apex-recall`). Destructive-gating depth is a judgment refinement.

- 5 — clean signals; operating-frame references present (main agents).
- 4 — operating-frame reference missing on a main agent (soft).
- 1 — interactive-shell pattern or hard-coded secret present.

Operating-frame is **N/A for subagents** — only the safety signals apply.

### 7. Runtime behavior — L3 (`na` unless profiled)

From a `profile_debug_log.py --json` file: token cost, duplicate reads, latency band, askQuestions
batching, and subagent wall-time. Without a profile the dimension is `na`. Per-subagent wall-time is
attributed by matching `subagent_calls[].name`.

- 5 — within token / latency / dup-read norms.
- 3 — elevated duplicate reads or askQuestions bursts.
- 1 — error spans or runaway token cost attributable to the agent.

### 8. Adversarial — L4 (judgment, `pending`)

Red-team pass against `agent-adversarial-checklist.md`. Resolved by the Explore fan-out. Severity of
the worst finding drives the score.

- 5 — no red-team findings.
- 3 — medium findings only (e.g. thin stop rules).
- 0–1 — a high or blocker finding (missing destructive gate, prompt-injection surface, handoff to a
  non-existent target).

## Subagent-reduced variant

Subagents are non-user-invocable and stateless. Adjust the rubric:

- Dimension 6 — operating-frame portion is **N/A**; score safety signals only.
- Dimension 5 — boundary is judged against the **parent** agent and sibling subagents, not the step
  workflow.
- Dimension 8 — emphasize the ONE-SHOT contract, the single structured return, and failure-mode
  reporting back to the parent.
- Handoff-related checks in dimension 3 rarely apply (subagents seldom declare handoffs).

## Composite weights

The composite is a weighted percentage over seven buckets (dimensions 1 and 2 share the L1 bucket).

| Bucket          | Dimensions                              | Weight |
| --------------- | --------------------------------------- | ------ |
| `l1`            | 1 contract + 2 frontmatter integrity    | 0.20   |
| `ctx`           | 3 context efficiency                    | 0.15   |
| `vendor`        | 4 vendor prompting                      | 0.15   |
| `role`          | 5 role clarity                          | 0.15   |
| `frame_safety`  | 6 operating-frame & safety              | 0.10   |
| `runtime`       | 7 runtime behavior                      | 0.10   |
| `adversarial`   | 8 adversarial                           | 0.15   |

Rules:

- Each bucket contributes `score / 5 × 100 × weight`.
- `mechanical_composite` (harness) renormalizes over only the **resolved** buckets, so `pending` and
  `na` buckets do not penalize the score.
- The prompt computes the final `composite` once `role` and `adversarial` resolve.
- Any `blocker` caps the composite at 49 regardless of the weighted total.
- Fleet ranking sorts blockers first, then ascending composite (lowest = most at risk).
