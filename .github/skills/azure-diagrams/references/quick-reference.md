# Quick Reference Card

Copy-paste snippets for rapid diagram creation.

## Minimal Setup

```python
from diagrams import Diagram, Cluster, Edge

with Diagram("Title", show=False, filename="output", direction="LR"):
    # components here
    pass
```

## Common Imports - Integration Services

```python
# Integration
from diagrams.azure.integration import (
    LogicApps, ServiceBus, APIManagement, EventGridTopics,
    DataFactories, IntegrationAccounts, AppConfiguration
)

# Compute
from diagrams.azure.compute import FunctionApps, AppServices, ContainerApps, AKS

# Storage
from diagrams.azure.storage import BlobStorage, DataLakeStorage, StorageAccounts, QueuesStorage

# Database
from diagrams.azure.database import CosmosDb, SQL, CacheForRedis

# Security
from diagrams.azure.security import KeyVaults

# Networking
from diagrams.azure.networking import (
    ApplicationGateways, FrontDoorAndCDNProfiles, VirtualNetworks,
    OnPremisesDataGateways, PrivateLink, Firewalls
)

# Monitoring
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces

# Analytics
from diagrams.azure.analytics import EventHubs, StreamAnalyticsJobs, AzureSynapseAnalytics, AzureDatabricks

# Identity
from diagrams.azure.identity import ActiveDirectory, ManagedIdentities

# On-Premises
from diagrams.onprem.client import Users, Client
from diagrams.onprem.database import MSSQL, Oracle
from diagrams.onprem.compute import Server

# Generic (for unsupported services)
from diagrams.generic.compute import Rack
from diagrams.generic.database import SQL as GenericSQL
```

## Connection Syntax

```python
# Simple flow
a >> b >> c

# Fan-out (one to many)
a >> [b, c, d]

# Fan-in (many to one)
[a, b, c] >> d

# Labeled edge
a >> Edge(label="HTTPS") >> b

# Styled edge
a >> Edge(style="dashed", color="blue") >> b

# Common edge styles
a >> Edge(style="dashed") >> b   # Dashed (secrets, config)
a >> Edge(style="dotted") >> b   # Dotted (monitoring, logs)
a >> Edge(label="async") >> b    # Labeled
```

## Cluster Patterns

```python
# Simple cluster
with Cluster("Group Name"):
    a = ServiceA("A")
    b = ServiceB("B")

# Nested clusters
with Cluster("Outer"):
    with Cluster("Inner"):
        a = Service("A")

# Multiple clusters
with Cluster("Layer 1"):
    a = ServiceA("A")

with Cluster("Layer 2"):
    b = ServiceB("B")

a >> b  # Connect across clusters
```

## Diagram Configuration Options

```python
with Diagram(
    "Title",
    show=False,                    # Don't open in viewer
    filename="my-diagram",         # Output filename (no extension)
    outformat="png",               # png, svg, pdf, jpg
    direction="LR",                # LR, RL, TB, BT
    graph_attr={
        "fontsize": "20",
        "bgcolor": "white",
        "pad": "0.5",
        "splines": "spline",       # spline, ortho, curved, polyline
        "nodesep": "0.8",          # Horizontal spacing
        "ranksep": "1.0",          # Vertical spacing
    }
):
```

## Direction Guide

| Direction | Use Case |
|-----------|----------|
| `LR` | Workflows, data flows, pipelines |
| `TB` | Layered architectures, hierarchy |
| `RL` | Right-to-left flows |
| `BT` | Bottom-up hierarchy |

## Quick Patterns

### API Gateway Pattern
```python
users >> apim >> [logic, func] >> [cosmos, sql]
```

### Event-Driven Pattern
```python
source >> event_grid >> [handler1, handler2, handler3]
```

### Pub/Sub Pattern
```python
[producer1, producer2] >> service_bus >> [consumer1, consumer2]
```

### Hybrid Pattern
```python
on_prem >> data_gateway >> logic_apps >> azure_services
```

### Security Pattern
```python
component >> Edge(style="dashed") >> key_vault
component >> Edge(style="dotted") >> app_insights
```

## Output Formats

```python
# PNG (default, best for presentations)
filename="arch", outformat="png"

# SVG (scalable, best for web/docs)
filename="arch", outformat="svg"

# PDF (best for print)
filename="arch", outformat="pdf"
```

## Preventing Overlaps (Complex Diagrams)

```python
# Increase spacing for complex diagrams
dot.attr(
    nodesep='1.2',      # Horizontal (default 0.25)
    ranksep='1.2',      # Vertical (default 0.5)
    pad='0.5',
    splines='spline',
)

# Set explicit size on large nodes (cylinders, etc.)
dot.node('db', 'Database', shape='cylinder', width='2.5', height='1.2')

# Force nodes to same rank (horizontal alignment)
with dot.subgraph() as s:
    s.attr(rank='same')
    s.node('node1')
    s.node('node2')
```

## Component Naming Tips

```python
# Good: Clear, concise labels
apim = APIManagement("API Gateway")
logic = LogicApps("Order Processor")
bus = ServiceBus("Event Bus")

# With line breaks for detail
logic = LogicApps("Order Processing\nWorkflow")
ia = IntegrationAccounts("Integration Account\n(Maps, Schemas)")
```
