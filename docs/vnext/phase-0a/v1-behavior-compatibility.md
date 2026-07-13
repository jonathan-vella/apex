# APEX v1 Behavior Compatibility Matrix

> [Current Version](../../../VERSION.md) | Approved preserve, change, and retire decisions for the v1 replacement.

## Decision Contract

All rows refer to the candidate source recorded in [baseline-evidence.json](baseline-evidence.json). A disposition means:

| Disposition | Contract                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `preserve`  | The user-visible or operational behavior remains in the first complete vNext release. Internals may be replaced. |
| `change`    | The need remains, but its interface, authority boundary, sequencing, or evidence contract changes.               |
| `retire`    | The v1 behavior is intentionally absent. The row names its replacement or explicit acceptance boundary.          |

The replacement-owner values refer to the target `packages/*`, `customizations/`, optional `plugin/`, and `config/`
boundaries in the approved plan.
Every row requires either an executable characterization or an explicit acceptance before the v1 freeze tag.

## Mandatory Preserved Operations

The locked plan makes these first-release obligations regardless of implementation:

- Setup and doctor checks.
- Quota, service, region, and SKU availability checks before Architecture and again before Preview.
- Read-only-by-default post-deploy diagnosis.
- Deterministic lessons and quality reporting.
- Project list, use, show, search, and history behavior.
- Requirements, Architecture and Cost, Implementation Plan, and Deployment Preview decisions per environment run.
- Native Bicep and Terraform preview, approval, apply, inventory, drift, destroy preview, and approved teardown.

## User and Runtime Behaviors

### Setup, Project, and State

| ID                       | v1 behavior                                                                                                         | Disposition | Rationale and vNext owner                                                                                       | Source and characterization                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `setup.init`             | `npm run init` rewrites template references for a consumer repository.                                              | `change`    | `packages/cli` owns `apex init/update`; managed workspace customizations use a three-way-update manifest.       | `tools/scripts/init-from-template.mjs`; setup integration acceptance.                            |
| `setup.azure-github`     | `npm run setup` configures Azure/GitHub OIDC, secrets, RBAC, and local setup state.                                 | `preserve`  | `packages/cli` and authorized `packages/capabilities` retain setup with typed evidence and stable errors.       | `tools/scripts/setup-azure.sh`; manual setup qualification.                                      |
| `setup.doctor`           | Container and scripts check required CLIs, runtimes, auth, and version floors.                                      | `preserve`  | `packages/cli` owns actionable `apex doctor`; checks customization drift, runtime locks, packs, and backends.   | `.devcontainer/`, `tools/registry/tool-version-pins.json`, `npm run test:devcontainer-verdicts`. |
| `setup.bootstrap`        | Devcontainer installs root, site, Python, Deno, MCP, and hook dependencies.                                         | `change`    | TypeScript core installs first; independently locked Python/Deno capability packs install lazily when required. | `.devcontainer/post-create.sh`, `.devcontainer/post-start.sh`, full baseline transcript.         |
| `project.init-select`    | `apex-recall init` creates project state; decisions select project, environment, scope, and IaC track.              | `change`    | `packages/cli` writes versioned project/run config through the kernel; one environment and scope per run.       | `tools/apex-recall/`, `npm run test:apex-recall`.                                                |
| `project.search-history` | `files`, `sessions`, `search`, `show`, `decisions`, `reindex`, and `health` query repository state.                 | `preserve`  | `packages/cli` provides project list/use/show/search/history over events, objects, findings, and evidence.      | `apex-recall --help`, `tools/tests/test_apex_recall/`.                                           |
| `state.write-commands`   | `start-step`, `checkpoint`, `complete-step`, `decide`, `finding`, `review-audit`, and `transition` mutate v1 state. | `change`    | Kernel event append, expected-head CAS, leases, and task completion replace direct session-state mutation.      | `apex-recall --help`, `tools/tests/test_apex_recall/`.                                           |
| `state.resume`           | Repository state allows cold resume and cross-chat continuation.                                                    | `preserve`  | Events, immutable objects, refs, and runtime locks become canonical; chat history remains outside the boundary. | `.github/copilot-instructions.md`, apex-recall reconstruction tests.                             |
| `state.concurrent-write` | v1 relies on local file/SQLite behavior without a declared active-writer lease.                                     | `change`    | Kernel leases/CAS add bound ownership epochs and enforce local-to-CI transfer with stale-writer rejection.      | Explicit v1 limitation `DEF-005`; Phase 0B executable spike required.                            |
| `state.environment-copy` | Promotion is a manual copy or rerun rather than a linked environment run.                                           | `change`    | Linked runs inherit unchanged Gates 1-3 and always refresh environment preview, Gate 4, deploy, and inventory.  | Explicit acceptance; Phase 0B/3 promotion tests required.                                        |

### Workflow, Decisions, and Reviews

| ID                       | v1 behavior                                                                                   | Disposition | Rationale and vNext owner                                                                                      | Source and characterization                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `workflow.graph`         | A JSON DAG defines steps, conditions, forward edges, return edges, and self-refinement loops. | `preserve`  | `config/workflow.v1.json` remains deterministic but is redesigned rather than copied.                          | `.github/skills/workflow-engine/templates/workflow-graph.json`, `npm run validate:workflow-graph`. |
| `workflow.agent-routing` | Agent prose and handoffs participate in routing and next-step selection.                      | `change`    | Kernel computes next tasks; direct handoffs preserve questions/model escalation; subagents are noninteractive. | `npm run lint:workflow-handoffs`; VS Code fixture acceptance.                                      |
| `gate.requirements`      | Requirements review and approval precede Architecture.                                        | `preserve`  | Kernel Gate 1 opens only after schema, business validation, and comprehensive review pass.                     | Workflow `step-1` and `gate-1`; challenger-presence tests.                                         |
| `gate.architecture-cost` | Architecture and cost are approved before downstream planning.                                | `preserve`  | Kernel Gate 2 also requires complete current governance, pricing, quota, and availability evidence.            | Workflow `step-2` and `gate-2`; cost/governance validators.                                        |
| `gate.governance`        | v1 exposes a separate governance approval gate.                                               | `retire`    | Governance discovery and reconciliation remain blocking validation before Gate 2; no fifth human decision.     | Workflow `step-3_5` and `gate-2_5`; maintainer acceptance required.                                |
| `gate.plan`              | The implementation plan receives review and approval before CodeGen.                          | `preserve`  | Kernel Gate 3 approves neutral intent plus the selected binding and environment-input contract.                | Workflow `step-4` and `gate-3`; plan and challenger validators.                                    |
| `gate.code-validation`   | v1 models code validation as a workflow gate.                                                 | `retire`    | Deterministic batch/final validation remains mandatory but is not a human decision.                            | Workflow `step-5b`, `step-5t`, and `gate-4`; IaC validation commands.                              |
| `gate.deploy`            | v1 exposes deployment approval after track-specific deploy-agent preparation.                 | `change`    | Gate 4 is the exact Deployment Preview approval and directly authorizes only the bound operation.              | Workflow `step-6b`, `step-6t`, and `gate-5`; Phase 0B approval-envelope spike.                     |
| `review.comprehensive`   | Mandatory creative artifacts receive one comprehensive adversarial review.                    | `preserve`  | `apex-reviewer` produces typed findings; the kernel enforces resolution before each applicable gate.           | Challenger agents, sidecar schemas, challenger-presence tests.                                     |
| `review.multi-pass`      | v1 can opt into rotating multi-pass review.                                                   | `retire`    | First-release vNext scope defers multi-pass reviews; one comprehensive pass is canonical.                      | Workflow challenger matrices; explicit locked scope boundary.                                      |
| `review.risk-acceptance` | Finding decisions and audited challenger skips can record rationale.                          | `change`    | Accepted risk requires finding ID, owner, expiry, scope, and rationale and cannot bypass hard controls.        | `challenge-findings-decisions.schema.json`, decision validator tests.                              |
| `workflow.return-paths`  | Requirement, architecture, governance, plan, code, and deploy defects return to owning steps. | `preserve`  | Kernel invalidation closes all dependent reviews, gates, previews, and approvals on return.                    | Workflow `return_edges`; workflow graph and handoff tests.                                         |

### Contracts and Evidence

| ID                            | v1 behavior                                                                                 | Disposition | Rationale and vNext owner                                                                                        | Source and characterization                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `artifact.requirements`       | Requirements are stored as a structured Markdown artifact.                                  | `preserve`  | `packages/contracts` adds `requirements-v1`; `packages/renderers` produces Markdown.                             | Requirements agent/template and artifact validation.          |
| `artifact.sku-manifest`       | A JSON/Markdown SKU manifest is created early and revised through the workflow.             | `preserve`  | `sku-manifest-v1` remains authoritative with immutable revisions, provenance, and invalidation.                  | SKU schema, fixtures, renderer, and SKU coverage tests.       |
| `artifact.architecture`       | Architecture captures resources, dependencies, WAF trade-offs, operations, and recovery.    | `preserve`  | `architecture-v1` is canonical and rendered deterministically.                                                   | Architect agent/template and artifact validation.             |
| `artifact.cost-estimate`      | Pricing output records line items and assumptions in Markdown.                              | `preserve`  | `cost-estimate-v1` adds arithmetic, source time, uncertainty, currency, and exclusions.                          | Pricing MCP tests and cost-estimate subagent fixtures.        |
| `artifact.governance`         | Discovery emits Markdown and JSON constraints from effective Azure Policy.                  | `preserve`  | `governance-constraints-v1` records completeness, TTL, pages/scopes, assignments, exemptions, and API versions.  | Governance skill tests and governance schema.                 |
| `artifact.policy-map`         | Planning maps effective policy effects to resource properties.                              | `preserve`  | `policy-property-map-v1` becomes a validated input to neutral intent and track bindings.                         | Policy-map schema and validator.                              |
| `artifact.plan`               | The plan combines logical resources, controls, code obligations, and deployment sequencing. | `change`    | Split into `implementation-intent-v1`, `iac-binding-v1`, and `environment-inputs-v1`.                            | IaC plan agent, IaC contract schema, consistency validators.  |
| `artifact.iac-handoff`        | CodeGen hands validation evidence and code metadata to Deploy.                              | `change`    | Add logical manifest, tree/source hashes, tool evidence, and execution-plan attestation.                         | IaC handoff schema and validator.                             |
| `artifact.preview`            | Bicep what-if and Terraform plan are normalized into deployment preview evidence.           | `preserve`  | Preview becomes operation-specific, hash-bound, expiring, coverage-aware, and approval-ready.                    | Deployment-preview schema and fixtures; `DEF-003`.            |
| `artifact.deployment-summary` | Deploy agents emit a human summary of the operation.                                        | `change`    | Operation records and evidence manifests are canonical; renderers produce concise views.                         | Deploy agents/templates and artifact validation.              |
| `artifact.inventory-as-built` | Resource Graph/ARM evidence feeds inventory and an as-built documentation suite.            | `preserve`  | Complete secret-free inventory is canonical; deterministic renderers replace creative fan-out.                   | As-built agent/templates and Azure-resource trigger fixtures. |
| `artifact.review-findings`    | Challenger JSON sidecars and decisions record findings and dispositions.                    | `preserve`  | `review-findings-v1` and approval evidence separate creative findings from authenticated decisions.              | Challenger schemas, fixtures, and validators.                 |
| `artifact.lessons-quality`    | v1 records lessons and repository-level quality summaries.                                  | `preserve`  | `quality-report-v1` derives objective metrics from events; subjective claims stay labeled.                       | Lesson schema, quality scripts, baseline measurement.         |
| `artifact.private-evidence`   | Nonsecret project evidence is committed; secret-bearing files are excluded.                 | `change`    | Required attestations stay immutable; other evidence is allowlisted, bounded, deduplicated, and retention-aware. | `.gitignore`, hook validators, explicit locked decision.      |

### Capabilities, IaC, and Operations

| ID                              | v1 behavior                                                                 | Disposition | Rationale and vNext owner                                                                                  | Source and characterization                                       |
| ------------------------------- | --------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `capability.pricing`            | Python MCP queries and normalizes Azure pricing.                            | `preserve`  | Retain as a lazy exact-locked capability pack until measured evidence justifies replacement.               | `tools/mcp-servers/azure-pricing/`, pricing tests.                |
| `capability.governance`         | Python discovery queries effective Azure Policy including inherited scopes. | `preserve`  | Retain as a lazy validated capability pack; partial, failed, or stale results block Architecture approval. | Governance discovery skill and mocked discovery tests.            |
| `capability.quota-availability` | Skills guide quota, service, region, and SKU checks.                        | `preserve`  | Typed Azure capability runs before Architecture and again before Preview; substitution is never automatic. | Azure quotas skill trigger fixtures; manual Azure qualification.  |
| `capability.avm-resolution`     | Skills and cached indexes resolve Bicep/Terraform AVM modules and pins.     | `preserve`  | Deterministic metadata adapters return exact pins and native-resource fallback evidence.                   | AVM indexes and version validators.                               |
| `capability.drawio`             | Deno MCP generates optional diagrams.                                       | `change`    | Keep as an optional lazy pack outside the core install and critical path; it cannot affect gates.          | `tools/mcp-servers/drawio/`, Deno tests, surrogate reproducer.    |
| `iac.bicep-codegen`             | A dedicated creative agent writes and validates a Bicep tree.               | `change`    | Thin `apex-codegen` writes only task staging; kernel capabilities validate and accept batches.             | Bicep CodeGen and validation agents; Bicep checks.                |
| `iac.bicep-preview-apply`       | Deploy agent/subagent run what-if and native deployment operations.         | `change`    | Authorized deployment-stack adapter owns preview, apply, reconciliation, inventory, and stack delete.      | Bicep deploy/what-if agents; Phase 0B stack spike required.       |
| `iac.terraform-codegen`         | A dedicated creative agent writes and validates a Terraform tree.           | `change`    | Thin `apex-codegen` consumes the Terraform binding and writes only staging.                                | Terraform CodeGen and validation agents; Terraform checks.        |
| `iac.terraform-preview-apply`   | Deploy agent/subagent plan and apply Terraform with backend guidance.       | `change`    | Authorized adapter locks state, protects a saved plan, binds lineage/serial, and applies that exact plan.  | Terraform deploy/plan agents; Phase 0B backend spike required.    |
| `iac.azd`                       | `azure.yaml` and `azd provision` appear in current deployment guidance.     | `change`    | `azure.yaml` is optional compatibility output; audited execution is native Bicep or Terraform only.        | Deploy agents, Azure YAML instructions, explicit locked decision. |
| `ops.inventory`                 | Resource Graph and ARM reads inventory deployed resources.                  | `preserve`  | Inventory retries eventual consistency and commits complete secret-free identifiers/configuration.         | Azure resources skill fixtures and as-built flow.                 |
| `ops.diagnose`                  | Diagnose agent performs read-first health, Activity Log, and log analysis.  | `preserve`  | `apex-operator` requests typed read capabilities; remediation becomes a new approved operation.            | Diagnose agent and diagnostics skill fixtures.                    |
| `ops.recovery`                  | Deploy guidance surfaces failures and avoids claiming automatic rollback.   | `preserve`  | Operation lifecycle records and provider IDs support reconciliation instead of blind retry.                | Deploy agents and known deploy issues.                            |
| `ops.destroy`                   | v1 teardown guidance varies by track and project.                           | `change`    | Bicep uses stack or owned sandbox-RG delete; Terraform uses an approved exact destroy plan.                | Phase 0B ownership and backend proof tests required.              |

### Validation, Lifecycle, Distribution, and Documentation

| ID                           | v1 behavior                                                                              | Disposition | Rationale and vNext owner                                                                                    | Source and characterization                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `validation.schema-business` | JSON Schema and handwritten scripts validate artifacts and business rules.               | `change`    | One in-process registry keeps schema/semantic checks separate and caches only pure dependency-keyed results. | `tools/schemas/`, `tools/scripts/validate-*.mjs`, mutation fixtures. |
| `validation.security-policy` | IaC security, governance, policy, SKU, and source-coverage checks block unsafe output.   | `preserve`  | Authorized deterministic validators run before acceptance, gates, preview, and deploy.                       | Security baseline, policy precheck, SKU, and IaC validators.         |
| `validation.offline-ci`      | Most CI validation runs without Azure credentials or model calls.                        | `preserve`  | Deterministic CI remains credential-free/model-free; locked registry access is declared where used.          | `npm run validate:all`, successful baseline transcript.              |
| `lifecycle.hooks`            | Lefthook and devcontainer lifecycle scripts enforce validation and setup.                | `change`    | Stable kernel commands enforce rules; VS Code hooks are optional Preview defense in depth only.              | `lefthook.yml`, hook tests, `.devcontainer/`.                        |
| `runtime.skills`             | Agents load workspace-relative skills that can contain workflow and mutation guidance.   | `change`    | Managed workspace skills curate domain knowledge; routing and state mutation move to the kernel.             | `.github/skills/`, trigger fixtures, orphan-content validators.      |
| `runtime.instructions`       | Workspace instructions shape agent behavior and generated files.                         | `change`    | Consumer-wide instructions stay minimal; path instructions only guide IaC authoring.                         | `.github/copilot-instructions.md`, `.github/instructions/`.          |
| `distribution.repository`    | Consumers run a vendored monorepo/devcontainer payload.                                  | `retire`    | npm CLI/kernel plus managed workspace customizations are required; Preview plugin packaging is optional.     | Repository setup docs; Phase 0B clean-install spike required.        |
| `docs.public`                | Public site documents installation, workflow, security, operations, and troubleshooting. | `preserve`  | Minimum versioned vNext guidance and a v1 maintenance banner are required before cutover.                    | `site/src/content/docs/`, site build/link validation.                |

## Agent and Subagent Coverage

Every registered agent is mapped below. `Retire role` does not retire a preserved behavior; it removes creative
authority or moves deterministic work into the owning package.

| Current definition                                               | Disposition                | vNext mapping                                                                                   |
| ---------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| `.github/agents/01-orchestrator.agent.md`                        | Change role                | `apex-coordinator` reads kernel tasks/status and does not own workflow state.                   |
| `.github/agents/02-requirements.agent.md`                        | Preserve behavior          | `apex-requirements` authors `requirements-v1` through task staging.                             |
| `.github/agents/03-architect.agent.md`                           | Preserve behavior          | `apex-architect` authors architecture and cost intent from authorized evidence.                 |
| `.github/agents/04-design.agent.md`                              | Retire role                | Optional Draw.io and ADR skills remain; design is not a mandatory workflow agent.               |
| `.github/agents/04g-governance.agent.md`                         | Change role                | Governance discovery becomes a capability; reconciliation feeds Architect/Planner tasks.        |
| `.github/agents/05-iac-planner.agent.md`                         | Preserve behavior          | `apex-planner` authors neutral intent; the resolver emits the selected binding.                 |
| `.github/agents/06b-bicep-codegen.agent.md`                      | Change role                | Unified `apex-codegen` receives a Bicep task and narrow staging tools.                          |
| `.github/agents/06t-terraform-codegen.agent.md`                  | Change role                | Unified `apex-codegen` receives a Terraform task and narrow staging tools.                      |
| `.github/agents/07b-bicep-deploy.agent.md`                       | Retire state-changing role | `apex-operator` explains evidence; kernel capabilities preview/deploy/reconcile.                |
| `.github/agents/07t-terraform-deploy.agent.md`                   | Retire state-changing role | `apex-operator` explains evidence; kernel capabilities preview/deploy/reconcile.                |
| `.github/agents/08-as-built.agent.md`                            | Change role                | Deterministic renderers and operator tasks replace creative documentation fan-out.              |
| `.github/agents/09-diagnose.agent.md`                            | Preserve behavior          | `apex-operator` requests read-only diagnostic capabilities and renders findings.                |
| `.github/agents/10-challenger.agent.md`                          | Change role                | `apex-reviewer` authors findings; kernel owns decision resolution and gate effects.             |
| `.github/agents/11-context-optimizer.agent.md`                   | Retire role                | Kernel quality reports measure available metrics; client context remains out of scope.          |
| `.github/agents/e2e-orchestrator.agent.md`                       | Retire product role        | Deterministic scenarios plus manual release qualification replace headless model orchestration. |
| `.github/agents/_subagents/challenger-review-subagent.agent.md`  | Change role                | `apex-reviewer` emits `review-findings-v1`.                                                     |
| `.github/agents/_subagents/cost-estimate-subagent.agent.md`      | Retire role                | Pricing capability emits validated `cost-estimate-v1` inputs.                                   |
| `.github/agents/_subagents/bicep-validate-subagent.agent.md`     | Retire role                | Deterministic Bicep validation capability.                                                      |
| `.github/agents/_subagents/bicep-whatif-subagent.agent.md`       | Retire role                | Authorized deployment-stack preview capability.                                                 |
| `.github/agents/_subagents/terraform-validate-subagent.agent.md` | Retire role                | Deterministic Terraform validation capability.                                                  |
| `.github/agents/_subagents/terraform-plan-subagent.agent.md`     | Retire role                | Authorized saved-plan capability.                                                               |
| `.github/agents/_subagents/policy-precheck-subagent.agent.md`    | Retire role                | Deterministic policy precheck capability and validator registry.                                |

## Workflow Node Coverage

| Current node               | Disposition                  | vNext mapping                                                                           |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `step-1`                   | Preserve                     | Requirements task.                                                                      |
| `gate-1`                   | Preserve                     | Requirements decision.                                                                  |
| `step-2`                   | Preserve with changed inputs | Architecture and Cost task after complete discovery.                                    |
| `gate-2`                   | Preserve                     | Architecture and Cost decision.                                                         |
| `step-3`                   | Retire from normal path      | Optional diagram/ADR output only.                                                       |
| `step-3_5`                 | Change sequence              | Governance discovery runs after Gate 1 and before Architecture recommendation/approval. |
| `gate-2_5`                 | Retire human gate            | Governance completeness/reconciliation becomes a Gate 2 precondition.                   |
| `step-4`                   | Preserve                     | Neutral implementation intent plus selected binding.                                    |
| `gate-3`                   | Preserve                     | Implementation Plan decision.                                                           |
| `step-5b`                  | Change executor              | Bicep CodeGen task through APEX MCP staging.                                            |
| `step-5t`                  | Change executor              | Terraform CodeGen task through APEX MCP staging.                                        |
| `gate-4`                   | Retire as decision           | Code validation remains mandatory and automatic.                                        |
| `step-6b`                  | Change executor              | Bicep preview is prepared before Gate 4; apply follows the exact approval.              |
| `step-6t`                  | Change executor              | Terraform saved plan is prepared before Gate 4; apply uses that plan.                   |
| `gate-5`                   | Merge and rename             | Becomes vNext Gate 4, Deployment Preview approval.                                      |
| `step-7`                   | Change executor              | Inventory, health checks, quality report, and deterministic views.                      |
| `edges` and `return_edges` | Preserve semantics           | Kernel transitions plus precise dependency invalidation.                                |

## CLI and Setup Coverage

| Current command family                                            | Disposition | vNext mapping                                                               |
| ----------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `npm run init`                                                    | Change      | `apex init` and `apex update`.                                              |
| `npm run setup`                                                   | Preserve    | `apex setup` with typed readiness evidence.                                 |
| `apex-recall files/sessions/search/show/decisions/reindex/health` | Preserve    | `apex project list/use/show/search`, `status`, and history queries.         |
| `apex-recall init/start-step/checkpoint/complete-step`            | Change      | Kernel project/run/task and event commands.                                 |
| `apex-recall decide/finding/review-audit/transition`              | Change      | Kernel review, gate, provenance, and transition commands.                   |
| Agent-invoked validation and deployment commands                  | Change      | `apex validate/preview/deploy/reconcile/inventory/diagnose/render/promote`. |

## MCP Coverage

| Server                             | Disposition | vNext mapping                                                               |
| ---------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `tools/mcp-servers/azure-pricing/` | Preserve    | Exact-locked external pricing capability; agents do not invoke it directly. |
| `tools/mcp-servers/drawio/`        | Change      | Optional exact-locked output capability; never a canonical gate input.      |

## Schema Coverage

All v1 schemas are characterization inputs, not templates to copy verbatim.

| Current schema                             | Disposition                | vNext owner or replacement                                                     |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------ |
| `agent-registry.schema.json`               | Change                     | Managed customization manifest and invocation-graph validation.                |
| `agent-scorecard.schema.json`              | Change                     | `quality-report-v1`.                                                           |
| `challenge-findings-decisions.schema.json` | Change                     | `review-findings-v1` plus approval/risk records.                               |
| `deployment-preview.schema.json`           | Preserve concept           | `deployment-preview-v1` and execution-plan attestation.                        |
| `drawio-baseline-runs.schema.json`         | Preserve for qualification | Scenario/quality evidence only.                                                |
| `drawio-golden-scenario.schema.json`       | Preserve for qualification | `scenario-v1` optional-output fixtures.                                        |
| `drawio-regen-baseline.schema.json`        | Preserve for qualification | `quality-report-v1` optional-output evidence.                                  |
| `environment-manifest.schema.json`         | Change                     | `environment-inputs-v1`.                                                       |
| `explorer-graph.schema.json`               | Retire from runtime        | Public-site build tooling only.                                                |
| `governance-baseline.schema.json`          | Change                     | Nonsecret defaults plus live `governance-constraints-v1`.                      |
| `governance-constraints.schema.json`       | Preserve concept           | `governance-constraints-v1`.                                                   |
| `iac-contract.schema.json`                 | Change                     | `implementation-intent-v1` and `iac-binding-v1`.                               |
| `iac-handoff.schema.json`                  | Change                     | Logical resource manifest, handoff, and execution attestation.                 |
| `iteration-log.schema.json`                | Change                     | Event records and `quality-report-v1`.                                         |
| `lesson-log.schema.json`                   | Change                     | `quality-report-v1`.                                                           |
| `model-catalog.schema.json`                | Change                     | VS Code recommendations and cost tiers; labels do not affect kernel contracts. |
| `policy-property-map.schema.json`          | Preserve concept           | `policy-property-map-v1`.                                                      |
| `session-state.schema.json`                | Change                     | Project/run config plus event/object model.                                    |
| `sku-manifest.schema.json`                 | Preserve concept           | `sku-manifest-v1`.                                                             |
| `subnet-plan.schema.json`                  | Preserve concept           | Neutral intent networking obligations.                                         |
| `vendor-prompting-rules.schema.json`       | Preserve for authoring     | Managed customization source validation, outside authorization.                |
| `workflow-graph.schema.json`               | Change                     | New deterministic `workflow.v1.json` schema.                                   |

## Validator Family Coverage

| Family                     | Current commands                                                                                | Disposition and vNext mapping                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Customization structure    | `validate:agents`, `validate:skills`, `lint:workflow-handoffs`, registry/model checks           | Preserve for workspace bundle, invocation graph, and optional adapter qualification.     |
| Workflow and state         | Session-state, workflow-graph, transition, review, challenger, decision, and question checks    | Port preserved rules into kernel registries and tests.                                   |
| Artifact and contract      | Artifact templates, JSON schemas, SKU, IaC contract/handoff, environment, and policy-map checks | Separate JSON Schema validation from handwritten semantic validators.                    |
| Security and governance    | IaC security baseline, policy precheck, governance refs/trace, region, and banned-phrase checks | Preserve hard controls; live provider enforcement remains authoritative.                 |
| Toolchain and supply chain | Version, AVM, extension, MCP, VS Code, hook, safe-shell, lock, and provenance checks            | Bind exact versions/hashes in the runtime bundle and release evidence.                   |
| Language and format        | Markdown, JSON, JavaScript, Python, Bicep, Terraform, and Draw.io checks                        | Preserve in deterministic CI with owning-project interpreters/locks.                     |
| Documentation and site     | Docs freshness, frontmatter, links, site build, and explorer graph checks                       | Preserve v1 integrity during development and add versioned vNext content before cutover. |
| Test suites                | apex-recall, pricing, governance, hooks, contracts, renderer, fixtures, and integration tests   | Reuse as v1 characterization; replace behavior through `packages/testkit`.               |

## Approval Record

Repository owner `@jonathan-vella` approved this matrix on 2026-07-13. The approval explicitly includes:

- Every `preserve`, `change`, and `retire` disposition and replacement owner in this matrix.
- `DEF-003` through `DEF-006` as known v1 limitations that vNext must not preserve.
- The mapped retirement of dedicated Design, Context Optimizer, E2E Orchestrator, Deploy, and deterministic subagent
  roles while their required behaviors move to skills, renderers, kernel services, or capabilities.
- Removal of governance and code-validation gates as human decisions while retaining their mandatory blockers.
- The listed validator families as coverage for every release-relevant script in the clean candidate.

This approval does not waive Phase 0B proof tests or the clean-commit evidence gate. The final clean-commit baseline must
rerun the golden registry and confirm that no preserved behavior row lacks a passing characterization or an approved
manual release check.
