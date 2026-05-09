<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Artifacts Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Artifact Generation Rules

### Mandatory Compliance

| Rule                  | Requirement                                         |
| --------------------- | --------------------------------------------------- |
| **Template skeleton** | Read step template from `references/` and replicate |
| **Exact text**        | Use H2 text from templates verbatim                 |

> _See SKILL.md for full content._

## Mandatory: Project README

Every project in `agent-output/{project}/` **MUST** have a
`README.md`.

After saving step artifact(s), update the README:

1. Mark your step as **complete** in `## ✅ Workflow Progress`

> _See SKILL.md for full content._

## Revision Workflow (Targeted Edits)

First-time creation uses `create_file`. **All revisions** (challenger
findings, per-finding Apply/Skip/Defer decisions, gate revisions)
MUST use `multi_replace_string_in_file` — bundle every accepted fix
into **one tool call**, not one per finding. Re-emitting a full
artifact via `create_file` costs 8–18 K output tokens that re-enter
context on every subsequent turn. Exception: H2 reorder or > 50 % of
lines changed (log via `apex-recall decide`).

> _See SKILL.md for full Revision Workflow table and exception logging._

## Placeholder Syntax

All templates use single-brace `{placeholder-name}` syntax (lowercase, hyphen-separated). No Mustache `{{double-braces}}`.

> _See SKILL.md for full content._

## Automated Validation

```bash
npm run lint:artifact-templates   # H2 order and required headings
npm run lint:h2-sync              # Template ↔ artifact sync
npm run validate:all              # All validators together
```

> _See SKILL.md for full content._

## Quality Checklist

- [ ] H2 headings match template exactly (text + order)
- [ ] Attribution header present with agent name and date
- [ ] No placeholder text ("TBD", "Insert here", "TODO")
- [ ] File saved to `agent-output/{project}/` with correct name
- [ ] Collapsible TOC present (`<details open>` block after badge row)
- [ ] Cross-navigation table present (⬅️ Previous / 📑 Index / Next ➡️)
- [ ] Mermaid diagram included (if template contains one)
- [ ] Traffic-light indicators used (✅ / ⚠️ / ❌ where template shows status columns)
- [ ] Collapsible `<details>` blocks present (if template contains them)

---

> _See SKILL.md for full content._
