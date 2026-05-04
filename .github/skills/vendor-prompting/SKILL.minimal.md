<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Vendor Prompting Best Practices (Minimal)

**When to Use This Skill**:
vendor patterns up front.

**Decision Tree**:
```text

**Model-Family Detection (mirrors validate-agents.mjs `classifyModel`)**:
The validator and this skill agree on family classification by lower-casing

**Reference Index**:
Load only the references your task needs. Most audits need 1-2.

**How to Use This Skill for an Audit**:
This is the canonical audit procedure (full version with templates lives

**Source Citations**:
Every rule in [rules.json](rules.json) cites the upstream source by

**Freshness**:
Run `npm run audit:vendor-prompting` to refresh snapshots and emit a

Read `SKILL.md` or `SKILL.digest.md` for full content.
