<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Context Window Optimization Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

- Auditing context window efficiency across a multi-agent system
- Identifying where to introduce subagent hand-offs
- Reducing redundant file reads and skill loads
- Optimizing instruction file `applyTo` glob patterns
- Profiling per-turn token cost from debug logs
- Porting agent optimizations to a new project

> _See SKILL.md for full content._

## Quick Reference

| Capability            | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| Log Parsing           | Extract structured data from Copilot Chat debug logs         |
| Turn-Cost Profiling   | Estimate token spend per turn from timing and model metadata |
| Redundancy Detection  | Find duplicate file reads, overlapping instructions          |
| Hand-Off Gap Analysis | Identify agents that should delegate to subagents            |

> _See SKILL.md for full content._

## Prerequisites

- Python 3.10+ (for log parser script)
- Access to VS Code Copilot Chat debug logs
- Agent definitions in `.github/agents/*.agent.md` (or equivalent)

### Enabling Debug Logs

> _See SKILL.md for full content._

## Analysis Methodology

📋 **Reference**: Read `references/analysis-methodology.md` for the complete methodology including:

- **Log Format Reference** — `ccreq` line parsing, request types, latency heuristics
- **Steps 1-5** — Log parsing, turn-cost profiling, agent definition audit, context growth mapping, optimization recommendations
- **Common Optimization Patterns** — Subagent extraction, instruction narrowing, progressive skill loading, prompt deduplication, context summarization
- **Baseline Comparison** — Automated snapshot/diff workflow (Phase 0 and Phase 6)

> _See SKILL.md for full content._

## Report Template

See `templates/optimization-report.md` for the full output template.

---
