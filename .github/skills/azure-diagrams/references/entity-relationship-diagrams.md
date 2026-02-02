# Entity Relationship Diagrams (ERD)

Generate professional database entity relationship diagrams showing tables, columns, and relationships.

## Approach 1: Graphviz Direct (Recommended for ERDs)

Graphviz provides the most control for ERD layouts.

```python
import graphviz

def create_erd(title, filename):
    """Create an ERD diagram using Graphviz."""
    dot = graphviz.Digraph(title, filename=filename, format='png')
    dot.attr(rankdir='LR', splines='spline', nodesep='0.8', ranksep='1.2')
    dot.attr('node', shape='none', margin='0')
    
    # Helper function to create table HTML
    def table_node(name, columns):
        """
        columns: list of tuples (column_name, data_type, key_type)
        key_type: 'PK', 'FK', or None
        """
        html = f'''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4">
        <TR><TD BGCOLOR="#4472C4" COLSPAN="3"><FONT COLOR="white"><B>{name}</B></FONT></TD></TR>'''
        
        for col_name, data_type, key_type in columns:
            key_indicator = ""
            if key_type == 'PK':
                key_indicator = '🔑 '
            elif key_type == 'FK':
                key_indicator = '🔗 '
            
            html += f'''<TR>
                <TD ALIGN="LEFT">{key_indicator}{col_name}</TD>
                <TD ALIGN="LEFT"><FONT COLOR="gray">{data_type}</FONT></TD>
            </TR>'''
        
        html += '</TABLE>>'
        return html
    
    # Define tables
    dot.node('Documents', table_node('Documents', [
        ('DocumentId', 'INT', 'PK'),
        ('AccountId', 'INT', 'FK'),
        ('Title', 'VARCHAR(255)', None),
        ('Content', 'TEXT', None),
        ('CreatedDate', 'DATETIME', None),
        ('CreatedBy', 'INT', 'FK'),
    ]))
    
    dot.node('Accounts', table_node('Accounts', [
        ('AccountId', 'INT', 'PK'),
        ('AccountName', 'VARCHAR(100)', None),
        ('AccountType', 'VARCHAR(50)', None),
        ('Status', 'VARCHAR(20)', None),
    ]))
    
    dot.node('Users', table_node('Users', [
        ('UserId', 'INT', 'PK'),
        ('Username', 'VARCHAR(50)', None),
        ('Email', 'VARCHAR(100)', None),
        ('RoleId', 'INT', 'FK'),
    ]))
    
    dot.node('Roles', table_node('Roles', [
        ('RoleId', 'INT', 'PK'),
        ('RoleName', 'VARCHAR(50)', None),
        ('Permissions', 'TEXT', None),
    ]))
    
    # Define relationships
    # Crow's foot notation using edge labels
    dot.edge('Documents', 'Accounts', label='N:1', arrowhead='crow', arrowtail='tee')
    dot.edge('Documents', 'Users', label='N:1', arrowhead='crow', arrowtail='tee')
    dot.edge('Users', 'Roles', label='N:1', arrowhead='crow', arrowtail='tee')
    
    dot.render(cleanup=True)
    return f"{filename}.png"
```

## Approach 2: Using diagrams Library

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.generic.database import SQL
from diagrams.onprem.database import PostgreSQL, MySQL

with Diagram("Database Schema", show=False, filename="erd-simple", direction="LR"):
    
    with Cluster("Core Entities"):
        documents = PostgreSQL("Documents")
        accounts = PostgreSQL("Accounts")
        users = PostgreSQL("Users")
    
    with Cluster("Reference Data"):
        roles = PostgreSQL("Roles")
        permissions = PostgreSQL("Permissions")
    
    with Cluster("Audit"):
        audit_log = PostgreSQL("AuditLog")
    
    # Relationships
    documents >> Edge(label="belongs to") >> accounts
    documents >> Edge(label="created by") >> users
    users >> Edge(label="has") >> roles
    roles >> Edge(label="grants") >> permissions
    [documents, accounts, users] >> Edge(style="dashed") >> audit_log
```

## Approach 3: Mermaid ERD

```python
def generate_mermaid_erd(entities):
    """Generate Mermaid ERD syntax."""
    mermaid = "erDiagram\n"
    
    for entity in entities:
        name = entity['name']
        mermaid += f"    {name} {{\n"
        for col in entity['columns']:
            mermaid += f"        {col['type']} {col['name']}"
            if col.get('pk'):
                mermaid += " PK"
            if col.get('fk'):
                mermaid += " FK"
            mermaid += "\n"
        mermaid += "    }\n"
    
    return mermaid

# Example
entities = [
    {
        'name': 'Documents',
        'columns': [
            {'name': 'DocumentId', 'type': 'int', 'pk': True},
            {'name': 'AccountId', 'type': 'int', 'fk': True},
            {'name': 'Title', 'type': 'string'},
        ]
    },
    {
        'name': 'Accounts',
        'columns': [
            {'name': 'AccountId', 'type': 'int', 'pk': True},
            {'name': 'Name', 'type': 'string'},
        ]
    }
]

# Relationships in Mermaid
relationships = """
    Documents }|--|| Accounts : "belongs to"
    Documents }|--|| Users : "created by"
    Users ||--o{ Roles : "has"
"""
```

## Relationship Notation

### Crow's Foot Notation
```
||--||  One to One
||--o{  One to Many (optional)
||--|{  One to Many (required)
}|--|{  Many to Many
```

### In Graphviz
```python
# One to Many
dot.edge('Parent', 'Child', arrowhead='crow', arrowtail='tee')

# One to One
dot.edge('TableA', 'TableB', arrowhead='tee', arrowtail='tee')

# Many to Many (via junction table)
dot.edge('TableA', 'Junction', arrowhead='crow', arrowtail='tee')
dot.edge('TableB', 'Junction', arrowhead='crow', arrowtail='tee')
```

## Complete ERD Example

```python
import graphviz

def create_full_erd(filename="database-erd"):
    dot = graphviz.Digraph('ERD', filename=filename, format='png')
    dot.attr(rankdir='TB', splines='spline')
    dot.attr('node', shape='none')
    
    def make_table(name, columns, color="#4472C4"):
        rows = "".join([
            f'<TR><TD ALIGN="LEFT" PORT="{c[0]}">{c[0]}</TD><TD ALIGN="LEFT"><FONT COLOR="gray">{c[1]}</FONT></TD></TR>'
            for c in columns
        ])
        return f'''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0">
            <TR><TD BGCOLOR="{color}" COLSPAN="2"><FONT COLOR="white"><B>{name}</B></FONT></TD></TR>
            {rows}
        </TABLE>>'''
    
    # Core entities
    dot.node('Documents', make_table('Documents', [
        ('DocumentId', 'INT PK'),
        ('AccountId', 'INT FK'),
        ('ProcessId', 'INT FK'),
        ('Title', 'NVARCHAR(255)'),
        ('Content', 'VARBINARY(MAX)'),
        ('MimeType', 'VARCHAR(100)'),
        ('CreatedDate', 'DATETIME2'),
        ('ModifiedDate', 'DATETIME2'),
        ('CreatedBy', 'INT FK'),
    ]))
    
    dot.node('Accounts', make_table('Accounts', [
        ('AccountId', 'INT PK'),
        ('AccountRef', 'VARCHAR(50)'),
        ('AccountName', 'NVARCHAR(200)'),
        ('ServiceAreaId', 'INT FK'),
        ('Status', 'VARCHAR(20)'),
    ], color="#548235"))
    
    dot.node('Processes', make_table('Processes', [
        ('ProcessId', 'INT PK'),
        ('ProcessName', 'NVARCHAR(100)'),
        ('Description', 'NVARCHAR(500)'),
        ('ServiceAreaId', 'INT FK'),
    ], color="#548235"))
    
    dot.node('Users', make_table('Users', [
        ('UserId', 'INT PK'),
        ('EntraId', 'UNIQUEIDENTIFIER'),
        ('DisplayName', 'NVARCHAR(200)'),
        ('Email', 'NVARCHAR(200)'),
    ], color="#BF9000"))
    
    dot.node('ServiceAreas', make_table('ServiceAreas', [
        ('ServiceAreaId', 'INT PK'),
        ('AreaName', 'NVARCHAR(100)'),
        ('AreaCode', 'VARCHAR(20)'),
    ], color="#7030A0"))
    
    # Relationships
    dot.edge('Documents:AccountId', 'Accounts:AccountId')
    dot.edge('Documents:ProcessId', 'Processes:ProcessId')
    dot.edge('Documents:CreatedBy', 'Users:UserId')
    dot.edge('Accounts:ServiceAreaId', 'ServiceAreas:ServiceAreaId')
    dot.edge('Processes:ServiceAreaId', 'ServiceAreas:ServiceAreaId')
    
    dot.render(cleanup=True)
    print(f"Generated: {filename}.png")

create_full_erd()
```

## Access Control Matrix

For access control matrices (not traditional ERDs):

```python
import graphviz

def create_access_matrix(filename="access-matrix"):
    dot = graphviz.Digraph('Access Matrix', filename=filename, format='png')
    dot.attr(rankdir='TB')
    dot.attr('node', shape='none')
    
    # Create matrix as HTML table
    matrix = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
        <TR>
            <TD BGCOLOR="#4472C4"><FONT COLOR="white"><B>Role / Entity</B></FONT></TD>
            <TD BGCOLOR="#4472C4"><FONT COLOR="white"><B>Documents</B></FONT></TD>
            <TD BGCOLOR="#4472C4"><FONT COLOR="white"><B>Accounts</B></FONT></TD>
            <TD BGCOLOR="#4472C4"><FONT COLOR="white"><B>Users</B></FONT></TD>
            <TD BGCOLOR="#4472C4"><FONT COLOR="white"><B>Settings</B></FONT></TD>
        </TR>
        <TR>
            <TD><B>Admin</B></TD>
            <TD BGCOLOR="#C6EFCE">CRUD</TD>
            <TD BGCOLOR="#C6EFCE">CRUD</TD>
            <TD BGCOLOR="#C6EFCE">CRUD</TD>
            <TD BGCOLOR="#C6EFCE">CRUD</TD>
        </TR>
        <TR>
            <TD><B>Manager</B></TD>
            <TD BGCOLOR="#C6EFCE">CRUD</TD>
            <TD BGCOLOR="#FFEB9C">CRU</TD>
            <TD BGCOLOR="#FFC7CE">R</TD>
            <TD BGCOLOR="#FFC7CE">R</TD>
        </TR>
        <TR>
            <TD><B>User</B></TD>
            <TD BGCOLOR="#FFEB9C">CRU</TD>
            <TD BGCOLOR="#FFC7CE">R</TD>
            <TD BGCOLOR="#FFC7CE">-</TD>
            <TD BGCOLOR="#FFC7CE">-</TD>
        </TR>
        <TR>
            <TD><B>Guest</B></TD>
            <TD BGCOLOR="#FFC7CE">R</TD>
            <TD BGCOLOR="#FFC7CE">-</TD>
            <TD BGCOLOR="#FFC7CE">-</TD>
            <TD BGCOLOR="#FFC7CE">-</TD>
        </TR>
    </TABLE>>'''
    
    dot.node('matrix', matrix)
    dot.render(cleanup=True)
    print(f"Generated: {filename}.png")

create_access_matrix()
```

## Converting ASCII ERDs

When you see ASCII like:
```
┌─────────────┐       ┌─────────────┐
│  Documents  │       │  Accounts   │
├─────────────┤       ├─────────────┤
│ DocumentId  │──────►│ AccountId   │
│ AccountId   │       │ AccountName │
│ Title       │       │ Status      │
└─────────────┘       └─────────────┘
```

Extract:
1. Table names (headers)
2. Column names (rows in boxes)
3. Relationships (arrows between boxes)
4. Cardinality (if shown with crow's feet or notation)
