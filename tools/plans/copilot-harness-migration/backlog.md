## Backlog: complete the Copilot harness migration

Baseline: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`, [PR #767](https://github.com/jonathan-vella/apex/pull/767).
Current delivery is [PR #779](https://github.com/jonathan-vella/apex/pull/779).
The earlier all-complete claim is withdrawn: generated files and green fixture tests did not prove live acceptance.
No merge into `main` is authorized. See the [recovery assessment](recovery-assessment.md).
See the [PRD](prd.md), [roadmap](roadmap.md), and [delegation rules](README.md).

### Actionable work

P0 blocks acceptance or release. P1 is required before release but can follow the critical-path preparation.
An agent role is a capability description, not a requirement to create or invoke a new custom agent.

| ID     | Work packet                                                                               | Priority | Current state | Depends on            | Agent capability            |
| ------ | ----------------------------------------------------------------------------------------- | -------- | ------------- | --------------------- | --------------------------- |
| CHM-01 | [Resolve the known CI formatting failure](issues/CHM-01-ci-format.md)                     | P0       | Done (#769)   | None                  | Repository coding agent     |
| CHM-02 | [Reconcile source acceptance and baseline failures](issues/CHM-02-source-acceptance.md)   | P0       | Done (#771)   | CHM-01                | Validation agent            |
| CHM-03 | [Verify custom-agent discovery and worker routing](issues/CHM-03-worker-readiness.md)     | P0       | Partial       | CHM-02                | Autopilot runtime agent     |
| CHM-04 | [Exercise forms, continuation, reviews, and gates](issues/CHM-04-workflow-smoke.md)       | P0       | Blocked       | CHM-03, CHM-05        | Autopilot workflow agent    |
| CHM-05 | [Verify VS Code MCP projection and hook boundaries](issues/CHM-05-mcp-hooks.md)           | P1       | Partial       | CHM-02                | Autopilot environment agent |
| CHM-06 | [Verify native telemetry and scoped export](issues/CHM-06-observability.md)               | P1       | Blocked       | CHM-04                | Telemetry validation agent  |
| CHM-07 | [Publish the harness cutover documentation](issues/CHM-07-published-docs.md)              | P1       | In progress   | CHM-06                | Documentation coding agent  |
| CHM-08 | [Assemble release evidence and recommend disposition](issues/CHM-08-release-readiness.md) | P0       | Blocked       | CHM-01 through CHM-07 | Release evidence agent      |

### GitHub issue register

Each issue body is self-contained and includes its scope, inputs, acceptance criteria, and stop rules.
Dependencies are also registered as native GitHub blocking relationships, not just prose references.

| Packet | GitHub issue                                              |
| ------ | --------------------------------------------------------- |
| CHM-01 | [#769](https://github.com/jonathan-vella/apex/issues/769) |
| CHM-02 | [#771](https://github.com/jonathan-vella/apex/issues/771) |
| CHM-03 | [#773](https://github.com/jonathan-vella/apex/issues/773) |
| CHM-04 | [#772](https://github.com/jonathan-vella/apex/issues/772) |
| CHM-05 | [#775](https://github.com/jonathan-vella/apex/issues/775) |
| CHM-06 | [#768](https://github.com/jonathan-vella/apex/issues/768) |
| CHM-07 | [#774](https://github.com/jonathan-vella/apex/issues/774) |
| CHM-08 | [#770](https://github.com/jonathan-vella/apex/issues/770) |

### Already implemented: verify, do not reimplement

- The feature branch and migration commit exist.
- Local prompt roots are archived and canonical entry skills exist.
- Main/leaf routing definitions, native interaction guidance, and fail-closed readiness tooling exist.
- Native SDK event parsing, smoke verification, export, and regression fixtures exist.

These are source-presence observations, not closed acceptance tasks.
CHM-02 checks contracts and regressions; CHM-03 through CHM-06 supply missing live evidence.
Do not reopen the historical plan as a fresh implementation checklist.

### Dependency and concurrency rules

- CHM-01 is immediately actionable; it does not authorize other migration changes.
- CHM-02 establishes a revision-bound source baseline before live work.
- CHM-03 and CHM-05 may proceed independently after CHM-02 with disjoint evidence outputs.
- CHM-04 requires both verified routing and verified MCP prerequisites.
- CHM-06 consumes the approved workflow capture; it does not invent a replacement fixture.
- CHM-07 may gather documentation inventory earlier, but final acceptance requires verified runtime evidence.
- CHM-08 waits for the complete predecessor evidence set; it cannot close or merge its own prerequisites.
- A code change after evidence collection requires impact assessment and affected checks to be repeated.

### Definition of done for every issue

1. Scope and prerequisites are satisfied at a recorded candidate revision.
2. Every acceptance checkbox has a command result or explicit observed evidence.
3. Commands include exit codes; failed or unavailable checks remain visible.
4. Changes stay within the allowed slice and preserve unrelated user work.
5. Raw logs and credentials are not posted to GitHub.
6. The agent returns outputs, evidence, blockers, and the next human gate.
7. The owner reviews the evidence before issue closure. Assignment is not approval.

Unrelated pre-existing failures require baseline evidence and a separate scoped follow-up or a recorded owner
disposition. They must not be silently converted to a passing migration result.
