# Plan: RALPH-Style E2E Workflow Loop

## TL;DR

Build an automated, self-correcting evaluation loop (inspired by the RALPH loop pattern) that executes the full 7-step InfraOps workflow end-to-end without human input, validates every artifact, benchmarks against the Nordic Fresh Foods baseline, and produces a scored evaluation report with actionable lessons learned. The loop iterates within each step until validation passes or max-iterations is hit, then auto-progresses through gates.

## Problem Statement

The current workflow is **human-in-the-loop by design** — interactive steps (1, 4) call `askQuestions`, 6 gates require approval, and session breaks are recommended. There's no way to run an unattended E2E loop to test, validate, and benchmark the entire pipeline. The existing E2E test plan (`e2e-test-plan-240-245.md`) covers structural validators but not a full workflow execution loop.

## Architecture: Adapted RALPH for InfraOps

The classic RALPH pattern: `while true → work → try exit → stop hook blocks → re-feed prompt → repeat until completion promise`.

**Adapted for InfraOps**: The loop is driven by a **prompt file** (`e2e-ralph-loop.prompt.md`) invoked in a chat session, instructing the E2E Conductor agent to run all steps sequentially with auto-gate logic. Each workflow step is a RALPH mini-loop with a pre-validation gate after every subagent return:

```
for each step in [1..7]:
    iteration = 0
    while step.status != "complete" AND iteration < max_iter:
        result = execute_step(step)
        pre_validate(result)                # MF-4: file exists, non-empty, expected H2s
        if pre_validation_fails:
            log_lesson("agent-behavior")
            iteration++; continue
        validate_step(step)                 # run validators + artifact checks
        run_challenger(step, 1_pass)        # MF-5: challenger for every step
        if validation_fails OR must_fix > 0:
            feed_findings_back()            # self-correction (RALPH principle)
            iteration++
        else:
            auto_approve_gate(step)         # bypass human gate
            advance_to_next_step()
    benchmark_step(step, simple_baseline)   # SF-6: normalized for complexity
```

**Context budget management**: If context exceeds 60% capacity, the loop saves state to `00-session-state.json` and emits a `SESSION_SPLIT_NEEDED` signal. The user re-invokes the prompt — session-resume picks up from the last completed gate. This tests the session-resume mechanism as part of E2E coverage.

---

## Phase 1: Foundation — E2E Harness Infrastructure

### Step 1.1: Create E2E project scaffolding

- Create `agent-output/e2e-ralph-loop/` directory
- Pre-seed `00-session-state.json` with schema v2.0, project `e2e-ralph-loop`, `iac_tool: "Bicep"`, `current_step: 1`, all steps `pending`
- Pre-seed decisions: `complexity: "simple"`, `region: "swedencentral"`, `compliance: "GDPR"`, `budget: "<EUR500/month"`, `deployment_strategy: "phased-3-phase-simple"`, `environments: ["prod"]`
- Pre-seed `00-handoff.md` with project metadata
- **Files**: `agent-output/e2e-ralph-loop/00-session-state.json`, `agent-output/e2e-ralph-loop/00-handoff.md`

### Step 1.2: Pre-seed Requirements (bypass interactive Step 1)

- Clone `agent-output/nordic-fresh-foods/01-requirements.md` as structural template
- Adapt for "Nordic Fresh Foods Lite" — static web app + API + SQL, 3-5 resources, simple complexity
- **MF-2 FIX**: Preserve exact H2 heading structure from Nordic template (same sections, same frontmatter, same ordering). Run `npm run lint:artifact-templates` against the pre-seeded file to verify structural compliance BEFORE marking Step 1 complete.
- Set `complexity: "simple"`, `iac_tool: "Bicep"`
- Mark Step 1 as `complete` in session state with `sub_step: null`, `started`, `completed`, `artifacts: ["01-requirements.md"]`
- **Files**: `agent-output/e2e-ralph-loop/01-requirements.md`

### Step 1.3: Pre-seed IaC Plan (bypass interactive Step 4)

- **MF-3 FIX**: Pre-seed `04-implementation-plan.md` as a complete artifact (same approach as Step 1) — do NOT just pre-seed decisions and expect the Planner agent to skip `askQuestions`
- Clone `agent-output/nordic-fresh-foods/04-implementation-plan.md` as structural template
- Simplify to 3-5 resources matching the Lite requirements (App Service + SQL + Storage)
- Preserve exact H2 structure. Run `npm run lint:artifact-templates` to verify.
- Also pre-seed `04-dependency-diagram.py` and `04-runtime-diagram.py` (simplified versions)
- Mark Step 4 as `complete` in session state
- **Files**: `agent-output/e2e-ralph-loop/04-implementation-plan.md`, `agent-output/e2e-ralph-loop/04-dependency-diagram.py`, `agent-output/e2e-ralph-loop/04-runtime-diagram.py`

### Step 1.4: Create the E2E evaluation prompt

- **MF-1 FIX**: The loop is driven by this **prompt file** invoked in a chat session — NOT by a standalone agent that self-invokes. The prompt instructs the E2E Conductor to run all steps sequentially in one session with auto-gate logic.
- New prompt file: `.github/prompts/e2e-ralph-loop.prompt.md`
- RALPH-style prompt with:
  - Clear phased completion criteria (Steps 2→3→3.5→5→6→7, with pre-seeded Steps 1 & 4 validated only)
  - Pre-validation instructions: "After each subagent return, verify: file exists, non-empty, contains expected H2 headings. If not, log lesson and retry."
  - Self-correction instructions: "If validation fails, read findings, fix, re-validate"
  - Challenger instructions: "After each step, run 1-pass challenger review (simple complexity)"
  - Context budget: "Track approximate token usage. If context exceeds 60%, save state and output SESSION_SPLIT_NEEDED."
  - Completion promise: `<promise>E2E_COMPLETE</promise>` when all 7 steps done + validators pass
  - Max iterations per step: 5 (safety net), 40 total
  - Auto-gate progression: "After step validation passes and challenger has 0 must_fix, mark gate as approved and proceed"
  - Benchmark collection: "After each step, record metrics to `e2e-ralph-loop/08-benchmark-report.md`"
  - Timing thresholds: Simple step ≤ 3 min, Code generation ≤ 10 min, Total loop ≤ 45 min
- **Depends on**: Step 1.1, 1.2, 1.3

### Step 1.5: Create the E2E Conductor agent variant

- New agent: `.github/agents/e2e-conductor.agent.md`
- Based on `01-conductor.agent.md` but with key differences:
  - **No `askQuestions`** — all decisions pre-seeded in requirements and implementation plan
  - **Auto-approve gates** — validates artifacts then auto-progresses (no STOP)
  - **Pre-validation gate** (MF-4): After every subagent return, check file exists + non-empty + expected H2 headings before running full validation
  - **Challenger for every step** (MF-5): 1-pass challenger review (comprehensive lens) for all steps including 2, 3, 3.5
  - **Self-correction loop** — on validation failure or must_fix findings, re-invokes step agent with findings
  - **Context budget tracking** (SF-4): Estimates token usage per step, triggers session split if > 60%
  - **Benchmark collection** — records per-step timing, artifact count, validator results
  - **Timing thresholds** (SF-4): Logs lesson with `workflow-design` category if step exceeds time threshold
  - **Max iterations** — hard cap of 5 per step, 40 total
  - **Completion promise** — outputs `E2E_COMPLETE` when Step 7 finishes
  - **Lesson capture** — records structured lessons to `09-lessons-learned.json` at every self-correction, validation failure, challenger finding, or timeout
- Skills: Same as conductor + `azure-validate` for preflight checks
- **Depends on**: Step 1.4

---

## Phase 2: Validation & Benchmark Framework

### Step 2.1: Create per-step validation script

- New script: `scripts/validate-e2e-step.mjs`
- **SF-5 FIX**: This is a **thin orchestrator** that composes existing validators per step — does NOT reimplement checks. For each step, runs the relevant subset of `npm run lint:*` and `npm run validate:*`, collects outputs, and returns aggregated JSON.
- Per-step mapping:
  - **All steps**: `validate:session-state` (session state updated)
  - **Steps 1-4, 6-7**: `lint:artifact-templates` + `lint:h2-sync` (H2 compliance)
  - **Step 5**: `bicep build` + `bicep lint` (code validation)
  - **Step 7**: Check all `07-*.md` files exist
- **Pre-validation gate** (MF-4): Before running full validators, check:
  - Expected artifact file(s) exist
  - File is non-empty (> 0 bytes)
  - File contains at least the first 3 expected H2 headings for that step
  - If pre-validation fails: return `{ step, pass: false, pre_validation_failed: true, findings: [...] }`
- Returns JSON: `{ step, pass, pre_validation_failed, findings[], artifact_count, validation_time_ms }`
- **Reference**: Existing validators in `scripts/validate-*.mjs` for patterns

### Step 2.2: Create benchmark scoring engine

- New script: `scripts/benchmark-e2e.mjs`
- **SF-6 FIX**: Benchmarks against a **per-complexity expected set**, not raw Nordic artifact counts. Simple projects produce ~25 artifacts (vs Nordic's 49 for standard). Score against the simple-complexity baseline. Use Nordic as structural quality reference (H2 compliance, governance JSON schema, session state integrity).
- Dimensions scored 0-100:
  - **Artifact completeness**: % of expected simple-complexity artifacts produced
  - **Structural compliance**: H2 sync, template compliance, frontmatter validity (quality reference from Nordic)
  - **Code quality**: Bicep lint warnings count, build success, AVM module usage %
  - **Review thoroughness**: Challenger findings generated and resolved per step
  - **WAF coverage**: All 5 pillars scored (Security, Reliability, Perf, Cost, Ops)
  - **Cost accuracy**: Budget within stated constraints
  - **Session state integrity**: Schema valid, all steps tracked, decisions logged
  - **Timing performance** (SF-4): Per-step time vs thresholds
- Weighted composite score with A-F grades per `QUALITY_SCORE.md` methodology
- Also reads `09-lessons-learned.json` to auto-generate improvement backlog (Step 5.3)
- Output: `agent-output/e2e-ralph-loop/08-benchmark-report.md` + `08-benchmark-scores.json`

### Step 2.3: Create iteration tracker

- New file: `agent-output/e2e-ralph-loop/08-iteration-log.json`
- Records per-step: `{ step, iteration, action, result, pre_validation_passed, findings_count, duration_ms, timestamp }`
- Enables post-mortem analysis: which steps needed retries, what failed, convergence rate, timing distribution
- **Parallel with**: Step 2.1, 2.2

---

## Phase 3: Gate Bypass & Crash Recovery

### Step 3.1: Design auto-gate protocol for E2E conductor

- The E2E conductor implements a **validate-challenge-proceed** pattern:
  1. Step completes → pre-validation gate (MF-4: file exists, non-empty, H2s present)
  2. If pre-validation fails → log lesson (`agent-behavior`), retry step (up to max iterations)
  3. Pre-validation passes → run `validate-e2e-step.mjs` for that step
  4. Run 1-pass challenger review (MF-5: comprehensive lens for simple complexity)
  5. If validation passes AND challenger has 0 must_fix → update session state gate as `approved`, advance `current_step`
  6. If validation fails OR must_fix > 0 → feed findings back to step agent (RALPH self-correction)
  7. After max iterations with failure → mark gate as `blocked`, log detailed reason + diagnostic info, attempt next step
- **No changes to production conductor** — E2E conductor is a separate agent
- **Depends on**: Step 1.5, Step 2.1

### Step 3.2: Crash/garbage recovery protocol (MF-4)

- After each subagent invocation, the E2E conductor runs pre-validation:
  - **File exists**: Check expected artifact path in `agent-output/e2e-ralph-loop/`
  - **Non-empty**: File size > 0 bytes
  - **Structural**: Contains at least the top 3 expected H2 headings for that artifact type
  - **Session state**: `00-session-state.json` still valid JSON after step execution
- On failure: log a lesson with `category: "agent-behavior"`, `severity: "high"`, include the subagent name and what was missing. Retry the step.
- On repeated failure (3 consecutive pre-validation failures): mark step as `blocked` with diagnostic dump
- **Depends on**: Step 2.1

---

## Phase 4: Loop Execution Protocol

### Step 4.1: Define the RALPH execution sequence

The E2E prompt instructs the conductor to execute this loop:

```
PHASE A: Verify foundations (pre-seeded Steps 1 & 4)
  - Validate 01-requirements.md exists, H2-compliant, structurally sound
  - Run challenger with 1 pass (comprehensive lens)
  - If must_fix > 0: self-correct requirements, re-validate
  - Mark Step 1 gate as approved
  - Validate 04-implementation-plan.md exists, H2-compliant
  - Mark Step 4 as pre-seeded (validated later after Steps 2-3.5 complete)

PHASE B: Architecture (Step 2) — RALPH mini-loop
  - Invoke 03-Architect subagent with requirements
  - Pre-validate: file exists, non-empty, expected H2s
  - Validate: artifact exists, WAF scores present, H2 compliant
  - Run challenger (1 pass, comprehensive lens)
  - Self-correct if needed (max 3 iterations)
  - Record benchmark: WAF scores, cost estimate accuracy, timing
  - Auto-approve Gate 2

PHASE B.5: Design (Step 3) — RALPH mini-loop
  - Invoke 04-Design subagent (ADR + diagrams)
  - Pre-validate: at least one 03-des-*.md file, one 03-des-*.py file
  - Validate: ADR structure, Python diagram script syntax
  - Run challenger (1 pass, comprehensive lens)
  - Self-correct if needed (max 3 iterations)
  - On failure after max iterations: mark as `skipped` (optional step), log lesson, continue
  - Record benchmark

PHASE C: Governance (Step 3.5) — RALPH mini-loop
  - Invoke 04g-Governance subagent
  - Pre-validate: governance .md and .json files exist, JSON is parseable
  - Validate: governance JSON parseable, policies discovered, tags section present
  - Run challenger (1 pass, comprehensive lens)
  - Self-correct if needed (max 3 iterations)
  - Auto-approve Gate 2.5

PHASE D: IaC Plan Validation (Step 4 — pre-seeded)
  - Re-validate 04-implementation-plan.md against governance constraints from Step 3.5
  - Run challenger (1 pass, security-governance lens)
  - If must_fix > 0: self-correct plan, re-validate (max 2 iterations)
  - Auto-approve Gate 3

PHASE E: IaC Code (Step 5) — RALPH mini-loop (most iterations expected)
  - Invoke 06b-Bicep CodeGen
  - Pre-validate: main.bicep exists, non-empty, modules/ directory present
  - Validate: bicep build + bicep lint pass, AVM modules used
  - Self-correct: feed lint errors back, re-generate (max 5 iterations)
  - Run challenger review (1 pass, security-governance lens)
  - Auto-approve Gate 4

PHASE F: Deploy (Step 6) — conditional
  - IF Azure credentials available: invoke 07b-Bicep Deploy
  - ELSE: dry-run validation only (bicep what-if), mark as "validated-not-deployed"
  - Pre-validate: 06-deployment-summary.md exists (or dry-run report)
  - Auto-approve Gate 5

PHASE G: As-Built Docs (Step 7) — fan-out
  - Invoke 08-As-Built subagent
  - Pre-validate: each 07-*.md file expected
  - Validate: all 07-*.md files generated, diagrams present
  - Run challenger (1 pass, comprehensive lens)
  - No gate — completion

PHASE H: Benchmark, Lessons & Report
  - Run benchmark-e2e.mjs against simple-complexity baseline
  - Generate 08-benchmark-report.md with scores + improvement backlog
  - Generate 09-lessons-learned.md narrative from JSON
  - Check timing thresholds
  - Output: E2E_COMPLETE (or E2E_PARTIAL / E2E_BLOCKED with reasons)
```

### Step 4.2: Define completion criteria

- **Success** (`E2E_COMPLETE`): All 7 steps (+ Step 3 Design) reached `complete` status, `npm run validate:all` passes, benchmark score > 60/100
- **Partial** (`E2E_PARTIAL`): Steps 1-5 complete (code generated + validated), Steps 6-7 skipped/blocked, OR Step 3 skipped (optional)
- **Blocked** (`E2E_BLOCKED`): Any mandatory step fails after max iterations, logged with reason
- **Session split** (`SESSION_SPLIT_NEEDED`): Context > 60%, state saved, user re-invokes prompt
- **Safety net**: Total max iterations = 40 (8 steps including Design × 5 max each)

---

## Phase 5: Lessons Learned Capture

### Step 5.1: Lessons learned schema

- New file: `agent-output/e2e-ralph-loop/09-lessons-learned.json`
- Structured capture during AND after the loop:

```json
{
  "run_id": "e2e-ralph-001",
  "timestamp": "2026-03-15T...",
  "lessons": [
    {
      "id": "LL-001",
      "step": 5,
      "category": "agent-behavior|skill-gap|prompt-quality|validation-gap|workflow-design|context-budget|artifact-quality|factual-accuracy",
      "severity": "critical|high|medium|low",
      "title": "Bicep CodeGen missed AVM module for NSG",
      "observation": "What happened — factual description",
      "expected": "What should have happened",
      "root_cause": "Why it happened (agent prompt? skill gap? missing instruction?)",
      "self_corrected": true,
      "iterations_to_fix": 2,
      "recommendation": "Actionable fix — which file to change and how",
      "applies_to": ["06b-Bicep CodeGen agent", "azure-bicep-patterns skill"],
      "applies_to_paths": [
        ".github/agents/_subagents/06b-bicep-codegen.agent.md",
        ".github/skills/azure-bicep-patterns/SKILL.md"
      ],
      "status": "new|triaged|applied|wont-fix"
    }
  ],
  "summary": {
    "total_lessons": 0,
    "by_category": {},
    "by_severity": {},
    "self_correction_rate": "% of issues the loop fixed without human help",
    "improvement_candidates": ["list of files/agents/skills to update"]
  }
}
```

- **SF-3 FIX**: Added `factual-accuracy` category for hallucinated Azure info (wrong SKU names, non-existent API versions, hallucinated AVM module versions). Detection: `bicep build` failures often indicate hallucinated resource properties — classify these as `factual-accuracy` rather than generic `agent-behavior`.
- **SF-8 FIX**: Added `applies_to_paths` field alongside `applies_to` containing resolved file paths. E2E conductor resolves these at capture time using agent-registry.json and skill directory listings.
- **Capture points**: E2E conductor records a lesson whenever:
  - A step needs >1 iteration (self-correction fired)
  - A validator fails on first pass
  - Pre-validation fails (MF-4: agent returned garbage/empty)
  - A challenger finding reveals a gap
  - An artifact is structurally non-compliant
  - Context budget exceeds 60%
  - A step exceeds timing threshold (SF-4)
  - A step times out or hits max iterations
  - Bicep build fails due to hallucinated properties (factual-accuracy)

### Step 5.2: Lessons learned narrative

- New file: `agent-output/e2e-ralph-loop/09-lessons-learned.md`
- Human-readable companion to the JSON, generated at loop completion
- Sections:
  - **Executive Summary**: Top 3 systemic issues, self-correction success rate
  - **Per-Step Findings**: What worked, what broke, retries needed, timing
  - **Agent Improvement Recommendations**: Specific changes to agent definitions, prompts, or skills (with file paths)
  - **Workflow Improvement Recommendations**: DAG routing, gate logic, validation gaps
  - **Factual Accuracy Issues**: Hallucinated Azure properties, wrong versions, non-existent resources
  - **Validator Coverage Gaps**: Things the loop caught that existing validators don't
  - **Comparison to Baseline**: Where this run diverged from expected simple-complexity output and why

### Step 5.3: Improvement backlog generation

- The benchmark script (`scripts/benchmark-e2e.mjs`) reads `09-lessons-learned.json` and auto-generates:
  - A prioritized list of improvement items (sorted by severity × frequency)
  - Mapping of each lesson to specific files (using `applies_to_paths`) that need changes
  - Draft GitHub issue bodies for critical/high items (ready to file via MCP)
- Output appended to `08-benchmark-report.md` as "## Improvement Backlog" section

---

## Phase 6: Post-Loop Evaluation & Apply

### Step 6.1: Benchmark report template

- `agent-output/e2e-ralph-loop/08-benchmark-report.md` contains:
  - **Execution summary**: Steps completed, total iterations, total time, session splits
  - **Per-step scorecard**: Pass/fail, iterations needed, findings count, self-corrections applied, timing vs threshold
  - **Baseline comparison**: Delta vs simple-complexity expected set (structural quality from Nordic)
  - **Quality grade**: A-F per QUALITY_SCORE.md methodology
  - **Regression detection**: Any validators that passed for Nordic but fail for E2E
  - **Improvement Backlog**: Auto-generated from lessons learned (see Step 5.3)

### Step 6.2: Run existing validators as final gate

- `npm run validate:all` as the ultimate pass/fail
- **SF-5b FIX**: E2E-only metadata files (`08-benchmark-*.md/json`, `09-lessons-learned.md/json`, `08-iteration-log.json`) are plain markdown/JSON NOT subject to artifact template rules (they're evaluation artifacts, not workflow artifacts). Ensure they don't use step-numbered H2 template structure that would trigger `lint:artifact-templates`.
- Any failures = the loop didn't fully converge (document in benchmark report)
- **Depends on**: Phase 5 complete

### Step 6.3: Lessons-to-action analysis prompt

- New prompt: `.github/prompts/e2e-analyze-lessons.prompt.md`
- Fed `09-lessons-learned.json` + `08-benchmark-report.md`
- Uses `applies_to_paths` for precise file targeting
- Produces actionable PRs or file edits:
  - Agent definition tweaks (missing rules, unclear instructions)
  - Skill content gaps (missing patterns, outdated references)
  - Validator enhancements (new checks the loop revealed are needed)
  - Prompt improvements (ambiguous instructions that caused retries)
  - Factual accuracy fixes (wrong Azure properties in skill references)
- This is the "close the loop" step — lessons feed back into the system

---

## Relevant Files

### Existing (read/reference)

- `.github/agents/01-conductor.agent.md` — Base conductor to fork for E2E variant
- `.github/agent-registry.json` — Agent name → file path resolution (for `applies_to_paths`)
- `.github/skills/workflow-engine/templates/workflow-graph.json` — DAG definition
- `.github/skills/session-resume/SKILL.md` — Session state schema and resume protocol
- `agent-output/nordic-fresh-foods/` — All 49 baseline artifacts (structural quality reference)
- `agent-output/nordic-fresh-foods/00-session-state.json` — Reference session state
- `agent-output/nordic-fresh-foods/01-requirements.md` — Requirements template to clone
- `agent-output/nordic-fresh-foods/04-implementation-plan.md` — IaC plan template to clone
- `agent-output/e2e-test-plan-240-245.md` — Existing E2E test plan (structural validators)
- `QUALITY_SCORE.md` — Quality grading methodology
- `scripts/validate-*.mjs` — Existing validator patterns to compose
- `scripts/_lib/` — Shared validation utilities

### New (create)

- `.github/prompts/e2e-ralph-loop.prompt.md` — RALPH-style E2E execution prompt (loop driver)
- `.github/prompts/e2e-analyze-lessons.prompt.md` — Post-loop lessons analysis and improvement generation
- `.github/agents/e2e-conductor.agent.md` — Autonomous E2E conductor (no human gates, auto-challenge)
- `scripts/validate-e2e-step.mjs` — Thin orchestrator composing existing validators per step
- `scripts/benchmark-e2e.mjs` — Benchmark scoring engine (complexity-normalized, reads lessons)
- `agent-output/e2e-ralph-loop/00-session-state.json` — Pre-seeded session state (Steps 1 & 4 complete)
- `agent-output/e2e-ralph-loop/00-handoff.md` — Pre-seeded handoff
- `agent-output/e2e-ralph-loop/01-requirements.md` — Pre-seeded requirements (Nordic H2 clone)
- `agent-output/e2e-ralph-loop/04-implementation-plan.md` — Pre-seeded IaC plan (Nordic H2 clone, simplified)
- `agent-output/e2e-ralph-loop/04-dependency-diagram.py` — Pre-seeded simplified dependency diagram
- `agent-output/e2e-ralph-loop/04-runtime-diagram.py` — Pre-seeded simplified runtime diagram
- `agent-output/e2e-ralph-loop/08-benchmark-report.md` — Generated by loop (includes improvement backlog)
- `agent-output/e2e-ralph-loop/08-benchmark-scores.json` — Machine-readable scores
- `agent-output/e2e-ralph-loop/08-iteration-log.json` — Loop iteration tracker (with timing + pre-validation)
- `agent-output/e2e-ralph-loop/09-lessons-learned.json` — Structured lessons (with `applies_to_paths`)
- `agent-output/e2e-ralph-loop/09-lessons-learned.md` — Human-readable narrative + recommendations

---

## Verification

1. **Structural**: `npm run validate:all` passes with E2E artifacts in place (E2E metadata files exempt from artifact templates)
2. **Pre-seed compliance**: Pre-seeded `01-requirements.md` and `04-implementation-plan.md` pass `npm run lint:artifact-templates` and `npm run lint:h2-sync` BEFORE the loop starts
3. **Session state**: `npm run validate:session-state` validates the pre-seeded and final session state
4. **Code quality**: `bicep build infra/bicep/e2e-ralph-loop/main.bicep` compiles with 0 errors
5. **Benchmark threshold**: Composite score > 60/100 against simple-complexity baseline (not raw Nordic counts)
6. **Iteration convergence**: No step exceeds 5 iterations (indicates prompt/agent issue if it does)
7. **Challenger coverage**: Every step (including 2, 3, 3.5, 4) has at least 1 challenger pass recorded in session state
8. **Pre-validation coverage**: Every subagent return is pre-validated (file exists, non-empty, H2s present)
9. **Lessons captured**: `09-lessons-learned.json` is valid JSON with ≥1 lesson per step that needed self-correction
10. **Lessons actionable**: Every `critical`/`high` lesson has non-empty `recommendation`, `applies_to`, AND `applies_to_paths`
11. **Factual accuracy**: Any `bicep build` failure that indicates hallucinated properties is classified as `factual-accuracy` category
12. **Timing thresholds**: No simple step > 3 min, no codegen step > 10 min, total loop < 45 min (exceeding = lesson logged)
13. **Feedback loop closure**: `e2e-analyze-lessons.prompt.md` produces concrete file changes + draft issue bodies

---

## Decisions

- **Prompt-driven loop (MF-1)** — Loop is driven by a prompt file in a chat session, not a standalone agent that self-invokes. The user triggers once; the prompt instructs the E2E Conductor to run all steps sequentially.
- **Separate E2E conductor** — Production conductor unchanged; E2E variant removes human gates and adds auto-challenge + pre-validation.
- **Pre-seed Steps 1 AND 4 (MF-2, MF-3)** — Both interactive steps pre-seeded as complete artifacts (not just decisions). Exact H2 structural clones from Nordic template, validated before loop starts.
- **Pre-validation gate (MF-4)** — After every subagent return: file exists + non-empty + expected H2 headings. Catches crashes and garbage before wasting validation cycles.
- **Challenger for every step (MF-5)** — 1-pass challenger (comprehensive lens) for Steps 2, 3, 3.5, 4, 5, 7. Not just Steps 1 and 5.
- **Design step included (SF-6b)** — Step 3 (Design) runs in the loop to test ADR + Python diagram generation. Marked as optional — failure doesn't block the loop.
- **Complexity-normalized benchmarking (SF-6)** — Score against simple-complexity expected set (~25 artifacts), not Nordic standard-complexity (49 artifacts). Nordic is a structural quality reference only.
- **Context budget + session split (SF-4)** — If context > 60%, save state + signal `SESSION_SPLIT_NEEDED`. Tests the session-resume mechanism.
- **Thin validator orchestrator (SF-5)** — `validate-e2e-step.mjs` composes existing validators, doesn't reimplement them. Prevents drift.
- **`factual-accuracy` lesson category (SF-3)** — Dedicated category for hallucinated Azure info. `bicep build` failures classified here, not generic `agent-behavior`.
- **`applies_to_paths` in lessons (SF-8)** — Resolved file paths alongside human-readable names. Enables precise PR targeting in the analysis prompt.
- **E2E metadata files exempt from artifact templates (SF-5b)** — Files numbered 08-_ and 09-_ are plain markdown/JSON, not workflow artifacts.
- **Timing thresholds (SF-4)** — Simple step ≤ 3 min, CodeGen ≤ 10 min, total ≤ 45 min. Exceeding generates a `medium` lesson.
- **Simple complexity** — 1 review pass per step. Still exercises all 8 steps (including Design).
- **Bicep track only** — Terraform already has `terraform-e2e/`. Dual-track is a follow-up.
- **Deploy = dry-run** — `bicep what-if` only, no actual Azure resource creation.

## Further Considerations

1. **Terraform dual-track (deferred)**: After Bicep loop proves the pattern, add `--iac-tool terraform` parameter to the E2E prompt. Steps 1-3.5 are shared; only 4t-7t differ.

2. **CI integration (deferred)**: Design for local VS Code chat execution first. CI wrapper (GitHub Actions + Claude Code CLI) is a follow-up after the loop is proven locally.

3. **Scoring calibration**: The 60/100 pass threshold needs tuning after the first run. Run once, observe, then calibrate.

4. **Multi-run regression tracking (deferred, SF-7)**: Add `run_id` + `run_history` concept and `scripts/compare-e2e-runs.mjs` for cross-run regression detection. Valuable after ≥3 runs.

---

## Challenger Review Audit

### Pass 1 (Feasibility & Design) — Applied

| #    | Severity   | Status     | Title                                                      |
| ---- | ---------- | ---------- | ---------------------------------------------------------- |
| MF-1 | must_fix   | ✅ Applied | Subagent invocation → prompt-driven loop                   |
| MF-2 | must_fix   | ✅ Applied | Pre-seeded requirements must match H2 template exactly     |
| MF-3 | must_fix   | ✅ Applied | Step 4 pre-seeded as complete artifact, not just decisions |
| SF-4 | should_fix | ✅ Applied | Context budget tracking + session split protocol           |
| SF-5 | should_fix | ✅ Applied | Thin validator orchestrator composing existing validators  |
| SF-6 | should_fix | ✅ Applied | Complexity-normalized benchmarking                         |
| SG-7 | suggestion | ✅ Noted   | Terraform dual-track deferred to Further Considerations    |

### Pass 2 (Coverage & Completeness) — Applied

| #     | Severity   | Status     | Title                                                   |
| ----- | ---------- | ---------- | ------------------------------------------------------- |
| MF-4  | must_fix   | ✅ Applied | Pre-validation gate after every subagent return         |
| MF-5  | must_fix   | ✅ Applied | Challenger review for all steps (2, 3, 3.5, 4)          |
| SF-3  | should_fix | ✅ Applied | `factual-accuracy` lesson category for hallucinations   |
| SF-4b | should_fix | ✅ Applied | Timing thresholds with lesson generation                |
| SF-5b | should_fix | ✅ Applied | E2E metadata files exempt from artifact template rules  |
| SF-6b | should_fix | ✅ Applied | Step 3 (Design) included in loop                        |
| SG-7  | suggestion | ✅ Noted   | Multi-run regression deferred to Further Considerations |
| SG-8  | suggestion | ✅ Applied | `applies_to_paths` with resolved file paths             |
