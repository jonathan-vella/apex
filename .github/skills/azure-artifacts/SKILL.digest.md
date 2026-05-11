<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Artifacts Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Rules

### Mandatory Compliance

| Rule                  | Requirement                                         |
| --------------------- | --------------------------------------------------- |
| **Template skeleton** | Read step template from `references/` and replicate |
> _See SKILL.md for full content._

## Mandatory: Project README

Every project in `agent-output/{project}/` **MUST** have a
`README.md`.

After saving step artifact(s), update the README:
> _See SKILL.md for full content._

## Steps

Artifact generation flow (per Step N):

1. **Read template** — load the matching `references/0N-*-template.md` for the step you are generating
2. **Copy H2 skeleton** — replicate every required H2 in the listed order, character-for-character
3. **Fill content** — replace `{placeholder}` tokens; never use "TBD" or "Insert here"
> _See SKILL.md for full content._

## Revision Workflow (Targeted Edits)

**Initial draft** uses `create_file`. **All subsequent revisions** MUST use targeted edit tools. Bundle every accepted fix from a review pass into a single `multi_replace_string_in_file` call (a 24-finding revision is one tool call, not 24). Full procedure, rationale, and structural-rewrite exception in [`references/revision-workflow.md`](./references/revision-workflow.md).

## Placeholder Syntax

All templates use single-brace `{placeholder-name}` syntax:

- Lowercase, hyphen-separated: `{project-name}`, `{monthly-cost}`
- No Mustache/Handlebars `{{double-braces}}`

## Automated Validation

```bash
npm run lint:artifact-templates   # H2 order and required headings
npm run lint:h2-sync              # Template ↔ artifact sync
npm run validate:all              # All validators together
```

## Quality Checklist

- [ ] H2 headings match template exactly (text + order)
- [ ] Attribution header present with agent name and date
- [ ] No placeholder text (e.g. "TBD", "Insert here", task markers)
- [ ] File saved to `agent-output/{project}/` with correct name
> _See SKILL.md for full content._
