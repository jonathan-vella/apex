---
name: apex-python-diagrams
user-invocable: true
disable-model-invocation: false
argument-hint: "diagram or chart type, project and output path"
description: "**UTILITY SKILL** — Python diagram generation for Azure architectures, WAF/cost/compliance charts, ERDs, swimlanes, timelines, and wireframes. WHEN: 'architecture diagram', 'WAF bar chart', 'cost chart', 'ERD', 'swimlane', 'timeline', 'wireframe'. DO NOT USE FOR: inline Mermaid diagrams (apex-mermaid)."
compatibility: Works with VS Code Copilot, Claude Code, and any tool capable of running Python scripts.
license: MIT
metadata:
  author: apex
  version: "2.0"
---

# Python Diagrams & Charts (`dlib` SVG/PNG + `matplotlib`)

Skill for authoring faithful, brand-consistent Azure architecture diagrams as
editable `1920×1080` SVG masters plus `3840×2160` (4K) PNG renders using
[`scripts/dlib.py`](scripts/dlib.py) and the bundled official Microsoft Azure
Public Service Icons v23 (`assets/`), alongside `matplotlib` for quantitative
WAF/cost/compliance charts via [`scripts/diagram_io.py`](scripts/diagram_io.py).

## Prerequisites

```bash
pip install cairosvg matplotlib pillow diagrams graphviz && apt-get install -y graphviz
```

## Routing Guide

Every diagram generator emits **both `.svg` and `.png` siblings** — the `.svg` is
the editable vector master (selectable text, embedded official Azure SVG `<symbol>`
icons) and the `.png` is the `3840×2160` raster render.

| Diagram type | Engine | Helper / API | Output |
| --- | --- | --- | --- |
| Azure architecture, hub-spoke routing, private DNS | `dlib` (`scripts/dlib.py`) | `from dlib import *; reset(); add(...); finish(...)` | `.py` + `.svg` + `.png` (4K) |
| Identity, RBAC, Key Vault & telemetry flows | `dlib` (`scripts/dlib.py`) | `from dlib import *; reset(); add(...); finish(...)` | `.py` + `.svg` + `.png` (4K) |
| Subscription vending, cutover & pipeline swimlanes | `dlib` (`scripts/dlib.py`) | `from dlib import *; reset(); add(...); finish(...)` | `.py` + `.svg` + `.png` (4K) |
| WAF bar charts | `matplotlib` | `save_figure` from `scripts/diagram_io.py` | `.py` + `.png` + `.svg` |
| Cost donut / projection charts | `matplotlib` | `save_figure` from `scripts/diagram_io.py` | `.py` + `.png` + `.svg` |
| Compliance gap & Gantt timeline charts | `matplotlib` | `save_figure` from `scripts/diagram_io.py` | `.py` + `.png` + `.svg` |
| Entity-relationship diagrams (ERD) | `dlib` or `graphviz` | `dlib.finish` or `render_graphviz` (`diagram_io.py`) | `.py` + `.png` + `.svg` |
| UI wireframes | SVG / `graphviz` | `create_wireframe_svg` (`multi_diagram_generator.py`) | `.py` + `.svg` (+ `.png` via CairoSVG) |

## Required Outputs (Workflow Integration)

| Step | Python diagram & chart files |
| --- | --- |
| 2 | `02-waf-scores.py/.png/.svg` (`matplotlib` via `save_figure`) |
| 3 | `03-des-diagram.py/.png/.svg` (`dlib`), `03-des-cost-distribution.py/.png/.svg`, `03-des-cost-projection.py/.png/.svg` |
| 4 | `04-dependency-diagram.py/.png/.svg` (`dlib`), `04-runtime-diagram.py/.png/.svg` (`dlib`) |
| 7 | `07-ab-diagram.py/.png/.svg` (`dlib`), `07-ab-cost-*.py/.png/.svg`, `07-ab-compliance-gaps.py/.png/.svg` |

Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

## Architecture Diagram Workflow (`dlib.py`)

Draw the approved specification faithfully; never redesign or invent unapproved services.

1. **Inspect scope & choose pattern**: Read the architecture/plan specification for exact titles, resource names, CIDRs, boundaries, and connectors. Consult [`references/common-patterns.md`](references/common-patterns.md) for the closest `dlib.py` generator template (hub-and-spoke routing, subscription vending, private DNS, workload placement, identities/secrets/telemetry, cutover, or multi-lane swimlanes).
2. **Author `.py` on the `1920×1080` canvas**:
   ```python
   import sys
   from pathlib import Path
   sys.path.insert(0, str(Path(".github/skills/apex-python-diagrams/scripts").resolve()))
   from dlib import *  # noqa: F403

   reset()
   # Add boundaries (sub, rg, box), service cards (card), arrows (arr), chips (chip, chip2), badges (circ, badge)
   add(sub(30, 95, 1860, 720, "Production workload subscription", TL, "#F2FAF8", "PRODUCTION", 190))
   ...
   finish("agent-output/{project}/04-runtime-diagram", "Runtime Architecture & Private Connectivity")
   ```
3. **Run & check overflow warnings**: Execute `python3 agent-output/{project}/<name>.py`. `dlib.t()` prints `WARN overflow:` lines whenever estimated text width exceeds `mw`. Fix every warning by wrapping text into two lines (`chip2` or multi-line `card`) or widening the box — never shrink text below `12px`.
4. **Inspect the rendered PNG & SVG**: View the rendered `.png` (`3840×2160`) to verify zero overlapping labels, uncrossed arrows, and clean visual hierarchy. Note: if the `view` tool caches by path, copy the PNG to a unique preview filename, inspect it, and remove the temporary preview afterward.

## Canvas, Palette & Boundary Rules (`dlib.py`)

* **Canvas**: SVG `width="3840" height="2160" viewBox="0 0 1920 1080"`, explicit white background (`#FFFFFF`), font `Segoe UI, Arial, sans-serif`. Title top-centre at `(960, 56)` (`40px` bold navy `#0B1F3A`); footer bottom-centre at `(960, 1058)` (`18px` `#4A5A6A`, defaults to `"APEX"`).
* **Semantic Colours**:
  * **Shared platform (`BL` / `BLF`)**: Stroke `#0078D4`, fills `#E6F1FB` / `#F5FAFF`
  * **Workload (`TL` / `TLF`)**: Stroke `#008272`, fills `#E3F4F1` / `#F2FAF8`
  * **Legacy / management (`SL` / `GRF`)**: Stroke `#5B6B7B`, fill `#EEF2F6`
  * **Migration / notes / policy / exceptions (`AM` / `AMB` / `AMF`)**: Stroke `#D18B00` / `#F2A900` on fill `#FFF6DD`
  * **Identity (`PU` / `PUF`)**: Stroke `#7B3FA0`, fill `#F3ECF8`
* **Distinct Boundaries** (containment = boundary, relationship = arrow):
  * **Tenant**: Heavy navy solid border (`NAVY`, `sw=2.5`)
  * **Management group**: Filled rounded box with `mg` icon
  * **Subscription**: `sub(x, y, w, h, name, col, fill, badgetxt, bw)` — solid `2.5px` border + `sub` icon + top-right scope badge
  * **Resource group**: `rg(x, y, w, h, name, col)` — dashed `1.8px` border (`stroke-dasharray="7 4"`) + `rg` icon
  * **VNet / Subnet**: Solid box inside RG with `vnet` / `subnet` icon and CIDR block in the header
* **Semantic Connectors (`arr(d, kind=...)`)**:
  * `net` (solid blue `#0078D4`): network/request traffic
  * `id` (dashed purple `#7B3FA0`): identity, RBAC, token/secret authorization
  * `dns` (dotted teal `#008272`): private DNS resolution
  * `tel` (dashed slate `#5B6B7B`): diagnostics and OpenTelemetry/Log Analytics
  * `mig` (solid amber `#D18B00`): replication / migration cutover path
  * `off` (dashed grey `#8A98A8`): disabled / decommissioned path
* **Typography & Anti-Crowding**:
  * Body `17–22px`, headers `20–26px`, badges `15px` bold, nothing below `~12px`.
  * Keep text inside boxes (`~0.52em/char` regular, `~0.56em/char` bold). XML-escape `<`, `>`, and `&` (`&lt;`, `&gt;`, `&amp;`).
  * Keep a `20px+` gap between sibling boxes and leave dedicated routing corridors for orthogonal connectors (`M...H...V...`).
  * Order subnets/cards so arrows land without crossing unrelated cards.
  * Prefer numbered/lettered callout badges (`circ(x, y, "A", BL)`) with a bottom "Example paths / Key facts" panel over crowded inline connector labels.
  * Place legends and callout panels in free space, never overlapping the title or top-left tenant header (`x=30..480, y=92..121`). List only used connector types in the legend.

## Official Azure SVG Icons (`assets/`)

All **705 official Microsoft Azure Public Service Icons (v23)** plus `assets/github.svg` (`gh`) are vendored offline under [`assets/`](assets/).
* **Curated short keys (`dlib.P`)**: `ten`, `mg`, `sub`, `rg`, `pol`, `bud`, `arc`, `rsv`, `bvault`, `vnet`, `subnet`, `fw`, `fwp`, `waf`, `dns`, `bas`, `nat`, `peer`, `rt`, `pe`, `pip`, `nsg`, `afd`, `agw`, `lb`, `vpngw`, `er`, `vm`, `disk`, `app`, `asp`, `func`, `swa`, `aks`, `acr`, `aci`, `aca`, `signalr`, `sqlmi`, `sqls`, `sqldb`, `arcsql`, `cosmos`, `postgres`, `mysql`, `redis`, `blob`, `st`, `cont`, `queue`, `apim`, `sb`, `evg`, `evh`, `logic`, `adf`, `databricks`, `kv`, `mi`, `user`, `entra`, `appreg`, `entapp`, `mon`, `law`, `ai`, `openai`, `foundry`, `search`, `cog`, `ml`, `code`, `cli`, `dev`, plus `gh` (GitHub).
* **Full v23 auto-lookup**: Any of the 705 v23 icons can also be referenced by service slug (e.g., `"event-hubs"`, `"front-door-and-cdn-profiles"`) via `dlib.resolve_icon_path(k)`.
* **Gradient ID Namespacing**: Azure SVG icons share internal gradient/clip IDs (`id="a"`, `url(#a)`). `dlib.symbols()` embeds only used icons as `<symbol id="ic-{k}">` and prefixes every internal `id`, `url(#...)`, and `href="#..."` with `{k}-`. Never inline raw SVG icon files without this prefixing.
* **Non-Azure shapes**: No official Azure icon exists for a generic browser, laptop, folder, or Microsoft Graph — use clean labelled `box()`/`card()` containers or the `folder()` glyph; never invent lookalike icons.

## Quantitative Charts & Legacy Helpers (`diagram_io.py`)

For quantitative charts (`matplotlib`), import `save_figure` from [`scripts/diagram_io.py`](scripts/diagram_io.py) so every chart emits `.png` + `.svg` siblings (`DPI 150`). See [`references/python-charts.md`](references/python-charts.md) and [`references/waf-cost-charts.md`](references/waf-cost-charts.md). Legacy `diagrams` (`diagram_kwargs` + `embed_svg_images`) and `graphviz` (`render_graphviz`) helpers remain in `diagram_io.py` for backward compatibility.

## Rules

**DO:** Use `scripts/dlib.py` (`finish` or `diagram_io.render_dlib`) for architecture, network, DNS, identity, cutover, and swimlane diagrams · Use `save_figure` from `scripts/diagram_io.py` for WAF/cost/compliance `matplotlib` charts · Fix all `WARN overflow:` hints before finishing · Keep orthogonal connectors (`M...H...V...`) in routing corridors · Escape `&lt;`, `&gt;`, `&amp;` in SVG text · Verify both `.svg` and `.png` outputs exist and are non-empty.

**DON'T:** Call `plt.savefig(...)`, `Diagram(..., outformat=...)`, or `dot.render(...)` directly · Shrink font sizes below `12px` to cram text · Route arrows across unrelated cards or text labels · Include real tenant/subscription/object IDs or credentials · Use Mermaid for rendered PNG/SVG deliverables.

## Scope Exclusions

Does NOT: produce inline Mermaid diagrams (`apex-mermaid`) · generate Bicep/Terraform · create ADRs (`apex-azure-adr`) · deploy resources.

## Scripts

`scripts/dlib.py` (primary `1920×1080` SVG + `3840×2160` 4K PNG Azure diagram engine) ·
`scripts/diagram_io.py` (shared PNG+SVG output helper: `render_dlib`, `save_figure`, `diagram_kwargs`, `render_graphviz`, `embed_svg_images`) ·
`scripts/generate_diagram.py` (interactive template generator) ·
`scripts/multi_diagram_generator.py` (ERD, swimlane, timeline, wireframe helpers) ·
`scripts/ascii_to_diagram.py` (ASCII art → diagram conversion) ·
`scripts/verify_installation.py` (prerequisites & `dlib`/v23 icon check)

## Reference Index

| File | Content |
| --- | --- |
| `references/common-patterns.md` | Ready-to-use `dlib.py` Azure architecture templates (hub-spoke, vending, DNS, identity, cutover, swimlanes) |
| `references/azure-components.md` | Curated `dlib.P` icon keys and full 705-icon Azure v23 component catalog |
| `references/python-charts.md` | Chart execution, `dlib` & `matplotlib` design tokens, output standards |
| `references/waf-cost-charts.md` | WAF pillar bar, cost donut & projection `matplotlib` chart implementations |
| `references/business-process-flows.md` | Workflow and swimlane diagram patterns |
| `references/entity-relationship-diagrams.md` | Database ERD patterns |
| `references/integration-services.md` | Integration service diagram patterns |
| `references/migration-patterns.md` | Migration and cutover architecture patterns |
| `references/sequence-auth-flows.md` | Authentication and identity flow patterns |
| `references/timeline-gantt-diagrams.md` | Project timeline and Gantt diagrams |
| `references/ui-wireframe-diagrams.md` | UI mockup and wireframe patterns |
| `references/iac-to-diagram.md` | Generate diagrams from Bicep/Terraform/ARM templates |
