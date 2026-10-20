<!-- ref:compression-templates-v1 -->

# Compression Templates

Per-artifact compression rules at each tier. H2 sections to keep/drop
and character budget targets.

## 01-requirements.md

| Tier       | Keep H2 Sections                                                                              | Budget      |
| ---------- | --------------------------------------------------------------------------------------------- | ----------- |
| full       | All                                                                                           | No limit    |
| summarized | Project Overview, Functional Requirements, Non-Functional Requirements, Technical Constraints | ~3000 chars |
| minimal    | Project Overview (first paragraph only), Key Decisions table                                  | ~500 chars  |

## 02-architecture-assessment.md

| Tier       | Keep H2 Sections                                                      | Budget      |
| ---------- | --------------------------------------------------------------------- | ----------- |
| full       | All                                                                   | No limit    |
| summarized | Architecture Pattern, WAF Assessment, Key Decisions, Resource Summary | ~4000 chars |
| minimal    | Architecture Pattern (first paragraph), Key Decisions table           | ~500 chars  |

## 03-des-cost-estimate.md

| Tier       | Keep H2 Sections                             | Budget      |
| ---------- | -------------------------------------------- | ----------- |
| full       | All                                          | No limit    |
| summarized | Cost Summary, Monthly Total, Key Assumptions | ~2000 chars |
| minimal    | Monthly Total line only                      | ~200 chars  |

## 04-implementation-plan.md

| Tier       | Keep H2 Sections                                                       | Budget      |
| ---------- | ---------------------------------------------------------------------- | ----------- |
| full       | All                                                                    | No limit    |
| summarized | Module Inventory, Deployment Strategy, Parameter Summary, Dependencies | ~5000 chars |
| minimal    | Module Inventory table, Deployment Strategy (first paragraph)          | ~800 chars  |

## 04-governance-constraints.md

| Tier       | Keep H2 Sections                                    | Budget      |
| ---------- | --------------------------------------------------- | ----------- |
| full       | All                                                 | No limit    |
| summarized | Deny Policies, Mandatory Tags, Network Restrictions | ~3000 chars |
| minimal    | Deny Policies table only                            | ~500 chars  |

## 05-implementation-reference.md

| Tier       | Keep H2 Sections                                        | Budget      |
| ---------- | ------------------------------------------------------- | ----------- |
| full       | All                                                     | No limit    |
| summarized | Files Generated, Validation Results, Key Configurations | ~3000 chars |
| minimal    | Files Generated list only                               | ~400 chars  |

## 06-deployment-summary.md

| Tier       | Keep H2 Sections                                     | Budget      |
| ---------- | ---------------------------------------------------- | ----------- |
| full       | All                                                  | No limit    |
| summarized | Deployment Result, Resources Deployed, Configuration | ~3000 chars |
| minimal    | Deployment Result (status + resource count)          | ~300 chars  |

## 07-\* (As-Built Documents)

As-built documents are terminal — they are not loaded by downstream agents.
Compression is only needed when the As-Built agent loads predecessor artifacts.

## General Rules

- When compressing, preserve all **tables** within kept sections (tables are dense)
- Drop **code blocks** first (they are verbose)
- Keep **decision rationale** over implementation details
- Keep **resource names and SKUs** over configuration details
- Always preserve the document title (H1) and first paragraph
- At the `minimal` tier, prefer reading `decision_log` from `apex-recall show <project> --json`
  over loading full artifact prose for rationale behind prior choices

## SDK Worker Boundary And Recovery Contract

The Copilot SDK harness in VS Code gives each worker its own context. Do not
require the Local `/clear`/agent-picker ritual or claim a token saving merely
because a worker started. Measure actual native usage at worker boundaries.

### Durable completion

Before returning `STEP_COMPLETE`, the owning step checkpoints through
`apex-recall checkpoint <project> <step> <phase> --json` and updates `00-handoff.md`
with paths, actual validation results and unresolved findings. Required reviews
and completion checks still apply. `USER_INPUT_REQUIRED` is a pending phase,
not completion. Worker completion is never human approval.

The Orchestrator presents the graph's human gate with `ask_user`. Only after
approval and current preconditions may it record an atomic
`apex-recall transition --complete` and prepare the next named worker.
Use the [native worker lifecycle](../../apex-workflow-engine/references/worker-readiness.md):
bounded task inputs and actual outputs, with same-task continuation only when supported.
No nonce exchange, model attestation or per-worker log gate is required.

### Recovery

In a new VS Code SDK session select `01-Orchestrator` and send `resume <project>`:

1. Start with `apex-recall show <project> --json`.
2. Recover current phase, decisions, review attempts and explicit approvals.
3. Read `00-handoff.md` for missing paths; refresh unavailable or stale required inputs.
4. Revalidate affected review hashes and current gate/action readiness.
5. Reuse a verified live worker only with attributable current evidence;
   otherwise provide a new bounded native task with recovered inputs.

Do not infer completion from artifact numbering, reset state or restamp reviews.
A session restart, compaction or lost worker never renews review attempts or approvals.

### Validation

`tools/scripts/validate_orchestrator_handoff.py` checks source contracts.
The historical `verify-worker-ready.mjs` reader is diagnostic compatibility only;
neither source contracts nor diagnostic logs prove approval or deployment success.
