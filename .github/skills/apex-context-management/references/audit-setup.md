<!-- ref:audit-setup-v1 -->

# Audit Mode Prerequisites & Setup

> Loaded by `apex-context-management` SKILL.md (Audit mode). Covers what must be
> in place before running a context-window audit and how to enable richer
> native Copilot SDK event logs inside VS Code.

## Prerequisites

- Python 3.14 (for log parser script)
- Access to repository-scoped native SDK `events.jsonl` logs
- Agent definitions in `.github/agents/**/*.agent.md`, including `_subagents/` (or equivalent)

## Enabling Debug Logs

Native SDK sessions use `~/.copilot/session-state/<session-id>/events.jsonl`.
Discover and profile only sessions matching the repository:

```bash
python3 .github/skills/apex-context-management/scripts/parse-chat-logs.py \
  --repository . --latest 1 --summary-only
```

Use [scoped log export](debug-log-export.md) for an explicit selected capture.
Workspace text logs are supplementary, not substitutes for native attribution or usage.
Treat all logs as sensitive; redaction does not certify safe sharing.

## Audit Capabilities

| Capability            | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| Log Parsing | Normalize native events through the shared profiler; retain historical readers |
| Turn-Cost Profiling   | Report recorded tokens separately from timing; missing usage is unknown |
| Redundancy Detection  | Find duplicate file reads, overlapping instructions          |
| Hand-Off Gap Analysis | Identify agents that should delegate to subagents            |
| Instruction Audit     | Flag overly broad globs and oversized instruction files      |
| Report Generation     | Structured markdown report with prioritized recommendations  |

## Portability

The audit mode contains **no project-specific logic**. To use in another project:

1. Copy `.github/skills/apex-context-management/` and its shared
   `tools/scripts/profile_debug_log.py` / `tools/scripts/export-sdk-logs.py` dependencies
2. Copy `.github/agents/11-context-optimizer.agent.md`
3. Copy `.github/instructions/context-optimization.instructions.md`
4. Copy `tools/scripts/snapshot-agent-context.sh` and
   `tools/scripts/diff-context-baseline.sh`
5. Adjust agent numbering if needed (11 is the slot used in this repo)
6. The parser discovers native sessions by exact repository identity; never collect unrelated workspaces
