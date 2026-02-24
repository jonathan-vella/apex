---
mode: agent
description: Implements Phase 5 — Quality Gates & Automation. Adds Terraform lefthook hooks, npm scripts, extended governance validator, CI workflows, and IaC-neutral artifact templates.
---

# Phase 5 — Quality Gates & Automation

## Prerequisites

Phases 0-4 complete and merged.

## Context Load

1. `docs/tf-support/PROGRESS.md` — confirm Phase 5 is active
2. `lefthook.yml` — current pre-commit hooks (all of it)
3. `package.json` — current scripts + devDependencies
4. `scripts/validate-governance-refs.mjs` — current validation groups
5. `scripts/validate-artifact-templates.mjs` — AGENTS map and ARTIFACT_HEADINGS
6. `.github/workflows/policy-compliance-check.yml` — current triggers
7. `.github/skills/azure-artifacts/SKILL.md` — find `Bicep Templates Location` heading
8. `.github/agents/06-bicep-code-generator.agent.md` — find `Bicep Templates Location` reference
9. `docs/tf-support/tf-support-plan.prompt.md` — items 24-30

## Item 5.24 — Update `lefthook.yml`

Add two new hooks to the `pre-commit` section (after existing hooks):

```yaml
terraform-fmt:
  glob: "*.tf"
  run: |
    STAGED_TF=$(git diff --cached --name-only --diff-filter=ACM | grep '\.tf$' || true)
    if [ -n "$STAGED_TF" ]; then
      echo "🔧 Checking Terraform formatting..."
      terraform fmt -check -recursive infra/terraform/ || {
        echo "❌ terraform fmt failed. Run: terraform fmt -recursive infra/terraform/"
        exit 1
      }
    else
      echo "ℹ️  No Terraform files to format-check"
    fi

terraform-validate:
  glob: "*.tf"
  run: |
    STAGED_TF=$(git diff --cached --name-only --diff-filter=ACM | grep '\.tf$' || true)
    if [ -n "$STAGED_TF" ]; then
      echo "🔧 Validating Terraform..."
      for dir in infra/terraform/*/; do
        if [ -f "$dir/main.tf" ]; then
          echo "  Validating $dir..."
          cd "$dir" && terraform init -backend=false -input=false -no-color > /dev/null 2>&1 \
            && terraform validate -no-color || { echo "❌ Validation failed in $dir"; exit 1; }
          cd - > /dev/null
        fi
      done
    else
      echo "ℹ️  No Terraform project to validate"
    fi
```

## Item 5.25 — Update `package.json`

Add new scripts (keep alphabetical order within the scripts block):

```json
"lint:terraform-fmt": "terraform fmt -check -recursive infra/terraform/",
"validate:terraform": "for dir in infra/terraform/*/; do [ -f \"$dir/main.tf\" ] && (cd \"$dir\" && terraform init -backend=false -input=false > /dev/null 2>&1 && terraform validate) || true; done",
```

Update `validate:all` — add `npm run lint:terraform-fmt` and `npm run validate:terraform`
to the chain. Find the end of the `validate:all` value and append them.

## Item 5.26 — Extend `validate-governance-refs.mjs`

This is the most complex change in Phase 5. Read the entire file before editing.

Add check groups for all Terraform agents. The pattern mirrors existing Bicep check groups.
Add these new groups to the `checks` array:

1. **terraform-planner-azurePropertyPath**: Checks `11-terraform-planner.agent.md` references
   `azurePropertyPath` (not `bicepPropertyPath` or `terraformPropertyPath`)
2. **terraform-code-generator-governance**: Checks `12-terraform-code-generator.agent.md`
   has Phase 1.5, HARD GATE, references `04-governance-constraints.json` and `azurePropertyPath`
3. **terraform-review-subagent-governance**: Checks `terraform-review-subagent.agent.md`
   has Governance Compliance section mentioning `azurePropertyPath`
4. **terraform-policy-compliance-instruction**: Checks `terraform-policy-compliance.instructions.md`
   exists, has `applyTo: "**/*.tf"`, has "Azure Policy always wins", references `04-governance-constraints.json`
5. **governance-discovery-dual-field**: Checks `governance-discovery-subagent.agent.md`
   produces BOTH `bicepPropertyPath` AND `azurePropertyPath`

**Also update existing Bicep check groups**: Where they strictly require `bicepPropertyPath`,
add an OR condition to also accept `azurePropertyPath` — supporting the transition period
where agents may have been updated to use the new field.

## Item 5.27 — Create `terraform-validate.yml`

Create `.github/workflows/terraform-validate.yml`:

```yaml
name: Terraform Validate
on:
  pull_request:
    paths:
      - "infra/terraform/**"
      - "**/*.tf"
  push:
    branches:
      - tf-dev
    paths:
      - "infra/terraform/**"

jobs:
  validate:
    name: Terraform Format & Validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~1.9"
      - name: Format check
        run: terraform fmt -check -recursive infra/terraform/
      - name: Validate all projects
        run: |
          for dir in infra/terraform/*/; do
            if [ -f "$dir/main.tf" ]; then
              echo "Validating $dir..."
              cd "$dir"
              terraform init -backend=false -input=false
              terraform validate
              cd -
            fi
          done
      - name: tfsec (optional)
        continue-on-error: true
        run: |
          if command -v tfsec &> /dev/null; then
            tfsec infra/terraform/ --no-color
          else
            echo "tfsec not available — skipping"
          fi
```

## Item 5.28 — Extend `policy-compliance-check.yml`

Find the `on: pull_request: paths:` trigger. Add paths:
```yaml
- ".github/agents/11-terraform-planner.agent.md"
- ".github/agents/12-terraform-code-generator.agent.md"
- ".github/agents/_subagents/terraform-review-subagent.agent.md"
- ".github/instructions/terraform-policy-compliance.instructions.md"
```

## Item 5.29 — Rename Bicep H2 → IaC-neutral (3 locations)

Find and replace `## 📁 Bicep Templates Location` → `## 📁 IaC Templates Location` in:

1. `scripts/validate-artifact-templates.mjs` — in the `ARTIFACT_HEADINGS` object
2. `.github/skills/azure-artifacts/SKILL.md` — in the template definition for `05-implementation-reference.md`
3. `.github/agents/06-bicep-code-generator.agent.md` — in Phase 4 output instructions

Run the h2-sync check to make sure all three are now in sync:
```bash
npm run lint:h2-sync
```

## Item 5.30 — Update AGENTS map in `validate-artifact-templates.mjs`

Find the `AGENTS` object (or equivalent map) that maps artifact filenames to their
owning agent file paths.

Add entries that map Terraform-produced artifacts to the Terraform agents.
The cleanest approach: detect IaC type from the `infra/terraform/` or `infra/bicep/`
directory path in the artifact content, then select the correct agent.

At minimum, add a comment documenting the dual-agent situation and ensure the validator
does not emit false errors when `12-terraform-code-generator.agent.md` produces
`05-implementation-reference.md` with an `## 📁 IaC Templates Location` heading.

## Validation

```bash
npm run validate:all
npm run lint:h2-sync
npm run lint:governance-refs
```

All must pass. No regressions in existing Bicep validators.

## Commit

```bash
git add lefthook.yml package.json scripts/validate-governance-refs.mjs \
        scripts/validate-artifact-templates.mjs .github/workflows/terraform-validate.yml \
        .github/workflows/policy-compliance-check.yml \
        .github/skills/azure-artifacts/SKILL.md \
        .github/agents/06-bicep-code-generator.agent.md
git commit -m "feat(quality): add Terraform quality gates, CI workflow, and IaC-neutral templates

- lefthook.yml: add terraform-fmt and terraform-validate pre-commit hooks
- package.json: add lint:terraform-fmt and validate:terraform scripts
- validate-governance-refs.mjs: add Terraform check groups + dual-field support
- New: .github/workflows/terraform-validate.yml
- policy-compliance-check.yml: add Terraform agent/instruction paths to triggers
- Rename 'Bicep Templates Location' → 'IaC Templates Location' (3 locations)
- validate-artifact-templates.mjs: add Terraform agent mapping + IaC-type detection"
```

## Update PROGRESS.md

Check off `5.24`–`5.30`. Phase 5 → `✅ Complete`, `active_phase: 7` (skip 6, it's deferred).
Commit.

## Full Regression Check

This phase touches the most validation infrastructure. Run the full regression check:
```
/prompt docs/tf-support/prompts/regression-check.prompt.md
```
