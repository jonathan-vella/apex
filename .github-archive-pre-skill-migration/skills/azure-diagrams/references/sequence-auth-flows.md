# Sequence and Authentication Flow Diagrams

Guide for creating clean authentication flows, sequence diagrams, and numbered step flows.

## The Problem with Numbered Edge Labels

When you have a flow like:
1. Redirect → 2. Login → 3. Token → 4. Access → 5. Validate

Graphviz often struggles to place numbered labels correctly, resulting in floating labels.

## Solution 1: Use Nodes for Steps (Recommended)

Instead of labeling edges, make the steps into nodes:

```python
from graphviz import Digraph

dot = Digraph('Auth Flow', format='png')
dot.attr(rankdir='LR', splines='spline', nodesep='1.0', ranksep='0.8', pad='0.3')
dot.attr('node', fontname='Segoe UI', fontsize='10')
dot.attr('edge', fontname='Segoe UI', fontsize='9')

# Actor nodes (rounded boxes)
dot.node('user', 'User\nBrowser', shape='box', style='rounded,filled', fillcolor='#4CAF50', fontcolor='white')
dot.node('app', 'PlymDocs\nApplication', shape='box', style='rounded,filled', fillcolor='#4CAF50', fontcolor='white')
dot.node('entra', 'Microsoft\nEntra ID', shape='box', style='rounded,filled', fillcolor='#2196F3', fontcolor='white')

# Step labels as small nodes
dot.node('s1', '1. Redirect', shape='plaintext', fontsize='9')
dot.node('s2', '2. Login\n(MFA if req.)', shape='plaintext', fontsize='9')
dot.node('s3', '3. Token', shape='plaintext', fontsize='9')
dot.node('s4', '4. Access', shape='plaintext', fontsize='9')
dot.node('s5', '5. Validate', shape='plaintext', fontsize='9')

# Flow with step nodes inline
dot.edge('user', 'app', style='invis')  # Spacing
dot.edge('app', 's1', arrowhead='none')
dot.edge('s1', 'entra')

dot.edge('entra', 's2', arrowhead='none')
dot.edge('s2', 'user', style='dashed')

dot.edge('user', 's3', arrowhead='none')
dot.edge('s3', 'entra', style='dashed')

dot.edge('entra', 's4', arrowhead='none')
dot.edge('s4', 'app')

dot.edge('app', 's5', arrowhead='none', style='dashed')
dot.edge('s5', 'entra', style='dashed')

dot.render('auth-flow-clean', cleanup=True)
```

## Solution 2: Use xlabel (External Labels)

External labels are placed outside the edge, reducing overlap:

```python
dot.edge('user', 'app', xlabel='1. Access')
dot.edge('app', 'entra', xlabel='2. Redirect')
dot.edge('entra', 'user', xlabel='3. Login')
```

## Solution 3: Use headlabel/taillabel

Position labels at the head or tail of edges:

```python
dot.edge('user', 'app', taillabel='Request', headlabel='Response')
```

## Solution 4: Table-Style Legend

Put the numbered steps in a separate legend box:

```python
from graphviz import Digraph

dot = Digraph('Auth Flow')
dot.attr(rankdir='LR', pad='0.3')

# Legend as HTML table
legend = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5">
    <TR><TD COLSPAN="2" BGCOLOR="#FFF8E1"><B>Authentication Flow</B></TD></TR>
    <TR><TD>1.</TD><TD ALIGN="LEFT">User accesses PlymDocs</TD></TR>
    <TR><TD>2.</TD><TD ALIGN="LEFT">Redirect to Entra ID</TD></TR>
    <TR><TD>3.</TD><TD ALIGN="LEFT">User logs in (MFA)</TD></TR>
    <TR><TD>4.</TD><TD ALIGN="LEFT">Token returned</TD></TR>
    <TR><TD>5.</TD><TD ALIGN="LEFT">App validates token</TD></TR>
</TABLE>>'''

dot.node('legend', legend, shape='none')

# Simple flow without labels
dot.node('user', 'User Browser', shape='box', style='rounded,filled', fillcolor='#4CAF50', fontcolor='white')
dot.node('app', 'PlymDocs', shape='box', style='rounded,filled', fillcolor='#4CAF50', fontcolor='white')
dot.node('entra', 'Entra ID', shape='box', style='rounded,filled', fillcolor='#2196F3', fontcolor='white')

dot.edge('user', 'app')
dot.edge('app', 'entra')
dot.edge('entra', 'user', style='dashed')
dot.edge('user', 'app')
dot.edge('app', 'entra', style='dashed')

dot.render('auth-flow-legend', cleanup=True)
```

## OIDC Authentication Flow (Complete Example)

```python
from graphviz import Digraph

def create_auth_flow(filename='auth-flow'):
    dot = Digraph('Authentication Flow', format='png')
    dot.attr(
        rankdir='LR',
        bgcolor='white',
        pad='0.3',
        margin='0',
        nodesep='1.5',
        ranksep='1.0',
        splines='spline'
    )
    dot.attr('node', fontname='Segoe UI', fontsize='11')
    dot.attr('edge', fontname='Segoe UI', fontsize='9')
    
    # Config box
    config = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="8" BGCOLOR="#FFF8E1">
        <TR><TD><B>Authentication Methods</B></TD></TR>
        <TR><TD ALIGN="LEFT">User login: Entra ID SSO (OIDC)</TD></TR>
        <TR><TD ALIGN="LEFT">API access: Entra ID Bearer tokens</TD></TR>
        <TR><TD ALIGN="LEFT">Service-to-service: Managed Identity</TD></TR>
        <TR><TD ALIGN="LEFT">Function triggers: Managed Identity</TD></TR>
    </TABLE>>'''
    dot.node('config', config, shape='none')
    
    # Actors
    dot.node('user', 'User\nBrowser', shape='box', style='rounded,filled', 
             fillcolor='#4CAF50', fontcolor='white', width='1.5')
    dot.node('app', 'PlymDocs\nApplication', shape='box', style='rounded,filled',
             fillcolor='#4CAF50', fontcolor='white', width='1.5')
    dot.node('entra', 'Microsoft\nEntra ID', shape='box', style='rounded,filled',
             fillcolor='#2196F3', fontcolor='white', width='1.5')
    
    # Force horizontal arrangement
    with dot.subgraph() as s:
        s.attr(rank='same')
        s.node('user')
        s.node('app')
        s.node('entra')
    
    # Edges with external labels
    dot.edge('user', 'app', xlabel='4. Access', color='#4CAF50')
    dot.edge('app', 'entra', xlabel='1. Redirect', color='#2196F3')
    dot.edge('entra', 'user', xlabel='2. Login\n(MFA if req.)', style='dashed', color='#2196F3')
    dot.edge('user', 'entra', xlabel='3. Token', style='dashed', color='#4CAF50', constraint='false')
    dot.edge('app', 'entra', xlabel='5. Validate', style='dashed', color='#9E9E9E', constraint='false')
    
    dot.render(filename, cleanup=True)
    print(f"Generated: {filename}.png")

create_auth_flow()
```

## Environment Promotion Flow

For Dev → Test → UAT → Prod flows, avoid duplicate "Deployment Pipeline" labels:

```python
from graphviz import Digraph

dot = Digraph('Environment Topology', format='png')
dot.attr(rankdir='TB', nodesep='0.8', ranksep='1.0', pad='0.3')

# Environments as clusters
envs = [
    ('dev', 'DEVELOPMENT', '#E1BEE7', '#9C27B0', ['Developer sandboxes', 'Feature branches', 'Synthetic test data']),
    ('test', 'TEST', '#FFE0B2', '#FF9800', ['Automated testing', 'Integration testing', 'Anonymised data']),
    ('uat', 'UAT', '#BBDEFB', '#2196F3', ['Production-like config', 'User acceptance', 'Performance testing']),
    ('prod', 'PRODUCTION', '#C8E6C9', '#4CAF50', ['Full HA config', 'Geo-redundant', 'Auto-scaling']),
]

for env_id, name, fill, border, items in envs:
    with dot.subgraph(name=f'cluster_{env_id}') as c:
        c.attr(label=name, style='filled,rounded', fillcolor=fill, color=border, fontcolor=border)
        for i, item in enumerate(items):
            c.node(f'{env_id}_{i}', item, shape='box', style='rounded,filled', fillcolor='white')

# Single deployment pipeline reference (not repeated!)
dot.node('pipeline', 'Deployment\nPipeline', shape='box', style='filled', fillcolor='#FFF8E1', color='#FFC107')

# Promotion edges
dot.edge('dev_0', 'test_0', label='Deploy')
dot.edge('test_0', 'uat_0', label='Promote')
dot.edge('uat_0', 'prod_0', label='Release')

# Pipeline connections (optional)
dot.edge('pipeline', 'dev_0', style='dashed', constraint='false')
dot.edge('pipeline', 'test_0', style='dashed', constraint='false')
dot.edge('pipeline', 'uat_0', style='dashed', constraint='false')
dot.edge('pipeline', 'prod_0', style='dashed', constraint='false')

dot.render('env-topology', cleanup=True)
```

## Key Takeaways

1. **Avoid edge labels for numbered sequences** - use plaintext nodes or xlabel
2. **Use `constraint='false'`** on back-edges to prevent layout distortion
3. **Group actors with `rank='same'`** for horizontal alignment
4. **Put metadata in a legend box** instead of crowding the diagram
5. **Set `pad='0.3'` and `margin='0'`** to reduce whitespace
