---
name: azure-adr
description: "**ANALYSIS SKILL** — Create Azure Architecture Decision Records (ADRs) with Well-Architected (WAF) pillar mapping, alternatives, consequences, and implementation notes. WHEN: \"create ADR\", \"architecture decision record\", \"document decision\", \"record rationale\", \"trade-off analysis\", \"why we chose\", \"design vs as-built\". USE FOR: ADR scaffolding and authoring for design (Step 3) and as-built (Step 7), including numbering, naming, and template completion. Outputs Markdown under agent-output/{project}/ using 03-des-adr- or 07-ab-adr- prefixes."
compatibility: Works with GitHub Copilot, VS Code, Claude Code, and Agent Skills compatible tools; no external dependencies required.
license: MIT
metadata:
  author: jonathan-vella
  version: "1.1"
  category: document-creation
---

# Azure Architecture Decision Records (ADR) Skill

Author formal ADRs for Azure solutions, capturing context, rationale, options, WAF pillar impacts, and concise implementation notes.

## Rules (when to use / not use)
- One decision per ADR; keep focused and under ~2 pages.
- Use Azure context and service names consistently.
- Always include at least 2 alternatives with rejection reasons.
- Map impacts across Azure Well-Architected pillars:
  - Security, Reliability, Cost Optimization, Operational Excellence, Performance Efficiency.
- Link to requirements/tickets and related docs.
- Choose phase:
  - Design ADR (prefix 03-des-): status = Proposed.
  - As-Built ADR (prefix 07-ab-): status = Accepted.
- Scope boundaries:
  - Do not produce deployment scripts, diagrams, or cost models here; reference or link instead.

## Steps (how to execute)
1. Identify phase and status:
   - Design (planning/proposal) → 03-des-adr-, status Proposed.
   - Implemented/current state → 07-ab-adr-, status Accepted.
2. Determine filename and number:
   - Inspect agent-output/{project}/ for existing ADRs.
   - Next 4‑digit sequence (0001, 0002, ...).
   - Title slug: lowercase, hyphenated (e.g., use-cosmos-db-for-state).
3. Gather inputs:
   - Problem/goal, constraints, non-functional requirements, stakeholders.
   - Candidate options (≥3 preferred), evaluation criteria.
   - Evidence (benchmarks, assessments, incidents).
4. Draft ADR (Markdown):
   - Header: Title, ADR ID, Status, Date, Authors, Stakeholders, References.
   - Context: problem, scope, constraints, assumptions.
   - Decision: explicit statement and scope boundaries.
   - Options Considered: brief summary per option with pros/cons.
   - Rationale: why chosen option meets goals and trade-offs.
   - WAF Pillar Analysis:
     - Security: impacts, controls, risks.
     - Reliability: HA/DR, failure modes, SLAs.
     - Cost Optimization: expected spend drivers, efficiency levers.
     - Operational Excellence: deploy/operate, observability.
     - Performance Efficiency: latency/throughput/scaling.
   - Consequences:
     - Positive outcomes and benefits.
     - Negative outcomes, risks, mitigations.
   - Compliance & Risk: standards, regulatory considerations.
   - Implementation Notes: high-level steps, dependencies, rollout/backout, validation.
   - Links: tickets, runbooks, tests, diagrams, code repos.
5. Validate naming and content:
   - Prefix matches phase; number is sequential; title slug is clear.
   - Status and date (YYYY-MM-DD) set correctly.
6. Save artifact:
   - agent-output/{project}/03-des-adr-NNNN-{title}.md or
     agent-output/{project}/07-ab-adr-NNNN-{title}.md.
7. Cross-link:
   - Reference related ADRs, requirements, and implementation artifacts.
   - If superseding/updating a prior ADR, state relation explicitly.

## Output conventions
- Prefix: 03-des-adr- (design) or 07-ab-adr- (as-built).
- Number: 4-digit sequence (0001, 0002, ...).
- Title: lowercase-hyphenated short slug.
- Example:
  - agent-output/{project}/03-des-adr-0001-use-cosmos-db-for-state.md

## Quality checklist
- [ ] Sequential ADR number and correct prefix.
- [ ] Clear Context and unambiguous Decision statement.
- [ ] ≥2 alternatives with explicit rejection reasons.
- [ ] WAF analysis covers all five pillars with concrete impacts.
- [ ] At least one positive and one negative consequence with mitigations.
- [ ] Links to requirements and supporting evidence.
- [ ] Implementation notes provide actionable guidance.
- [ ] Status (Proposed/Accepted) and date set correctly.

## MCP Tools (tool dependencies)
- None required.
- Optional (if available):
  - Filesystem: read references/adr-template.md and references/guardrails.md.
  - Project indexer: locate existing ADRs to determine next sequence.

## References (load on demand)
- references/adr-template.md — full section outline and examples.
- references/guardrails.md — DO/DON'T rules and anti-patterns.