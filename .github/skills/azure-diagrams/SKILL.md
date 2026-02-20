---
name: azure-diagrams
description: "Generates professional Azure architecture diagrams and data-visualization charts (WAF pillar scores, cost distribution, cost projection). Produces Python `diagrams` + matplotlib artifacts (`.py` + `.png`) for Step 2 WAF charts, Step 3 design visuals, and Step 7 as-built documentation."
compatibility: Requires graphviz system package and Python diagrams library; works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool.
license: MIT
metadata:
  author: cmb211087
  version: "4.0"
  repository: https://github.com/mingrammer/diagrams
---

# Azure Architecture Diagrams Skill

A comprehensive technical diagramming toolkit for solutions architects, presales engineers,
and developers. Generate professional diagrams for proposals, documentation, and architecture
reviews using Python's `diagrams` library.

## 🎯 Output Format

**Default behavior**: Generate PNG images via Python code

| Format         | File Extension | Tool             | Use Case                             |
| -------------- | -------------- | ---------------- | ------------------------------------ |
| **Python PNG** | `.py` + `.png` | diagrams library | Programmatic, version-controlled, CI |
| **SVG**        | `.svg`         | diagrams library | Web documentation (optional)         |

### Output Naming Convention

```text
agent-output/{project}/
├── 03-des-diagram.py          # Python source (version controlled)
├── 03-des-diagram.png         # PNG from Python diagrams
└── 07-ab-diagram.py/.png      # As-built diagrams
```

## ⚡ Execution Method

**Always save diagram source to file first**, then execute it:

```bash
# Example (Design phase)
python3 agent-output/{project}/03-des-diagram.py

# Example (As-built phase)
python3 agent-output/{project}/07-ab-diagram.py
```

Required workflow:

- ✅ Generate and save `.py` source in `agent-output/{project}/`
- ✅ Execute saved script to produce `.png` (and optional `.svg`)
- ✅ Keep source version-controlled for deterministic regeneration
- ✅ Never use inline heredoc execution for diagram generation

## 📊 Architecture Diagram Contract (Mandatory)

For Azure workflow artifacts, generate **non-Mermaid** diagrams using Python `diagrams` only.

### Required outputs

- `03-des-diagram.py` + `03-des-diagram.png` (Step 3)
- `04-dependency-diagram.py` + `04-dependency-diagram.png` (Step 4)
- `04-runtime-diagram.py` + `04-runtime-diagram.png` (Step 4)
- `07-ab-diagram.py` + `07-ab-diagram.png` (Step 7, when requested)

### Required naming conventions

- Cluster vars: `clu_<scope>_<slug>` where scope ∈ `sub|rg|net|tier|zone|ext`
- Node vars: `n_<domain>_<service>_<role>` where domain ∈ `edge|web|app|data|id|sec|ops|int`
- Edge vars (if reused): `e_<source>_to_<target>_<flow>`
- Flow taxonomy only: `auth|request|response|read|write|event|replicate|secret|telemetry|admin`

### Required layout/style defaults

- `direction="LR"` unless explicitly justified
- deterministic spacing via `graph_attr` (`nodesep`, `ranksep`, `splines`)
- short labels (2–4 words)
- max 3 edge styles (runtime/control/observability)

### Quality gate (score /10)

1. Readable at 100% zoom
2. No major label overlap
3. Minimal line crossing
4. Clear tier grouping
5. Correct Azure icons
6. Security boundary visible
7. Data flow direction clear
8. Identity/auth flow visible
9. Telemetry path visible
10. Naming conventions followed

If score < 9/10, regenerate once with simplification.

## 🔥 Generate from Infrastructure Code

Create diagrams directly from Bicep, Terraform, or ARM templates:

```text
Read the Bicep files in /infra and generate an architecture diagram
```

```text
Analyze our Terraform modules and create a diagram grouped by subnet
```

See `references/iac-to-diagram.md` for detailed prompts and examples.

---

## Prerequisites

```bash
# Core requirements
pip install diagrams matplotlib pillow

# Graphviz (required for PNG generation)
apt-get install -y graphviz  # Ubuntu/Debian
# or: brew install graphviz  # macOS
# or: choco install graphviz  # Windows
```

## Quick Start

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import FunctionApps, KubernetesServices, AppServices
from diagrams.azure.network import ApplicationGateway, LoadBalancers
from diagrams.azure.database import CosmosDb, SQLDatabases, CacheForRedis
from diagrams.azure.storage import BlobStorage
from diagrams.azure.integration import LogicApps, ServiceBus, APIManagement
from diagrams.azure.security import KeyVaults
from diagrams.azure.identity import ActiveDirectory
from diagrams.azure.ml import CognitiveServices

with Diagram("Azure Solution Architecture", show=False, direction="TB"):
    users = ActiveDirectory("Users")

    with Cluster("Frontend"):
        gateway = ApplicationGateway("App Gateway")
        web = AppServices("Web App")

    with Cluster("Backend"):
        api = APIManagement("API Management")
        functions = FunctionApps("Functions")
        aks = KubernetesServices("AKS")

    with Cluster("Data"):
        cosmos = CosmosDb("Cosmos DB")
        sql = SQLDatabases("SQL Database")
        redis = CacheForRedis("Redis Cache")
        blob = BlobStorage("Blob Storage")

    with Cluster("Integration"):
        bus = ServiceBus("Service Bus")
        logic = LogicApps("Logic Apps")

    users >> gateway >> web >> api
    api >> [functions, aks]
    functions >> [cosmos, bus]
    aks >> [sql, redis]
    bus >> logic >> blob
```

## Azure Service Categories

| Category        | Import                       | Key Services                                                         |
| --------------- | ---------------------------- | -------------------------------------------------------------------- |
| **Compute**     | `diagrams.azure.compute`     | VM, AKS, Functions, App Service, Container Apps, Batch               |
| **Networking**  | `diagrams.azure.network`     | VNet, Load Balancer, App Gateway, Front Door, Firewall, ExpressRoute |
| **Database**    | `diagrams.azure.database`    | SQL, Cosmos DB, PostgreSQL, MySQL, Redis, Synapse                    |
| **Storage**     | `diagrams.azure.storage`     | Blob, Files, Data Lake, NetApp, Queue, Table                         |
| **Integration** | `diagrams.azure.integration` | Logic Apps, Service Bus, Event Grid, APIM, Data Factory              |
| **Security**    | `diagrams.azure.security`    | Key Vault, Sentinel, Defender, Security Center                       |
| **Identity**    | `diagrams.azure.identity`    | Entra ID, B2C, Managed Identity, Conditional Access                  |
| **AI/ML**       | `diagrams.azure.ml`          | Azure OpenAI, Cognitive Services, ML Workspace, Bot Service          |
| **Analytics**   | `diagrams.azure.analytics`   | Synapse, Databricks, Data Explorer, Stream Analytics, Event Hubs     |
| **IoT**         | `diagrams.azure.iot`         | IoT Hub, IoT Edge, Digital Twins, Time Series Insights               |
| **DevOps**      | `diagrams.azure.devops`      | Azure DevOps, Pipelines, Repos, Boards, Artifacts                    |
| **Web**         | `diagrams.azure.web`         | App Service, Static Web Apps, CDN, Media Services                    |
| **Monitor**     | `diagrams.azure.monitor`     | Monitor, App Insights, Log Analytics                                 |

See `references/azure-components.md` for the complete list of **700+ components**.

## Common Architecture Patterns

### Web Application (3-Tier)

```python
from diagrams.azure.network import ApplicationGateway
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLDatabases

gateway >> AppServices("Web") >> SQLDatabases("DB")
```

### Microservices with AKS

```python
from diagrams.azure.compute import KubernetesServices, ContainerRegistries
from diagrams.azure.network import ApplicationGateway
from diagrams.azure.database import CosmosDb

gateway >> KubernetesServices("Cluster") >> CosmosDb("Data")
ContainerRegistries("Registry") >> KubernetesServices("Cluster")
```

### Serverless / Event-Driven

```python
from diagrams.azure.compute import FunctionApps
from diagrams.azure.integration import EventGridTopics, ServiceBus
from diagrams.azure.storage import BlobStorage

EventGridTopics("Events") >> FunctionApps("Process") >> ServiceBus("Queue")
BlobStorage("Trigger") >> FunctionApps("Process")
```

### Data Platform

```python
from diagrams.azure.analytics import DataFactories, Databricks, SynapseAnalytics
from diagrams.azure.storage import DataLakeStorage

DataFactories("Ingest") >> DataLakeStorage("Lake") >> Databricks("Transform") >> SynapseAnalytics("Serve")
```

### Hub-Spoke Networking

```python
from diagrams.azure.network import VirtualNetworks, Firewall, VirtualNetworkGateways

with Cluster("Hub"):
    firewall = Firewall("Firewall")
    vpn = VirtualNetworkGateways("VPN")

with Cluster("Spoke 1"):
    spoke1 = VirtualNetworks("Workload 1")

spoke1 >> firewall
```

## Connection Syntax

```python
# Basic connections
a >> b                              # Simple arrow
a >> b >> c                         # Chain
a >> [b, c, d]                      # Fan-out (one to many)
[a, b] >> c                         # Fan-in (many to one)

# Labeled connections
a >> Edge(label="HTTPS") >> b       # With label
a >> Edge(label="443") >> b         # Port number

# Styled connections
a >> Edge(style="dashed") >> b      # Dashed line (config/secrets)
a >> Edge(style="dotted") >> b      # Dotted line
a >> Edge(color="red") >> b         # Colored
a >> Edge(color="red", style="bold") >> b  # Combined

# Bidirectional
a >> Edge(label="sync") << b        # Two-way
a - Edge(label="peer") - b          # Undirected
```

## Diagram Attributes

```python
with Diagram(
    "Title",
    show=False,                    # Don't auto-open
    filename="output",             # Output filename (no extension)
    direction="TB",                # TB, BT, LR, RL
    outformat="png",               # png, jpg, svg, pdf
    graph_attr={
        "splines": "spline",       # Curved edges
        "nodesep": "1.0",          # Horizontal spacing
        "ranksep": "1.0",          # Vertical spacing
        "pad": "0.5",              # Graph padding
        "bgcolor": "white",        # Background color
        "dpi": "150",              # Resolution
    }
):
```

## Clusters (Azure Hierarchy)

Use `Cluster()` for proper Azure hierarchy: Subscription → Resource Group → VNet → Subnet

```python
with Cluster("Azure Subscription"):
    with Cluster("rg-app-prod"):
        with Cluster("vnet-spoke (10.1.0.0/16)"):
            with Cluster("snet-app"):
                vm1 = VM("VM 1")
                vm2 = VM("VM 2")
            with Cluster("snet-data"):
                db = SQLDatabases("Database")
```

Cluster styling:

```python
with Cluster("Styled", graph_attr={"bgcolor": "#E8F4FD", "style": "rounded"}):
```

## ⚠️ Professional Output Standards

### The Key Setting: `labelloc='t'`

To keep labels inside cluster boundaries, **put labels ABOVE icons**:

```python
node_attr = {
    "fontname": "Arial Bold",
    "fontsize": "11",
    "labelloc": "t",  # KEY: Labels at TOP - stays inside clusters!
}

with Diagram("Title", node_attr=node_attr, ...):
    # Your diagram code
```

### Full Professional Template

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import KubernetesServices
from diagrams.azure.database import SQLDatabases

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "0.9",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
}

node_attr = {
    "fontname": "Arial Bold",
    "fontsize": "11",
    "labelloc": "t",           # Labels ABOVE icons - KEY!
}

cluster_style = {"margin": "30", "fontname": "Arial Bold", "fontsize": "14"}

with Diagram("My Architecture",
             direction="TB",
             graph_attr=graph_attr,
             node_attr=node_attr):

    with Cluster("Data Tier", graph_attr=cluster_style):
        sql = SQLDatabases("sql-myapp-prod\nS3 tier")
```

### Professional Standards Checklist

| Check                      | Requirement                              |
| -------------------------- | ---------------------------------------- |
| ✅ **labelloc='t'**        | Labels above icons (stays in clusters)   |
| ✅ **Bold fonts**          | `fontname="Arial Bold"` for readability  |
| ✅ **Full resource names** | Actual names from IaC, not abbreviations |
| ✅ **High DPI**            | `dpi="150"` or higher for crisp text     |
| ✅ **Azure icons**         | Use `diagrams.azure.*` components        |
| ✅ **Cluster margins**     | `margin="30"` or higher                  |
| ✅ **CIDR blocks**         | Include IP ranges in VNet/Subnet labels  |

## Troubleshooting

### Overlapping Nodes

Increase spacing for complex diagrams:

```python
graph_attr={
    "nodesep": "1.2",   # Horizontal (default 0.25)
    "ranksep": "1.2",   # Vertical (default 0.5)
    "pad": "0.5"
}
```

### Labels Outside Clusters

Use `labelloc="t"` in `node_attr` to place labels above icons.

### Missing Icons

Check available icons:

```python
from diagrams.azure import network
print(dir(network))
```

See `references/preventing-overlaps.md` for detailed guidance.

## Scripts

| Script                               | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `scripts/generate_diagram.py`        | Interactive pattern generator        |
| `scripts/multi_diagram_generator.py` | Multi-type diagram generator         |
| `scripts/ascii_to_diagram.py`        | Convert ASCII diagrams from markdown |
| `scripts/verify_installation.py`     | Check prerequisites                  |

## Reference Files

| File                                         | Content                                            |
| -------------------------------------------- | -------------------------------------------------- |
| `references/iac-to-diagram.md`               | **Generate diagrams from Bicep/Terraform/ARM**     |
| `references/azure-components.md`             | Complete list of 700+ Azure components             |
| `references/common-patterns.md`              | Ready-to-use architecture patterns                 |
| `references/business-process-flows.md`       | Workflow and swimlane diagrams                     |
| `references/entity-relationship-diagrams.md` | Database ERD patterns                              |
| `references/timeline-gantt-diagrams.md`      | Project timeline diagrams                          |
| `references/ui-wireframe-diagrams.md`        | UI mockup patterns                                 |
| `references/preventing-overlaps.md`          | Layout troubleshooting guide                       |
| `references/sequence-auth-flows.md`          | Authentication flow patterns                       |
| `references/quick-reference.md`              | Copy-paste code snippets                           |
| `references/waf-cost-charts.md`              | **WAF pillar bar, cost donut & projection charts** |

## Workflow Integration

This skill produces artifacts in **Step 3** (design) or **Step 7** (as-built).

| Workflow Step     | File Pattern                                                  | Description                                |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------ |
| Step 2            | `02-waf-scores.py`, `02-waf-scores.png`                       | WAF pillar score bar chart                 |
| Step 3 (Design)   | `03-des-diagram.py`, `03-des-diagram.png`                     | Proposed architecture visualization        |
| Step 3 (Design)   | `03-des-cost-distribution.py`, `03-des-cost-distribution.png` | Monthly cost distribution donut chart      |
| Step 3 (Design)   | `03-des-cost-projection.py`, `03-des-cost-projection.png`     | 6-month cost projection bar + trend chart  |
| Step 7 (As-Built) | `07-ab-diagram.py`, `07-ab-diagram.png`                       | Deployed architecture documentation        |
| Step 7 (As-Built) | `07-ab-cost-distribution.py`, `07-ab-cost-distribution.png`   | As-built cost distribution donut chart     |
| Step 7 (As-Built) | `07-ab-cost-projection.py`, `07-ab-cost-projection.png`       | As-built 6-month cost projection chart     |
| Step 7 (As-Built) | `07-ab-cost-comparison.py`, `07-ab-cost-comparison.png`       | Design estimate vs as-built grouped bars   |
| Step 7 (As-Built) | `07-ab-compliance-gaps.py`, `07-ab-compliance-gaps.png`       | Compliance gaps by severity horizontal bar |

### Artifact Suffix Convention

Apply the appropriate suffix based on when the diagram is generated:

- **`-des`**: Design diagrams (Step 3 artifacts)
  - Example: `03-des-diagram.py`, `03-des-diagram.png`
  - Represents: Proposed architecture, conceptual design
  - Called after: Architecture assessment (Step 2)

- **`-ab`**: As-built diagrams (Step 7 artifacts)
  - Example: `07-ab-diagram.py`, `07-ab-diagram.png`
  - Represents: Actual deployed infrastructure
  - Called after: Deployment (Step 6)

**Suffix Rules:**

1. Design/proposal/planning language → use `-des`
2. Deployed/implemented/current state language → use `-ab`

## 📊 Data Visualization Charts

Beyond architecture topology diagrams, this skill also generates **styled matplotlib
charts** for WAF pillar scores and cost estimates. These supplement (not replace)
the architecture diagrams.

### When to generate

| Trigger           | Chart(s) to generate                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| After WAF scoring | `02-waf-scores.png` — horizontal bar, one colour per pillar                               |
| After cost design | `03-des-cost-distribution.png` + `03-des-cost-projection.png`                             |
| After as-built    | `07-ab-cost-distribution.png` + `07-ab-cost-projection.png` + `07-ab-cost-comparison.png` |
| After compliance  | `07-ab-compliance-gaps.png` — gap counts grouped by severity                              |

### Design tokens (use consistently)

| Token         | Value     | Usage                      |
| ------------- | --------- | -------------------------- |
| Background    | `#F8F9FA` | Figure + axes fill         |
| Title colour  | `#1A1A2E` | Chart title                |
| Azure blue    | `#0078D4` | Primary bars               |
| Minimum line  | `#DC3545` | Red dashed WAF reference   |
| Target line   | `#28A745` | Green dashed WAF reference |
| Trend line    | `#FF8C00` | Orange dashed projection   |
| Grid / border | `#E0E0E0` | Subtle grid                |
| DPI           | 150       | Crisp PNG output           |

### WAF pillar colours

| Pillar                    | Hex colour |
| ------------------------- | ---------- |
| 🔒 Security               | `#C00000`  |
| 🔄 Reliability            | `#107C10`  |
| ⚡ Performance Efficiency | `#FF8C00`  |
| 💰 Cost Optimization      | `#FFB900`  |
| 🔧 Operational Excellence | `#8764B8`  |

See **`references/waf-cost-charts.md`** for full copy-paste Python implementations.

---

## Generation Workflow

Follow these steps when creating diagrams:

1. **Gather Context** - Read Bicep templates, deployment summary, or architecture assessment
2. **Identify Resources** - List all Azure resources to visualize
3. **Determine Hierarchy** - Map Subscription → RG → VNet → Subnet structure
4. **Generate Python Code** - Create diagram with proper clusters and edges
5. **Execute Script** - Run Python to generate PNG
6. **Verify Output** - Confirm PNG file was created successfully

## Guardrails

### DO

- ✅ Create diagram files in `agent-output/{project}/`
- ✅ Use step-prefixed filenames (`03-des-*` or `07-ab-*`)
- ✅ Use valid `diagrams.azure.*` imports only
- ✅ Include docstring with prerequisites and generation command
- ✅ Match diagram to actual architecture design/deployment
- ✅ Use `Cluster()` for Azure hierarchy (Subscription → RG → VNet → Subnet)
- ✅ Include CIDR blocks in VNet/Subnet labels
- ✅ **ALWAYS execute the Python script to generate the PNG file**
- ✅ Verify PNG file exists after generation
- ✅ Use `references/waf-cost-charts.md` patterns for WAF / cost charts
- ✅ Apply the design tokens table (background, dpi, colours) to every chart
- ✅ Generate `02-waf-scores.png` whenever WAF pillar scores are assigned

### DO NOT

- ❌ Use invalid or made-up diagram node types
- ❌ Create diagrams that don't match the actual architecture
- ❌ Skip the PNG generation step
- ❌ Overwrite existing diagrams without user consent
- ❌ Output to legacy `docs/diagrams/` folder (use `agent-output/` instead)
- ❌ Leave diagram in Python-only state without generating PNG
- ❌ Use placeholder or generic names instead of actual resource names
- ❌ Use Mermaid `xychart-beta` for WAF or cost charts (always use matplotlib PNGs)

## What This Skill Does NOT Do

- ❌ Generate Bicep or Terraform code (use `bicep-code` agent)
- ❌ Create workload documentation (use `azure-artifacts` skill)
- ❌ Deploy resources (use `deploy` agent)
- ❌ Create ADRs (use `azure-adr` skill)
- ❌ Perform WAF assessments (use `architect` agent)
- ❌ Build interactive dashboards or Power BI reports
- ❌ Render Mermaid diagrams (all chart outputs are Python-generated PNGs)
