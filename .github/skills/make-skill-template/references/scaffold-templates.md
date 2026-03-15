<!-- ref:scaffold-templates-v1 -->

# Project-Specific Scaffold Templates

Pre-built skeletons for creating skills in this project, matching established conventions.

## Azure Knowledge Skill Skeleton

For skills that teach agents about Azure patterns, conventions, or diagnostics:

```yaml
---
name: azure-{topic}
description: {What it does including Azure context}. Use when {triggers and keywords}.
compatibility: Requires Azure CLI with Bicep extension
---
```

````markdown
# Azure {Topic} Skill

One-sentence overview of what this skill provides.

---

## Quick Reference

| Pattern / Capability | When to Use |
| -------------------- | ----------- |
| ...                  | ...         |

---

## {Pattern/Section Name}

Explanation and code example:

\```bicep
// example
\```

---

## Learn More

| Topic | How to Find                          |
| ----- | ------------------------------------ |
| ...   | `microsoft_docs_search(query="...")` |
````

## Integration Skill Skeleton

For skills that wrap external tools, MCP servers, or CLIs:

```yaml
---
name: {tool-name}
description: {What it does}. Use when {triggers}.
compatibility: Requires {tool/dependency}
---
```

```markdown
# {Tool Name} Skill

Overview of the integration.

---

## Quick Reference

| Tool / Command | Purpose |
| -------------- | ------- |
| ...            | ...     |

---

## Workflow

### Step 1: ...

### Step 2: ...

---

## Troubleshooting

| Issue | Solution |
| ----- | -------- |
| ...   | ...      |
```

## Checklist: Before Committing a New Skill

- [ ] Folder uses lowercase-hyphenated name matching `name:` field
- [ ] `description` is a single-line inline string (no YAML block scalars)
- [ ] `description` includes WHAT, WHEN, and keywords
- [ ] Body uses `---` horizontal rules between major sections
- [ ] Tables used for structured data instead of prose lists
- [ ] Code examples are project-relevant (Bicep, KQL, Azure CLI)
- [ ] `## Learn More` section references `microsoft_docs_search()` where applicable
- [ ] Added to `.github/skills/README.md` under the correct category
- [ ] Added to `.github/copilot-instructions.md` skills table
- [ ] Wired into consuming agents via mandatory read list
