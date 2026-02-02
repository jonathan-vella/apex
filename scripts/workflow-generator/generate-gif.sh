#!/bin/bash
# Generate animated workflow GIF

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
FRAMES_DIR="$OUTPUT_DIR/frames"

mkdir -p "$FRAMES_DIR"

echo "=== Generating workflow animation frames ==="

# Step 1: Requirements only
cat > "$FRAMES_DIR/step1.mmd" << 'EOF'
%%{init: {'theme':'neutral'}}%%
graph LR
    subgraph "Step 1: Requirements"
        P["Requirements"]
    end
    style P fill:#e1f5fe
EOF

# Step 2: Requirements -> Architect
cat > "$FRAMES_DIR/step2.mmd" << 'EOF'
%%{init: {'theme':'neutral'}}%%
graph LR
    subgraph "Step 1: Requirements"
        P["Requirements"]
    end
    subgraph "Step 2: Architecture"
        A["Architect"]
    end
    P -->|requirements| A
    style P fill:#e1f5fe
    style A fill:#fff3e0
EOF

# Step 3: Architecture with MCP and diagram
cat > "$FRAMES_DIR/step3.mmd" << 'EOF'
%%{init: {'theme':'neutral'}}%%
graph LR
    subgraph "Step 1: Requirements"
        P["Requirements"]
    end
    subgraph "Step 2: Architecture"
        A["Architect"]
        MCP["💰 Azure Pricing<br/>MCP"]
        D["📊 Diagram"]
    end
    P -->|requirements| A
    MCP -.->|"real-time<br/>pricing"| A
    D -.->|"architecture<br/>visualization"| A
    style P fill:#e1f5fe
    style A fill:#fff3e0
    style MCP fill:#fff9c4
    style D fill:#f3e5f5
EOF

# Step 4: Add Bicep Plan
cat > "$FRAMES_DIR/step4.mmd" << 'EOF'
%%{init: {'theme':'neutral'}}%%
graph LR
    subgraph "Step 1: Requirements"
        P["Requirements"]
    end
    subgraph "Step 2: Architecture"
        A["Architect"]
        MCP["💰 Azure Pricing<br/>MCP"]
        D["📊 Diagram"]
    end
    subgraph "Step 3: Planning"
        B["Bicep Plan"]
    end
    P -->|requirements| A
    A --> B
    MCP -.->|"real-time<br/>pricing"| A
    D -.->|"architecture<br/>visualization"| A
    style P fill:#e1f5fe
    style A fill:#fff3e0
    style MCP fill:#fff9c4
    style D fill:#f3e5f5
    style B fill:#e8f5e9
EOF

# Step 5: Complete workflow
cat > "$FRAMES_DIR/step5.mmd" << 'EOF'
%%{init: {'theme':'neutral'}}%%
graph LR
    subgraph "Step 1: Requirements"
        P["Requirements"]
    end
    subgraph "Step 2: Architecture"
        A["Architect"]
        MCP["💰 Azure Pricing<br/>MCP"]
        D["📊 Diagram"]
    end
    subgraph "Step 3: Planning"
        B["Bicep Plan"]
    end
    subgraph "Step 4: Implementation"
        I["Bicep Code"]
    end
    P -->|requirements| A
    A --> B
    B -->|plan| I
    MCP -.->|"real-time<br/>pricing"| A
    D -.->|"architecture<br/>visualization"| A
    style P fill:#e1f5fe
    style A fill:#fff3e0
    style MCP fill:#fff9c4
    style D fill:#f3e5f5
    style B fill:#e8f5e9
    style I fill:#fce4ec
EOF

# Generate PNG for each step
for i in 1 2 3 4 5; do
    echo "Generating step $i..."
    npx mmdc -i "$FRAMES_DIR/step$i.mmd" -o "$FRAMES_DIR/step$i.png" \
        -w 1200 -H 600 -b white -t neutral \
        -p "$SCRIPT_DIR/puppeteer-config.json" 2>/dev/null
done

echo "=== Creating animation frames ==="

# Create numbered frames with timing
# Each step shows for 1.5 seconds (3 frames at 2fps), last step longer
frame=0
for step in 1 2 3 4 5; do
    if [ $step -eq 5 ]; then
        copies=6  # Hold final frame longer
    else
        copies=3
    fi
    for ((j=0; j<copies; j++)); do
        cp "$FRAMES_DIR/step$step.png" "$FRAMES_DIR/frame-$(printf '%03d' $frame).png"
        ((frame++))
    done
done

echo "Generated $frame frames"

echo "=== Generating GIF ==="

# Generate palette
ffmpeg -y -framerate 2 -i "$FRAMES_DIR/frame-%03d.png" \
    -vf "fps=2,scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff" \
    "$FRAMES_DIR/palette.png" 2>/dev/null

# Generate GIF with palette
ffmpeg -y -framerate 2 -i "$FRAMES_DIR/frame-%03d.png" -i "$FRAMES_DIR/palette.png" \
    -lavfi "fps=2,scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    "$OUTPUT_DIR/workflow.gif" 2>/dev/null

echo "=== Generating MP4 ==="
ffmpeg -y -framerate 2 -i "$FRAMES_DIR/frame-%03d.png" \
    -c:v libx264 -pix_fmt yuv420p -vf "scale=1200:600" \
    "$OUTPUT_DIR/workflow.mp4" 2>/dev/null

# Cleanup
rm -f "$FRAMES_DIR"/*.mmd "$FRAMES_DIR"/palette.png

echo "=== Done! ==="
ls -la "$OUTPUT_DIR"/*.gif "$OUTPUT_DIR"/*.mp4
