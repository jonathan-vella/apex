<!-- ref:debug-log-export-v2 -->

# Export Native Copilot SDK Logs

Use the GitHub Copilot SDK harness **inside VS Code**. The manual entry skill is
[apex-debug-log-export](../../apex-debug-log-export/SKILL.md); it inherits the
selected owner's permissions and cannot bind a model or widen tools.
Require `ask_user`, shell execution and read access. Do not delegate this operation.

## Scope And Consent

Native events live under `~/.copilot/session-state/<session-id>/events.jsonl`.
Discover sessions by their `session.start.data.context.gitRoot` (or exact `cwd`),
not a hardcoded workspace, Local environment variable, title or newest global session.
List candidates, then ask the user to select explicit session IDs. Never auto-select
the current or most recent conversation.

Batch independent choices in one `ask_user` form using `requestedSchema.properties`:

- `sessions`: array of selected session IDs from the workspace-scoped list.
- `include_raw`: boolean, default false; raw events may contain prompts, code and secrets.
- `include_workspace_logs`: boolean, default false; only `logs/copilot/` text logs.
- `transcript`: optional explicit path inside a selected session directory.
- `redact`: boolean, default true; best-effort redaction is **not** a safe-to-share guarantee.

Decline does not confirm a selection; cancellation stops. An empty selection
produces no archive. Optional files and raw capture require explicit consent.
This replaces the Local export's implicit raw capture with an opt-in.
Never collect project artifacts, infrastructure, credentials or dependency trees.

## Procedure

List workspace-scoped sessions:

```bash
python3 tools/scripts/export-sdk-logs.py --list
```

After explicit selection, export the chosen native session:

```bash
python3 tools/scripts/export-sdk-logs.py --session SELECTED_SESSION_ID
```

Repeat `--session` for additional approved sessions. Add `--include-raw`,
`--include-workspace-logs`, `--transcript /absolute/selected-session/transcript.jsonl`
or `--no-redact` only for the corresponding confirmed choices.
No Local `workspaceStorage`, `VSCODE_TARGET_SESSION_LOG` or `ccreq:` discovery applies.

## Outputs And Failure

Archives are local under `.apex-logs/` (gitignored). They include selected,
redacted event copies and `MANIFEST.json` with source session IDs, capture options,
file sizes and hashes. Raw files are included only with `--include-raw`; source
logs are never changed. Workspace text logs and transcripts are opt-in.

Unknown workspace identity, symlinks, cross-session transcript paths, malformed
events or write/archive errors stop explicitly. Failed archive creation retains
its own staging directory for diagnosis and never reports a successful bundle.
Success cleans only that operation's staging directory, not sibling exports.

Show the archive path, selected scope, capture options and limitations. Ask the
user to inspect the contents before sharing. Never upload automatically or request
secret-bearing upload links. An archive is diagnostic data, not proof of routing,
review validity, human approval or deployment success.
