---
description: "Shell scripting best practices and conventions for bash, sh, zsh, and other shells"
applyTo: "**/*.sh"
---

# Shell Scripting Guidelines

## Quick Reference

| Rule         | Standard                                                       |
| ------------ | -------------------------------------------------------------- |
| Shebang      | `#!/usr/bin/env bash` (Bash) or `#!/bin/sh` (POSIX)            |
| Safety       | `set -euo pipefail` (Bash) or `set -eu` (POSIX sh)             |
| Variables    | Double-quote: `"$var"`; use `${var}` for clarity; avoid `eval` |
| Cleanup      | `trap cleanup EXIT` for temp files/resources                   |
| Constants    | `readonly SCRIPT_NAME="$(basename "$0")"`                      |
| Temp files   | `mktemp` — never hardcode temp paths                           |
| JSON/YAML    | Use `jq`/`yq`, not `grep`/`awk` — fail fast if missing         |
| Conditionals | `[[ ]]` in Bash; `[ ]` only for POSIX portability              |

## Script Structure

- Header comment explaining purpose
- `set -euo pipefail` immediately after shebang
- `trap cleanup EXIT` for resource teardown
- Default variables at top; functions next; `main` called at bottom
- Validate required parameters before execution
- Clear, concise `echo` for status — avoid excessive logging

## Working with Structured Data

- Prefer `jq` for JSON, `yq` for YAML over text-processing hacks
- Validate required fields; treat parser errors as fatal
- Quote filters; use `--raw-output` for plain strings
- Document parser dependencies at script top; fail fast if absent

## Argument Parsing

Use `while [[ $# -gt 0 ]]; do case $1 in ...` pattern with
`shift` for each option. Include `-h|--help` with a `usage()` function.
