# Plan: Bosun-Inspired Enhancement Suite (10 Features)

## TL;DR

Adopt 10 patterns from the Bosun autonomous engineering control plane into the azure-agentic-infraops 7-step workflow. The changes span new skills (4), new scripts (5), modifications to existing skills (3), modifications to agent definitions (5+), a new JSON config registry, and updates to git hooks and MCP configuration. The work is ordered by dependency: foundational infrastructure first (shared state, workflow engine), then features that build on them (context shredding, complexity routing, PR automation), then optimizations (hooks, MCP scoping, affinity catalog, anomaly detection). No changes merge to `main` without explicit approval.

---

## Phase A — Foundational Infrastructure

### 1. Distributed Shared State / Task Claim Model

Upgrade the existing `session-resume` skill and `00-session-state.json` schema from a simple status-tracking file into an atomic, claim-based model with heartbeat liveness.

1. Extend the session state schema (`session-resume/references/state-file-schema.md`) from v1.0 → v2.0:
   - Add top-level fields: `lock.owner_id` (string, e.g. `"copilot-session-abc123"`), `lock.heartbeat` (ISO timestamp), `lock.attempt_token` (UUID), `lock.acquired` (ISO timestamp)
   - Add per-step: `claim` object with `owner_id`, `heartbeat`, `attempt_token`, `retry_count`, `event_log[]`
   - Add `stale_threshold_ms` (default 300000) to top-level config block
2. Create a new validation script `scripts/validate-session-lock.mjs`:
   - On state read: check if `lock.heartbeat` is older than `stale_threshold_ms` → if stale, clear lock and log recovery event to `event_log`
   - On state write: require `attempt_token` match (optimistic concurrency) → reject conflicting writes with descriptive error
   - Expose `claimStep(stepN, ownerId)`, `renewHeartbeat(ownerId, token)`, `releaseStep(stepN, token, outcome)`, `sweepStale(thresholdMs)` functions
3. Update `session-resume/SKILL.md`:
   - Add "Claim Protocol" section documenting the atomic lock flow
   - Update Resume Flow diagram to include lock acquisition before `set "in_progress"`
   - Add a "Multi-Session Safety" section explaining how concurrent Copilot sessions are prevented from double-writing
4. Update `scripts/validate-session-state.mjs`:
   - Add optional `lock` field validation (backwards-compatible: v1.0 files without `lock` still pass)
   - Validate `lock.heartbeat` is valid ISO date, `lock.attempt_token` is UUID format
5. Update `session-resume/references/recovery-protocol.md`:
   - Add stale-lock recovery procedure (sweep → log → re-claim)
   - Add duplicate-session detection instructions for the Conductor

### 2. Formalized Workflow Engine

Create a machine-readable workflow graph that the Conductor reads instead of relying on hardcoded step logic in its agent body.

1. Create `.github/skills/workflow-engine/SKILL.md` — new skill:
   - Describe the DAG model: nodes (steps), edges (dependencies), gates (approval points), and fan-out (parallel sub-steps)
   - Define node types: `agent-step`, `gate`, `subagent-fan-out`, `validation`
   - Define edge conditions: `on_complete`, `on_skip`, `on_fail` → target node ID
2. Create `.github/skills/workflow-engine/templates/workflow-graph.json`:
   - Machine-readable DAG encoding the current 7-step flow (both Bicep and Terraform tracks)
   - Each node: `{ "id": "step-1", "type": "agent-step", "agent": "02-Requirements", "requires": [], "produces": ["01-requirements.md"], "gate": "approval", "challenger": { "passes": 1, "lenses": ["comprehensive"] } }`
   - IaC routing: conditional edges from step 3 → step 4b or step 4t based on `decisions.iac_tool`
   - Parallel fan-out: Step 7 substeps (cost estimate, operations runbook, etc.) can run in parallel
3. Create `scripts/validate-workflow-graph.mjs`:
   - Validates graph JSON: no orphan nodes, all agent refs match `*.agent.md` files, no cycles, all produced artifacts are consumed downstream
   - Add to `validate:all` in `package.json`
4. Update `01-conductor.agent.md`:
   - Add skill reference: `Read .github/skills/workflow-engine/SKILL.md`
   - Replace the hardcoded step table with: "Read `workflow-graph.json` → determine current node → execute → evaluate edges → advance"
   - Add resume-from-graph instruction: on resume, read `00-session-state.json` `current_step` → find matching node in graph → re-enter

### 3. Context Shredding (Runtime Compression)

Promote the existing diagnostic-only `context-optimizer` skill into a runtime system that actively compresses context when approaching limits.

1. Create `.github/skills/context-shredding/SKILL.md` — new skill:
   - Define 3 compression tiers: `full` (no compression, <60% usage), `summarized` (key sections only, 60-80%), `minimal` (decision summaries only, >80%)
   - Define per-artifact compression templates: e.g., `02-architecture-assessment.md` at `summarized` tier → only H2 sections "Architecture Pattern", "WAF Assessment", "Key Decisions"
   - Action rules: agents check approximate context usage before loading a file → select appropriate tier
2. Create `.github/skills/context-shredding/references/compression-templates.md`:
   - Per-artifact (01 through 07) compression rules at each tier
   - H2 sections to keep/drop per tier
   - Character budget targets per tier
3. Update `context-optimization.instructions.md`:
   - Add "Runtime Compression" section pointing to the context-shredding skill
   - Add the rule: "When loading an artifact file, check conversation length. If >60% of model context, use compression tier from context-shredding skill."
4. Update agents that load heavy artifacts — specifically:
   - `03-architect.agent.md` — loads `01-requirements.md` (can be large)
   - `06b-bicep-codegen.agent.md` / `06t-terraform-codegen.agent.md` — loads `04-implementation-plan.md` + governance
   - `08-as-built.agent.md` — loads `06-deployment-summary.md` + `02-architecture-assessment.md`
   - Add: `Read .github/skills/context-shredding/SKILL.md` to each

## Phase B — Cost and Safety Optimizations

### 4. Task Complexity Routing → Model Tier Selection

Add a machine-readable model selection config that maps step complexity to model tiers, replacing the informal model selection table in the Conductor.

1. Create `.github/skills/workflow-engine/references/complexity-routing.json`:
   - Map each step + substep to a complexity tier: `low`, `medium`, `high`
   - Map tiers to models: `{ "low": "Claude Haiku 4.5", "medium": "Claude Sonnet 4.6", "high": "Claude Opus 4.6" }`
   - Override table for subagents: challenger-review → `medium`, governance-discovery → `medium`, cost-estimate → `low`, lint/fmt subagents → `low`
2. Update `01-conductor.agent.md`:
   - Replace the static model selection table with: "Read `complexity-routing.json` → look up step ID → use declared model tier for handoff `model:` field"
   - Add the `complexity-routing.json` path to the skill reference
3. Update `handoffs:` in the Conductor to use `model:` override per step based on the routing table (where VS Code supports it)

### 5. PR Lifecycle Automation (Smart PR Flow)

Extend the `github-operations` skill with an automated PR lifecycle pattern inspired by Bosun's `smartPRFlow`.

1. Create `.github/skills/github-operations/references/smart-pr-flow.md`:
   - Define the PR lifecycle states: `draft` → `ready` → `ci-pending` → `ci-pass`/`ci-fail` → `reviewed` → `merged`
   - Auto-label rules: on CI failure → add label `infraops-needs-fix`; on CI pass → remove label
   - Auto-merge rule: CI pass + approved review + no `must_fix` open findings → auto-merge (with mandatory review gate)
   - Watchdog pattern: the deploy agent (Step 6) polls PR status after `az deployment` / `terraform apply`
2. Update `github-operations/SKILL.md`:
   - Add "Smart PR Flow" section referencing the new reference doc
   - Add CLI commands for label management and merge automation
3. Update deploy agents (`07b-bicep-deploy.agent.md`, `07t-terraform-deploy.agent.md`):
   - Add post-deploy step: "If running in PR context, check CI status. Apply label `infraops-ci-pass` or `infraops-needs-fix`. If all gates pass and review approved, execute auto-merge."

### 6. Agent Prompts Registry

Create a machine-readable registry mapping agent roles to their prompt files, enabling runtime switching.

1. Create `.github/agent-registry.json`:
   - Map each role to its `.agent.md` file path, default model, allowed model overrides, and required skills
   - Example: `{ "requirements": { "agent": ".github/agents/02-requirements.agent.md", "model": "Claude Opus 4.6", "skills": ["azure-defaults", "azure-artifacts", "session-resume"] } }`
   - Include subagent mappings with `invokable: false`
   - Include IaC-conditional mappings (key `"iac-plan"` → Bicep or Terraform variant based on runtime)
2. Create `scripts/validate-agent-registry.mjs`:
   - Validate all referenced `.agent.md` files exist
   - Validate all referenced skills exist in `.github/skills/`
   - Cross-check model names against known valid models
   - Add to `validate:all` in `package.json`
3. Update `01-conductor.agent.md`:
   - Add: "Read `.github/agent-registry.json` to resolve agent paths and models for each step"
   - Replace hardcoded agent name references with registry lookups

## Phase C — Efficiency Optimizations

### 7. MCP Registry with Per-Agent Scoping

Introduce an MCP scoping configuration that maps which MCP servers each agent needs.

1. Create `.github/mcp-scoping.json`:
   - Map each agent role to its required MCP servers: `{ "requirements": ["github", "microsoft-learn"], "architect": ["github", "microsoft-learn", "azure-pricing"], "bicep-codegen": ["github", "microsoft-learn"], "terraform-codegen": ["github", "microsoft-learn", "terraform"], "cost-estimate": ["azure-pricing", "microsoft-learn"], "deploy": ["github"] }`
   - Default scope for unlisted agents: `["github", "microsoft-learn"]`
2. Update agent definitions to include MCP scope comments:
   - Add `# MCP scope: github, microsoft-learn` as documentation in each agent body
   - Since VS Code doesn't support per-agent MCP filtering natively, this serves as documentation now and will be machine-actionable when VS Code adds the capability
3. Create `scripts/validate-mcp-scoping.mjs`:
   - Validate all agents referenced in `mcp-scoping.json` exist
   - Validate all MCP server names match keys in `.vscode/mcp.json`
   - Add to `validate:all` in `package.json`
4. Update `.vscode/mcp.json`:
   - Add a `// NOTE: Per-agent scoping defined in .github/mcp-scoping.json` comment

### 8. Diff-Based Pre-Push Hook Pattern

Add a `pre-push` hook stage to `lefthook.yml` that only runs validators for changed file domains.

1. Add `pre-push:` section to `lefthook.yml`:
   - Detect changed files via `git diff --name-only origin/main...HEAD`
   - Domain routing:
     - `*.bicep` changed → run `bicep build` + `bicep lint`
     - `*.tf` changed → run `terraform fmt -check` + `terraform validate`
     - `*.md` in `agent-output/` → run `npm run lint:artifact-templates`
     - `*.agent.md` → run `npm run lint:agent-frontmatter` + `npm run lint:agent-body-size`
     - `*.instructions.md` → run `npm run lint:instruction-frontmatter`
     - `SKILL.md` → run `npm run lint:skills-format` + `npm run lint:skill-size`
     - `*.json` → run `npm run lint:json`
     - `*.py` → run `ruff check`
   - Skip all validators if no matching files changed (fast exit)
   - Run domain-scoped validators in parallel (`parallel: true`)
2. Create `scripts/diff-based-push-check.sh`:
   - Helper that categorizes changed files and runs only matching validators
   - Outputs summary: `"Checked: 3 Bicep, 2 Markdown, 0 Terraform — all passed"`
3. Update `AGENTS.md` Build & Validation section:
   - Document the new `pre-push` hook behavior

### 9. Anomaly + Error Loop Detection → Deploy Safety

Add circuit breaker and anomaly detection patterns to the deploy agents and the Conductor.

1. Create `.github/skills/iac-common/references/circuit-breaker.md`:
   - Define anomaly patterns: empty response loops (agent returns no changes 3+ times), what-if oscillation (alternating add/delete), timeout cascade (3+ consecutive timeouts)
   - Circuit breaker rules: after 3 consecutive failures of the same type → halt and escalate to human
   - Categorized failure taxonomy: `build_error`, `validation_error`, `deployment_error`, `empty_response`, `timeout`, `auth_expired`
   - Escalation protocol: write finding to `open_findings` in session state, set step status to `blocked`, notify via PR comment
2. Update `iac-common/SKILL.md`:
   - Add "Circuit Breaker" section referencing the new reference doc
   - Add "Failure Taxonomy" table
3. Update deploy agents (`07b-bicep-deploy.agent.md`, `07t-terraform-deploy.agent.md`):
   - Add: "Read `references/circuit-breaker.md` from iac-common skill before starting deployment"
   - Add stopping rule: "If a deployment command returns the same error 3 consecutive times, halt and write a `blocked` finding. Do NOT retry further."
   - Add: track `retry_count` in session state per-step claim
4. Update `01-conductor.agent.md`:
   - Add: "If any step status is `blocked`, halt workflow and present findings to user before continuing"

### 10. BUILTIN_TOOLS Catalog with Skill/Agent Affinity

Create a lightweight affinity catalog that maps which skills each agent is most likely to need, reducing unnecessary skill reads.

1. Create `.github/skill-affinity.json`:
   - Map each agent to its skills with affinity weights: `primary` (always load), `secondary` (load on demand), `never` (skip)
   - Example: `{ "02-Requirements": { "primary": ["azure-defaults", "azure-artifacts", "session-resume"], "secondary": ["microsoft-docs"], "never": ["azure-bicep-patterns", "terraform-patterns"] } }`
   - Include subagent affinities
2. Create `scripts/validate-skill-affinity.mjs`:
   - Validate all agent names match existing `.agent.md` files
   - Validate all skill names match existing skill folders
   - Ensure no skill appears in both `primary` and `never` for the same agent
   - Cross-reference against agent body `Read .github/skills/...` lines — warn if a `primary` skill isn't referenced
   - Add to `validate:all` in `package.json`
3. Update `context-optimization.instructions.md`:
   - Add: "Before reading a skill, check `.github/skill-affinity.json`. Only load `primary` skills at startup. Load `secondary` skills when the task context demands it. Never load `never`-affinity skills."
4. Update `01-conductor.agent.md`:
   - Add: "When handing off to a step agent, include only `primary` affinity skills in the handoff context. Mention `secondary` skills by name for the agent to load if needed."

---

## Phase D — Integration & Validation

### 11. Package.json & Validate:all Updates

1. Add all new scripts to `package.json`:
   - `validate:session-lock` → `node scripts/validate-session-lock.mjs`
   - `validate:workflow-graph` → `node scripts/validate-workflow-graph.mjs`
   - `validate:agent-registry` → `node scripts/validate-agent-registry.mjs`
   - `validate:mcp-scoping` → `node scripts/validate-mcp-scoping.mjs`
   - `validate:skill-affinity` → `node scripts/validate-skill-affinity.mjs`
2. Add all 5 new validators to the `validate:all` composite command
3. Bump the minor version in `package.json`, `VERSION.md`, and `CHANGELOG.md`

### 12. Documentation Updates

1. Update `AGENTS.md`:
   - Add new skills to the Project Structure section
   - Document the workflow graph, agent registry, MCP scoping, and skill affinity configs
   - Document the pre-push hook behavior
2. Update `.github/copilot-instructions.md`:
   - Add new skills to the Skills table
   - Update Key Files table with new config files
3. Update `docs/workflow.md`:
   - Document the formalized workflow engine and graph-based execution
4. Update `CHANGELOG.md`:
   - Add entries for all 10 features under a new `## [Unreleased]` section

---

## Verification

| Check                                | Command                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| All validators pass                  | `npm run validate:all`                                                                                                            |
| Session state schema v2.0 compatible | `npm run validate:session-state` (existing files still pass)                                                                      |
| New session lock validation          | `npm run validate:session-lock`                                                                                                   |
| Workflow graph valid                 | `npm run validate:workflow-graph`                                                                                                 |
| Agent registry consistent            | `npm run validate:agent-registry`                                                                                                 |
| MCP scoping consistent               | `npm run validate:mcp-scoping`                                                                                                    |
| Skill affinity consistent            | `npm run validate:skill-affinity`                                                                                                 |
| Markdown lint clean                  | `npm run lint:md`                                                                                                                 |
| Agent frontmatter valid              | `npm run lint:agent-frontmatter`                                                                                                  |
| Pre-push hook works                  | `git push` on the feature branch (diff-based, should only check changed files)                                                    |
| No regressions                       | Manually run the Conductor on a test project (e.g., `e2e-conductor-test`) and verify session state writes include the lock fields |

## Decisions

- **Backwards compatibility**: Session state schema v2.0 is additive — v1.0 files without `lock` still validate. The `schema_version` field bumps to `"2.0"` only for newly created files.
- **No runtime code**: All "engine" features (workflow graph, complexity routing, MCP scoping, skill affinity) are implemented as JSON configs + agent instructions + validation scripts — not as Node.js runtime processes. This respects your project's architecture where agents are the runtime.
- **Workflow graph is declarative, not executable**: The graph JSON is read by the Conductor agent as instructions, not executed by a Node.js process. This keeps the system within VS Code Copilot's model.
- **Circuit breaker in agent instructions, not code**: Anomaly detection is implemented as explicit rules in agent bodies and skill references, enforced by the agent's reasoning — not as a separate watchdog process.
- **Pre-push parallel**: Unlike pre-commit (which is sequential for safety), pre-push runs domain checks in parallel since they're independent read-only validations.
