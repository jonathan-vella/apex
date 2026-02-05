#!/usr/bin/env python3
"""
Agent Workflow Sequence Diagram
Generates a sequence diagram showing the InfraOps Conductor workflow with all 5 gates.

Based on: ShepAlderson/copilot-orchestra workflow pattern
"""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# Configuration
FIGSIZE = (16, 22)
DPI = 150
BACKGROUND = '#FFFFFF'
HEADER_COLOR = '#5B5FC7'
HEADER_TEXT = '#FFFFFF'
ARROW_COLOR = '#6B7280'
DASHED_COLOR = '#9CA3AF'
GATE_LINE = '#EF4444'
TEXT_COLOR = '#1F2937'
STEP_BG = '#F0F9FF'

# Actors (x-positions)
ACTORS = {
    'User': 0.10,
    'Conductor': 0.26,
    'Requirements': 0.42,
    'Architect': 0.58,
    'Bicep': 0.74,
    'Deploy': 0.90
}

def create_sequence_diagram():
    """Create the agent workflow sequence diagram with all 5 gates."""
    fig, ax = plt.subplots(1, 1, figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor(BACKGROUND)
    ax.set_facecolor(BACKGROUND)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    
    # Title
    ax.text(0.5, 0.98, 'InfraOps Conductor Workflow', fontsize=20, fontweight='bold',
            ha='center', va='top', color=TEXT_COLOR)
    ax.text(0.5, 0.96, 'Requirements → Architecture → Plan → Code → Deploy → Docs',
            fontsize=12, ha='center', va='top', color='#6B7280', style='italic')
    
    # Draw actor headers
    header_y = 0.935
    header_height = 0.025
    for name, x in ACTORS.items():
        rect = FancyBboxPatch((x - 0.055, header_y - header_height/2), 0.11, header_height,
                              boxstyle="round,pad=0.01,rounding_size=0.01",
                              facecolor=HEADER_COLOR, edgecolor='none')
        ax.add_patch(rect)
        ax.text(x, header_y, name, fontsize=9, fontweight='bold',
                ha='center', va='center', color=HEADER_TEXT)
    
    # Draw vertical lifelines
    lifeline_top = 0.915
    lifeline_bottom = 0.03
    for name, x in ACTORS.items():
        ax.plot([x, x], [lifeline_top, lifeline_bottom], color=DASHED_COLOR, 
                linestyle='--', linewidth=1.5, zorder=1)
    
    # Footer headers
    footer_y = 0.015
    for name, x in ACTORS.items():
        rect = FancyBboxPatch((x - 0.055, footer_y - header_height/2), 0.11, header_height,
                              boxstyle="round,pad=0.01,rounding_size=0.01",
                              facecolor=HEADER_COLOR, edgecolor='none')
        ax.add_patch(rect)
        ax.text(x, footer_y, name, fontsize=9, fontweight='bold',
                ha='center', va='center', color=HEADER_TEXT)
    
    def solid_arrow(from_x, to_x, y, label):
        ax.annotate('', xy=(to_x, y), xytext=(from_x, y),
                    arrowprops=dict(arrowstyle='->', color=ARROW_COLOR, lw=1.5))
        ax.text((from_x + to_x) / 2, y + 0.008, label, fontsize=8, ha='center', va='bottom', color=TEXT_COLOR)
    
    def dashed_arrow(from_x, to_x, y, label):
        ax.annotate('', xy=(to_x, y), xytext=(from_x, y),
                    arrowprops=dict(arrowstyle='->', color=DASHED_COLOR, lw=1.5, linestyle='--'))
        ax.text((from_x + to_x) / 2, y + 0.008, label, fontsize=8, ha='center', va='bottom', color='#6B7280', style='italic')
    
    def draw_gate(y, gate_num, gate_name):
        ax.plot([0.03, 0.97], [y, y], color=GATE_LINE, linewidth=2.5)
        ax.text(0.03, y + 0.008, f'GATE {gate_num}', fontsize=9, ha='left', va='bottom', color='#DC2626', fontweight='bold')
        ax.text(0.97, y + 0.008, gate_name, fontsize=8, ha='right', va='bottom', color='#DC2626', style='italic')
    
    def step_note(y, text):
        ax.text(0.03, y, text, fontsize=9, ha='left', va='center', color='#1E40AF', fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.3', facecolor=STEP_BG, edgecolor='#93C5FD'))
    
    y = 0.895
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Describe infrastructure project')
    y -= 0.025
    
    # Step 1
    step_note(y, 'Step 1: Requirements')
    y -= 0.020
    solid_arrow(ACTORS['Conductor'], ACTORS['Requirements'], y, 'Gather requirements')
    y -= 0.020
    dashed_arrow(ACTORS['Requirements'], ACTORS['Conductor'], y, 'Return 01-requirements.md')
    y -= 0.020
    draw_gate(y, 1, 'Requirements Approval')
    y -= 0.020
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Approve requirements')
    y -= 0.030
    
    # Step 2
    step_note(y, 'Step 2: Architecture')
    y -= 0.020
    solid_arrow(ACTORS['Conductor'], ACTORS['Architect'], y, 'Assess architecture (WAF)')
    y -= 0.020
    dashed_arrow(ACTORS['Architect'], ACTORS['Conductor'], y, 'Return 02-assessment.md + cost estimate')
    y -= 0.020
    draw_gate(y, 2, 'Architecture Approval')
    y -= 0.020
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Approve architecture')
    y -= 0.030
    
    # Step 3 (Optional)
    step_note(y, 'Step 3: Design (Optional)')
    y -= 0.020
    ax.text(ACTORS['Conductor'], y, '[Diagrams, ADRs via skills]', fontsize=8, ha='center', va='center', color='#6B7280', style='italic')
    y -= 0.025
    
    # Step 4
    step_note(y, 'Step 4: Planning')
    y -= 0.020
    solid_arrow(ACTORS['Conductor'], ACTORS['Architect'], y, 'Create implementation plan')
    y -= 0.020
    dashed_arrow(ACTORS['Architect'], ACTORS['Conductor'], y, 'Return 04-plan.md + governance')
    y -= 0.020
    draw_gate(y, 3, 'Plan Approval')
    y -= 0.020
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Approve plan')
    y -= 0.030
    
    # Step 5
    step_note(y, 'Step 5: Implementation')
    y -= 0.020
    solid_arrow(ACTORS['Conductor'], ACTORS['Bicep'], y, 'Generate Bicep templates')
    y -= 0.020
    dashed_arrow(ACTORS['Bicep'], ACTORS['Conductor'], y, 'Return infra/bicep/{project}/')
    y -= 0.015
    ax.text((ACTORS['Conductor'] + ACTORS['Bicep'])/2, y, '[Lint, What-If, Review subagents]', fontsize=7, ha='center', va='center', color='#6B7280', style='italic')
    y -= 0.020
    draw_gate(y, 4, 'Pre-Deploy Approval')
    y -= 0.020
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Approve for deployment')
    y -= 0.030
    
    # Step 6
    step_note(y, 'Step 6: Deploy')
    y -= 0.020
    solid_arrow(ACTORS['Conductor'], ACTORS['Deploy'], y, 'Execute deployment (what-if first)')
    y -= 0.020
    dashed_arrow(ACTORS['Deploy'], ACTORS['Conductor'], y, 'Return 06-deployment-summary.md')
    y -= 0.020
    draw_gate(y, 5, 'Post-Deploy Verification')
    y -= 0.020
    solid_arrow(ACTORS['User'], ACTORS['Conductor'], y, 'Verify deployment')
    y -= 0.030
    
    # Step 7
    step_note(y, 'Step 7: Documentation')
    y -= 0.020
    ax.text(ACTORS['Conductor'], y, '[azure-workload-docs skill]', fontsize=8, ha='center', va='center', color='#6B7280', style='italic')
    y -= 0.020
    solid_arrow(ACTORS['Conductor'], ACTORS['User'], y, 'Workflow complete + 07-* docs')
    
    # Legend
    legend_y = 0.055
    ax.text(0.5, legend_y + 0.015, 'Legend:', fontsize=9, ha='center', va='center', fontweight='bold', color=TEXT_COLOR)
    ax.plot([0.25, 0.32], [legend_y, legend_y], color=ARROW_COLOR, linewidth=1.5)
    ax.text(0.33, legend_y, 'Request', fontsize=8, ha='left', va='center', color=TEXT_COLOR)
    ax.plot([0.45, 0.52], [legend_y, legend_y], color=DASHED_COLOR, linewidth=1.5, linestyle='--')
    ax.text(0.53, legend_y, 'Response', fontsize=8, ha='left', va='center', color='#6B7280')
    ax.plot([0.67, 0.74], [legend_y, legend_y], color=GATE_LINE, linewidth=2.5)
    ax.text(0.75, legend_y, 'Approval Gate', fontsize=8, ha='left', va='center', color='#DC2626')
    
    output_path = 'docs/presenter/infographics/generated/agent-workflow-sequence.png'
    plt.tight_layout()
    plt.savefig(output_path, dpi=DPI, facecolor=BACKGROUND, edgecolor='none', bbox_inches='tight', pad_inches=0.1)
    plt.close()
    print(f"✅ Generated: {output_path}")
    return output_path

if __name__ == '__main__':
    create_sequence_diagram()
