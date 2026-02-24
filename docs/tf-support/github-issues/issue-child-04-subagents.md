# [tf-dev] Phase 3 — Agents: Subagents

labels: enhancement, terraform, infrastructure

---

## Summary

Create Terraform-specific subagents and update existing shared subagents
to handle both Bicep and Terraform contexts.

## Prerequisites

Phase 2 complete. Core agents validated.

## Items

- [ ] **3.20** Create `terraform-lint-subagent.agent.md` (`terraform fmt` + `terraform validate`)
- [ ] **3.21** Create `terraform-whatif-subagent.agent.md` (`terraform plan` preview)
- [ ] **3.22** Update `governance-discovery-subagent` to output both `bicepPropertyPath` and `terraformPropertyPath`
- [ ] **3.23** Update `cost-estimate-subagent` to handle Terraform resource type naming
- [ ] **3.24** Update `bicep-review-subagent` → rename or create `iac-review-subagent` that handles both
- [ ] **3.25** Update `copilot-instructions.md` agents table with new subagents

## Acceptance Criteria

- [ ] All subagent files pass `validate-agent-frontmatter`
- [ ] `governance-discovery-subagent` output JSON schema includes `terraformPropertyPath`
- [ ] `terraform-lint-subagent` runs `terraform fmt -check` and returns PASS/FAIL
- [ ] Regression check: governance discovery still produces `bicepPropertyPath`

## References

- Plan items: 3.20–3.25
- Prompt: `docs/tf-support/prompts/phase-3-subagents.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
