# [tf-dev] Phase 1 — Instructions & Skills

labels: enhancement, terraform, infrastructure

---

## Summary

Create all instruction files and skills needed for Terraform agents to author
compliant, well-architected HCL code.

## Prerequisites

Phase 0 complete. `npm run validate:all` passes.

## Items

- [ ] **1.7** Create `.github/instructions/terraform-code-best-practices.instructions.md`
- [ ] **1.8** Create `.github/instructions/terraform-policy-compliance.instructions.md`
- [ ] **1.9** Add `terraform-patterns` skill at `.github/skills/terraform-patterns/SKILL.md`
- [ ] **1.10** Update `agent-skills.instructions.md` for the new skill
- [ ] **1.11** Update `governance-discovery.instructions.md` to add `terraformPropertyPath` field requirement
- [ ] **1.12** Update `azure-artifacts.instructions.md` with Terraform-specific artifact H2 entries
- [ ] **1.13** Add Terraform module entries to `azure-bicep-patterns` skill or create separate skill

## Acceptance Criteria

- [ ] `npm run validate:skills-format` passes with new skill
- [ ] `npm run validate:instruction-frontmatter` passes for all new instruction files
- [ ] `npm run validate:instruction-references` passes
- [ ] Regression check passes

## References

- Plan items: 1.7–1.13
- Prompt: `docs/tf-support/prompts/phase-1-instructions-skills.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
