<!-- ref:agent-model-policy-v2 -->

# Agent Model Policy

## Source Of Truth

- Agent frontmatter is canonical.
- `tools/registry/agent-registry.json` mirrors frontmatter.
- `.github/model-catalog.json` authorizes labels and contains generated
  assignments.
- `node tools/scripts/generate-model-catalog.mjs` refreshes assignments.

Do not reorder prioritized models or change assignments without explicit
approval. Explain approved changes in the pull request.

## Assignment Rationale

| Agent group | Model family | Rationale |
| --- | --- | --- |
| Orchestrator | MAI Code Flash | Fast handoff-only routing |
| Requirements, Architect, IaC Planner | GPT-6-Sol | User-approved assignments |
| Governance, CodeGen, Deploy, Challenger, and selected subagents | GPT-6-Luna | User-approved assignments |
| Design, As-Built, Diagnose | GPT-5.6-Terra | User-approved assignments |
| Context Optimizer | Claude Opus 5.5 | User-approved assignment |
| Orchestrator | MAI-Code-1.1-Flash | Handoff-only routing |

The model catalog owns exact active labels. Do not duplicate the complete map in
prose.

## Reasoning Effort

- High: architecture, WAF trade-offs, IaC planning, deep context audits.
- Medium: structured code generation and large deterministic artifact suites.
- Default: interactive diagnostics and focused procedural work.

Effort is runtime policy, not part of a model label. Re-evaluate before
escalating; effort does not replace missing context or validation.

## Prompt Style

- Claude: role-first structured contracts and selective XML blocks.
- GPT-5.6-Terra: outcome-first Markdown and explicit stop rules.
- GPT-6-Sol and GPT-6-Luna: reviewer-only pending verified vendor guidance.
- MAI Code Flash: concise orchestrator routing structure.

Load `../../vendor-prompting/SKILL.md` for a vendor-specific audit.
