---
name: excalidraw
description: "Excalidraw hand-drawn whiteboarding, brainstorming, wireframes, and informal sketches. USE FOR: hand-drawn style diagrams, real-time collaborative sketching, wireframes, UI mockups, quick informal diagrams, brainstorming sessions. DO NOT USE FOR: Azure architecture diagrams (use drawio), WAF/cost charts (use python-diagrams), inline Mermaid (use mermaid), formal reference-architecture diagrams."
compatibility: Works with VS Code Copilot and Excalidraw editor extension.
license: MIT
metadata:
  author: apex
  version: "2.0"
---

# Excalidraw — Hand-Drawn Whiteboarding

Skill for generating hand-drawn style diagrams, wireframes, and informal sketches.
For Azure architecture diagrams, use the `drawio` skill instead.

## Best Used For

- **Brainstorming** — quick idea exploration with hand-drawn aesthetic
- **Wireframes** — UI mockups and layout sketches
- **Process flows** — informal flowcharts and decision trees
- **Whiteboarding** — real-time collaborative sketching
- **ERD diagrams** — entity-relationship diagrams (hand-drawn style)
- **Sequence sketches** — informal interaction flows

## NOT For

- Azure architecture diagrams → use `drawio` skill
- WAF/cost/compliance charts → use `python-diagrams` skill
- Inline markdown diagrams → use `mermaid` skill
- Formal reference-architecture diagrams → use `drawio` skill

## Output Format

`.excalidraw` files are Excalidraw JSON — editable in VS Code or excalidraw.com.

## Style Tokens

| Token      | Value                      |
| ---------- | -------------------------- |
| Font       | Excalifont (fontFamily: 5) |
| Background | `#ffffff`                  |
| Stroke     | `#1e1e1e`                  |
| Hand-drawn | `roughness: 1`             |

## Reference Index

| File                            | Purpose                                          |
| ------------------------------- | ------------------------------------------------ |
| `references/quick-reference.md` | Copy-paste snippets for Excalidraw JSON patterns |
