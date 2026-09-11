---
description: "Standards for user-facing documentation in the site/src/content/docs/ folder"
applyTo: "site/src/content/docs/**/*.md, site/src/content/docs/**/*.mdx"
---

# Documentation Standards

Instructions for creating and maintaining user-facing documentation in the `site/src/content/docs/` folder.

## Structure Requirements

### File Header

Use YAML frontmatter with `title` and `description`, following
[`astro.instructions.md`](astro.instructions.md#frontmatter).
Do not add a repository-style version banner to site pages.

### Single H1 Rule

Starlight renders the frontmatter title as the page H1. Start body sections at H2;
do not duplicate the title with a Markdown H1 in either `.md` or `.mdx` pages.

### Link Style

- Use relative links for internal docs (example pattern: `Quickstart -> quickstart.md`)
- For root file references, increase `../` depth based on folder nesting (for example: `../VERSION.md`,
  `../../VERSION.md`)
- Use reference-style links for external URLs
- No broken links (validated in CI)

## Current Architecture

See `tools/registry/count-manifest.json` for current agent, subagent, and skill counts.
See `tools/registry/agent-registry.json` for the agent role → file/model/skills mapping.

## Prohibited References

Do NOT reference these removed agents/skills:

- Architecture diagrams → Use the `python-diagrams` skill
- `adr.agent.md` → Use `azure-adr` skill
- `docs.agent.md` → Use `azure-artifacts` skill or `as-built` agent
- `azure-workload-docs` skill → Use `azure-artifacts` skill
- `azure-deployment-preflight` skill → Merged into deploy agent
- `orchestration-helper` skill → Deleted (absorbed into orchestrator)
- `github-issues` / `github-pull-requests` skills → Use `github-operations`
- `gh-cli` skill → Merged into `github-operations`
- `_shared/` directory → Use `azure-defaults` + `azure-artifacts` skills

## Admonitions (Starlight asides)

Use Starlight's four built-in admonition types consistently. Pick the weakest
type that communicates the urgency; escalate only when needed.

| Type      | When to use                                                     | Syntax               |
| --------- | --------------------------------------------------------------- | -------------------- |
| `note`    | Side information that aids understanding but isn't required     | `:::note` … `:::`    |
| `tip`     | Optional best practice or shortcut                              | `:::tip` … `:::`     |
| `caution` | Behaviour that can cause confusion, unexpected cost, or rework  | `:::caution` … `:::` |
| `danger`  | Data loss, security regression, irreversible destructive action | `:::danger` … `:::`  |

Rules:

- At most **one `danger`** per page; overuse trains readers to ignore them.
- Don't stack admonitions back-to-back; if two appear consecutively, merge or
  rewrite as prose.
- Custom titles allowed via `:::caution[Region drift]`; keep under ~30 chars.

## Related footers

Every guide under `site/src/content/docs/guides/` ends with a `## Related`
section listing 2–4 adjacent topics (sibling guides, upstream concepts,
downstream references). Use bullet links with a one-line description each.
Example:

```markdown
## Related

- [Cost & Governance](../cost-governance/) — track spend against policy
- [Security Baseline](../security-baseline/) — TLS, identity, key rotation
- [Troubleshooting](../troubleshooting/) — diagnose failed deploys
```

## Content Principles

| Principle                  | Application                                             |
| -------------------------- | ------------------------------------------------------- |
| **DRY**                    | Single source of truth per topic                        |
| **Current state**          | No historical context in main docs                      |
| **Action-oriented**        | Every section answers "how do I...?"                    |
| **Minimal**                | If it doesn't help users today, remove it               |
| **Prompt guide for depth** | Point to the prompt guide section in the published site |

## Validation

### Template And Visual Consistency

For site pages that mirror agent-output structure, preserve canonical template H2 order:
invariant sections first, optional sections last. Link to templates rather than embedding skeletons.
`tools/scripts/validate-artifacts.mjs` enforces agent-output templates, not site pages.

Use the styling reference in `azure-artifacts/SKILL.md` for badge rows, collapsible TOCs,
status columns (include success, warning, and failure states), and previous/index/next navigation.
Use these elements consistently when reproducing artifact views; do not add them to every site page.

For MDX, place component imports after frontmatter and use Starlight `Aside`, `Tabs`, and `TabItem`
instead of raw HTML where equivalents exist. Starlight owns the title H1 in both Markdown and MDX.

### Checks

Run the existing checks relevant to the change:

```bash
npm run lint:md
npm run lint:docs-frontmatter
npm run lint:site-links
```

`lint:site-links` builds the site before checking links; do not run a duplicate build for that check.
For formatting examples, see `references/markdown-formatting-guide.md`.

Documentation checks cover:

- No references to removed agents
- Version numbers match `VERSION.md` (repo root)
- No broken internal links
- Markdown lint passes
