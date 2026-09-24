---
description: "Prevents terminal heredoc file corruption in VS Code Copilot by enforcing use of file editing tools instead of shell redirections"
applyTo: "**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}"
---

# MANDATORY: File Operation Override

> [!CAUTION]
> Terminal heredoc/redirect operations (`cat <<EOF`, `echo "..." >`,
> `printf >`, `tee <<EOF`) corrupt files in VS Code Copilot due to
> tab-completion interference, escape failures, and exit-code 130
> interruptions. This is a hard technical requirement.

## Rule

**NEVER** use `cat`, `echo`, `printf`, `tee`, or `>>`/`>` to write
multi-line content to a file. Use file creation/editing tools instead.

## Allowed Terminal Commands

Package management, builds, tests, git, running scripts, filesystem
navigation (`ls`, `cd`, `mkdir`, `rm`), and downloads (`curl`, `wget`
— not piped to files with content manipulation).

## Sub-rule: No heredoc'd code into `node -e` / `python3 -c`

Piping a heredoc into `node -e` or `python3 -c` is forbidden when the
code contains shell-meaningful constructs. The shell expands them before
the interpreter sees them and you typically get a `SyntaxError: Invalid
or unexpected token` (or silently wrong output).

Forbidden constructs in heredoc bodies:

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
