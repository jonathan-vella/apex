# Business Process Flow Diagrams

Generate professional business process flow diagrams showing user actions, system steps, and outcomes.

## Approach: Graphviz with Custom Styling (Recommended)

For business process flows, we use Graphviz directly for more control over shapes and styling.

### Basic Setup

```python
from graphviz import Digraph

def create_process_flow(title: str, filename: str):
    dot = Digraph(title, filename=filename, format='png')
    dot.attr(rankdir='TB', bgcolor='white', pad='0.5', nodesep='0.5', ranksep='0.7')
    dot.attr('node', fontname='Segoe UI, Arial', fontsize='11')
    dot.attr('edge', fontname='Segoe UI, Arial', fontsize='9')
    return dot

# Node style presets
STYLES = {
    'start_end': {'shape': 'ellipse', 'style': 'filled', 'fillcolor': '#E8F5E9', 'color': '#4CAF50'},
    'process': {'shape': 'box', 'style': 'filled,rounded', 'fillcolor': '#E3F2FD', 'color': '#2196F3'},
    'decision': {'shape': 'diamond', 'style': 'filled', 'fillcolor': '#FFF8E1', 'color': '#FFC107'},
    'user_action': {'shape': 'box', 'style': 'filled', 'fillcolor': '#F3E5F5', 'color': '#9C27B0'},
    'system': {'shape': 'box', 'style': 'filled', 'fillcolor': '#E0F7FA', 'color': '#00BCD4'},
    'document': {'shape': 'note', 'style': 'filled', 'fillcolor': '#FFFDE7', 'color': '#FFEB3B'},
    'data': {'shape': 'cylinder', 'style': 'filled', 'fillcolor': '#FBE9E7', 'color': '#FF5722'},
}
```

### Example: Scanning & Indexing Process

```python
dot = create_process_flow('Scanning and Indexing Process', 'scanning-process')

# Add nodes
dot.node('start', 'Start', **STYLES['start_end'])
dot.node('scan', 'User Scans\nDocument', **STYLES['user_action'])
dot.node('upload', 'System Uploads\nto Storage', **STYLES['system'])
dot.node('ocr', 'OCR Processing', **STYLES['system'])
dot.node('valid', 'Valid\nDocument?', **STYLES['decision'])
dot.node('index', 'Index in\nDatabase', **STYLES['system'])
dot.node('reject', 'Flag for\nReview', **STYLES['process'])
dot.node('notify', 'Notify User', **STYLES['system'])
dot.node('end', 'End', **STYLES['start_end'])

# Add edges
dot.edge('start', 'scan')
dot.edge('scan', 'upload')
dot.edge('upload', 'ocr')
dot.edge('ocr', 'valid')
dot.edge('valid', 'index', label='Yes')
dot.edge('valid', 'reject', label='No')
dot.edge('index', 'notify')
dot.edge('reject', 'notify')
dot.edge('notify', 'end')

dot.render(cleanup=True)
```

### Swimlane Process Flow (Multiple Actors)

```python
from graphviz import Digraph

dot = Digraph('Email Processing Flow', format='png')
dot.attr(rankdir='TB', compound='true', bgcolor='white')
dot.attr('node', fontname='Segoe UI', fontsize='10')

# Create swimlanes using subgraphs
with dot.subgraph(name='cluster_user') as user:
    user.attr(label='User', style='filled', fillcolor='#F3E5F5', color='#9C27B0')
    user.node('u1', 'Receive Email', shape='box', style='rounded,filled', fillcolor='white')
    user.node('u2', 'Review Content', shape='box', style='rounded,filled', fillcolor='white')
    user.node('u3', 'Approve/Reject', shape='diamond', style='filled', fillcolor='white')

with dot.subgraph(name='cluster_system') as system:
    system.attr(label='PlymDocs System', style='filled', fillcolor='#E3F2FD', color='#2196F3')
    system.node('s1', 'Parse Email', shape='box', style='rounded,filled', fillcolor='white')
    system.node('s2', 'Extract Attachments', shape='box', style='rounded,filled', fillcolor='white')
    system.node('s3', 'Store Document', shape='cylinder', style='filled', fillcolor='white')

# Connect across swimlanes
dot.edge('u1', 's1')
dot.edge('s1', 's2')
dot.edge('s2', 'u2')
dot.edge('u2', 'u3')
dot.edge('u3', 's3', label='Approve')

dot.render('email-processing-swimlane', cleanup=True)
```

### Current vs Future State Comparison

```python
from graphviz import Digraph

dot = Digraph('Process Comparison', format='png')
dot.attr(rankdir='TB', bgcolor='white')

# Current State
with dot.subgraph(name='cluster_current') as current:
    current.attr(label='Current State (W2)', style='filled', fillcolor='#FFEBEE', color='#F44336')
    current.node('c1', 'Manual Scan', shape='box', style='rounded,filled', fillcolor='white')
    current.node('c2', 'Save to File Share', shape='box', style='rounded,filled', fillcolor='white')
    current.node('c3', 'Manual Indexing', shape='box', style='rounded,filled', fillcolor='white')
    current.edge('c1', 'c2')
    current.edge('c2', 'c3')

# Future State
with dot.subgraph(name='cluster_future') as future:
    future.attr(label='Future State (PlymDocs)', style='filled', fillcolor='#E8F5E9', color='#4CAF50')
    future.node('f1', 'Scan with Auto-Upload', shape='box', style='rounded,filled', fillcolor='white')
    future.node('f2', 'AI-Powered OCR', shape='box', style='rounded,filled', fillcolor='white')
    future.node('f3', 'Auto Classification', shape='box', style='rounded,filled', fillcolor='white')
    future.edge('f1', 'f2')
    future.edge('f2', 'f3')

dot.render('process-comparison', cleanup=True)
```

### Style Guide

| Element | Shape | Color | Use For |
|---------|-------|-------|---------|
| Start/End | ellipse | Green (#4CAF50) | Process boundaries |
| Process | rounded box | Blue (#2196F3) | System/automated steps |
| Decision | diamond | Amber (#FFC107) | Yes/No branching |
| User Action | box | Purple (#9C27B0) | Manual user steps |
| System | box | Cyan (#00BCD4) | Backend processing |
| Document | note | Yellow (#FFEB3B) | Document/form |
| Data/Storage | cylinder | Orange (#FF5722) | Database/storage |

---

## Alternative Approach 1: Using Python Diagrams Library

The diagrams library can create process flows using generic and programming nodes.

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.generic.blank import Blank
from diagrams.generic.compute import Rack
from diagrams.generic.storage import Storage
from diagrams.generic.database import SQL
from diagrams.onprem.client import Users, Client
from diagrams.onprem.compute import Server
from diagrams.programming.flowchart import (
    Action, Collate, Database, Decision, Delay, Display,
    Document, InputOutput, ManualInput, ManualLoop, Merge,
    MultipleDocuments, OffPageConnectorLeft, OffPageConnectorRight,
    Or, PredefinedProcess, Preparation, Sort, StartEnd,
    StoredData, SummingJunction
)

# Example: Document Processing Workflow
with Diagram("Document Processing Flow", show=False, filename="process-flow", direction="TB"):
    
    start = StartEnd("Start")
    
    with Cluster("User Actions"):
        user = Users("User")
        scan = ManualInput("Scan Document")
    
    with Cluster("System Processing"):
        validate = Decision("Valid\nFormat?")
        ocr = Action("OCR\nExtraction")
        classify = Action("Auto\nClassification")
        store = Database("Store in\nDocument DB")
    
    with Cluster("Outcomes"):
        success = Display("Document\nIndexed")
        error = Display("Error\nNotification")
    
    end = StartEnd("End")
    
    start >> user >> scan >> validate
    validate >> Edge(label="Yes") >> ocr >> classify >> store >> success >> end
    validate >> Edge(label="No") >> error >> end
```

## Approach 2: Mermaid Flowcharts (Alternative)

For simpler flows, generate Mermaid syntax that can be rendered.

```python
def generate_mermaid_flowchart(title, steps):
    """Generate Mermaid flowchart syntax."""
    mermaid = f"---\ntitle: {title}\n---\nflowchart TD\n"
    for step in steps:
        mermaid += f"    {step}\n"
    return mermaid

# Example usage
steps = [
    "A[Start] --> B{Document Received?}",
    "B -->|Yes| C[Validate Format]",
    "B -->|No| D[Wait for Input]",
    "C --> E{Valid?}",
    "E -->|Yes| F[Process Document]",
    "E -->|No| G[Return Error]",
    "F --> H[Store in Database]",
    "H --> I[Send Confirmation]",
    "I --> J[End]",
    "G --> J",
    "D --> B",
]

mermaid_code = generate_mermaid_flowchart("Document Processing", steps)
```

## Approach 3: Graphviz Direct (Maximum Control)

```python
import graphviz

def create_process_flow(title, filename):
    dot = graphviz.Digraph(title, filename=filename, format='png')
    dot.attr(rankdir='TB', splines='spline')
    dot.attr('node', shape='box', style='rounded,filled', fillcolor='lightblue')
    
    # Start/End nodes
    dot.node('start', 'Start', shape='ellipse', fillcolor='lightgreen')
    dot.node('end', 'End', shape='ellipse', fillcolor='lightcoral')
    
    # Decision nodes
    dot.node('decision1', 'Valid?', shape='diamond', fillcolor='lightyellow')
    
    # Process nodes
    dot.node('step1', 'Receive\nDocument')
    dot.node('step2', 'Validate\nFormat')
    dot.node('step3', 'Process')
    dot.node('step4', 'Store')
    dot.node('error', 'Handle\nError', fillcolor='lightcoral')
    
    # Edges
    dot.edge('start', 'step1')
    dot.edge('step1', 'step2')
    dot.edge('step2', 'decision1')
    dot.edge('decision1', 'step3', label='Yes')
    dot.edge('decision1', 'error', label='No')
    dot.edge('step3', 'step4')
    dot.edge('step4', 'end')
    dot.edge('error', 'end')
    
    dot.render(cleanup=True)
    return f"{filename}.png"

# Usage
create_process_flow("Document Flow", "document-flow")
```

## Common Process Flow Patterns

### Pattern 1: Linear Process
```python
start >> step1 >> step2 >> step3 >> end
```

### Pattern 2: Decision Branch
```python
step >> decision
decision >> Edge(label="Yes") >> path_a >> end
decision >> Edge(label="No") >> path_b >> end
```

### Pattern 3: Parallel Processing
```python
step >> [parallel_a, parallel_b, parallel_c] >> merge >> next_step
```

### Pattern 4: Loop/Retry
```python
process >> decision
decision >> Edge(label="Success") >> next
decision >> Edge(label="Retry") >> process
```

### Pattern 5: Swimlanes (Actors)
```python
with Cluster("Customer"):
    customer_actions = [Action("Submit"), Action("Review")]

with Cluster("System"):
    system_actions = [Action("Validate"), Action("Process")]

with Cluster("Admin"):
    admin_actions = [Action("Approve"), Action("Archive")]
```

## Styling Guide

### Node Shapes by Type
- **Start/End**: Ellipse (rounded)
- **Process/Action**: Rectangle with rounded corners
- **Decision**: Diamond
- **Data/Document**: Parallelogram or document shape
- **Manual Input**: Trapezoid
- **Delay/Wait**: Half-circle

### Color Coding
```python
# Suggested colors
USER_ACTION = "#E3F2FD"      # Light blue
SYSTEM_PROCESS = "#E8F5E9"   # Light green
DECISION = "#FFF3E0"         # Light orange
ERROR = "#FFEBEE"            # Light red
SUCCESS = "#E8F5E9"          # Light green
DATA = "#F3E5F5"             # Light purple
```

## Converting ASCII Process Flows

When converting ASCII diagrams like:

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │───►│ Submit  │───►│ Validate│
└─────────┘    └─────────┘    └────┬────┘
                                   │
                              ┌────▼────┐
                              │ Valid?  │
                              └────┬────┘
                         Yes │    │ No
                        ┌────▼──┐ │
                        │Process│ │
                        └───────┘ ▼
                              ┌───────┐
                              │ Error │
                              └───────┘
```

Map to:
1. Identify actors/swimlanes (User, System)
2. Identify decision points (diamonds in ASCII)
3. Identify process steps (boxes)
4. Trace flow direction (arrows)
5. Note any parallel or branching paths
