#!/usr/bin/env python3
"""
Agent Workflow Sequence Diagram
Generates a sequence diagram showing the InfraOps Conductor workflow.

Based on: ShepAlderson/copilot-orchestra workflow pattern
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrow
import numpy as np

# Configuration
FIGSIZE = (14, 16)
DPI = 150
BACKGROUND = '#FFFFFF'
HEADER_COLOR = '#5B5FC7'  # Purple accent
HEADER_TEXT = '#FFFFFF'
ARROW_COLOR = '#6B7280'
DASHED_COLOR = '#9CA3AF'
LOOP_COLOR = '#EFF6FF'
ALT_APPROVED = '#D1FAE5'
ALT_REVISION = '#FEF3C7'
ALT_FAILED = '#FEE2E2'
TEXT_COLOR = '#1F2937'

# Actors (x-positions)
ACTORS = {
    'User': 0.12,
    'Conductor': 0.30,
    'Requirements': 0.48,
    'Architect': 0.66,
    'Deploy': 0.84
}

def create_sequence_diagram():
    """Create the agent workflow sequence diagram."""
    fig, ax = plt.subplots(1, 1, figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor(BACKGROUND)
    ax.set_facecolor(BACKGROUND)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    
    # Title
    ax.text(0.5, 0.97, 'InfraOps Conductor Workflow', fontsize=18, fontweight='bold',
            ha='center', va='top', color=TEXT_COLOR)
    ax.text(0.5, 0.94, 'Requirements → Architecture → Plan → Code → Deploy → Docs',
            fontsize=11, ha='center', va='top', color='#6B7280', style='italic')
    
    # Draw actor headers
    header_y = 0.90
    header_height = 0.035
    for name, x in ACTORS.items():
        # Header box
        rect = FancyBboxPatch((x - 0.06, header_y - header_height/2), 0.12, header_height,
                              boxstyle="round,pad=0.01,rounding_size=0.01",
                              facecolor=HEADER_COLOR, edgecolor='none')
        ax.add_patch(rect)
        ax.text(x, header_y, name, fontsize=10, fontweight='bold',
                ha='center', va='center', color=HEADER_TEXT)
    
    # Draw vertical lifelines
    lifeline_top = 0.87
    lifeline_bottom = 0.05
    for name, x in ACTORS.items():
        ax.plot([x, x], [lifeline_top, lifeline_bottom], color=DASHED_COLOR, 
                linestyle='--', linewidth=1.5, zorder=1)
    
    # Footer headers (same as top)
    footer_y = 0.03
    for name, x in ACTORS.items():
        rect = FancyBboxPatch((x - 0.06, footer_y - header_height/2), 0.12, header_height,
                              boxstyle="round,pad=0.01,rounding_size=0.01",
                              facecolor=HEADER_COLOR, edgecolor='none')
        ax.add_patch(rect)
        ax.text(x, footer_y, name, fontsize=10, fontweight='bold',
                ha='center', va='center', color=HEADER_TEXT)
    
    # Helper functions
    def solid_arrow(from_x, to_x, y, label, label_above=True):
        """Draw a solid arrow with label."""
        ax.annotate('', xy=(to_x, y), xytext=(from_x, y),
                    arrowprops=dict(arrowstyle='->', color=ARROW_COLOR, lw=1.5))
        label_y = y + 0.012 if label_above else y - 0.012
        mid_x = (from_x + to_x) / 2
        ax.text(mid_x, label_y, label, fontsize=9, ha='center', va='bottom' if label_above else 'top',
                color=TEXT_COLOR)
    
    def dashed_arrow(from_x, to_x, y, label, label_above=True):
        """Draw a dashed return arrow with label."""
        ax.annotate('', xy=(to_x, y), xytext=(from_x, y),
                    arrowprops=dict(arrowstyle='->', color=DASHED_COLOR, lw=1.5, linestyle='--'))
        label_y = y + 0.012 if label_above else y - 0.012
        mid_x = (from_x + to_x) / 2
        ax.text(mid_x, label_y, label, fontsize=9, ha='center', va='bottom' if label_above else 'top',
                color='#6B7280', style='italic')
    
    def draw_box(x1, x2, y1, y2, color, label=None, label_color='#374151'):
        """Draw a box region (loop/alt)."""
        rect = FancyBboxPatch((x1, y2), x2 - x1, y1 - y2,
                              boxstyle="round,pad=0.005,rounding_size=0.01",
                              facecolor=color, edgecolor='#9CA3AF', linewidth=1, alpha=0.7)
        ax.add_patch(rect)
        if label:
            # Label tag
            tag_rect = FancyBboxPatch((x1, y1 - 0.015), 0.06, 0.020,
                                      boxstyle="round,pad=0.002", facecolor='#E5E7EB',
                                      edgecolor='#9CA3AF', linewidth=0.5)
            ax.add_patch(tag_rect)
            ax.text(x1 + 0.03, y1 - 0.005, label, fontsize=8, fontweight='bold',
                    ha='center', va='center', color=label_color)
    
    # === SEQUENCE EVENTS ===
    y = 0.84
    
    # 1. User describes infrastructure project
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Describe infrastructure project')
    y -= 0.04
    
    # 2. Conductor delegates to Requirements
    solid_arrow(ACTORS['Conductor'], ACTORS['Requirements'], y, 'Gather requirements')
    y -= 0.03
    dashed_arrow(ACTORS['Requirements'], ACTORS['Conductor'], y, 'Return 01-requirements.md')
    y -= 0.04
    
    # 3. Conductor delegates to Architect  
    solid_arrow(ACTORS['Conductor'], ACTORS['Architect'], y, 'Assess architecture (WAF)')
    y -= 0.03
    dashed_arrow(ACTORS['Architect'], ACTORS['Conductor'], y, 'Return 02-assessment.md')
    y -= 0.04
    
    # 4. Present plan to user
    solid_arrow(ACTORS['Conductor'], ACTORS['User'], y, 'Present implementation plan')
    y -= 0.03
    
    # GATE 1: User approval
    ax.plot([0.05, 0.95], [y, y], color='#EF4444', linewidth=2, linestyle='-')
    ax.text(0.97, y, 'GATE 1', fontsize=9, ha='left', va='center', color='#DC2626', fontweight='bold')
    y -= 0.03
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Approve plan')
    y -= 0.035
    
    # === LOOP BOX: For each step (Plan → Code → Deploy) ===
    loop_top = y + 0.015
    loop_bottom = y - 0.22
    draw_box(0.08, 0.92, loop_top, loop_bottom, LOOP_COLOR, 'loop')
    ax.text(0.15, loop_top - 0.005, '[For each workflow step]', fontsize=9, ha='left',
            va='center', color='#1E40AF', fontweight='bold')
    y -= 0.03
    
    # 5. Execute step
    solid_arrow(ACTORS['Conductor'], ACTORS['Architect'], y, 'Execute workflow step')
    y -= 0.03
    dashed_arrow(ACTORS['Architect'], ACTORS['Conductor'], y, 'Report artifacts')
    y -= 0.04
    
    # 6. Review/Validate
    solid_arrow(ACTORS['Conductor'], ACTORS['Deploy'], y, 'Validate outputs')
    y -= 0.03
    dashed_arrow(ACTORS['Deploy'], ACTORS['Conductor'], y, 'Return status')
    y -= 0.035
    
    # === ALT BOX: Outcomes ===
    alt_top = y + 0.015
    alt_bottom = y - 0.14
    
    # Approved section
    draw_box(0.10, 0.90, alt_top, alt_top - 0.045, ALT_APPROVED)
    ax.text(0.12, alt_top - 0.005, '[Approved]', fontsize=9, ha='left', va='center',
            color='#059669', fontweight='bold')
    y -= 0.03
    solid_arrow(ACTORS['Conductor'], ACTORS['User'], y, 'Present summary & proceed')
    y -= 0.025
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Continue to next step')
    y -= 0.025
    
    # Divider line
    ax.plot([0.10, 0.90], [y, y], color='#9CA3AF', linewidth=1, linestyle='--')
    
    # Needs Revision section
    draw_box(0.10, 0.90, y, y - 0.04, ALT_REVISION)
    ax.text(0.12, y - 0.005, '[Needs Revision]', fontsize=9, ha='left', va='center',
            color='#D97706', fontweight='bold')
    y -= 0.03
    solid_arrow(ACTORS['Conductor'], ACTORS['Architect'], y, 'Revise with feedback')
    y -= 0.025
    
    # Divider line
    ax.plot([0.10, 0.90], [y, y], color='#9CA3AF', linewidth=1, linestyle='--')
    
    # Failed section
    draw_box(0.10, 0.90, y, y - 0.04, ALT_FAILED)
    ax.text(0.12, y - 0.005, '[Failed]', fontsize=9, ha='left', va='center',
            color='#DC2626', fontweight='bold')
    y -= 0.03
    solid_arrow(ACTORS['Conductor'], ACTORS['User'], y, 'Request guidance')
    
    # Alt tag
    ax.text(0.05, alt_top - 0.005, 'alt', fontsize=8, fontweight='bold',
            ha='center', va='center', color='#374151',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='#E5E7EB', edgecolor='#9CA3AF'))
    
    y -= 0.045
    
    # === Final completion ===
    solid_arrow(ACTORS['Conductor'], ACTORS['User'], y, 'Workflow complete + 07-* docs')
    
    # Save
    output_path = 'docs/presenter/infographics/generated/agent-workflow-sequence.png'
    plt.tight_layout()
    plt.savefig(output_path, dpi=DPI, facecolor=BACKGROUND, edgecolor='none',
                bbox_inches='tight', pad_inches=0.1)
    plt.close()
    print(f"✅ Generated: {output_path}")
    return output_path

if __name__ == '__main__':
    create_sequence_diagram()
