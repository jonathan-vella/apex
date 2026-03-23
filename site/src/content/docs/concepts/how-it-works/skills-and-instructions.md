---
title: "Skills and Instructions"
description: "How skills and instructions guide agents"
---
## Skills System

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

The system contains the following skills across several domains:

| Domain               | Skills                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Azure Infrastructure | `azure-defaults`, `azure-bicep-patterns`, `terraform-patterns`                                                                                                                                                                                                                                                                                                                                                      |
| Azure Operations     | `azure-diagnostics`, `azure-diagrams`, `azure-adr`                                                                                                                                                                                                                                                                                                                                                                  |
| Artefact Generation  | `azure-artifacts`, `context-shredding`                                                                                                                                                                                                                                                                                                                                                                              |
| Documentation        | `docs-writer`                                                                                                                                                                                                                                                                                                                                                                                                       |
| Workflow and State   | `session-resume`, `workflow-engine`, `golden-principles`                                                                                                                                                                                                                                                                                                                                                            |
| Deployment           | `iac-common`                                                                                                                                                                                                                                                                                                                                                                                                        |
| GitHub Operations    | `github-operations`, `git-commit`                                                                                                                                                                                                                                                                                                                                                                                   |
| Azure Plugin Skills  | `azure-prepare`, `azure-cost-optimization`, `azure-deploy` (not active), `azure-compute`, `azure-compliance`, `azure-rbac`, `azure-storage`, `azure-messaging`, `azure-kusto`, `azure-ai`, `azure-aigateway`, `azure-quotas`, `azure-resource-lookup`, `azure-resource-visualizer`, `azure-cloud-migrate`, `azure-hosted-copilot-sdk`, `appinsights-instrumentation`, `entra-app-registration`, `microsoft-foundry` |
| Microsoft Learn      | `microsoft-docs`, `microsoft-code-reference`, `microsoft-skill-creator`                                                                                                                                                                                                                                                                                                                                             |
| Meta / Tooling       | `make-skill-template`, `context-optimizer`, `copilot-customization`                                                                                                                                                                                                                                                                                                                                                 |

The `copilot-customization` skill is an authoritative reference for VS Code Copilot
customisation mechanisms: instructions, prompt files, custom agents, agent skills,
MCP servers, hooks, and plugins.

## Instruction System

### Glob-Based Auto-Application

Instructions are not read explicitly by agents. They are injected automatically by
VS Code Copilot when a matching file is in context. The `applyTo` glob pattern controls
when each instruction activates:

| Instruction                     | `applyTo`                                          | Enforces                                 |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| `bicep-code-best-practices`     | `**/*.bicep`                                       | AVM-first, security baseline, naming     |
| `terraform-code-best-practices` | `**/*.tf`                                          | AVM-TF, provider pinning, naming         |
| `bicep-policy-compliance`       | `**/*.bicep`                                       | Azure Policy compliance in Bicep         |
| `terraform-policy-compliance`   | `**/*.tf`                                          | Azure Policy compliance in Terraform     |
| `iac-cost-repeatability`        | `**/*.bicep`, `**/*.tf`, `**/04-impl*.md`          | Budget alerts, zero hardcoded values     |
| `azure-artifacts`               | `**/agent-output/**/*.md`                          | H2 template compliance for artefacts     |
| `agent-definitions`             | `**/*.agent.md`                                    | Frontmatter standards for agents         |
| `agent-research-first`          | `**/*.agent.md`, agent-output, skills              | Mandatory research-before-implementation |
| `agent-skills`                  | `**/.github/skills/**/SKILL.md`                    | Skill file format standards              |
| `instructions`                  | `**/*.instructions.md`                             | Meta: instruction file guidelines        |
| `markdown`                      | `**/*.md`                                          | Documentation standards                  |
| `context-optimization`          | Agents, skills, instructions                       | Context window management rules          |
| `code-commenting`               | `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}`  | Self-explanatory code, minimal comments  |
| `code-review`                   | `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}`  | Priority tiers, security checks          |
| `cost-estimate`                 | `**/03-des-cost-estimate.md`, `**/07-ab-cost-*.md` | Cost estimate documentation standards    |
| `docs-trigger`                  | `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}`  | Trigger conditions for doc updates       |
| `docs`                          | `docs/**/*.md`                                     | User-facing documentation standards      |
| `governance-discovery`          | `**/04-governance-constraints.*`                   | Azure Policy discovery requirements      |
| `workload-documentation`        | `**/agent-output/**/07-*.md`                       | Workload documentation standards         |
| `github-actions`                | `.github/workflows/*.yml`                          | GitHub Actions workflow standards        |
| `javascript`                    | `**/*.{js,mjs,cjs}`                                | JavaScript/Node.js conventions           |
| `json`                          | `**/*.{json,jsonc}`                                | JSON/JSONC formatting                    |
| `python`                        | `**/*.py`                                          | Python coding conventions                |
| `shell`                         | `**/*.sh`                                          | Shell scripting best practices           |
| `powershell`                    | `**/*.ps1`, `**/*.psm1`                            | PowerShell cmdlet best practices         |
| `prompt`                        | `**/*.prompt.md`                                   | Prompt file guidelines                   |
| `no-heredoc`                    | `**`                                               | Prevents terminal heredoc corruption     |

When multiple instructions apply to the same file via overlapping `applyTo` globs,
precedence rules determine which takes priority. See
`.github/instructions/references/precedence-matrix.md` for the full matrix.
Short version: Azure Policy compliance (Tier 1) always wins over domain IaC (Tier 2),
which wins over cross-cutting cost rules (Tier 3), which wins over general code quality (Tier 4).

**`iac-cost-repeatability`** is a cross-cutting instruction that enforces two mandatory
rules across ALL projects (Bicep and Terraform):

1. **Cost Monitoring**: Every deployment must include an Azure Budget resource with
   parameterised amount, forecast alerts at 80/100/120% thresholds, and anomaly
   detection alerts to a `technicalContact` parameter.
2. **Repeatability (zero hardcoded values)**: Templates must deploy to any
   tenant/region/subscription without source-code modification. `projectName` must
   be a parameter with no default; all tag values reference parameters;
   `.bicepparam`/`terraform.tfvars` is the only place for project-specific defaults.

### Enforcement Over Documentation

:::note[Golden Principle]
Mechanical enforcement over documentation — if it can be a linter check, it
should be one. Documentation is for humans; machines enforce rules.
:::

Following the Golden Principle "Mechanical Enforcement Over Documentation," every
instruction has a corresponding validation script. The rule is: if it can be a linter
check, it should be one. Documentation is for humans; machines enforce rules.

## Creating a Custom Skill

This section walks through creating a new skill from scratch.

### Step 1: Scaffold

Use the `make-skill-template` skill to generate the folder structure:

```text
@workspace /make-skill-template Create a skill called "my-new-skill"
```

This creates:

```text
.github/skills/my-new-skill/
├── SKILL.md          # Core overview (≤ 500 lines)
├── references/       # Deep reference material
└── templates/        # Template files for artifact generation
```

For the full scaffolding guide, see
`.github/skills/make-skill-template/references/step-by-step-guide.md`.

### Step 2: Write SKILL.md

The SKILL.md file requires YAML frontmatter:

```yaml
---
name: my-new-skill
description: "Short description of the skill's purpose.
  USE FOR: keyword triggers.
  DO NOT USE FOR: anti-triggers."
compatibility: List of compatible agents
---
# My New Skill

Quick-reference tables, decision frameworks, and pointers to deeper content.
```

**Frontmatter rules** (from `.github/instructions/agent-skills.instructions.md`):

- `name` must match the folder name exactly
- `description` must be an inline string (not a YAML block scalar)
- Keep SKILL.md under 500 lines — move deep content to `references/`

### Step 3: Add References and Templates

Use the three levels of disclosure:

| Level | Directory     | Loaded When                   | Content                            |
| ----- | ------------- | ----------------------------- | ---------------------------------- |
| 1     | `SKILL.md`    | Agent reads the skill         | Overview, quick-reference tables   |
| 2     | `references/` | Sub-task needs deep knowledge | Detailed guides, lookup tables     |
| 3     | `templates/`  | Output generation phase       | Structural skeletons for artifacts |

Example: a pricing skill might have `SKILL.md` with a service-to-tool
mapping table, `references/pricing-guidance.md` with detailed MCP tool
usage, and `templates/cost-estimate.template.md` with the output skeleton.

### Step 4: Register in Skill Affinity

Update `.github/skill-affinity.json` to declare which agents use the skill:

```json
{
  "my-new-skill": {
    "primary": ["06b-Bicep CodeGen"],
    "secondary": ["03-Architect"],
    "never": ["09-Diagnose"]
  }
}
```

- **primary** — agent loads this skill by default
- **secondary** — agent loads on demand when relevant
- **never** — agent must not load this skill (prevents context waste)

### Step 5: Wire Into Agent Bodies

Add a skill reference in the relevant agent's `.agent.md` body:

```markdown
## MANDATORY: Read Skills First

1. **Read** `.github/skills/my-new-skill/SKILL.md`
```

### Step 6: Validate

```bash
# Check skill format and frontmatter
npm run lint:skills-format

# Check skill size and references
npm run validate:skill-checks

# Verify skill-affinity consistency
npm run validate:skill-affinity
```

### How Skill Discovery Works

Agents discover skills through **description keywords**. When a user's
request matches keywords in the skill's `description` field (USE FOR /
DO NOT USE FOR), VS Code automatically suggests loading that skill.
Write descriptions with specific, searchable trigger words.

---

:::tip[Further Reading]
- [Core Concepts](four-pillars.md) — the four knowledge layers and how they interact
- [Agent Architecture](agents.md) — how agents load and use skills via progressive disclosure
- [Workflow Engine & Quality](workflow-engine.md) — validators that enforce instruction rules
- [MCP Integration](mcp-integration.md) — external tool interfaces available to agents
- [Validation & Linting](../validation-reference.md) — all validation scripts and hooks
:::
