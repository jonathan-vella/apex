# Tests

Deterministic regression tests for APEX tooling, validators, hooks, and workflow contracts.

## Directory Structure

```text
tools/tests/
  exec-plans/              # Execution plans and tech-debt tracking
    active/                # In-progress plans
    completed/             # Finished plans
  fixtures/                # Validator and tooling regression fixtures
  lib/                     # Shared helper and retirement regressions
  python-diagrams/         # Shared diagram helper tests
  scripts/                 # Node and Python tooling contract tests
  test-hooks.sh            # Agent hooks test script
```

## Quick Start

```bash
npm run test:tool-contracts
npm run test:validator-runner
npm run test:devcontainer-verdicts
npm run test:apex-recall
```

Use the smallest suite covering a change. These tests do not establish native agent discovery,
model availability, generated-output quality, or deployment readiness.
Production artifact Markdown validation remains owned by the commit hook and Challenger review.

## Ownership And Explorer Checks

```bash
node --test tools/tests/scripts/test_skill_ownership.mjs tools/tests/generate-explorer-graph.test.mjs
```

The ownership tests check procedure destinations, skill indexes, Local adapter links,
canaries, trackability, and preserved review modes. Published docs maintenance belongs to
`jonathan-vella/apex-docs`; authoring assessments belong to `apex-agent-authoring`.
Context audits and log/runtime procedures stay in `apex-context-management`.

Explorer fixtures check invocation defaults and explicit flags for agents, workers, and skills.
Only the Explorer graph schema describes this metadata; artifact schemas are unchanged.
`context: null` means no declared context override, not verified harness support.
Skills continue to inherit the caller's model/tools.

## E2E Retirement

The autonomous RALPH evaluation subsystem is retired. Its runner, launch and analysis prompts,
scoring scripts, exclusive fixtures, and scheduled workflow are no longer supported entry points.
The public `e2e:validate`, `e2e:benchmark`, `e2e:combine`, and `test:lib-e2e` npm commands
are removed without compatibility wrappers. Use the production workflow with human approval gates
for manual acceptance; deterministic tests are not a replacement autonomous harness.

The retirement regression lives in [lib/npm-script-graph.test.mjs](lib/npm-script-graph.test.mjs)
and runs under `test:validator-runner`. It rejects retired files and commands while preserving
production lesson compatibility, recall, artifact/policy/security validators, and devcontainer tests.

Historical outputs and baselines remain unchanged. The lesson schema retains historical
`workflow_mode: "e2e"` records, and the iteration-log schema remains historical compatibility evidence.
Production lesson collection and `report:challenger-gaps` remain supported.

Any approved rollback must restore the coupled runner, prompts, scripts, tests, npm commands, discovery
configuration, and workflow together from the pre-retirement revision. Do not rewrite historical outputs.

## Related

- [Repository conventions](../../AGENTS.md)
- [Validation reference](https://apexops.pro/reference/validation-reference/)
