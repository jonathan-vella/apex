---
name: context-management
description: "Two-mode context window management for agents. RUNTIME mode: tier-based compression (full/summarized/minimal) used by orchestrator and codegen agents before loading large artifacts. AUDIT mode: post-mortem analysis of Copilot debug logs, token profiling, redundancy detection, and hand-off gap analysis used by the 11-Context Optimizer agent. USE FOR: context optimization, token budget management, runtime compression, log parsing, redundancy detection. DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture design, deployments."
compatibility: Audit mode requires Python 3.14 for log parser script
---

# Context Management Skill

Unified context window management for agents in this repository. Covers two
distinct lifecycles:

- **Runtime Compression** — what an agent does *before loading* a large artifact
  to stay under the model context limit (used during workflow execution).
- **Diagnostic Audit** — what the 11-Context Optimizer agent does *after the fact*
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

## Action Rules

Before loading any artifact file:

1. **Estimate context usage** — count approximate conversation tokens
2. **Select tier** based on the thresholds above
3. **Apply compression template** from `references/compression-templates.md`
4. If loading multiple artifacts, compress the older/less-critical ones first

## Tier Selection Protocol

```text
1. Estimate current context usage (rough: 1 token ≈ 4 chars)
2. Check model limit (Opus: 200K, GPT-5.3-Codex: 128K)
3. Calculate usage percentage
4. Select tier:
   < 60%  → full (no compression needed)
   60-80% → summarized (key sections only)
   > 80%  → minimal (decision summaries only)
5. Load artifact/skill using the appropriate variant
```

## Skill Loading Tiers

Skills have three compression tiers. The default for context-window-optimized
agents is `SKILL.digest.md` (no longer `SKILL.md`). `SKILL.minimal.md` is the
escalation for >80% context utilization or when the caller passes an explicit
minimal-mode flag. The full `SKILL.md` is reserved for skill-authoring or
debugging contexts where the digest is insufficient.

| Context Usage / Mode              | Skill Variant      | Approx Tokens |
| --------------------------------- | ------------------ | ------------- |
| **Default** (any utilization)     | `SKILL.digest.md`  | 150-320       |
| > 80% utilization or minimal flag | `SKILL.minimal.md` | 40-100        |
| Skill authoring / debugging only  | `SKILL.md`         | 400-800       |

All skill directories in this repository ship a `SKILL.digest.md` file, so
no missing-digest fallback path is needed.

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

| Capability            | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| Log Parsing           | Extract structured data from Copilot Chat debug logs         |
| Turn-Cost Profiling   | Estimate token spend per turn from timing and model metadata |
| Redundancy Detection  | Find duplicate file reads, overlapping instructions          |
| Hand-Off Gap Analysis | Identify agents that should delegate to subagents            |
| Instruction Audit     | Flag overly broad globs and oversized instruction files      |
| Report Generation     | Structured markdown report with prioritized recommendations  |

## Audit Prerequisites

- Python 3.14 (for log parser script)
- Access to VS Code Copilot Chat debug logs
- Agent definitions in `.github/agents/*.agent.md` (or equivalent)

### Enabling Debug Logs

Copilot Chat writes debug logs automatically to the VS Code log directory.
To find the latest logs:

```bash
find ~/.vscode-server/data/logs/ -name "GitHub Copilot Chat.log" -newer /tmp/marker 2>/dev/null \
  | sort | tail -5
```

For richer output, set `github.copilot.advanced.debug.overrideLogLevels`
in VS Code settings to capture verbose tool-call data.

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

The audit mode contains **no project-specific logic**. To use in another project:

1. Copy `.github/skills/context-management/` to the target repo
2. Copy `.github/agents/11-context-optimizer.agent.md`
3. Copy `.github/instructions/context-optimization.instructions.md`
4. Copy `tools/scripts/snapshot-agent-context.sh` and
   `tools/scripts/diff-context-baseline.sh`
5. Adjust agent numbering if needed (11 is the slot used in this repo)
6. The log parser auto-discovers VS Code log directories

---

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                            | Mode    | When to Load                                                               |
| ------------------------------------ | ------- | -------------------------------------------------------------------------- |
| `references/compression-templates.md` | Runtime | Per-artifact H2 sections per tier                                          |
| `references/token-estimation.md`     | Audit   | When estimating token counts for context optimization                      |
| `references/analysis-methodology.md` | Audit   | Log format, 5-step methodology, optimization patterns, baseline comparison |
| `scripts/parse-chat-logs.py`         | Audit   | Log parser producing structured JSON                                       |
| `templates/optimization-report.md`   | Audit   | Report output template                                                     |
