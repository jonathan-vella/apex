<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Architecture Diagrams Skill (Minimal)

**Routing Guide**:

- Architecture diagrams → Excalidraw JSON (`.excalidraw`) — DEFAULT
- WAF/cost/compliance charts → Python matplotlib (`.py` + `.png`)

**Prerequisites**:

- Excalidraw MCP at `https://mcp.excalidraw.com/mcp`
- Icon library: `assets/excalidraw-libraries/azure-icons.excalidrawlib`

**Architecture Diagram Contract (Excalidraw — Default)**:

### Required outputs

**Naming Conventions**:
Element IDs: `{resource-type}-{number}` (e.g., `vm-1`). Group IDs: `{scope}-{name}` (e.g., `rg-prod`).

**Azure Design Tokens**:
Azure Blue `#0078D4` (borders, arrows) · VNet fill `#e7f5ff` · Warning `#FF8C00` ·

**Diagram Abstraction Rules (MANDATORY)**:
Show primary data flow clearly; omit implementation noise (PEs, ASPs, NSGs, RG boundaries).

**Layout Best Practices**:
Space icons ≥200px apart. Max 2-line labels. All text `fontFamily: 5` (Excalifont).

**Icon Discovery**:
Look up icons in `assets/excalidraw-libraries/azure-icons/reference.md`.
Use `scripts/add-icon-to-diagram.py` for programmatic placement.

**MCP Tool Integration**:
Remote Excalidraw MCP. Fallback: generate JSON directly + Python scripts.

**Python Charts (WAF / Cost / Compliance)**:
WAF/cost charts use Python `matplotlib` (never Mermaid).

**Common Architecture Patterns**:
See `references/excalidraw-common-patterns.md` (Excalidraw), `references/common-patterns.md` (Python).

**Workflow Integration**:
Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

**Data Visualization Charts**:
WAF and cost charts use `matplotlib` (never Mermaid).

Read `SKILL.md` or `SKILL.digest.md` for full content.
