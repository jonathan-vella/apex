# [tf-dev] Phase 6 — Governance & Migration

labels: enhancement, terraform, infrastructure

---

## Summary

Wire Terraform into the existing governance-discovery workflow, and create a migration
path for teams moving from Bicep to Terraform or maintaining both.

## Prerequisites

Phase 5 complete. All validators passing.

## Items

- [ ] **6.38** Update `04-governance-constraints.json` schema to include `terraformPropertyPath`
- [ ] **6.39** Update `governance-discovery.instructions.md`: require both path fields
- [ ] **6.40** Update `governance-discovery-subagent` to query Azure Policy and produce both paths
- [ ] **6.41** Create `docs/tf-support/migration-guide.md`: Bicep-to-Terraform migration checklist
- [ ] **6.42** Update `docs/workflow.md`: add Terraform path to the flow diagrams
- [ ] **6.43** Add `bicep-to-terraform` label to GitHub labels (manual step — document in README)

## Acceptance Criteria

- [ ] JSON schema for governance constraints valid with both `bicepPropertyPath` and `terraformPropertyPath`
- [ ] `npm run validate:governance-refs` passes with Terraform check groups
- [ ] `docs/tf-support/migration-guide.md` covers minimum 10 common resource types
- [ ] Regression check: `bicepPropertyPath` still present in governance output

## References

- Plan items: 6.38–6.43
- Prompt: `docs/tf-support/prompts/phase-6-governance-migration.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
