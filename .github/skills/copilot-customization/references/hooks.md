<!-- ref:hooks-v1 -->

# Hooks Reference (Preview)

> Source: https://code.visualstudio.com/docs/copilot/customization/hooks
> Last verified: 2026-03-08

> [!WARNING]
> Hooks are a **Preview** feature. The configuration format and behavior may change
> in future VS Code releases. **Always query live docs before generating hook configurations.**

## What Hooks Do

Hooks execute shell commands at agent lifecycle points (pre/post tool use, session
start/stop). They provide deterministic, code-driven automation: block dangerous commands,
run formatters after edits, create audit trails, inject context.

## Stable Invariants

These aspects are unlikely to change significantly:

- **Config format**: JSON files with a `hooks` object containing event arrays
- **Config locations**: `.github/hooks/*.json` (workspace), `.claude/settings*.json`, user `~/.claude/settings.json`
- **Setting**: `chat.hookFilesLocations` controls search paths
- **8 lifecycle events**: `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`
- **Command schema**: Each entry has `type: "command"`, `command`,
  optional OS overrides (`windows`, `linux`, `osx`), `cwd`, `env`, `timeout`
- **I/O protocol**: JSON via stdin (input) and stdout (output); output can set `continue`, `stopReason`, `systemMessage`

## This Repo

Each hook lives in its own folder under `.github/hooks/` (one `hooks.json` + one script per folder):

| Folder                 | Event                                               | Script                      | Purpose                                                       |
| ---------------------- | --------------------------------------------------- | --------------------------- | ------------------------------------------------------------- |
| `tool-guardian/`       | `preToolUse`                                        | `guard-tool.sh`             | Block dangerous commands + hook self-modification protection  |
| `secrets-scanner/`     | `sessionEnd`                                        | `scan-secrets.sh`           | Scan modified files for leaked secrets and credentials        |
| `session-logger/`      | `sessionStart`, `sessionEnd`, `userPromptSubmitted` | `log-session-start.sh` etc. | Log session lifecycle and inject project context              |
| `governance-audit/`    | `sessionStart`, `sessionEnd`, `userPromptSubmitted` | `audit-prompt.sh` etc.      | Scan prompts for threat signals with governance levels        |
| `post-edit-format/`    | `PostToolUse`                                       | `post-edit-format.sh`       | Auto-run `markdownlint` on `.md` and `terraform fmt` on `.tf` |
| `subagent-validation/` | `SubagentStop`                                      | `subagent-validation.sh`    | Validate subagent output quality (advisory)                   |

Hook folder paths are registered in `.vscode/settings.json` via `chat.hookFilesLocations`.

## Get Current Specification

For the full hook configuration schema, event-specific input/output fields, and examples,
query the live documentation:

```text
microsoft_docs_fetch("https://code.visualstudio.com/docs/copilot/customization/hooks")
```

This ensures you generate configurations matching the current Preview API, not a
potentially stale cached version.
