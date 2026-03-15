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

📋 **Reference**: Read `references/step-by-step-guide.md` for the detailed 4-step creation process:

1. **Create the Skill Directory** — lowercase, hyphenated folder name
2. **Generate SKILL.md with Frontmatter** — field requirements, description best practices
3. **Write the Skill Body** — recommended sections and structure
4. **Add Optional Directories** — scripts/, references/, assets/, templates/

> _See SKILL.md for full content._

## Example: Complete Skill Structure

```text
my-awesome-skill/
├── SKILL.md                    # Required instructions
├── LICENSE.txt                 # Optional license file
├── scripts/
│   └── helper.py               # Executable automation

> _See SKILL.md for full content._

## Quick Start: Duplicate This Template

1. Copy the `make-skill-template/` folder
2. Rename to your skill name (lowercase, hyphens)
3. Update `SKILL.md`:
   - Change `name:` to match folder name
   - Write a keyword-rich `description:`
   - Replace body content with your instructions

> _See SKILL.md for full content._
