#!/usr/bin/env python3
"""
Agent Workflow Sequence Diagram
Generates a landscape infographic-style sequence diagram showing the InfraOps
Conductor workflow with all 5 approval gates.

Based on: ShepAlderson/copilot-orchestra workflow pattern
"""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as path_effects

# --- Configuration ---
FIGSIZE = (24, 14)
DPI = 150
BG_COLOR = '#F8FAFF'

# Azure-inspired palette
AZURE_BLUE = '#0078D4'
AZURE_DARK = '#002050'
AZURE_LIGHT = '#E8F4FD'
CONDUCTOR_COLOR = '#5B5FC7'
GATE_RED = '#D13438'
GATE_BG = '#FDE8E8'
STEP_COLORS = {
    1: '#0078D4',   # Requirements - Azure blue
    2: '#107C10',   # Architecture - Green
    3: '#8764B8',   # Design - Purple
    4: '#CA5010',   # Planning - Orange
    5: '#038387',   # Implementation - Teal
    6: '#D13438',   # Deploy - Red
    7: '#515C6B',   # Documentation - Gray
}
TEXT_DARK = '#1B1B1F'
TEXT_MID = '#5F6B7C'
TEXT_LIGHT = '#8B95A5'
ARROW_COLOR = '#4A5568'
RETURN_COLOR = '#94A3B8'
LIFELINE_COLOR = '#CBD5E1'


# --- Actor layout (x-positions) ---
ACTORS = {
    'User':         {'x': 0.07, 'icon': '▶', 'color': '#374151'},
    'Conductor':    {'x': 0.21, 'icon': '♪', 'color': CONDUCTOR_COLOR},
    'Requirements': {'x': 0.38, 'icon': '§', 'color': STEP_COLORS[1]},
    'Architect':    {'x': 0.55, 'icon': '◆', 'color': STEP_COLORS[2]},
    'Bicep Code':   {'x': 0.72, 'icon': '⚙', 'color': STEP_COLORS[5]},
    'Deploy':       {'x': 0.89, 'icon': '▲', 'color': STEP_COLORS[6]},
}


def create_sequence_diagram():
    """Create the agent workflow sequence diagram with all 5 gates."""
    fig, ax = plt.subplots(1, 1, figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    # ── Title bar ──────────────────────────────────────────────
    title_rect = FancyBboxPatch(
        (0.02, 0.93), 0.96, 0.06,
        boxstyle="round,pad=0.01,rounding_size=0.015",
        facecolor=AZURE_DARK, edgecolor='none', zorder=5)
    ax.add_patch(title_rect)
    ax.text(0.50, 0.965, 'InfraOps Conductor  —  Agent Workflow',
            fontsize=22, fontweight='bold', ha='center', va='center',
            color='#FFFFFF', zorder=6,
            fontfamily='sans-serif')
    ax.text(0.50, 0.940, 'Requirements  →  Architecture  →  Design  →  Plan  →  Code  →  Deploy  →  Docs',
            fontsize=11, ha='center', va='center', color='#93C5FD', zorder=6,
            fontfamily='sans-serif', style='italic')

    # ── Actor headers ──────────────────────────────────────────
    header_y = 0.895
    header_h = 0.040
    header_w = 0.115
    for name, info in ACTORS.items():
        x = info['x']
        c = info['color']
        icon = info['icon']
        # Shadow
        shadow = FancyBboxPatch(
            (x - header_w/2 + 0.002, header_y - header_h/2 - 0.003), header_w, header_h,
            boxstyle="round,pad=0.008,rounding_size=0.012",
            facecolor='#00000015', edgecolor='none', zorder=2)
        ax.add_patch(shadow)
        # Box
        rect = FancyBboxPatch(
            (x - header_w/2, header_y - header_h/2), header_w, header_h,
            boxstyle="round,pad=0.008,rounding_size=0.012",
            facecolor=c, edgecolor='none', zorder=3)
        ax.add_patch(rect)
        ax.text(x, header_y + 0.003, icon, fontsize=14,
                ha='center', va='center', zorder=4)
        display_name = name
        ax.text(x, header_y - 0.012, display_name, fontsize=10, fontweight='bold',
                ha='center', va='center', color='#FFFFFF', zorder=4,
                fontfamily='sans-serif')

    # ── Lifelines ──────────────────────────────────────────────
    lifeline_top = 0.870
    lifeline_bottom = 0.065
    for name, info in ACTORS.items():
        x = info['x']
        ax.plot([x, x], [lifeline_top, lifeline_bottom],
                color=LIFELINE_COLOR, linestyle=':', linewidth=1.2, zorder=1)

    # ── Footer actor boxes ─────────────────────────────────────
    footer_y = 0.035
    for name, info in ACTORS.items():
        x = info['x']
        c = info['color']
        rect = FancyBboxPatch(
            (x - header_w/2, footer_y - header_h/2), header_w, header_h,
            boxstyle="round,pad=0.008,rounding_size=0.012",
            facecolor=c, edgecolor='none', zorder=3, alpha=0.6)
        ax.add_patch(rect)
        ax.text(x, footer_y, name, fontsize=9, fontweight='bold',
                ha='center', va='center', color='#FFFFFF', zorder=4,
                fontfamily='sans-serif')

    # ── Helper: solid arrow ────────────────────────────────────
    def solid_arrow(from_x, to_x, y, label):
        ax.annotate('', xy=(to_x, y), xytext=(from_x, y),
                    arrowprops=dict(arrowstyle='->', color=ARROW_COLOR,
                                    lw=1.8, connectionstyle='arc3,rad=0'))
        txt = ax.text((from_x + to_x) / 2, y + 0.010, label,
                      fontsize=8.5, ha='center', va='bottom', color=TEXT_DARK,
                      fontfamily='sans-serif', fontweight='medium')
        txt.set_path_effects([
            path_effects.withStroke(linewidth=3, foreground=BG_COLOR)])

    # ── Helper: dashed arrow ───────────────────────────────────
    def dashed_arrow(from_x, to_x, y, label):
        ax.annotate('', xy=(to_x, y), xytext=(from_x, y),
                    arrowprops=dict(arrowstyle='->', color=RETURN_COLOR,
                                    lw=1.5, linestyle='--'))
        txt = ax.text((from_x + to_x) / 2, y + 0.010, label,
                      fontsize=8, ha='center', va='bottom', color=TEXT_MID,
                      fontfamily='sans-serif', style='italic')
        txt.set_path_effects([
            path_effects.withStroke(linewidth=3, foreground=BG_COLOR)])

    # ── Helper: gate line ──────────────────────────────────────
    def draw_gate(y, gate_num, gate_name):
        # Gate background strip
        gate_strip = FancyBboxPatch(
            (0.025, y - 0.008), 0.95, 0.016,
            boxstyle="round,pad=0.002,rounding_size=0.006",
            facecolor=GATE_BG, edgecolor=GATE_RED, linewidth=1.2,
            zorder=2, alpha=0.7)
        ax.add_patch(gate_strip)
        ax.text(0.045, y, f'■  GATE {gate_num}', fontsize=9, ha='left', va='center',
                color=GATE_RED, fontweight='bold', fontfamily='sans-serif', zorder=3)
        ax.text(0.955, y, gate_name, fontsize=8.5, ha='right', va='center',
                color=GATE_RED, style='italic', fontfamily='sans-serif', zorder=3)

    # ── Helper: step badge ─────────────────────────────────────
    def step_badge(y, step_num, text):
        c = STEP_COLORS.get(step_num, '#5F6B7C')
        badge_w = 0.025
        badge_h = 0.018
        # Circle badge
        badge = FancyBboxPatch(
            (0.025, y - badge_h/2), badge_w, badge_h,
            boxstyle="round,pad=0.003,rounding_size=0.008",
            facecolor=c, edgecolor='none', zorder=3)
        ax.add_patch(badge)
        ax.text(0.025 + badge_w/2, y, str(step_num), fontsize=9, fontweight='bold',
                ha='center', va='center', color='#FFFFFF', zorder=4,
                fontfamily='sans-serif')
        ax.text(0.025 + badge_w + 0.008, y, text, fontsize=10, ha='left', va='center',
                color=c, fontweight='bold', fontfamily='sans-serif',
                zorder=3)

    # ── Helper: note text (italic, centered) ───────────────────
    def note_text(x, y, text):
        txt = ax.text(x, y, text, fontsize=8, ha='center', va='center',
                      color=TEXT_LIGHT, style='italic', fontfamily='sans-serif')
        txt.set_path_effects([
            path_effects.withStroke(linewidth=3, foreground=BG_COLOR)])

    # ── Sequence flow ──────────────────────────────────────────
    u = ACTORS['User']['x']
    co = ACTORS['Conductor']['x']
    rq = ACTORS['Requirements']['x']
    ar = ACTORS['Architect']['x']
    bi = ACTORS['Bicep Code']['x']
    dp = ACTORS['Deploy']['x']

    y = 0.850
    solid_arrow(u, co, y, 'Describe infrastructure project')
    y -= 0.025

    # Step 1: Requirements
    step_badge(y, 1, 'Requirements')
    y -= 0.020
    solid_arrow(co, rq, y, 'Gather requirements')
    y -= 0.020
    dashed_arrow(rq, co, y, '01-requirements.md')
    y -= 0.018
    draw_gate(y, 1, 'Requirements Approval')
    y -= 0.018
    solid_arrow(u, co, y, 'Approve ✓')
    y -= 0.028

    # Step 2: Architecture
    step_badge(y, 2, 'Architecture')
    y -= 0.020
    solid_arrow(co, ar, y, 'WAF assessment + cost estimate')
    y -= 0.020
    dashed_arrow(ar, co, y, '02-assessment.md + cost estimate')
    y -= 0.018
    draw_gate(y, 2, 'Architecture Approval')
    y -= 0.018
    solid_arrow(u, co, y, 'Approve ✓')
    y -= 0.028

    # Step 3: Design (Optional)
    step_badge(y, 3, 'Design (Optional)')
    y -= 0.018
    note_text(co, y, '[ Diagrams + ADRs via skills ]')
    y -= 0.025

    # Step 4: Planning
    step_badge(y, 4, 'Planning')
    y -= 0.020
    solid_arrow(co, ar, y, 'Create implementation plan')
    y -= 0.020
    dashed_arrow(ar, co, y, '04-plan.md + governance')
    y -= 0.018
    draw_gate(y, 3, 'Plan Approval')
    y -= 0.018
    solid_arrow(u, co, y, 'Approve ✓')
    y -= 0.028

    # Step 5: Implementation
    step_badge(y, 5, 'Implementation')
    y -= 0.020
    solid_arrow(co, bi, y, 'Generate Bicep templates')
    y -= 0.020
    dashed_arrow(bi, co, y, 'infra/bicep/{project}/')
    y -= 0.014
    note_text((co + bi) / 2, y, '[ Lint · What-If · Review subagents ]')
    y -= 0.018
    draw_gate(y, 4, 'Pre-Deploy Approval')
    y -= 0.018
    solid_arrow(u, co, y, 'Approve ✓')
    y -= 0.028

    # Step 6: Deploy
    step_badge(y, 6, 'Deploy')
    y -= 0.020
    solid_arrow(co, dp, y, 'Execute deployment (what-if preflight)')
    y -= 0.020
    dashed_arrow(dp, co, y, '06-deployment-summary.md')
    y -= 0.018
    draw_gate(y, 5, 'Post-Deploy Verification')
    y -= 0.018
    solid_arrow(u, co, y, 'Verify ✓')
    y -= 0.028

    # Step 7: Documentation
    step_badge(y, 7, 'Documentation')
    y -= 0.018
    note_text(co, y, '[ azure-artifacts skill ]')
    y -= 0.020
    solid_arrow(co, u, y, 'Workflow complete  ·  07-* documentation suite')

    # ── Legend ─────────────────────────────────────────────────
    legend_y = 0.075
    legend_bg = FancyBboxPatch(
        (0.20, legend_y - 0.015), 0.60, 0.030,
        boxstyle="round,pad=0.005,rounding_size=0.010",
        facecolor='#FFFFFF', edgecolor='#E2E8F0', linewidth=1, zorder=2)
    ax.add_patch(legend_bg)

    lx = 0.26
    ax.plot([lx, lx + 0.05], [legend_y, legend_y], color=ARROW_COLOR, lw=2)
    ax.text(lx + 0.06, legend_y, 'Request', fontsize=9, ha='left', va='center',
            color=TEXT_DARK, fontfamily='sans-serif')

    lx = 0.40
    ax.plot([lx, lx + 0.05], [legend_y, legend_y], color=RETURN_COLOR, lw=1.5, linestyle='--')
    ax.text(lx + 0.06, legend_y, 'Response', fontsize=9, ha='left', va='center',
            color=TEXT_MID, fontfamily='sans-serif')

    lx = 0.56
    ax.plot([lx, lx + 0.05], [legend_y, legend_y], color=GATE_RED, lw=2.5)
    ax.text(lx + 0.06, legend_y, 'Approval Gate', fontsize=9, ha='left', va='center',
            color=GATE_RED, fontfamily='sans-serif', fontweight='bold')

    # ── Save ───────────────────────────────────────────────────
    output_path = 'docs/presenter/infographics/generated/agent-workflow-sequence.png'
    plt.tight_layout()
    plt.savefig(output_path, dpi=DPI, facecolor=BG_COLOR,
                edgecolor='none', bbox_inches='tight', pad_inches=0.15)
    plt.close()
    print(f"✅ Generated: {output_path}")
    return output_path


if __name__ == '__main__':
    create_sequence_diagram()
