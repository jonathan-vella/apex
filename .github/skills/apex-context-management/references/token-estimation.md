<!-- ref:token-estimation-v1 -->

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

These illustrative components depend on the actual harness and attachments;
the values below are source estimates, not measured usage:

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

| Model                   | Vendor API window | APEX hard checkpoint |
| ----------------------- | ----------------- | -------------------- |
| GPT-6-Sol               | 1,050,000 tokens  | ≥300K input          |
| GPT-6-Luna              | 1,050,000 tokens  | ≥300K input          |
| GPT-5.6 Terra (copilot) | 1,050,000 tokens  | ≥300K input          |
| Claude Opus 5.5         | 1M tokens         | ≥160K input          |
| MAI-Code-1.1-Flash      | unknown           | ≥160K input          |

Vendor windows are API limits from the OpenAI and Anthropic model pages, not Copilot harness limits. Use the
active harness limit and measured tokenizer when available; otherwise keep limits and measured usage unknown.
Checkpoints are defined in [hard-checkpoints.md](hard-checkpoints.md). Do not infer cost tiers from model names.

## Measurement Boundaries

Never infer tokens from latency. Timing includes output generation, tool work,
queueing and server load. Report measured tokens, source estimates, and elapsed
time separately, with provenance and missing telemetry explicitly unknown.
Source-only audits may recommend changes but cannot claim measured savings.

## Warning Thresholds

| Metric                              | Yellow          | Red             |
| ----------------------------------- | --------------- | --------------- |
| Fixed agent context cost            | > 5,000 tokens  | > 10,000 tokens |
| Instructions loaded per request     | > 5 files       | > 10 files      |
| Conversation turns without hand-off | > 15 turns      | > 25 turns      |
| Single file read                    | > 5,000 tokens  | > 15,000 tokens |
| Cumulative file reads per session   | > 30,000 tokens | > 60,000 tokens |
