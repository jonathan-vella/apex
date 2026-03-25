<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Architecture Diagrams Skill (Minimal)

**Routing Guide**:

**Prerequisites**:

**Architecture Diagram Contract (Draw.io — Default)**:

### Required outputs

**Naming Conventions**:
Cell IDs: `{resource-type}-{number}` (e.g., `vm-1`). Container IDs: `{scope}-{name}` (e.g., `rg-prod`).

**Azure Design Tokens**:
Azure Blue `#0078D4` (borders, edges) · VNet fill `#F0F8FF` · Warning `#FF8C00` ·

**Diagram Abstraction Rules (MANDATORY)**:
Show primary data flow clearly; omit implementation noise (PEs, ASPs, NSGs, RG boundaries).

**Layout Best Practices**:
Space icons ≥260px apart. Max 2-line labels. Never `labelWidth` < 160.

**Icon Discovery (MCP-Only)**:
Use `search-shapes` to find Azure icon shape names. Do NOT manually embed

**MCP Tool Integration**:
Key MCP tools: `search-shapes` (icon discovery), `add-cells` (batch build),

**Python Charts (WAF / Cost / Compliance)**:
WAF/cost charts use Python `matplotlib` (never Mermaid).

**Common Architecture Patterns**:
See `references/drawio-common-patterns.md` (draw.io), `references/common-patterns.md` (Python),

**Workflow Integration**:
Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

**Data Visualization Charts**:
WAF and cost charts use `matplotlib` (never Mermaid).

Read `SKILL.md` or `SKILL.digest.md` for full content.
