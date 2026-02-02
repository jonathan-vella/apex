#!/usr/bin/env python3
"""
Multi-Type Diagram Generator
Generates various diagram types: Azure architecture, process flows, ERD, timelines, wireframes.

Usage:
    python multi_diagram_generator.py --type process --title "My Process" --output process-flow
    python multi_diagram_generator.py --type erd --title "Data Model" --output data-model
    python multi_diagram_generator.py --type timeline --title "Project Plan" --output timeline
    python multi_diagram_generator.py --type wireframe --title "Dashboard" --output dashboard
"""

import argparse
from pathlib import Path

# ============================================================================
# BUSINESS PROCESS FLOWS
# ============================================================================

def create_process_flow(title: str, filename: str, steps: list = None):
    """
    Create a business process flow diagram.
    
    steps: list of dicts with keys:
        - id: unique identifier
        - label: display text
        - type: 'start', 'end', 'process', 'decision', 'user', 'system', 'data'
        - next: list of (target_id, label) tuples
    """
    from graphviz import Digraph
    
    dot = Digraph(title, filename=filename, format='png')
    dot.attr(rankdir='TB', bgcolor='white', pad='0.5', nodesep='0.8', ranksep='0.8')
    dot.attr('node', fontname='Segoe UI, Arial', fontsize='10')
    dot.attr('edge', fontname='Segoe UI, Arial', fontsize='9')
    
    # Style definitions
    styles = {
        'start': {'shape': 'ellipse', 'style': 'filled', 'fillcolor': '#E8F5E9', 'color': '#4CAF50'},
        'end': {'shape': 'ellipse', 'style': 'filled', 'fillcolor': '#E8F5E9', 'color': '#4CAF50'},
        'process': {'shape': 'box', 'style': 'filled,rounded', 'fillcolor': '#E3F2FD', 'color': '#2196F3'},
        'decision': {'shape': 'diamond', 'style': 'filled', 'fillcolor': '#FFF8E1', 'color': '#FFC107'},
        'user': {'shape': 'box', 'style': 'filled', 'fillcolor': '#F3E5F5', 'color': '#9C27B0'},
        'system': {'shape': 'box', 'style': 'filled', 'fillcolor': '#E0F7FA', 'color': '#00BCD4'},
        'data': {'shape': 'cylinder', 'style': 'filled', 'fillcolor': '#FBE9E7', 'color': '#FF5722'},
        'document': {'shape': 'note', 'style': 'filled', 'fillcolor': '#FFFDE7', 'color': '#FFEB3B'},
    }
    
    # Default example if no steps provided
    if not steps:
        steps = [
            {'id': 'start', 'label': 'Start', 'type': 'start', 'next': [('step1', None)]},
            {'id': 'step1', 'label': 'User Action', 'type': 'user', 'next': [('step2', None)]},
            {'id': 'step2', 'label': 'System Process', 'type': 'system', 'next': [('decide', None)]},
            {'id': 'decide', 'label': 'Valid?', 'type': 'decision', 'next': [('step3', 'Yes'), ('error', 'No')]},
            {'id': 'step3', 'label': 'Save Data', 'type': 'data', 'next': [('end', None)]},
            {'id': 'error', 'label': 'Handle Error', 'type': 'process', 'next': [('end', None)]},
            {'id': 'end', 'label': 'End', 'type': 'end', 'next': []},
        ]
    
    # Add nodes
    for step in steps:
        style = styles.get(step['type'], styles['process'])
        dot.node(step['id'], step['label'], **style)
    
    # Add edges
    for step in steps:
        for target, label in step.get('next', []):
            if label:
                dot.edge(step['id'], target, label=label)
            else:
                dot.edge(step['id'], target)
    
    dot.render(cleanup=True)
    print(f"✅ Generated: {filename}.png")
    return f"{filename}.png"


def create_swimlane_flow(title: str, filename: str, lanes: list = None):
    """
    Create a swimlane process flow with multiple actors.
    
    lanes: list of dicts with keys:
        - name: lane name (actor)
        - color: background color
        - steps: list of step dicts
    """
    from graphviz import Digraph
    
    dot = Digraph(title, filename=filename, format='png')
    dot.attr(rankdir='TB', compound='true', bgcolor='white', pad='0.5')
    dot.attr('node', fontname='Segoe UI', fontsize='10')
    
    # Default example
    if not lanes:
        lanes = [
            {
                'name': 'User',
                'color': '#F3E5F5',
                'steps': [
                    {'id': 'u1', 'label': 'Submit Request'},
                    {'id': 'u2', 'label': 'Review Result'},
                ]
            },
            {
                'name': 'System',
                'color': '#E3F2FD',
                'steps': [
                    {'id': 's1', 'label': 'Validate Input'},
                    {'id': 's2', 'label': 'Process Data'},
                    {'id': 's3', 'label': 'Store Result'},
                ]
            }
        ]
    
    # Create lanes
    for i, lane in enumerate(lanes):
        with dot.subgraph(name=f'cluster_{i}') as sub:
            sub.attr(label=lane['name'], style='filled', fillcolor=lane['color'])
            for step in lane['steps']:
                sub.node(step['id'], step['label'], shape='box', style='rounded,filled', fillcolor='white')
    
    # Default connections
    dot.edge('u1', 's1')
    dot.edge('s1', 's2')
    dot.edge('s2', 's3')
    dot.edge('s3', 'u2')
    
    dot.render(cleanup=True)
    print(f"✅ Generated: {filename}.png")
    return f"{filename}.png"


# ============================================================================
# ENTITY RELATIONSHIP DIAGRAMS (ERD)
# ============================================================================

def create_erd(title: str, filename: str, tables: list = None):
    """
    Create an ERD diagram.
    
    tables: list of dicts with keys:
        - name: table name
        - columns: list of (name, type, key_type) where key_type is 'PK', 'FK', or None
        - color: header color (optional)
    """
    from graphviz import Digraph
    
    dot = Digraph(title, filename=filename, format='png')
    dot.attr(rankdir='LR', bgcolor='white', splines='spline', nodesep='0.8', ranksep='1.5')
    dot.attr('node', shape='none', fontname='Segoe UI', fontsize='10')
    
    # Default example
    if not tables:
        tables = [
            {
                'name': 'Documents',
                'color': '#4472C4',
                'columns': [
                    ('DocumentId', 'INT', 'PK'),
                    ('AccountId', 'INT', 'FK'),
                    ('Title', 'NVARCHAR(255)', None),
                    ('CreatedDate', 'DATETIME2', None),
                    ('CreatedBy', 'INT', 'FK'),
                ]
            },
            {
                'name': 'Accounts',
                'color': '#548235',
                'columns': [
                    ('AccountId', 'INT', 'PK'),
                    ('AccountRef', 'VARCHAR(50)', None),
                    ('Status', 'VARCHAR(20)', None),
                ]
            },
            {
                'name': 'Users',
                'color': '#BF9000',
                'columns': [
                    ('UserId', 'INT', 'PK'),
                    ('Email', 'NVARCHAR(200)', None),
                    ('RoleId', 'INT', 'FK'),
                ]
            },
        ]
    
    def make_table_html(table):
        color = table.get('color', '#4472C4')
        rows = ""
        for col_name, col_type, key_type in table['columns']:
            key_icon = ''
            if key_type == 'PK':
                key_icon = '🔑 '
            elif key_type == 'FK':
                key_icon = '🔗 '
            rows += f'<TR><TD ALIGN="LEFT">{key_icon}{col_name}</TD><TD ALIGN="LEFT"><FONT COLOR="gray">{col_type}</FONT></TD></TR>'
        
        return f'''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4">
            <TR><TD BGCOLOR="{color}" COLSPAN="2"><FONT COLOR="white"><B>{table["name"]}</B></FONT></TD></TR>
            {rows}
        </TABLE>>'''
    
    # Add table nodes
    for table in tables:
        dot.node(table['name'], make_table_html(table))
    
    # Add relationships (default example)
    if len(tables) >= 2:
        dot.edge('Documents', 'Accounts', arrowhead='none', arrowtail='crow')
    if len(tables) >= 3:
        dot.edge('Documents', 'Users', arrowhead='none', arrowtail='crow')
    
    dot.render(cleanup=True)
    print(f"✅ Generated: {filename}.png")
    return f"{filename}.png"


def create_access_matrix(title: str, filename: str, matrix: dict = None):
    """
    Create an access control matrix.
    
    matrix: dict with:
        - roles: list of role names
        - entities: list of entity names
        - permissions: 2D list of permission strings (e.g., 'CRUD', 'R', '-')
    """
    from graphviz import Digraph
    
    dot = Digraph(title, filename=filename, format='png')
    dot.attr(bgcolor='white')
    dot.attr('node', shape='none')
    
    # Default example
    if not matrix:
        matrix = {
            'roles': ['Admin', 'Manager', 'User', 'Guest'],
            'entities': ['Documents', 'Accounts', 'Users', 'Settings'],
            'permissions': [
                ['CRUD', 'CRUD', 'CRUD', 'CRUD'],
                ['CRUD', 'CRU', 'R', 'R'],
                ['CRU', 'R', '-', '-'],
                ['R', '-', '-', '-'],
            ]
        }
    
    # Color coding
    def get_color(perm):
        if perm == 'CRUD':
            return '#C6EFCE'
        elif perm in ['CRU', 'CR', 'RU']:
            return '#FFEB9C'
        elif perm == 'R':
            return '#FFC7CE'
        return '#F0F0F0'
    
    # Build HTML table
    header_cells = '<TD BGCOLOR="#4472C4"><FONT COLOR="white"><B>Role / Entity</B></FONT></TD>'
    for entity in matrix['entities']:
        header_cells += f'<TD BGCOLOR="#4472C4"><FONT COLOR="white"><B>{entity}</B></FONT></TD>'
    
    rows = ""
    for i, role in enumerate(matrix['roles']):
        cells = f'<TD><B>{role}</B></TD>'
        for j, perm in enumerate(matrix['permissions'][i]):
            color = get_color(perm)
            cells += f'<TD BGCOLOR="{color}">{perm}</TD>'
        rows += f'<TR>{cells}</TR>'
    
    html = f'''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
        <TR>{header_cells}</TR>
        {rows}
    </TABLE>>'''
    
    dot.node('matrix', html)
    dot.render(cleanup=True)
    print(f"✅ Generated: {filename}.png")
    return f"{filename}.png"


# ============================================================================
# TIMELINE / GANTT CHARTS
# ============================================================================

def create_gantt_chart(title: str, filename: str, tasks: list = None):
    """
    Create a Gantt chart.
    
    tasks: list of dicts with:
        - name: task name
        - start: start position (number)
        - duration: length
        - category: for color coding
    """
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    
    # Default example
    if not tasks:
        tasks = [
            {'name': 'Discovery', 'start': 0, 'duration': 2, 'category': 'Planning'},
            {'name': 'Environment Setup', 'start': 1, 'duration': 2, 'category': 'Development'},
            {'name': 'Core Development', 'start': 2, 'duration': 6, 'category': 'Development'},
            {'name': 'Integration', 'start': 6, 'duration': 3, 'category': 'Development'},
            {'name': 'Testing', 'start': 8, 'duration': 3, 'category': 'Testing'},
            {'name': 'Data Migration', 'start': 9, 'duration': 2, 'category': 'Migration'},
            {'name': 'UAT', 'start': 10, 'duration': 2, 'category': 'Testing'},
            {'name': 'Training', 'start': 11, 'duration': 1, 'category': 'Training'},
            {'name': 'Go-Live', 'start': 12, 'duration': 1, 'category': 'Deployment'},
        ]
    
    colors = {
        'Planning': '#4472C4',
        'Development': '#ED7D31',
        'Testing': '#70AD47',
        'Migration': '#FFC000',
        'Training': '#9E480E',
        'Deployment': '#5B9BD5',
    }
    
    fig, ax = plt.subplots(figsize=(14, len(tasks) * 0.5 + 1))
    
    for i, task in enumerate(tasks):
        color = colors.get(task.get('category', 'Development'), '#5B9BD5')
        ax.barh(i, task['duration'], left=task['start'], height=0.6, 
                color=color, alpha=0.8, edgecolor='white', linewidth=0.5)
    
    ax.set_yticks(range(len(tasks)))
    ax.set_yticklabels([t['name'] for t in tasks], fontsize=9)
    ax.set_xlabel('Weeks', fontsize=10)
    ax.set_title(title, fontsize=12, fontweight='bold')
    ax.grid(axis='x', alpha=0.3, linestyle='--')
    ax.invert_yaxis()
    ax.set_axisbelow(True)
    
    # Legend
    legend_patches = [mpatches.Patch(color=c, label=cat) for cat, c in colors.items()]
    ax.legend(handles=legend_patches, loc='lower right', fontsize=8)
    
    plt.tight_layout()
    plt.savefig(f"{filename}.png", dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"✅ Generated: {filename}.png")
    return f"{filename}.png"


def create_phase_timeline(title: str, filename: str, phases: list = None):
    """
    Create a horizontal phase timeline.
    """
    from graphviz import Digraph
    
    dot = Digraph(title, filename=filename, format='png')
    dot.attr(rankdir='LR', bgcolor='white', pad='0.5')
    dot.attr('node', shape='none', fontname='Segoe UI', fontsize='10')
    
    # Default example
    if not phases:
        phases = [
            {'name': 'Phase 1\nDiscovery', 'duration': '2 weeks', 'items': ['Requirements', 'Design'], 'color': '#4472C4'},
            {'name': 'Phase 2\nBuild', 'duration': '6 weeks', 'items': ['Development', 'Integration'], 'color': '#ED7D31'},
            {'name': 'Phase 3\nTest', 'duration': '3 weeks', 'items': ['Testing', 'UAT'], 'color': '#70AD47'},
            {'name': 'Phase 4\nDeploy', 'duration': '2 weeks', 'items': ['Migration', 'Go-Live'], 'color': '#FFC000'},
        ]
    
    prev = None
    for i, phase in enumerate(phases):
        items = "<BR/>".join([f"• {item}" for item in phase.get('items', [])])
        html = f'''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="8">
            <TR><TD BGCOLOR="{phase['color']}"><FONT COLOR="white"><B>{phase['name']}</B></FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">{phase.get('duration', '')}</FONT></TD></TR>
            <TR><TD ALIGN="LEFT"><FONT POINT-SIZE="8">{items}</FONT></TD></TR>
        </TABLE>>'''
        
        node_id = f'phase{i}'
        dot.node(node_id, html)
        
        if prev:
            dot.edge(prev, node_id)
        prev = node_id
    
    dot.render(cleanup=True)
    print(f"✅ Generated: {filename}.png")
    return f"{filename}.png"


# ============================================================================
# UI WIREFRAMES
# ============================================================================

def create_wireframe_svg(title: str, filename: str, layout: str = 'dashboard'):
    """
    Create a UI wireframe as SVG.
    """
    width, height = 800, 600
    
    if layout == 'dashboard':
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
    <style>
        .title {{ font: bold 14px sans-serif; fill: white; }}
        .label {{ font: 11px sans-serif; fill: #333; }}
        .small {{ font: 9px sans-serif; fill: #666; }}
    </style>
    
    <rect width="{width}" height="{height}" fill="#f5f5f5"/>
    <rect x="20" y="20" width="{width-40}" height="{height-40}" fill="white" stroke="#333" stroke-width="2" rx="8"/>
    
    <!-- Header -->
    <rect x="20" y="20" width="{width-40}" height="50" fill="#4472C4" rx="8"/>
    <rect x="20" y="55" width="{width-40}" height="15" fill="#4472C4"/>
    <text x="40" y="50" class="title">{title}</text>
    
    <!-- Nav items -->
    <rect x="550" y="35" width="60" height="25" fill="rgba(255,255,255,0.2)" rx="4"/>
    <text x="565" y="52" class="small" fill="white">Home</text>
    <rect x="620" y="35" width="70" height="25" fill="rgba(255,255,255,0.2)" rx="4"/>
    <text x="632" y="52" class="small" fill="white">Settings</text>
    
    <!-- Sidebar -->
    <rect x="20" y="70" width="150" height="{height-110}" fill="#f8f8f8"/>
    <line x1="170" y1="70" x2="170" y2="{height-40}" stroke="#ddd"/>
    
    <!-- Sidebar items -->
    <rect x="30" y="85" width="130" height="28" fill="#4472C4" rx="4"/>
    <text x="45" y="103" class="small" fill="white">📊 Dashboard</text>
    <rect x="30" y="120" width="130" height="28" fill="white" stroke="#ddd" rx="4"/>
    <text x="45" y="138" class="small">📄 Documents</text>
    <rect x="30" y="155" width="130" height="28" fill="white" stroke="#ddd" rx="4"/>
    <text x="45" y="173" class="small">👥 Accounts</text>
    <rect x="30" y="190" width="130" height="28" fill="white" stroke="#ddd" rx="4"/>
    <text x="45" y="208" class="small">⚙️ Settings</text>
    
    <!-- Stats cards -->
    <rect x="185" y="85" width="180" height="75" fill="white" stroke="#ddd" rx="8"/>
    <text x="275" y="115" class="label" text-anchor="middle" font-weight="bold" font-size="20">12,456</text>
    <text x="275" y="140" class="small" text-anchor="middle">Total Documents</text>
    
    <rect x="380" y="85" width="180" height="75" fill="white" stroke="#ddd" rx="8"/>
    <text x="470" y="115" class="label" text-anchor="middle" font-weight="bold" font-size="20">342</text>
    <text x="470" y="140" class="small" text-anchor="middle">Pending Review</text>
    
    <rect x="575" y="85" width="180" height="75" fill="white" stroke="#ddd" rx="8"/>
    <text x="665" y="115" class="label" text-anchor="middle" font-weight="bold" font-size="20">28</text>
    <text x="665" y="140" class="small" text-anchor="middle">New Today</text>
    
    <!-- Content area -->
    <rect x="185" y="175" width="570" height="380" fill="white" stroke="#ddd" rx="8"/>
    <text x="200" y="200" class="label" font-weight="bold">Recent Documents</text>
    <line x1="185" y1="215" x2="755" y2="215" stroke="#eee"/>
    
    <!-- Table header -->
    <rect x="195" y="225" width="550" height="25" fill="#f5f5f5"/>
    <text x="210" y="242" class="small">Document</text>
    <text x="400" y="242" class="small">Account</text>
    <text x="520" y="242" class="small">Date</text>
    <text x="640" y="242" class="small">Status</text>
    
    <!-- Table rows -->
    <rect x="210" y="260" width="150" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="400" y="260" width="80" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="520" y="260" width="60" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="640" y="260" width="50" height="10" fill="#e0e0e0" rx="2"/>
    
    <rect x="210" y="285" width="140" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="400" y="285" width="85" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="520" y="285" width="60" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="640" y="285" width="55" height="10" fill="#e0e0e0" rx="2"/>
    
    <rect x="210" y="310" width="160" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="400" y="310" width="75" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="520" y="310" width="60" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="640" y="310" width="45" height="10" fill="#e0e0e0" rx="2"/>
</svg>'''
    
    elif layout == 'list':
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
    <style>
        .title {{ font: bold 14px sans-serif; fill: white; }}
        .label {{ font: 11px sans-serif; fill: #333; }}
        .small {{ font: 9px sans-serif; fill: #666; }}
    </style>
    
    <rect width="{width}" height="{height}" fill="#f5f5f5"/>
    <rect x="20" y="20" width="{width-40}" height="{height-40}" fill="white" stroke="#333" stroke-width="2" rx="8"/>
    
    <!-- Header -->
    <rect x="20" y="20" width="{width-40}" height="50" fill="#4472C4" rx="8"/>
    <rect x="20" y="55" width="{width-40}" height="15" fill="#4472C4"/>
    <text x="40" y="50" class="title">{title}</text>
    
    <!-- Search bar -->
    <rect x="40" y="85" width="500" height="35" fill="white" stroke="#ddd" rx="4"/>
    <text x="55" y="107" class="small" fill="#999">Search...</text>
    <rect x="550" y="85" width="80" height="35" fill="#4472C4" rx="4"/>
    <text x="573" y="107" class="small" fill="white">Search</text>
    <rect x="640" y="85" width="80" height="35" fill="#6c757d" rx="4"/>
    <text x="665" y="107" class="small" fill="white">Filter</text>
    
    <!-- List items -->
    <rect x="40" y="135" width="690" height="60" fill="white" stroke="#ddd" rx="4"/>
    <rect x="55" y="150" width="200" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="55" y="170" width="300" height="10" fill="#f0f0f0" rx="2"/>
    <text x="650" y="165" class="small" fill="#4472C4">View →</text>
    
    <rect x="40" y="205" width="690" height="60" fill="white" stroke="#ddd" rx="4"/>
    <rect x="55" y="220" width="220" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="55" y="240" width="280" height="10" fill="#f0f0f0" rx="2"/>
    <text x="650" y="235" class="small" fill="#4472C4">View →</text>
    
    <rect x="40" y="275" width="690" height="60" fill="white" stroke="#ddd" rx="4"/>
    <rect x="55" y="290" width="180" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="55" y="310" width="320" height="10" fill="#f0f0f0" rx="2"/>
    <text x="650" y="305" class="small" fill="#4472C4">View →</text>
    
    <rect x="40" y="345" width="690" height="60" fill="white" stroke="#ddd" rx="4"/>
    <rect x="55" y="360" width="240" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="55" y="380" width="260" height="10" fill="#f0f0f0" rx="2"/>
    <text x="650" y="375" class="small" fill="#4472C4">View →</text>
</svg>'''
    
    else:  # detail
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
    <style>
        .title {{ font: bold 14px sans-serif; fill: white; }}
        .label {{ font: 11px sans-serif; fill: #333; }}
        .small {{ font: 9px sans-serif; fill: #666; }}
    </style>
    
    <rect width="{width}" height="{height}" fill="#f5f5f5"/>
    <rect x="20" y="20" width="{width-40}" height="{height-40}" fill="white" stroke="#333" stroke-width="2" rx="8"/>
    
    <!-- Header -->
    <rect x="20" y="20" width="{width-40}" height="50" fill="#4472C4" rx="8"/>
    <rect x="20" y="55" width="{width-40}" height="15" fill="#4472C4"/>
    <text x="40" y="50" class="title">{title}</text>
    
    <!-- Breadcrumb -->
    <text x="40" y="95" class="small" fill="#666">Home › Documents › Detail</text>
    
    <!-- Title area -->
    <rect x="40" y="110" width="400" height="20" fill="#e0e0e0" rx="2"/>
    <rect x="40" y="140" width="200" height="12" fill="#f0f0f0" rx="2"/>
    
    <!-- Action buttons -->
    <rect x="560" y="110" width="80" height="32" fill="#4472C4" rx="4"/>
    <text x="585" y="130" class="small" fill="white">Edit</text>
    <rect x="650" y="110" width="80" height="32" fill="#6c757d" rx="4"/>
    <text x="668" y="130" class="small" fill="white">Delete</text>
    
    <!-- Content sections -->
    <rect x="40" y="170" width="440" height="200" fill="white" stroke="#ddd" rx="8"/>
    <text x="55" y="195" class="label" font-weight="bold">Details</text>
    <line x1="40" y1="210" x2="480" y2="210" stroke="#eee"/>
    <rect x="55" y="225" width="100" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="170" y="225" width="150" height="10" fill="#f0f0f0" rx="2"/>
    <rect x="55" y="250" width="80" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="170" y="250" width="200" height="10" fill="#f0f0f0" rx="2"/>
    <rect x="55" y="275" width="90" height="10" fill="#e0e0e0" rx="2"/>
    <rect x="170" y="275" width="120" height="10" fill="#f0f0f0" rx="2"/>
    
    <!-- Sidebar -->
    <rect x="500" y="170" width="230" height="200" fill="white" stroke="#ddd" rx="8"/>
    <text x="515" y="195" class="label" font-weight="bold">Related</text>
    <line x1="500" y1="210" x2="730" y2="210" stroke="#eee"/>
    <rect x="515" y="225" width="180" height="10" fill="#f0f0f0" rx="2"/>
    <rect x="515" y="250" width="160" height="10" fill="#f0f0f0" rx="2"/>
    <rect x="515" y="275" width="140" height="10" fill="#f0f0f0" rx="2"/>
</svg>'''
    
    # Save SVG
    with open(f"{filename}.svg", 'w') as f:
        f.write(svg)
    
    # Try to convert to PNG
    try:
        import cairosvg
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f"{filename}.png", scale=2)
        print(f"✅ Generated: {filename}.png")
        return f"{filename}.png"
    except ImportError:
        print(f"✅ Generated: {filename}.svg (install cairosvg for PNG)")
        return f"{filename}.svg"


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Generate various diagram types")
    parser.add_argument('--type', '-t', required=True, 
                        choices=['process', 'swimlane', 'erd', 'matrix', 'gantt', 'timeline', 'wireframe'],
                        help='Diagram type')
    parser.add_argument('--title', '-n', default='Diagram', help='Diagram title')
    parser.add_argument('--output', '-o', default='output', help='Output filename (no extension)')
    parser.add_argument('--layout', '-l', default='dashboard', 
                        choices=['dashboard', 'list', 'detail'],
                        help='Wireframe layout type')
    
    args = parser.parse_args()
    
    if args.type == 'process':
        create_process_flow(args.title, args.output)
    elif args.type == 'swimlane':
        create_swimlane_flow(args.title, args.output)
    elif args.type == 'erd':
        create_erd(args.title, args.output)
    elif args.type == 'matrix':
        create_access_matrix(args.title, args.output)
    elif args.type == 'gantt':
        create_gantt_chart(args.title, args.output)
    elif args.type == 'timeline':
        create_phase_timeline(args.title, args.output)
    elif args.type == 'wireframe':
        create_wireframe_svg(args.title, args.output, args.layout)


if __name__ == "__main__":
    main()
