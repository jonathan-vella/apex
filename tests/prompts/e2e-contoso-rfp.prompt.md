---
name: e2e-contoso-rfp
agent: E2E Orchestrator
description: "Run a single real, RFP-driven Contoso Service Hub E2E workflow using the actual agents, MCP tools, and dry-run deployment path."
argument-hint: "Specify project name and IaC tool (Bicep or Terraform)"
---

# E2E RALPH Loop — Contoso Service Hub (Real-Run Mode)

## Pre-Flight: Discover Existing Runs

Before starting any workflow, scan for existing Contoso Service Hub runs.

1. List all directories under `agent-output/` that match `contoso-service-hub-*`.
2. For each match, read `00-session-state.json` (if it exists) and extract:
   - `current_step` (last completed step)
   - `status` (e.g., `in_progress`, `completed`, `blocked`)
   - `iac_tool`
3. Also check for matching IaC directories under `infra/bicep/` and
   `infra/terraform/` that correspond to each discovered run.
4. Present the findings to the user using the `askQuestions` tool with these
   options:

   | Option                    | When to show                                  | Description                                                                                                                                                      |
   | ------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **New loop**              | Always                                        | Start a fresh run with a new project name (auto-increment suffix, e.g., `run-2`)                                                                                 |
   | **Continue `{run-name}`** | For each existing run that is not `completed` | Resume from the last completed step                                                                                                                              |
   | **Delete `{run-name}`**   | For each existing run                         | Remove the `agent-output/{run-name}/` folder and its `infra/bicep/{run-name}/` or `infra/terraform/{run-name}/` directory. Ask for confirmation before deleting. |

5. Wait for the user's selection before proceeding.
6. If the user selects **New loop**, prompt for project name and IaC tool using
   the `${input}` defaults below, then continue to the Mission section.
7. If the user selects **Continue**, set the project name and IaC tool from the
   existing session state and resume from the next incomplete step.
8. If the user selects **Delete**, remove the selected directories after
   confirmation, then re-run this pre-flight check (the user may want to
   start a new loop or delete another run).

If no existing runs are found, skip directly to the Mission section with a
new loop.

---

## Mission

Run the Contoso Service Hub benchmark as a real automated workflow, not as a
simulation. Treat this prompt as scenario input and execution policy for the
`E2E Orchestrator`, not as permission to synthesize missing workflow steps
inline.

This prompt replaces the earlier inline-friendly behavior. Steps with real
workflow agents must go through those agents.

## Run Configuration

Execute one complete RALPH loop (Steps 1–8) with the specified project and
IaC tool:

- Project: `${input:project:contoso-service-hub-run-1}`
- IaC tool: `${input:iac_tool:Bicep}`

## Project Context

- RFP source: `tests/e2e-inputs/contoso-rfq.md`
- Output directory: `agent-output/{project}/`
- IaC directory (Bicep): `infra/bicep/{project}/`
- IaC directory (Terraform): `infra/terraform/{project}/`
- Benchmark mode: dry-run only
- Target complexity: expected `complex`, but Step 1 must classify it

## Real-Run Requirements

- Use the actual workflow agents for every step that has one:
  1. `02-Requirements`
  2. `03-Architect`
  3. `04-Design`
  4. `04g-Governance`
  5. `05-IaC Planner`
  6. Bicep: `06b-Bicep CodeGen` / Terraform: `06t-Terraform CodeGen`
  7. Bicep: `07b-Bicep Deploy` / Terraform: `07t-Terraform Deploy`
  8. `08-As-Built`
- **Run isolation is MANDATORY**: Do NOT read, copy, or adapt artifacts from
  any other run directory (`agent-output/{other-project}/`,
  `infra/bicep/{other-project}/`, `infra/terraform/{other-project}/`).
  Each artifact must be generated from scratch using only the RFQ, prompt
  defaults, and this run's own upstream artifacts. See the "Run Isolation"
  section below for full rules and enforcement.
- Use `challenger-review-subagent` for every required review pass. Challenger
  reviews MUST be executed via the actual subagent (delegated or inline per the
  Challenger Protocol in the E2E Orchestrator agent). Each review MUST produce
  a persisted JSON artifact saved to
  `agent-output/{project}/10-challenger-step{N}.json` (e.g.,
  `10-challenger-step1.json`). The `review_audit` counters in session state
  are necessary but NOT sufficient — the JSON file must exist.
- Step 2 is invalid unless the architecture and cost estimate are backed by the
  real pricing path used by `03-Architect`.
- Step 3 must produce `03-des-diagram.drawio` through the Draw.io path when the
  Draw.io tools are available.
- Step 3.5 must use live Azure Policy discovery when Azure auth exists. Use an
  offline governance artifact only when auth is unavailable.
- Step 4 must use `05-IaC Planner`. Do not generate the implementation plan
  inline just to bypass `askQuestions`.
- Step 5 must aim for concrete modules. Scaffold-only output is not an
  acceptable success path unless a blocker is explicitly documented.
- Step 6 must use actual dry-run validation. Do not invent `what-if` or
  `terraform plan` results.
- Do not replace a failed agent invocation with inline artifact creation just to
  keep the benchmark green.
- The only files you may create inline without delegation are orchestrator-owned
  bookkeeping files such as `00-session-state.json`, `00-handoff.md`,
  `08-iteration-log.json`, `08-benchmark-report.md`,
  `10-challenger-step{N}.json` (challenger review outputs), and lesson files.

## IaC Tool Routing

The `iac_tool` input controls which agents and
validators run for Steps 4-6. Steps 1-3.5 are IaC-agnostic.

| Aspect         | Bicep                                        | Terraform                                          |
| -------------- | -------------------------------------------- | -------------------------------------------------- |
| Planner        | `05-IaC Planner` (Bicep mode)                | `05-IaC Planner` (Terraform mode)                  |
| CodeGen        | `06b-Bicep CodeGen`                          | `06t-Terraform CodeGen`                            |
| Deploy         | `07b-Bicep Deploy` / `bicep-whatif-subagent` | `07t-Terraform Deploy` / `terraform-plan-subagent` |
| Code Review    | `bicep-validate-subagent`                    | `terraform-validate-subagent`                      |
| Code Dir       | `infra/bicep/{project}/`                     | `infra/terraform/{project}/`                       |
| Entry File     | `main.bicep`                                 | `main.tf`                                          |
| Build/Validate | `bicep build` + `bicep lint`                 | `terraform validate` + `terraform fmt -check`      |
| AVM Pattern    | `br/public:avm`                              | `registry.terraform.io/Azure/avm-res-`             |

## Defaults for Interactive Agents

When a delegated agent asks follow-up questions, answer from these defaults and
continue without waiting for the user:

- Company: Contoso, EU real estate and lifestyle digital services platform
- Platform: Service Hub for bookings, payments, content, and engagement
- Environments: `dev`, `staging`, `prod`
- Region: `swedencentral` primary; `germanywestcentral` and `westeurope`
  remain EU-approved alternatives
- Compliance: GDPR, EU-only data residency, EU-only logs, backups, and metadata
- Availability target: `99.9%`
- User and volume baseline: 5,000 initial users; 50,000 transactions in 2026;
  nearly 2,000,000 transactions in 2027
- Governance scope: full subscription when authenticated; offline-only fallback
  if Azure auth is unavailable
- Deployment strategy: phased rollout `foundation -> data -> edge -> platform`
- IaC track: as specified by `iac_tool` (Bicep or Terraform)
- Design step: enabled
- Diagram format: Draw.io is required when available
- Benchmark mode: dry-run only, never deploy live Azure resources
- Budget: no RFQ budget is provided, so estimate a planning range and keep the
  final commercial ceiling open in `decision_log`

## Step Execution Rules

### Step 1: Requirements

- Invoke `02-Requirements`.
- Feed it the RFQ plus the defaults above instead of waiting on questions.
- Require `01-requirements.md` and an updated `00-session-state.json`.
- The session state must include `decisions`, `decision_log`, `review_audit`,
  and a complexity classification.
- **Challenger review (MANDATORY)**: After `01-requirements.md` passes
  pre-validation, invoke `challenger-review-subagent` with `comprehensive`
  lens. Save the full challenger JSON output to
  `agent-output/{project}/10-challenger-step1.json`. If `must_fix > 0`,
  feed findings back to `02-Requirements` and re-validate. Update
  `review_audit.step_1` in session state before proceeding to Step 2.
  **Gate**: Do NOT proceed to Step 2 unless `10-challenger-step1.json`
  exists in the output directory.

### Step 2: Architecture

- Invoke `03-Architect`.
- Require a real WAF assessment across all five pillars.
- Require a real cost estimate from the pricing-backed architecture flow.
- Require `02-architecture-assessment.md` and `03-des-cost-estimate.md`.
- If the pricing path cannot be used, stop with `E2E_BLOCKED` and explain why.
- **Challenger review (MANDATORY)**: After `02-architecture-assessment.md`
  passes pre-validation, invoke `challenger-review-subagent` with
  `comprehensive` lens. Save the full challenger JSON output to
  `agent-output/{project}/10-challenger-step2.json`. If `must_fix > 0`,
  feed findings back to `03-Architect` and re-validate. Update
  `review_audit.step_2` in session state before proceeding to Step 3.
  **Gate**: Do NOT proceed to Step 3 unless `10-challenger-step2.json`
  exists in the output directory.

### Step 3: Design

- Invoke `04-Design`.
- Require `03-des-diagram.drawio`,
  `03-des-adr-0001-container-platform.md`, and
  `03-des-adr-0002-caching-tier.md`.
- Do not prefer Python diagram fallbacks when Draw.io is available.

### Step 3.5: Governance

- Invoke `04g-Governance`.
- Require live discovery when Azure auth exists.
- Require `04-governance-constraints.md` and
  `04-governance-constraints.json` with `discovery_status = COMPLETE`.
- **Challenger review (MANDATORY)**: Invoke `challenger-review-subagent`
  with `comprehensive` lens on `04-governance-constraints.md`. Save the
  full challenger JSON output to
  `agent-output/{project}/10-challenger-step3_5.json`. Update
  `review_audit.step_3_5` in session state.
  **Gate**: Do NOT proceed to Step 4 unless `10-challenger-step3_5.json`
  exists in the output directory.

### Step 4: IaC Plan

- Invoke `05-IaC Planner`.
- Require `04-implementation-plan.md`.
- Require `04-dependency-diagram.drawio` and `04-runtime-diagram.drawio` when
  Draw.io is available.
- Require `04-avm-matrix.json` with AVM paths and pinned versions, not just
  module names.
- **Challenger review (MANDATORY)**: After `04-implementation-plan.md` passes
  pre-validation, invoke `challenger-review-subagent` with `comprehensive`
  lens. Save the full challenger JSON output to
  `agent-output/{project}/10-challenger-step4.json`. If `must_fix > 0`,
  feed findings back to `05-IaC Planner` and re-validate. Update
  `review_audit.step_4` in session state before proceeding to Step 5.
  **Gate**: Do NOT proceed to Step 5 unless `10-challenger-step4.json`
  exists in the output directory.

### Step 5: IaC Code

- Bicep: invoke `06b-Bicep CodeGen`.
- Terraform: invoke `06t-Terraform CodeGen`.
- Bicep: require `main.bicep`, `main.bicepparam`, and concrete service modules
  under `infra/bicep/{project}/modules/`.
- Terraform: require `main.tf`, `variables.tf`, `outputs.tf`, and concrete
  service modules under `infra/terraform/{project}/modules/`.
- Run the track-appropriate validation after each major correction cycle:
  - Bicep: `bicep build` and `bicep lint`
  - Terraform: `terraform validate` and `terraform fmt -check`
- If a module must remain partial, mark the run `E2E_PARTIAL` or
  `E2E_BLOCKED`; do not treat a scaffold-only result as complete.
- **Challenger review (MANDATORY)**: After IaC code passes build/validate,
  invoke `challenger-review-subagent` with `comprehensive` lens on the
  generated code directory. Save the full challenger JSON output to
  `agent-output/{project}/10-challenger-step5.json`. If `must_fix > 0`,
  feed findings back to the codegen agent and re-validate. Update
  `review_audit.step_5` in session state before proceeding to Step 6.
  **Gate**: Do NOT proceed to Step 6 unless `10-challenger-step5.json`
  exists in the output directory.

### Step 6: Deploy (Dry Run)

- Bicep: invoke `07b-Bicep Deploy`.
- Terraform: invoke `07t-Terraform Deploy`.
- Require final build/validate validation for the active track.
- When Azure auth exists:
  - Bicep: require `what-if` execution through the deploy path.
  - Terraform: require `terraform plan` execution through the deploy path.
- Require `06-deployment-summary.md` to reflect the real preview output.
- **Challenger review (MANDATORY)**: Invoke `challenger-review-subagent`
  with `comprehensive` lens on `06-deployment-summary.md`. Save the full
  challenger JSON output to
  `agent-output/{project}/10-challenger-step6.json`. Update
  `review_audit.step_6` in session state.

### Step 7: As-Built

- Invoke `08-As-Built`.
- Require the full documentation suite based on the real outputs of Steps 1-6.

### Step 8: Benchmark and Lessons

- Run `node scripts/validate-e2e-step.mjs --project={project} all`.
- Run `npm run validate:all` and report unrelated baseline failures separately
  from run-specific failures.
- Run `node scripts/benchmark-e2e.mjs {project}`.
- Generate both `09-lessons-learned.json` and `09-lessons-learned.md`.

## Validation and Review Expectations

- Every step must pass pre-validation before full validation.
- **Challenger reviews are MANDATORY for Steps 1, 2, 3.5, 4, 5, and 6.**
  Do not advance past these steps without executing the challenger,
  persisting the full JSON output to
  `agent-output/{project}/10-challenger-step{N}.json`, and recording the
  result in `review_audit`.
- The orchestrator must verify BOTH conditions before transitioning:
  1. `review_audit.step_{N}.passes_executed >= 1` in session state
  2. The file `10-challenger-step{N}.json` exists in the output directory
- If either condition is missing, STOP and run the challenger review.
- `decision_log` must record how the RFQ gaps were resolved.
- If Draw.io, pricing, governance discovery, or `what-if` are unavailable,
  record that as a blocker or partial-result reason. Do not silently replace the
  missing path with synthetic content.

## RFQ Gaps to Resolve with Real Agent Decisions

1. No explicit budget.
2. 128 GB Redis tier selection.
3. AKS versus Container Apps for the platform runtime.

Track these in `decision_log` as pending in Step 1 and resolved by the relevant
downstream agents.

## Run Isolation (MANDATORY — Anti-Copy Enforcement)

Each E2E run MUST produce independently generated artifacts. The orchestrator
MUST NOT read, copy, or adapt artifacts from any other run directory.

### Prohibited Actions

- **NEVER** read files from `agent-output/{other-project}/` directories
- **NEVER** read files from `infra/bicep/{other-project}/` or
  `infra/terraform/{other-project}/` directories
- **NEVER** copy an artifact from a prior run and find-replace the project name
- **NEVER** reuse `decision_log` entries or timestamps from another run

### Freshness Verification (Post-Step)

After each step produces an artifact, the orchestrator MUST verify it was not
copied from an existing run:

1. List all other `contoso-service-hub-*` directories under `agent-output/`
2. For each primary artifact produced, compare it against the matching file
   (by name) in every other run directory
3. If **byte-identical** matches are found: the artifact is INVALID —
   delete it, log a `run-isolation-violation` lesson, and re-execute the step
4. **Project-name-only diffs also count as copies** (e.g., only difference
   is `run-1` → `run-2`)

### Timestamp Coherence

- All `decision_log[].timestamp` values MUST fall between this run's start
  time and the current wall-clock time
- Reusing timestamps from a prior run (e.g., `10:50:34Z` from run-1 appearing
  in run-2's decision log) is a violation
- `08-iteration-log.json` entries MUST use actual elapsed durations, not
  fabricated round numbers

### Violation Response

If >50% of a run's artifacts are byte-identical to an existing run, terminate
the run immediately with `E2E_BLOCKED` and reason `run-isolation-violation`.

## Safety Rails

- Never deploy real Azure resources.
- Maximum 5 iterations per step, or 10 for Step 5.
- Maximum 60 total iterations.
- Do not modify production agents as part of the run.
- Do not skip validation to preserve benchmark scores.

## Completion

When the run finishes, output one of these statuses:

- `<promise>E2E_COMPLETE</promise>`
- `<promise>E2E_PARTIAL</promise>`
- `<promise>E2E_BLOCKED</promise>`

Include detailed reasons when the status is partial or blocked.
