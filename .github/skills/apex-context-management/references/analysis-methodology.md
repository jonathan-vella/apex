<!-- ref:analysis-methodology-v1 -->

# Context Optimization — Analysis Methodology

Detailed log format reference, step-by-step analysis methodology,
common optimization patterns, and baseline comparison automation.

---

## Log Format Reference

### Native JSONL Events

The primary source is `~/.copilot/session-state/<session-id>/events.jsonl`.
Every record has `type`, `timestamp`, `data` and optional worker identity.
The shared `tools/scripts/profile_debug_log.py` normalizes these records:

| Event | Evidence |
| --- | --- |
| `session.start` | Session and exact repository identity |
| `assistant.message` | API call ID and model; not a usage total |
| `session.usage_record` | Authoritative usage joined by API call ID |
| `tool.execution_start` / completion | Tool call identity, worker and success |
| Worker configured/completed | Actual model/effort, parent and completion linkage |
| Hook start/end | Hook identity and outcome; not proof every expected hook was bound |

### Request Types

Use root/worker identity and explicit `WORKER_EXECUTE` attribution to distinguish
readiness from executed work. Missing attribution remains unknown; timestamps alone
cannot identify workflow steps, human approval or review attempts.
Historical Local/OTel readers remain available but cannot certify SDK acceptance.

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
python3 .github/skills/apex-context-management/scripts/parse-chat-logs.py \
  --log-dir ~/.copilot/session-state/ --repository .
```

The parser produces per-session normalized metrics. Duplicate authoritative usage
is counted once; conflicting records fail. Missing usage is not zero or complete billing.

### Step 2: Profile Turn Costs

Group requests by session and analyze patterns:

- **Burst detection**: Rapid sequential calls (gap < 2s) suggest tool-call
  loops where context accumulates
- **Latency escalation**: Investigate slower turns against recorded usage, output size,
  tool activity, and runtime conditions; do not infer context growth from timing alone
- **Model mismatch**: Compare each turn's recorded model with the agent's frontmatter
  assignment and declared role; a different recorded model suggests wrong routing. Do not
  infer capability, cost tier or "lighter" models from names — catalog tiers may be unknown
  (`.github/model-catalog.json`); recommend a model change only from measured evidence

### Step 3: Audit Agent Definitions

Discover `.github/agents/**/*.agent.md` recursively, including `_subagents/`.
For each file, estimate source-level context cost; leaf workers do not require
handoffs or delegation. These estimates are not observed token usage:

| Component              | Approximate Token Cost           |
| ---------------------- | -------------------------------- |
| System prompt overhead | Unknown until observed in the active SDK harness |
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
   `.github/skills`, and `AGENTS.md` to
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
