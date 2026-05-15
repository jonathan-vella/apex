---
name: context-management
description: '**UTILITY SKILL** — Two-mode context-window management. RUNTIME: artifact compression (full/summarized/minimal) used by orchestrator and codegen agents. AUDIT: post-mortem analysis of Copilot debug logs (token profiling, redundancy + hand-off gap detection) used by 11-Context Optimizer. WHEN: "context optimization", "token budget", "runtime compression", "log parsing". DO NOT USE FOR: infra, IaC code, deployments.'
compatibility: Audit mode requires Python 3.14 for log parser script
---

# Context Management Skill

Unified context window management for agents in this repository. Covers two
distinct lifecycles:

- **Runtime Compression** — what an agent does _before loading_ a large artifact
  to stay under the model context limit (used during workflow execution).
- **Diagnostic Audit** — what the 11-Context Optimizer agent does _after the fact_
  to find waste in agent definitions, instructions, and skill loads.

Pick the section that matches your need. The two modes do not depend on each
other.

---

# Mode A: Runtime Compression

> Replaces the legacy `context-shredding` skill.

Runtime compression system that actively reduces context when agents approach
model limits. Agents check approximate context usage before loading artifact
files and select the appropriate compression tier.

## When to Use Runtime Compression

- Before loading a predecessor artifact file (01 through 07)
- When conversation length suggests >60% of model context is used
- When an agent needs to load multiple large artifacts

## Compression Tiers

| Tier         | Context Usage | Strategy                                   |
| ------------ | ------------- | ------------------------------------------ |
| `full`       | < 60%         | Load entire artifact — no compression      |
| `summarized` | 60-80%        | Load key H2 sections only                  |
| `minimal`    | > 80%         | Load decision summaries only (< 500 chars) |

## Hard Token Checkpoints (model-specific)

Percentages are advisory; absolute input-token counts override them for the
models below. When any LLM round-trip would ship more than the threshold,
the agent MUST emit a context-compaction checkpoint **before** the next
tool call and switch every further read to the `minimal` tier.

| Model               | Context limit | Hard checkpoint at | Action                                                                                                                          |
| ------------------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `gpt-5.5`           | 400K          | **≥300K input**    | Swap full plan + governance artifacts for `apex-recall show <project> --json` summaries; pin further skill reads to `SKILL.md`. |
| `gpt-5.3-codex`     | 400K          | ≥300K input        | Same protocol.                                                                                                                  |
| `claude-opus-4.7`   | 200K          | ≥160K input        | Same protocol; prefer `references/` lookups over re-reading source artifacts.                                                   |
| `claude-sonnet-4.6` | 200K          | ≥150K input        | Same protocol.                                                                                                                  |

Checkpoint procedure when a hard threshold is hit:

1. Emit a single ≤500-token message summarising every still-relevant
   artifact (plan resource list, governance Deny map, deployment phase,
   open decisions).
2. Replace any further reads of `04-implementation-plan.md`,
   `04-governance-constraints.md/.json`, or `02-architecture-assessment.md`
   with `apex-recall show <project> --json` (then `apex-recall search
<project> '<term>' --json` for targeted lookups).
3. Stop loading additional skills. Skills are single-tier (`SKILL.md`);
   if the parent skill is already in context, do not re-read it. Read only
   specific `references/` files when the SKILL.md body explicitly points
   to one.
4. Record the event: `apex-recall checkpoint <project> <step>
context_compacted_<threshold>K --json`.

Step 5 CodeGen agents (`06b-Bicep CodeGen`, `06t-Terraform CodeGen`) must
honour this rule \u2014 the gpt-5.5 main agent saturated at very large inputs in
the nordic-foods retro (May 2026); the 300K hard checkpoint is the trip-wire
that prevents recurrence on the 400K GPT-5 family budget.

## Rules

Before loading any artifact file:

1. **Estimate context usage** — count approximate conversation tokens
2. **Select tier** based on the thresholds above
3. **Apply compression template** from `references/compression-templates.md`
4. If loading multiple artifacts, compress the older/less-critical ones first

## Steps

```text
1. Estimate current context usage (rough: 1 token ≈ 4 chars)
2. Check model limit (Claude family: 200K, GPT-5 family: 400K)
3. Calculate usage percentage
4. Select tier:
   < 60%  → full (no compression needed)
   60-80% → summarized (key sections only)
   > 80%  → minimal (decision summaries only)
5. Load artifact/skill using the appropriate variant
```

## Skill Loading

Skills are single-tier: each skill has exactly one file, `SKILL.md`. There is
no digest or minimal variant. To stay under context budget:

1. **Load each `SKILL.md` only once per session.** Do not re-read a skill
   that is already in context.
2. **Read only the H2 sections needed.** Use `read_file` with a line range
   for known sections rather than loading the full body.
3. **Defer `references/*.md`** — load on demand only when the SKILL.md body
   explicitly points to one.

See Mode A (Runtime Compression) above for artifact-loading tiers; the
tier system applies to artifacts in `agent-output/`, not to skills.

---

# Mode B: Diagnostic Audit

> Replaces the legacy `context-optimizer` skill.

Structured methodology for auditing how GitHub Copilot agents consume their
context window. Identifies waste, recommends hand-off points, and produces
prioritized optimization reports.

## When to Use Diagnostic Audit

- Auditing context window efficiency across a multi-agent system
- Identifying where to introduce subagent hand-offs
- Reducing redundant file reads and skill loads
- Optimizing instruction file `applyTo` glob patterns
- Profiling per-turn token cost from debug logs
- Porting agent optimizations to a new project

## Audit Capabilities

Audit mode covers log parsing, turn-cost profiling, redundancy detection, hand-off gap
analysis, instruction audit, and structured report generation. Full capability matrix and
the portability checklist for porting the audit to another project live in
[`references/audit-setup.md`](references/audit-setup.md).

## Audit Prerequisites

Python 3.14, access to VS Code Copilot Chat debug logs, and `.github/agents/*.agent.md` (or
equivalent agent definitions). To find the latest debug logs and enable verbose tool-call
output, see [`references/audit-setup.md`](references/audit-setup.md).

## Analysis Methodology

📋 **Reference**: Read `references/analysis-methodology.md` for the complete
methodology including:

- **Log Format Reference** — `ccreq` line parsing, request types, latency heuristics
- **Steps 1-5** — Log parsing, turn-cost profiling, agent definition audit,
  context growth mapping, optimization recommendations
- **Common Optimization Patterns** — Subagent extraction, instruction narrowing,
  progressive skill loading, prompt deduplication, context summarization
- **Baseline Comparison** — Automated snapshot/diff workflow (Phase 0 and Phase 6)

## Report Template

See `templates/optimization-report.md` for the full output template.

## Portability

Audit mode is project-agnostic — see [`references/audit-setup.md`](references/audit-setup.md)
for the 6-step copy-and-adjust checklist when reusing it in another repo.

---

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                             | Mode    | When to Load                                                               |
| ------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `references/compression-templates.md` | Runtime | Per-artifact H2 sections per tier                                          |
| `references/token-estimation.md`      | Audit   | When estimating token counts for context optimization                      |
| `references/analysis-methodology.md`  | Audit   | Log format, 5-step methodology, optimization patterns, baseline comparison |
| `references/audit-setup.md`           | Audit   | Prerequisites, enabling debug logs, audit capabilities, portability        |
| `scripts/parse-chat-logs.py`          | Audit   | Log parser producing structured JSON                                       |
| `templates/optimization-report.md`    | Audit   | Report output template                                                     |
