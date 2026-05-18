---
title: "Debug Log Export"
description: "Export Copilot custom-agent debug logs for APEX review"
sidebar:
  order: 9
---

The `/apex-debug-log-export` prompt bundles Copilot debug logs from an APEX chat
session into `.apex-logs/`. Use it when you need to share enough evidence to
review agent behavior, tool calls, skill loading, token use, or context bloat.

The prompt creates the archive locally. It never uploads the bundle for you; you
review and upload the archive manually.

## How Debug Logs Are Enabled

The dev container enables Copilot Chat debug-file logging through
`.devcontainer/devcontainer.json`:

```text
github.copilot.chat.agentDebugLog.fileLogging.enabled: true
```

After you start a chat, VS Code creates a debug-log directory under:

```text
~/.vscode-server/data/User/workspaceStorage/<wsId>/GitHub.copilot-chat/debug-logs/<sessionId>/
```

The active session directory is also exposed as `$VSCODE_TARGET_SESSION_LOG`.
The export prompt uses that value to locate the workspace debug-log root, then
asks which session should be bundled.

:::tip[Capturing a full APEX run]
Use `/clear` between workflow steps to start each step with a fresh chat
context. When the run is ready to export, invoke `/apex-debug-log-export` and
select the older-session option so the bundle includes the related sessions.
:::

Outside the dev container, enable
`github.copilot.chat.agentDebugLog.fileLogging.enabled` in VS Code settings and
restart VS Code.

## What The Bundle Contains

Each session directory can include these debug artifacts:

| File                     | Contents                                      |
| ------------------------ | --------------------------------------------- |
| `main.jsonl`             | Turn records, tools, files loaded, and timing |
| `system_prompt_*.json`   | System prompt material sent for each turn     |
| `tools_*.json`           | Tool schemas available during the session     |
| `models.json`            | Model selection details                       |
| `categorization-*.jsonl` | Intent-classification signals                 |
| `title-*.jsonl`          | Chat-session title generation                 |

The most useful file for APEX agent review is `main.jsonl`. It shows when
`.github/agents/*.agent.md` files were loaded, which skills were read, which
tools were called, and what `apex-recall` returned.

## How Custom-Agent Lines Are Filtered

The prompt derives a filter from repository state instead of relying on a static
list. The filter includes:

- Agent file paths from `.github/agents/*.agent.md`.
- Agent registry keys from `tools/registry/agent-registry.json`.
- Indirect signals such as `.github/skills/`, `.github/instructions/`,
  `apex-recall`, and agent chat-participant mentions.

For each captured `main.jsonl`, the prompt writes a corresponding
`*.custom-agents.jsonl` containing only matching lines. The filtered file is the
fastest place to inspect custom-agent activity.

## Running The Prompt

In Copilot Chat, type:

```text
/apex-debug-log-export
```

The prompt will:

1. Enumerate Copilot debug-log sessions for the workspace.
2. Ask which session to bundle and whether to include optional sources.
3. Filter `main.jsonl` down to custom-agent activity.
4. Redact common token and connection-string patterns from filtered output.
5. Write a `MANIFEST.json` with file names and sizes.
6. Compress the bundle under `.apex-logs/` as a `.tar.gz` file.
7. Print the archive path and manual upload checklist.

The `.apex-logs/` directory is ignored by git on first run.

## Moving The Archive To OneDrive

### VS Code Explorer

1. In the VS Code Explorer, expand `.apex-logs/`.
2. Right-click the generated `.tar.gz` file and choose **Download...**.
3. Save the archive locally.
4. Open the OneDrive for Business share link in your browser.
5. Drag the archive into the browser window.

### Docker Copy

From a local terminal outside the dev container:

```bash
docker ps --format '{{.Names}}'
ARCHIVE=/workspaces/azure-agentic-infraops/.apex-logs/<bundle>.tar.gz
docker cp <container-name>:"$ARCHIVE" ~/Downloads/
```

Then upload the file from `~/Downloads/`.

## Before Uploading

:::caution[Review sensitive content]
The bundle preserves the raw `main.jsonl` for auditability. Review the archive
before upload if the chat included subscription IDs, connection strings, keys,
or other sensitive values. Filtered custom-agent files are redacted for common
secret patterns, but raw session files are not modified.
:::

## Related

- [Dev Container Hygiene](../devcontainer-hygiene/) — reduce context bloat
  before running agents
- [Session Debugging](../session-debugging/) — diagnose workflow state and
  resume issues
- [Repository Slash Prompts](../prompt-guide/repository-prompts/) — understand
  the built-in slash prompts
