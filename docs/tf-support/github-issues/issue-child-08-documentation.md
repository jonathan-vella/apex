# [tf-dev] Phase 7 — Documentation & Housekeeping

labels: enhancement, terraform, infrastructure, documentation

---

## Summary

Update all user-facing documentation to reflect the completed Terraform support
and close out the implementation.

## Prerequisites

Phases 0-5 complete. Phase 6 optional but recommended.

## Items

- [ ] **7.32** Update `.github/copilot-instructions.md`: add Terraform agents, skills, conventions, validation commands
- [ ] **7.33** Update `docs/terraform-roadmap.md`: mark all completed items, add Implementation Notes section
- [ ] **7.34** Create GitHub issues for each phase (this issue closes Phase 7)

## Acceptance Criteria

- [ ] `copilot-instructions.md` lists all three Terraform agents (11, 12, 13) and `terraform-patterns` skill
- [ ] `copilot-instructions.md` Validation section includes `terraform fmt` and `terraform validate`
- [ ] `terraform-roadmap.md` has no unchecked items for completed work
- [ ] `docs/tf-support/PROGRESS.md` has all 34 items checked off
- [ ] `npm run validate:all` passes
- [ ] `npm run lint:md` passes
- [ ] PR opened: `tf-dev` → `main`, linked to issue #85

## References

- Plan items: 7.32–7.34
- Prompt: `docs/tf-support/prompts/phase-7-documentation.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
