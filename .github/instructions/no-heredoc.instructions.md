---
description: "Requires editing tools for agent-authored source and artifacts; separates terminal transport risks from ordinary shell syntax."
applyTo: "**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}"
---

# MANDATORY: File Operation Override

> [!CAUTION]
> Agent-authored file content must go through file-editing tools. Interactive terminal
> transport and quoting have caused corruption in prior runs; this repository policy
> avoids that pathway. Heredoc/redirection syntax is not inherently corrupting, and
> committed scripts and normal log capture are not prohibited by this policy.

## Rule

Do not use `cat`, `echo`, `printf`, `tee`, or redirects to author multi-line source or
artifact content from chat. Use available file creation/editing tools instead.
Build tools, formatters, generators, downloads and output/log capture retain their
ordinary behavior within the authorized task.

## Allowed Terminal Commands

Package management, builds, tests, git, running scripts, filesystem
navigation (`ls`, `cd`, `mkdir`, `rm`), and downloads (`curl`, `wget`
— not piped to files with content manipulation).

## Sub-rule: No heredoc'd code into `node -e` / `python3 -c`

Do not transport agent-authored multi-line interpreter code through live heredocs.
Unquoted delimiters permit shell expansion before the interpreter receives the code;
quoted delimiters change those semantics but do not waive the editing-tool policy.

Expansion hazards with unquoted heredoc delimiters include:

- Backtick template literals (`` `${value}` ``) — interpreted as command substitution.
- `${variable}` — interpreted as parameter expansion.
- `$(command)` — interpreted as command substitution.
- `\u0000` and other escape sequences the shell touches before passing on.

Forbidden patterns: `node -e "<<EOF ... EOF"`, `python3 -c "$(cat <<EOF ... EOF)"` and
`cat <<EOF | node` when the body contains those constructs. Instead, write the script to
`tmp/run-once.mjs` (or `.py`) with the file-edit tool and run it, so the editing tool
controls quoting end-to-end.

## Sub-rule: No writes to `agent-output/**` via shell

Never write `agent-output/**` through heredocs, `>`/`>>`, or `tee`; use file-editing tools.
Read-only inspection (`ls`, `cat`, `wc -l`) is fine. This is the agent-facing
[No-Shell-Writes-to-Agent-Output rule](agent-authoring.instructions.md#no-shell-writes-to-agent-output-rule),
enforced in committed snippets by the `safe-shell` `agent-output-no-heredoc` check
(`tools/scripts/safe-shell.mjs`); shell writes have silently corrupted JSON sidecars before.
