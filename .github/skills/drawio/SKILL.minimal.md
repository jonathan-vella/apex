<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Draw.io Architecture Diagrams (Minimal)

**Prerequisites**:

**MCP Workflow Summary**:
The MCP server's startup instructions are the authoritative tool reference.

**Icon Handling**:
Icons are resolved automatically by the MCP server from its built-in library

**Diagram Creation Workflows**:
**Workflow A — Non-Transactional** (small diagrams): each tool call returns full XML

**Batch-Only Workflow (CRITICAL)**:
**Every tool that accepts an array MUST be called exactly ONCE with ALL items.**

**Layout Conventions**:
groups need ≥ 150px width per icon (labels are ~130px wide).

**Gotchas**:
or omit `text` entirely; never pass `""`.

**Reference Index**:
### Quality Reference Examples

Read `SKILL.md` or `SKILL.digest.md` for full content.
