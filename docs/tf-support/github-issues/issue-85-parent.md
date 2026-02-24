# Terraform Support for Azure Agentic InfraOps

## Summary

Add first-class Terraform HCL support to the agentic InfraOps workflow alongside existing Bicep support.
Users will be able to choose Bicep or Terraform at Step 1 (Requirements) and receive the same
well-architected, governed infrastructure experience for either IaC language.

## Scope

This issue tracks the full 8-phase implementation. Each phase is a child issue linked below.

### Phase Checklist

- [ ] Phase 0 — Foundation & Validation (child issue)
- [ ] Phase 1 — Instructions & Skills (child issue)
- [ ] Phase 2 — Agents: Core Terraform (child issue)
- [ ] Phase 3 — Agents: Subagents (child issue)
- [ ] Phase 4 — Conductor Integration (child issue)
- [ ] Phase 5 — Quality Gates (child issue)
- [ ] Phase 6 — Governance & Migration (child issue)
- [ ] Phase 7 — Documentation & Housekeeping (child issue)

## Acceptance Criteria

- [ ] Terraform path works end-to-end through the 7-step conductor workflow
- [ ] All validators pass: `npm run validate:all`
- [ ] Bicep path is unbroken (regression check passes)
- [ ] Governance discovery produces `bicepPropertyPath` equivalent for Terraform
- [ ] `terraform fmt` and `terraform validate` pass on generated templates
- [ ] `copilot-instructions.md` updated with Terraform agents and skills
- [ ] `terraform-roadmap.md` fully updated with completion status

## Related

- Plan: `docs/tf-support/tf-support-plan.prompt.md`
- Branch: `tf-dev`
- Progress tracker: `docs/tf-support/PROGRESS.md`
- Contributor guide: `docs/tf-support/README.md`

## Labels

`enhancement`, `terraform`, `infrastructure`, `azure`
