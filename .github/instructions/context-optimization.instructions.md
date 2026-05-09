---
description: "Context window optimization rules for agent definitions, skills, and instruction files"
applyTo: ".github/agents/**/*.agent.md, .github/skills/**/SKILL.md, .github/instructions/*.instructions.md"
---

# Context Window Optimization Rules

Rules for keeping agent context windows efficient. These apply when creating
or modifying agent definitions, skills, and instruction files.

## Agent Definition Rules

| Rule                     | Limit            | Rationale                           |
| ------------------------ | ---------------- | ----------------------------------- |
| Tool list size           | ≤ 30 tools       | Each tool adds ~75 tokens to prompt |
| Agent body length        | ≤ 350 lines      | Body is always in context           |
| Inline template size     | ≤ 50 lines       | Move larger templates to skills     |
| Handoff count            | ≤ 8 handoffs     | Each adds ~40 tokens                |
| Skill references in body | ≤ 5 "Read" lines | Progressive load, not bulk load     |

## Instruction File Rules

| Rule                  | Limit            | Rationale                         |
| --------------------- | ---------------- | --------------------------------- |
| File size             | ≤ 150 lines      | Split into skill `references/`    |
| `applyTo` specificity | Narrow globs     | `**/*.ts` not `**` when possible  |
| Avoid `applyTo: "**"` | Exceptional only | Loads for every single file match |

### Good vs Bad `applyTo`

```yaml
# Good: Loads only for TypeScript files
applyTo: "**/*.ts, **/*.tsx"

# Good: Loads only for Bicep
applyTo: "**/*.bicep"

# Bad: Loads for every file in the workspace
applyTo: "**"
# Only acceptable for truly universal rules (comments, golden principles)
```

## Skill Rules

| Rule                  | Limit           | Rationale                          |
| --------------------- | --------------- | ---------------------------------- |
| SKILL.md body         | ≤ 500 lines     | Per skill spec                     |
| Heavy content         | → `references/` | Level 3: loaded only when needed   |
| Prerequisites section | Required        | Declare deps, don't surprise agent |

## Hand-Off Decision Framework

Introduce a subagent hand-off when ANY of these conditions are true:

1. **Tool-heavy phase**: Agent makes > 5 tool calls in sequence for one subtask
2. **Domain shift**: Agent transitions between distinct domains (infra → app → docs)
3. **Context accumulation**: Estimated context > 60% of model limit
4. **Latency signal**: Turn latency exceeds 15s consistently
5. **Isolated validation**: Task produces a structured PASS/FAIL result

## Context Budget Template

When designing a new agent, budget the context:

```text
Model limit:           200,000 tokens (Opus)
─ System overhead:      -2,000 tokens
─ Tool schemas (25):    -1,875 tokens
─ Agent body (200 ln):  -1,500 tokens
─ Instructions (5):     -3,000 tokens
─ Skill (1 SKILL.md):   -2,000 tokens
─ Output headroom:     -20,000 tokens
────────────────────────────────────
Available for conversation: ~169,625 tokens

Per-turn budget: ~169,625 / 20 turns = ~8,481 tokens/turn average
```

Adjust per model. The 200,000-token figure above is the VS Code Copilot Chat
per-turn budget for the Claude family (Opus 4.7, Sonnet 4.6, Haiku 4.5). The
GPT-5 family (GPT-5.5, GPT-5.3-Codex) has a 400,000-token per-turn
budget in VS Code Copilot Chat, so the available conversation pool roughly
doubles. See
[`context-management/references/token-estimation.md`](../skills/context-management/references/token-estimation.md)
for the per-model breakdown including request multipliers.

## Anti-Patterns

| Pattern                              | Fix                                        |
| ------------------------------------ | ------------------------------------------ |
| "Read ALL skills before starting"    | Read only the 2-3 needed skills            |
| Large JSON embedded in agent body    | Move to `references/` or external file     |
| Repeating instructions across agents | Single instruction file + `applyTo` glob   |
| Reading entire files when grep works | Use `grep_search` for targeted extraction  |
| No hand-offs in 30+ turn sessions    | Split at logical boundaries with subagents |
| `create_file` to revise a file       | Use `multi_replace_string_in_file` (below) |

## Targeted Edits Over Full Rewrites

**Rule**: Use `create_file` only for first-time artifact creation.
All revisions MUST use `replace_string_in_file` or
`multi_replace_string_in_file`.

| Situation                                       | Correct tool                    |
| ----------------------------------------------- | ------------------------------- |
| Initial draft of any file                       | `create_file`                   |
| Single-spot fix                                 | `replace_string_in_file`        |
| Multiple fixes across one or more files         | `multi_replace_string_in_file`  |
| Structural rewrite (≥ 50 % lines or H2 reorder) | `create_file` (with logged ADR) |

**Bundle all accepted findings into one call.** A 24-finding revision
is one `multi_replace_string_in_file` call, not 24 sequential edits.

**Cost model** (measured empirically against a Step-2 Architect run
that consumed 200 K of input tokens):

- Full rewrite of a 200-line artifact: **8–18 K output tokens**, all of
  which re-enter the context window as input on every subsequent turn.
- Equivalent multi-edit patch (24 findings): **200–800 tokens** total.
- Multiplier: **20–60× cheaper per revision**.

For any agent that runs adversarial review and applies fixes
(`03-Architect`, `05-IaC Planner`, `04g-Governance`), the revision
phase is the dominant context-bloat risk. Use targeted edits.

**Exception logging**: when a full rewrite is genuinely required
(template bump, > 50 % of lines changed, H2 reordering), record the
rationale via `apex-recall decide ... --rationale "Full rewrite: <reason>"`
so the choice is auditable.

## Runtime Compression

When loading an artifact file, check conversation length. If estimated context
usage exceeds 60% of the model limit, use the compression tier system from the
`context-management` skill (Mode A: Runtime Compression):

1. **Read** `.github/skills/context-management/SKILL.md` for tier definitions
2. Select tier: `full` (<60%), `summarized` (60-80%), `minimal` (>80%)
3. Apply compression template for the specific artifact being loaded
4. Compress older/less-critical artifacts first when loading multiple files

## Skill Loading

Load skills referenced in the agent body's "Read Skills" section.
Use context-management runtime tiers to select the right compression level.
