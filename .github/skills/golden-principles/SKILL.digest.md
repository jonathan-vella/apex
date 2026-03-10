<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Golden Principles (Digest)

Compact reference — 10 operating principles for all agents.
Read full `SKILL.md` for detailed explanations and application guidance.

## The 10 Principles

| #   | Principle                                 | One-Line Summary                                            | Test                                                   |
| --- | ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Repository Is the System of Record        | All context lives in-repo, not in chat history              | Can a new session reconstruct context from repo alone? |
| 2   | Map, Not Manual                           | Instructions point to deeper sources; never dump everything | Does each file stay under 200 lines?                   |
| 3   | Enforce Invariants, Not Implementations   | Set boundaries, allow autonomous expression                 | Rules as constraints, not scripts?                     |
| 4   | Parse at Boundaries                       | Validate inputs/outputs at module edges                     | Agent checks prerequisites before starting?            |
| 5   | AVM-First, Security Baseline Always       | Prefer AVM modules; apply TLS/HTTPS/MI to all               | Every resource checked against AVM?                    |
| 6   | Golden Path Pattern                       | Use shared skills over hand-rolled helpers                  | Duplicate conventions consolidated?                    |
| 7   | Human Taste Gets Encoded                  | Feedback → rules, not ad-hoc fixes                          | Lesson encoded into instruction/skill?                 |
| 8   | Context Is Scarce                         | Every token must earn its keep                              | Agent loads ≤5 instructions? Skills on-demand?         |
| 9   | Progressive Disclosure                    | Start small, point to deeper docs                           | Basic task needs only AGENTS.md + 1 skill?             |
| 10  | Mechanical Enforcement Over Documentation | If a rule can be a linter, make it one                      | Corresponding validator in scripts/?                   |

## How to Apply

- **Agents**: Read this first, use as decision framework when uncertain
- **Contributors**: Check Principles 2, 7, 10 before adding content
- **Code Review**: Check Principles 6, 8, 3 for each change
