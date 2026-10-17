---
description: "Documentation and content creation standards for markdown files"
applyTo: ".github/copilot-instructions.md, .github/PULL_REQUEST_TEMPLATE.md, .github/plugins/**/*.md, tools/apex-prompts/**/*.md, .github/skills/**/templates/**/*.md, agent-output/**/*.md, docs/**/*.md, infra/**/*.md, tools/mcp-servers/**/*.md, tools/scripts/**/*.md, tests/**/*.md, AGENTS.md, README.md, CHANGELOG.md, CONTRIBUTING.md, CONTRIBUTORS.md, QUALITY_SCORE.md, VERSION.md"
---

# Markdown Documentation Standards

## Rules

- **CRITICAL: 120-char line limit** (CI + pre-commit enforced). Break after punctuation,
  before `[`, or move long spans into a code block.
- ATX headings: `##` for H2, `###` for H3; no H1 in content, avoid H4+.
- `-` for unordered lists, `1.` for ordered; single blank lines; LF line endings.
- Fenced code blocks always name a language — never bare fences.
- Descriptive link text (never "click here"); relative paths for internal links.
- Meaningful alt text for images; tables include a header row.

## Diagram Embeds

Use the appropriate diagram skill for each output type:

- **Architecture diagrams** → `apex-python-diagrams` skill (`.py`, `.png`, `.svg`)
- **WAF/cost/compliance charts** → `apex-python-diagrams` skill (`.py` + `.png`)
- **Inline markdown diagrams** → `apex-mermaid` skill (fenced code blocks)

> Published documentation standards live in `jonathan-vella/apex-docs`. For agent-generated
> artifacts in `agent-output/**`, H2 template compliance is enforced by
> `azure-artifacts.instructions.md`.

## Validation

```bash
npm run lint:md
```

Good/bad examples: `.github/instructions/references/markdown-formatting-guide.md`.
