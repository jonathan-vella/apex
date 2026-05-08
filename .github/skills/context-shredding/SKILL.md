---
name: context-shredding
description: "Runtime context compression for agents approaching model context limits. Defines 3 compression tiers (full/summarized/minimal) with per-artifact templates. USE FOR: reducing artifact loading size at runtime, context budget management. DO NOT USE FOR: diagnostic context auditing (use context-optimizer), Azure infrastructure."
---

# Context Shredding Skill

Runtime compression system that actively reduces context when agents approach
model limits. Agents check approximate context usage before loading artifact
files and select the appropriate compression tier.

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

## Tier Selection Protocol

```text
1. Estimate current context usage (rough: 1 token ≈ 4 chars)
2. Check model limit (Opus: 200K, GPT-5.3-Codex: 128K)
3. Calculate usage percentage
4. Select tier:
   < 60%  → full (no compression needed)
   60-80% → summarized (key sections only)
   > 80%  → minimal (decision summaries only)
5. Load artifact/skill using the appropriate variant
```

## Skill Loading Tiers

Skills have three compression tiers. The default for context-window-optimized
agents is `SKILL.digest.md` (no longer `SKILL.md`). `SKILL.minimal.md` is the
escalation for >80% context utilization or when the caller passes an explicit
minimal-mode flag. The full `SKILL.md` is reserved for skill-authoring or
debugging contexts where the digest is insufficient.

| Context Usage / Mode              | Skill Variant | Path Pattern       | Approx Tokens |
| --------------------------------- | ------------- | ------------------ | ------------- |
| **Default** (any utilization)     | Digest        | `SKILL.digest.md`  | 150-320       |
| > 80% utilization or minimal flag | Minimal       | `SKILL.minimal.md` | 40-100        |
| Skill authoring / debugging only  | Full          | `SKILL.md`         | 400-800       |

All 47 skill directories in this repository ship a `SKILL.digest.md` file, so
no missing-digest fallback path is needed.

## Reference Index

| Reference             | File                                  | Content                           |
| --------------------- | ------------------------------------- | --------------------------------- |
| Compression Templates | `references/compression-templates.md` | Per-artifact H2 sections per tier |
