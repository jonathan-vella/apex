---
title: "APEX vNext Preview"
description: "Preview the kernel-led APEX workflow without changing the supported v1 experience."
sidebar:
  order: 1
---

APEX vNext Preview is an isolated, pre-cutover implementation of a deterministic TypeScript kernel, an `apex` CLI,
and managed workspace customizations for VS Code. Use it to evaluate the new workflow contract in a disposable or
non-production repository.

:::caution[Preview, not cutover]
v1 remains the supported APEX experience. This section does not announce a release, migration, or support cutoff, and
vNext does not import v1 sessions or artifacts. Keep existing projects on their current v1 path.
:::

## Check Preview Status

The preview currently includes:

- A packaged CLI, deterministic kernel, contracts, capability adapters, renderers, and managed VS Code customizations.
- Repository-backed runs, constrained tasks, review and gate state, promotion, evidence, cache, and writer transfer.
- A deterministic fake provider plus native local Bicep and Terraform preview, apply, destroy, and inventory paths.
- Stable JSON envelopes, typed error codes, and narrow MCP tools for agents.
- Deterministic qualification lanes and a clean consumer-package installation test.

The preview does not qualify production Terraform CI saved-plan transport. Use local exact-plan operations only. The
optional VS Code agent-plugin distribution path is also not a preview dependency; `apex init` installs workspace-native
customizations under supported discovery paths.

## Choose Your Next Action

- [Install the preview](./installation/) in a clean local consumer repository.
- [Follow the workflow](./workflow/) through specialists, workers, gates, and promotion.
- [Use the CLI and MCP reference](./cli-reference/) for the implemented control surface.
- [Review the security model](./security/) before accepting evidence or running providers.
- [Operate a local run](./operations/) with setup, preview, deployment, and recovery commands.
- [Qualify the preview](./testing/) before sharing results or enabling an Azure sandbox.

## Stay Inside the Support Boundary

Treat the vNext package set and customization bundle as one compatible preview unit. Do not mix their generated
tarballs with another build or manually edit `.apex` state. Do not bypass Gate 4 with native provider commands or commit
secrets, Terraform state, or saved plan files.

Report preview defects with the command, JSON error envelope, repository commit, selected project and run, and
redacted evidence. Continue to use the existing site sections for v1 setup, workflow, and production guidance.
