---
name: context-management
description: '**UTILITY SKILL** — Two-mode context-window management. RUNTIME: artifact compression (full/summarized/minimal) used by orchestrator and codegen agents. AUDIT: post-mortem analysis of Copilot debug logs (token profiling, redundancy + hand-off gap detection) used by 11-Context Optimizer. WHEN: "context optimization", "token budget", "runtime compression", "log parsing". DO NOT USE FOR: infra, IaC code, deployments.'
compatibility: Audit mode requires Python 3.14 for log parser script
---

# Context Management Skill

Unified context-window management with two distinct lifecycles:

- **Runtime Compression** — what an agent does _before loading_ a large
  artifact to stay under the model context limit (during workflow execution).
- **Diagnostic Audit** — what the 11-Context Optimizer agent does
  _after the fact_ to find waste in agent definitions, instructions, and
  skill loads.

The two modes do not depend on each other — pick the section that matches
your need.

---

## Mode A: Runtime Compression

> Replaces the legacy `context-shredding` skill.

### When to Use Runtime Compression

- Before loading a predecessor artifact file (01 through 07)
- When conversation length suggests >60% of model context is used
- When an agent needs to load multiple large artifacts

### Compression Tiers

| Tier         | Context Usage | Strategy                                   |
| ------------ | ------------- | ------------------------------------------ |
| `full`       | < 60%         | Load entire artifact — no compression      |
| `summarized` | 60-80%        | Load key H2 sections only                  |
| `minimal`    | > 80%         | Load decision summaries only (< 500 chars) |

### Hard Token Checkpoints

Percentages are advisory; absolute input-token counts override them.
gpt-5.5 hard-checkpoints at ≥300K input; claude-opus-4.7 at ≥160K. When
hit, emit a compaction message and switch every further read to the
`minimal` tier. Full per-model table, checkpoint procedure (4 steps), and
background context (nordic-foods saturation event) in
[`references/hard-checkpoints.md`](references/hard-checkpoints.md).

### Rules

1. **Estimate context usage** — count approximate conversation tokens
2. **Select tier** based on the thresholds above
3. **Apply compression template** from
   [`references/compression-templates.md`](references/compression-templates.md)
4. If loading multiple artifacts, compress the older / less-critical ones first

### Steps

```text
1. Estimate current context usage (rough: 1 token ≈ 4 chars)
2. Check model limit (Claude family: 200K, GPT-5 family: 400K)
3. Calculate usage percentage and check hard-checkpoint table
4. Select tier:
   < 60%  → full (no compression needed)
   60-80% → summarized (key sections only)
   > 80%  → minimal (decision summaries only)
5. Load artifact/skill using the appropriate variant
```

### Skill Loading

Skills are single-tier — one file per skill, no digest / minimal variants.
Load each `SKILL.md` only once per session; defer `references/*.md` until
the SKILL.md body explicitly points to one. Full protocol in
[`references/skill-loading.md`](references/skill-loading.md).

---

## Mode B: Diagnostic Audit

> Replaces the legacy `context-optimizer` skill.

Structured methodology for auditing how GitHub Copilot agents consume their
context window. Identifies waste, recommends hand-off points, and produces
prioritised optimisation reports.

### When to Use Diagnostic Audit

- Auditing context-window efficiency across a multi-agent system
- Identifying where to introduce subagent hand-offs
- Reducing redundant file reads and skill loads
- Optimising instruction file `applyTo` glob patterns
- Profiling per-turn token cost from debug logs
- Porting agent optimisations to a new project

### Audit Capabilities & Prerequisites

Capabilities cover log parsing, turn-cost profiling, redundancy detection,
hand-off gap analysis, instruction audit, and structured report generation.
Prerequisites: Python 3.14, VS Code Copilot Chat debug logs, and
`.github/agents/*.agent.md` (or equivalent). Full capability matrix,
portability checklist, and debug-log discovery in
[`references/audit-setup.md`](references/audit-setup.md).

### Analysis Methodology

For the complete methodology — log format reference (`ccreq` line parsing,
request types, latency heuristics), Steps 1-5 (log parsing → optimisation
recommendations), common optimisation patterns, and baseline comparison
workflow (Phase 0 + Phase 6) — read
[`references/analysis-methodology.md`](references/analysis-methodology.md).

### Report Template

See [`templates/optimization-report.md`](templates/optimization-report.md)
for the full output template.

---

## Reference Index

Load on demand:

| Reference                             | Mode    | When to Load                                                               |
| ------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `references/compression-templates.md` | Runtime | Per-artifact H2 sections per tier                                          |
| `references/hard-checkpoints.md`      | Runtime | Hitting a model token threshold or wiring agent checkpoint logic           |
| `references/skill-loading.md`         | Runtime | Multi-skill loads / clarifying single-tier load protocol                   |
| `references/token-estimation.md`      | Audit   | Estimating token counts for context optimisation                           |
| `references/analysis-methodology.md`  | Audit   | Log format, 5-step methodology, optimisation patterns, baseline comparison |
| `references/audit-setup.md`           | Audit   | Prerequisites, enabling debug logs, audit capabilities, portability        |
| `scripts/parse-chat-logs.py`          | Audit   | Log parser producing structured JSON                                       |
| `templates/optimization-report.md`    | Audit   | Report output template                                                     |
