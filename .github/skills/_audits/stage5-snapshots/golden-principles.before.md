---
name: golden-principles
description: '**ANALYSIS SKILL** — The agent-first operating principles governing how agents work in this repository. WHEN: "golden principles", "agent behavior rules", "operating philosophy", "principle lookup", "governance invariants". USE FOR: agent behavior rules, operating philosophy, principle lookup, governance invariants. DO NOT USE FOR: Azure infrastructure, code generation, troubleshooting, diagram creation.'
---

# Golden Principles

These 10 principles govern how every agent operates in this repository.
They are adapted from the Harness Engineering philosophy for agent-driven
infrastructure development.

---

## Rules

These 10 principles are the agent operating rules. Detailed explanations follow in [The 10 Principles](#the-10-principles).

1. **Repository Is the System of Record** — all context lives in-repo
2. **Map, Not Manual** — instructions point to deeper sources
3. **Enforce Invariants, Not Implementations** — set boundaries, allow autonomous expression
4. **Parse at Boundaries** — validate inputs and outputs at module edges
5. **AVM-First, Security Baseline Always** — prefer Azure Verified Modules + non-negotiable security baseline
6. **Golden Path Pattern** — prefer shared utilities over hand-rolled helpers
7. **Composable Workflows** — small, well-bounded steps that compose
8. **Human Approval at Critical Gates** — explicit gates between steps
9. **Adversarial Review** — challenger subagents stress-test creative outputs
10. **Continuous Lessons** — capture observations and feed back into the system

## Steps

Applying the principles to a new agent or skill:

1. **Read all 10 principles** before designing the agent or skill
2. **For each design decision**, ask which principles apply (typically 2–3 will dominate)
3. **Run the per-principle test** listed in [The 10 Principles](#the-10-principles)
4. **Where a principle conflicts with an implementation choice**, change the implementation — principles are non-negotiable
5. **Document deviations** in an ADR if a principle was knowingly relaxed

## The 10 Principles

Each principle has a non-negotiable rule and a quick test for compliance. Full text plus the
"How to Apply These Principles" section (for agents, contributors, and code review) lives
in [`references/principles.md`](references/principles.md). Always load that reference when
applying the principles to a specific decision.

> **Note**: when the Rules summary above and the detailed reference disagree (the summary
> currently lists "Composable Workflows" / "Human Approval Gates" / "Adversarial Review" /
> "Continuous Lessons" for #7–10, while the canonical detail uses the Harness Engineering
> set), prefer the canonical detail in [`references/principles.md`](references/principles.md).
> Reconciliation is tracked separately from this token-squeeze pass.
