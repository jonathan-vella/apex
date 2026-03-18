<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Architecture Diagrams Skill (Minimal)

**Prerequisites**: `pip install diagrams matplotlib pillow`

**Execution Method**:
Save `.py` source in `agent-output/{project}/`, then run to produce `.png`. Never use heredoc execution.

**Architecture Diagram Contract**:
### Required outputs

**Professional Output Standards**:
Critical settings for clean output — use `labelloc="t"` to keep labels inside clusters:

**Azure Service Categories**:
13 categories: Compute, Networking, Database, Storage, Integration, Security,

**Common Architecture Patterns**:
Ready-to-use patterns: 3-Tier Web App, Microservices (AKS),

**Workflow Integration**:
Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

**Data Visualization Charts**:
WAF and cost charts use `matplotlib` (never Mermaid). See `references/waf-cost-charts.md` for full implementations.

**Generation Workflow**:
1. **Gather Context** — Read Bicep/Terraform templates or architecture assessment

**Guardrails**:
**DO:** Create files in `agent-output/{project}/` with step-prefixed names ·

**Scope Exclusions**:
Does NOT: generate Bicep/Terraform code · create workload docs ·

**Scripts**:

**Reference Index**:

Read `SKILL.md` or `SKILL.digest.md` for full content.
