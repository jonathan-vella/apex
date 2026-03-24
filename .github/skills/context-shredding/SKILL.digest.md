<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Context Shredding Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use

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
3. **Apply compression template** from the reference doc below
4. If loading multiple artifacts, compress the older/less-critical ones first

> _See SKILL.md for full content._

## Tier Selection Protocol

1. Estimate context usage (1 token ≈ 4 chars)
2. Check model limit (Opus: 200K, GPT-5.3-Codex: 128K)
3. Select tier: <60% → full, 60-80% → summarized, >80% → minimal
