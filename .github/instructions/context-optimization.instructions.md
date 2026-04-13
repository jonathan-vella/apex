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

Adjust per model. GPT-5.3-Codex has 128K, so budget is tighter.

## Anti-Patterns

| Pattern                              | Fix                                        |
| ------------------------------------ | ------------------------------------------ |
| "Read ALL skills before starting"    | Read only the 2-3 needed skills            |
| Large JSON embedded in agent body    | Move to `references/` or external file     |
| Repeating instructions across agents | Single instruction file + `applyTo` glob   |
| Reading entire files when grep works | Use `grep_search` for targeted extraction  |
| No hand-offs in 30+ turn sessions    | Split at logical boundaries with subagents |

## Runtime Compression

When loading an artifact file, check conversation length. If estimated context
usage exceeds 60% of the model limit, use the compression tier system from the
`context-shredding` skill:

1. **Read** `.github/skills/context-shredding/SKILL.md` for tier definitions
2. Select tier: `full` (<60%), `summarized` (60-80%), `minimal` (>80%)
3. Apply compression template for the specific artifact being loaded
4. Compress older/less-critical artifacts first when loading multiple files

## Skill Affinity

Before reading a skill, check `.github/skill-affinity.json`:

- **Primary** skills: load at startup (always needed for this agent)
- **Secondary** skills: load on demand when the task context requires it
- **Never** skills: do not load (wrong domain for this agent)

This prevents agents from wasting context on irrelevant skills.
