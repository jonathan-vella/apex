"""
Agentic InfraOps Workflow Diagram - PowerPoint Theme
7-Step workflow with dark purple gradient theme

Updated: 2025-01 for 7-Step Agentic Workflow
"""

import os
import subprocess

# Create icons directory if needed
icons_dir = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(icons_dir, exist_ok=True)

# Color palette matching PowerPoint theme
COLORS = {
    "orange": "#FF6B35",      # Primary accent (title color)
    "coral": "#f4722b",       # Secondary accent
    "blue": "#0078D4",        # Azure blue
    "green": "#10b981",       # Success green
    "yellow": "#fbbf24",      # Warning/optional yellow
    "purple": "#8b5cf6",      # Purple accent
    "pink": "#ec4899",        # Pink accent
    "teal": "#14b8a6",        # Teal
    "gray": "#64748b",        # Muted gray
    "dark_bg": "#1a1a2e",     # Dark background
    "card_bg": "#16213e",     # Card background
    "cyan": "#06b6d4",        # Cyan for governance
}


def create_workflow_diagram():
    """Generate the 7-step workflow diagram with PowerPoint theme."""

    dot_content = f'''
digraph AgenticInfraOps {{
    // Graph settings
    graph [
        bgcolor="{COLORS['dark_bg']}"
        fontcolor="white"
        fontname="Segoe UI"
        fontsize="16"
        pad="0.5"
        splines="ortho"
        nodesep="0.6"
        ranksep="0.8"
        rankdir="TB"
        dpi="150"
    ]
    
    node [
        fontname="Segoe UI"
        fontsize="11"
        fontcolor="white"
        style="filled,rounded"
        shape="box"
        penwidth="0"
        margin="0.25,0.15"
    ]
    
    edge [
        color="#64748b"
        fontcolor="#94a3b8"
        fontname="Segoe UI"
        fontsize="9"
        penwidth="2"
        arrowsize="0.8"
    ]
    
    // Title (invisible node for spacing)
    title [label="" shape="none" height="0.1"]
    
    // Step 1: Requirements
    subgraph cluster_step1 {{
        label="Step 1: Requirements"
        fontcolor="white"
        fontname="Segoe UI Semibold"
        fontsize="12"
        bgcolor="{COLORS['card_bg']}"
        style="rounded"
        pencolor="#0f3460"
        penwidth="2"
        
        plan [
            label="@plan\\n(built-in)"
            fillcolor="{COLORS['blue']}"
        ]
    }}
    
    // Step 2: Architecture
    subgraph cluster_step2 {{
        label="Step 2: Architecture"
        fontcolor="white"
        fontname="Segoe UI Semibold"
        fontsize="12"
        bgcolor="{COLORS['card_bg']}"
        style="rounded"
        pencolor="#0f3460"
        penwidth="2"
        
        architect [
            label="architect\\n(NO CODE)"
            fillcolor="{COLORS['orange']}"
        ]
    }}
    
    // Step 3: Design Artifacts
    subgraph cluster_step3 {{
        label="Step 3: Design Artifacts (Optional)"
        fontcolor="#94a3b8"
        fontname="Segoe UI Semibold"
        fontsize="12"
        bgcolor="{COLORS['card_bg']}"
        style="rounded,dashed"
        pencolor="#0f3460"
        penwidth="2"
        
        diagrams_design [
            label="📊 diagram\\n(-des)"
            fillcolor="{COLORS['purple']}"
        ]
        
        adr_design [
            label="📝 adr\\n(-des)"
            fillcolor="{COLORS['teal']}"
        ]
    }}
    
    // Step 4: Planning
    subgraph cluster_step4 {{
        label="Step 4: Planning"
        fontcolor="white"
        fontname="Segoe UI Semibold"
        fontsize="12"
        bgcolor="{COLORS['card_bg']}"
        style="rounded"
        pencolor="#0f3460"
        penwidth="2"
        
        bicep_plan [
            label="bicep-plan\\n(plan only)"
            fillcolor="{COLORS['green']}"
        ]
        
        subgraph cluster_governance {{
            label="Governance Discovery"
            fontcolor="#94a3b8"
            fontsize="10"
            bgcolor="#0f3460"
            style="rounded,dashed"
            pencolor="#334155"
            
            policy [
                label="🔒 Azure Policy\\n(constraints)"
                fillcolor="{COLORS['cyan']}"
            ]
        }}
    }}
    
    // Step 5: Implementation
    subgraph cluster_step5 {{
        label="Step 5: Implementation"
        fontcolor="white"
        fontname="Segoe UI Semibold"
        fontsize="12"
        bgcolor="{COLORS['card_bg']}"
        style="rounded"
        pencolor="#0f3460"
        penwidth="2"
        
        bicep_implement [
            label="bicep-code\\n(code generation)"
            fillcolor="{COLORS['pink']}"
        ]
    }}
    
    // Step 6: Deploy
    subgraph cluster_step6 {{
        label="Step 6: Deploy"
        fontcolor="white"
        fontname="Segoe UI Semibold"
        fontsize="12"
        bgcolor="{COLORS['card_bg']}"
        style="rounded"
        pencolor="#0f3460"
        penwidth="2"
        
        deploy [
            label="🚀 Deploy\\nDeploy Agent"
            fillcolor="{COLORS['coral']}"
        ]
    }}

    // Step 7: As-Built Artifacts
    subgraph cluster_step7 {{
        label="Step 7: As-Built Artifacts (Optional)"
        fontcolor="#94a3b8"
        fontname="Segoe UI Semibold"
        fontsize="12"
        bgcolor="{COLORS['card_bg']}"
        style="rounded,dashed"
        pencolor="#0f3460"
        penwidth="2"
        
        diagrams_asbuilt [
            label="📊 diagram\\n(-ab)"
            fillcolor="{COLORS['purple']}"
        ]
        
        adr_asbuilt [
            label="📝 adr\\n(-ab)"
            fillcolor="{COLORS['teal']}"
        ]
    }}
    
    // Main workflow edges
    plan -> architect [xlabel="requirements" color="{COLORS['blue']}" fontcolor="{COLORS['blue']}"]
    architect -> diagrams_design [style="dashed" xlabel="optional" color="{COLORS['orange']}" fontcolor="#94a3b8"]
    architect -> bicep_plan [xlabel="architecture" color="{COLORS['orange']}" fontcolor="{COLORS['orange']}"]
    diagrams_design -> bicep_plan [style="dashed" color="{COLORS['purple']}"]
    adr_design -> bicep_plan [style="dashed" color="{COLORS['teal']}"]
    policy -> bicep_plan [style="dashed" xlabel="constraints" color="{COLORS['cyan']}" fontcolor="{COLORS['cyan']}"]
    bicep_plan -> bicep_implement [xlabel="plan" color="{COLORS['green']}" fontcolor="{COLORS['green']}"]
    bicep_implement -> deploy [xlabel="code" color="{COLORS['pink']}" fontcolor="{COLORS['pink']}"]
    deploy -> diagrams_asbuilt [style="dashed" xlabel="optional" color="{COLORS['coral']}" fontcolor="#94a3b8"]
    
    // Layout hints
    {{rank=same; plan}}
    {{rank=same; architect}}
    {{rank=same; diagrams_design; adr_design}}
    {{rank=same; bicep_plan; policy}}
    {{rank=same; bicep_implement}}
    {{rank=same; diagrams_asbuilt; adr_asbuilt}}
}}
'''

    return dot_content


def create_simple_workflow():
    """Create a simpler horizontal 7-step workflow for README."""

    dot_content = f'''
digraph SimpleWorkflow {{
    graph [
        bgcolor="{COLORS['dark_bg']}"
        fontcolor="white"
        fontname="Segoe UI"
        pad="0.4"
        splines="curved"
        nodesep="0.4"
        ranksep="0.5"
        rankdir="LR"
        dpi="150"
    ]
    
    node [
        fontname="Segoe UI"
        fontsize="11"
        fontcolor="white"
        style="filled,rounded"
        shape="box"
        penwidth="0"
        margin="0.2,0.15"
    ]
    
    edge [
        color="#64748b"
        fontcolor="#94a3b8"
        fontname="Segoe UI"
        fontsize="9"
        penwidth="2"
        arrowsize="0.7"
    ]
    
    // Main 7-step workflow nodes
    plan [label="@plan" fillcolor="{COLORS['blue']}"]
    architect [label="azure-principal-\\narchitect" fillcolor="{COLORS['orange']}"]
    design_artifacts [label="Design\\nArtifacts" fillcolor="{COLORS['purple']}" style="filled,rounded,dashed"]
    bicep_plan [label="bicep-plan" fillcolor="{COLORS['green']}"]
    bicep_implement [label="bicep-code" fillcolor="{COLORS['pink']}"]
    deploy [label="Deploy" fillcolor="{COLORS['coral']}"]
    asbuilt_artifacts [label="As-Built\\nArtifacts" fillcolor="{COLORS['cyan']}" style="filled,rounded,dashed"]
    
    // Governance indicator
    governance [label="🔒 Governance" fillcolor="{COLORS['cyan']}"]
    
    // Main flow
    plan -> architect
    architect -> design_artifacts [style="dashed"]
    architect -> bicep_plan
    design_artifacts -> bicep_plan [style="dashed"]
    bicep_plan -> bicep_implement
    bicep_implement -> deploy
    deploy -> asbuilt_artifacts [style="dashed"]
    
    // Governance connection
    governance -> bicep_plan [style="dashed" constraint="false"]
    
    // Layout hints
    {{rank=same; governance}}
}}
'''

    return dot_content


if __name__ == "__main__":
    output_dir = os.path.dirname(__file__)

    # Generate full workflow diagram
    print("🎨 Generating themed 7-step workflow diagram...")
    full_dot = create_workflow_diagram()
    full_dot_path = os.path.join(output_dir, "workflow_themed.dot")
    full_png_path = os.path.join(output_dir, "workflow_themed.png")
    full_svg_path = os.path.join(output_dir, "workflow_themed.svg")

    with open(full_dot_path, "w") as f:
        f.write(full_dot)

    # Generate PNG and SVG
    subprocess.run(["dot", "-Tpng", "-Gdpi=150", full_dot_path,
                   "-o", full_png_path], check=True)
    subprocess.run(["dot", "-Tsvg", full_dot_path,
                   "-o", full_svg_path], check=True)
    print(f"✅ Generated: {full_png_path}")
    print(f"✅ Generated: {full_svg_path}")

    # Generate simple workflow diagram
    print("\n🎨 Generating simple 7-step workflow diagram...")
    simple_dot = create_simple_workflow()
    simple_dot_path = os.path.join(output_dir, "workflow_simple.dot")
    simple_png_path = os.path.join(output_dir, "workflow_simple.png")
    simple_svg_path = os.path.join(output_dir, "workflow_simple.svg")

    with open(simple_dot_path, "w") as f:
        f.write(simple_dot)

    subprocess.run(["dot", "-Tpng", "-Gdpi=150", simple_dot_path,
                   "-o", simple_png_path], check=True)
    subprocess.run(["dot", "-Tsvg", simple_dot_path,
                   "-o", simple_svg_path], check=True)
    print(f"✅ Generated: {simple_png_path}")
    print(f"✅ Generated: {simple_svg_path}")

    print("\n🎉 All 7-step workflow diagrams generated successfully!")
    print(f"\nFiles created in: {output_dir}")
