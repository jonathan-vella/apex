# [tf-dev] Phase 5 — Quality Gates

labels: enhancement, terraform, infrastructure

---

## Summary

Extend the quality gates and validation scripts to cover Terraform files with
the same rigour as Bicep.

## Prerequisites

Phase 4 complete. Conductor routing validated.

## Items

- [ ] **5.32** Add `terraform fmt -check -recursive` to pre-commit hooks (`lefthook.yml`)
- [ ] **5.33** Add `terraform validate` to `lefthook.yml` for `infra/terraform/**` changes
- [ ] **5.34** Update `validate-artifact-templates.mjs` to recognise Terraform artifact H2 keys
- [ ] **5.35** Update `validate-h2-sync.mjs` for Terraform-specific H2 blocks
- [ ] **5.36** Add `IaC Templates Location` check in `validate-vscode-config.mjs`
- [ ] **5.37** `npm run validate:all` includes Terraform validators end-to-end

## Acceptance Criteria

- [ ] `npm run validate:all` passes — zero errors, zero warnings
- [ ] `lefthook.yml` pre-commit runs `terraform fmt --check` on `.tf` file changes
- [ ] Regression check passes

## References

- Plan items: 5.32–5.37
- Prompt: `docs/tf-support/prompts/phase-5-quality-gates.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
