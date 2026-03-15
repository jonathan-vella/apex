---
description: "Model-specific prompt patterns for Claude and GPT agent definitions and prompt files"
applyTo: "**/*.agent.md, **/*.prompt.md"
---

# Model-Specific Prompt Alignment

When creating or modifying an agent definition (`.agent.md`) or prompt file (`.prompt.md`),
apply the patterns below based on the `model:` field in the file's YAML frontmatter.

## Model Detection

Read the `model:` field from frontmatter and classify:

- **Claude family**: any value containing `Claude Opus`, `Claude Sonnet`, or `Claude Haiku`
- **GPT family**: any value containing `GPT-5.4`, `GPT-5.3-Codex`, or `GPT-4o`

If `model:` is an array, classify by the first entry.

## Claude-Specific Patterns

Sources: [Anthropic Claude Prompting Best Practices][claude-guide].

### XML Blocks (selective — not every agent)

Add XML blocks only where they serve the agent's actual role. Each block should
be 3-5 lines. Place them after the first `#` heading, before the body content.

| Block                            | Add when                                                         | Do NOT add when                                                      |
| -------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `<investigate_before_answering>` | Agent researches before deciding (Architect, Planners, Diagnose) | ONE-SHOT agents (Requirements), procedural wrappers (lint subagents) |
| `<output_contract>`              | Agent produces a formal artifact with defined structure          | Agent has no structured output                                       |
| `<context_awareness>`            | Agent definition exceeds ~300 lines                              | Small agents, subagents                                              |
| `<scope_fencing>`                | Agent produces scoped artifacts where creep is a risk            | Agents whose job is comprehensive analysis (Architect)               |
| `<empty_result_recovery>`        | Agent queries Azure APIs that may return empty results           | Agents that don't call external APIs                                 |
| `<subagent_budget>`              | Agent orchestrates 3+ subagents                                  | Leaf agents that don't delegate                                      |

**Never add**: `<use_parallel_tool_calls>` (Claude does this natively),
`<avoid_overengineering>` on comprehensive-analysis agents.

### Reasoning Effort

Add an HTML comment after the first `#` heading:

```markdown
<!-- Recommended reasoning_effort: high -->
```

Use `high` for planning/architecture agents, `medium` for execution/validation agents.

### Language Calibration

- Keep absolute language (`MUST`, `NEVER`, `HARD RULE`) at: approval gates,
  security baseline (TLS/HTTPS/MI), governance compliance, ONE-SHOT gates
- Prefer direct phrasing elsewhere: "Do X" instead of "You MUST always do X"
- Remove duplicate emphasis where adjacent prose already conveys the same rule

## GPT-Specific Patterns

Sources: OpenAI prompt engineering documentation, GPT-5.4 system prompt guidance.

### Structure Over XML

GPT models follow markdown structure natively — use it instead of XML blocks:

- `##` headings for workflow phases and major sections
- Numbered lists for sequential steps (GPT excels at step-following)
- Tables for decision matrices and option comparisons
- Bold (`**text**`) for emphasis the model should not skip

### Tool-Call-First Phrasing

Write instructions that lead with the action:

```markdown
Use `az account show` to verify authentication before proceeding.
```

Not: "Consider checking if the user is authenticated by possibly running..."

### Structured Output Guidance

For agents with formal outputs, use a fenced code block showing the expected format
rather than an XML `<output_contract>`. GPT models reproduce fenced examples reliably.

## Cross-Model Rules (Always Apply)

### Handoff Model Overrides

- **Do not** add `model:` to a handoff entry unless it intentionally routes to a
  different model than the target agent's own frontmatter declares.
- Redundant overrides (matching the target's model) become stale when models change —
  remove them.

### Handoff Prompt Enrichment

Every handoff prompt should include:

1. **Input**: which artifact the target agent should read (with path pattern)
2. **Output**: what the target agent should produce

Example: `"Create a WAF assessment based on agent-output/{project}/01-requirements.md.
Output: 02-architecture-assessment.md and 03-des-cost-estimate.md."`

### Prompt File Model Sync

The `model:` field in a `.prompt.md` file must match the corresponding agent's
frontmatter `model:` value. If the agent uses `GPT-5.4`, the prompt must too.

Run `npm run lint:model-alignment` to catch mismatches.

### Few-Shot Examples

For agents making routing or scoring decisions, add one structured example
in `<example>` tags (Claude) or a fenced block (GPT) showing:

- Input state
- Decision logic
- Expected output format

Keep examples under 12 lines. Place them at the end of the agent body.

[claude-guide]: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
