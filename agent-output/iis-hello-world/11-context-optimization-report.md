# Context Window Optimization Report

**Generated**: 2026-03-06T05:15Z
**Sessions Analyzed**: 4
**Total Requests**: 849
**Time Range**: 2026-03-04 17:06 — 2026-03-06 05:15 (~36h)
**Baseline Label**: `ctx-opt-20260306-051521`

---

## Executive Summary

| Metric | Current | Target | Impact |
|---|---|---|---|
| Ultra-long turns (>30s) | 24 | ≤5 | Prevent context overflow & timeouts |
| Avg latency (panel/editAgent) | 8.7–9.8s | ≤6s | Faster user experience |
| Max turn latency | 199.6s | ≤60s | Eliminate near-timeout events |
| Conversation history summaries | 83s avg | N/A (hand-off sooner) | Prevent runaway context growth |
| Oversized skills (>200 lines) | 6 | 0 | ~6,000 tokens saved per load |
| Agents >250 body lines | 6 | 0 | ~4,000 tokens saved per agent |
| Broadest instruction stacking | 7 files for *.agent.md | ≤4 | ~1,200 tokens saved |

**Estimated total context savings**: ~8,000–15,000 tokens per agent session through the recommended changes below.

---

## Session Analysis

### Session 0 (Mar 4, 12.6h) — Heaviest Session

| Metric | Value |
|---|---|
| Total requests | 499 |
| Models used | claude-opus-4-6 (44%), gpt-4o-mini (23%), gemini-3.1-pro (22%), claude-sonnet-4-6 (10%) |
| Avg latency (editAgent) | 9,807ms |
| Long turns (>15s) | 46 |
| Ultra-long turns (>30s) | **12** (CRITICAL) |
| Worst turn | **199,581ms** (~3.3 minutes) |
| Burst patterns | 89 |
| Subagent avg latency | 23,636ms |

**Key signal**: 12 ultra-long turns suggest the context window was near-saturated multiple times. The 199.6s turn is almost certainly a near-timeout event where the model struggled with an oversized context.

### Session 2 (Mar 5, 1.1h) — Multi-Model Session

| Metric | Value |
|---|---|
| Total requests | 238 |
| Models used | 10 distinct models |
| `summarizeConversationHistory-full` avg | **83,261ms** |
| Long turns (>15s) | 16 |
| Ultra-long turns (>30s) | 7 |

**Key signal**: Two conversation history summarization calls averaged 83s each — these fire when context grows too large and Copilot attempts compression. This is a symptom, not a cause: the underlying issue is context accumulated without hand-offs.

### Session 3 (Mar 6, 21m) — Current Session (Conductor + Subagents)

| Metric | Value |
|---|---|
| Total requests | 102 |
| Models used | claude-opus-4-6 (51%), gpt-4o-mini (25%), gpt-5.4 (10%) |
| Requirements subagent avg | 18,475ms (16 calls) |
| Architect subagent avg | 17,713ms (13 calls) |
| Ultra-long turns (>30s) | 5 |
| Worst turn | **115,463ms** (Architect subagent) |

**Key signal**: The Requirements and Architect subagents are consistently heavy (18–19s avg). The worst Architect call took 115s, suggesting it loaded too much context (skills + instructions + conversation history) for a single turn.

---

## Finding Categories

### Critical — Context Overflow Risk

#### C1: Conversation History Summarization Triggered Too Often

**Evidence**: 3 `summarizeConversationHistory-full` calls across sessions, averaging 57–83s each.

**Root cause**: Agents accumulate context through long conversations without delegating to subagents at natural breakpoints.

**Impact**: When summarization fires, the model spends 60–90s just compressing previous context — wasted time and token budget.

**Fix**: Introduce explicit hand-off points (see Recommended Hand-Off Points below). The Conductor should checkpoint and delegate rather than continuing in the same context.

#### C2: 199-Second Turn in Session 0

**Evidence**: Single `panel/editAgent` turn at 199,581ms.

**Root cause**: Accumulated context reached near-maximum. The model likely processed 150K+ tokens input plus generating output.

**Impact**: Near-timeout. Users may experience apparent hangs.

**Fix**: Address through subagent extraction (see Pattern 1 below).

---

### High — Significant Token Waste

#### H1: Six Agent Definitions Exceed 250 Body Lines

| Agent | Body Lines | Total Lines | Est. Tokens |
|---|---|---|---|
| 01-Conductor | 280 | 418 | ~1,400 |
| 03-Architect | 272 | 383 | ~1,360 |
| 02-Requirements | 268 | 360 | ~1,340 |
| 11-Context Optimizer | 254 | 285 | ~1,270 |
| 07t-Terraform Deploy | 235 | 333 | ~1,175 |
| 07b-Bicep Deploy | 220 | 323 | ~1,100 |

The golden principles target is ≤200 body lines. Every line beyond that costs tokens on every turn.

**Fix**: Extract inline tables, workflow descriptions, and DO/DON'T blocks into skill `references/` files. Agent bodies should contain workflow logic and pointers, not reference material.

#### H2: Conductor Has 49 Tools (Most of Any Agent)

**Evidence**: 01-Conductor: 49 tools, 11 agents, 14 handoffs. At ~75 tokens per tool schema average, that's ~3,675 tokens just for tool definitions.

**Impact**: Tool schemas are loaded into every turn's system prompt. The Conductor pays this cost on all 373 `panel/editAgent` turns per session.

**Fix**: The Conductor primarily delegates to other agents. It doesn't need terminal execution tools, notebook tools, or Azure resource graph tools directly. Reduce to orchestration-essentials: `agent`, `todo`, `search/*`, `read/readFile`, `edit/editFiles`, `edit/createFile`, `web/fetch`. Target: ≤20 tools.

#### H3: Six Skills Exceed 200-Line Threshold Without Full Progressive Loading

| Skill | Lines | Has `references/` | Issue |
|---|---|---|---|
| github-operations | 330 | refs:1 | Most content inline — only 1 reference file |
| context-optimizer | 302 | refs:1 | Log format reference could be extracted |
| azure-adr | 262 | none | No references directory at all |
| make-skill-template | 262 | none | Template examples should be in references |
| docs-writer | 235 | refs:3 | Still oversized with 3 references |
| microsoft-skill-creator | 230 | none | Investigation templates should be in references |

**Fix**: For each skill >200 lines, extract detailed reference content into `references/` subdirectory. SKILL.md body should be the "map" (≤200 lines) that points to deeper "manual" content.

#### H4: Code-Commenting Instruction Is 200 Lines

`code-commenting.instructions.md` (200 lines) loads for every code file (`**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}`). Combined with `code-review.instructions.md` (67 lines) and `docs-trigger.instructions.md` (84 lines), editing any code file triggers ~351 lines of instruction context.

**Fix**: Trim `code-commenting.instructions.md` to ≤100 lines. Move detailed examples to a skill reference. Most of the file is JavaScript examples that don't apply to Bicep/Terraform edits.

---

### Medium — Optimization Opportunity

#### M1: Instruction Stacking on Agent Definition Files (~2,944 tokens)

When editing any `*.agent.md` file, 7 instruction files load:

| Lines | Instruction |
|---|---|
| 212 | agent-definitions.instructions.md |
| 120 | agent-research-first.instructions.md |
| 110 | context-optimization.instructions.md |
| 77 | markdown.instructions.md |
| 70 | azure-artifacts.instructions.md (FALSE POSITIVE — scoped to agent-output) |
| 124 | docs.instructions.md (FALSE POSITIVE — scoped to docs/) |
| 23 | no-heredoc.instructions.md |

**Corrected count**: 5 instructions truly match, ~542 lines (~2,168 tokens). Still heavy for editing agent definitions.

**Fix**: The `agent-definitions.instructions.md` at 212 lines is the single heaviest file. Consider moving the detailed frontmatter schema section to a skill reference, keeping the instruction file at ≤120 lines.

#### M2: `agent-research-first.instructions.md` Applies to 3 Broad File Categories

This 120-line instruction applies to `**/*.agent.md`, `**/agent-output/**/*.md`, and `**/.github/skills/**/SKILL.md`. It loads for agent editing, artifact generation, AND skill editing — contexts where "research first" mandates may not always be relevant.

**Fix**: Evaluate whether agent-output artifacts need the research-first mandate. Artifact files are outputs, not research contexts.

#### M3: Subagent Turns Are Consistently Expensive

| Subagent | Avg Latency | Requests | Total Time |
|---|---|---|---|
| tool/runSubagent (generic) | 23,636ms | 8 | ~189s |
| tool/runSubagent-02-Requirements | 18,475ms | 16 | ~296s |
| tool/runSubagent-03-Architect | 17,713ms | 13 | ~230s |
| tool/runSubagent-Explore | 8,465ms | 4 | ~34s |

Requirements and Architect subagents each inherit full tool sets (40-41 tools). Can their tool lists be trimmed for subagent invocation?

#### M4: Burst Patterns Indicate Tool-Call Loops

229 burst patterns (requests <2s apart) across all sessions. High burst counts correlate with tool-call sequences where the agent reads files, searches, and processes rapidly — each adding to the accumulated result context.

**Fix**: Agents should batch tool calls where possible (parallel reads) rather than sequential reads that accumulate individual results in context.

---

### Low — Minor Improvements

#### L1: `no-heredoc.instructions.md` on All Files

23 lines, `applyTo: "**"`. Minimal cost (~92 tokens) but applies universally.

**Assessment**: Acceptable. The cost is low and the protection against terminal file corruption is worth the overhead.

#### L2: Session 1 Was Trivially Short (10 Requests)

Session 1 (`20260305T054438`) had only 10 requests in <1 minute, likely a quick test or initial setup. No optimization needed.

#### L3: GitHubAPI 403 Errors on Team Membership

Recurring `403` errors on `api.github.com/teams/1682102/memberships/jonathan-vella` across all sessions. While not a context cost issue, these failed API calls may trigger retry logic that adds noise.

---

## Recommended Hand-Off Points

| Current Agent | Breakpoint | Delegation Target | Context Saved |
|---|---|---|---|
| 01-Conductor (280 body lines) | After gathering initial requirements | `02-Requirements` subagent (already exists) | ~15K tokens (avoid plan+execute in same context) |
| 02-Requirements | After askQuestions phase completes | New: `requirements-writer-subagent` | ~10K tokens (isolate Q&A accumulation from artifact generation) |
| 03-Architect | After cost estimation API calls | `cost-estimate-subagent` (already exists) | ~8K tokens (API results don't persist in parent) |
| 03-Architect | After WAF assessment written | Before generating diagrams/ADRs | ~5K tokens (assessment content stays in file, not context) |
| 07b/07t-Deploy | After what-if/plan analysis | Already delegated to subagents | Verify subagent hand-off is clean |

---

## Instruction Consolidation

| Action | Files Affected | Token Savings |
|---|---|---|
| Trim `code-commenting.instructions.md` from 200→100 lines | 1 file, all code edits | ~400 tokens per code-file edit |
| Trim `agent-definitions.instructions.md` from 212→120 lines | 1 file, agent edits | ~368 tokens per agent edit |
| Narrow `agent-research-first.instructions.md` — remove `**/agent-output/**/*.md` | 1 file, artifact outputs | ~480 tokens saved when generating artifacts |
| Move `governance-discovery.instructions.md` detailed REST API examples to skill reference | 1 file, governance files | ~400 tokens per governance edit |

---

## Agent-Specific Recommendations

### 01-Conductor (418 lines, 49 tools, 280 body lines)

- **Issue**: Most complex agent definition. 49 tools is the highest count. Body contains large workflow tables and handoff logic.
- **Recommendation**: (1) Reduce tool list to ≤20 orchestration-essential tools. (2) Move the DAG workflow ASCII art, step descriptions, and handoff matrix to `.github/skills/workflow-engine/references/`. (3) Target: 200 body lines.
- **Estimated Impact**: ~2,500 tokens saved per turn (tools + body reduction).

### 02-Requirements (360 lines, 40 tools, 268 body lines)

- **Issue**: Heavy body with inline askQuestions guidance and phase descriptions.
- **Recommendation**: (1) Extract the multi-phase Q&A workflow into a skill reference. (2) The Requirements agent primarily reads files and asks questions — trim tools to ≤25 (remove terminal execution, notebook, Azure resource graph tools it doesn't use).
- **Estimated Impact**: ~1,500 tokens saved per turn.

### 03-Architect (383 lines, 41 tools, 272 body lines)

- **Issue**: WAF assessment tables and pricing guidance inlined. 115s worst-case turn.
- **Recommendation**: (1) WAF pillar tables → `azure-defaults/references/waf-pillars.md`. (2) Cost estimation workflow → already has `cost-estimate-subagent`, ensure it's always delegated. (3) Trim tools to ≤30.
- **Estimated Impact**: ~1,800 tokens saved per turn.

### 07b-Bicep Deploy / 07t-Terraform Deploy (323/333 lines)

- **Issue**: Large inline PR workflow, deployment phases, error handling tables.
- **Recommendation**: Move PR creation workflow to `iac-common/references/pr-workflow.md`. Move deployment phases to `iac-common/references/deploy-phases.md`.
- **Estimated Impact**: ~800 tokens saved per turn each.

### Oversized Skills

| Skill | Lines | Recommendation |
|---|---|---|
| github-operations (330) | Move MCP tool reference tables, CLI fallback examples to `references/mcp-tools.md` |
| azure-adr (262) | Move ADR template and example to `references/adr-template.md` |
| make-skill-template (262) | Move scaffold template to `references/skill-scaffold.md` |
| docs-writer (235) | Move update rules matrix to `references/update-rules.md` |
| microsoft-skill-creator (230) | Move investigation templates to `references/investigation-workflow.md` |

---

## Implementation Priority

| Priority | Action | Effort | Impact |
|---|---|---|---|
| P0 | Reduce 01-Conductor tools from 49→≤20 | Low | ~2,200 tokens/turn saved |
| P0 | Extract 6 oversized skill bodies to `references/` | Medium | ~6,000 tokens total across loads |
| P1 | Trim 01-Conductor body from 280→200 lines | Low | ~400 tokens/turn |
| P1 | Trim 02-Requirements body from 268→200 lines | Low | ~340 tokens/turn |
| P1 | Trim 03-Architect body from 272→200 lines | Low | ~360 tokens/turn |
| P1 | Trim `code-commenting.instructions.md` from 200→100 lines | Low | ~400 tokens per code edit |
| P2 | Trim `agent-definitions.instructions.md` from 212→120 lines | Low | ~370 tokens per agent edit |
| P2 | Narrow `agent-research-first` applyTo scope | Trivial | ~480 tokens on artifact generation |
| P2 | Reduce 02-Requirements tools from 40→≤25 | Low | ~1,100 tokens/turn |
| P2 | Reduce 03-Architect tools from 41→≤30 | Low | ~800 tokens/turn |
| P3 | Move 07b/07t deploy inline PR workflow to skill reference | Low | ~400 tokens/turn each |
| P3 | Add explicit hand-off checkpoint after Requirements Q&A phase | Medium | Prevent context escalation |

---

## Appendix: Model Usage Distribution

| Model | Session 0 | Session 1 | Session 2 | Session 3 | Total |
|---|---|---|---|---|---|
| claude-opus-4-6 | 220 | 3 | 63 | 52 | 338 (40%) |
| gpt-4o-mini-2024-07-18 | 115 | 7 | 73 | 25 | 220 (26%) |
| gemini-3.1-pro-preview | 112 | — | — | — | 112 (13%) |
| copilot-nes-oct | — | — | 50 | 9 | 59 (7%) |
| claude-sonnet-4-6 | 51 | — | 16 | — | 67 (8%) |
| Other (7 models) | 1 | — | 36 | 16 | 53 (6%) |

## Appendix: Request Type Distribution

| Request Type | Count | Avg Latency | Purpose |
|---|---|---|---|
| panel/editAgent | 499 | 9,340ms | Main agent turns |
| copilotLanguageModelWrapper | 188 | 748ms | Extension/subagent LLM calls |
| XtabProvider | 59 | 616ms | Tab completion predictions |
| tool/runSubagent-* | 41 | 18,700ms | Subagent delegations |
| nes.nextCursorPosition | 24 | 668ms | Cursor prediction |
| title | 15 | 724ms | Conversation title generation |
| progressMessages | 8 | 1,242ms | Status indicators |
| promptCategorization | 9 | 1,275ms | Prompt routing |
| summarizeConversationHistory | 3 | 64,870ms | Context compression (CRITICAL) |

---

## Phase 6: Diff Baseline

No changes have been applied yet. When ready, run:

```bash
npm run diff:baseline -- --baseline ctx-opt-20260306-051521
```

This will generate a structured diff report at `agent-output/_baselines/ctx-opt-20260306-051521/diff-report.md`.
