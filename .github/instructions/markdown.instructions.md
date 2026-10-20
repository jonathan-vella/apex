---
description: "Documentation and content creation standards for markdown files"
applyTo: ".github/copilot-instructions.md, .github/PULL_REQUEST_TEMPLATE.md, .github/plugins/**/*.md, .github/skills/**/templates/**/*.md, agent-output/**/*.md, docs/**/*.md, infra/**/*.md, tools/mcp-servers/**/*.md, tools/scripts/**/*.md, tests/**/*.md, AGENTS.md, README.md, CHANGELOG.md, CONTRIBUTING.md, CONTRIBUTORS.md, QUALITY_SCORE.md, VERSION.md"
---

# Markdown Documentation Standards

## Rules

- For paths selected by `.markdownlint-cli2.jsonc`, MD013 uses 120-character lines;
  code blocks, tables and configured ignores are exempt. Break ordinary prose after
  punctuation or before links; do not claim this check covers ignored artifacts or skills.
- Use an H1 document title where appropriate, then ATX `##`/`###` sections.
  Artifact templates own their exact heading structure, including required H1 titles.
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
> artifacts in `agent-output/**`, follow
> [azure-artifacts.instructions.md](azure-artifacts.instructions.md).
> Markdownlint excludes those artifacts and skill content. Git artifact validation checks
> its supported structural contract, not general line length or all template styling.

## Validation

```bash
npm run lint:md
```

Good/bad examples: `.github/instructions/references/markdown-formatting-guide.md`.
