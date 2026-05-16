---
agent: agent
model: "Claude Opus 4.7"
description: "Post-loop lessons analysis. Reads E2E RALPH loop results (single or multi-run), merges data, and generates actionable improvements for agents, skills, validators, and prompts."
tools:[vscode, execute, read, agent, browser, edit, search, web, 'azure-mcp/*', todo]
---

# E2E Lessons Analysis — Close the Loop

You are analyzing the results of one or more E2E RALPH loop evaluation runs.
Your job is to read the lessons learned and benchmark reports, merge them if
multiple runs are selected, then produce **concrete, actionable improvements**
to the agent/skill/validator/prompt system.

<investigate_before_answering>

- Lessons analysis depends on real telemetry. Before producing any
  recommendations, confirm: (a) which runs under `agent-output/` qualify
  (those containing `09-lessons-learned.json`); (b) whether a single run
  or multi-run merge is in scope; (c) the desired output project name.
- If `08-benchmark-scores.json` is missing for a selected run, note the
  scoring gap and proceed with lessons-only analysis.
  </investigate_before_answering>

<context>
- Source artifacts per run (under `agent-output/{run-name}/`):
  - `09-lessons-learned.json` (required)
  - `08-benchmark-scores.json` (optional but preferred)
  - `08-benchmark-report.md` (optional)
- Schema reference: `tools/schemas/lesson-log.schema.json`.
- This prompt produces improvement proposals targeted at agents, skills,
  validators, and prompts — it does NOT mutate them directly; the user
  decides what to implement.
</context>

<task>
Run the multi-step analysis described in the body below:

1. Step 0 — interactive run selection via `askQuestions`.
2. Step 0b — merge data when multiple runs are selected.
3. Read merged lessons + benchmark data.
4. Group findings by target (agent / skill / validator / prompt) and by
   recurrence.
5. Produce a prioritised improvement plan with concrete edits per target.
   </task>

<rules>
- Use `askQuestions` for run selection — do not assume a single run.
- Do NOT modify agent / skill / validator / prompt files; produce
  recommendations only.
- When merging runs, prefix lesson IDs with `R{n}-` and preserve the
  source-run metadata.
- Sort recurring lessons first (by frequency desc), then severity
  (critical > high > medium > low), then step number.
- Composite scores and dimension stats must be computed from the actual
  run files, not inferred.
</rules>

<output_contract>

- `agent-output/{output-project}/09-lessons-merged.json` (when multi-run)
- `agent-output/{output-project}/08-benchmark-scores-combined.json` (when
  multi-run and per-run scores exist)
- `agent-output/{output-project}/08-benchmark-report-combined.md` (when
  multi-run)
- `agent-output/{output-project}/10-improvement-plan.md` — prioritised,
  concrete edits per target with rationale tied to specific lessons /
  scores.
- Summary returned to the user: top 5 highest-impact improvements + any
  recurring lessons.
  </output_contract>

## Step 0 — Run Selection (Interactive)

Before reading any files, discover and present available runs:

1. **Scan** `agent-output/` for directories that contain a `09-lessons-learned.json` file.
2. **Use `askQuestions`** to let the user pick which runs to analyze:
   - Show each qualifying directory as a multi-select option.
   - Include the composite score from `08-benchmark-scores.json` in the option description (if the file exists).
   - Pre-select all options as recommended.
   - Allow freeform input so the user can type a custom directory name.
3. Collect the user's selection. If only one run is selected, use it directly.
   If multiple runs are selected, proceed to **Step 0b — Merge**.
4. Also ask the user for the **output project name** for the combined results
   (default: derive from common prefix of selected runs + `combined`).

### Step 0b — Merge Multiple Runs

When multiple runs are selected, merge the data before analysis:

#### Lessons (`09-lessons-learned.json`)

- Load each run's `09-lessons-learned.json` into one combined array.
- Prefix each lesson ID with `R{n}-` (e.g., `R1-LL-001`, `R2-LL-003`) and add
  `source_run` and `run_number` fields.
- Detect **recurring lessons** by comparing normalized titles (lowercase, strip punctuation).
  Mark lessons that appear in 2+ runs with `cross_run_frequency` and `recurring: true`.
- Sort: recurring lessons first (by frequency desc), then by severity
  (critical > high > medium > low), then by step number.

#### Benchmark Scores (`08-benchmark-scores.json`)

- Build a combined JSON with:
  - `combined_from`: array of run names
  - `per_run`: each run's full scores object
  - `dimension_stats`: per-dimension `avg`, `min`, `max`, `range` across runs
  - `composite_stats`: `avg`, `min`, `max`, `range` of composite scores

#### Benchmark Report (`08-benchmark-report.md`)

- Generate a **combined report** (not just concatenation) with:
  - Executive summary (run count, avg composite, score range)
  - Per-run composite table
  - Per-dimension comparison table (each run as a column + avg + spread)
  - Recurring lessons highlight table
  - Severity and category distribution tables
  - Top 3 weakest dimensions

#### Write merged outputs

- Write all merged files to `agent-output/{output-project}/`:
  - `09-lessons-learned.json` (merged array)
  - `08-benchmark-scores.json` (multi-run structure)
  - `08-benchmark-report.md` (comparative report)
  - `00-combine-meta.json` (metadata: source runs, counts, timestamp)

Then continue analysis using the merged directory as `{project}`.

## Input Files

After run selection (and optional merge), read these from `agent-output/{project}/`:

1. `09-lessons-learned.json` — structured lesson data with `applies_to_paths`
2. `08-benchmark-report.md` — benchmark scores and improvement backlog
3. `08-benchmark-scores.json` — machine-readable scores per dimension
4. `08-iteration-log.json` — per-step iteration details (may not exist)

## Analysis Steps

### 1. Categorize and Prioritize

Group lessons by:

- **Category**: agent-behavior, skill-gap, prompt-quality, validation-gap, workflow-design, context-budget, artifact-quality, factual-accuracy
- **Severity**: critical → high → medium → low
- **Frequency**: How many times did this category appear?

Focus on `critical` and `high` severity lessons first.

### 2. Root Cause Analysis

For each critical/high lesson:

- Read the file in `applies_to_paths` to understand current state
- Identify the specific gap (missing instruction, unclear prompt, wrong default, etc.)
- Determine if the fix is in an agent definition, skill file, instruction, validator, or prompt

### 3. Generate Improvements

For each identified gap, produce one of:

#### Agent Definition Fixes

- Identify the exact `.agent.md` file and section to change
- Propose specific text additions/modifications
- Focus on: missing rules, unclear instructions, wrong tool permissions

#### Skill Content Updates

- Identify the `SKILL.md` or reference file to update
- Add missing patterns, fix outdated references, add new examples

#### Validator Enhancements

- Identify new checks the loop revealed are needed
- Propose additions to existing `scripts/validate-*.mjs` files

#### Prompt Improvements

- Identify ambiguous instructions that caused retries
- Propose clearer phrasing or additional constraints

#### Factual Accuracy Fixes

- Identify hallucinated Azure properties in skill references
- Correct wrong API versions, non-existent SKU names, invalid AVM module versions

### 4. Output

Create a summary document: `agent-output/{project}/10-improvement-actions.md`

Structure:

```markdown
# E2E RALPH Loop — Improvement Actions

## Executive Summary

- Total lessons: N
- Critical/High: N
- Self-correction rate: X%
- Top 3 systemic issues

## Critical Fixes

### Fix 1: [Title]

- **File**: [exact path]
- **Change**: [specific edit description]
- **Rationale**: [from lesson ID]

## High Priority Fixes

...

## Validator Enhancements

...

## Deferred (Medium/Low)

...
```

### 5. Draft GitHub Issue Bodies

For each `critical` lesson, draft a GitHub issue body ready to file:

- Title: `[E2E] {lesson title}`
- Body: root cause, reproduction (step + iteration), proposed fix, affected files
- Labels: `e2e-finding`, severity label

Append these to `10-improvement-actions.md` under `## Draft Issues`.

## Quality Checks

- Every `critical`/`high` lesson must have a corresponding improvement action
- Every improvement must reference the specific file path (from `applies_to_paths`)
- Factual accuracy issues must be corrected, not just flagged
- No vague recommendations ("improve the agent") — every action must be specific and editable
