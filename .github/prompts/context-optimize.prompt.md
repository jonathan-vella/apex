---
description: "Run a full context window optimization audit across all agents, skills, and instructions. Produces a prioritized report with actionable recommendations."
agent: "11-Context Optimizer"
model: Claude Opus 4.6
tools:
  - execute/runInTerminal
  - execute/getTerminalOutput
  - read/readFile
  - read/problems
  - read/terminalLastCommand
  - read/terminalSelection
  - search/codebase
  - search/fileSearch
  - search/listDirectory
  - search/textSearch
  - edit/createFile
  - edit/editFiles
  - web/fetch
  - todo
  - vscode/askQuestions
  - agent
---

# Context Window Optimization Audit

## Mission

Perform a comprehensive context window utilization audit across all agents,
skills, and instruction files in this repository. Identify wasted tokens,
redundant context loads, missing hand-off points, and overly broad globs.
Produce a structured optimization report with prioritized, actionable
recommendations.

## Scope & Preconditions

- Analyze the latest Copilot Chat debug log session(s)
- Audit every agent definition in `.github/agents/*.agent.md`
- Audit every skill in `.github/skills/*/SKILL.md`
- Audit every instruction file in `.github/instructions/*.instructions.md`
- Save the report to `agent-output/{project}/11-context-optimization-report.md`

## Inputs

- Chat debug logs: auto-discovered from `~/.vscode-server/data/logs/`
- Agent definitions: `.github/agents/*.agent.md`
- Skills: `.github/skills/*/SKILL.md`
- Instructions: `.github/instructions/*.instructions.md`

## Workflow

### Phase 1 — Discovery & Log Collection

1. Read `AGENTS.md` for the agent roster and project map
2. Read `.github/skills/context-optimizer/SKILL.md` for analysis methodology
3. Locate Copilot Chat debug logs using:
   ```bash
   find ~/.vscode-server/data/logs/ -name "GitHub Copilot Chat.log" 2>/dev/null | sort | tail -10
   ```
4. Run the log parser to extract structured data:
   ```bash
   python3 .github/skills/context-optimizer/scripts/parse-chat-logs.py \
     --log-dir ~/.vscode-server/data/logs/ \
     --output /tmp/context-audit.json
   ```
5. Present a session summary (total requests, models, time range)
6. Ask which session(s) to analyze in depth (default: all recent)

### Phase 2 — Turn-Cost Profiling

For each session:

- Count total `ccreq` entries and group by session ID
- Calculate average latency per model (Opus, GPT-5.3-Codex, gpt-4o-mini)
- Identify long-tail turns (> 15s latency) — flag as context-heavy
- Detect burst patterns (< 2s gap between calls = likely tool-call loop)
- Map latency escalation trends (context growing without hand-offs)
- Classify request types (editAgent, title, progressMessages, subagent)

### Phase 3 — Agent Definition Audit

For each agent file, check and report:

| Check                       | Flag Threshold                            |
| --------------------------- | ----------------------------------------- |
| Tool count                  | > 30 tools                                |
| Body length                 | > 300 lines                               |
| Inline templates/blocks     | Large fenced blocks that belong in skills |
| Missing handoffs            | Phases that should delegate but don't     |
| Broad "read all" directives | Loading unneeded context                  |
| Duplicate guidance          | Same content in agent body + instruction  |

### Phase 4 — Instruction & Skill Audit

For each instruction and skill file:

| Check                   | Flag When                                     |
| ----------------------- | --------------------------------------------- |
| `applyTo: "**"` glob    | Loads on every file type — is this justified? |
| File size > 150 lines   | Should split using progressive loading        |
| Content redundancy      | > 40% overlap with another file               |
| Missing Level 2/3 split | Large skill without `references/` structure   |

### Phase 5 — Report Generation

Write the report to `agent-output/{project}/11-context-optimization-report.md`
using the template from the skill. Include:

- Executive summary table (current vs target metrics)
- Findings by severity (Critical → Low)
- Recommended hand-off points with estimated token savings
- Instruction consolidation opportunities
- Agent-specific recommendations
- Implementation priority matrix (effort vs impact)

## Output Expectations

- **File**: `agent-output/{project}/11-context-optimization-report.md`
- **Format**: Markdown with tables, severity-coded sections
- **Content**: Every finding must include issue, recommendation, and estimated impact
- **Actionable**: Each recommendation should specify which file to change and how

## Quality Assurance

- [ ] All agent definitions were analyzed (count matches `.github/agents/`)
- [ ] All instruction files were audited (count matches `.github/instructions/`)
- [ ] All skills were audited (count matches `.github/skills/`)
- [ ] Log parser ran successfully or manual analysis was performed
- [ ] Report follows the template in the context-optimizer skill
- [ ] Findings are prioritized (P0 → P3)
- [ ] Token savings estimates are included for each recommendation
