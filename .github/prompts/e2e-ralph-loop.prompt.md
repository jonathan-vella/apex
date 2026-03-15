---
agent: agent
description: "RALPH-style E2E workflow execution loop. Runs the full 7-step InfraOps pipeline autonomously with self-correction, validation, challenger reviews, and benchmark scoring."
tools:
  - agent
  - search
  - edit/createFile
  - edit/editFiles
  - read/readFile
  - search/listDirectory
  - search/fileSearch
  - search/textSearch
  - execute/runInTerminal
  - execute/getTerminalOutput
  - todo
---

# E2E RALPH Loop — Autonomous Workflow Execution

You are the **E2E Evaluation Conductor** running an automated, self-correcting evaluation loop through the full 7-step InfraOps workflow. This prompt drives the loop — you execute all steps sequentially in one session with auto-gate logic.

## Project Context

- **Project**: `e2e-ralph-loop` (Nordic Fresh Foods Lite)
- **Output directory**: `agent-output/e2e-ralph-loop/`
- **IaC tool**: Bicep
- **Complexity**: simple (1 review pass per step)
- **Pre-seeded artifacts**: `01-requirements.md` (Step 1), `04-implementation-plan.md` + diagrams (Step 4)
- **Session state**: `agent-output/e2e-ralph-loop/00-session-state.json`

## RALPH Loop Protocol

For each step, execute this mini-loop:

```
iteration = 0
while step.status != "complete" AND iteration < 5:
    result = execute_step(step)
    pre_validate(result)        # file exists, non-empty, expected H2s
    if pre_validation_fails:
        log_lesson("agent-behavior", severity="high")
        iteration++; continue
    validate_step(result)       # run npm validators + artifact checks
    run_challenger(step, 1_pass, "comprehensive")
    if validation_fails OR must_fix > 0:
        feed_findings_back()    # RALPH self-correction
        iteration++
    else:
        auto_approve_gate(step)
        advance_to_next_step()
```

**Max iterations**: 5 per step, 40 total across all steps.

## Execution Sequence

### PHASE A: Verify Pre-Seeded Foundations

1. Read `agent-output/e2e-ralph-loop/00-session-state.json` — confirm Steps 1 and 4 are `complete`
2. Validate `01-requirements.md`: file exists, non-empty, contains expected H2 headings (🎯 Project Overview, 🚀 Functional Requirements, ⚡ Non-Functional Requirements, 🔒 Compliance & Security Requirements, 💰 Budget, 🔧 Operational Requirements, 🌍 Regional Preferences, 📊 Complexity Classification, 📋 Summary for Architecture Assessment, References)
3. Run `node scripts/validate-e2e-step.mjs 1` to validate Step 1 artifacts
4. Run 1-pass challenger review via `@challenger-review-subagent` on `01-requirements.md` with comprehensive lens
5. If must_fix > 0: edit requirements to fix, re-validate, log lesson
6. Mark Step 1 gate as approved in session state
7. Validate `04-implementation-plan.md`: same file/H2 checks
8. Note: Step 4 will be fully re-validated in Phase D after governance discovery

### PHASE B: Architecture (Step 2)

1. Update session state: Step 2 → `in_progress`
2. Invoke `@03-Architect` subagent: _"Create a WAF assessment with cost estimates based on `agent-output/e2e-ralph-loop/01-requirements.md`. This is a simple-complexity project (App Service + SQL + Storage, <€500/month, GDPR, single prod env). Save `02-architecture-assessment.md` and `03-des-cost-estimate.md` to `agent-output/e2e-ralph-loop/`. Do NOT use askQuestions — all requirements are in the file."_
3. **Pre-validate**: `02-architecture-assessment.md` exists, non-empty, contains H2s
4. Run `node scripts/validate-e2e-step.mjs 2`
5. Run 1-pass challenger via `@challenger-review-subagent` (comprehensive lens)
6. If validation fails or must_fix > 0: feed findings back, re-invoke architect (max 3 iterations)
7. Record benchmark metrics (WAF scores, cost accuracy, timing)
8. Update session state: Step 2 → `complete`, auto-approve Gate 2

### PHASE B.5: Design (Step 3) — Optional

1. Update session state: Step 3 → `in_progress`
2. Invoke `@04-Design` subagent: _"Generate architecture diagrams and an ADR for `agent-output/e2e-ralph-loop/`. Read `02-architecture-assessment.md` for context. Simple project: App Service + SQL + Storage. Save `03-des-diagram.py`, `03-des-adr-*.md` to `agent-output/e2e-ralph-loop/`. Do NOT use askQuestions."_
3. **Pre-validate**: at least one `03-des-*.md` file and one `03-des-*.py` file
4. Run 1-pass challenger (comprehensive lens)
5. Self-correct if needed (max 3 iterations)
6. On failure after max iterations: mark Step 3 as `skipped` (optional step), log lesson, continue
7. Record benchmark metrics

### PHASE C: Governance (Step 3.5)

1. Update session state: Step 3.5 → `in_progress`
2. Invoke `@04g-Governance` subagent: _"Discover Azure Policy constraints for `agent-output/e2e-ralph-loop/`. Read `02-architecture-assessment.md` for the resource list. Produce `04-governance-constraints.md` and `04-governance-constraints.json` in `agent-output/e2e-ralph-loop/`. If no Azure credentials available, produce a template with common GDPR-relevant policies."_
3. **Pre-validate**: both `.md` and `.json` files exist; JSON is parseable
4. Run 1-pass challenger (comprehensive lens)
5. Self-correct if needed (max 3 iterations)
6. Update session state: Step 3.5 → `complete`, auto-approve

### PHASE D: IaC Plan Re-Validation (Step 4 — pre-seeded)

1. Re-validate `04-implementation-plan.md` against governance constraints from Step 3.5
2. Run 1-pass challenger via `@challenger-review-subagent` (security-governance lens) on `04-implementation-plan.md`
3. If must_fix > 0: edit the plan to incorporate governance findings, re-validate (max 2 iterations)
4. Update session state: Step 4 → confirmed `complete`, auto-approve Gate 3

### PHASE E: IaC Code (Step 5)

1. Update session state: Step 5 → `in_progress`
2. Invoke `@06b-Bicep CodeGen` subagent: _"Implement the Bicep templates according to `agent-output/e2e-ralph-loop/04-implementation-plan.md`. Save to `infra/bicep/e2e-ralph-loop/`. Read governance constraints from `agent-output/e2e-ralph-loop/04-governance-constraints.json`. Do NOT use askQuestions — all decisions are in the plan."_
3. **Pre-validate**: `infra/bicep/e2e-ralph-loop/main.bicep` exists, non-empty, `modules/` directory present
4. Run `bicep build infra/bicep/e2e-ralph-loop/main.bicep` — if errors contain hallucinated property names, log lesson with `factual-accuracy` category
5. Run `bicep lint infra/bicep/e2e-ralph-loop/main.bicep`
6. Self-correct: feed lint/build errors back (max 5 iterations)
7. Run 1-pass challenger via `@bicep-review-subagent` (security-governance lens)
8. Update session state: Step 5 → `complete`, auto-approve Gate 4

### PHASE F: Deploy (Step 6) — Dry Run

1. Update session state: Step 6 → `in_progress`
2. Since this is an E2E evaluation, perform dry-run validation only:
   - Run `bicep build infra/bicep/e2e-ralph-loop/main.bicep` (final confirmation)
   - If Azure credentials available: run `az deployment group what-if` via `@bicep-whatif-subagent`
   - Otherwise: mark as `validated-not-deployed`
3. Create `agent-output/e2e-ralph-loop/06-deployment-summary.md` with dry-run results
4. Update session state: Step 6 → `complete`

### PHASE G: As-Built Documentation (Step 7)

1. Update session state: Step 7 → `in_progress`
2. Invoke `@08-As-Built` subagent: _"Generate the Step 7 documentation suite for `agent-output/e2e-ralph-loop/`. Read all prior artifacts (01-06). Since this was a dry-run deployment, document the validated infrastructure design. Produce: `07-documentation-index.md`, `07-design-document.md`, `07-operations-runbook.md`, `07-resource-inventory.md`, `07-backup-dr-plan.md`, `07-compliance-matrix.md`, `07-ab-cost-estimate.md`."_
3. **Pre-validate**: at least 5 `07-*.md` files exist and are non-empty
4. Run 1-pass challenger (comprehensive lens)
5. Self-correct if needed (max 3 iterations)
6. Update session state: Step 7 → `complete`

### PHASE H: Benchmark, Lessons & Report

1. Run `node scripts/validate-e2e-step.mjs all` for final validation
2. Run `npm run validate:all` as the ultimate pass/fail
3. Run `node scripts/benchmark-e2e.mjs` to generate benchmark scores
4. Review `09-lessons-learned.json` — generate `09-lessons-learned.md` narrative:
   - Executive Summary: top systemic issues, self-correction rate
   - Per-Step Findings: what worked, what broke, retries needed
   - Agent Improvement Recommendations with file paths
   - Factual Accuracy Issues (hallucinated Azure properties)
   - Validator Coverage Gaps
5. Output final status:
   - **`E2E_COMPLETE`**: All steps complete, validators pass, benchmark > 60/100
   - **`E2E_PARTIAL`**: Steps 1-5 complete but 6-7 had issues
   - **`E2E_BLOCKED`**: Mandatory step failed after max iterations

## Pre-Validation Checklist (Per Step)

| Step | Expected Artifact(s)                    | Expected H2 Headings (first 3)                                                  |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------- |
| 1    | `01-requirements.md`                    | 🎯 Project Overview, 🚀 Functional Requirements, ⚡ Non-Functional Requirements |
| 2    | `02-architecture-assessment.md`         | Check for WAF-related H2s                                                       |
| 3    | `03-des-*.md`, `03-des-*.py`            | At least 1 ADR file + 1 diagram script                                          |
| 3.5  | `04-governance-constraints.md`, `.json` | JSON parseable, .md has policy content                                          |
| 4    | `04-implementation-plan.md`             | 📋 Overview, 📦 Resource Inventory, 🗂️ Module Structure                         |
| 5    | `infra/bicep/e2e-ralph-loop/main.bicep` | `bicep build` succeeds, `modules/` dir exists                                   |
| 6    | `06-deployment-summary.md`              | Deployment result documented                                                    |
| 7    | `07-*.md` (≥5 files)                    | Documentation suite present                                                     |

## Lesson Capture Rules

Record a lesson to `09-lessons-learned.json` whenever:

- A step needs >1 iteration (self-correction fired)
- A validator fails on first pass
- Pre-validation fails (agent returned garbage/empty)
- A challenger finding reveals a gap
- `bicep build` fails with hallucinated properties → `factual-accuracy` category
- Context budget concern → `context-budget` category
- Step exceeds timing threshold (simple ≤ 3 min, codegen ≤ 10 min) → `workflow-design` category

### Lesson Schema

```json
{
  "id": "LL-NNN",
  "step": 5,
  "category": "agent-behavior|skill-gap|prompt-quality|validation-gap|workflow-design|context-budget|artifact-quality|factual-accuracy",
  "severity": "critical|high|medium|low",
  "title": "Short description",
  "observation": "What happened",
  "expected": "What should have happened",
  "root_cause": "Why it happened",
  "self_corrected": true,
  "iterations_to_fix": 2,
  "recommendation": "Actionable fix",
  "applies_to": ["Agent or skill name"],
  "applies_to_paths": [".github/agents/path-to-file.agent.md"],
  "status": "new"
}
```

## Context Budget Management

Track approximate context usage. If the conversation feels large (many subagent returns, large artifacts):

1. Save current state to `00-session-state.json`
2. Write `00-handoff.md` with current progress
3. Output: `SESSION_SPLIT_NEEDED — resume from Step {N} by re-invoking this prompt`
4. Log a `context-budget` lesson

## Completion

When all phases are done, output:

```
<promise>E2E_COMPLETE</promise>
```

Or if partial/blocked, output the appropriate status with detailed reasons.

## Safety Rails

- **Never deploy real Azure resources** — dry-run only (Phase F)
- **Max 5 iterations per step** — if exceeded, mark as blocked and log lesson
- **Max 40 total iterations** — hard stop with `E2E_BLOCKED` if exceeded
- **Do not modify production agents** — E2E conductor is separate from `01-Conductor`
- **Do not skip validation** — every step must pass pre-validation before full validation
