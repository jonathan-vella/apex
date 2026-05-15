---
description: "Prevents interactive shell prompts and long-output terminal replays from being injected into chat. Forbids -i flags on mv/rm/cp, read -p, and confirm prompts (incl. inside bash -c '...'). Pipe long output to files. Scoped to chat-context-loaded files; skill references/ and templates/ are exempt because they hold standalone scripts users run locally."
applyTo: "**/.github/agents/**/*.agent.md, **/.github/skills/**/SKILL.md, **/.github/instructions/**/*.instructions.md, **/tools/apex-prompts/**/*.prompt.md, **/AGENTS.md, **/.github/copilot-instructions.md, **/README.md"
---

# MANDATORY: No Interactive Shell, No Long-Output Replay

> [!CAUTION]
> Interactive shell prompts (`mv -i`, `rm -i`, `cp -i`, `read -p`,
> `confirm` dialogs) and long-output terminal replays bloat the chat
> transcript and re-inject 50+ lines into every subsequent turn. The
> primary control is this instruction file; `safe-shell.mjs` is a
> documentation aid that catches drift in committed snippets.

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
my-cmd > /tmp/my-cmd.out 2>&1 && \
  echo "wrote /tmp/my-cmd.out ($(wc -l </tmp/my-cmd.out) lines)"

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
| Capture full output for later inspection | `az <command> > /tmp/<name>.json && wc -l /tmp/<name>.json` |
| Preview deployment changes               | `az deployment ... what-if --result-format ResourceIdOnly`  |

Examples:

```bash
# Validate without dumping the deployment JSON
az deployment sub validate --location swedencentral \
  --template-file infra/bicep/<project>/main.bicep \
  --parameters @infra/bicep/<project>/main.dev.bicepparam \
  --output none && echo "validate OK"

# Capture, then peek
az resource list --resource-group myrg > /tmp/rg-resources.json
echo "wrote /tmp/rg-resources.json ($(wc -l </tmp/rg-resources.json) lines)"
```

## Rule 3 — If long output already escaped

If a >50-line output was produced by mistake, do **not** attempt to
clear the terminal — the transcript already captured it and `clear`
does not remove it from the chat history. Note the bloat in
`apex-recall lessons` and avoid repeating the same command.

## Why

The original incident was a runtime chat behavior (an `mv -i` issued
during a turn that hung waiting for input, then dumped its prompt into
the transcript). The instruction file is the primary control; the
linter (`tools/scripts/safe-shell.mjs`) catches drift in committed
agent/skill/instruction snippets but cannot enforce runtime chat
behavior. Both layers matter.
