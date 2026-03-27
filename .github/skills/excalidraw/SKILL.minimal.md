<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Excalidraw Architecture Diagrams (Minimal)

**Mandatory Icon Embedding**:
Every Step 3, Step 4, and Step 7 architecture deliverable MUST embed official

**Prerequisites**:

**Required Outputs**:
### Output format

**Required Icon Workflow**:
Follow this loop every time the skill generates or repairs an Excalidraw

**Naming Conventions**:
Element IDs: `{resource-type}-{number}` (e.g., `vm-1`). Group IDs: `{scope}-{name}` (e.g., `rg-prod`).

**Azure Design Tokens**:
Azure Blue `#0078D4` (borders, arrows) · VNet fill `#e7f5ff` · Warning `#FF8C00` ·

**Excalidraw Color Palette**:

**Diagram Abstraction Rules (MANDATORY)**:
Show primary data flow clearly; omit implementation noise (PEs, ASPs, NSGs, RG boundaries).

**Detail Level By Step (MANDATORY)**:
major boundaries, key trust zones, and the primary flow. Do not include SKU,

**Preferred Visual Language (MANDATORY)**:
Use an enterprise Azure reference-architecture style modeled on Microsoft landing-zone and

**Anti-Patterns (DO NOT DO THIS)**:
primary architecture

**Layout Best Practices**:
default build order.

**Icon Discovery**:
Look up Azure service icons in `assets/excalidraw-libraries/azure-icons/reference.md`.

**MCP Tool Integration**:
The Excalidraw MCP server at `https://mcp.excalidraw.com/mcp` provides interactive

**Common Architecture Patterns**:
See `references/excalidraw-common-patterns.md` for complete pattern templates with

**Curated Reference Example**:
When the target output should resemble a polished enterprise Azure reference

**Cross-Step Visual Continuity**:
Treat Step 3, Step 4, and Step 7 architecture diagrams as one visual family.

**Generation Workflow**:
1. Gather context → 2. Identify resources & flow

**IaC-to-Diagram Translation**:
See `references/iac-to-diagram.md` for generating Excalidraw diagrams from existing

**Guardrails**:
**DO:** Generate `.excalidraw` JSON files · Look up icons in `reference.md` ·

**Scope Exclusions**:
Does NOT: generate Bicep/Terraform · create workload docs · deploy resources ·

**Scripts**:
`scripts/add-icon-to-diagram.py` (add Azure icon to diagram) ·

**Reference Index**:

Read `SKILL.md` or `SKILL.digest.md` for full content.
