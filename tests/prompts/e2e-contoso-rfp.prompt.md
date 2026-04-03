---
name: e2e-contoso-rfp
agent: E2E Orchestrator
description: "Run a single real, RFP-driven Contoso Service Hub E2E workflow using the actual agents, MCP tools, and dry-run deployment path."
argument-hint: "Specify project name and IaC tool (Bicep or Terraform)"
---

# E2E RALPH Loop — Contoso Service Hub (Real-Run Mode)

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
- Use `challenger-review-subagent` for every required review pass.
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
  `08-iteration-log.json`, `08-benchmark-report.md`, and lesson files.

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

### Step 2: Architecture

- Invoke `03-Architect`.
- Require a real WAF assessment across all five pillars.
- Require a real cost estimate from the pricing-backed architecture flow.
- Require `02-architecture-assessment.md` and `03-des-cost-estimate.md`.
- If the pricing path cannot be used, stop with `E2E_BLOCKED` and explain why.

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

### Step 4: IaC Plan

- Invoke `05-IaC Planner`.
- Require `04-implementation-plan.md`.
- Require `04-dependency-diagram.drawio` and `04-runtime-diagram.drawio` when
  Draw.io is available.
- Require `04-avm-matrix.json` with AVM paths and pinned versions, not just
  module names.

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

### Step 6: Deploy (Dry Run)

- Bicep: invoke `07b-Bicep Deploy`.
- Terraform: invoke `07t-Terraform Deploy`.
- Require final build/validate validation for the active track.
- When Azure auth exists:
  - Bicep: require `what-if` execution through the deploy path.
  - Terraform: require `terraform plan` execution through the deploy path.
- Require `06-deployment-summary.md` to reflect the real preview output.

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
- Every required challenger pass must execute and be reflected in
  `review_audit`.
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
