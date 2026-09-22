---
description: "Context window optimization rules for agent definitions, skills, and instruction files"
applyTo: ".github/agents/**/*.agent.md, .github/skills/**/SKILL.md, .github/instructions/*.instructions.md"
---

# Context Window Optimization Rules

Rules for keeping agent context windows efficient. These apply when creating
or modifying agent definitions, skills, and instruction files.

## Agent Definition Rules

Two tiers govern agent definitions: **hard limits** (CI-enforced — a breach
fails `npm run validate:agents`) and **soft guidelines** (advisory — keep
lean, but no validator blocks them). Earlier revisions listed the soft
targets as hard caps; the tables below now match what the validators in
`tools/scripts/` actually enforce.

### Hard limits (CI-enforced)

| Rule                    | Limit                                      | Enforced by                                                  |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Agent body length       | ≤ 600 lines                                | `tools/scripts/_lib/paths.mjs` (`MAX_BODY_LINES`)            |
| `description` length    | ≤ 350 chars (warn ≥ 300)                   | `validate-agents.mjs` frontmatter check                      |

### Soft guidelines (advisory — not CI-enforced)

| Rule                     | Target           | Rationale                                                              |
| ------------------------ | ---------------- | --------------------------------------------------------------------- |
| Tool list size           | ≤ 30 tools       | Each tool adds ~75 tokens to prompt                                   |
| Agent body length        | ≤ 350 lines      | Preserve role contracts and stop rules (hard cap is 600)              |
| Inline template size     | ≤ 50 lines       | Move larger templates to skills                                       |
| Handoff count            | ≤ 8 handoffs     | Each adds ~40 tokens; orchestrators are exempt (they route every step) |
| Skill references in body | ≤ 5 "Read" lines | Progressive load, not bulk load                                       |

## Instruction File Rules

| Rule                      | Limit / Target       | Enforced?                                                            |
| ------------------------- | -------------------- | ------------------------------------------------------------------- |
| File size                 | ≤ 150 lines (target) | Guideline — split heavy content into a skill `references/` file      |
| `applyTo: "**"` file size | ≤ 50 lines           | **Warning only** — `validate-glob-audit.mjs`; wildcard always warns, size adds a note |
| Broad-markdown file size  | ≤ 200 lines          | **Warning only** — `validate-glob-audit.mjs` for an exact recognized broad glob |
| `applyTo` specificity     | Narrow globs         | Guideline — `**/*.ts` not `**` when possible                         |
| Avoid `applyTo: "**"`     | Exceptional only     | Loads for every single file match                                   |

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

| Rule                               | Limit           | Enforced?                                                   |
| ---------------------------------- | --------------- | ---------------------------------------------------------- |
| SKILL.md file (no `references/`)   | ≤ 200 lines     | **Error**, except tracked oversized skills warn; `validate-skills.mjs` |
| SKILL.md body (with `references/`) | ≤ 500 lines     | Skill-spec ceiling (guideline); validator warns when the file exceeds 200 lines |
| Heavy content                      | → `references/` | Level 3: loaded only when needed                           |
| Prerequisites section              | Required        | Declare deps, don't surprise agent                         |

These are source checks, not runtime read/token enforcement. The glob auditor
counts full-file lines and recognizes exact broad-glob values, not every
equivalent compound pattern. Do not interpret a passing check as runtime
attachment evidence or proof that every advisory limit is enforced.

## Hand-Off Decision Framework

Consider delegation at a bounded task boundary when one of these signals applies:

1. **Tool-heavy phase**: Agent makes > 5 tool calls in sequence for one subtask
2. **Domain shift**: Agent transitions between distinct domains (infra → app → docs)
3. **Context accumulation**: Estimated context > 60% of model limit
4. **Latency signal**: Turn latency exceeds 15s consistently
5. **Isolated validation**: Task produces a structured PASS/FAIL result

These signals never authorize topology changes. Check explicit caller allowlists,
available tools, and actual harness support first. Empty `agents: []` means no
delegation and needs no `agent` tool. Leaf workers return to their parent without
questions, todo management, or nested calls. Use a human handoff when required.
Do not infer runtime cost-tier eligibility from model names or catalog capability
descriptors; unknown Sol metadata remains unknown.

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

This is illustrative arithmetic, not a guaranteed model or harness limit.
Use observed context limits from the active Local or Agent Host session; do not
infer Sol limits or multiply a conversation budget by an assumed model tier. See
[`apex-context-management/references/token-estimation.md`](../skills/apex-context-management/references/token-estimation.md)
for the per-model breakdown including request multipliers.

## Anti-Patterns

| Pattern                              | Fix                                        |
| ------------------------------------ | ------------------------------------------ |
| "Read ALL skills before starting"    | Read only the 2-3 needed skills            |
| Large JSON embedded in agent body    | Move to `references/` or external file     |
| Repeating instructions across agents | Single instruction file + `applyTo` glob   |
| Reading entire files when grep works | Use `grep_search` for targeted extraction  |
| Long sessions without a boundary     | Consider a permitted handoff or checkpoint |
| `create_file` to revise a file       | Use an available editing tool (below) |

## Targeted Edits Over Full Rewrites

**Rule**: Use `create_file` only for first-time artifact creation.
Use an available editing tool, including `apply_patch`, for existing files.

| Situation                                       | Correct tool                    |
| ----------------------------------------------- | ------------------------------- |
| Initial draft of any file                       | `create_file`                   |
| Single-spot fix                                 | Targeted edit or `apply_patch`  |
| Multiple independent fixes                      | Batched edits or `apply_patch` |
| Structural rewrite (≥ 50 % lines or H2 reorder) | Editing tool with logged rationale |

Batch independent accepted fixes where practical; validate before dependent follow-up edits.
Targeted edits avoid re-emitting unchanged content. Actual token costs depend on the payload,
model, and runtime; quantify savings only from recorded, reproducible usage, not fixed line-count multipliers.

**Exception logging**: when a full rewrite is genuinely required
(template bump, > 50 % of lines changed, H2 reordering), record the
rationale via `apex-recall decide ... --rationale "Full rewrite: <reason>"`
so the choice is auditable.

## Runtime Compression

When loading an artifact file (under `agent-output/`), check conversation length.
If estimated context usage exceeds 60% of the model limit, use the artifact
compression tier system from the `apex-context-management` skill (Mode A: Runtime
Compression):

1. **Read** `.github/skills/apex-context-management/SKILL.md` for artifact tier definitions
2. Select tier: `full` (<60%), `summarized` (60-80%), `minimal` (>80%)
3. Apply compression template for the specific artifact being loaded
4. Compress older/less-critical artifacts first when loading multiple files

The tier system applies to artifacts in `agent-output/`. Skills are
single-tier (`SKILL.md`); reuse unchanged content still available in context.
Refresh required content after edits, compaction, or a new chat rather than guessing.

## Skill Loading

Load the skills required by the current phase; defer optional references.
Runtime compression tiers apply to artifacts, not alternate skill digests.
Compaction must not prevent loading missing required guidance for a later phase.

Local prompt files and configured discovery locations are not Agent Host routing
contracts. Shared skills inherit the caller's model/tools; select the owning agent
before consequential work. Keep essential runtime rules reachable from agent bodies:
authoring `applyTo` matches alone do not prove runtime attachment. Preview hooks
are complementary checks, not the sole approval or security gate.
