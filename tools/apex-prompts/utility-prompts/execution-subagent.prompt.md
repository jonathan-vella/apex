---
description: "Canonical prompt shape for invoking execution subagents. Parent agents (Steps 1-7) MUST follow this contract when calling runSubagent for an execution-style subagent (validate, what-if, plan, policy-precheck, cost-estimate, challenger-review). Reference: issue #425, Wave 3a."
agent: agent
model: "Claude Opus 4.7"
tools: [read, edit, search]
---

# Execution-subagent invocation prompt — contract

> Reference template. Parent agents copy this shape into the `prompt`
> string they pass to `runSubagent`. Three required H2 slots, in this
> order: `## Inputs`, `## Activities`, `## Outputs`. Do not omit any
> section; do not reorder.
>
> **History (#425, 2026-05-22 audit)**: an earlier draft used
> `## Objective` / `## Commands` / `## Expected return`. The agents
> converged on `## Inputs` / `## Activities` / `## Outputs` in
> practice, so the contract was renamed to match the empirically
> stable pattern.

> **Model-aware variants** (vendor-idiomatic when the subagent recipient
> is fixed to one family):
>
> - Claude-family subagents — use
>   [`execution-subagent-claude.prompt.md`](execution-subagent-claude.prompt.md)
>   (XML tags per Anthropic R-CL-1).
> - GPT-family subagents — use
>   [`execution-subagent-gpt.prompt.md`](execution-subagent-gpt.prompt.md)
>   (H2 markdown skeleton per OpenAI R-GPT-1).
>
> This base template is the universal shape: H2 markdown that both
> families parse cleanly. Pick a variant only when the additional
> vendor-idiomatic markers (XML wrappers or the full GPT outcome-first
> skeleton) materially improve subagent reliability for that family.

## Inputs

One paragraph (≤ 4 sentences) stating what the parent needs from the
subagent. Name the artifact under review or the deployment target.
State the success criterion in observable terms (file written, JSON
shape returned, gate decision).

Example:

> Run a Bicep what-if preview against
> `infra/bicep/my-project/main.bicep` with the dev parameter file.
> Success: `06-bicep-whatif.json` written at the path below,
> conforming to `deployment-preview-v1`, with create/modify/delete
> counts populated.

## Activities

A bash code block listing the **exact commands** the subagent should
run, in order. Include any `set -euo pipefail` prelude, environment
exports, and output redirection. Use absolute paths or paths relative
to the workspace root.

```bash
# Example
set -euo pipefail
cd /workspaces/<repo>
az deployment group what-if \
  --resource-group rg-my-project-dev \
  --template-file infra/bicep/my-project/main.bicep \
  --parameters @infra/bicep/my-project/main.dev.bicepparam \
  > /tmp/whatif.txt
```

If the subagent dispatches further tools (sub-subagent, MCP), name
them explicitly here.

## Outputs

A precise statement of what the subagent returns to the parent. Use
one of:

- **Structured JSON** — name the schema (e.g. `deployment-preview-v1`)
  and the path on disk where it was written. The parent reads from
  disk, not from the chat transcript.
- **Verdict** — one of a fixed enum (e.g. `PASS|FAIL`,
  `PROCEED|BLOCK`, `APPROVED|NEEDS_REVISION|FAILED`).
- **Summary** — a bounded markdown block (state the H2 contract or
  line budget).

State the failure mode too: what does the subagent return if a command
fails, if the inputs are malformed, or if an upstream service is
unreachable? The parent must handle those branches deterministically.

## Why this contract

This is the prompt shape that historically produced the most reliable
subagent runs. Codifying it prevents drift to under-specified or
over-specified invocations, which both inflate the parent's context
window and reduce subagent determinism. See the bounded-retry policy
in [`iac-common`](../../.github/skills/iac-common/SKILL.md) for what
the parent does when the subagent returns a non-success verdict.
