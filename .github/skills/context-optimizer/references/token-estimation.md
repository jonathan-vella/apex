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

> **Last verified: 2026-05-04.** The "VS Code Copilot Chat (per-turn)"
> column is the budget that **actually binds** in interactive use and
> comes from the in-product model picker in VS Code Copilot Chat
> (excluding two Anthropic 1M-context SKUs marked _Internal only_ that
> are not generally available). Vendor-native windows are larger but do
> not apply inside Copilot Chat — they are kept here only as a sanity
> bound for tokenization math (e.g. "does this prompt fit at all on the
> underlying model"). Request multipliers come from the same picker and
> drive premium-request consumption per
> [GitHub Copilot model multipliers][^gh].

| Model                                  | VS Code Copilot Chat (per-turn) | Request multiplier | Vendor-native context | Vendor-native max output | Source                         |
| -------------------------------------- | ------------------------------- | ------------------ | --------------------- | ------------------------ | ------------------------------ |
| Claude Opus 4.7 (Extra high reasoning) | 200,000 tokens                  | 45x                | 1,000,000 tokens      | 128,000 tokens           | VS Code picker / Anthropic[^a] |
| Claude Opus 4.7 (High reasoning)       | 200,000 tokens                  | 30x                | 1,000,000 tokens      | 128,000 tokens           | VS Code picker / Anthropic[^a] |
| Claude Opus 4.7                        | 200,000 tokens                  | 15x                | 1,000,000 tokens      | 128,000 tokens           | VS Code picker / Anthropic[^a] |
| Claude Opus 4.6                        | 200,000 tokens                  | 3x                 | 1,000,000 tokens      | 128,000 tokens           | VS Code picker / Anthropic[^a] |
| Claude Sonnet 4.6                      | 200,000 tokens                  | 1x                 | 1,000,000 tokens      | 64,000 tokens            | VS Code picker / Anthropic[^a] |
| Claude Haiku 4.5                       | 200,000 tokens                  | 0.33x              | 200,000 tokens        | 64,000 tokens            | VS Code picker / Anthropic[^a] |
| GPT-5.5                                | 400,000 tokens                  | 7.5x               | 400,000 tokens        | 128,000 tokens           | VS Code picker / OpenAI[^o5]   |
| GPT-5.4                                | 400,000 tokens                  | 1x                 | 400,000 tokens        | 128,000 tokens           | VS Code picker / OpenAI[^o5]   |
| GPT-5.4 mini                           | 400,000 tokens                  | 0.33x              | 400,000 tokens        | 128,000 tokens           | VS Code picker / OpenAI[^o5]   |
| GPT-5.3-Codex                          | 400,000 tokens                  | 1x                 | 400,000 tokens        | 128,000 tokens           | VS Code picker / OpenAI[^oc]   |
| GPT-5 mini                             | 192,000 tokens                  | 0x                 | 400,000 tokens        | 128,000 tokens           | VS Code picker / OpenAI[^o5]   |
| Gemini 3.1 Pro (Preview)               | 200,000 tokens                  | 1x                 | —                     | —                        | VS Code picker                 |
| Gemini 3 Flash (Preview)               | 173,000 tokens                  | 0.33x              | —                     | —                        | VS Code picker                 |

Two _Internal only_ SKUs in the picker — `Claude Opus 4.6 (1M context)`
and `Claude Opus 4.7 (1M context)` — are intentionally **excluded**
above. They are not available outside Microsoft and do not appear in
`.github/model-catalog.json`.

The APEX agents in this repo target the rows that match the model
catalog: `Claude Opus 4.7 (High reasoning)`, `Claude Sonnet 4.6`,
`GPT-5.5`, `GPT-5.4`, and `GPT-5.3-Codex`. The other rows are recorded
for completeness so the catalog can authorize new labels without
re-deriving the numbers.

Practical rule of thumb: keep the running prompt under ~80% of the
**VS Code Copilot Chat (per-turn)** column for interactive work — that
is the budget that binds, regardless of how large the underlying
vendor-native window is. For Opus 4.7 in VS Code that means plan for
~160K of usable context, not ~800K. For GPT-5.5 plan for ~320K, not
the full 400K. Quality typically degrades before the hard limit due to
attention dilution; the [`context-shredding`
skill](../../context-shredding/SKILL.md) governs the SKILL/digest/minimal
tier loading APEX agents apply when a model's effective context is
tight.

[^gh]:
    GitHub Copilot — _Supported AI models in GitHub Copilot_ (the model
    catalog and multipliers are listed; per-model per-turn context budgets
    for Copilot Chat are not published in this reference).
    <https://docs.github.com/en/copilot/reference/ai-models/supported-models>

[^a]:
    Anthropic — _Models overview_ (latest models comparison table; values
    apply to the synchronous Messages API).
    <https://platform.claude.com/docs/en/about-claude/models/overview>

[^o5]:
    OpenAI — _GPT-5 model card_ (values apply across the GPT-5 family,
    including GPT-5.4 and GPT-5.5; GPT-5.5 is documented as inheriting all
    GPT-5.4 API features).
    <https://developers.openai.com/api/docs/models/gpt-5>

[^oc]:
    OpenAI — _GPT-5-Codex model card_ (the GPT-5.x-Codex line shares the
    GPT-5 family context window).
    <https://developers.openai.com/api/docs/models/gpt-5-codex>

## Latency-to-Context Correlation

These bands are **empirical, not vendor-published**, and refer to the
input-token count visible to the streaming response (`in`). Output length,
streaming overhead, server load, and per-turn Copilot budgets all affect
latency — re-benchmark on your own workflow before relying on them.

| Model                            | < 5s     | 5-10s     | 10-20s     | 20-30s      | > 30s  |
| -------------------------------- | -------- | --------- | ---------- | ----------- | ------ |
| Claude Opus 4.7 (High reasoning) | < 20K in | 20-60K in | 60-120K in | 120-200K in | Beyond |
| Claude Sonnet 4.6                | < 25K in | 25-70K in | 70-140K in | 140-200K in | Beyond |
| GPT-5.5                          | < 15K in | 15-45K in | 45-90K in  | 90-140K in  | Beyond |
| GPT-5.3-Codex                    | < 15K in | 15-40K in | 40-80K in  | 80-100K in  | Beyond |

The upper bound for Claude rows is the 200K VS Code Copilot Chat
per-turn budget; for the GPT-5 rows it is the 400K vendor-native window
(Copilot Chat exposes the full 400K for those models).
Reasoning effort matters: Sonnet 4.6 and GPT-5.5 default to `medium`,
Opus 4.7 to `high` — `high` adds visible latency at every band.

## Warning Thresholds

| Metric                              | Yellow          | Red             |
| ----------------------------------- | --------------- | --------------- |
| Fixed agent context cost            | > 5,000 tokens  | > 10,000 tokens |
| Instructions loaded per request     | > 5 files       | > 10 files      |
| Conversation turns without hand-off | > 15 turns      | > 25 turns      |
| Single file read                    | > 5,000 tokens  | > 15,000 tokens |
| Cumulative file reads per session   | > 30,000 tokens | > 60,000 tokens |
