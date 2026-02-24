---
mode: agent
description: Implements Phase 7 — Documentation & Housekeeping. Updates copilot-instructions.md, terraform-roadmap.md, and creates GitHub issues.
---

# Phase 7 — Documentation & Housekeeping

## Prerequisites

Phases 0-5 complete (Phase 6 optional). At minimum, the Terraform agents work end-to-end.

## Context Load

1. `docs/tf-support/PROGRESS.md` — confirm Phase 7 is active
2. `.github/copilot-instructions.md` — current state (read all)
3. `docs/terraform-roadmap.md` — current state
4. `docs/tf-support/github-issues/` — pre-written issue content

## Item 7.32 — Update `.github/copilot-instructions.md`

Find the **7-Step Workflow** table. Update rows 4-6:

| Step | Before | After |
| ---- | ------ | ----- |
| 4 | Bicep Plan | IaC Plan (Bicep: `05-Bicep Planner` / Terraform: `11-Terraform Planner`) |
| 5 | Bicep Code | IaC Code (Bicep: `06-Bicep Code Generator` / Terraform: `12-Terraform Code Generator`) |
| 6 | Deploy | Deploy (Bicep: `07-Deploy` / Terraform: `13-Terraform Deploy`) |

Find the **Skills** table. Add a new row:
```
| `terraform-patterns` | Terraform HCL patterns (hub-spoke, PE, diagnostics, AVM pitfalls) |
```

Find the **Key files** table. Add:
```
| `infra/terraform/{project}/` | Terraform templates by project |
| `docs/tf-support/`           | Terraform support planning docs and prompts |
```

Find the **Validation** section. Add:
```bash
terraform fmt -check -recursive infra/terraform/
terraform validate
```

Find (or add) a **Key Conventions** section for Terraform:
```yaml
# Terraform conventions
default_backend: Azure Storage Account
required_tags: [Environment, ManagedBy="Terraform", Project, Owner]
unique_suffix: random_string (4 chars, lowercase)
avm_registry: registry.terraform.io/Azure/avm-res-*/azurerm
provider_pin: "~> 4.0"
```

## Item 7.33 — Update `docs/terraform-roadmap.md`

Read the current file. For each item that was completed in Phases 0-7:
- Change `[ ]` to `[x]`
- Add a link to the actual file created, e.g.: `[Created](../.github/agents/11-terraform-planner.agent.md)`

Add a new section at the bottom: `## Implementation Notes` with a brief summary
of key decisions made and any deviations from the original roadmap.

## Item 7.34 — GitHub Issues

The issue templates are pre-written in `docs/tf-support/github-issues/`.

To create them using `gh` CLI (requires authentication):
```bash
bash docs/tf-support/github-issues/create-issues.sh
```

To create them via the GitHub web UI, use the content in each `issue-child-*.md` file.

For issue #85, use the content in `issue-85-parent.md` to update the existing issue.

## Validation

```bash
npm run validate:all
npm run lint:md
```

The copilot-instructions.md update must pass markdown lint.

## Commit

```bash
git add .github/copilot-instructions.md docs/terraform-roadmap.md
git commit -m "docs: update copilot instructions and roadmap for Terraform support

- copilot-instructions.md: add Terraform agents (11-/12-/13-), skills, conventions
- terraform-roadmap.md: mark completed items, add implementation notes"
```

## Final: Update PROGRESS.md

Check off `7.32`, `7.33`, `7.34`. Phase 7 → `✅ Complete`.
Update the overall status table to show all phases complete.

Add a final Blockers & Notes entry:
```
| [date] | [you] | All phases | Implementation complete. Open PR: tf-dev → main |
```

Set `active_phase: 0` (or add a `status: complete` field) to signal done.

Then commit:
```bash
git add docs/tf-support/PROGRESS.md
git commit -m "chore(progress): Phase 7 complete — Terraform support implementation done"
```

## Final Checklist Before PR

- [ ] `npm run validate:all` passes
- [ ] `terraform fmt -check -recursive infra/terraform/` passes (or directory is empty)
- [ ] `npm run lint:agent-frontmatter` — all 10 main agents + 8 subagents valid
- [ ] `npm run lint:governance-refs` — all Terraform check groups pass
- [ ] `npm run lint:h2-sync` — IaC Templates Location in sync
- [ ] Regression check prompt passes
- [ ] `docs/tf-support/PROGRESS.md` — all items checked off
- [ ] PR description references issue #85
