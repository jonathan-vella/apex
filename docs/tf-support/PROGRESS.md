---
# MACHINE STATE — Copilot reads this at session start and updates at session end
active_phase: 7
phase_0_complete: true
phase_1_complete: true
phase_2_complete: true
phase_3_complete: true
phase_4_complete: true
phase_5_complete: true
phase_6_complete: false
phase_7_complete: true
last_session: "2026-02-25"
last_contributor: "GitHub Copilot"
session_count: 7
blocking_issues: []
---

# Terraform Support — Progress Tracker

> **How Copilot uses this file**: Every prompt session starts with
> `Read docs/tf-support/PROGRESS.md` and ends with updating it.
> This is the single source of truth for cross-session continuity.

## Overall Status

| Phase | Title                             | Items | Done | Status      |
| ----- | --------------------------------- | ----- | ---- | ----------- |
| 0     | Branch & Foundation               | 8     | 8    | ✅ Complete |
| 1     | Instructions, Skills & Governance | 6     | 6    | ✅ Complete |
| 2     | Agents (Core)                     | 3     | 3    | ✅ Complete |
| 3     | Subagents                         | 3     | 3    | ✅ Complete |
| 4     | Conductor & Requirements          | 3     | 3    | ✅ Complete |
| 5     | Quality Gates & Automation        | 7     | 7    | ✅ Complete |
| 6     | Governance Migration (deferrable) | 1     | 0    | ⬜ Deferred |
| 7     | Documentation & Housekeeping      | 3     | 3    | ✅ Complete |

## Phase 0 — Branch & Foundation

- [x] `0.1` Create branch `tf-dev` from `main`
- [x] `0.2` Update `.devcontainer/devcontainer.json` — Terraform feature, Go feature, env var, editor settings
- [x] `0.3` Update `.devcontainer/devcontainer.json` extensions — `HashiCorp.terraform`, `ms-azuretools.vscode-azureterraform`
- [x] `0.4` Update `.gitignore` — add Terraform ignores, commit `.terraform.lock.hcl`
- [x] `0.5` Update `.gitattributes` — add `*.tf`, `*.tfvars`, `*.hcl`
- [x] `0.6` Add `hashicorp/terraform-mcp-server` Docker image to `.vscode/mcp.json` (stdio via Docker)
- [x] `0.7` Create `infra/terraform/` with `.gitkeep`
- [x] `0.8` **[GATE]** Verify MCP tool names — enumerated tools, documented in `docs/tf-support/mcp-tools.md`

## Phase 1 — Instructions, Skills & Governance

- [x] `1.9` Update `governance-discovery.instructions.md` — add `**/*.tf` to `applyTo`
- [x] `1.10` Update `governance-discovery-subagent` — dual-field output (`bicepPropertyPath` + `azurePropertyPath`)
- [x] `1.11` Create `terraform-code-best-practices.instructions.md`
- [x] `1.12` Create `terraform-policy-compliance.instructions.md`
- [x] `1.13` Create `terraform-patterns/SKILL.md`
- [x] `1.14` Update `azure-defaults/SKILL.md` — add `## Terraform Conventions` section + AVM-TF table

## Phase 2 — Agents (Core)

- [x] `2.15` Create `05t-terraform-planner.agent.md` (was `11-terraform-planner`)
- [x] `2.16` Create `06t-terraform-codegen.agent.md` (was `12-terraform-code-generator`)
- [x] `2.17` Create `07t-terraform-deploy.agent.md` (was `13-terraform-deploy`)

## Phase 3 — Subagents

- [x] `3.18` Create `_subagents/terraform-lint-subagent.agent.md`
- [x] `3.19` Create `_subagents/terraform-review-subagent.agent.md`
- [x] `3.20` Create `_subagents/terraform-plan-subagent.agent.md`

## Phase 4 — Conductor & Requirements

- [x] `4.21` Modify `02-requirements.agent.md` — add `iac_tool` field
- [x] `4.22` Modify `01-conductor.agent.md` — add Terraform routing, 3 new agents/handoffs
- [x] `4.23` Modify `03-architect.agent.md` — add `iac_tool` awareness

## Phase 5 — Quality Gates & Automation

- [x] `5.24` Update `lefthook.yml` — add `terraform-fmt` and `terraform-validate` hooks
- [x] `5.25` Update `package.json` — add `lint:terraform-fmt` and `validate:terraform` scripts
- [x] `5.26` Extend `validate-governance-refs.mjs` — Terraform check groups + dual-field support
- [x] `5.27` Create `.github/workflows/terraform-validate.yml`
- [x] `5.28` Extend `.github/workflows/policy-compliance-check.yml`
- [x] `5.29` Rename `## 📁 Bicep Templates Location` → `## 📁 IaC Templates Location` (3 locations)
- [x] `5.30` Update `validate-artifact-templates.mjs` AGENTS map — add Terraform agent mappings

## Phase 6 — Governance Migration (Deferrable)

> This phase only starts after Phases 0-5 are complete and working.

- [ ] `6.31` Migrate Bicep agents to read `azurePropertyPath` (with `bicepPropertyPath` fallback)

## Phase 7 — Documentation & Housekeeping

- [x] `7.32` Update `.github/copilot-instructions.md` — Terraform agents, skills, tools, conventions
- [x] `7.33` Update `docs/terraform-roadmap.md` — mark completed items, add links
- [x] `7.34` Update GitHub issue #171 — refined scope + 8 child issues

---

## Blockers & Notes

<!-- Add session notes here — what was attempted, what broke, what needs follow-up -->

| Date       | Contributor    | Item      | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-24 | —              | Setup     | Initial progress tracker created                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-02-24 | GitHub Copilot | 0.1–0.8   | Phase 0 complete. Note: `@hashicorp/terraform-mcp-server` npm package does not exist; using official Docker image `hashicorp/terraform-mcp-server:latest` in mcp.json instead. Docker socket must be available in devcontainer. Tool names documented in `docs/tf-support/mcp-tools.md`. Gate 0.8 cleared.                                                                                                                                                                                                                                         |
| 2026-02-24 | GitHub Copilot | 0.6 fix   | Docker-in-devcontainer doesn't work without extra features. Switched to `go install github.com/hashicorp/terraform-mcp-server/cmd/terraform-mcp-server@latest`. Binary at `/home/vscode/go/bin/`. `post-create.sh` updated (step 7). `mcp-tools.md` and `.vscode/mcp.json` corrected.                                                                                                                                                                                                                                                              |
| 2026-02-25 | GitHub Copilot | 1.9–1.14  | Phase 1 complete. governance-discovery files extended with `**/*.tf` applyTo and dual-field JSON schema (`bicepPropertyPath` + `azurePropertyPath`). Created `terraform-code-best-practices.instructions.md`, `terraform-policy-compliance.instructions.md` (with `azurePropertyPath` translation table), `terraform-patterns/SKILL.md` (7 patterns + AVM pitfalls). `azure-defaults/SKILL.md` updated with Terraform Conventions section and 16-entry AVM-TF module table. All new validators pass. Pre-existing mcp.json JSONC issue unaffected. |
| 2026-02-25 | GitHub Copilot | 2.15–2.17 | Phase 2 complete. Created `05t-terraform-planner.agent.md` (5-phase workflow, AVM-TF registry, `azurePropertyPath`), `06t-terraform-codegen.agent.md` (governance hard gate, `var.deployment_phase` + `count` conditionals, dual bootstrap/deploy scripts), `07t-terraform-deploy.agent.md` (`Claude Sonnet 4.6`, Azure Storage backend, phase-aware deployment, ARG verification). All 3 agents pass frontmatter validation.                                                                                                                      |
| 2026-02-25 | GitHub Copilot | 3.18–3.20 | Phase 3 complete. Created `terraform-lint-subagent.agent.md`, `terraform-review-subagent.agent.md` (with `### 7. Governance Compliance` + `azurePropertyPath` translation table), `terraform-plan-subagent.agent.md`. All pass frontmatter validation.                                                                                                                                                                                                                                                                                             |
| 2026-02-25 | GitHub Copilot | 4.21–4.23 | Phase 4 complete. `02-requirements.agent.md` gains `iac_tool` field. `01-conductor.agent.md` routes Terraform projects to agents 11–13. `03-architect.agent.md` adds `iac_tool` awareness. All agents pass frontmatter validation.                                                                                                                                                                                                                                                                                                                 |
| 2026-02-25 | GitHub Copilot | 5.24–5.30 | Phase 5 complete. lefthook.yml: added terraform-fmt and terraform-validate pre-commit hooks. package.json: added lint:terraform-fmt and validate:terraform, updated validate:all chain. validate-governance-refs.mjs: 5 new Terraform check groups (37 total, all pass). New `.github/workflows/terraform-validate.yml`. policy-compliance-check.yml: Terraform paths added to triggers. Renamed `## 📁 Bicep Templates Location` → `## 📁 IaC Templates Location` in 5 files (h2-sync ✅). AGENTS map updated with dual-agent documentation.      |
| 2026-02-25 | GitHub Copilot | 7.32–7.34 | Phase 7 complete. `copilot-instructions.md`: added agents 11/12/13, `terraform-patterns` skill, Terraform Key Files, Terraform validation commands, Terraform conventions block. `terraform-roadmap.md`: status updated to Implemented, preflight checklist marked complete, Implementation Notes section added. GitHub issues #171 and #176 updated. Fixed pre-existing JSONC comment in `.vscode/mcp.json` and missing fenced code language in `git-commit-push.prompt.md`. All validators pass. Open next: PR `tf-dev → main`.                  |

## Validator Status (run after each phase)

```
npm run validate:all      — full suite (run before every commit)
npm run lint:agent-frontmatter
npm run lint:governance-refs
npm run lint:h2-sync
bicep lint infra/bicep/   — regression check: existing Bicep must still work
```

## Regression Checklist

After Phases 1, 2, 4, 5 — verify existing Bicep flow is unbroken:

- [x] `npm run validate:all` passes
- [x] `05b-bicep-planner` frontmatter still valid
- [x] `06b-bicep-codegen` governance compliance still passes
- [x] `governance-discovery-subagent` still produces `bicepPropertyPath` (dual-field)
- [x] `01-conductor` routes Bicep projects correctly
