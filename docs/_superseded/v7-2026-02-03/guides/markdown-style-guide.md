# MARKDOWN-STYLE-GUIDE

> **Version 5.3.0** | [Back to Guides](README.md)

Concise rules to keep docs consistent and readable.

## Essentials

- Use ATX headings; one H1 per doc (title), then H2/H3.
- Target 120-character lines; break at natural clauses.
- Use LF line endings; spaces, not tabs.
- Descriptive, relative links; no "click here".
- Add alt text for images; tables need headers.

## Structure

- Start with a short intro; use clear section headings.
- Prefer bullets and short paragraphs over long prose.
- Keep lists with `-` and ordered lists with `1.`; indent nested lists by 2 spaces.

## Code and Snippets

- Fenced code blocks with language (e.g., `bash` / `json` / `bicep` / `mermaid`).
- Keep snippets minimal; align with repo practices.

## Diagrams

- Mermaid blocks include theme: `%%{init: {'theme':'neutral'}}%%`.
- Add a brief caption/label when useful.

## Links and References

- Use relative paths within the repo; ensure targets exist.
- Use descriptive text (e.g., "see the deployment guide"), not "here".

## Tone and Audience

- Concise, action-oriented, IT Pro focused.
- Call out defaults when relevant: swedencentral (germanywestcentral fallback), AVM-first, seven-step workflow.

## Validation

- Run `markdownlint "**/*.md" --ignore node_modules` (MD013 set to 120).
- Spot-check click depth: entry → scenario → supporting asset in ≤3 clicks.
