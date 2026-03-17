---
agent: agent
description: "RFP-driven RALPH loop for Contoso Service Hub. Consumes docs/e2e-inputs/contoso-rfq.md as input, runs the full 7-step InfraOps pipeline autonomously with complexity-aware challenger reviews, phased CodeGen, and AVM matrix pre-computation."
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

# E2E RALPH Loop — Contoso Service Hub (RFP-Driven)

You are the **E2E Evaluation Conductor** running an automated, self-correcting evaluation loop
through the full 7-step InfraOps workflow. This prompt consumes an RFP document as input and
generates ALL artifacts from scratch — nothing is pre-seeded.

## Project Context

- **Project**: `contoso-service-hub-run-2` (update suffix for each run: -run-2, -run-3)
- **Output directory**: `agent-output/contoso-service-hub-run-2/`
- **IaC directory**: Bicep: `infra/bicep/contoso-service-hub-run-2/` | Terraform: `infra/terraform/contoso-service-hub-run-2/`
- **IaC tool**: Bicep _(Change to `Terraform` and update agent refs below for Terraform track runs)_
- **Complexity**: determined at runtime by Step 1 (expected: complex)
- **RFP source**: `docs/e2e-inputs/contoso-rfq.md`
- **Pre-seeded artifacts**: NONE — everything generated from RFP
- **Session state**: `agent-output/contoso-service-hub-run-1/00-session-state.json`

> **IaC Tool Routing**: The IaC tool field above controls which agents and validators are invoked.
> If `Bicep`: invoke `@05b-Bicep Planner`, `@06b-Bicep CodeGen`, `@07b-Bicep Deploy`; validate with `bicep build`/`bicep lint`; code dir = `infra/bicep/{project}/`.
> If `Terraform`: invoke `@05t-Terraform Planner`, `@06t-Terraform CodeGen`, `@07t-Terraform Deploy`; validate with `terraform validate`/`terraform fmt -check`; code dir = `infra/terraform/{project}/`.

## RALPH Loop Protocol

For each step, execute this mini-loop:

```
iteration = 0
while step.status != "complete" AND iteration < max_step_iterations:
    result = execute_step(step)
    pre_validate(result)        # file exists, non-empty, expected H2s
    if pre_validation_fails:
        log_lesson("agent-behavior", severity="high")
        iteration++; continue
    validate_step(result)       # run npm validators + artifact checks
    run_challenger(step, pass_count_from_complexity, lens_sequence)
    if validation_fails OR must_fix > 0:
        feed_findings_back()    # RALPH self-correction
        iteration++
    else:
        auto_approve_gate(step)
        advance_to_next_step()
```

**Max iterations**: 5 per step (10 for Step 5 CodeGen), 60 total across all steps.

## Complexity-Aware Review Matrix

Read complexity from session state after Step 1 completes. Use this matrix:

| Step | Simple (1 pass) | Standard (2 pass)                              | Complex (3 pass)                                                  |
| ---- | --------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| 1    | comprehensive   | comprehensive                                  | comprehensive                                                     |
| 2    | comprehensive   | security-governance → architecture-reliability | security-governance → architecture-reliability → cost-feasibility |
| 3    | comprehensive   | comprehensive                                  | comprehensive                                                     |
| 3.5  | comprehensive   | comprehensive                                  | comprehensive                                                     |
| 4    | comprehensive   | security-governance                            | security-governance → architecture-reliability                    |
| 5    | comprehensive   | security-governance → comprehensive            | security-governance → architecture-reliability → cost-feasibility |
| 7    | comprehensive   | comprehensive                                  | comprehensive                                                     |

## Execution Sequence

### PHASE A: RFP Intake + Requirements Generation (Step 1)

1. Read `00-session-state.json` — confirm all steps are `pending`
2. Update session state: Step 1 → `in_progress`
3. Read `docs/e2e-inputs/contoso-rfq.md` fully — this is the Contoso Service Hub RFQ
4. Invoke `@02-Requirements` subagent with this prompt:
   \_"You are generating requirements from an RFP document. Read `docs/e2e-inputs/contoso-rfq.md` completely.
   Do NOT use askQuestions — this is an automated E2E evaluation. Extract ALL requirements
   from the RFP and generate `01-requirements.md` in `agent-output/contoso-service-hub-run-1/`
   using the standard requirements template with these H2 headings: 🎯 Project Overview,
   🚀 Functional Requirements, ⚡ Non-Functional Requirements, 🔒 Compliance & Security Requirements,
   💰 Budget, 🔧 Operational Requirements, 🌍 Regional Preferences, 📊 Complexity Classification,
   📋 Summary for Architecture Assessment, References.
   Key extraction points from the RFP:
   - Company: Contoso — EU real estate/lifestyle digital services (Section 2)
   - Platform: Service Hub — bookings, payments, content, customer engagement (Section 3)
   - 15 cloud services with volumetrics (Section 4.2, Table 2)
   - 3 environments: Dev, Staging, Production (Section 4.4)
   - EU-only data residency, GDPR mandatory (Section 4.3)
   - 99.9% availability SLA target (Section 4.5)
   - 5,000 initial users → growth; 50K txns 2026 → 2M txns 2027 (Section 4.5)
   - The RFP does NOT specify a budget — estimate based on the 15 services and volumetrics
   - IaC tool: Bicep
   - Set complexity classification based on resource count, environments, and compliance scope
     For any information gaps in the RFP, add them to an 'Open Questions' section at the end
     and flag them as pending decisions in the session state decision*log.
     Also update session state with the complexity classification once determined."*
5. **Pre-validate**: `01-requirements.md` exists, non-empty, contains expected H2 headings
6. Run `node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-1 1`
7. Run 1-pass challenger via `@challenger-review-subagent` (comprehensive lens)
8. Self-correct if needed (max 5 iterations)
9. Read complexity from session state (or from the generated requirements)
10. Update `review_audit` pass counts based on determined complexity
11. Update session state: Step 1 → `complete`, auto-approve Gate 1

### PHASE B: Architecture (Step 2)

1. Update session state: Step 2 → `in_progress`
2. Invoke `@03-Architect` subagent:
   _"Create a WAF assessment with cost estimates based on
   `agent-output/contoso-service-hub-run-1/01-requirements.md`.
   Do NOT use askQuestions — all requirements are in the file. This is an automated E2E run.
   Derive all NFRs, budget estimates, SLA targets, and compliance requirements from the
   requirements document. If budget is estimated (not explicit), state the estimation methodology.
   Save `02-architecture-assessment.md` and `03-des-cost-estimate.md` to
   `agent-output/contoso-service-hub-run-1/`.
   Key: This is a Contoso Service Hub with 15+ Azure services, 3 environments, GDPR compliance."_
3. **Pre-validate**: `02-architecture-assessment.md` exists, non-empty, contains WAF H2s
4. Run `node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-1 2`
5. Run challenger reviews per complexity matrix (if complex: 3-pass rotating lenses)
6. Self-correct if needed (max 5 iterations per pass)
7. Record benchmark metrics (WAF scores, cost accuracy, timing)
8. Update session state: Step 2 → `complete`, auto-approve Gate 2

### PHASE B.5: Design (Step 3)

1. Update session state: Step 3 → `in_progress`
2. Invoke `@04-Design` subagent:
   \_"Generate architecture diagrams and ADRs for `agent-output/contoso-service-hub-run-1/`.
   Read `02-architecture-assessment.md` for context. Do NOT use askQuestions.
   This is a complex Contoso Service Hub: AKS, PostgreSQL, Redis, APIM, WAF/CDN, CIAM,
   storage, monitoring, Key Vault, VMs. Generate:
   - `03-des-diagram.py` (architecture diagram)
   - `03-des-adr-001-container-platform.md` (AKS vs Container Apps decision)
   - `03-des-adr-002-caching-tier.md` (Redis tier decision)
     Save all to `agent-output/contoso-service-hub-run-1/`."\_
3. **Pre-validate**: at least one `03-des-*.md` and one `03-des-*.py` file
4. Run 1-pass challenger (comprehensive lens)
5. Self-correct if needed (max 3 iterations)
6. On failure after max: mark Step 3 as `skipped`, log lesson, continue
7. Update session state: Step 3 → `complete` or `skipped`

### PHASE C: Governance (Step 3.5)

1. Update session state: Step 3.5 → `in_progress`
2. Invoke `@04g-Governance` subagent:
   _"Discover Azure Policy constraints for `agent-output/contoso-service-hub-run-1/`.
   Do NOT use askQuestions — this is an automated E2E run.
   Read `02-architecture-assessment.md` for the resource list. Produce
   `04-governance-constraints.md` and `04-governance-constraints.json` in
   `agent-output/contoso-service-hub-run-1/`.
   If no Azure credentials available, produce a comprehensive template with
   GDPR-relevant policies for: AKS, PostgreSQL, Redis, Storage, APIM, App Gateway/WAF,
   Key Vault, VMs, networking. Include TLS 1.2, HTTPS-only, EU-only regions,
   required tags, managed identity, public network access restrictions."_
3. **Pre-validate**: both `.md` and `.json` files exist; JSON parseable
4. Run 1-pass challenger (comprehensive lens)
5. Self-correct if needed (max 3 iterations)
6. Update session state: Step 3.5 → `complete`

### PHASE D: IaC Plan Generation (Step 4)

1. Update session state: Step 4 → `in_progress`
2. Invoke `@05b-Bicep Planner` subagent:
   \_"Create a comprehensive Bicep implementation plan based on
   `agent-output/contoso-service-hub-run-1/02-architecture-assessment.md` and
   `agent-output/contoso-service-hub-run-1/04-governance-constraints.json`.
   Do NOT use askQuestions — all decisions are in the architecture assessment.
   This is an automated E2E run for a complex Contoso Service Hub.
   Save `04-implementation-plan.md`, `04-dependency-diagram.py`, and `04-runtime-diagram.py`
   to `agent-output/contoso-service-hub-run-1/`.
   Key requirements:
   - AVM-first module selection for all resources
   - 3 environments (dev, staging, prod) with environment-specific sizing
   - Phased deployment: foundation → data → edge → platform
   - All governance constraints must be incorporated
   - Budget estimate per environment
   - CAF naming conventions with uniqueSuffix"\_
3. **Pre-validate**: `04-implementation-plan.md` exists with expected H2s
4. Run `node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-1 4`
5. Run challenger reviews per complexity matrix (if complex: 2-pass)
6. Self-correct if needed (max 5 iterations)
7. Update session state: Step 4 → `complete`, auto-approve Gate 3

### PHASE D.5: AVM Matrix Pre-computation (NEW)

Before CodeGen, generate a verified AVM module version matrix:

1. Read `04-implementation-plan.md` — extract all resources from the Resource Inventory table
2. For each resource, look up the exact AVM module path and latest version
3. Create `agent-output/contoso-service-hub-run-1/04-avm-matrix.json`:
   ```json
   {
     "modules": [
       {
         "resource": "AKS Cluster",
         "avm_path": "br/public:avm/res/container-service/managed-cluster",
         "version": "0.x.x",
         "key_params": [
           "kubernetesVersion",
           "agentPoolProfiles",
           "networkProfile"
         ]
       }
     ]
   }
   ```
4. This matrix is passed to CodeGen as a lookup table to reduce hallucinated versions

### PHASE E: IaC Code — Phased Sub-Runs (Step 5)

1. Update session state: Step 5 → `in_progress`

**Sub-phase E1: Foundation** (monitoring, Key Vault, networking, budget) 2. Invoke `@06b-Bicep CodeGen` subagent:
\_"Implement ONLY the foundation modules according to
`agent-output/contoso-service-hub-run-1/04-implementation-plan.md`.
Save to `infra/bicep/contoso-service-hub-run-1/`.
Read governance constraints from `agent-output/contoso-service-hub-run-1/04-governance-constraints.json`.
Read AVM versions from `agent-output/contoso-service-hub-run-1/04-avm-matrix.json`.
Do NOT use askQuestions. Generate ONLY:

- `main.bicep` (orchestrator with phase selector)
- `main.bicepparam` (parameter file)
- `modules/monitoring.bicep` (Log Analytics + App Insights)
- `modules/keyvault.bicep` (Key Vault)
- `modules/networking.bicep` (VNet, subnets, NSGs)
- `modules/budget.bicep` (consumption budget)
  Do NOT generate data, edge, or platform modules yet."\_

3. Run `bicep build` + `bicep lint` on `main.bicep`
4. Self-correct build errors (max 5 iterations)

**Sub-phase E2: Data** (PostgreSQL, Redis, storage) 5. Invoke `@06b-Bicep CodeGen` with instruction to ADD data modules:
\_"Add data-tier modules to the existing `infra/bicep/contoso-service-hub-run-1/`.
Read the implementation plan and AVM matrix. Do NOT use askQuestions. Add ONLY:

- `modules/postgresql.bicep` (Flexible Server)
- `modules/redis.bicep` (Azure Cache for Redis)
- `modules/storage.bicep` (Storage Account — blob + file + managed disks)
  Update `main.bicep` to reference the new modules."\_

6. Run `bicep build` + `bicep lint`; self-correct (max 5 iterations)

**Sub-phase E3: Edge** (WAF, CDN, APIM, CIAM) 7. Add edge modules:
_"Add edge/security modules: `modules/waf.bicep` (Application Gateway + WAF),
`modules/cdn.bicep` (Front Door or CDN), `modules/apim.bicep` (API Management),
`modules/identity.bicep` (Entra External ID / B2C config).
Update `main.bicep`."_ 8. Build + lint + self-correct (max 5 iterations)

**Sub-phase E4: Platform** (AKS, VMs, compute) 9. Add platform modules:
_"Add platform modules: `modules/aks.bicep` (AKS cluster with node pools),
`modules/vm.bicep` (utility VMs for SDLC/monitoring).
Update `main.bicep` to wire all modules together.
Ensure all cross-module dependencies (managed identity roles, networking refs) are correct."_ 10. Build + lint + self-correct (max 5 iterations)

**Final Assembly Validation** 11. Run `bicep build infra/bicep/contoso-service-hub-run-1/main.bicep` — must succeed 12. Run `bicep lint infra/bicep/contoso-service-hub-run-1/main.bicep` — must pass 13. Run challenger reviews per complexity matrix (if complex: 3-pass on final assembled template) 14. Update session state: Step 5 → `complete`, auto-approve Gate 4

### PHASE F: Deploy (Step 6) — Dry Run

1. Update session state: Step 6 → `in_progress`
2. Dry-run validation only:
   - Run `bicep build infra/bicep/contoso-service-hub-run-1/main.bicep` (final confirmation)
   - If Azure credentials available: run `az deployment group what-if` via `@bicep-whatif-subagent`
   - Otherwise: mark as `validated-not-deployed`
3. Create `agent-output/contoso-service-hub-run-1/06-deployment-summary.md` using the standard
   deployment summary template (H2s: ✅ Preflight Validation, 📋 Deployment Details,
   🏗️ Deployed Resources, 📤 Outputs (Expected), 🚀 To Actually Deploy, 📝 Post-Deployment Tasks)
4. Update session state: Step 6 → `complete`

### PHASE G: As-Built Documentation (Step 7)

1. Update session state: Step 7 → `in_progress`
2. Invoke `@08-As-Built` subagent:
   _"Generate the Step 7 documentation suite for `agent-output/contoso-service-hub-run-1/`.
   Read all prior artifacts (01-06). Since this was a dry-run deployment, document the
   validated infrastructure design. Do NOT use askQuestions. Produce:
   `07-documentation-index.md`, `07-design-document.md`, `07-operations-runbook.md`,
   `07-resource-inventory.md`, `07-backup-dr-plan.md`, `07-compliance-matrix.md`,
   `07-ab-cost-estimate.md`."_
3. **Pre-validate**: at least 5 `07-*.md` files exist and are non-empty
4. Run 1-pass challenger (comprehensive lens)
5. Self-correct if needed (max 3 iterations)
6. Update session state: Step 7 → `complete`

### PHASE H: Benchmark, Lessons & Report

1. Run `node scripts/validate-e2e-step.mjs --project=contoso-service-hub-run-1 all`
2. Run `npm run validate:all` as the ultimate pass/fail
3. Run `node scripts/benchmark-e2e.mjs contoso-service-hub-run-1` to generate benchmark scores
4. Review `09-lessons-learned.json` — generate `09-lessons-learned.md` narrative
5. Output final status:
   - **`E2E_COMPLETE`**: All steps complete, validators pass, benchmark > 60/100
   - **`E2E_PARTIAL`**: Steps 1-5 complete but 6-7 had issues
   - **`E2E_BLOCKED`**: Mandatory step failed after max iterations

## Pre-Validation Checklist (Per Step)

| Step | Expected Artifact(s)                               | Validation                                              |
| ---- | -------------------------------------------------- | ------------------------------------------------------- |
| 1    | `01-requirements.md`                               | H2s present, complexity classified                      |
| 2    | `02-architecture-assessment.md`                    | WAF H2s, cost estimate present                          |
| 3    | `03-des-*.md`, `03-des-*.py`                       | At least 1 ADR + 1 diagram                              |
| 3.5  | `04-governance-constraints.md/.json`               | JSON parseable, policies listed                         |
| 4    | `04-implementation-plan.md`                        | 📋 Overview, 📦 Resource Inventory, 🗂️ Module Structure |
| D.5  | `04-avm-matrix.json`                               | JSON parseable, modules listed                          |
| 5    | `infra/bicep/contoso-service-hub-run-1/main.bicep` | `bicep build` succeeds, `modules/` dir exists           |
| 6    | `06-deployment-summary.md`                         | Template-compliant H2s                                  |
| 7    | `07-*.md` (≥5 files)                               | Documentation suite present                             |

## Lesson Capture Rules

Record a lesson to `09-lessons-learned.json` whenever:

- A step needs >1 iteration (self-correction fired)
- A validator fails on first pass
- Pre-validation fails (agent returned garbage/empty)
- A challenger finding reveals a gap
- `bicep build` fails with hallucinated properties → `factual-accuracy` category
- Context budget concern → `context-budget` category
- Step exceeds timing threshold → `workflow-design` category
- An RFP gap required autonomous resolution → `agent-behavior` category

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

## RFP Gap Tracking

The Contoso RFP has 3 intentional gaps that agents MUST resolve autonomously:

1. **No explicit budget** — agents must estimate from the 15 service volumetrics
2. **128 GB Redis sizing** — agents must select the right Azure tier (Premium P4 vs Enterprise)
3. **AKS vs Container Apps** — RFP says "Container Engine" + "Managed Kubernetes"

Track resolution of these gaps:

- In `01-requirements.md`: "Open Questions" section listing each gap
- In `00-session-state.json`: `decision_log` entries with `status: "pending"` (Step 1)
  then `status: "resolved"` once Architecture (Step 2) makes the decision

## Context Budget Management

This is a complex project. Context pressure will be high. If approaching limits:

1. Save current state to `00-session-state.json`
2. Write `00-handoff.md` with current progress
3. Output: `SESSION_SPLIT_NEEDED — resume from Step {N} by re-invoking this prompt`
4. Log a `context-budget` lesson

## Multi-Run Support

This prompt supports multiple independent runs via per-run namespacing:

- **Run 1**: project = `contoso-service-hub-run-1`
- **Run 2**: project = `contoso-service-hub-run-2`
- **Run 3**: project = `contoso-service-hub-run-3`

Each run has its own `agent-output/{project}/` and `infra/bicep/{project}/` directories.
No archiving or reset needed — runs are naturally isolated.

Update the Project Context section at the top of this prompt to change the run number.

## Safety Rails

- **Never deploy real Azure resources** — dry-run only (Phase F)
- **Max 5 iterations per step** (10 for Step 5) — if exceeded, mark as blocked and log lesson
- **Max 60 total iterations** — hard stop with `E2E_BLOCKED` if exceeded
- **Do not modify production agents** — all autonomous behavior via prompt-level override
- **Do not skip validation** — every step must pass pre-validation before full validation

## Completion

When all phases are done, output:

```
<promise>E2E_COMPLETE</promise>
```

Or if partial/blocked, output the appropriate status with detailed reasons.
