# Plan: Migrate APEX from VS Code Local Harness to GitHub Copilot Harness

## 1. Problem Statement & Target Architecture

APEX was originally authored around the **VS Code Local Copilot Chat harness** (`local` chat session type) and later retrofitted with a partial, unverified "Local vs. Agent Host" split (`apex-host-*` skills, dual-harness routing clauses).

This plan executes a **full cutover** to the **GitHub Copilot harness in VS Code** (the Copilot SDK / Agent Host runtime, `client_name: vscode-agent-host` / `target: github-copilot`), removing VS Code Local-only legacy constructs while preserving all 21 agents, skills, instructions, `apex-recall` state management, challenger review gates, and human approval invariants.

### Confirmed Decisions

1. **Migration Mode — Full Cutover**:
   - Target the GitHub Copilot harness in VS Code exclusively.
   - Retire VS Code Local-only primitives (`vscode/askQuestions`, Local `handoffs:` button dependencies, `/clear` + manual agent-picker ritual, Local `workspaceStorage` / `ccreq:` debug-log parsers, and dual-harness "Local vs. Host" branching).
2. **Entry Points — Archive Legacy Prompt Files to `.archive/pre-cpharness/`**:
   - Move `.github/prompts/**` and `tools/apex-prompts/**` (plus `.github/instructions/prompt.instructions.md` and superseded `apex-host-*` split skills) into `.archive/pre-cpharness/`.
   - Consolidate slash entry points into canonical user-invocable skills under `.github/skills/` (`apex-workflow-start`, `apex-git-commit`, `apex-debug-log-export`).
   - Point all execution-subagent contract references directly at `.github/skills/apex-workflow-engine/references/execution-subagent.md`.
3. **Orchestration & Step Transitions — `task` / `create_session` Delegation after Human Gate Approval**:
   - `01-Orchestrator` remains the master coordinator holding mandatory human approval gates (`Gate 1`, `Gate 2`, `Gate 2.5`, `Gate 3`, `Gate 4`, `Gate 5`) via `ask_user`.
   - After human gate approval, `01-Orchestrator` dispatches the target step agent (`02-Requirements` through `08-As-Built`, `09-Diagnose`, `10-Challenger`) via the `task` tool (or `create_session` for multi-turn interactive sessions), running each step agent in its own isolated context window with its own frontmatter model and `reasoning-effort`.
   - Step agents remain `user-invocable: true` (so users can also select them directly in the picker) and set `disable-model-invocation: false` so `01-Orchestrator` can dispatch them via its `agents:` allowlist.
   - Leaf subagents (`_subagents/*.agent.md`) remain `user-invocable: false`, `disable-model-invocation: false`, `agents: []`.
   - Because each `task` / `create_session` invocation runs in an isolated context window and persists state via `apex-recall` and `00-handoff.md`, the manual `Run /clear, then switch the chat agent picker...` ritual is replaced by native isolated subagent/session execution + `apex-recall` checkpointing.
4. **Target Surface — VS Code Only**:
   - Scope is the GitHub Copilot harness inside VS Code (Dev Container + `.vscode/` + `.github/` + `.mcp.json`).

---

## 2. Workstreams & Implementation Steps

### Phase 0: Branch Baseline (Post-#764 Merge)

1. **Sync `main` and create the migration branch**:
   - Switch from `test/azure-mcp-3-e2e` to `main`, pull `origin/main` (which includes merged PR `#764` at `05c2ac85`), and create a cross-cutting feature branch (e.g. `git checkout main && git pull origin main && git checkout -b feat/copilot-harness-migration`).

### Phase 1: Archive Legacy Prompts & Consolidate Entry-Point Skills (`archive-and-entrypoints`)

1. **Relocate active reference contracts before archiving prompt roots**:
   - Move `tools/apex-prompts/utility-prompts/references/agent-scorecard-rubric.md` and `tools/apex-prompts/utility-prompts/references/agent-adversarial-checklist.md` into `.github/skills/apex-agent-authoring/references/` (add `<!-- ref:{slug}-v1 -->` headers and index them in `.github/skills/apex-agent-authoring/SKILL.md`).
   - Preserve the GPT execution-subagent reference alongside `.github/skills/apex-workflow-engine/references/execution-subagent.md` (or fold its H2 contract in) so `tools/tests/scripts/test_execution_subagent_contract.mjs` validates active skill references rather than `tools/apex-prompts/`.
2. **Create `.archive/pre-cpharness/` and move legacy prompt/adapter assets**:
   - `git mv .github/prompts .archive/pre-cpharness/github-prompts`
   - `git mv tools/apex-prompts .archive/pre-cpharness/apex-prompts`
   - `git mv .github/instructions/prompt.instructions.md .archive/pre-cpharness/prompt.instructions.md`
   - Copy pre-cutover `apex-host-*` skill definitions to `.archive/pre-cpharness/skills/` for audit history.
3. **Replace `apex-host-*` adapter skills with canonical GitHub Copilot harness skills**:
   - `git mv .github/skills/apex-host-workflow-start .github/skills/apex-workflow-start`
   - `git mv .github/skills/apex-host-git-commit .github/skills/apex-git-commit`
   - `git mv .github/skills/apex-host-debug-log-export .github/skills/apex-debug-log-export`
   - Update each skill's frontmatter `name:` to match its directory (`apex-workflow-start`, `apex-git-commit`, `apex-debug-log-export`), with `user-invocable: true` and `disable-model-invocation: true`.
   - Create `/eventdesk-orchestrator` skill (or operation under `apex-workflow-start`) if needed so the Eventdesk kickoff slash command works natively in the GitHub Copilot harness.
   - Update `.github/skills/apex-workflow-engine/references/workflow-entry.md`, `.github/skills/apex-github-operations/references/git-commit.md`, `.github/skills/apex-context-management/references/debug-log-export.md`, `.github/skills/apex-context-management/references/context-audit.md`, `.github/skills/apex-github-operations/references/merge-sensei-free-pr.md`, `.github/skills/apex-workflow-engine/references/{as-built-from-azure,project-wide-review,review-imported-iac}.md`, and `.github/skills/apex-agent-authoring/references/{assess-agents,assess-github-folder,plan-four-layer-agent-assessment,runtime-guardrails}.md` to remove broken `tools/apex-prompts/` links and "Local vs. Agent Host" split prose.
4. **Update workspace paths, context snapshot scripts, and registries for prompt retirement**:
   - Update `tools/scripts/_lib/paths.mjs` and `tools/scripts/_lib/workspace-index.mjs` to remove active scanning of `.github/prompts` and `tools/apex-prompts`.
   - Update `tools/scripts/snapshot-agent-context.sh`, `tools/scripts/diff-context-baseline.sh`, and `tools/tests/scripts/test_context_baseline.mjs` to remove `.github/prompts` and `tools/apex-prompts` from `BACKUP_TARGETS` / `CATEGORIES`.
   - Remove the `prompts` block from `tools/registry/agent-registry.json` and `vscode_prompts` from `tools/registry/count-manifest.json`.
   - Update `.github/CODEOWNERS`, `.github/instructions/markdown.instructions.md`, `.github/instructions/agent-authoring.instructions.md`, `.github/instructions/vendor-prompting.instructions.md`, `.github/instructions/no-interactive-shell.instructions.md`, `.github/instructions/references/precedence-matrix.md`, `tools/scripts/assess-agents.mjs`, `tools/scripts/validate-mcp-tool-refs.mjs`, and `tools/scripts/validate-orphaned-content.mjs` to remove `.github/prompts` and `tools/apex-prompts` references and point execution-subagent contract links to `.github/skills/apex-workflow-engine/references/execution-subagent.md`.
   - Ensure `.archive/` is excluded in `tools/scripts/validate-no-hardcoded-counts.mjs`, `tools/scripts/lint-json.mjs`, and `tools/scripts/validate-terminology.mjs` (matching `.markdownlint-cli2.jsonc`, `.prettierignore`, and `check-repository-links.mjs`).

### Phase 2: MCP, Devcontainer & Hook Runtime Alignment (`mcp-devcontainer-hooks`)

1. **MCP Configuration Parity (`.mcp.json` + `.vscode/mcp.json`)**:
   - Update `.devcontainer/configure-mcp.mjs` and `tools/scripts/validate-mcp-config.mjs` so the three required servers (`github`, `azure-resource-manager-mcp`, `azure-mcp`) are written to and validated in `.mcp.json` (read natively by the GitHub Copilot harness) as well as `.vscode/mcp.json`, enforcing parity between both files.
   - Add `.mcp.json` to `.prettierignore` alongside `.vscode/mcp.json`.
2. **VS Code & Devcontainer Settings (`.vscode/settings.json`, `.devcontainer/devcontainer.json`, `validate-vscode-config.mjs`)**:
   - Keep `chat.agentFilesLocations`, `chat.agentSkillsLocations`, `chat.instructionsFilesLocations`, `chat.hookFilesLocations`, `chat.useCustomAgentHooks`, `chat.useAgentSkills`, and `chat.customAgentInSubagent.enabled`.
3. **Hooks Update for GitHub Copilot Harness (`.github/hooks/`)**:
   - In `.github/hooks/tool-guardian/guard-tool.sh`:
     - Extract `file_path` from `ti.get("filePath") or ti.get("file_path") or ti.get("path")`.
     - Add GitHub Copilot harness file-editing tool names — both PascalCase hook names (`Edit`, `Write`, `MultiEdit`) and snake_case tool names (`edit`, `create`, `apply_patch`) — to the `.github/hooks` self-modification guard alongside `replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, `editFiles`.
     - Add GitHub Copilot harness read-only tool names — both PascalCase (`Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`) and snake_case (`view`, `grep`, `glob`, `list_bash`, `read_bash`, `list_agents`, `read_agent`, `get_current_session`, `list_sessions`, `get_session_context`, `pylanceLSP`, `pylanceDocuments`, `pylanceAnalyze`) — to the fast-skip case statement. Keep `sql` and `session_store_sql` subject to the SQL threat scan so destructive SQL patterns remain guarded.
   - In `.github/hooks/subagent-validation/subagent-validation.sh`:
     - Read `name = data.get("agentName") or data.get("agentType") or data.get("subagentName") or ""` and `output = data.get("response") or data.get("output") or ""` (matching the verified Copilot SDK `onSubagentStop` payload `{ sessionId, transcriptPath, agentName, agentType, agentId, stopReason, response }`).
     - Update the challenger check to accept the file-contract summary (`CHALLENGE COMPLETE` + `overall_assessment:`) in `response` as well as JSON `{ "findings": [...] }` for legacy/unit-test compatibility.
   - Update hook tests in `tools/tests/bats/` and `tools/scripts/validate-hooks.mjs`.

### Phase 3: Interaction Layer Migration (`vscode/askQuestions` → `ask_user`) (`interaction-ask-user`)

1. **Define Canonical `ask_user` Contract**:
   - Verified against `@github/copilot-sdk` (`session.ui.handleHumanAskUser` elicitation handler): `ask_user` natively renders multi-field JSON Schema forms via `message` + `requestedSchema.properties` (supporting `enum`/`oneOf`, `boolean`, multi-select `array`/`items.anyOf`, `number`, `string`, `default`, `title`, `description`).
   - Document the `ask_user` schema patterns in `.github/instructions/agent-authoring.instructions.md` and `.github/skills/apex-agent-authoring/references/runtime-guardrails.md`.
2. **Update Adversarial Review Per-Finding Decision Protocol**:
   - Update `.github/skills/apex-azure-defaults/references/adversarial-review-protocol.md` (§2g–2h):
     - Replace `vscode_askQuestions` / `questions[]` payload table with the `ask_user` `requestedSchema.properties` contract: each finding key `finding_{issue_id}` uses `title: "{artifact-type}-pass{N}-{idx}: {title}"`, `description` carrying severity, category, evidence, impact, section, and proposed mitigation, `enum: ["Accept (apply mitigation)", "Reject (do not apply)", "Defer (carry to handoff)", "Edit (custom guidance)"]`, and `default` set to `"Accept (apply mitigation)"` for `must_fix` or `"Defer (carry to handoff)"` for `should_fix`.
     - Handle Edit / freeform semantics deterministically:
       - Standard enum selection (`Accept...` / `Reject...` / `Defer...`) → maps to `accept` / `reject` / `defer` with `note: ""`.
       - Freeform string entered directly into `finding_{issue_id}` (not matching the 4 enum literals) → maps to `action: "accept"`, `note: "Edit: <freeform>"`.
       - Literal `"Edit (custom guidance)"` selected → ask one follow-up `ask_user` with string fields for the selected `Edit` findings (or if declined/empty, auto-defer with `"Edit selected without guidance — auto-deferred."`).
       - Form declined (`skipped`) → `action: "defer"`, `note: "User skipped — auto-deferred."`.
     - Preserve the 12-finding panel cap, `APEX_UNATTENDED=1` bypass, deterministic sidecar persistence (`challenge-findings-{type}-decisions.json`), and `apex-recall finding` logging unchanged.
3. **Update Question-Batching and Review-Ceiling Contracts & Validators**:
   - Update `.github/agents/02-requirements.agent.md` Phase 1 P0 batching example from `askQuestions({ questions: [...] })` to `ask_user({ message: ..., requestedSchema: { properties: { project_name, industry, company_size, region_pin, compliance, iac_tool } } })`.
   - Update `tools/scripts/validate_question_batching.py` and `tools/tests/scripts/test_validate_question_batching.py` to validate the `ask_user` `requestedSchema` block with the 6 required property keys.
   - Update `.github/agents/01-orchestrator.agent.md` and `.github/agents/10-challenger.agent.md` Challenger-invocation ceiling prompt to use `ask_user` with options `"Accept findings"`, `"Override ceiling"`, `"Abort step"`, and update `tools/scripts/validate_review_ceiling.py` + `tools/tests/scripts/test_validate_review_ceiling.py`.
   - Update `tools/scripts/safe-shell.mjs` fix hints (`use the ask_user tool to gather user input`).

### Phase 4: Agent Frontmatter, Tools & Orchestrator Delegation Cutover (`agents-and-orchestration`)

1. **Verified Runtime Facts (`runtime.node` & `agentHostMain.js`)**:
   - `runtime.node` `agentsCustomAgentInitialModelDecision` natively maps `"Claude Sonnet 5.5 (copilot)"` → `claude-sonnet-5.5`, `"GPT-6 Luna (copilot)"` → `gpt-6-luna`, and `"MAI-Code-1.1-Flash"` → `mai-code-1.1-flash` (`modelSelectionSource: "agent_definition"`).
   - `runtime.node` `toolSubagentMaxDepth` is `4`, so a step agent invoked via `task` can invoke its own leaf `_subagents` (`challenger-review-subagent`, `cost-estimate-subagent`, `*-validate-subagent`, `*-whatif/plan-subagent`, `policy-precheck-subagent`) at depth 2.
   - `runtime.node` injects a non-interactive system instruction into `task`-spawned subagents (*"You are running in non-interactive mode and have no way to communicate with the user"*), whereas top-level sessions (and `write_agent` follow-ups from the top-level session) are interactive.
2. **Two-Mode Step Agent Interaction & Orchestrator `task` Delegation**:
   - **When `01-Orchestrator` drives the workflow**:
     - `01-Orchestrator` runs as the top-level interactive agent and owns all `ask_user` calls (project intake, missing requirements/scope questions, Per-Finding Decision Protocol, and Gates 1–5).
     - After human gate approval, `01-Orchestrator` dispatches the step agent (`02-Requirements` through `08-As-Built`, `09-Diagnose`, `10-Challenger`) via `task` (leaving `model` and `reasoning_effort` unset so the step agent's frontmatter model and effort apply).
     - If a `task`-delegated step agent encounters missing user inputs (e.g. unanswered Phase 1–4 requirements fields, Step 3 Design scope choice, Step 6 deploy confirmation), it does not guess: it returns a structured `USER_INPUT_REQUIRED` block to `01-Orchestrator` (entering `idle` status); `01-Orchestrator` collects the user's answers via `ask_user` and resumes the same step agent turn via `write_agent(agent_id, message)`.
     - When the step agent completes its artifacts and leaf-worker reviews, it returns a compact completion summary to `01-Orchestrator`. `01-Orchestrator` runs the Per-Finding Decision Protocol (`ask_user`) if findings exist, writes `00-handoff.md`, updates `apex-recall`, and presents the Gate approval (`ask_user`).
   - **When a user selects a step agent directly in the VS Code agent picker**:
     - The step agent runs as the top-level interactive session, calling `ask_user` directly for discovery, per-finding decisions, and gate confirmation.
3. **Normalize Frontmatter across all 21 Agents (`.github/agents/*.agent.md` and `_subagents/*.agent.md`)**:
   - Remove `vscode/askQuestions` from `tools:` arrays across the 14 main agents; use canonical tool names (`execute, read, edit, search, web, agent, todo` + MCP scopes `'azure-mcp/*'`, `'bicep/*'`).
   - Normalize `11-context-optimizer.agent.md` `tools:` from fine-grained VS Code Local tool IDs (`execute/runInTerminal`, `read/readFile`, `search/codebase`, etc.) to coarse canonical tool aliases `[execute, read, edit, search]`.
   - Update `01-orchestrator.agent.md`:
     - Set `tools: [execute, read, edit, search, agent, todo]`.
     - Set `agents:` allowlist to `["02-Requirements", "03-Architect", "04-Design", "04g-Governance", "05-IaC Planner", "06b-Bicep CodeGen", "06t-Terraform CodeGen", "07b-Bicep Deploy", "07t-Terraform Deploy", "08-As-Built", "09-Diagnose", "10-Challenger"]`.
   - Update step agents (`02-Requirements` through `11-Context Optimizer`):
     - Set `disable-model-invocation: false` and `user-invocable: true` so `01-Orchestrator` can dispatch them via `task` while users can also select them in the agent picker.
   - Keep leaf subagents (`_subagents/*.agent.md`) with `user-invocable: false`, `disable-model-invocation: false`, `agents: []`.
   - Replace the manual `Run /clear, then switch the chat agent picker...` ritual across `01-orchestrator.agent.md` and `02`–`08` step agents with the deterministic **Step Completion & Gate Handoff Contract** (`apex-recall` checkpoint + `00-handoff.md` update + structured return summary to `01-Orchestrator` / gate approval).

### Phase 5: Observability & Debug-Log Tooling Migration (`observability-logs`)

1. **Shared `events.jsonl` Normalizer (`profile_debug_log.py` + `smoke_verify.py`)**:
   - In `tools/scripts/profile_debug_log.py`:
     - Implement a shared `events_jsonl_to_otel()` converter that pairs `events.jsonl` events (`model.model_call_started` / `model.response` / `session.usage_record`, `tool.execution_start` / `tool.execution_complete`, `subagent.started` / `subagent.completed`, `hook.start` / `hook.end`) by `toolCallId` / `turnId` into the profiler's canonical span format.
     - Count `ask_user` calls in `askquestions_count` (alongside legacy `vscode_askQuestions`), track duplicate reads across `view` and `read_file`, and record subagent model routing (`firstDispatchedModel`, `modelSelectionSource`) from `subagent.completed`.
   - In `tools/scripts/smoke_verify.py`:
     - Reuse `profile_debug_log.py`'s shared loader instead of maintaining a separate `jsonl_to_otel()`.
     - Update live session log discovery (`find_live_debug_log()`) to scan `~/.copilot/session-state/*/events.jsonl` (matching `workspace.yaml` `cwd: /workspaces/apex`).
     - Update `TARGETS` for the GitHub Copilot harness (removing obsolete `/clear` and `turn_start:N` assumptions while verifying `ask_user` count, max input tokens per call, challenger invocations per step, and `apex-recall show` recovery).
   - In `.github/skills/apex-context-management/scripts/parse-chat-logs.py`, `.github/skills/apex-context-management/references/debug-log-export.md`, `.github/skills/apex-context-management/references/context-audit.md`, and `.github/agents/11-context-optimizer.agent.md`:
     - Update log discovery, export, redaction, and analysis to target `~/.copilot/session-state/<session-id>/` (`events.jsonl`, `workspace.yaml`) as the canonical log source.

### Phase 6: Validators, Schemas, Explorer Graph & Test Suite Updates (`validators-and-tests`)

1. **Update Agent & Handoff Validators**:
   - `tools/scripts/validate-agents.mjs` and `tools/scripts/_lib/workflow-handoffs.mjs`:
     - Update `validateProductionAgentPolicy`: allow `01-Orchestrator` to declare the step agents in `agents:` and `agent` in `tools:`; allow step agents (`02`–`11`) to set `disable-model-invocation: false` while forbidding non-orchestrator step agents from allowlisting other main agents (step agents may only allowlist their authorized leaf `_subagents`).
     - Keep leaf worker restrictions (`user-invocable: false`, `agents: []`, no `ask_user` / delegation / todo tools).
     - Remove or adapt prompt-file checks (`runVendorPrompting` prompt loop / `prompt-model-source-001`) now that `.prompt.md` files are archived.
   - `tools/scripts/validate_orchestrator_handoff.py`:
     - Update the validator to check the new GitHub Copilot harness Step Completion & Gate Handoff contract across `01-orchestrator.agent.md` and `STEP_AGENTS` (verifying `apex-recall checkpoint`, `00-handoff.md`, and gate approval before `task` dispatch).
   - `tools/scripts/generate-explorer-graph.mjs` & `tools/scripts/validate-explorer-graph.mjs`:
     - Remove `.github/prompts` and `tools/apex-prompts` from `SOURCE_DIRS` and `collectPrompts()` (or omit the retired `prompt` category) and regenerate `tools/registry/architecture-explorer-graph.json` (`npm run build:explorer-graph`).
   - Regenerate `.github/model-catalog.json` (`npm run generate:model-catalog`) and `.github/skills/apex-vendor-prompting/rules.json` if needed.
2. **Update Unit & Contract Test Suite (`tools/tests/`)**:
   - Update `tools/tests/scripts/test_host_adapters.mjs`, `tools/tests/scripts/test_execution_subagent_contract.mjs`, `tools/tests/scripts/test_skill_ownership.mjs`, `tools/tests/scripts/test_skill_consolidation.mjs`, `tools/tests/scripts/test_agent_body_remediation.mjs`, `tools/tests/scripts/test_phase_a_runtime_guidance.mjs`, `tools/tests/scripts/test_validate_orchestrator_handoff.py`, `tools/tests/scripts/test_validate_question_batching.py`, `tools/tests/scripts/test_validate_review_ceiling.py`, `tools/tests/scripts/test_profile_debug_log.py`, `tools/tests/scripts/test_smoke_verify.py`, `tools/tests/validate-models.test.mjs`, and `tools/tests/vendor-prompting/run.test.mjs`.
3. **Update Top-Level Documentation (`AGENTS.md`, `.github/copilot-instructions.md`, `README.md`, `CHANGELOG.md`)**:
   - Update `AGENTS.md` and `.github/copilot-instructions.md` ("Harness And Runtime Boundaries", "Agent Workflow") to describe the single GitHub Copilot harness architecture (`ask_user`, `task` delegation, `.mcp.json`, `~/.copilot/session-state/` logs, and canonical skills).
   - Run full validation suite (`npm run validate:all`) and verify zero errors.

---

## 3. Verification & Acceptance Criteria

- All legacy `.prompt.md` files and `prompt.instructions.md` are cleanly archived under `.archive/pre-cpharness/` with zero broken links in active files (`npm run lint:links`).
- `.mcp.json` and `.vscode/mcp.json` are in sync and pass `npm run lint:mcp-config`.
- All 21 agents pass `npm run validate:agents`, `npm run lint:vendor-prompting`, `npm run validate:model-consistency`, and `npm run validate:model-catalog`.
- `npm run validate:orchestrator-handoff`, `npm run validate:question-batching`, and `npm run validate:review-ceiling` pass against the `ask_user` and `task`-delegation contracts.
- `npm run test:hooks`, `npm run test:tool-contracts`, `npm run test:python-tools`, and `npm run validate:all` pass completely.
