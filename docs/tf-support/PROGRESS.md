---
# MACHINE STATE — Copilot reads this at session start and updates at session end
active_phase: 0
phase_0_complete: false
phase_1_complete: false
phase_2_complete: false
phase_3_complete: false
phase_4_complete: false
phase_5_complete: false
phase_6_complete: false
phase_7_complete: false
last_session: "2026-02-24"
last_contributor: ""
session_count: 0
blocking_issues: []
---

# Terraform Support — Progress Tracker

> **How Copilot uses this file**: Every prompt session starts with
> `Read docs/tf-support/PROGRESS.md` and ends with updating it.
> This is the single source of truth for cross-session continuity.

## Overall Status

| Phase | Title                             | Items | Done | Status      |
| ----- | --------------------------------- | ----- | ---- | ----------- |
| 0     | Branch & Foundation               | 8     | 0    | ⬜ Not started |
| 1     | Instructions, Skills & Governance | 6     | 0    | ⬜ Not started |
| 2     | Agents (Core)                     | 3     | 0    | ⬜ Not started |
| 3     | Subagents                         | 3     | 0    | ⬜ Not started |
| 4     | Conductor & Requirements          | 3     | 0    | ⬜ Not started |
| 5     | Quality Gates & Automation        | 7     | 0    | ⬜ Not started |
| 6     | Governance Migration (deferrable) | 1     | 0    | ⬜ Deferred    |
| 7     | Documentation & Housekeeping      | 3     | 0    | ⬜ Not started |

## Phase 0 — Branch & Foundation

- [ ] `0.1` Create branch `tf-dev` from `main`
- [ ] `0.2` Update `.devcontainer/devcontainer.json` — Terraform feature, Go feature, env var, editor settings
- [ ] `0.3` Update `.devcontainer/devcontainer.json` extensions — `HashiCorp.terraform`, `ms-azuretools.vscode-azureterraform`
- [ ] `0.4` Update `.gitignore` — add Terraform ignores, commit `.terraform.lock.hcl`
- [ ] `0.5` Update `.gitattributes` — add `*.tf`, `*.tfvars`, `*.hcl`
- [ ] `0.6` Add `@hashicorp/terraform-mcp-server` to `.vscode/mcp.json` (npx) + add as devDependency in `package.json`
- [ ] `0.7` Create `infra/terraform/` with `.gitkeep`
- [ ] `0.8` **[GATE]** Verify MCP tool names — enumerate tools, document in `docs/tf-support/mcp-tools.md`

## Phase 1 — Instructions, Skills & Governance

- [ ] `1.9`  Update `governance-discovery.instructions.md` — add `**/*.tf` to `applyTo`
- [ ] `1.10` Update `governance-discovery-subagent` — dual-field output (`bicepPropertyPath` + `azurePropertyPath`)
- [ ] `1.11` Create `terraform-code-best-practices.instructions.md`
- [ ] `1.12` Create `terraform-policy-compliance.instructions.md`
- [ ] `1.13` Create `terraform-patterns/SKILL.md`
- [ ] `1.14` Update `azure-defaults/SKILL.md` — add `## Terraform Conventions` section + AVM-TF table

## Phase 2 — Agents (Core)

- [ ] `2.15` Create `11-terraform-planner.agent.md`
- [ ] `2.16` Create `12-terraform-code-generator.agent.md`
- [ ] `2.17` Create `13-terraform-deploy.agent.md`

## Phase 3 — Subagents

- [ ] `3.18` Create `_subagents/terraform-lint-subagent.agent.md`
- [ ] `3.19` Create `_subagents/terraform-review-subagent.agent.md`
- [ ] `3.20` Create `_subagents/terraform-plan-subagent.agent.md`

## Phase 4 — Conductor & Requirements

- [ ] `4.21` Modify `02-requirements.agent.md` — add `iac_tool` field
- [ ] `4.22` Modify `01-conductor.agent.md` — add Terraform routing, 3 new agents/handoffs
- [ ] `4.23` Modify `03-architect.agent.md` — add `iac_tool` awareness

## Phase 5 — Quality Gates & Automation

- [ ] `5.24` Update `lefthook.yml` — add `terraform-fmt` and `terraform-validate` hooks
- [ ] `5.25` Update `package.json` — add `lint:terraform-fmt` and `validate:terraform` scripts
- [ ] `5.26` Extend `validate-governance-refs.mjs` — Terraform check groups + dual-field support
- [ ] `5.27` Create `.github/workflows/terraform-validate.yml`
- [ ] `5.28` Extend `.github/workflows/policy-compliance-check.yml`
- [ ] `5.29` Rename `## 📁 Bicep Templates Location` → `## 📁 IaC Templates Location` (3 locations)
- [ ] `5.30` Update `validate-artifact-templates.mjs` AGENTS map — add Terraform agent mappings

## Phase 6 — Governance Migration (Deferrable)

> This phase only starts after Phases 0-5 are complete and working.

- [ ] `6.31` Migrate Bicep agents to read `azurePropertyPath` (with `bicepPropertyPath` fallback)

## Phase 7 — Documentation & Housekeeping

- [ ] `7.32` Update `.github/copilot-instructions.md` — Terraform agents, skills, tools, conventions
- [ ] `7.33` Update `docs/terraform-roadmap.md` — mark completed items, add links
- [ ] `7.34` Update GitHub issue #85 — refined scope + 8 child issues

---

## Blockers & Notes

<!-- Add session notes here — what was attempted, what broke, what needs follow-up -->

| Date | Contributor | Item | Note |
| ---- | ----------- | ---- | ---- |
| 2026-02-24 | — | Setup | Initial progress tracker created |

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

- [ ] `npm run validate:all` passes
- [ ] `05-bicep-planner` frontmatter still valid
- [ ] `06-bicep-code-generator` governance compliance still passes
- [ ] `governance-discovery-subagent` still produces `bicepPropertyPath` (dual-field)
- [ ] `01-conductor` routes Bicep projects correctly
