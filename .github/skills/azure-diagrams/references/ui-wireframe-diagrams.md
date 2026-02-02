# UI Wireframe Diagrams

Generate professional UI wireframe mockups showing screen layouts and components.

## Approach 1: HTML/CSS to PNG (Recommended)

Generate HTML wireframes and convert to PNG using a headless browser.

```python
import subprocess
from pathlib import Path

def create_wireframe_html(title, components, filename="wireframe"):
    """
    Create a wireframe as HTML, then convert to PNG.
    
    components: list of dicts describing UI elements
    """
    html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: #f5f5f5; 
            padding: 20px;
        }}
        .wireframe {{
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            width: 800px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: #4472C4;
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .header h1 {{ font-size: 18px; }}
        .nav {{
            display: flex;
            gap: 15px;
        }}
        .nav-item {{
            background: rgba(255,255,255,0.2);
            padding: 8px 15px;
            border-radius: 4px;
            font-size: 12px;
        }}
        .sidebar {{
            width: 200px;
            background: #f0f0f0;
            padding: 15px;
            float: left;
            min-height: 400px;
            border-right: 1px solid #ddd;
        }}
        .sidebar-item {{
            padding: 10px;
            margin-bottom: 5px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
        }}
        .sidebar-item.active {{
            background: #4472C4;
            color: white;
            border-color: #4472C4;
        }}
        .main {{
            margin-left: 200px;
            padding: 20px;
            min-height: 400px;
        }}
        .card {{
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }}
        .card-title {{
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }}
        .placeholder {{
            background: #e0e0e0;
            height: 20px;
            border-radius: 4px;
            margin-bottom: 8px;
        }}
        .placeholder.short {{ width: 40%; }}
        .placeholder.medium {{ width: 70%; }}
        .placeholder.long {{ width: 100%; }}
        .button {{
            display: inline-block;
            background: #4472C4;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            margin-right: 8px;
        }}
        .button.secondary {{
            background: #6c757d;
        }}
        .table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .table th, .table td {{
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            font-size: 12px;
        }}
        .table th {{
            background: #f5f5f5;
            font-weight: bold;
        }}
        .search-box {{
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }}
        .input {{
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
        }}
        .stat-card {{
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 24px;
            font-weight: bold;
            color: #4472C4;
        }}
        .stat-label {{
            font-size: 11px;
            color: #666;
            margin-top: 5px;
        }}
        .breadcrumb {{
            font-size: 11px;
            color: #666;
            margin-bottom: 15px;
        }}
        .breadcrumb span {{
            margin: 0 5px;
        }}
        .footer {{
            background: #f5f5f5;
            padding: 10px 20px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #666;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="wireframe">
        {generate_components_html(components)}
    </div>
</body>
</html>'''
    
    # Save HTML
    html_path = Path(f"{filename}.html")
    html_path.write_text(html)
    
    # Convert to PNG using wkhtmltoimage or similar
    # Alternative: use playwright, puppeteer, or selenium
    try:
        subprocess.run([
            'wkhtmltoimage', '--quality', '90', 
            str(html_path), f"{filename}.png"
        ], check=True, capture_output=True)
        print(f"Generated: {filename}.png")
    except FileNotFoundError:
        print(f"Generated: {filename}.html (install wkhtmltoimage for PNG conversion)")
    
    return html


def generate_components_html(components):
    """Generate HTML for wireframe components."""
    html = ""
    for comp in components:
        comp_type = comp.get('type')
        
        if comp_type == 'header':
            nav_items = "".join([f'<div class="nav-item">{item}</div>' 
                                  for item in comp.get('nav', [])])
            html += f'''<div class="header">
                <h1>{comp.get('title', 'Application')}</h1>
                <div class="nav">{nav_items}</div>
            </div>'''
        
        elif comp_type == 'sidebar':
            items = ""
            for item in comp.get('items', []):
                active = ' active' if item.get('active') else ''
                items += f'<div class="sidebar-item{active}">{item.get("label", "")}</div>'
            html += f'<div class="sidebar">{items}</div>'
        
        elif comp_type == 'main-start':
            html += '<div class="main">'
        
        elif comp_type == 'main-end':
            html += '</div>'
        
        elif comp_type == 'breadcrumb':
            crumbs = " <span>›</span> ".join(comp.get('items', []))
            html += f'<div class="breadcrumb">{crumbs}</div>'
        
        elif comp_type == 'card':
            content = comp.get('content', '')
            if comp.get('placeholder_lines'):
                content = "".join([
                    f'<div class="placeholder {line}"></div>' 
                    for line in comp.get('placeholder_lines')
                ])
            html += f'''<div class="card">
                <div class="card-title">{comp.get('title', 'Card')}</div>
                {content}
            </div>'''
        
        elif comp_type == 'stats':
            stats_html = ""
            for stat in comp.get('items', []):
                stats_html += f'''<div class="stat-card">
                    <div class="stat-value">{stat.get('value', '0')}</div>
                    <div class="stat-label">{stat.get('label', '')}</div>
                </div>'''
            html += f'<div class="grid">{stats_html}</div>'
        
        elif comp_type == 'search':
            html += f'''<div class="search-box">
                <input class="input" placeholder="{comp.get('placeholder', 'Search...')}">
                <div class="button">Search</div>
            </div>'''
        
        elif comp_type == 'table':
            headers = "".join([f'<th>{h}</th>' for h in comp.get('headers', [])])
            rows = ""
            for row in comp.get('rows', []):
                cells = "".join([f'<td>{cell}</td>' for cell in row])
                rows += f'<tr>{cells}</tr>'
            html += f'''<table class="table">
                <thead><tr>{headers}</tr></thead>
                <tbody>{rows}</tbody>
            </table>'''
        
        elif comp_type == 'buttons':
            btns = ""
            for btn in comp.get('items', []):
                btn_class = 'button secondary' if btn.get('secondary') else 'button'
                btns += f'<div class="{btn_class}">{btn.get("label", "Button")}</div>'
            html += f'<div style="margin-top: 15px;">{btns}</div>'
        
        elif comp_type == 'footer':
            html += f'<div class="footer">{comp.get("text", "")}</div>'
    
    return html
```

## Example: Dashboard Wireframe

```python
dashboard_components = [
    {
        'type': 'header',
        'title': 'Document Management System',
        'nav': ['Dashboard', 'Documents', 'Accounts', 'Reports', 'Settings']
    },
    {
        'type': 'sidebar',
        'items': [
            {'label': '📊 Dashboard', 'active': True},
            {'label': '📄 All Documents'},
            {'label': '📁 My Documents'},
            {'label': '🔍 Search'},
            {'label': '📤 Upload'},
            {'label': '📋 Recent'},
            {'label': '⚙️ Settings'},
        ]
    },
    {'type': 'main-start'},
    {
        'type': 'breadcrumb',
        'items': ['Home', 'Dashboard']
    },
    {
        'type': 'stats',
        'items': [
            {'value': '12,456', 'label': 'Total Documents'},
            {'value': '342', 'label': 'Pending Review'},
            {'value': '28', 'label': 'New Today'},
        ]
    },
    {
        'type': 'card',
        'title': 'Recent Documents',
        'content': ''
    },
    {
        'type': 'search',
        'placeholder': 'Search documents...'
    },
    {
        'type': 'table',
        'headers': ['Document', 'Account', 'Date', 'Status'],
        'rows': [
            ['Assessment Form 2024-001', 'ACC-12345', '2025-01-15', 'Pending'],
            ['Income Verification', 'ACC-12346', '2025-01-14', 'Approved'],
            ['Application Letter', 'ACC-12347', '2025-01-14', 'Processing'],
            ['Supporting Evidence', 'ACC-12348', '2025-01-13', 'Complete'],
        ]
    },
    {'type': 'main-end'},
    {
        'type': 'footer',
        'text': '© 2025 PlymDocs - Plymouth City Council'
    }
]

create_wireframe_html("Dashboard", dashboard_components, "dashboard-wireframe")
```

## Example: Email List Page

```python
email_list_components = [
    {
        'type': 'header',
        'title': 'Email Management',
        'nav': ['Inbox', 'Sent', 'Archive', 'Settings']
    },
    {
        'type': 'sidebar',
        'items': [
            {'label': '📥 Inbox (24)', 'active': True},
            {'label': '📤 Sent'},
            {'label': '📋 Drafts (3)'},
            {'label': '🗑️ Trash'},
            {'label': '⭐ Starred'},
            {'label': '📁 Archive'},
        ]
    },
    {'type': 'main-start'},
    {
        'type': 'search',
        'placeholder': 'Search emails...'
    },
    {
        'type': 'buttons',
        'items': [
            {'label': '✉️ Compose'},
            {'label': 'Refresh', 'secondary': True},
            {'label': 'Filter', 'secondary': True},
        ]
    },
    {
        'type': 'table',
        'headers': ['', 'From', 'Subject', 'Date', 'Actions'],
        'rows': [
            ['☐', 'john.smith@example.com', 'RE: Application Status', '10:30 AM', '👁️ 🗑️'],
            ['☐', 'benefits@council.gov', 'Assessment Required', '09:15 AM', '👁️ 🗑️'],
            ['☐', 'support@firmstep.com', 'Weekly Report', 'Yesterday', '👁️ 🗑️'],
            ['☐', 'no-reply@system.local', 'Document Uploaded', 'Yesterday', '👁️ 🗑️'],
            ['☐', 'jane.doe@example.com', 'Query about account', 'Jan 14', '👁️ 🗑️'],
        ]
    },
    {'type': 'main-end'},
]

create_wireframe_html("Email List", email_list_components, "email-list-wireframe")
```

## Approach 2: SVG Wireframes (No External Dependencies)

```python
def create_svg_wireframe(title, width=800, height=600, filename="wireframe"):
    """Create a wireframe as SVG."""
    
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <style>
            .title {{ font: bold 16px sans-serif; fill: white; }}
            .label {{ font: 12px sans-serif; fill: #333; }}
            .small {{ font: 10px sans-serif; fill: #666; }}
        </style>
    </defs>
    
    <!-- Background -->
    <rect width="{width}" height="{height}" fill="#f5f5f5"/>
    
    <!-- Window frame -->
    <rect x="20" y="20" width="{width-40}" height="{height-40}" 
          fill="white" stroke="#333" stroke-width="2" rx="8"/>
    
    <!-- Header -->
    <rect x="20" y="20" width="{width-40}" height="50" fill="#4472C4" rx="8"/>
    <rect x="20" y="50" width="{width-40}" height="20" fill="#4472C4"/>
    <text x="40" y="52" class="title">{title}</text>
    
    <!-- Navigation items -->
    <rect x="500" y="35" width="60" height="25" fill="rgba(255,255,255,0.2)" rx="4"/>
    <text x="515" y="52" class="small" fill="white">Home</text>
    <rect x="570" y="35" width="80" height="25" fill="rgba(255,255,255,0.2)" rx="4"/>
    <text x="580" y="52" class="small" fill="white">Documents</text>
    <rect x="660" y="35" width="70" height="25" fill="rgba(255,255,255,0.2)" rx="4"/>
    <text x="675" y="52" class="small" fill="white">Settings</text>
    
    <!-- Sidebar -->
    <rect x="20" y="70" width="150" height="{height-110}" fill="#f0f0f0"/>
    <line x1="170" y1="70" x2="170" y2="{height-40}" stroke="#ddd"/>
    
    <!-- Sidebar items -->
    <rect x="30" y="85" width="130" height="30" fill="#4472C4" rx="4"/>
    <text x="45" y="105" class="small" fill="white">📊 Dashboard</text>
    <rect x="30" y="125" width="130" height="30" fill="white" stroke="#ddd" rx="4"/>
    <text x="45" y="145" class="small">📄 Documents</text>
    <rect x="30" y="165" width="130" height="30" fill="white" stroke="#ddd" rx="4"/>
    <text x="45" y="185" class="small">👥 Accounts</text>
    <rect x="30" y="205" width="130" height="30" fill="white" stroke="#ddd" rx="4"/>
    <text x="45" y="225" class="small">📋 Reports</text>
    
    <!-- Main content area -->
    <!-- Stats cards -->
    <rect x="190" y="85" width="180" height="80" fill="white" stroke="#ddd" rx="8"/>
    <text x="250" y="125" class="label" text-anchor="middle">12,456</text>
    <text x="250" y="145" class="small" text-anchor="middle">Total Documents</text>
    
    <rect x="385" y="85" width="180" height="80" fill="white" stroke="#ddd" rx="8"/>
    <text x="475" y="125" class="label" text-anchor="middle">342</text>
    <text x="475" y="145" class="small" text-anchor="middle">Pending Review</text>
    
    <rect x="580" y="85" width="180" height="80" fill="white" stroke="#ddd" rx="8"/>
    <text x="670" y="125" class="label" text-anchor="middle">28</text>
    <text x="670" y="145" class="small" text-anchor="middle">New Today</text>
    
    <!-- Content placeholder -->
    <rect x="190" y="180" width="570" height="350" fill="white" stroke="#ddd" rx="8"/>
    <text x="200" y="205" class="label">Recent Documents</text>
    <line x1="190" y1="220" x2="760" y2="220" stroke="#eee"/>
    
    <!-- Table header -->
    <rect x="200" y="235" width="550" height="25" fill="#f5f5f5"/>
    <text x="210" y="252" class="small">Document</text>
    <text x="380" y="252" class="small">Account</text>
    <text x="500" y="252" class="small">Date</text>
    <text x="620" y="252" class="small">Status</text>
    
    <!-- Table rows (placeholders) -->
    <rect x="210" y="270" width="150" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="380" y="270" width="80" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="500" y="270" width="70" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="620" y="270" width="50" height="12" fill="#e0e0e0" rx="2"/>
    
    <rect x="210" y="295" width="140" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="380" y="295" width="85" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="500" y="295" width="70" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="620" y="295" width="60" height="12" fill="#e0e0e0" rx="2"/>
    
    <rect x="210" y="320" width="160" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="380" y="320" width="75" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="500" y="320" width="70" height="12" fill="#e0e0e0" rx="2"/>
    <rect x="620" y="320" width="55" height="12" fill="#e0e0e0" rx="2"/>
    
</svg>'''
    
    # Save SVG
    with open(f"{filename}.svg", 'w') as f:
        f.write(svg)
    
    # Convert to PNG if cairosvg is available
    try:
        import cairosvg
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f"{filename}.png")
        print(f"Generated: {filename}.png")
    except ImportError:
        print(f"Generated: {filename}.svg (install cairosvg for PNG: pip install cairosvg)")

create_svg_wireframe("Dashboard", 800, 600, "dashboard-svg")
```

## Converting ASCII Wireframes

When you see ASCII mockups like:
```
┌────────────────────────────────────────────────────────────┐
│  Document Management System          [Home] [Docs] [⚙️]   │
├──────────┬─────────────────────────────────────────────────┤
│ Dashboard│  📊 Statistics                                  │
│ Documents│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│ Accounts │  │  12,456 │ │    342  │ │     28  │           │
│ Reports  │  │  Total  │ │ Pending │ │   New   │           │
│          │  └─────────┘ └─────────┘ └─────────┘           │
│          │                                                 │
│          │  Recent Documents                               │
│          │  ┌──────────────────────────────────────────┐  │
│          │  │ Document    │ Account │ Date   │ Status  │  │
│          │  │─────────────│─────────│────────│─────────│  │
│          │  │ Form 001    │ ACC-123 │ Jan 15 │ Pending │  │
│          │  │ Letter 002  │ ACC-124 │ Jan 14 │ Done    │  │
│          │  └──────────────────────────────────────────┘  │
└──────────┴─────────────────────────────────────────────────┘
```

Extract:
1. **Header** - Title, navigation items
2. **Sidebar** - Menu items, active state
3. **Main content** - Cards, stats, tables
4. **Layout** - Column widths, spacing
5. **Components** - Buttons, inputs, tables, cards
