#!/usr/bin/env python3
"""Generate a clean, minimal Agentic InfraOps workflow diagram (Graphviz).

Outputs (README-ready):
- docs/presenter/infographics/generated/agentic-infraops-workflow.svg  (transparent bg)
- docs/presenter/infographics/generated/agentic-infraops-workflow.png  (white bg)
"""

from __future__ import annotations

from pathlib import Path

from graphviz import Digraph


def _agent_label(name: str) -> str:
    # Small square icon placeholder + agent name (HTML-like label).
    return f"""<
<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
  <TR>
    <TD WIDTH="12" HEIGHT="12" BGCOLOR="#111827"></TD>
    <TD WIDTH="6"></TD>
    <TD ALIGN="LEFT" VALIGN="MIDDLE"><FONT POINT-SIZE="10" COLOR="#111827">{name}</FONT></TD>
  </TR>
</TABLE>
>"""


def build() -> Digraph:
    # Pipeline steps and owning agents.
    steps = [
        ("s1", "Requirements", "Requirements Agent"),
        ("s2", "Architecture", "Architecture Agent"),
        ("s3", "Design", "Design Agent"),
        ("s4", "Plan", "Bicep Plan Agent"),
        ("s5", "Code", "Bicep Code Agent"),
        ("s6", "Deploy", "Deploy Agent"),
        ("s7", "Documentation", "Documentation (Skills)"),
    ]

    g = Digraph("AgenticInfraOps", engine="dot")
    g.attr(
        rankdir="TB",  # Allows WAF above / AVM below while keeping a horizontal pipeline row.
        splines="ortho",
        bgcolor="transparent",
        pad="0.15",
        nodesep="0.35",
        ranksep="0.45",
        fontname="Helvetica",
        fontsize="12",
        labelloc="t",
        labeljust="c",
        label="Agentic InfraOps Workflow",
    )

    # Node/edge defaults (minimal, engineering-oriented).
    g.attr(
        "node",
        shape="box",
        style="rounded,filled",
        fillcolor="#FFFFFF",
        color="#D1D5DB",
        fontname="Helvetica",
        fontsize="11",
        fontcolor="#111827",
        penwidth="1.2",
        margin="0.18,0.10",
    )
    g.attr(
        "edge",
        color="#6B7280",
        penwidth="1.2",
        arrowsize="0.7",
    )

    # --- Guardrail: WAF (single bar above) ---
    g.node(
        "waf",
        label="Azure Well-Architected Framework (WAF) \u2013 continuous guardrails",
        fillcolor="#EFF6FF",
        color="#2563EB",
        fontcolor="#1E3A8A",
        penwidth="1.3",
    )

    # --- Step nodes (single horizontal pipeline row) ---
    for sid, step_name, _agent_name in steps:
        g.node(sid, label=step_name)

    with g.subgraph(name="rank_steps") as r:
        r.attr(rank="same")
        for sid, _step_name, _agent_name in steps:
            r.node(sid)

    # Strict left-to-right flow across steps.
    for (sid_a, _, _), (sid_b, _, _) in zip(steps, steps[1:]):
        g.edge(sid_a, sid_b, color="#111827", penwidth="1.6", tailport="e", headport="w")

    # Subtle dashed connection from WAF to the workflow (once, to the middle step).
    g.edge("waf", "s4", style="dashed", color="#93C5FD", penwidth="1.1", arrowhead="none")

    # --- Agent labels (below their step; purely visual, not part of flow) ---
    for sid, _step_name, agent_name in steps:
        aid = f"a_{sid}"
        g.node(aid, label=_agent_label(agent_name), shape="plaintext")
        g.edge(sid, aid, style="invis", constraint="true")

    # --- Guardrail: AVM (constraint box below, connected only to Design/Plan/Code) ---
    g.node(
        "avm",
        label="Azure Verified Modules (AVM) \u2013 enforced",
        fillcolor="#F5F3FF",
        color="#7C3AED",
        fontcolor="#4C1D95",
        penwidth="1.3",
    )

    with g.subgraph(name="rank_avm") as r:
        r.attr(rank="sink")
        r.node("avm")

    for sid in ("s3", "s4", "s5"):
        g.edge("avm", sid, style="dashed", color="#A78BFA", penwidth="1.1", arrowhead="none")

    # Small footnote.
    g.node(
        "note",
        label="Inspired by copilot-orchestra and Copilot-Atlas; adapted for Azure InfraOps",
        shape="plaintext",
        fontcolor="#9CA3AF",
        fontsize="9",
    )
    g.edge("avm", "note", style="invis", constraint="false")

    return g


def main() -> None:
    out_dir = Path("docs/presenter/infographics/generated")
    out_dir.mkdir(parents=True, exist_ok=True)

    out_base = out_dir / "agentic-infraops-workflow"
    graph = build()

    # Render SVG (transparent background for GitHub light/dark mode).
    graph.graph_attr["bgcolor"] = "transparent"
    graph.render(str(out_base), format="svg", cleanup=True)

    # Render PNG (solid background to avoid transparency checkerboarding in raster previews).
    graph.graph_attr["bgcolor"] = "#FFFFFF"
    graph.render(str(out_base), format="png", cleanup=True)


if __name__ == "__main__":
    main()
