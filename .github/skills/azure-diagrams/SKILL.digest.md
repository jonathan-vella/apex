<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Architecture Diagrams Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Routing Guide

- **Architecture diagrams** → Draw.io XML (`.drawio` + `.drawio.svg`) — DEFAULT
- **WAF bar charts, cost donuts** → Python matplotlib (`.py` + `.png`)

## Architecture Diagram Contract (Draw.io)

| Step | Draw.io files                                                                               | Python chart files (if applicable)                                   |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 3    | `03-des-diagram.drawio` + `.drawio.svg`                                                     | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 4    | `04-dependency-diagram.drawio` + `.drawio.svg`, `04-runtime-diagram.drawio` + `.drawio.svg` | —                                                                    |
| 7    | `07-ab-diagram.drawio` + `.drawio.svg`                                                      | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

## Layout Rules (MANDATORY)

### Icon & Label Sizing

- Use `labelWidth=160;overflow=width;html=1;fontSize=9` on **all** icon cells
- Space icons **at least 260px apart** horizontally within the same container
- Keep icon labels to **max 2 lines** — abbreviate resource names if needed
- Never use `labelWidth` below 160 — values < 160 cause label truncation

### Container Minimum Sizes

| Container | Min Width | Min Height | Notes                                         |
| --------- | --------- | ---------- | --------------------------------------------- |
| Subnet    | 500px     | 170px      | Must fit 2 icons at 260px spacing + padding   |
| VNet      | 600px     | 500px      | Must contain all subnets with 40px margins    |
| RG        | 800px     | 600px      | Must contain VNet + sidebar (KV, monitoring)  |
| Canvas    | 1600px    | 1000px     | Scale up 200px per additional resource column |

### Spacing Rules

- Icons inside containers: min 50px from left edge, min 45px from top edge
- Vertical spacing between stacked icons (outside VNet): min 180px
- Sidebar icons (monitoring, KV): position at `VNet.width + 80px` inside RG
- External boxes (SaaS): position at `RG.x + RG.width + 60px`
- Edge labels must not overlap with source/target resource labels

## Quality Gate (/10)

Readable at 100% zoom · No label overlap or truncation · Minimal line crossing ·
Clear tier grouping · Correct Azure icons · Security boundary visible ·
All labels fully visible (no "..." truncation) · Icons not cramped in containers.
If < 9/10, regenerate with simplification.

## Data Visualization Charts

WAF and cost charts use `matplotlib` (never Mermaid). See `references/waf-cost-charts.md`.

**Design tokens:** Background `#F8F9FA` · Azure blue `#0078D4` · DPI 150.
**WAF pillar colours:** Security `#C00000` · Reliability `#107C10` ·
Performance `#FF8C00` · Cost `#FFB900` · Operational Excellence `#8764B8`.

> _See SKILL.md for full content._

## Guardrails

**DO:** Generate architecture diagrams as `.drawio` by default ·
Use Azure icons from built libraries · Include CIDR blocks ·
Use container cells for resource hierarchy · Apply layout rules above.

**DON'T:** Use Python `diagrams` library for architecture diagrams (use draw.io) ·
Use `labelWidth` below 160 · Place icons less than 260px apart ·
Use subnets narrower than 500px · Skip quality gate verification.

> _See SKILL.md for full content._
