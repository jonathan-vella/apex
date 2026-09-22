---
title: "Workflow Validation"
description: "Validate production workflow contracts and perform manual acceptance after E2E harness retirement"
---

Use deterministic checks for source contracts and the production workflow for human-reviewed acceptance.
Passing a source check does not prove native agent discovery, model availability, or generated-output quality.

## Run Focused Checks

```bash
npm run test:tool-contracts
npm run test:validator-runner
npm run test:apex-recall
npm run test:devcontainer-verdicts
```

Select the suite that covers the changed behavior. Production artifact, policy, security, and review validators
remain available in the [validation reference](../../reference/validation-reference/).
Artifact Markdown validation belongs to the commit hook and Challenger review.

## Perform Manual Acceptance

Start with `01-Orchestrator` and retain human approval gates on both Bicep and Terraform tracks.
Verify fresh and resumed workflows, required reviews, handoffs, and recovery from failed validation.
Architecture requires both its comprehensive review and an independent cost-feasibility review.
Missing evidence or blocking findings must be resolved before advancing.

Check Local and Agent Host discovery and model selection separately. Offline source tests cannot certify
native harness behavior. Azure operations and deployment still require their normal authorization and checks.

## Migrate From The Retired Harness

The autonomous RALPH E2E subsystem is no longer supported. Its orchestrator, dedicated launch and analysis
prompts, benchmark scripts, exclusive fixtures, and scheduled workflow are retired.
The `e2e:validate`, `e2e:benchmark`, `e2e:combine`, and `test:lib-e2e` npm commands are removed
without replacement wrappers. Do not use old launch instructions to bypass production approvals.

Existing archives, baselines, and agent outputs remain unchanged. Production lessons and recall remain supported;
the lesson schema still accepts historical `workflow_mode: "e2e"` records.
The iteration-log schema is retained as historical compatibility evidence, not a new workflow requirement.

For an explicitly approved rollback, restore the coupled agent, prompts, scripts, tests, commands, discovery
configuration, and CI workflow from the pre-retirement revision together. Do not rewrite historical evidence.

## Related

- [Quickstart](../../getting-started/quickstart/) — install and run your first project
- [Workflow](../../concepts/workflow/) — how agents collaborate across steps
- [Troubleshooting](../troubleshooting/) — diagnose failed deploys
