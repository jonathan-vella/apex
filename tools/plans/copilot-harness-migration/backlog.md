## Backlog: VS Code Copilot-only migration

**Status: OWNER PLAN APPROVED; EXECUTION AUTHORIZED.**
The 2026-10-18 10:18 UTC owner message permits implementation and scoped Azure E2E.
See [execution status](execution-status.md); deployment scope and tool permissions remain independent constraints.
Delivery: [APEX #779](https://github.com/jonathan-vella/apex/pull/779) and
[jonathan-vella/apex-docs#43](https://github.com/jonathan-vella/apex-docs/pull/43).
The [PRD](prd.md), [roadmap](roadmap.md), [assessment adoption](assessment-adoption.md) and
[execution contract](execution-contract.md) govern this proposed delivery, not current production execution.
The owner intentionally retired runtime hooks. CHM-05 closes their callers; no deleted-hook compatibility
or replacement guardian is required. Current actual progress and limitations are in [execution status](execution-status.md).

### Historical work: retain completion, do not reuse as candidate acceptance

| Packet                                                                 | Existing issue                                            | Disposition                                               |
| ---------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| [CHM-01: original CI formatting](issues/CHM-01-ci-format.md)           | [#769](https://github.com/jonathan-vella/apex/issues/769) | CLOSED historical; preserve result                        |
| [CHM-02: original source baseline](issues/CHM-02-source-acceptance.md) | [#771](https://github.com/jonathan-vella/apex/issues/771) | CLOSED historical; CHM-17 owns fresh candidate acceptance |

### Essential compatibility and pilot

| Packet                                                                      | Existing issue                                            | Dependencies            | State                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| [CHM-09: assessment dispositions](issues/CHM-09-assessment-dispositions.md) | [#780](https://github.com/jonathan-vella/apex/issues/780) | Owner approval recorded | Selected prerequisite slice resolved                         |
| [CHM-03: native runtime capabilities](issues/CHM-03-worker-readiness.md)    | [#773](https://github.com/jonathan-vella/apex/issues/773) | CHM-09                  | Re-scoped; runtime unverified                                |
| [CHM-05: MCP and hook retirement](issues/CHM-05-mcp-hooks.md)               | [#775](https://github.com/jonathan-vella/apex/issues/775) | CHM-09                  | Retirement/source checks pass; live capability scope partial |
| [CHM-10: genuine approval boundary](issues/CHM-10-approval-boundary.md)     | [#781](https://github.com/jonathan-vella/apex/issues/781) | CHM-03, CHM-05          | Planned                                                      |
| [CHM-04: representative no-cloud pilot](issues/CHM-04-workflow-smoke.md)    | [#772](https://github.com/jonathan-vella/apex/issues/772) | CHM-03, CHM-05, CHM-10  | Blocked                                                      |

### Simplification and retirement

All rows require CHM-04's evidenced pilot acceptance. The owner delegated progression when criteria pass;
do not invent another human sign-off. A declared role is not a requirement to create an agent.

| Packet                                                                              | Existing issue                                            | Dependencies                           | State   |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- | ------- |
| [CHM-15: instruction/validator authority](issues/CHM-15-instructions-validators.md) | [#786](https://github.com/jonathan-vella/apex/issues/786) | CHM-04                                 | Planned |
| [CHM-11: lead and domain skills](issues/CHM-11-lead-domain-skills.md)               | [#782](https://github.com/jonathan-vella/apex/issues/782) | CHM-15                                 | Planned |
| [CHM-12: deterministic adapters](issues/CHM-12-deterministic-adapters.md)           | [#783](https://github.com/jonathan-vella/apex/issues/783) | CHM-11                                 | Planned |
| [CHM-13: independent review path](issues/CHM-13-review-consolidation.md)            | [#784](https://github.com/jonathan-vella/apex/issues/784) | CHM-15                                 | Planned |
| [CHM-14: durable project state](issues/CHM-14-durable-state.md)                     | [#785](https://github.com/jonathan-vella/apex/issues/785) | CHM-13                                 | Planned |
| [CHM-16: caller-complete retirement](issues/CHM-16-retirement-callers.md)           | [#787](https://github.com/jonathan-vella/apex/issues/787) | CHM-11, CHM-12, CHM-13, CHM-14, CHM-15 | Planned |

### Evidence, E2E and cross-repository delivery

| Packet                                                                | Existing issue                                            | Dependencies                                       | State                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| [CHM-06: evidence and optional usage](issues/CHM-06-observability.md) | [#768](https://github.com/jonathan-vella/apex/issues/768) | CHM-16                                             | Re-scoped; old strict PASS withdrawn       |
| [CHM-17: final VS Code E2E](issues/CHM-17-vscode-e2e.md)              | [#788](https://github.com/jonathan-vella/apex/issues/788) | CHM-05, CHM-06, CHM-16                             | Planned                                    |
| [CHM-18: scoped real-Azure E2E](issues/CHM-18-azure-e2e.md)           | [#789](https://github.com/jonathan-vella/apex/issues/789) | CHM-10, CHM-12, CHM-17; explicit Azure scope       | BLOCKED: target/budget/action scope absent |
| [CHM-07: documentation alignment](issues/CHM-07-published-docs.md)    | [#774](https://github.com/jonathan-vella/apex/issues/774) | CHM-17 for final acceptance; preparation now       | Proposal updates only                      |
| [CHM-08: owner readiness handoff](issues/CHM-08-release-readiness.md) | [#770](https://github.com/jonathan-vella/apex/issues/770) | CHM-07, CHM-17, CHM-18 and applicable predecessors | Blocked                                    |

### Execution and synchronization

- The packet dependency graph above replaces the old CHM-01-to-CHM-08 preservation-only sequence.
- Native GitHub blocking relationships must match this table; remove superseded blockers, not issue history.
- GitHub issue bodies are self-contained mirrors of these packets. Update both when scope changes.
- Most work runs autonomously after approval, including feature-branch updates and review-fix iterations.
- Serialize writers to shared agents, instructions, schemas and registries; use disjoint parallel test/docs lanes.
- Fresh behavior defects stay in the owning packet when in scope; unrelated defects get a bounded follow-up.
- Do not close an issue merely because a PR is opened or a new plan is saved.
- CHM-08 owns the final revision-bound matrix; all required unknowns and review threads remain visible.

### Completion standard

Each packet returns objective, actual input revisions, changed paths, commands/exit codes, positive and negative
results, evidence references, caller/docs closure, rollback considerations and remaining human decisions.
No synthetic telemetry, inferred owner consent, reset counters, restamped history, credential switching,
unscoped Azure changes, deletion, auto-merge or merge into `main`.
CHM-18 is the explicitly authorized real-Azure extension, subject to exact scope and controls.
Optional performance work remains separately scoped.
