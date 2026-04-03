# Tests

End-to-end testing for the APEX pipeline using the
[RALPH Loop](https://ghuntley.com/ralph/) pattern.

## Directory Structure

```text
tests/
  e2e-inputs/              # Input fixtures (RFPs, RFQs) consumed by E2E prompts
    contoso-rfq.md         # Contoso Service Hub RFQ — complex scenario
  prompts/                 # E2E evaluation prompt files
    e2e-contoso-rfp.prompt.md    # Full 7-step RALPH loop (RFP-driven)
    e2e-analyze-lessons.prompt.md # Post-run lesson analysis
  exec-plans/              # Execution plans and tech-debt tracking
    active/                # In-progress plans
    completed/             # Finished plans
  test-hooks.sh            # Agent hooks test script
```

## Quick Start

### 1. Run validation on existing artifacts

```bash
# Validate all E2E artifacts (structural checks)
npm run e2e:validate

# Validate a specific step
node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-1 2

# Benchmark scoring (8 dimensions, 0-100)
npm run e2e:benchmark

# Benchmark a specific project
npm run e2e:benchmark -- contoso-service-hub-run-1
```

### 2. Run a full E2E evaluation

Open VS Code Chat (`Ctrl+Shift+I`) and use the E2E prompt:

```text
/tests/prompts/e2e-contoso-rfp.prompt.md
```

This prompt is test-only and non-interactive:

- It uses the RFP as the source of truth.
- It pre-populates interactive answers with fixed test defaults.
- It routes each workflow step through the real workflow agent when one exists.
- It requires the real Draw.io, pricing, governance, and dry-run deployment
  paths instead of substituting inline benchmark-only artifacts.

This runs the full 7-step pipeline autonomously:

1. **Requirements** — extracts from `tests/e2e-inputs/contoso-rfq.md`
2. **Architecture** — WAF assessment + cost estimates
3. **Design** — ADRs + diagrams (optional, skippable)
4. **Governance** — Azure Policy discovery
5. **IaC Plan** — module selection + dependency ordering
6. **IaC Code** — Bicep or Terraform generation (phased for complex projects)
7. **Deploy** — dry-run validation only (never deploys real resources)
8. **As-Built** — documentation suite
9. **Benchmark** — 8-dimension quality scoring

### 2.1 Run six independent benchmark passes (3 Bicep + 3 Terraform)

For statistically useful evaluation, run the prompt 6 times — 3 per IaC track:

**Bicep runs:**

- `contoso-service-hub-run-1` (IaC tool: Bicep)
- `contoso-service-hub-run-2` (IaC tool: Bicep)
- `contoso-service-hub-run-3` (IaC tool: Bicep)

**Terraform runs:**

- `contoso-service-hub-tf-run-1` (IaC tool: Terraform)
- `contoso-service-hub-tf-run-2` (IaC tool: Terraform)
- `contoso-service-hub-tf-run-3` (IaC tool: Terraform)

For best throughput, open separate chat sessions and launch them in parallel.

After the runs complete:

```bash
# Validate all runs
node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-1 all
node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-2 all
node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-3 all
node scripts/validate-e2e-step.mjs --project=contoso-service-hub-tf-run-1 all
node scripts/validate-e2e-step.mjs --project=contoso-service-hub-tf-run-2 all
node scripts/validate-e2e-step.mjs --project=contoso-service-hub-tf-run-3 all

# Benchmark each run
node scripts/benchmark-e2e.mjs contoso-service-hub-run-1
node scripts/benchmark-e2e.mjs contoso-service-hub-run-2
node scripts/benchmark-e2e.mjs contoso-service-hub-run-3
node scripts/benchmark-e2e.mjs contoso-service-hub-tf-run-1
node scripts/benchmark-e2e.mjs contoso-service-hub-tf-run-2
node scripts/benchmark-e2e.mjs contoso-service-hub-tf-run-3

# Combine per track
node scripts/combine-e2e-runs.mjs contoso-service-hub-run-1 contoso-service-hub-run-2 contoso-service-hub-run-3
node scripts/combine-e2e-runs.mjs contoso-service-hub-tf-run-1 contoso-service-hub-tf-run-2 contoso-service-hub-tf-run-3

# Cross-track comparison
npm run e2e:benchmark -- --compare
```

### 3. Analyze lessons from a run

After a run completes, analyze the lessons learned:

```text
/tests/prompts/e2e-analyze-lessons.prompt.md
```

## RALPH Loop Protocol

Each step follows this self-correcting loop:

```text
iteration = 0
while step.status != "complete" AND iteration < max_iterations:
    result = execute_step(step)
    pre_validate(result)          # file exists, non-empty, expected H2s
    validate_step(result)         # npm validators + artifact checks
    run_challenger(step, lens)    # adversarial review
    if validation_fails OR must_fix > 0:
        feed_findings_back()      # self-correction
        iteration++
    else:
        auto_approve_gate(step)
        advance_to_next_step()
```

**Limits**: 5 iterations per step (10 for CodeGen), 60 total.

## Available Scenarios

| Scenario            | Input                       | Complexity | IaC Track          | Description                             |
| ------------------- | --------------------------- | ---------- | ------------------ | --------------------------------------- |
| Contoso Service Hub | `e2e-inputs/contoso-rfq.md` | Complex    | Bicep or Terraform | 15 Azure services, 3 environments, GDPR |

The same prompt supports both IaC tracks via the `iac_tool` input variable.
Pass `Bicep` (default) or `Terraform` when invoking the prompt.

To add a new scenario, create an RFP/RFQ file in `e2e-inputs/` and a
corresponding prompt in `prompts/`.

## Output Locations

E2E runs produce output in these directories (not in `tests/`):

| Output            | Location                                          |
| ----------------- | ------------------------------------------------- |
| Agent artifacts   | `agent-output/{project}/`                         |
| Bicep templates   | `infra/bicep/{project}/`                          |
| Terraform configs | `infra/terraform/{project}/`                      |
| Benchmark scores  | `agent-output/{project}/08-benchmark-scores.json` |
| Lessons learned   | `agent-output/{project}/09-lessons-learned.json`  |

## CI Integration

The E2E validation workflow runs weekly and on manual trigger:

```bash
# Trigger manually via GitHub CLI
gh workflow run e2e-validation
```

See `.github/workflows/e2e-validation.yml` for the full CI configuration.

## Validation Scripts

| Script                          | Purpose                      |
| ------------------------------- | ---------------------------- |
| `scripts/validate-e2e-step.mjs` | Per-step artifact validation |
| `scripts/benchmark-e2e.mjs`     | 8-dimension quality scoring  |
| `scripts/combine-e2e-runs.mjs`  | Multi-run comparison         |

## Safety

- E2E runs **never deploy real Azure resources** — dry-run only
- Max iteration limits prevent infinite loops
- The E2E Orchestrator is separate from the production `01-Orchestrator` agent
