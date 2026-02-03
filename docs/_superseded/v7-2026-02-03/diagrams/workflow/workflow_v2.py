"""
Agentic InfraOps Workflow Diagram Generator v2
Generates horizontal 7-step workflow diagrams with dark theme

Updated: 2025-01 for 7-Step Agentic Workflow
"""

import os
import subprocess

# Color palette matching PowerPoint theme
COLORS = {
    "orange": "#FF6B35",      # Primary accent (title color)
    "coral": "#f4722b",       # Secondary accent
    "blue": "#0078D4",        # Azure blue
    "green": "#10b981",       # Success green
    "yellow": "#fbbf24",      # Warning/optional yellow
    "purple": "#8b5cf6",      # Purple accent
    "pink": "#ec4899",        # Pink accent
    "teal": "#14b8a6",        # Teal/cyan
    "gray": "#64748b",        # Muted gray
    "dark_bg": "#1a1a2e",     # Dark background
    "light_gray": "#94a3b8",  # Light gray for labels
    "cyan": "#06b6d4",        # Cyan for governance
}


def create_workflow_diagram():
    """Generate the numbered 7-step workflow diagram - widescreen horizontal."""

    dot_content = f'''
digraph AgenticInfraOps {{
    // Graph settings - WIDESCREEN HORIZONTAL
    graph [
        bgcolor="{COLORS['dark_bg']}"
        fontcolor="white"
        fontname="Segoe UI, Arial, sans-serif"
        pad="0.8"
        splines="ortho"
        nodesep="0.5"
        ranksep="0.9"
        rankdir="LR"
        dpi="150"
        newrank="true"
    ]
    
    node [
        fontname="Segoe UI, Arial, sans-serif"
        fontsize="11"
        fontcolor="white"
        style="filled,rounded"
        shape="box"
        penwidth="0"
        margin="0.2,0.12"
    ]
    
    edge [
        color="{COLORS['gray']}"
        fontcolor="{COLORS['light_gray']}"
        fontname="Segoe UI, Arial, sans-serif"
        fontsize="9"
        penwidth="2"
        arrowsize="0.7"
    ]

    // ============================================
    // STEP 1: PLAN
    // ============================================
    step1 [
        label="1. Plan\\n@plan"
        fillcolor="{COLORS['blue']}"
        width="1.5"
    ]

    // ============================================
    // STEP 2: ARCHITECTURE
    // ============================================
    step2 [
        label="2. Architect\\narchitect"
        fillcolor="{COLORS['orange']}"
        width="2.4"
    ]

    // ============================================
    // STEP 3: DESIGN ARTIFACTS (Optional)
    // ============================================
    step3 [
        label="3. Design Artifacts\\n(optional)"
        fillcolor="{COLORS['purple']}"
        width="2.0"
        style="filled,rounded,dashed"
    ]
    
    step3a [
        label="📊 -des diagram\\ndiagram"
        fillcolor="{COLORS['purple']}"
        fontsize="9"
    ]
    
    step3b [
        label="📝 -des ADR\\nadr"
        fillcolor="{COLORS['teal']}"
        fontsize="9"
    ]

    // ============================================
    // STEP 4: PLAN INFRASTRUCTURE
    // ============================================
    step4 [
        label="4. Plan Infrastructure\\nbicep-plan"
        fillcolor="{COLORS['green']}"
        width="2.0"
    ]
    
    step4opt [
        label="🔒 Governance\\nAzure Policy"
        fillcolor="{COLORS['cyan']}"
        fontsize="9"
    ]

    // ============================================
    // STEP 5: CODE GENERATION
    // ============================================
    step5 [
        label="5. Generate Code\\nbicep-code"
        fillcolor="{COLORS['pink']}"
        width="2.0"
    ]

    // ============================================
    // STEP 6: DEPLOY
    // ============================================
    step6 [
        label="6. Deploy\\nDeploy Agent"
        fillcolor="{COLORS['coral']}"
        width="2.0"
    ]

    // ============================================
    // STEP 7: AS-BUILT ARTIFACTS (Optional)
    // ============================================
    step7 [
        label="7. As-Built Artifacts\\n(optional)"
        fillcolor="{COLORS['coral']}"
        width="2.0"
        style="filled,rounded,dashed"
    ]
    
    step7a [
        label="📊 -ab diagram\\ndiagram"
        fillcolor="{COLORS['purple']}"
        fontsize="9"
    ]
    
    step7b [
        label="📝 -ab ADR\\nadr"
        fillcolor="{COLORS['teal']}"
        fontsize="9"
    ]

    // ============================================
    // MAIN FLOW (solid arrows)
    // ============================================
    step1 -> step2 [color="{COLORS['blue']}" penwidth="2.5"]
    step2 -> step3 [color="{COLORS['orange']}" style="dashed" penwidth="2"]
    step2 -> step4 [color="{COLORS['orange']}" penwidth="2.5"]
    step3 -> step4 [color="{COLORS['purple']}" style="dashed" penwidth="2"]
    step4 -> step5 [color="{COLORS['green']}" penwidth="2.5"]
    step5 -> step6 [color="{COLORS['pink']}" style="dashed" penwidth="2"]

    // ============================================
    // OPTIONAL CONNECTIONS (dashed arrows)
    // ============================================
    // Step 3 optional tools
    step3a -> step3 [style="dashed" color="{COLORS['purple']}" dir="back"]
    step3b -> step3 [style="dashed" color="{COLORS['teal']}" dir="back"]
    
    // Step 4 governance
    step4opt -> step4 [style="dashed" color="{COLORS['cyan']}" dir="back"]
    
    // Step 6 optional tools
    step6a -> step6 [style="dashed" color="{COLORS['purple']}" dir="back"]
    step6b -> step6 [style="dashed" color="{COLORS['teal']}" dir="back"]

    // ============================================
    // LAYOUT HINTS
    // ============================================
    {{ rank=same; step3a; step3b }}
    {{ rank=same; step4opt }}
    {{ rank=same; step6a; step6b }}
    
    // Invisible edges for vertical alignment
    step3a -> step3b [style="invis"]
    step6a -> step6b [style="invis"]
}}
'''
    return dot_content


def create_simple_workflow():
    """Create a compact horizontal 7-step workflow for README."""

    dot_content = f'''
digraph SimpleWorkflow {{
    graph [
        bgcolor="{COLORS['dark_bg']}"
        fontcolor="white"
        fontname="Segoe UI, Arial, sans-serif"
        pad="0.4"
        splines="ortho"
        nodesep="0.35"
        ranksep="0.4"
        rankdir="LR"
        dpi="150"
    ]
    
    node [
        fontname="Segoe UI, Arial, sans-serif"
        fontsize="10"
        fontcolor="white"
        style="filled,rounded"
        shape="box"
        penwidth="0"
        margin="0.12,0.08"
    ]
    
    edge [
        color="{COLORS['gray']}"
        penwidth="2"
        arrowsize="0.6"
    ]
    
    // Main 7-step workflow
    s1 [label="1. Plan" fillcolor="{COLORS['blue']}"]
    s2 [label="2. Architect" fillcolor="{COLORS['orange']}"]
    s3 [label="3. Design\\nArtifacts" fillcolor="{COLORS['purple']}" style="filled,rounded,dashed"]
    s4 [label="4. Plan Infra" fillcolor="{COLORS['green']}"]
    s5 [label="5. Generate" fillcolor="{COLORS['pink']}"]
    s6 [label="6. Deploy" fillcolor="{COLORS['coral']}"]
    s7 [label="7. As-Built\\nArtifacts" fillcolor="{COLORS['coral']}" style="filled,rounded,dashed"]
    
    // Flow
    s1 -> s2 -> s3 [style="dashed"]
    s2 -> s4
    s3 -> s4 [style="dashed"]
    s4 -> s5 -> s6 -> s7 [style="dashed"]
}}
'''
    return dot_content


def create_detailed_workflow():
    """Create a detailed widescreen horizontal 7-step workflow."""

    dot_content = f'''
digraph DetailedWorkflow {{
    graph [
        bgcolor="{COLORS['dark_bg']}"
        fontcolor="white"
        fontname="Segoe UI, Arial, sans-serif"
        pad="1.0"
        splines="ortho"
        nodesep="0.45"
        ranksep="1.0"
        rankdir="LR"
        dpi="150"
        newrank="true"
    ]
    
    node [
        fontname="Segoe UI, Arial, sans-serif"
        fontsize="11"
        fontcolor="white"
        style="filled,rounded"
        shape="box"
        penwidth="0"
        margin="0.25,0.15"
    ]
    
    edge [
        color="{COLORS['gray']}"
        fontcolor="{COLORS['light_gray']}"
        fontname="Segoe UI, Arial, sans-serif"
        fontsize="9"
        penwidth="2.5"
        arrowsize="0.8"
    ]

    // Step 1
    step1 [
        label="① Plan\\n@plan"
        fillcolor="{COLORS['blue']}"
        width="1.6"
        height="0.6"
    ]

    // Step 2
    step2 [
        label="② Architect\\narchitect"
        fillcolor="{COLORS['orange']}"
        width="2.4"
        height="0.6"
    ]

    // Step 3 - Design Artifacts
    step3 [
        label="③ Design Artifacts\\n(optional)"
        fillcolor="{COLORS['purple']}"
        width="2.0"
        height="0.6"
        style="filled,rounded,dashed"
    ]
    
    opt3a [label="📊 -des diagram\\ndiagram" fillcolor="{COLORS['purple']}" fontsize="10"]
    opt3b [label="📝 -des ADR\\nadr" fillcolor="{COLORS['teal']}" fontsize="10"]

    // Step 4
    step4 [
        label="④ Plan Infrastructure\\nbicep-plan"
        fillcolor="{COLORS['green']}"
        width="2.0"
        height="0.6"
    ]
    
    opt4gov [label="🔒 Governance Discovery\\nAzure Policy" fillcolor="{COLORS['cyan']}" fontsize="10"]

    // Step 5
    step5 [
        label="⑤ Generate Code\\nbicep-code"
        fillcolor="{COLORS['pink']}"
        width="2.0"
        height="0.6"
    ]

    // Step 6 - Deploy
    step6 [
        label="⑥ Deploy\\nDeploy Agent"
        fillcolor="{COLORS['coral']}"
        width="2.0"
        height="0.6"
    ]

    // Step 7 - As-Built Artifacts
    step7 [
        label="⑦ As-Built Artifacts\\n(optional)"
        fillcolor="{COLORS['coral']}"
        width="2.0"
        height="0.6"
        style="filled,rounded,dashed"
    ]
    
    opt7a [label="📊 -ab diagram\\ndiagram" fillcolor="{COLORS['purple']}" fontsize="10"]
    opt7b [label="📝 -ab ADR\\nadr" fillcolor="{COLORS['teal']}" fontsize="10"]

    // Main flow - thick colored arrows
    step1 -> step2 [color="{COLORS['blue']}" penwidth="3"]
    step2 -> step3 [color="{COLORS['orange']}" penwidth="2" style="dashed"]
    step2 -> step4 [color="{COLORS['orange']}" penwidth="3"]
    step3 -> step4 [color="{COLORS['purple']}" penwidth="2" style="dashed"]
    step4 -> step5 [color="{COLORS['green']}" penwidth="3"]
    step5 -> step6 [color="{COLORS['pink']}" penwidth="3"]
    step6 -> step7 [color="{COLORS['coral']}" penwidth="2" style="dashed"]

    // Optional tools connections - above main flow
    opt3a -> step3 [style="dashed" color="{COLORS['purple']}" arrowhead="none" arrowtail="normal" dir="back"]
    opt3b -> step3 [style="dashed" color="{COLORS['teal']}" arrowhead="none" arrowtail="normal" dir="back"]
    opt4gov -> step4 [style="dashed" color="{COLORS['cyan']}" arrowhead="none" arrowtail="normal" dir="back"]
    opt7a -> step7 [style="dashed" color="{COLORS['purple']}" arrowhead="none" arrowtail="normal" dir="back"]
    opt7b -> step7 [style="dashed" color="{COLORS['teal']}" arrowhead="none" arrowtail="normal" dir="back"]

    // Layout - optionals stacked vertically
    {{ rank=same; opt3a; opt3b }}
    {{ rank=same; opt4gov }}
    {{ rank=same; opt6a; opt6b }}
    opt3a -> opt3b [style="invis" weight="10"]
    opt6a -> opt6b [style="invis" weight="10"]
}}
'''
    return dot_content


if __name__ == "__main__":
    output_dir = os.path.dirname(__file__)

    # Generate numbered workflow
    print("🎨 Generating numbered 7-step workflow diagram...")
    dot = create_workflow_diagram()
    dot_path = os.path.join(output_dir, "workflow_numbered.dot")
    png_path = os.path.join(output_dir, "workflow_numbered.png")
    svg_path = os.path.join(output_dir, "workflow_numbered.svg")

    with open(dot_path, "w") as f:
        f.write(dot)

    subprocess.run(["dot", "-Tpng", "-Gdpi=150",
                   dot_path, "-o", png_path], check=True)
    subprocess.run(["dot", "-Tsvg", dot_path, "-o", svg_path], check=True)
    print(f"✅ {png_path}")
    print(f"✅ {svg_path}")

    # Generate simple horizontal
    print("\n🎨 Generating simple 7-step workflow...")
    dot = create_simple_workflow()
    dot_path = os.path.join(output_dir, "workflow_simple_v2.dot")
    png_path = os.path.join(output_dir, "workflow_simple_v2.png")
    svg_path = os.path.join(output_dir, "workflow_simple_v2.svg")

    with open(dot_path, "w") as f:
        f.write(dot)

    subprocess.run(["dot", "-Tpng", "-Gdpi=150",
                   dot_path, "-o", png_path], check=True)
    subprocess.run(["dot", "-Tsvg", dot_path, "-o", svg_path], check=True)
    print(f"✅ {png_path}")
    print(f"✅ {svg_path}")

    # Generate detailed workflow
    print("\n🎨 Generating detailed 7-step workflow...")
    dot = create_detailed_workflow()
    dot_path = os.path.join(output_dir, "workflow_detailed.dot")
    png_path = os.path.join(output_dir, "workflow_detailed.png")
    svg_path = os.path.join(output_dir, "workflow_detailed.svg")

    with open(dot_path, "w") as f:
        f.write(dot)

    subprocess.run(["dot", "-Tpng", "-Gdpi=150",
                   dot_path, "-o", png_path], check=True)
    subprocess.run(["dot", "-Tsvg", dot_path, "-o", svg_path], check=True)
    print(f"✅ {png_path}")
    print(f"✅ {svg_path}")

    print("\n🎉 All 7-step workflow diagrams generated!")
    print(f"\nFiles in: {output_dir}")
