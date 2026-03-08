---
toc_depth: 3
---

# :material-book-cog-outline: Skills and Instructions

## :material-bookshelf: Skills System

### Skill Structure

Each skill follows a standard layout:

```text
.github/skills/{name}/
├── SKILL.md                    # Core overview (≤ 500 lines)
├── references/                 # Deep reference material (loaded on demand)
│   ├── detailed-guide.md
│   └── lookup-table.md
└── templates/                  # Template files (loaded on demand)
    └── artifact.template.md
```

### Progressive Loading

Skills implement three levels of disclosure:

1. **Level 1 — SKILL.md**: Compact overview loaded when the agent reads the skill.
   Contains quick-reference tables, decision frameworks, and pointers to deeper content.

2. **Level 2 — references/**: Detailed guides, lookup tables, and protocol definitions.
   Loaded only when a specific sub-task requires deep knowledge.

3. **Level 3 — templates/**: Exact structural skeletons for artefact generation.
   Loaded only during the output generation phase.

### Skill Catalog

The system contains 20 skills across several domains:

| Domain               | Skills                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------- |
| Azure Infrastructure | `azure-defaults`, `azure-bicep-patterns`, `terraform-patterns`                         |
| Azure Operations     | `azure-troubleshooting`, `azure-diagrams`, `azure-adr`                                 |
| Artefact Generation  | `azure-artifacts`, `context-shredding`                                                 |
| Documentation        | `docs-writer`, `microsoft-docs`, `microsoft-code-reference`, `microsoft-skill-creator` |
| Workflow and State   | `session-resume`, `workflow-engine`, `golden-principles`                               |
| Deployment           | `iac-common`                                                                           |
| GitHub Operations    | `github-operations`, `git-commit`                                                      |
| Meta / Tooling       | `make-skill-template`, `context-optimizer`                                             |

## :material-file-cog-outline: Instruction System

### Glob-Based Auto-Application

Instructions are not read explicitly by agents. They are injected automatically by
VS Code Copilot when a matching file is in context. The `applyTo` glob pattern controls
when each instruction activates:

| Instruction                     | `applyTo`                    | Enforces                             |
| ------------------------------- | ---------------------------- | ------------------------------------ |
| `bicep-code-best-practices`     | `**/*.bicep`                 | AVM-first, security baseline, naming |
| `terraform-code-best-practices` | `**/*.tf`                    | AVM-TF, provider pinning, naming     |
| `bicep-policy-compliance`       | `**/*.bicep`                 | Azure Policy compliance in Bicep     |
| `terraform-policy-compliance`   | `**/*.tf`                    | Azure Policy compliance in Terraform |
| `azure-artifacts`               | `**/agent-output/**/*.md`    | H2 template compliance for artefacts |
| `agent-definitions`             | `**/*.agent.md`              | Frontmatter standards for agents     |
| `markdown`                      | `**/*.md`                    | Documentation standards              |
| `context-optimization`          | Agents, skills, instructions | Context window management rules      |
| `no-heredoc`                    | `**`                         | Prevents terminal heredoc corruption |

### Enforcement Over Documentation

!!! quote "Golden Principle"

    Mechanical enforcement over documentation — if it can be a linter check, it
    should be one. Documentation is for humans; machines enforce rules.

Following the Golden Principle "Mechanical Enforcement Over Documentation," every
instruction has a corresponding validation script. The rule is: if it can be a linter
check, it should be one. Documentation is for humans; machines enforce rules.
