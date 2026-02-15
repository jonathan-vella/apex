---
description: "MANDATORY research-before-implementation requirements for all agents"
applyTo: "**/*.agent.md, **/agent-output/**/*.md, **/.github/skills/**/SKILL.md"
---

# Agent Research Requirements

**MANDATORY: All agents MUST perform thorough research before implementation.**

This instruction enforces a "research-first" pattern to ensure complete, one-shot execution
without missing context or requiring multiple iterations.

## Pre-Implementation Research Checklist

Before creating ANY output files or making changes, agents MUST:

- [ ] **Search workspace** for existing patterns (`agent-output/`, similar projects, templates)
- [ ] **Read relevant templates** in `.github/skills/azure-artifacts/templates/` for output structure
- [ ] **Query documentation** via MCP tools (Azure docs, best practices)
- [ ] **Validate inputs** - confirm all required artifacts from previous steps exist
- [ ] **Check shared defaults** in `.github/skills/azure-defaults/SKILL.md`
- [ ] **Achieve 80% confidence** before proceeding to implementation

## Research Workflow Pattern

<research_mandate>
**MANDATORY: Before producing output artifacts, run comprehensive research.**

### Step 1: Context Gathering (REQUIRED)

Use read-only tools to gather context without making changes:

```
# Workspace context
- semantic_search: Find related code, patterns, and documentation
- grep_search: Search for specific terms, resource names, patterns
- read_file: Read templates, existing artifacts, configuration files
- list_dir: Explore project structure

# Azure context (where applicable)
- Azure MCP tools: Query documentation, best practices, SKU info
- mcp_bicep_list_avm_metadata: Check Azure Verified Module availability
```

### Step 2: Validation Gate (REQUIRED)

Before implementation, confirm:

1. **Required inputs exist** - Previous step artifacts are present and complete
2. **Templates loaded** - Output structure template has been read
3. **Standards understood** - Shared defaults and naming conventions reviewed
4. **Azure guidance obtained** - Relevant documentation queried

### Step 3: Confidence Assessment

Only proceed when you have **80% confidence** in your understanding of:

- What needs to be created/modified
- Where files should be located
- What format/structure to use
- What Azure resources/patterns apply

**If confidence is below 80%**: Use `#tool:agent` to delegate autonomous research,
or ASK the user for clarification rather than assuming.
</research_mandate>

## Delegation Pattern for Deep Research

When extensive research is needed, delegate to a subagent:

```markdown
MANDATORY: Run #tool:agent tool, instructing the agent to work autonomously
without pausing for user feedback, to gather comprehensive context and return findings.
```

This pattern enables thorough investigation without interrupting the workflow.

## Enforcement Rules

**DO:**

- ✅ Research BEFORE creating files
- ✅ Read templates BEFORE generating output
- ✅ Query Azure docs BEFORE recommending services
- ✅ Check existing patterns BEFORE creating new ones
- ✅ Validate inputs BEFORE proceeding to next step
- ✅ Ask for clarification when confidence is low

**DO NOT:**

- ❌ Skip research to "save time"
- ❌ Assume requirements without verification
- ❌ Create output without reading the template first
- ❌ Recommend Azure services without checking documentation
- ❌ Proceed with missing inputs from previous workflow steps
- ❌ Make up information when uncertain

## Per-Agent Research Focus

| Agent            | Primary Research Focus                                            |
| ---------------- | ----------------------------------------------------------------- |
| **Requirements** | User needs, existing projects, compliance requirements            |
| **Architect**    | Azure services, WAF pillars, SKU recommendations, pricing         |
| **Design**       | Existing architecture, icon availability, layout patterns         |
| **Bicep Plan**   | AVM availability, governance constraints, implementation patterns |
| **Bicep Code**   | Module structure, naming conventions, security defaults           |
| **Deploy**       | Template validation, what-if results, resource dependencies       |
| **As-Built**     | Deployed resources, configuration details, operational procedures |

## Integration with Workflow

This research-first pattern integrates with the 7-step workflow:

1. Each step should validate outputs from previous steps exist
2. Each step should read its output template before generating content
3. Each step should query relevant Azure documentation
4. Each step should achieve 80% confidence before proceeding

See [Azure Defaults Skill](../skills/azure-defaults/SKILL.md) for the complete
research requirements specification.
