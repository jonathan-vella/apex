<!-- ref:context-budgets-v1 -->

# Context Budgets & Sub-Step Checkpoints

## Context Budget Table

Each agent loads ONLY the files listed below at startup. No exceptions.
Skills are loaded AFTER the prerequisites check, not at agent init.

| Step | Agent        | Max Files | Allowed Files                                                                            |
| ---- | ------------ | --------- | ---------------------------------------------------------------------------------------- |
| 1    | Requirements | 1         | `00-session-state.json`                                                                  |
| 2    | Architect    | 2         | `00-session-state.json` + `01-requirements.md`                                           |
| 3    | Design       | 2         | `00-session-state.json` + `02-architecture-assessment.md`                                |
| 4    | Planner      | 2         | `00-session-state.json` + `02-architecture-assessment.md`                                |
| 5    | CodeGen      | 3         | `00-session-state.json` + `04-implementation-plan.md` + `04-governance-constraints.json` |
| 6    | Deploy       | 2         | `00-session-state.json` + `05-implementation-reference.md`                               |
| 7    | As-Built     | 3         | `00-session-state.json` + `06-deployment-summary.md` + `02-architecture-assessment.md`   |

> Additional files (e.g. `04-governance-constraints.md` for CodeGen) may be
> loaded on-demand during a specific sub-step — never at startup.

## Sub-Step Checkpoints

Each agent defines numbered internal phases. After completing each phase,
the agent writes the checkpoint to `steps.{N}.sub_step` in the JSON state.

### Step 1: Requirements (02-Requirements)

| Checkpoint          | After completing...                     |
| ------------------- | --------------------------------------- |
| `phase_1_discovery` | Phase 1 business discovery questions    |
| `phase_2_workload`  | Phase 2 workload pattern detection      |
| `phase_3_nfr`       | Phase 3 NFR and compliance questions    |
| `phase_4_technical` | Phase 4 technical questions             |
| `phase_5_artifact`  | Artifact generation + challenger review |

### Step 2: Architecture (03-Architect)

| Checkpoint           | After completing...                  |
| -------------------- | ------------------------------------ |
| `phase_1_prereqs`    | Prerequisites validated              |
| `phase_2_waf`        | WAF assessment drafted               |
| `phase_3_cost`       | Cost estimate generated via subagent |
| `phase_4_challenger` | Challenger reviews complete          |
| `phase_5_artifact`   | Final artifacts saved                |

### Step 3: Design (04-Design)

| Checkpoint         | After completing...            |
| ------------------ | ------------------------------ |
| `phase_1_prereqs`  | Prerequisites validated        |
| `phase_2_diagram`  | Architecture diagram generated |
| `phase_3_adr`      | ADR(s) drafted                 |
| `phase_4_artifact` | All design artifacts saved     |

### Step 4: IaC Plan (05-IaC Planner)

| Checkpoint           | After completing...                     |
| -------------------- | --------------------------------------- |
| `phase_1_governance` | Governance discovery complete           |
| `phase_2_avm`        | AVM module verification done            |
| `phase_3_plan`       | Implementation plan drafted             |
| `phase_3_5_strategy` | Deployment strategy confirmed by user   |
| `phase_4_diagrams`   | Dependency + runtime diagrams generated |
| `phase_5_challenger` | Challenger reviews complete             |
| `phase_6_artifact`   | All plan artifacts saved                |

### Step 5: IaC Code (06b/06t CodeGen)

| Checkpoint             | After completing...                      |
| ---------------------- | ---------------------------------------- |
| `phase_1_preflight`    | Preflight check complete                 |
| `phase_1.5_governance` | Governance compliance mapping done       |
| `phase_2_scaffold`     | Project scaffolded (main + modules dirs) |
| `phase_3_modules`      | All modules generated                    |
| `phase_4_lint`         | Lint + review subagents passed           |
| `phase_5_challenger`   | Challenger reviews complete              |
| `phase_6_artifact`     | Implementation reference saved           |

### Step 6: Deploy (07b/07t Deploy)

| Checkpoint         | After completing...                       |
| ------------------ | ----------------------------------------- |
| `phase_1_auth`     | Azure CLI auth validated                  |
| `phase_2_preview`  | What-if / plan output reviewed            |
| `phase_3_deploy`   | Deployment executed (per-phase if phased) |
| `phase_4_verify`   | Post-deployment verification done         |
| `phase_5_artifact` | Deployment summary saved                  |

### Step 7: As-Built (08-As-Built)

| Checkpoint          | After completing...                         |
| ------------------- | ------------------------------------------- |
| `phase_1_prereqs`   | All prior artifacts + deployed state read   |
| `phase_2_inventory` | Resource inventory generated                |
| `phase_3_docs`      | Design doc + runbook + compliance generated |
| `phase_4_cost`      | As-built cost estimate via subagent         |
| `phase_5_diagram`   | As-built diagram generated                  |
| `phase_6_index`     | Documentation index + README updated        |
