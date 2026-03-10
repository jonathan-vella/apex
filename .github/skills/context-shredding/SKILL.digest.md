<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Context Shredding (Digest)

Runtime compression for agents approaching context limits.
Read full `SKILL.md` for protocol details.

## Compression Tiers

| Tier         | Context Usage | Strategy                                   |
| ------------ | ------------- | ------------------------------------------ |
| `full`       | < 60%         | Load entire artifact — no compression      |
| `summarized` | 60-80%        | Load key H2 sections only                  |
| `minimal`    | > 80%         | Load decision summaries only (< 500 chars) |

## Skill Loading Tiers

| Context Usage | Skill Variant to Load | Path Pattern       |
| ------------- | --------------------- | ------------------ |
| < 60%         | Full                  | `SKILL.md`         |
| 60-80%        | Digest                | `SKILL.digest.md`  |
| > 80%         | Minimal               | `SKILL.minimal.md` |

## Tier Selection

```text
1. Estimate context usage (1 token ≈ 4 chars)
2. Check model limit (Opus: 200K, GPT-5.3-Codex: 128K)
3. Calculate percentage → select tier from tables above
4. Load artifact/skill using the selected variant
5. Compress older artifacts first when loading multiple
```

## Reference Index

| Reference             | File                                  | Content                           |
| --------------------- | ------------------------------------- | --------------------------------- |
| Compression Templates | `references/compression-templates.md` | Per-artifact H2 sections per tier |
