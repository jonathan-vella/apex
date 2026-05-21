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

Forbidden patterns (and what to do instead):

- `node -e "<<EOF ... EOF"` containing any of the constructs above → write
  the script to `tmp/run-once.mjs` with the file-edit tool, then run
  `node tmp/run-once.mjs`.
- `python3 -c "$(cat <<EOF ... EOF)"` containing any of the constructs
  above → write the script to `tmp/run-once.py` then run
  `python3 tmp/run-once.py`.
- `cat <<EOF | node` — same fix, use a temp file.

The temp file lets the agent's file-editing tools control quoting and
escape sequences end-to-end, instead of negotiating shell, heredoc, and
interpreter layers all at once.

## Sub-rule: No writes to `agent-output/**` via shell

Subagents and step agents MUST NOT use heredocs, `>`/`>>`, or `tee` to
write any file under `agent-output/**`. Artifact writes must go through
the file-editing tools (`create_file`, `replace_string_in_file`,
`multi_replace_string_in_file`). Read-only inspection (`ls`, `cat`,
`wc -l`) of existing `agent-output/**` files is fine.

Why: artifact integrity. Heredoc/redirect writes bypass markdown
validation, lose escape handling, and have historically silently
corrupted JSON sidecars (e.g. `06-policy-precheck.json`). The
`safe-shell` linter enforces this via the `agent-output-no-heredoc`
rule (`tools/scripts/safe-shell.mjs`).

Forbidden:

```bash
# ❌ heredoc body to artifact
cat <<'EOF' > agent-output/my-project/06-policy-precheck.json
{"deploy_gate": "PROCEED"}
EOF

# ❌ tee to artifact
echo '{"k":"v"}' | tee agent-output/my-project/notes.json

# ❌ append to artifact log
echo "step done" >> agent-output/my-project/log.txt
```

Allowed:

```bash
# ✅ read-only inspection
ls agent-output/my-project/
wc -l agent-output/my-project/04-implementation-plan.md
```

For writes, call the file-editing tool. Subagents that produce JSON
artifacts (e.g. `policy-precheck-subagent`, `cost-estimate-subagent`,
`bicep-whatif-subagent`, `terraform-plan-subagent`) follow the same
contract.
