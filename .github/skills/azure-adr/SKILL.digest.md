<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Architecture Decision Records (ADR) Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

| Trigger Phrase                        | Use Case                                   |
| ------------------------------------- | ------------------------------------------ |
| "Create an ADR for..."                | Document a specific architectural decision |
| "Document the decision to use..."     | Record technology/pattern choice           |
| "Record why we chose..."              | Capture decision rationale                 |
| "Architecture decision record for..." | Formal ADR creation                        |

> _See SKILL.md for full content._

## Output Format

ADRs are saved to the project's agent-output folder:

````text
agent-output/{project}/
├── 03-des-adr-0001-{short-title}.md    # Design phase ADRs
└── 07-ab-adr-0001-{short-title}.md     # As-built phase ADRs

> _See SKILL.md for full content._

## ADR Template Structure

📋 **Reference**: Read `references/adr-template.md` for the full ADR template with all sections (Context, Decision, Alternatives, Consequences, WAF Pillar Analysis, Compliance, Implementation Notes).

## Example Prompts

### Design Phase ADR

```text
Create an ADR documenting our decision to use Azure Cosmos DB
instead of Azure SQL for the e-commerce catalog service.
Consider WAF implications and cost trade-offs.

> _See SKILL.md for full content._

## Integration with Workflow

| Step                | Context                      | ADR Type                     |
| ------------------- | ---------------------------- | ---------------------------- |
| Step 2 (Architect)  | After WAF assessment         | Design ADR (`03-des-adr-*`)  |
| Step 5 (Bicep Code) | After implementation choices | As-built ADR (`07-ab-adr-*`) |
| Step 6 (Deploy)     | After deployment decisions   | As-built ADR (`07-ab-adr-*`) |

## Best Practices

1. **One decision per ADR** - Keep ADRs focused on a single decision
2. **Include alternatives** - Always document what was considered and rejected
3. **Map to WAF pillars** - Show impact on each Well-Architected pillar
4. **Link to requirements** - Reference the requirement that drove the decision
5. **Keep it concise** - ADRs should be readable in 5 minutes

## Common ADR Topics

| Category        | Example Decisions                                    |
| --------------- | ---------------------------------------------------- |
| **Compute**     | AKS vs App Service, Container Apps vs Functions      |
| **Data**        | Cosmos DB vs SQL, Redis vs Table Storage             |
| **Networking**  | Hub-spoke vs flat, Private Link vs Service Endpoints |
| **Security**    | Managed Identity vs SPN, Key Vault vs App Config     |

> _See SKILL.md for full content._

## What This Skill Does NOT Do

- ❌ Generate Bicep or Terraform code
- ❌ Create architecture diagrams (use `drawio` skill)
- ❌ Deploy resources (use `deploy` agent)
- ❌ Create implementation plans (use `iac-planner` agent)

## Workflow Integration

This skill produces artifacts in **Step 3** (design) or **Step 7** (as-built).

| Workflow Step     | ADR Prefix    | Status Default | Purpose                         |
| ----------------- | ------------- | -------------- | ------------------------------- |
| Step 3 (Design)   | `03-des-adr-` | Proposed       | Document decisions before build |
| Step 7 (As-Built) | `07-ab-adr-`  | Accepted       | Document implemented decisions  |

> _See SKILL.md for full content._
````
