# [tf-dev] Phase 0 — Foundation & Validation

labels: enhancement, terraform, infrastructure

---

## Summary

Establish the baseline validation and tooling foundation for Terraform support.
All subsequent phases depend on a clean validator state.

## Prerequisite

Branch `tf-dev` checked out with `docs/tf-support/` committed.

## Items

- [ ] **0.1** Audit all `npm run validate:*` scripts — confirm they extend cleanly to Terraform files
- [ ] **0.2** Add `validate-terraform-policy` script for governance check groups with `terraformPropertyPath`
- [ ] **0.3** Add `validate-no-deprecated-refs` exception list entries for new Terraform agent names
- [ ] **0.4** Update `.markdownlint-cli2.jsonc` as needed for Terraform-specific docs
- [ ] **0.5** Confirm `npm run validate:all` passes at start of phase (zero errors, zero warnings)
- [ ] **0.6** Confirm `npm run validate:all` passes at end of phase

## Acceptance Criteria

- [ ] `npm run validate:all` passes (before and after)
- [ ] New `validate-terraform-policy` script added and integrated into `npm run validate:all`
- [ ] `check-docs-freshness.mjs` has no stale references for tf-support files

## References

- Plan items: 0.1–0.6
- Prompt: `docs/tf-support/prompts/phase-0-foundation.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
