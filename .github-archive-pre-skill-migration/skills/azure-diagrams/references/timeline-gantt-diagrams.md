# Timeline and Gantt Diagrams

Generate professional timeline, roadmap, and Gantt chart diagrams for project planning.

## Approach 1: Matplotlib (Recommended for Gantt Charts)

```python
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from datetime import datetime, timedelta
import numpy as np

def create_gantt_chart(tasks, filename="gantt-chart"):
    """
    Create a Gantt chart.
    
    tasks: list of dicts with keys:
        - name: task name
        - start: start date (datetime or string)
        - duration: duration in days
        - category: category for color coding (optional)
        - progress: 0-100 percentage complete (optional)
    """
    # Color palette for categories
    colors = {
        'Development': '#4472C4',
        'Testing': '#ED7D31',
        'Deployment': '#70AD47',
        'Migration': '#FFC000',
        'Training': '#9E480E',
        'default': '#5B9BD5'
    }
    
    fig, ax = plt.subplots(figsize=(14, len(tasks) * 0.5 + 2))
    
    # Parse dates if strings
    for task in tasks:
        if isinstance(task['start'], str):
            task['start'] = datetime.strptime(task['start'], '%Y-%m-%d')
    
    # Find date range
    min_date = min(t['start'] for t in tasks)
    max_date = max(t['start'] + timedelta(days=t['duration']) for t in tasks)
    
    # Plot tasks
    for i, task in enumerate(tasks):
        start_num = (task['start'] - min_date).days
        color = colors.get(task.get('category', 'default'), colors['default'])
        
        # Main bar
        ax.barh(i, task['duration'], left=start_num, height=0.6, 
                color=color, alpha=0.8, edgecolor='black', linewidth=0.5)
        
        # Progress overlay if specified
        if 'progress' in task:
            progress_width = task['duration'] * (task['progress'] / 100)
            ax.barh(i, progress_width, left=start_num, height=0.6,
                    color=color, alpha=1.0)
        
        # Task label
        ax.text(start_num + task['duration'] + 1, i, task['name'], 
                va='center', fontsize=9)
    
    # Formatting
    ax.set_yticks(range(len(tasks)))
    ax.set_yticklabels([t['name'] for t in tasks])
    ax.set_xlabel('Days from Start')
    ax.set_title('Project Timeline', fontsize=14, fontweight='bold')
    ax.grid(axis='x', alpha=0.3)
    ax.invert_yaxis()
    
    # Legend
    legend_patches = [mpatches.Patch(color=c, label=cat) 
                      for cat, c in colors.items() if cat != 'default']
    ax.legend(handles=legend_patches, loc='lower right')
    
    plt.tight_layout()
    plt.savefig(f"{filename}.png", dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Generated: {filename}.png")

# Example usage
tasks = [
    {'name': 'Discovery & Planning', 'start': '2025-01-01', 'duration': 14, 'category': 'Development'},
    {'name': 'Environment Setup', 'start': '2025-01-10', 'duration': 7, 'category': 'Development'},
    {'name': 'Core Development', 'start': '2025-01-15', 'duration': 30, 'category': 'Development'},
    {'name': 'Integration Testing', 'start': '2025-02-10', 'duration': 14, 'category': 'Testing'},
    {'name': 'UAT', 'start': '2025-02-20', 'duration': 10, 'category': 'Testing'},
    {'name': 'Data Migration', 'start': '2025-02-25', 'duration': 14, 'category': 'Migration'},
    {'name': 'Training', 'start': '2025-03-01', 'duration': 7, 'category': 'Training'},
    {'name': 'Go-Live', 'start': '2025-03-10', 'duration': 3, 'category': 'Deployment'},
    {'name': 'Hypercare', 'start': '2025-03-13', 'duration': 14, 'category': 'Deployment'},
]

create_gantt_chart(tasks, "project-gantt")
```

## Approach 2: Graphviz Timeline (Horizontal Phases)

```python
import graphviz

def create_phase_timeline(phases, filename="phase-timeline"):
    """
    Create a horizontal phase timeline.
    
    phases: list of dicts with keys:
        - name: phase name
        - duration: e.g., "4 weeks"
        - deliverables: list of deliverables
        - color: optional hex color
    """
    dot = graphviz.Digraph('Timeline', filename=filename, format='png')
    dot.attr(rankdir='LR', splines='spline')
    dot.attr('node', shape='none')
    
    colors = ['#4472C4', '#ED7D31', '#70AD47', '#FFC000', '#9E480E', '#5B9BD5']
    
    prev_node = None
    
    for i, phase in enumerate(phases):
        color = phase.get('color', colors[i % len(colors)])
        
        # Build deliverables list
        deliverables = "<BR/>".join([f"• {d}" for d in phase.get('deliverables', [])])
        
        html = f'''<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
            <TR><TD BGCOLOR="{color}"><FONT COLOR="white"><B>{phase['name']}</B></FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="10">{phase.get('duration', '')}</FONT></TD></TR>
            <TR><TD ALIGN="LEFT"><FONT POINT-SIZE="9">{deliverables}</FONT></TD></TR>
        </TABLE>>'''
        
        node_id = f"phase{i}"
        dot.node(node_id, html)
        
        if prev_node:
            dot.edge(prev_node, node_id)
        
        prev_node = node_id
    
    dot.render(cleanup=True)
    print(f"Generated: {filename}.png")

# Example
phases = [
    {
        'name': 'Phase 1: Discovery',
        'duration': '2 weeks',
        'deliverables': ['Requirements', 'Architecture', 'Plan']
    },
    {
        'name': 'Phase 2: Build',
        'duration': '6 weeks', 
        'deliverables': ['Core Platform', 'Integrations', 'Testing']
    },
    {
        'name': 'Phase 3: Migrate',
        'duration': '4 weeks',
        'deliverables': ['Data Migration', 'Validation', 'Training']
    },
    {
        'name': 'Phase 4: Go-Live',
        'duration': '2 weeks',
        'deliverables': ['Deployment', 'Hypercare', 'Handover']
    }
]

create_phase_timeline(phases, "project-phases")
```

## Approach 3: Vertical Roadmap

```python
import graphviz

def create_roadmap(milestones, filename="roadmap"):
    """
    Create a vertical roadmap/timeline.
    
    milestones: list of dicts with keys:
        - date: date string
        - title: milestone title
        - items: list of items/tasks
        - status: 'complete', 'in-progress', 'planned'
    """
    dot = graphviz.Digraph('Roadmap', filename=filename, format='png')
    dot.attr(rankdir='TB')
    dot.attr('node', shape='none')
    
    status_colors = {
        'complete': '#70AD47',
        'in-progress': '#FFC000',
        'planned': '#B4C7E7'
    }
    
    # Create timeline spine
    dot.node('title', '''<<TABLE BORDER="0">
        <TR><TD><FONT POINT-SIZE="18"><B>Project Roadmap</B></FONT></TD></TR>
    </TABLE>>''')
    
    prev_node = 'title'
    
    for i, milestone in enumerate(milestones):
        color = status_colors.get(milestone.get('status', 'planned'), '#B4C7E7')
        items_html = "<BR/>".join([f"• {item}" for item in milestone.get('items', [])])
        
        html = f'''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="8">
            <TR><TD BGCOLOR="{color}"><B>{milestone['date']}</B></TD></TR>
            <TR><TD><B>{milestone['title']}</B></TD></TR>
            <TR><TD ALIGN="LEFT"><FONT POINT-SIZE="9">{items_html}</FONT></TD></TR>
        </TABLE>>'''
        
        node_id = f"m{i}"
        dot.node(node_id, html)
        dot.edge(prev_node, node_id)
        prev_node = node_id
    
    dot.render(cleanup=True)
    print(f"Generated: {filename}.png")

# Example
milestones = [
    {
        'date': 'Jan 2025',
        'title': 'Project Kickoff',
        'items': ['Team onboarding', 'Environment setup', 'Initial planning'],
        'status': 'complete'
    },
    {
        'date': 'Feb 2025',
        'title': 'Development Sprint 1',
        'items': ['Core platform', 'Authentication', 'Base UI'],
        'status': 'in-progress'
    },
    {
        'date': 'Mar 2025',
        'title': 'Integration Phase',
        'items': ['API integrations', 'Data migration', 'Testing'],
        'status': 'planned'
    },
    {
        'date': 'Apr 2025',
        'title': 'Go-Live',
        'items': ['Production deployment', 'Training', 'Support transition'],
        'status': 'planned'
    }
]

create_roadmap(milestones, "project-roadmap")
```

## Approach 4: Mermaid Gantt

```python
def generate_mermaid_gantt(title, sections):
    """
    Generate Mermaid Gantt chart syntax.
    
    sections: list of dicts with keys:
        - name: section name
        - tasks: list of (task_name, start_date, duration) tuples
    """
    mermaid = f"""gantt
    title {title}
    dateFormat YYYY-MM-DD
    
"""
    for section in sections:
        mermaid += f"    section {section['name']}\n"
        for task in section['tasks']:
            task_name, start, duration = task
            mermaid += f"    {task_name} : {start}, {duration}\n"
    
    return mermaid

# Example
sections = [
    {
        'name': 'Discovery',
        'tasks': [
            ('Requirements', '2025-01-01', '7d'),
            ('Architecture', '2025-01-05', '5d'),
        ]
    },
    {
        'name': 'Development', 
        'tasks': [
            ('Core Platform', '2025-01-10', '21d'),
            ('Integrations', '2025-01-20', '14d'),
        ]
    },
    {
        'name': 'Deployment',
        'tasks': [
            ('Testing', '2025-02-01', '10d'),
            ('Go-Live', '2025-02-10', '3d'),
        ]
    }
]

print(generate_mermaid_gantt("Project Plan", sections))
```

## Parallel Workstreams

For diagrams showing parallel tracks:

```python
import graphviz

def create_parallel_tracks(tracks, filename="parallel-timeline"):
    """
    Create a diagram showing parallel workstreams.
    
    tracks: list of dicts with keys:
        - name: track name
        - phases: list of phase names
        - color: optional color
    """
    dot = graphviz.Digraph('Parallel', filename=filename, format='png')
    dot.attr(rankdir='LR')
    
    colors = ['#4472C4', '#ED7D31', '#70AD47', '#FFC000']
    
    # Create subgraphs for alignment
    for i, track in enumerate(tracks):
        color = track.get('color', colors[i % len(colors)])
        
        with dot.subgraph() as s:
            s.attr(rank='same')
            
            prev_node = None
            for j, phase in enumerate(track['phases']):
                node_id = f"t{i}p{j}"
                s.node(node_id, phase, shape='box', style='filled', 
                       fillcolor=color, fontcolor='white')
                
                if prev_node:
                    dot.edge(prev_node, node_id)
                prev_node = node_id
        
        # Track label
        label_id = f"label{i}"
        dot.node(label_id, track['name'], shape='plaintext', fontsize='12')
        dot.edge(label_id, f"t{i}p0", style='invis')
    
    # Align phases vertically
    max_phases = max(len(t['phases']) for t in tracks)
    for j in range(max_phases):
        with dot.subgraph() as s:
            s.attr(rank='same')
            for i in range(len(tracks)):
                if j < len(tracks[i]['phases']):
                    s.node(f"t{i}p{j}")
    
    dot.render(cleanup=True)
    print(f"Generated: {filename}.png")

# Example: Development vs Migration tracks
tracks = [
    {
        'name': 'Development',
        'phases': ['Design', 'Build', 'Test', 'Deploy'],
        'color': '#4472C4'
    },
    {
        'name': 'Migration',
        'phases': ['Analysis', 'Extract', 'Transform', 'Load'],
        'color': '#70AD47'
    }
]

create_parallel_tracks(tracks, "dev-migration-timeline")
```

## Converting ASCII Timelines

When you see:
```
Q1 2025          Q2 2025          Q3 2025          Q4 2025
|                |                |                |
├─ Discovery ────┤                |                |
|                ├─ Development ──┼────────────────┤
|                |                ├─ Migration ────┤
|                |                |                ├─ Go-Live
```

Extract:
1. Time periods (quarters, months, weeks)
2. Phase/task names
3. Duration (spans between markers)
4. Dependencies (sequential vs parallel)
5. Milestones (specific dates)
