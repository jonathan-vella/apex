# [tf-dev] Phase 2 — Agents: Core Terraform

labels: enhancement, terraform, infrastructure

---

## Summary

Create the three core Terraform agents: Planner (11), Code Generator (12), and Deploy (13).

## Prerequisites

Phase 1 complete. New instructions and skills validated.

## Items

- [ ] **2.14** Create `.github/agents/11-terraform-planner.agent.md`
- [ ] **2.15** Create `.github/agents/12-terraform-code-generator.agent.md`
- [ ] **2.16** Create `.github/agents/13-terraform-deploy.agent.md`
- [ ] **2.17** All three agents pass `validate-agent-frontmatter` (mode, description, tools, skills fields)
- [ ] **2.18** Update `README.md` agents table with all three new agents
- [ ] **2.19** Update `azd/vscode` settings for the new agents if needed

## Acceptance Criteria

- [ ] `npm run validate:agent-frontmatter` passes for all agents including the three new ones
- [ ] All three agent files have correct `tools:` taxonomy matching existing agents
- [ ] Regression check passes (Bicep path unbroken)

## References

- Plan items: 2.14–2.19
- Prompt: `docs/tf-support/prompts/phase-2-agents-core.prompt.md`
- Progress: `docs/tf-support/PROGRESS.md`
