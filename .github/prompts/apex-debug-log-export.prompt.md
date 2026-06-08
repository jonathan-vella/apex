---
agent: agent
model: "MAI-Code-1-Flash"
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
- Default capture: the **most recent non-active** Copilot debug-log
  directory in this workspace — i.e. the conversation that ran
  **before** this prompt was invoked. `$VSCODE_TARGET_SESSION_LOG`
  points at the _current_ prompt's own session, which is almost never
  what the user wants archived; it is therefore excluded by default
  and only the user can opt back into it (Step 1).
- Opt-in capture: the active prompt session, older sessions in the
  same workspace, the active session transcript JSONL, and workspace
  `logs/copilot/`.
- Filter source for "custom agent" lines: every agent file path under
  `.github/agents/*.agent.md` plus the short keys in
  `tools/registry/agent-registry.json` (`agents` map keys).
- Redaction (default on): strip common secret patterns from the
  filtered JSONL before bundling.
- Never includes `agent-output/`, `infra/`, or `node_modules/`.

## Inputs

| Variable       | Source                         | Default                        |
| -------------- | ------------------------------ | ------------------------------ |
| session_dir    | user pick (Step 0/1)           | most recent non-active session |
| include_older  | user choice                    | `no`                           |
| include_xcript | user choice (transcript JSONL) | `no`                           |
| include_ws     | user choice (`logs/copilot/`)  | `no`                           |
| redact         | user choice                    | `yes`                          |
| onedrive_link  | argument-hint                  | none (printed only if given)   |

## Workflow

### Step 0 — Enumerate candidate sessions

`$VSCODE_TARGET_SESSION_LOG` is the **current prompt's own** session
and is almost never what the user wants archived (it only contains
this export run). Treat it as the _active_ session to **exclude** by
default, and list all other debug-log directories in the same
workspace sorted by mtime (most recent first).

Run these and show the table:

```bash
ACTIVE_SESSION_DIR="${VSCODE_TARGET_SESSION_LOG:-}"
WS_DEBUG_ROOT=""
if [[ -n "$ACTIVE_SESSION_DIR" && -d "$ACTIVE_SESSION_DIR" ]]; then
  WS_DEBUG_ROOT="$(dirname "$ACTIVE_SESSION_DIR")"
else
  CANDIDATE_ROOT="$HOME/.vscode-server/data/User/workspaceStorage"
  WS_DEBUG_ROOT="$(find "$CANDIDATE_ROOT" -type d -path '*/GitHub.copilot-chat/debug-logs' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | awk '{print $2}')"
fi
test -d "$WS_DEBUG_ROOT" || { echo "ERROR: no Copilot debug-log root found"; exit 1; }
echo "ws_debug_root=$WS_DEBUG_ROOT"
echo "active_session=$(basename "${ACTIVE_SESSION_DIR:-<none>}")"

# Enumerate sessions, newest first, with the session name
# VS Code shows in the chat sidebar.
#
# The session name lives inside debug-logs/<sid>/title-*.jsonl on
# the line where `type == "agent_response"`, nested at
# attrs.response[0].parts[0].content (a JSON-encoded string). The
# first line of that file is only a `session_start` record and has
# no title — never read just `head -1`.
find "$WS_DEBUG_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk '{print $2}' \
  | while IFS= read -r d; do
      SID="$(basename "$d")"
      MTIME="$(date -u -d "@$(stat -c %Y "$d")" +%Y-%m-%dT%H:%M:%SZ)"
      SIZE="$(du -sh "$d" 2>/dev/null | awk '{print $1}')"
      TITLE_FILE="$(find "$d" -maxdepth 1 -name 'title-*.jsonl' -print -quit 2>/dev/null)"
      TITLE=""
      if [[ -n "$TITLE_FILE" ]]; then
        TITLE="$(python3 - "$TITLE_FILE" <<'PY' 2>/dev/null
import json, sys
title = ""
try:
    with open(sys.argv[1]) as f:
        for line in f:
            try:
                rec = json.loads(line)
            except Exception:
                continue
            if rec.get("type") != "agent_response":
                continue
            resp = (rec.get("attrs") or {}).get("response")
            if not resp:
                continue
            try:
                parsed = json.loads(resp) if isinstance(resp, str) else resp
                for msg in parsed or []:
                    for part in msg.get("parts", []) or []:
                        if part.get("type") == "text" and part.get("content"):
                            title = part["content"].strip()
                            raise StopIteration
            except StopIteration:
                raise
            except Exception:
                continue
except StopIteration:
    pass
except Exception:
    pass
print(title)
PY
)"
      fi
      [[ -z "$TITLE" ]] && TITLE="(untitled)"
      MARK=""
      [[ "$d" == "$ACTIVE_SESSION_DIR" ]] && MARK=" (ACTIVE — this prompt; usually skip)"
      printf '%s\t%s\t%s\t%s%s\n' "$SID" "$MTIME" "$SIZE" "$TITLE" "$MARK"
    done | tee /tmp/apex-debug-sessions.tsv
```

Each row of `/tmp/apex-debug-sessions.tsv` is
`<sid>\t<mtime>\t<size>\t<session-name>[\t (ACTIVE …)]` — the
session name is exactly what VS Code shows in the chat sidebar
(e.g. `New project setup for Nordic Foods`, `Apex debug log export`).

Stop and report if no candidate is found. **Never invent a path.**

Default selection: the **most recent directory whose path is not
`$ACTIVE_SESSION_DIR`**. If only one directory exists and it equals
`$ACTIVE_SESSION_DIR`, fall through and let the user opt in via
Step 1.

### Step 1 — Confirm session and extras

Call `vscode/askQuestions` with **two** questions in a single call.

Question 1 (`header: session-pick`, single-select, **required**):
build the options list from `/tmp/apex-debug-sessions.tsv` produced in
Step 0. Each option label must be the session name first so the user
can recognise the conversation from the chat sidebar, followed by the
session short id and mtime — for example:
`New project setup for Nordic Foods  ·  b512de0b  ·  2026-05-18 06:14Z  ·  8.2M`.
Untitled sessions render as `(untitled)`. Mark the most recent
**non-active** session as `recommended: true`. Include the active
session as an opt-in option with the same title prefix and a
`(ACTIVE — this prompt; usually skip)` suffix; do **not** mark it
recommended. Question text:
`Which Copilot session should be bundled?`

Question 2 (`header: capture-scope`, multi-select, all default off):

- `Older sessions for this workspace (last 5)`
- `Active session transcript JSONL`
- `Workspace logs/copilot/ directory`
- `Skip redaction (NOT recommended)`

Resolve `SESSION_DIR="$WS_DEBUG_ROOT/<sessionShort-matched-fully>"`
from the answer to Q1 and treat Q2's answer as four booleans. Do
**not** ask a third question. If the user picks the active session,
warn in the final summary that the bundle contains only this prompt's
own trace.

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
`FILTER_RE`. Compute the output path with **bash parameter expansion
only** (no `sed`, no nested command substitution inside double quotes
in the same statement), and capture the line count in a variable
**before** echoing — this snippet is frequently re-executed through
agent tool layers that mangle nested `"$VAR"` quoting inside
`$(...)`, and the earlier `wc -l < "$OUT"` form silently produced
empty bundles when escaped:

```bash
# Belt-and-braces: filtered/ is created in Step 3, but recreate here
# so this step is independently runnable.
mkdir -p "$STAGE/filtered"

while IFS= read -r MAIN; do
  # Strip the staging prefix via parameter expansion (robust to dots,
  # slashes, and shell-escaping by tool layers), then flatten the
  # remaining path separators into "__".
  REL="${MAIN#${STAGE}/}"
  OUT="$STAGE/filtered/${REL//\//__}.custom-agents.jsonl"
  # Pre-touch so wc never sees a missing file even if grep matches
  # nothing (grep returns 1 on no-match; `|| true` keeps set -e happy).
  : > "$OUT"
  grep -E "$FILTER_RE" "$MAIN" > "$OUT" || true
  LINES="$(wc -l < "$OUT")"
  echo "filtered: $MAIN -> $OUT (${LINES} lines)"
done < <(find "$STAGE" -type f -name 'main.jsonl')
```

> Anti-patterns that have broken this step before — do **not**
> reintroduce them:
>
> - `sed "s|$STAGE/||"` to strip the prefix. `$STAGE` contains `.`
>   (regex metachar) and is sensitive to delimiter clashes; bash
>   `${VAR#prefix}` is the right tool.
> - `echo "... ($(wc -l < "$OUT") lines)"`. The inner `"$OUT"` lives
>   inside `$(...)` inside `"..."`. Modern bash handles this, but
>   when the snippet is re-quoted by a tool wrapper the inner quotes
>   become `\"$OUT\"` and `wc` tries to open a file literally named
>   `"<path>"`. Always assign to `LINES` first.
> - Skipping `: > "$OUT"`. If `grep` matches nothing and `set -e` is
>   active elsewhere, the redirect may not run, leaving the file
>   missing and breaking downstream steps.

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
export STAGE BUNDLE_ID SESSION_DIR INCLUDE_OLDER INCLUDE_XCRIPT INCLUDE_WS REDACT
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
"
```

> The `export` line is mandatory: `node -e '...' VAR=value` after the
> script string passes positional args, **not** env vars, to Node, so
> the manifest comes out empty. Export the variables first.

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

| Step          | Result                                                             |
| ------------- | ------------------------------------------------------------------ |
| Session dir   | `<absolute path>`                                                  |
| Captured      | active + (older / transcript / workspace logs as selected)         |
| Filter source | `tools/registry/agent-registry.json` + `.github/agents/*.agent.md` |
| Redaction     | on / off                                                           |
| Archive       | `.apex-logs/<bundle-id>.tar.gz` (`<size>`)                         |
| Upload target | `<onedrive-link>` or `(provide link to upload)`                    |
| Gitignore     | `.apex-logs/` already-ignored / added                              |

## Rules

- Never pick a session without showing the candidate list from
  Step 0 and asking Question 1 (`session-pick`) in Step 1. The
  `$VSCODE_TARGET_SESSION_LOG` env var points at this prompt's own
  session, **not** the conversation the user wants archived — using
  it as a silent default has produced bundles for the wrong session.
  The picker is mandatory whenever more than one candidate exists.
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
