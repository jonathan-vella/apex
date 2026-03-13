<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Make Skill Template (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

- User asks to "create a skill", "make a new skill", or "scaffold a skill"
- User wants to add a specialized capability to their GitHub Copilot setup
- User needs help structuring a skill with bundled resources
- User wants to duplicate this template as a starting point


## Prerequisites

- Understanding of what the skill should accomplish
- A clear, keyword-rich description of capabilities and triggers
- Knowledge of any bundled resources needed (scripts, references, assets, templates)


## Creating a New Skill

### Step 1: Create the Skill Directory

Create a new folder with a lowercase, hyphenated name:

```text
skills/<skill-name>/
└── SKILL.md          # Required

> _See SKILL.md for full content._

## Example: Complete Skill Structure

```text
my-awesome-skill/
├── SKILL.md                    # Required instructions
├── LICENSE.txt                 # Optional license file
├── scripts/
│   └── helper.py               # Executable automation
├── references/

> _See SKILL.md for full content._

## Quick Start: Duplicate This Template

1. Copy the `make-skill-template/` folder
2. Rename to your skill name (lowercase, hyphens)
3. Update `SKILL.md`:
   - Change `name:` to match folder name
   - Write a keyword-rich `description:`
   - Replace body content with your instructions
4. Add bundled resources as needed

> _See SKILL.md for full content._

## Validation Checklist

- [ ] Folder name is lowercase with hyphens
- [ ] `name` field matches folder name exactly
- [ ] `description` is 10-1024 characters
- [ ] `description` explains WHAT and WHEN
- [ ] `description` is wrapped in single quotes
- [ ] Body content is under 500 lines
- [ ] Bundled assets are under 5MB each

> _See SKILL.md for full content._

## Troubleshooting

| Issue                    | Solution                                                 |
| ------------------------ | -------------------------------------------------------- |
| Skill not discovered     | Improve description with more keywords and triggers      |
| Validation fails on name | Ensure lowercase, no consecutive hyphens, matches folder |
| Description too short    | Add capabilities, triggers, and keywords                 |
| Assets not found         | Use relative paths from skill root                       |


## Project-Specific Scaffold Templates

When creating skills for _this_ project, use one of these skeletons that match
the conventions already established in the repository.

### Azure Knowledge Skill Skeleton

For skills that teach agents about Azure patterns, conventions, or diagnostics:


> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

## Learn More

| Topic | How to Find                          |
| ----- | ------------------------------------ |
| ...   | `microsoft_docs_search(query="...")` |
````

### Integration Skill Skeleton


> _See SKILL.md for full content._

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

### Checklist: Before Committing a New Skill


> _See SKILL.md for full content._
