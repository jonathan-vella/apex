# Token Estimation Reference

Detailed heuristics for estimating context window token costs from observable
signals. These are approximations — actual tokenization varies by model.

## Character-to-Token Ratios

| Content Type         | Ratio (chars/token) | Notes                         |
| -------------------- | ------------------- | ----------------------------- |
| English prose        | ~4.0                | Standard text                 |
| Code (TypeScript/JS) | ~3.5                | More symbols, shorter words   |
| Code (Python)        | ~3.8                | Slightly more readable        |
| Code (Bicep/ARM)     | ~3.2                | Verbose resource declarations |
| JSON data            | ~3.0                | Keys, braces, quotes overhead |
| Markdown             | ~3.8                | Mix of prose and formatting   |
| YAML                 | ~3.5                | Indentation-heavy             |

## VS Code Copilot System Prompt Costs

These components are always present in the context window:

| Component                       | Estimated Tokens | Source                |
| ------------------------------- | ---------------- | --------------------- |
| Base system prompt              | ~2,000           | VS Code internals     |
| Per tool definition             | ~50-100          | JSON schema per tool  |
| Per handoff definition          | ~30-50           | Agent metadata        |
| Conversation history (per turn) | ~200-2,000+      | Depends on turn size  |
| File attachment                 | ~file_size / 3.5 | Attached file content |
| Workspace info                  | ~200-500         | Project structure     |
| Instruction file (when matched) | ~file_size / 4   | Full file content     |

## Agent Definition Context Cost

To estimate the fixed context cost of an agent:

```text
base_cost = 2000  # system prompt overhead
tool_cost = num_tools * 75  # average per tool
handoff_cost = num_handoffs * 40
body_cost = body_chars / 4
instruction_cost = sum(matched_instruction_chars / 4)

total_fixed = base_cost + tool_cost + handoff_cost + body_cost + instruction_cost
```

## Model Context Limits

| Model           | Context Window | Practical Limit (80%) |
| --------------- | -------------- | --------------------- |
| Claude Opus 4.6 | 200K tokens    | ~160K tokens          |
| GPT-5.3-Codex   | 128K tokens    | ~102K tokens          |
| gpt-4o-mini     | 128K tokens    | ~102K tokens          |
| Claude Sonnet 4 | 200K tokens    | ~160K tokens          |

The "practical limit" accounts for output generation headroom.
Quality typically degrades before hitting the hard limit.

## Latency-to-Context Correlation

Based on empirical observation of streaming responses:

| Model           | Latency < 5s | 5-10s     | 10-20s     | 20-30s      | > 30s      |
| --------------- | ------------ | --------- | ---------- | ----------- | ---------- |
| Claude Opus 4.6 | < 20K in     | 20-60K in | 60-120K in | 120-160K in | Near limit |
| GPT-5.3-Codex   | < 15K in     | 15-40K in | 40-80K in  | 80-100K in  | Near limit |
| gpt-4o-mini     | < 10K in     | 10-30K in | 30-60K in  | 60-80K in   | Near limit |

"in" = input tokens. These are rough bands — output length, streaming
overhead, and server load all affect latency.

## Warning Thresholds

| Metric                              | Yellow          | Red             |
| ----------------------------------- | --------------- | --------------- |
| Fixed agent context cost            | > 5,000 tokens  | > 10,000 tokens |
| Instructions loaded per request     | > 5 files       | > 10 files      |
| Conversation turns without hand-off | > 15 turns      | > 25 turns      |
| Single file read                    | > 5,000 tokens  | > 15,000 tokens |
| Cumulative file reads per session   | > 30,000 tokens | > 60,000 tokens |
