---
agent: agent
model: "GPT-5.4 mini"
description: "Extract and compress Copilot debug logs related to custom agent activity into .apex-logs/ as a tar.gz bundle. User uploads the bundle manually to OneDrive via a provided link."
argument-hint: "Optional OneDrive for Business share link to display in the final summary."
tools: [vscode/askQuestions, execute/runInTerminal, read]
---

# Export Custom-Agent Debug Logs (.apex-logs)

Collect Copilot debug logs from this workspace's active session (and
optionally older sessions / workspace logs), filter the main JSONL stream
down to lines that reference **custom agents** in `.github/agents/`,
compress everything into a single `.tar.gz` archive under `.apex-logs/`,
and print a manual upload instruction. **The prompt never uploads —
you upload to OneDrive yourself via a browser**.

## Scope

- Output directory: `.apex-logs/` at the repo root (gitignored).
- Bundle name: `apex-debug-<UTC-timestamp>-<sessionShort>.tar.gz`.
- Default capture: the **active** Copilot debug-log directory only
  (`$VSCODE_TARGET_SESSION_LOG`).
- Opt-in capture: older sessions in the same workspace, the active
  session transcript JSONL, and workspace `logs/copilot/`.
- Filter source for "custom agent" lines: every agent file path under
  `.github/agents/*.agent.md` plus the short keys in
  `tools/registry/agent-registry.json` (`agents` map keys).
- Redaction (default on): strip common secret patterns from the
  filtered JSONL before bundling.
- Never includes `agent-output/`, `infra/`, or `node_modules/`.

## Inputs

| Variable      | Source                              | Default                        |
| ------------- | ----------------------------------- | ------------------------------ |
| session_dir   | `$VSCODE_TARGET_SESSION_LOG`        | active session debug-log dir   |
| include_older | user choice                         | `no`                           |
| include_xcript| user choice (transcript JSONL)      | `no`                           |
| include_ws    | user choice (`logs/copilot/`)       | `no`                           |
| redact        | user choice                         | `yes`                          |
| onedrive_link | argument-hint                       | none (printed only if given)   |

## Workflow

### Step 0 — Resolve paths and verify session

Run these and show the output:

```bash
SESSION_DIR="${VSCODE_TARGET_SESSION_LOG:-}"
if [[ -z "$SESSION_DIR" || ! -d "$SESSION_DIR" ]]; then
  # Fall back to the most recent debug-log directory for this workspace.
  WS_ID="$(basename "$(dirname "$(dirname "$(realpath "${VSCODE_TARGET_SESSION_LOG:-/dev/null}")")" 2>/dev/null)" 2>/dev/null)"
  CANDIDATE_ROOT="$HOME/.vscode-server/data/User/workspaceStorage"
  SESSION_DIR="$(find "$CANDIDATE_ROOT" -type d -path '*/GitHub.copilot-chat/debug-logs/*' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | awk '{print $2}')"
fi
echo "session_dir=$SESSION_DIR"
test -d "$SESSION_DIR" || { echo "ERROR: no Copilot debug-log directory found"; exit 1; }
ls -1 "$SESSION_DIR" | head -10
du -sh "$SESSION_DIR"
```

Stop and report if no directory is found. **Never invent a path.**

### Step 1 — Ask what to capture

Call `vscode/askQuestions` with **one** multiSelect question:

- header: `capture-scope`
- question: `Which extras should the bundle include?`
- options (multi-select, all default off):
  - `Older sessions for this workspace (last 5)`
  - `Active session transcript JSONL`
  - `Workspace logs/copilot/ directory`
  - `Skip redaction (NOT recommended)`

Treat the answer as four booleans. Do **not** ask a second question.

### Step 2 — Build the custom-agent filter list

Derive both the file-path tokens and the short-key tokens that mark
custom-agent activity in `main.jsonl`:

```bash
# File-path tokens (e.g. ".github/agents/01-orchestrator.agent.md")
mapfile -t AGENT_FILES < <(ls -1 .github/agents/*.agent.md 2>/dev/null)

# Short keys from the registry (e.g. "orchestrator", "requirements", ...)
mapfile -t AGENT_KEYS < <(node -e "const r=require('./tools/registry/agent-registry.json'); console.log(Object.keys(r.agents).join('\n'))" 2>/dev/null)

# Combined alternation regex for grep.
FILTER_RE="$(printf '%s\n' "${AGENT_FILES[@]}" "${AGENT_KEYS[@]}" .github/skills/ .github/instructions/ apex-recall '@01-Orchestrator' '@02-Requirements' '@03-Architect' '@04-Design' '@04g-Governance' '@05-IaC-Planner' '@06b-Bicep-CodeGen' '@06t-Terraform-CodeGen' '@07b-Bicep-Deploy' '@07t-Terraform-Deploy' '@08-As-Built' '@e2e-Orchestrator' | awk 'NF' | paste -sd'|' -)"
echo "filter pattern length: ${#FILTER_RE}"
```

This produces a regex covering: every `.agent.md` file path, every
short registry key, the skills/instructions roots, the `apex-recall`
CLI, and every chat participant mention. That is the definition of
"work done by my custom agents" used everywhere downstream.

### Step 3 — Stage files into `.apex-logs/_staging/`

Compute a stable bundle id and stage a tree:

```bash
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SESSION_SHORT="$(basename "$SESSION_DIR" | cut -c1-8)"
BUNDLE_ID="apex-debug-${TS}-${SESSION_SHORT}"
STAGE=".apex-logs/_staging/${BUNDLE_ID}"
mkdir -p "$STAGE/session" "$STAGE/filtered"

# Always: the active session debug-log directory.
cp -r "$SESSION_DIR"/. "$STAGE/session/"

# Opt-in: older sessions (last 5 by mtime, excluding the active one).
if [[ "$INCLUDE_OLDER" == "yes" ]]; then
  PARENT="$(dirname "$SESSION_DIR")"
  mkdir -p "$STAGE/older-sessions"
  find "$PARENT" -mindepth 1 -maxdepth 1 -type d ! -path "$SESSION_DIR" \
    -printf '%T@ %p\n' | sort -nr | head -5 | awk '{print $2}' \
    | while IFS= read -r d; do
        cp -r "$d" "$STAGE/older-sessions/$(basename "$d")"
      done
fi

# Opt-in: active session transcript JSONL.
if [[ "$INCLUDE_XCRIPT" == "yes" ]]; then
  XCRIPT_DIR="$(dirname "$(dirname "$SESSION_DIR")")/transcripts"
  SESSION_ID="$(basename "$SESSION_DIR")"
  XCRIPT_FILE="$XCRIPT_DIR/${SESSION_ID}.jsonl"
  if [[ -f "$XCRIPT_FILE" ]]; then
    mkdir -p "$STAGE/transcript"
    cp "$XCRIPT_FILE" "$STAGE/transcript/"
  fi
fi

# Opt-in: workspace logs/copilot/ (if present).
if [[ "$INCLUDE_WS" == "yes" && -d logs/copilot ]]; then
  mkdir -p "$STAGE/workspace-logs"
  cp -r logs/copilot/. "$STAGE/workspace-logs/"
fi
```

> Do not use `cp -i`, `rm -i`, or `mv -i`. The `cp -r src/. dst/` form
> copies directory contents without prompting.

### Step 4 — Emit the filtered custom-agents-only JSONL

For each `main.jsonl` captured under `$STAGE`, write a parallel
`*.custom-agents.jsonl` containing only the lines that match
`FILTER_RE`:

```bash
while IFS= read -r MAIN; do
  OUT="$STAGE/filtered/$(echo "$MAIN" | sed "s|$STAGE/||; s|/|__|g").custom-agents.jsonl"
  grep -E "$FILTER_RE" "$MAIN" > "$OUT" || true
  echo "filtered: $MAIN -> $OUT ($(wc -l < "$OUT") lines)"
done < <(find "$STAGE" -type f -name 'main.jsonl')
```

Why this matters: the raw `main.jsonl` for a 4-hour session is
typically 60–80 MB. The filtered file is usually 5–15% of that and is
what a human actually wants to skim when reviewing custom-agent
behaviour.

### Step 5 — Redact (default on)

Unless the user selected "Skip redaction", run an in-place pass over
**only** the filtered JSONL files (never the raw originals — those
stay verbatim for auditability):

```bash
if [[ "$REDACT" != "no" ]]; then
  find "$STAGE/filtered" -type f -name '*.jsonl' -print0 \
    | xargs -0 -I{} sed -i -E \
        -e 's/(ghp_|github_pat_)[A-Za-z0-9_]{20,}/<redacted-gh-token>/g' \
        -e 's/(sk-[A-Za-z0-9]{20,})/<redacted-openai-key>/g' \
        -e 's/(AccountKey=)[^;"]+/\1<redacted>/g' \
        -e 's/(Bearer )[A-Za-z0-9._-]{20,}/\1<redacted>/g' \
        -e 's/("password"\s*:\s*")[^"]+(")/\1<redacted>\2/g' \
        {}
fi
```

Add patterns sparingly; this is a best-effort scrub, not a guarantee.
The bundle still contains raw `main.jsonl` — warn the user in the
final summary.

### Step 6 — Write the manifest

Create `$STAGE/MANIFEST.json` with the bundle metadata. Use `node`
(not a heredoc) so the JSON is well-formed:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const stage = process.env.STAGE;
const walk = (d) => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [{path: path.relative(stage, p), size: fs.statSync(p).size}];
});
const files = walk(stage).filter(f => f.path !== 'MANIFEST.json');
const manifest = {
  bundle_id: process.env.BUNDLE_ID,
  generated_at_utc: new Date().toISOString(),
  session_id: path.basename(process.env.SESSION_DIR || ''),
  workspace_id: path.basename(path.dirname(path.dirname(process.env.SESSION_DIR || ''))),
  capture: {
    include_older: process.env.INCLUDE_OLDER === 'yes',
    include_transcript: process.env.INCLUDE_XCRIPT === 'yes',
    include_workspace_logs: process.env.INCLUDE_WS === 'yes',
    redacted: process.env.REDACT !== 'no'
  },
  agent_filter: {
    source: 'tools/registry/agent-registry.json + .github/agents/*.agent.md',
    note: 'custom-agents-only.jsonl files contain only lines matching this filter'
  },
  files,
  total_bytes: files.reduce((a, f) => a + f.size, 0),
  file_count: files.length
};
fs.writeFileSync(path.join(stage, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
console.log('manifest written:', stage + '/MANIFEST.json');
" STAGE="$STAGE" BUNDLE_ID="$BUNDLE_ID" SESSION_DIR="$SESSION_DIR" \
  INCLUDE_OLDER="$INCLUDE_OLDER" INCLUDE_XCRIPT="$INCLUDE_XCRIPT" \
  INCLUDE_WS="$INCLUDE_WS" REDACT="$REDACT"
```

### Step 7 — Compress, cleanup, ensure gitignore

```bash
mkdir -p .apex-logs
tar -czf ".apex-logs/${BUNDLE_ID}.tar.gz" -C .apex-logs/_staging "$BUNDLE_ID"
rm -rf .apex-logs/_staging

# Ensure .apex-logs is gitignored.
if ! grep -qE '^\.apex-logs/?$' .gitignore 2>/dev/null; then
  printf '\n# Copilot debug-log bundles (apex-debug-log-export)\n.apex-logs/\n' >> .gitignore
fi

ARCHIVE_SIZE="$(du -h ".apex-logs/${BUNDLE_ID}.tar.gz" | awk '{print $1}')"
echo "archive: .apex-logs/${BUNDLE_ID}.tar.gz (${ARCHIVE_SIZE})"
```

### Step 8 — Print manual upload summary

Print this block to chat. Substitute `$ARGUMENT` for any OneDrive
share link the user passed via `argument-hint`, otherwise show a
placeholder line.

```text
Bundle ready: .apex-logs/<bundle-id>.tar.gz (<size>)

To upload to OneDrive for Business:
  1. Open the share link in your browser:
       <onedrive-link-or-"(no link provided)">
  2. Drag .apex-logs/<bundle-id>.tar.gz into the folder.
  3. Confirm the upload completed before deleting the local copy.

Bundle contents (see MANIFEST.json inside):
  - session/                       raw active-session debug logs
  - filtered/*.custom-agents.jsonl filtered to custom-agent activity
  - older-sessions/  (optional)
  - transcript/      (optional)
  - workspace-logs/  (optional)

Redaction: <on|off>. The raw session/ tree is NEVER redacted —
review before uploading if the chat may have contained secrets.
```

## Output

Print this summary table at the end:

| Step           | Result                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| Session dir    | `<absolute path>`                                                        |
| Captured       | active + (older / transcript / workspace logs as selected)               |
| Filter source  | `tools/registry/agent-registry.json` + `.github/agents/*.agent.md`       |
| Redaction      | on / off                                                                 |
| Archive        | `.apex-logs/<bundle-id>.tar.gz` (`<size>`)                               |
| Upload target  | `<onedrive-link>` or `(provide link to upload)`                          |
| Gitignore      | `.apex-logs/` already-ignored / added                                    |

## Rules

- Never upload from this prompt. The user uploads manually via the
  OneDrive share link in their browser.
- Never include `agent-output/`, `infra/`, `node_modules/`, or any
  `.git/` directory in the bundle.
- Never use `cp -i`, `mv -i`, `rm -i`, or `read -p`. Use `-r`/`-f` with
  explicit paths; never wildcard-delete.
- Pre-existing raw `main.jsonl` files in `session/` are copied verbatim
  — do **not** redact them. Only the derived
  `*.custom-agents.jsonl` files under `filtered/` are scrubbed.
- The bundle path is always inside `.apex-logs/` at the repo root.
  Never write archives outside the workspace.
- If the active session debug-log directory cannot be located, stop
  and report — do not guess.
- If `tar` exits non-zero, leave `_staging/` in place so the user can
  inspect it; report the exit code and the failing file.
- Output >50 lines must be piped into a file under `tmp/` rather than
  echoed back to chat.
