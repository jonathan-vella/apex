---
title: "Install the vNext Preview"
description: "Pack and install a clean local APEX vNext release, then initialize managed customizations."
sidebar:
  order: 2
---

Install the preview from locally built npm tarballs when testing the current repository source. The release manifest
records each package filename, dependency set, byte size, and SHA-256 digest.

## Build the Workspace Release

From the APEX repository root:

```bash
npm ci
npm run pack:vnext
```

The pack script builds the vNext workspaces, checks generated schemas, recreates `dist/vnext-packages/`, and writes
`release-manifest.json`. Keep all generated runtime tarballs together; the CLI package depends on the matching
contracts, kernel, capabilities, and renderers packages.

## Install into a Clean Repository

Create a consumer repository outside the APEX source tree, then install every tarball in one npm operation:

```bash
mkdir apex-vnext-consumer
cd apex-vnext-consumer
git init
npm init --yes
npm install --ignore-scripts --no-audit --no-fund \
  /path/to/apex/dist/vnext-packages/*.tgz
npx apex version --json
```

Use the versions and digests in `release-manifest.json`; do not copy an exact release version into scripts or prose.
For a package-registry candidate, publish the same qualified package set to the approved registry and install the CLI
from that release channel. Registry publication is a release operation, not required for local preview qualification.

## Initialize Managed Customizations

Initialize one project and one environment-scoped run:

```bash
npx apex init --project demo --name "Demo workload" \
  --environment dev --target local --iac bicep --json
```

By default, `apex init` installs the customization bundle embedded in the CLI. It materializes workspace agents and
skills under `.github/`, writes `.vscode/mcp.json`, creates the `.apex` runtime and project state, and records managed
file hashes in `.apex/customizations.lock.json`.

Use `--customizations-source /absolute/path` only when testing a deliberate local bundle override. The same flag on
`apex update` performs a three-way managed-file update. A modified managed file is never silently replaced; resolve the
reported conflict or restore the recorded base before retrying.

## Verify Discovery

1. Run `npx apex doctor --json` and address actionable checks.
2. Open the consumer repository in a supported VS Code release.
3. Confirm the visible `APEX` agent and its interactive specialists are available.
4. Confirm the workspace MCP server starts from `.vscode/mcp.json`.
5. Ask `APEX` for status and verify that it reads kernel state rather than inferring progress from chat.

Continue with the [workflow](./workflow/) or run the full [qualification checklist](./testing/).
