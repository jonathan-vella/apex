---
description: "Documentation site and human-authored markdown style guidance — visual styling, template H2 enforcement, audience-specific rules. Pairs with the broader markdown.instructions.md."
applyTo: "site/src/content/docs/**/*.{md,mdx}, docs/**/*.md"
---

# Markdown — Documentation Site Standards

Audience-specific style and template rules for **human-authored documentation**
in the Astro Starlight site (`site/src/content/docs/**`) and the in-repo
`docs/**` folder. Cross-cutting rules (line length, ATX headings, code fences,
link syntax, patterns-to-avoid) live in
[`markdown.instructions.md`](markdown.instructions.md) and apply here too.

## Template-First Approach (site content)

For documentation pages that mirror agent-output structure (for example,
the workflow walkthroughs and the `concepts/how-it-works/` set), preserve
the H2 heading order from the canonical agent-output templates so that
internal links from agent-output pages resolve.

- Preserve H2 heading order — invariant sections come first
- No embedded skeletons — link to templates instead of copying them
- Optional sections after the last required H2
- The full template registry is enforced by
  `tools/scripts/validate-artifacts.mjs` (applies to `agent-output/**`,
  not site content — included here for reference)

## Visual Styling

See `azure-artifacts/SKILL.md` for the canonical styling reference
(badges, emoji, callouts, status icons, collapsible sections). Reproduce
these conventions consistently on the documentation site so internal
cross-links between site content and agent-output artifacts feel unified.

Common reusable elements:

| Element              | Source                                                   |
| -------------------- | -------------------------------------------------------- |
| Badge row            | `![Step]` / `![Status]` / `![Agent]` shields             |
| Collapsible TOC      | `<details open>` block with section links                |
| Traffic-light status | ✅ / ⚠️ / ❌ (all three required when used as a column) |
| Cross-navigation     | Header table with ⬅️ Previous / 📑 Index / Next ➡️       |

## MDX-Specific Rules

For `.mdx` files under `site/src/content/docs/`:

- Component imports go at the top of the file, after the frontmatter
- Use Astro Starlight components (`<Aside>`, `<Tabs>`, `<TabItem>`) over
  raw HTML where equivalents exist
- Keep frontmatter `title` and the first heading aligned; Starlight
  renders the title automatically so do not duplicate it with an H1

## Validation

```bash
npm run lint:md          # cross-cutting markdown rules (both files)
npm run check:links      # site internal link resolution
npm run build:site       # full Astro build (catches MDX errors)
```

## Reference

Full examples and formatting guide:
`.github/instructions/references/markdown-formatting-guide.md`.
