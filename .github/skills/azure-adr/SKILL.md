---
name: azure-adr
description: '**ANALYSIS SKILL** — Creates Azure Architecture Decision Records (ADRs) with WAF pillar mapping, alternatives, and consequences. WHEN: "create ADR", "document decision", "architecture decision record", "record why we chose", "WAF pillar justification", "trade-off analysis". DO NOT USE FOR: IaC code (06b/06t agents), architecture diagrams (drawio), cost estimates (cost-estimate-subagent).'
compatibility: Works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool; no external dependencies required.
license: MIT
metadata:
  author: jonathan-vella
  version: "1.0"
  category: document-creation
---

# Azure Architecture Decision Records (ADR) Skill

Create formal Architecture Decision Records that document significant
infrastructure decisions with Azure-specific context, WAF pillar analysis,
and implementation guidance.

## Output Naming

ADRs are saved to `agent-output/{project}/` with one of two phase prefixes:

| Phase              | Prefix          | Status default | Trigger                                      |
| ------------------ | --------------- | -------------- | -------------------------------------------- |
| Step 3 (Design)    | `03-des-adr-`   | `Proposed`     | Architect agent, design/planning language    |
| Step 7 (As-Built)  | `07-ab-adr-`    | `Accepted`     | After deploy, implemented/current-state language |

Full filename: `{prefix}NNNN-{kebab-title}.md` (e.g.,
`03-des-adr-0001-use-cosmos-db-for-state.md`). NNNN is 4-digit sequential
per project.

The `07-ab-adr-` ADR may differ from `03-des-adr-` if implementation
required changes — document deviations in the "Implementation Notes"
section.

## Rules

1. **One decision per ADR** — keep ADRs focused on a single decision
2. **Include alternatives** — always document at least 2-3 considered and rejected
3. **Map to WAF pillars** — show impact on each of the 5 Well-Architected pillars
4. **Link to requirements** — reference the requirement that drove the decision
5. **Keep it concise** — ADRs should be readable in 5 minutes
6. **Document both consequences** — at least 1 positive and 1 negative

## Steps

1. **Gather context** — decision context, alternatives, stakeholders
2. **Determine number** — check existing ADRs in `agent-output/{project}/` for next sequence
3. **Determine phase** — design (`03-des-`) or as-built (`07-ab-`)
4. **Generate document** — follow [`references/adr-template.md`](references/adr-template.md)
5. **Include WAF analysis** — map decision impact to all 5 pillars
6. **Document alternatives** — list 2-3 with rejection reasons
7. **Self-check** — run through [`references/quality-checklist.md`](references/quality-checklist.md)

## Reference Index

Load on demand:

| Reference                          | When to Load                                          |
| ---------------------------------- | ----------------------------------------------------- |
| `references/adr-template.md`       | Authoring the ADR (full template with all sections)   |
| `references/example-prompts.md`    | Looking for trigger phrasing / common ADR topics      |
| `references/quality-checklist.md`  | Final self-check before saving                        |
| `references/guardrails.md`         | DO/DON'T rules, anti-pattern table                    |
