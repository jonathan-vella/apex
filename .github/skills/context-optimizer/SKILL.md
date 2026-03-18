---
name: context-optimizer
description: "Audits agent context window usage via debug logs, token profiling, and redundancy detection. USE FOR: context optimization, token waste analysis, debug log parsing, hand-off gap analysis. DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture design, deployments."
compatibility: Requires Python 3.10+ for log parser script
---

# Context Window Optimization Skill

Structured methodology for auditing how GitHub Copilot agents consume their
context window. Identifies waste, recommends hand-off points, and produces
prioritized optimization reports.

---

## When to Use This Skill

- Auditing context window efficiency across a multi-agent system
- Identifying where to introduce subagent hand-offs
- Reducing redundant file reads and skill loads
- Optimizing instruction file `applyTo` glob patterns
- Profiling per-turn token cost from debug logs
- Porting agent optimizations to a new project

---

## Quick Reference

| Capability            | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| Log Parsing           | Extract structured data from Copilot Chat debug logs         |
| Turn-Cost Profiling   | Estimate token spend per turn from timing and model metadata |
| Redundancy Detection  | Find duplicate file reads, overlapping instructions          |
| Hand-Off Gap Analysis | Identify agents that should delegate to subagents            |
| Instruction Audit     | Flag overly broad globs and oversized instruction files      |
| Report Generation     | Structured markdown report with prioritized recommendations  |

---

## Prerequisites

- Python 3.10+ (for log parser script)
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

---

## Analysis Methodology

📋 **Reference**: Read `references/analysis-methodology.md` for the complete methodology including:

- **Log Format Reference** — `ccreq` line parsing, request types, latency heuristics
- **Steps 1-5** — Log parsing, turn-cost profiling, agent definition audit, context growth mapping, optimization recommendations
- **Common Optimization Patterns** — Subagent extraction, instruction narrowing,
  progressive skill loading, prompt deduplication, context summarization
- **Baseline Comparison** — Automated snapshot/diff workflow (Phase 0 and Phase 6)

---

## Report Template

See `templates/optimization-report.md` for the full output template.

---

## Portability

This skill contains **no project-specific logic**. To use in another project:

1. Copy `.github/skills/context-optimizer/` to the target repo
2. Copy `.github/agents/11-context-optimizer.agent.md`
3. Copy `.github/instructions/context-optimization.instructions.md`
4. Copy `scripts/snapshot-agent-context.sh` and `scripts/diff-context-baseline.sh`
5. Adjust agent numbering if needed (11 is the slot used in this repo)
6. The log parser auto-discovers VS Code log directories

---

## References

- `scripts/parse-chat-logs.py` — Log parser producing structured JSON
- `templates/optimization-report.md` — Report output template
- `references/token-estimation.md` — Detailed token cost heuristics

---

## Reference Index

| Reference                            | When to Load                                                               |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `references/token-estimation.md`     | When estimating token counts for context optimization                      |
| `references/analysis-methodology.md` | Log format, 5-step methodology, optimization patterns, baseline comparison |
