---
description: "Prevents terminal heredoc file corruption in VS Code Copilot by enforcing use of file editing tools instead of shell redirections"
applyTo: "**"
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
