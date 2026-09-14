---
name: apex-golden-principles
user-invocable: false
disable-model-invocation: false
description: '**ANALYSIS SKILL** — The agent-first operating principles governing how agents work in this repository. WHEN: "golden principles", "agent behavior rules", "operating philosophy", "principle lookup", "governance invariants". USE FOR: agent behavior rules, operating philosophy, principle lookup, governance invariants. DO NOT USE FOR: Azure infrastructure, code generation, troubleshooting, diagram creation.'
---

# Golden Principles

These principles govern how every agent operates in this repository.
They are adapted from the Harness Engineering philosophy for agent-driven
infrastructure development.

---

## Rules

The canonical rules and preservation map live in [Principle Details](#principle-details).
This index is a summary, not a competing policy source.

1. **Repository Is the System of Record** — all context lives in-repo
2. **Map, Not Manual** — instructions point to deeper sources
3. **Enforce Invariants, Not Implementations** — set boundaries, allow autonomous expression
4. **Parse at Boundaries** — validate inputs and outputs at module edges
5. **AVM-First, Security Baseline Always** — prefer Azure Verified Modules + non-negotiable security baseline
6. **Golden Path Pattern** — prefer shared utilities over hand-rolled helpers
7. **Human Taste Gets Encoded** — turn reviewed feedback into durable guidance
8. **Context Is Scarce** — reuse current context and recover missing required evidence
9. **Progressive Disclosure** — load detail when needed without hiding essential rules
10. **Mechanical Enforcement Over Documentation** — validate deterministic invariants
11. **Composable Workflows** — bounded steps with explicit ownership and prerequisites
12. **Human Approval at Critical Gates** — approvals remain evidence-bound and human-controlled
13. **Adversarial Review** — independent review follows the current graph and role contracts
14. **Continuous Lessons** — capture process observations and feed them back into the system

## Steps

Applying the principles to a new agent or skill:

1. **Read the canonical principles** before applying this decision framework
2. **For each design decision**, ask which principles apply (typically 2–3 will dominate)
3. **Run the per-principle test** listed in [Principle Details](#principle-details)
4. **Where a principle conflicts with an implementation choice**, change the implementation — principles are non-negotiable
5. **Document proposed deviations** in an ADR; an ADR does not authorize relaxing safety or approval gates

## Principle Details

Each principle has a non-negotiable rule and a quick test for compliance. The
canonical detail (full text + per-principle tests + the "How to Apply These
Principles" section for agents, contributors, and code review) lives in
[`references/principles.md`](references/principles.md). The summary list above
is a one-line index; for any decision-making use, load the reference. The
reference is canonical. Sync this index after an approved reference change;
never silently remove unique rules or treat prose as permission to bypass a gate.

## Reference Index

| Reference                                              | When to Load                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| [`references/principles.md`](references/principles.md) | Applying a principle to a specific design or implementation decision; running the per-principle compliance test |
