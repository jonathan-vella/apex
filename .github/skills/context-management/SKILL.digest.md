<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Context Management Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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
> _See SKILL.md for full content._

## Tier Selection Protocol
> _See SKILL.md for full content._

## Skill Loading Tiers

Skills have three compression tiers. The default for context-window-optimized
agents is `SKILL.digest.md` (no longer `SKILL.md`). `SKILL.minimal.md` is the
escalation for >80% context utilization or when the caller passes an explicit
minimal-mode flag. The full `SKILL.md` is reserved for skill-authoring or
debugging contexts where the digest is insufficient.
> _See SKILL.md for full content._

## When to Use Diagnostic Audit

- Auditing context window efficiency across a multi-agent system
- Identifying where to introduce subagent hand-offs
- Reducing redundant file reads and skill loads
- Optimizing instruction file `applyTo` glob patterns
- Profiling per-turn token cost from debug logs
> _See SKILL.md for full content._

## Audit Capabilities

| Capability            | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| Log Parsing           | Extract structured data from Copilot Chat debug logs         |
| Turn-Cost Profiling   | Estimate token spend per turn from timing and model metadata |
| Redundancy Detection  | Find duplicate file reads, overlapping instructions          |
> _See SKILL.md for full content._

## Audit Prerequisites

- Python 3.14 (for log parser script)
- Access to VS Code Copilot Chat debug logs
- Agent definitions in `.github/agents/*.agent.md` (or equivalent)

### Enabling Debug Logs
> _See SKILL.md for full content._

## Analysis Methodology

📋 **Reference**: Read `references/analysis-methodology.md` for the complete
methodology including:

- **Log Format Reference** — `ccreq` line parsing, request types, latency heuristics
- **Steps 1-5** — Log parsing, turn-cost profiling, agent definition audit,
> _See SKILL.md for full content._

## Report Template

See `templates/optimization-report.md` for the full output template.

## Portability

The audit mode contains **no project-specific logic**. To use in another project:

1. Copy `.github/skills/context-management/` to the target repo
2. Copy `.github/agents/11-context-optimizer.agent.md`
3. Copy `.github/instructions/context-optimization.instructions.md`
> _See SKILL.md for full content._
