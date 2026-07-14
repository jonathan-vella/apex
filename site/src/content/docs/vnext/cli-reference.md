---
title: "vNext CLI and MCP Reference"
description: "Use every implemented APEX vNext CLI command and narrow MCP tool with stable JSON handling."
sidebar:
  order: 4
---

Run `apex <command> --json` for automation. Success is written to stdout as
`{"ok":true,"result":...}`. Failure is written to stderr as
`{"ok":false,"error":{"code":"...","message":"...","details":...}}`.

## Handle Stable Errors

| Exit | Error code | Meaning |
| ---- | ---------- | ------- |
| `0` | Success | The command completed. |
| `2` | `APEX_USAGE` | A command, flag, or input shape is invalid. |
| `3` | `APEX_NOT_FOUND` | The selected resource or artifact does not exist. |
| `4` | `APEX_CONFLICT` | A managed file or staged output conflicts with current content. |
| `5` | `APEX_VALIDATION` | A schema, policy, provider, or task constraint failed. |
| `6` | `APEX_STALE` | A hash, task, preview, lease, epoch, or Git head is no longer current. |
| `7` | `APEX_AUTHORIZATION` | The requested transition lacks an approval or capability grant. |
| `10` | `APEX_INTERNAL` | An unexpected failure was normalized at the CLI boundary. |

## Use Implemented CLI Commands

| Command | Required or notable flags | Purpose |
| ------- | ------------------------- | ------- |
| `apex version` | `--json` | Report CLI, customization bundle, and config versions. |
| `apex init` | `--project`; see initialization flags below | Initialize project state and customizations. |
| `apex update` | Optional `--customizations-source` | Three-way update managed workspace files. |
| `apex setup` | Optional `--live` | Run readiness checks; live mode checks Azure CLI authentication. |
| `apex doctor` | Optional `--fix --yes` | Diagnose setup and optionally repair managed files and the runtime lock. |
| `apex project list` | None | List initialized projects. |
| `apex project use` | `--project`; optional `--run` | Select a project and run. |
| `apex project show` | Optional `--project` | Show a project or the current project and run. |
| `apex project search` | `--query` | Search project identity and journal event content. |
| `apex project history` | Optional `--limit` | Read recent selected-run events. |
| `apex status` | None | Read selected-run state, journal head, task, and blockers. |
| `apex task next` | None | Request the next constrained task or required input. |
| `apex task context` | `--task` | Read a task envelope, accepted inputs, staging root, and blockers. |
| `apex task complete` | `--task --file`; see output flags below | Accept one output or repeated files. |
| `apex task complete-bundle` | `--task --file` | Accept `outputs[]` from one JSON bundle. |
| `apex task cancel` | `--task` | Cancel an issued task. |
| `apex task stage-file` | `--task --path --file`; optional `--sha` | Stage an allowed code-generation file. |
| `apex task generate-iac` | `--task` | Generate the selected IaC track in the bounded staging tree. |
| `apex review resolve` | `--review --resolution` | Record a review-finding resolution. |
| `apex gate decide` | `--gate --decision --actor` | Approve or reject an open gate. |
| `apex validate` | None | Validate and cache the current journal/runtime-lock result. |
| `apex preview` | `--operation --provider`; see values below | Create a bound preview and open Gate 4. |
| `apex deploy` | Optional `--preview` | Execute the current approved preview and collect inventory. |
| `apex reconcile` | None | Reconcile the recorded deployment from inventory. |
| `apex inventory` | None | Read the latest deployment inventory. |
| `apex diagnose` | None | Return selected-run status and doctor results. |
| `apex render` | `--kind`; see values below | Render a deterministic Markdown view. |
| `apex promote` | `--environment --target` | Create and select a linked environment run. |
| `apex writer transfer-create` | See writer flags below | Create a bound writer-transfer claim. |
| `apex writer transfer-accept` | `--claim --recipient --head` | Accept a current writer-transfer claim. |
| `apex writer show` | None | Show current writer ownership. |
| `apex evidence accept` | `--kind --content-type`; see input flags below | Validate and accept evidence. |
| `apex telemetry consent` | `--value` true/false | Set optional telemetry consent. |
| `apex telemetry export` | None | Export accepted telemetry or `null`. |
| `apex telemetry delete` | None | Delete optional telemetry. |
| `apex cache status` | None | Count deterministic cache entries. |
| `apex cache clear` | None | Invalidate the deterministic cache. |
| `apex mcp serve` | None | Serve the APEX MCP protocol over standard input/output. |

The compact rows above expand to these exact accepted flags and values:

```text
init: --project; optional --name, --environment, --target, --iac, --customizations-source
task complete: --task, --file; single output also needs --kind; optional --summary
preview: --operation apply|destroy --provider fake|bicep|terraform
render: --kind status|requirements|preview|approval|inventory
writer transfer-create: --repo --branch --commit --workflow --sender --recipient --head --ttl
evidence accept: --kind --content-type and exactly one of --file or --value; optional --required
```

## Use Narrow MCP Tools

The managed agents receive only tools declared in their definitions. The MCP server implements these exact names:

| Tool | Input |
| ---- | ----- |
| `status` | None |
| `nextTask` | None |
| `taskContext` | `taskId` |
| `recordRequirementsInput` | `value` |
| `stageArtifact` | `taskId` plus `kind`/`value` or `outputs[]`; optional summaries |
| `stageFile` | `taskId`, safe relative `path`, and `content`; optional `expectedSha` |
| `generateIac` | `taskId`; optional existing resources, provider constraints, and lock content |
| `validateTask` | `taskId`; optional single output or `outputs[]` |
| `completeTask` | `taskId` plus a single output or `outputs[]` |
| `reviewResolve` | `reviewId`, `resolution` |
| `gateDecide` | `gate`, approved/rejected decision, and `actor` |
| `preview` | apply/destroy operation and fake/bicep/terraform provider |
| `deploy` | Optional `previewHash` |
| `reconcile` | None |
| `inventory` | None |
| `diagnose` | None |
| `render` | status/requirements/preview/approval/inventory kind |
| `promote` | `environment`, `target` |
| `doctor` | Optional `fix`, `yes` |
| `submitEvidence` | `taskId`, `kind`, JSON object `value`; optional `required` |

Tool results contain both JSON text content and structured content. Agents should pass hashes and task IDs exactly as
returned rather than reconstructing them from prose.

## Follow Safe Examples

```bash
apex status --json
apex task next --json
apex preview --operation apply --provider fake --json
apex gate decide --gate 4 --decision approved --actor local-user --json
apex deploy --preview "$PREVIEW_HASH" --json
```

See [operations](../operations/) for native provider configuration and [security](../security/) before deployment.
