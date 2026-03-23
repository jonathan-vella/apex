---
title: "E2E Testing with Ralph Loop"
description: "End-to-end testing with the Ralph Loop pattern"
---

End-to-end testing for the InfraOps pipeline using the autonomous
[RALPH Loop](https://ghuntley.com/ralph/) pattern.

## What Is Ralph Loop?

Ralph Loop is a self-correcting E2E evaluation workflow that runs all InfraOps
pipeline steps **without human gates**. It validates the entire agent pipeline
autonomously — from requirements through deployment to documentation — with
built-in self-correction, challenger reviews, and benchmark scoring.

Key characteristics:

- **Autonomous**: all gates auto-approve after validation passes
- **Self-correcting**: validation failures feed findings back to the agent for retry (max 5 per step)
- **IaC-agnostic**: supports both Bicep and Terraform tracks
- **Dry-run only**: never deploys real Azure resources (uses `bicep what-if` or `terraform plan`)
- **Benchmarked**: produces an 8-dimension quality score (0–100)

## Supported IaC Tracks

| Track     | Code Directory               | Entry File   | Validation Commands                          |
| --------- | ---------------------------- | ------------ | -------------------------------------------- |
| Bicep     | `infra/bicep/{project}/`     | `main.bicep` | `bicep build`, `bicep lint`                  |
| Terraform | `infra/terraform/{project}/` | `main.tf`    | `terraform validate`, `terraform fmt -check` |

The IaC tool is read from `decisions.iac_tool` in `00-session-state.json`.
To switch tracks, change the `IaC tool` field in the prompt file's Project Context section.

## How to Run

### Quick Validation (Structural)

Validates all E2E artifacts for structural compliance (fast, no agent invocation):

```bash
# Default project
npm run e2e:validate

# Specific project
node scripts/validate-e2e-step.mjs --project=terraform-e2e all

# Single step
node scripts/validate-e2e-step.mjs --project=e2e-ralph-loop 5
```

### Benchmark Scoring

Runs the 8-dimension benchmark and generates a report:

```bash
# Default project (e2e-ralph-loop)
npm run e2e:benchmark

# Terraform project
npm run e2e:benchmark -- terraform-e2e

# Multi-project comparison
npm run e2e:benchmark -- --compare
```

### Full Ralph Loop Execution

Open VS Code Chat and use one of the prompt files:

1. **Simple project (pre-seeded)**: Open `.github/prompts/e2e-ralph-loop.prompt.md`
2. **Complex project (RFP-driven)**: Open `.github/prompts/e2e-contoso-rfp.prompt.md`
3. **Post-loop analysis**: Open `.github/prompts/e2e-analyze-lessons.prompt.md`

The E2E Conductor agent (`.github/agents/e2e-conductor.agent.md`) orchestrates
the loop with conditional IaC routing based on session state.

## Benchmark Scoring Dimensions

The benchmark engine scores each run across 8 dimensions:

| Dimension               | Weight | What It Measures                                                  |
| ----------------------- | ------ | ----------------------------------------------------------------- |
| Artifact completeness   | 20%    | All required step outputs exist                                   |
| Structural compliance   | 15%    | Artifact template format, H2 sync, session state                  |
| Code quality            | 20%    | Bicep build/lint or Terraform validate/fmt + AVM usage            |
| Review thoroughness     | 10%    | Challenger review passes executed per step                        |
| WAF coverage            | 10%    | All 5 Well-Architected pillars in architecture                    |
| Cost accuracy           | 5%     | Budget stated + cost estimate exists                              |
| Session state integrity | 10%    | Schema version, project, decisions, decision_log, step completion |
| Timing performance      | 10%    | Duration within thresholds (3 min normal, 10 min codegen)         |

**Composite score** = weighted average. Grades: A (90–100), B (80–89), C (70–79), D (60–69), F (\<60).

Pass threshold: 60/100 (configurable via `E2E_PASS_THRESHOLD` environment variable).

## Interpreting Results

### Benchmark Report

After running `npm run e2e:benchmark`, check:

- `agent-output/{project}/08-benchmark-report.md` — human-readable scorecard
- `agent-output/{project}/08-benchmark-scores.json` — machine-readable JSON

### Lessons Learned

Self-correction events and systemic issues are captured in:

- `agent-output/{project}/09-lessons-learned.json` — structured findings
- `agent-output/{project}/09-lessons-learned.md` — narrative summary

### Iteration Log

Per-step attempt tracking in `agent-output/{project}/08-iteration-log.json`.

### Decision Log

Cross-agent decisions are captured in the `decision_log` array inside `00-session-state.json`.
Each entry records what was decided, why, what was rejected, and which agent made the call.
The benchmark scores `decision_log` presence as part of session state integrity.
See `.github/instructions/decision-logging.instructions.md` for the entry schema.

## Test Projects

| Project                     | IaC Tool  | Complexity | Description                         |
| --------------------------- | --------- | ---------- | ----------------------------------- |
| `e2e-ralph-loop`            | Bicep     | Simple     | Nordic Fresh Foods Lite (canonical) |
| `terraform-e2e`             | Terraform | Simple     | Small ecommerce storefront          |
| `contoso-service-hub-run-1` | Bicep     | Complex    | Contoso Service Hub (RFP-driven)    |
| `contoso-service-hub-run-2` | Bicep     | Complex    | Contoso Service Hub (second run)    |

## Troubleshooting

### Benchmark score is 0 for code quality

The IaC tool is detected from `00-session-state.json`. Ensure `iac_tool` is set to
either `Bicep` or `Terraform` in the session state.

### Terraform validation fails during E2E

Run `terraform init -backend=false` in the project directory first.
The validator runs this automatically, but network issues may cause failures.

### Pre-validation fails after agent return

The agent may have written to the wrong output directory. Check that the project
name in session state matches the `--project` flag.
