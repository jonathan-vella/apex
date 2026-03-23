#!/usr/bin/env python3
"""Generate the Agent Delegation Graph infographic as a PNG.

Usage:
    python agent-delegation-graph.py
Output:
    ../../public/images/agent-delegation-graph.png
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import matplotlib.patheffects as pe

# ── Palette (matches Starlight dark theme) ───────────────────────────────
BG = "#0d1117"
TEXT_WHITE = "#f0f6fc"
TEXT_MUTED = "#8b949e"
ACCENT = "#0078d4"

PAL = {
    "conductor": "#8957E5",
    "shared":    "#4ea8de",
    "arch":      "#f0a830",
    "design":    "#c084fc",
    "gov":       "#f97316",
    "plan":      "#4ade80",
    "code":      "#f472b6",
    "deploy":    "#34d399",
    "docs":      "#60a5fa",
    "sub":       "#a5b4fc",
    "mcp":       "#fde047",
}

FONT = "DejaVu Sans"
CW, CH = 2.0, 0.55  # card width / height

# ─────────────────────────────────────────────────────────────────────────
# Node list: (x, y, label, step_label, color_key, has_gate)
# ─────────────────────────────────────────────────────────────────────────
NODES = [
    # 0  Conductor
    (8.0, 8.5, "Conductor", "", "conductor", False),
    # Shared row
    (2.5, 6.8, "Requirements", "Step 1", "shared", True),      # 1
    (5.5, 6.8, "Architect", "Step 2", "arch", True),            # 2
    (8.5, 6.8, "Design", "Step 3", "design", False),            # 3
    (11.5, 6.8, "Governance", "Step 3.5", "gov", True),         # 4
    # Bicep track
    (4.5, 4.8, "Bicep Planner", "Step 4b", "plan", True),      # 5
    (4.5, 3.2, "Bicep CodeGen", "Step 5b", "code", False),      # 6
    (4.5, 1.6, "Bicep Deploy", "Step 6b", "deploy", True),      # 7
    # Terraform track
    (11.5, 4.8, "TF Planner", "Step 4t", "plan", True),         # 8
    (11.5, 3.2, "TF CodeGen", "Step 5t", "code", False),        # 9
    (11.5, 1.6, "TF Deploy", "Step 6t", "deploy", True),        # 10
    # Converge
    (8.0, 0.2, "As-Built Docs", "Step 7", "docs", False),       # 11
    # Side helper
    (2.5, 5.5, "Pricing MCP", "", "mcp", False),                # 12
]

EDGES = [
    # Conductor -> shared steps
    (0, 1, False), (0, 2, False), (0, 3, False), (0, 4, False),
    # Shared chain
    (1, 2, False), (2, 3, False), (3, 4, False),
    # Fork
    (4, 5, False), (4, 8, False),
    # Bicep track
    (5, 6, False), (6, 7, False),
    # TF track
    (8, 9, False), (9, 10, False),
    # Converge
    (7, 11, False), (10, 11, False),
    # Pricing MCP -> Architect (dashed)
    (12, 2, True),
]

SUBS = {
    6: ["lint", "whatif", "review"],   # Bicep CodeGen
    9: ["lint", "plan", "review"],     # TF CodeGen
}


def card(ax, x, y, label, step, ckey, gate):
    fill = PAL[ckey]
    r = FancyBboxPatch(
        (x - CW / 2, y - CH / 2), CW, CH,
        boxstyle="round,pad=0.08", facecolor=fill,
        edgecolor="white", linewidth=0.6, alpha=0.90, zorder=3)
    ax.add_patch(r)
    ax.text(x, y + 0.02, label, fontsize=10, fontfamily=FONT,
            fontweight="bold", color="#000", ha="center", va="center", zorder=4)
    if step:
        ax.text(x, y - CH / 2 - 0.15, step, fontsize=7, fontfamily=FONT,
                color=TEXT_MUTED, ha="center", va="top", zorder=4)
    if gate:
        ax.text(
            x + CW / 2 + 0.08, y + 0.12, "GATE", fontsize=5.5,
            fontfamily=FONT, fontweight="bold", color="#fbbf24",
            ha="left", va="center", zorder=5,
            bbox=dict(boxstyle="round,pad=0.12", facecolor="#1c1c1c",
                      edgecolor="#fbbf24", linewidth=0.5, alpha=0.9))


def edge(ax, i0, i1, dashed=False):
    x0, y0 = NODES[i0][0], NODES[i0][1]
    x1, y1 = NODES[i1][0], NODES[i1][1]
    ls = (0, (4, 3)) if dashed else "-"
    al = 0.35 if dashed else 0.55
    ax.annotate(
        "", xy=(x1, y1 + CH / 2), xytext=(x0, y0 - CH / 2),
        arrowprops=dict(arrowstyle="-|>", color=TEXT_MUTED, lw=1.2,
                        linestyle=ls, alpha=al, mutation_scale=12),
        zorder=1)


def subs(ax, pidx, names):
    px, py = NODES[pidx][0], NODES[pidx][1]
    sx = px + CW / 2 + 0.25
    for i, name in enumerate(names):
        cy = py + 0.30 - i * 0.32
        bw, bh = 0.9, 0.22
        r = FancyBboxPatch(
            (sx, cy - bh / 2), bw, bh, boxstyle="round,pad=0.05",
            facecolor=PAL["sub"], edgecolor="white",
            linewidth=0.4, alpha=0.85, zorder=3)
        ax.add_patch(r)
        ax.text(sx + bw / 2, cy, name, fontsize=7, fontfamily=FONT,
                fontweight="bold", color="#000", ha="center", va="center",
                zorder=4)
        ax.plot([px + CW / 2 + 0.02, sx], [py + 0.30 - i * 0.32, cy],
                color=TEXT_MUTED, lw=0.6, alpha=0.3, zorder=1)


def main():
    fig, ax = plt.subplots(figsize=(16, 9.5), facecolor=BG)
    ax.set_facecolor(BG)
    ax.set_xlim(-0.2, 16.2)
    ax.set_ylim(-1.2, 9.8)
    ax.set_aspect("equal")
    ax.axis("off")

    # Title
    ax.text(8.0, 9.4, "Agent Delegation Graph",
            fontsize=22, fontfamily=FONT, fontweight="bold",
            color=TEXT_WHITE, ha="center", va="center",
            path_effects=[pe.withStroke(linewidth=2, foreground=BG)])
    # Subtitle
    ax.text(8.0, 9.05,
            "Shared steps (1 - 3.5, 7) are common  |  Steps 4 - 6 diverge into Bicep or Terraform tracks",
            fontsize=9, fontfamily=FONT, color=TEXT_MUTED, ha="center", va="center")

    # Track lane backgrounds
    for lx in [4.5, 11.5]:
        ax.add_patch(FancyBboxPatch(
            (lx - 1.8, 0.7), 3.6, 5.0,
            boxstyle="round,pad=0.2", facecolor="white",
            edgecolor=ACCENT, linewidth=0.6, alpha=0.04, zorder=0))

    # Track labels
    for lx, txt in [(4.5, "Bicep Track"), (11.5, "Terraform Track")]:
        ax.text(lx, 5.55, txt, fontsize=9, fontfamily=FONT,
                color=ACCENT, ha="center", va="center", fontstyle="italic",
                alpha=0.7)

    # Edges
    for i0, i1, d in EDGES:
        edge(ax, i0, i1, d)

    # Cards
    for i, (x, y, label, step, ckey, gate) in enumerate(NODES):
        card(ax, x, y, label, step, ckey, gate)

    # Subagent badges
    for pidx, names in SUBS.items():
        subs(ax, pidx, names)

    # Validation markers on code nodes
    for ci in [6, 9]:
        cx, cy = NODES[ci][0], NODES[ci][1]
        ax.text(cx - CW / 2 - 0.15, cy, "V", fontsize=8, fontfamily=FONT,
                fontweight="bold", color="#4ade80", ha="center", va="center",
                zorder=5, bbox=dict(boxstyle="circle,pad=0.15",
                                    facecolor="#0d1117", edgecolor="#4ade80",
                                    linewidth=0.8))

    # Legend
    ly = -0.6
    for x, txt in [(3.5, "GATE  = Human approval gate"),
                    (7.0, "V  = Automated validation"),
                    (10.5, "- -  = Data feed (dashed)")]:
        ax.text(x, ly, txt, fontsize=8, fontfamily=FONT,
                color=TEXT_MUTED, ha="center", va="center")

    plt.tight_layout(pad=0.3)

    # Write to site/public/images/
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(script_dir, "..", "site", "public", "images",
                       "agent-delegation-graph.png")
    out = os.path.normpath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fig.savefig(out, dpi=180, bbox_inches="tight", facecolor=BG, pad_inches=0.3)
    plt.close()
    print(f"Generated: {out}")


if __name__ == "__main__":
    main()
