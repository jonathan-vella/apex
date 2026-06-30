---
description: "Claude-flavored variant of the execution-subagent invocation prompt contract. Wraps the three required slots in XML tags per claude-best-practices R-CL-1. Use this when invoking a Claude-family subagent. Reference: issue #425, Wave 3a follow-up."
agent: agent
model: "Claude Sonnet 5"
tools: [read, edit, search]
---

# Execution-subagent invocation prompt — Claude variant

> Reference template for invoking Claude-family subagents
> (challenger-review-subagent, cost-estimate-subagent,
> bicep-validate-subagent, terraform-validate-subagent). Three required
> XML tags, in this order. Vendor compliance:
> [`claude-best-practices.md`](../../../.github/skills/vendor-prompting/references/claude-best-practices.md)
> rule **R-CL-1** (XML structuring for complex prompts).
>
> For GPT-family subagent recipients use
> [`execution-subagent-gpt.prompt.md`](execution-subagent-gpt.prompt.md).
> The canonical base contract lives at
> [`execution-subagent.prompt.md`](execution-subagent.prompt.md).

```text
<inputs>
One paragraph (≤ 4 sentences) stating what the parent needs from the
subagent. Name the artifact under review or the deployment target.
State the success criterion in observable terms (file written, JSON
shape returned, gate decision).
</inputs>

<activities>
The exact commands the subagent should run, in order. Include any
`set -euo pipefail` prelude, environment exports, and output
redirection. Use absolute paths or paths relative to the workspace
root.

```bash
set -euo pipefail
cd /workspaces/<repo>
# example
```
</activities>

<outputs>
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
</outputs>
```

## Why XML for Claude

Anthropic's prompt-engineering guidance prefers XML tags for content
structuring when a prompt mixes instructions, context, examples, and
variable inputs. The XML wrapper is easier for Claude to parse than
markdown H2s and survives copy/paste-into-system-prompt rendering
without ambiguity. See
[`claude-best-practices.md`](../../../.github/skills/vendor-prompting/references/claude-best-practices.md)
R-CL-1.
