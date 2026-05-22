---
description: "GPT-family variant of the execution-subagent invocation prompt contract. Markdown H2 form (outcome-first), matching the GPT-5.x prompting guide. Use this when invoking a GPT-family subagent. Reference: issue #425, Wave 3a follow-up."
agent: agent
model: "GPT-5.5"
tools: [read, edit, search]
---

# Execution-subagent invocation prompt — GPT variant

> Reference template for invoking GPT-family subagents
> (policy-precheck-subagent when on GPT-5.x, any future GPT-family
> validate/preview subagent). Three required H2s, in this order.
> Vendor compliance:
> [`gpt-5-prompting.md`](../../../.github/skills/vendor-prompting/references/gpt-5-prompting.md)
> rule **R-GPT-1** (outcome-first skeleton).
>
> For Claude-family subagent recipients use
> [`execution-subagent-claude.prompt.md`](execution-subagent-claude.prompt.md).
> The canonical base contract lives at
> [`execution-subagent.prompt.md`](execution-subagent.prompt.md).

## Inputs

One paragraph (≤ 4 sentences) stating what the parent needs from the
subagent. Name the artifact under review or the deployment target.
State the success criterion in observable terms (file written, JSON
shape returned, gate decision).

## Activities

The exact commands the subagent should run, in order. Include any
`set -euo pipefail` prelude, environment exports, and output
redirection. Use absolute paths or paths relative to the workspace
root.

```bash
set -euo pipefail
cd /workspaces/<repo>
# example
```

## Outputs

A precise statement of what the subagent returns to the parent:

- **Structured JSON** — name the schema (e.g. `deployment-preview-v1`)
  and the path on disk where it was written. The parent reads from
  disk, not from the chat transcript.
- **Verdict** — one of a fixed enum (e.g. `PASS|FAIL`,
  `PROCEED|BLOCK`, `APPROVED|NEEDS_REVISION|FAILED`).
- **Summary** — a bounded markdown block (state the H2 contract or
  line budget).

State the failure mode too: what does the subagent return if a command
fails, if the inputs are malformed, or if an upstream service is
unreachable?

## Why H2 markdown for GPT

OpenAI's GPT-5.x prompting guide prefers an outcome-first skeleton with
explicit H1/H2 sections (`# Goal`, `# Success criteria`, `# Constraints`,
`# Output`, `# Stop rules`). Markdown headings parse cleanly in GPT's
system-prompt rendering and survive the JSON-string envelope that
parent agents pass through `runSubagent`. See
[`gpt-5-prompting.md`](../../../.github/skills/vendor-prompting/references/gpt-5-prompting.md)
R-GPT-1.
