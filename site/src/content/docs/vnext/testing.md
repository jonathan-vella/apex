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

## Capture Expected Evidence

Keep the source commit, package `release-manifest.json`, `qualify:vnext` output, `apex version --json`, redacted doctor
output, selected project/run IDs, journal head, preview and approval hashes, operation result, inventory, and manual
checklist verdicts. For real sandboxes, also capture provider versions, target scope, backend mode, and cleanup result.

Expected deterministic behavior includes stable JSON envelopes, byte-identical replay views, stale task and preview
rejection, managed-file conflict refusal, fake dual-track completion, and successful restart/resume.

## Record Known Limitations

- vNext is a preview and does not import v1 sessions or artifacts.
- Production CI encrypted Terraform saved-plan transport is not qualified; local exact-plan operation is the supported
  preview path.
- The optional VS Code agent-plugin distribution path is not required or qualified for this preview.
- Kernel authority does not extend to VS Code conversation history or system context.
- Real Azure tests may incur cost and require sandbox governance, credentials, quotas, and cleanup ownership.

[vscode-custom-agents]: https://code.visualstudio.com/docs/copilot/customization/custom-agents
