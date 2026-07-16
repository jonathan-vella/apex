---
title: "Qualify the vNext Preview"
description: "Run deterministic qualification lanes and a manual VS Code and Azure sandbox checklist."
sidebar:
  order: 7
---

Qualify the exact source commit and package set you intend to evaluate. Deterministic lanes require no Azure
credentials or model calls; manual qualification covers VS Code interaction and optional Azure sandboxes.

## Run the Full Qualification

From the APEX repository root:

```bash
npm ci
npm run qualify:vnext
```

This runs runtime/config validation, workspace build and package tests, validator tests, and the package pack plus clean
consumer-install test.

## Run an Individual Lane

Use the narrowest lane while diagnosing a failure:

```bash
npm run validate:vnext
npm run test:vnext
npm run test:vnext-validator
npm run test:vnext-pack
npm run lint:vnext
```

`test:vnext-pack` builds tarballs, verifies manifest digests and package contents, installs the runtime package set into
a clean npm project, runs `apex version`, initializes a project, and verifies managed customization hashes.

The package test suite also exercises deterministic fake-provider scenarios for both Bicep and Terraform tracks. Use
the fake provider for repeatable preview, approval, apply, destroy, restart, and inventory checks without Azure access.

GitHub Environment approval tests cover process-context derivation, local and malformed input rejection, canonical
recipient construction, default TTY compatibility, strict approval schemas, accepted writer-transfer success, preview
expiry bounds, encrypted approval-environment handoff, and adversarial actor, owner, epoch, repository, ref, commit,
workflow, environment, and recipient mismatches. These tests do not constitute live proof of GitHub Environment
protection or reviewer behavior.

Transfer authorization tests also cover stable semantic dependency revisions, sender lease mismatch without orphaned
claims or events, authenticated ownership lineage, transfer-after-preview ordering, exact one-hop success, wrong or
missing claim hashes, nonconsecutive and second-hop epochs, tampered lineage, post-preview dependency drift, and
superseded previews. Native Terraform tests preview as one writer, encrypt for the planned recipient, and apply as that
recipient only after the exact claim-bound transfer. Encrypted state tests resume in a fresh workspace, accept the
post-preview claim, approve Gate 4, and deploy the imported exact preview. Lease tests cover same-epoch retry after a
failed mutation, pending-transfer rejection, expiry, and journal compare-and-swap.

Native Bicep tests cover an absent first stack, unrelated stacks, exact selection, malformed and duplicate list output,
wrong resource-group IDs, pre-apply empty-state binding, and post-apply inventory. No setup mutation is needed before the
approved deployment-stack create command.

Gate 4 supersession tests cover expired preview refresh and an apply-to-destroy sequence on one run. They verify that
the reduced gate returns to open, old approval cannot authorize the new preview, old preview hashes are stale, and a new
exact approval is required before destroy.

## Bind Live Evidence

After deterministic qualification passes, create an unavailable-by-default record with `npm run live:vnext`. The record
binds every later manual result to the current commit, package lock, release manifest, runtime bundle, and evidence
manifest. Follow [Record vNext Live Qualification](../live-qualification/) to create, update, validate, and render it.

## Complete the Manual VS Code Checklist

Use a fresh consumer repository and a supported VS Code release. Record pass/fail evidence for each action:

- Install the freshly packed runtime tarballs and run `apex init` with the default managed customization bundle.
- Confirm `APEX` and the interactive Requirements, Architect, Planner, and Operator specialists are visible.
- Start with `APEX`; confirm it reads status and directly hands requirements to `APEX Requirements`.
- Confirm Requirements uses `vscode/askQuestions` for missing workload decisions and submits through MCP.
- Confirm direct handoff to the configured Opus Architect and Planner paths for higher-tier interactive work.
- Confirm CodeGen, Reviewer, and Validator remain hidden workers on their configured standard model tier.
- Exercise MCP `status`, `nextTask`, `taskContext`, `stageArtifact`, `stageFile`, and `generateIac` as tasks allow.
- Restart VS Code and resume from repository state without relying on prior conversation history.
- Approve each named logical gate only after its accepted artifacts, review, and validation are visible.
- Run the fake provider through preview, Deployment Preview approval, deploy, inventory, destroy, and reconcile.
- Optionally repeat apply and destroy in isolated real Bicep and Terraform sandboxes with nonsecret provider config.

See the [VS Code custom agents documentation][vscode-custom-agents] for product-level discovery and handoff behavior.
Record the results with the [live qualification procedure](../live-qualification/); the checklist alone is not release
evidence.

## Capture Expected Evidence

Keep the source commit, package `release-manifest.json`, `qualify:vnext` output, `apex version --json`, redacted doctor
output, selected project/run IDs, journal head, preview and approval hashes, operation result, inventory, and manual
checklist verdicts. For real sandboxes, also capture provider versions, target scope, backend mode, and cleanup result.

Expected deterministic behavior includes stable JSON envelopes, byte-identical replay views, stale task and preview
rejection, managed-file conflict refusal, fake dual-track completion, and successful restart/resume.

## Record Known Limitations

- vNext is a preview and does not import v1 sessions or artifacts.
- Production CI encrypted Terraform saved-plan transport is not qualified; local exact-plan operation is the supported
  preview path. GitHub Environment Gate 4 evidence is implemented and deterministically tested, but production CI stays
  blocked until the protected-environment and separate preview/apply writer sequence has live proof on the release
  candidate. No production workflow YAML is enabled by this implementation.
- The optional VS Code agent-plugin distribution path is not required or qualified for this preview.
- Kernel authority does not extend to VS Code conversation history or system context.
- Real Azure tests may incur cost and require sandbox governance, credentials, quotas, and cleanup ownership.

[vscode-custom-agents]: https://code.visualstudio.com/docs/copilot/customization/custom-agents
