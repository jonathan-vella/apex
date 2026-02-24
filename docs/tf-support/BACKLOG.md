# Terraform Support — Backlog

> Machine-readable backlog derived from `tf-support-plan.prompt.md`.
> **Source of truth for progress**: `PROGRESS.md`
> **Source of truth for implementation detail**: `tf-support-plan.prompt.md`

## Legend

| Field  | Values |
| ------ | ------ |
| Status | `todo` `in-progress` `done` `blocked` `deferred` |
| Size   | `XS` (< 30 min) `S` (30-60 min) `M` (1-2 hr) `L` (2-4 hr) `XL` (> 4 hr) |
| Type   | `config` `instruction` `skill` `agent` `script` `ci` `docs` |

## Phase 0 — Branch & Foundation

| ID   | Item                                                 | Type        | Size | Status | Owner | Notes |
| ---- | ---------------------------------------------------- | ----------- | ---- | ------ | ----- | ----- |
| 0.1  | Create `tf-dev` branch from `main`                   | `config`    | XS   | `done` | —     | Already done |
| 0.2  | devcontainer: Terraform + Go features, env, editor   | `config`    | S    | `todo` | —     | |
| 0.3  | devcontainer: VS Code extensions                     | `config`    | XS   | `todo` | —     | HashiCorp.terraform + ms-azuretools.vscode-azureterraform |
| 0.4  | `.gitignore`: Terraform entries, lock file committed | `config`    | XS   | `todo` | —     | `*.tfstate`, `.terraform/`, NOT `.terraform.lock.hcl` |
| 0.5  | `.gitattributes`: `*.tf`, `*.tfvars`, `*.hcl`        | `config`    | XS   | `todo` | —     | |
| 0.6  | MCP: add terraform-mcp-server + package.json devDep  | `config`    | S    | `todo` | —     | npx, zero-latency via devDep |
| 0.7  | Create `infra/terraform/.gitkeep`                    | `config`    | XS   | `todo` | —     | |
| 0.8  | **[GATE]** Verify MCP tool names + document          | `docs`      | M    | `todo` | —     | Blocks Phase 2 agent tool lists |

## Phase 1 — Instructions, Skills & Governance

| ID   | Item                                                    | Type          | Size | Status | Owner | Notes |
| ---- | ------------------------------------------------------- | ------------- | ---- | ------ | ----- | ----- |
| 1.9  | `governance-discovery.instructions.md`: add `**/*.tf`   | `instruction` | XS   | `todo` | —     | Prerequisite for Phase 2 |
| 1.10 | `governance-discovery-subagent`: dual-field output      | `agent`       | M    | `todo` | —     | Both `bicepPropertyPath` + `azurePropertyPath` |
| 1.11 | Create `terraform-code-best-practices.instructions.md`  | `instruction` | L    | `todo` | —     | Adapt from bicep version |
| 1.12 | Create `terraform-policy-compliance.instructions.md`    | `instruction` | M    | `todo` | —     | `azurePropertyPath` translation |
| 1.13 | Create `terraform-patterns/SKILL.md`                    | `skill`       | XL   | `todo` | —     | 7 patterns + AVM pitfalls |
| 1.14 | `azure-defaults/SKILL.md`: add Terraform Conventions    | `skill`       | M    | `todo` | —     | + AVM-TF module table (16 resources) |

## Phase 2 — Agents (Core)

| ID   | Item                                               | Type    | Size | Status | Owner | Notes |
| ---- | -------------------------------------------------- | ------- | ---- | ------ | ----- | ----- |
| 2.15 | Create `11-terraform-planner.agent.md`             | `agent` | XL   | `todo` | —     | Requires Phase 0 item 0.8 for tool names |
| 2.16 | Create `12-terraform-code-generator.agent.md`      | `agent` | XL   | `todo` | —     | Includes bootstrap scripts phase |
| 2.17 | Create `13-terraform-deploy.agent.md`              | `agent` | L    | `todo` | —     | Azure Storage backend only |

## Phase 3 — Subagents

| ID   | Item                                               | Type    | Size | Status | Owner | Notes |
| ---- | -------------------------------------------------- | ------- | ---- | ------ | ----- | ----- |
| 3.18 | Create `terraform-lint-subagent.agent.md`          | `agent` | M    | `todo` | —     | tfsec + fmt + validate |
| 3.19 | Create `terraform-review-subagent.agent.md`        | `agent` | M    | `todo` | —     | 7-section checklist, azurePropertyPath |
| 3.20 | Create `terraform-plan-subagent.agent.md`          | `agent` | M    | `todo` | —     | parse plan output |

## Phase 4 — Conductor & Requirements

| ID   | Item                                               | Type    | Size | Status | Owner | Notes |
| ---- | -------------------------------------------------- | ------- | ---- | ------ | ----- | ----- |
| 4.21 | `02-requirements.agent.md`: add `iac_tool` field   | `agent` | S    | `todo` | —     | Default: Bicep |
| 4.22 | `01-conductor.agent.md`: Terraform routing         | `agent` | L    | `todo` | —     | Merge AFTER Phase 2 is merged |
| 4.23 | `03-architect.agent.md`: `iac_tool` awareness      | `agent` | S    | `todo` | —     | |

## Phase 5 — Quality Gates & Automation

| ID   | Item                                                           | Type     | Size | Status | Owner | Notes |
| ---- | -------------------------------------------------------------- | -------- | ---- | ------ | ----- | ----- |
| 5.24 | `lefthook.yml`: add terraform-fmt + terraform-validate hooks   | `config` | S    | `todo` | —     | |
| 5.25 | `package.json`: add lint:terraform + validate:terraform scripts | `config` | S    | `todo` | —     | Update validate:all |
| 5.26 | `validate-governance-refs.mjs`: Terraform check groups          | `script` | L    | `todo` | —     | + dual-field support |
| 5.27 | Create `.github/workflows/terraform-validate.yml`               | `ci`     | M    | `todo` | —     | |
| 5.28 | Extend `policy-compliance-check.yml`                            | `ci`     | S    | `todo` | —     | |
| 5.29 | Rename Bicep H2 → IaC-neutral (3 locations)                     | `docs`   | S    | `todo` | —     | validate-artifact-templates.mjs, SKILL.md, agent |
| 5.30 | `validate-artifact-templates.mjs`: AGENTS map for Terraform     | `script` | M    | `todo` | —     | IaC-type detection |

## Phase 6 — Governance Migration (Deferrable)

| ID   | Item                                                          | Type     | Size | Status    | Owner | Notes |
| ---- | ------------------------------------------------------------- | -------- | ---- | --------- | ----- | ----- |
| 6.31 | Migrate Bicep agents to `azurePropertyPath` (with fallback)   | `agent`  | L    | `deferred` | —    | After Phases 0-5 proven working |

## Phase 7 — Documentation & Housekeeping

| ID   | Item                                               | Type   | Size | Status | Owner | Notes |
| ---- | -------------------------------------------------- | ------ | ---- | ------ | ----- | ----- |
| 7.32 | Update `.github/copilot-instructions.md`           | `docs` | M    | `todo` | —     | Terraform agents 11-/12-/13- |
| 7.33 | Update `docs/terraform-roadmap.md`                 | `docs` | S    | `todo` | —     | Mark completed, add links |
| 7.34 | Update GitHub issue #85 + create 8 child issues    | `docs` | M    | `todo` | —     | See `github-issues/` directory |

## Summary Stats

```
Total items:    34
Deferred:        1 (item 6.31)
Active backlog: 33

By type:   config=9  instruction=3  skill=2  agent=14  script=3  ci=2  docs=4
By size:   XS=7  S=11  M=10  L=5  XL=3  (rough estimates — adjust as you go)
By phase:  Ph0=8  Ph1=6  Ph2=3  Ph3=3  Ph4=3  Ph5=7  Ph6=1  Ph7=3
```
