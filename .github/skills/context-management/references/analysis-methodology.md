<!-- ref:analysis-methodology-v1 -->

# Context Optimization — Analysis Methodology

Detailed log format reference, step-by-step analysis methodology,
common optimization patterns, and baseline comparison automation.

---

## Log Format Reference

### Request Completion Lines (`ccreq`)

The primary signal. Each completed LLM request produces a line like:

```text
2026-02-27 08:03:29.492 [info] ccreq:c5f11ccd.copilotmd | success | claude-opus-4.7 -> claude-opus-4-7 | 6353ms | [panel/editAgent]
```

Fields:

| Position | Field        | Example                              | Meaning                     |
| -------- | ------------ | ------------------------------------ | --------------------------- |
| 1        | Timestamp    | `2026-02-27 08:03:29.492`            | When the response completed |
| 2        | Level        | `[info]`                             | Log level                   |
| 3        | Request ID   | `ccreq:c5f11ccd.copilotmd`           | Unique request identifier   |
| 4        | Status       | `success`                            | success / error / cancelled |
| 5        | Model        | `claude-opus-4.7 -> claude-opus-4-7` | Requested -> actual model   |
| 6        | Latency      | `6353ms`                             | Total response time         |
| 7        | Request type | `[panel/editAgent]`                  | What triggered the request  |

### Request Types

| Type                            | Meaning                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `[panel/editAgent]`             | Main agent turn (user prompt or tool-call continuation) |
| `[title]`                       | Auto-generated conversation title                       |
| `[progressMessages]`            | Status/progress indicator generation                    |
| `[copilotLanguageModelWrapper]` | Subagent or extension LLM call                          |

### Latency And Token Evidence

Report latency separately from tokens. Latency also includes model processing,
output generation, queuing, network delays, and tool/runtime behavior; it cannot determine context size.
Use recorded token-usage fields for token totals. Missing usage remains unknown, including timing-only logs.
Source bytes, tool counts, and slow turns can identify investigation targets, not measured token savings.

---

## Analysis Methodology

### Step 1: Parse Logs

Run the log parser to extract structured data to stdout (no export file):

```bash
python3 .github/skills/context-management/scripts/parse-chat-logs.py \
  --log-dir ~/.vscode-server/data/logs/
```

The parser produces JSON with per-session request arrays.

### Step 2: Profile Turn Costs

Group requests by session and analyze patterns:

- **Burst detection**: Rapid sequential calls (gap < 2s) suggest tool-call
  loops where context accumulates
- **Latency escalation**: Investigate slower turns against recorded usage, output size,
  tool activity, and runtime conditions; do not infer context growth from timing alone
- **Model mismatch**: Heavy turns on a low-tier model (e.g. GPT-5 mini, Claude Haiku 4.5) when an Opus/Sonnet agent was selected suggest wrong model routing;
  fast turns on Opus suggest the task could use a lighter model

### Step 3: Audit Agent Definitions

Discover `.github/agents/**/*.agent.md` recursively, including `_subagents/`.
For each file, estimate source-level context cost; leaf workers do not require
handoffs or delegation. These estimates are not observed token usage:

| Component              | Approximate Token Cost           |
| ---------------------- | -------------------------------- |
| System prompt overhead | ~2,000 tokens (VS Code baseline) |
| Tools (per tool)       | ~50-100 tokens each              |
| Handoff definitions    | ~30-50 tokens each               |
| Agent body text        | ~1 token per 4 characters        |
| Loaded instructions    | Varies by file size              |
| Loaded skills          | Varies by SKILL.md size          |

**Red flags**:

- Tool list > 30 items (~2,000+ tokens just for tool schemas)
- Agent body > 350 lines (~2,500+ tokens)
- Multiple `applyTo: "**"` instructions (~500+ tokens each, always loaded)

### Step 4: Map Context Growth

Trace how context accumulates through a conversation:

```text
Turn 1: System prompt + user message     → ~5K tokens
Turn 2: + assistant response + tool call → ~12K tokens
Turn 3: + tool result + response         → ~25K tokens
Turn 4: + file read (large) + response   → ~45K tokens
...
Turn N: Near model context limit         → Quality degrades
```

**Hand-off trigger points**:

- Context estimated > 60% of model limit
- Task completion boundary (e.g., planning done, execution starting)
- Tool-heavy phase transition (querying APIs → processing results)
- Domain shift (infrastructure → application → documentation)

### Step 5: Recommend Optimizations

Priority framework (effort vs impact):

| Priority | Criteria                              | Example                             |
| -------- | ------------------------------------- | ----------------------------------- |
| P0       | Prevents context overflow / data loss | Add subagent for API-heavy phase    |
| P1       | Saves > 5K tokens per session         | Narrow `applyTo` globs              |
| P2       | Saves 1-5K tokens per session         | Trim agent body length              |
| P3       | Marginal improvement                  | Reorder instructions for early exit |

---

## Common Optimization Patterns

### Pattern 1: Subagent Extraction

**Symptom**: Agent turn latency escalates past 15s after tool-heavy phase.

**Fix**: Extract the tool-heavy work into a subagent that returns a structured
result. Parent agent stays lean.

```text
Before: Agent A does planning (5K) + API calls (40K) + reporting (10K) = 55K
After:  Agent A does planning (5K) + delegates to Subagent (40K isolated) + reporting (15K) = 20K
```

### Pattern 2: Instruction Narrowing

**Symptom**: Many instruction files have `applyTo: "**"` but only matter for
specific file types.

**Fix**: Narrow the glob to `**/*.{ts,tsx}` or `**/*.bicep` etc.

### Pattern 3: Progressive Skill Loading

**Symptom**: Agent reads entire SKILL.md (400 lines) when only 1 section is needed.

**Fix**: Move detailed content to `references/` subdirectory. SKILL.md stays
< 200 lines with pointers. Copilot loads Level 3 resources only when referenced.

### Pattern 4: Prompt Deduplication

**Symptom**: Same guidance appears in agent body AND instruction file AND skill.

**Fix**: Single source of truth — put it in the most specific location.
Agent body → for workflow-specific rules. Instruction → for file-type rules.
Skill → for domain knowledge.

### Pattern 5: Context Summarization at Hand-Off

**Symptom**: Subagent receives raw conversation history instead of a structured brief.

**Fix**: Parent agent compiles a focused summary before delegating:

```text
Instead of: "Here's everything we discussed..."
Do:         "Validate these 3 Bicep files: [paths]. Check for: [specific items]."
```

---

## Baseline Comparison (Automated)

Snapshots and persisted diffs are optional: run them only for a requested
before/after comparison with write authorization. Read-only audits do not write
snapshots, reports, temporary exports, or session state; return findings in chat.
Reuse a verified existing baseline when available. No baseline means before/after
claims remain unavailable, not that the audit must create one.

### How It Works

1. **Phase 0** (optional, authorized): Runs `npm run snapshot:baseline -- ctx-opt-{timestamp}`
  before changes. Copies `.github/agents`, `.github/instructions`,
   `.github/prompts`, `.github/skills`, and `AGENTS.md` to
   `agent-output/_baselines/{label}/` with a `manifest.json`.
2. **Phases 1-5**: Normal analysis and recommendation workflow.
3. **Phase 6** (optional, authorized): After a human or separate execution agent applies changes, runs
   `npm run diff:baseline -- --baseline {label}` to generate a structured
   diff report at `agent-output/_baselines/{label}/diff-report.md`.

The diff report includes: per-category summary (added/modified/deleted),
line-level impact counts, and inline unified diffs for every changed file.

Baselines are git-ignored — local working data only.

### Manual Usage

The scripts can also be run independently:

```bash
npm run snapshot:baseline -- my-label
npm run diff:baseline -- --baseline my-label
```

### Scripts

- `tools/scripts/snapshot-agent-context.sh` — creates timestamped baseline snapshots
- `tools/scripts/diff-context-baseline.sh` — generates diff reports against a baseline
