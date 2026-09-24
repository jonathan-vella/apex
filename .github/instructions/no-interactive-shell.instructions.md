---
description: "Prevents interactive shell prompts and long-output terminal replays from being injected into chat. Forbids -i flags on mv/rm/cp, read -p, and confirm prompts (incl. inside bash -c '...'). Pipe long output to files. Scoped to chat-context-loaded files; skill references/ and templates/ are exempt because they hold standalone scripts users run locally."
applyTo: "**/.github/agents/**/*.agent.md, **/.github/skills/**/SKILL.md, **/.github/instructions/**/*.instructions.md, **/.github/prompts/**/*.prompt.md, **/tools/apex-prompts/**/*.prompt.md, **/AGENTS.md, **/.github/copilot-instructions.md, **/README.md"
---

# MANDATORY: No Interactive Shell, No Long-Output Replay

> [!CAUTION]
> Interactive shell prompts (`mv -i`, `rm -i`, `cp -i`, `read -p`,
> `confirm` dialogs) and long-output terminal replays bloat the chat
> transcript and re-inject 50+ lines into every subsequent turn.

## Rule 1 — No interactive flags

**NEVER** use `mv -i`, `rm -i`, `cp -i`, `read -p`, or any prompt-driven
shell builtin (including inside `bash -c '...'`).

| Forbidden                  | Use instead                                  |
| -------------------------- | -------------------------------------------- |
| `mv -i src dst`            | `mv -f src dst`                              |
| `rm -i path`               | `rm -f path` (or skip — let the user delete) |
| `cp -i src dst`            | `cp -f src dst`                              |
| `read -p "Continue? " ans` | Use `vscode_askQuestions` to gather input    |
| `bash -c 'rm -i x'`        | `rm -f x`                                    |

If the user genuinely needs confirmation, use the `vscode_askQuestions`
tool — never an interactive shell prompt.

## Rule 2 — Pipe long output to a file

For commands likely to produce more than ~50 lines of output, redirect
to a file and report only the line count:

```bash
# Good
my-cmd > tmp/my-cmd.out 2>&1 && \
  echo "wrote tmp/my-cmd.out ($(wc -l <tmp/my-cmd.out) lines)"

# Bad
my-cmd            # spews 800 lines into chat → repeated every turn
```

When the caller needs specific content, read the file with the file
tool, or extract the relevant lines (`grep`, `head`, `tail`, `awk`).

### Sub-rule 2a — Azure CLI output budget

`az` commands return large JSON envelopes by default. Choose one of:

| Goal                                     | Recipe                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| Fire-and-check exit code                 | `az <command> --output none && echo OK`                     |
| Extract a single field                   | `az <command> --query "<jmespath>" --output tsv`            |
| Capture full output for later inspection | `az <command> > tmp/<name>.json && wc -l tmp/<name>.json`   |
| Preview deployment changes               | `az deployment ... what-if --result-format ResourceIdOnly`  |

## Rule 3 — If long output already escaped

If a >50-line output was produced by mistake, do **not** attempt to
clear the terminal — the transcript already captured it and `clear`
does not remove it from the chat history. Note the bloat in
the structured lesson log per
[`lesson-collection.instructions.md`](lesson-collection.instructions.md)
and avoid repeating the same command. Register the artifact via recall;
there is no `apex-recall lessons` subcommand.

## Rule 4 — Command portability

Do **not** hard-depend on non-default CLIs (`rg`, `fd`, `bat`) inside
committed shell snippets in agent, instruction, skill, or prompt
files. These tools are not guaranteed to be on the PATH in every
chat-agent environment, dev container variant, or contributor laptop.
The committed snippet must use one of:

| Allowed form                                                                | Notes                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `command -v rg >/dev/null && rg ... \|\| grep -R ...`                       | Guarded form with fallback (preferred).                                            |
| `if command -v rg; then rg ...; else grep -R ...; fi`                       | Verbose guard with fallback.                                                       |
| `grep -R "pattern" .` / `find . -name "*.md"` / `python -m json.tool file`  | Stdlib only — no portability tool used. Best when the snippet is for a wide audience. |

Forbidden: bare `rg "pattern" file.md` or `fd -e md . | head -5`.

The `safe-shell` linter (`tools/scripts/safe-shell.mjs`) enforces this via the
`command-portability` check, which inspects only the offending fence: an optional-tool
invocation needs a `command -v <tool>` guard in the same fenced block; separate stdlib
examples elsewhere do not make it compliant.

## Why

An `mv -i` once hung a turn waiting for input and dumped its prompt into the transcript.
This instruction is the primary control; `safe-shell.mjs` catches drift in committed
snippets but cannot enforce runtime chat behavior.
