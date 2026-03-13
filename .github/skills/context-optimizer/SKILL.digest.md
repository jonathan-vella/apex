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

> _See SKILL.md for full content._

## Log Format Reference

### Request Completion Lines (`ccreq`)

The primary signal. Each completed LLM request produces a line like:

```text
2026-02-27 08:03:29.492 [info] ccreq:c5f11ccd.copilotmd | success | claude-opus-4.6 -> claude-opus-4-6 | 6353ms | [panel/editAgent]
```

Fields:

| Position | Field        | Example                              | Meaning                     |
| -------- | ------------ | ------------------------------------ | --------------------------- |

> _See SKILL.md for full content._

## Analysis Methodology

### Step 1: Parse Logs

Run the log parser to extract structured data:

```bash
python3 .github/skills/context-optimizer/scripts/parse-chat-logs.py \
  --log-dir ~/.vscode-server/data/logs/ \
  --output /tmp/context-audit.json
```

The parser produces JSON with per-session request arrays.


> _See SKILL.md for full content._

## Common Optimization Patterns

### Pattern 1: Subagent Extraction

**Symptom**: Agent turn latency escalates past 15s after tool-heavy phase.

**Fix**: Extract the tool-heavy work into a subagent that returns a structured
result. Parent agent stays lean.

```text
Before: Agent A does planning (5K) + API calls (40K) + reporting (10K) = 55K
After:  Agent A does planning (5K) + delegates to Subagent (40K isolated) + reporting (15K) = 20K
```


> _See SKILL.md for full content._

## Report Template

See `templates/optimization-report.md` for the full output template.

---


## Baseline Comparison (Automated)

The agent automatically snapshots and diffs agent context files as part
of its 7-phase workflow (Phase 0 and Phase 6). No manual steps required.

### How It Works

1. **Phase 0** (auto): Runs `npm run snapshot:baseline -- ctx-opt-{timestamp}`
   before any analysis. Copies `.github/agents`, `.github/instructions`,
   `.github/prompts`, `.github/skills`, and `AGENTS.md` to
   `agent-output/_baselines/{label}/` with a `manifest.json`.
2. **Phases 1-5**: Normal analysis and recommendation workflow.
3. **Phase 6** (auto): After changes are applied, runs
   `npm run diff:baseline -- --baseline {label}` to generate a structured

> _See SKILL.md for full content._

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

| Reference                        | When to Load                                          |
| -------------------------------- | ----------------------------------------------------- |
| `references/token-estimation.md` | When estimating token counts for context optimization |

