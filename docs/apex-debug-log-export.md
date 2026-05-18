# Exporting custom-agent debug logs (`/apex-debug-log-export`)

This guide covers how to enable Copilot debug logging in the devcontainer,
what information is captured, how to run the export prompt, and how to move
the resulting archive from the devcontainer to OneDrive for Business.

## How debug logs are enabled

No action is required. In this devcontainer, VS Code Copilot Chat writes a
per-session debug log automatically. As soon as you open the devcontainer and
start a chat, a session directory is created at:

```text
~/.vscode-server/data/User/workspaceStorage/<wsId>/GitHub.copilot-chat/debug-logs/<sessionId>/
```text

The active session path is injected as the environment variable
`$VSCODE_TARGET_SESSION_LOG`, so scripts can locate it without scanning the
filesystem.

If you are running VS Code outside a devcontainer and logs are not appearing,
enable them via **VS Code Settings → search "Copilot" → enable
`github.copilot-chat.experimental.logToFile`**, then restart VS Code.

## What is collected

Each session directory contains these files:

| File | Contents |
|---|---|
| `main.jsonl` | Full turn-by-turn record: model, tools called, agent and skill files loaded, token counts, response latency |
| `system_prompt_*.json` | The exact system prompt sent to the model each turn (agent definition + instructions + skills combined) |
| `tools_*.json` | Tool schemas active during the session |
| `models.json` | Model selection per turn |
| `categorization-*.jsonl` | Intent-classification signals used to select the chat participant |
| `title-*.jsonl` | Chat-session title derivation |

The file most useful for reviewing custom-agent behaviour is **`main.jsonl`**.
It shows exactly when your `.github/agents/*.agent.md` files were loaded, which
skills were read on demand, and what `apex-recall` returned.

### How custom-agent activity is identified

The export prompt builds a regex alternation from three sources and uses it to
derive a filtered `*.custom-agents.jsonl` from each `main.jsonl`:

1. **Agent file paths** — every `.github/agents/*.agent.md` filename.
2. **Registry short keys** — `Object.keys(agent-registry.json.agents)`:
   `orchestrator`, `requirements`, `architect`, `design`, `governance`,
   `iac-plan`, `iac-code`, `deploy`, `as-built`, `diagnose`, `challenger`,
   `context-optimizer`, `e2e-orchestrator`.
3. **Indirect signals** — `.github/skills/`, `.github/instructions/`,
   `apex-recall`, and `@AgentName` chat-participant mentions.

A raw session `main.jsonl` for a four-hour session is typically 60–80 MB.
The filtered file is usually 5–15% of that size.

## Using the export prompt

In Copilot Chat, type:

```text
/apex-debug-log-export
```text

To include a OneDrive share link in the printed upload instructions, pass it
as the argument:

```text
/apex-debug-log-export https://contoso-my.sharepoint.com/:f:/...
```text

The prompt will:

1. Locate the active session debug-log directory from `$VSCODE_TARGET_SESSION_LOG`.
2. Ask (one question, multi-select) whether to include older sessions, the
   transcript JSONL, or the `logs/copilot/` workspace logs.
3. Filter `main.jsonl` down to custom-agent lines using the registry-derived regex.
4. Redact common secret patterns (GitHub tokens, Bearer tokens, connection-string
   account keys) from the filtered output only. Raw `main.jsonl` is never modified.
5. Write a `MANIFEST.json` listing every file and its size.
6. Compress the bundle as `.apex-logs/apex-debug-<UTC-timestamp>-<sessionShort>.tar.gz`.
7. Print the archive path and a manual upload checklist.

The `.apex-logs/` directory is automatically added to `.gitignore` on first run.
The prompt model is `GPT-5.4 mini`.

## Moving the archive from devcontainer to OneDrive

### Option A — VS Code Explorer (no command line)

1. In the VS Code Explorer sidebar, expand `.apex-logs/`.
2. Right-click the `.tar.gz` file → **Download…**
3. Save it to your local machine.
4. Open the OneDrive for Business share link in your browser.
5. Drag the file into the browser window to upload.

### Option B — `docker cp` from your local terminal

```bash
# List running containers to get the container name
docker ps --format '{{.Names}}'

# Copy the archive to your local machine
docker cp <container-name>:/workspaces/azure-agentic-infraops/.apex-logs/<bundle>.tar.gz ~/Downloads/
```text

Then upload from `~/Downloads/` via the share link in your browser.

## Before uploading

The bundle includes the raw `main.jsonl` (unredacted). Review it briefly if
your chat session referenced subscription IDs, connection strings, or other
sensitive values. The filtered `*.custom-agents.jsonl` files are automatically
scrubbed of common secret patterns, but the raw session tree is preserved
verbatim for auditability.
