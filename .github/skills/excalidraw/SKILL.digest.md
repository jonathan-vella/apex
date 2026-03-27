<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Excalidraw — Hand-Drawn Whiteboarding (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Purpose

Hand-drawn style diagrams, wireframes, and informal sketches.
For Azure architecture diagrams, use the `drawio` skill instead.

## Best Used For

- Brainstorming, wireframes, UI mockups, process flows, whiteboarding, ERD sketches

## NOT For

- Azure architecture diagrams → `drawio`
- WAF/cost/compliance charts → `python-diagrams`
- Inline markdown diagrams → `mermaid`

## Output Format

`.excalidraw` files — Excalidraw JSON, editable in VS Code or excalidraw.com.

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

## Scope Exclusions

Does NOT: generate Azure architecture diagrams (use `drawio`) · generate
WAF/cost/compliance charts (use `python-diagrams`) · render Mermaid diagrams ·
create ADRs · generate Bicep/Terraform · deploy resources.
