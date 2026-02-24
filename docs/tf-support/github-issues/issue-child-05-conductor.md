# [tf-dev] Phase 4 — Conductor Integration

labels: enhancement, terraform, infrastructure

---

## Summary

Update the Conductor agent (01-Conductor) to detect the user's IaC preference and route
to either the Bicep or Terraform agent chain.

## Prerequisites

Phase 3 complete. All subagents validated.

## Items

- [ ] **4.26** Update `.github/agents/01-Conductor.agent.md`: add IaC selector logic
- [ ] **4.27** Conductor detects "Terraform" / "HCL" keywords in Step 1 → routes to 11-Terraform Planner
- [ ] **4.28** Conductor routes Bicep default unchanged (backward compatible)
- [ ] **4.29** Update conductor routing table in `copilot-instructions.md`
- [ ] **4.30** Add `11-Terraform Planner` and `12-Terraform Code Generator` to agents list in instructions
- [ ] **4.31** Smoke test: run conductor with Terraform workload → confirm routing to agent 11

## Acceptance Criteria

- [ ] Conductor agent passes `validate-agent-frontmatter` after changes
- [ ] Existing Bicep routing is unchanged (regression check passes)
- [ ] Terraform routing produces correct agent chain: 11 → 12 → 13
- [ ] Step references in conductor (Step 4 "IaC Plan", Step 5 "IaC Code") are language-agnostic

## References

- Plan items: 4.26–4.31
- Prompt: `docs/tf-support/prompts/phase-4-conductor.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
