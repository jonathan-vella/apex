"""
E2E RALPH Loop — Dependency Diagram (Step 4)
Visualizes resource dependencies for the simplified Bicep deployment.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    python3 agent-output/e2e-ralph-loop/04-dependency-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.web import AppServicePlans
from diagrams.azure.database import SQLServers, SQLDatabases
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.monitor import ApplicationInsights
from diagrams.azure.general import Subscriptions
import os

output_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(output_dir, "04-dependency-diagram")

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.0",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
    "label": "E2E RALPH Loop — Resource Dependencies",
    "labelloc": "t",
}

node_attr = {
    "fontname": "Arial Bold",
    "fontsize": "11",
    "labelloc": "t",
}

cluster_style = {
    "margin": "30",
    "fontname": "Arial Bold",
    "fontsize": "14",
}

with Diagram(
    "",
    filename=output_path,
    show=False,
    direction="TB",
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    with Cluster("Phase 1: Foundation", graph_attr={**cluster_style, "bgcolor": "#E8F5E9", "style": "rounded"}):
        rg = Subscriptions("Resource Group\nrg-e2e-ralph-loop-prod")
        log = ApplicationInsights("Log Analytics\nlog-e2e-ralph-loop-prod")
        appi = ApplicationInsights("App Insights\nappi-e2e-ralph-loop-prod")

    with Cluster("Phase 2: Data & Storage", graph_attr={**cluster_style, "bgcolor": "#E3F2FD", "style": "rounded"}):
        sql = SQLServers("SQL Server\nsql-e2e-ralph-loop-prod")
        sqldb = SQLDatabases("SQL Database\nsqldb-e2e-ralph-loop-prod")
        storage = StorageAccounts("Storage\nste2eprodabc")

    with Cluster("Phase 3: Compute", graph_attr={**cluster_style, "bgcolor": "#FFF3E0", "style": "rounded"}):
        asp = AppServicePlans("App Plan\nasp-e2e-ralph-loop-prod")
        app = AppServices("App Service\napp-e2e-ralph-loop-prod")

    # Dependencies
    rg >> Edge(style="dashed") >> log
    rg >> Edge(style="dashed") >> sql
    rg >> Edge(style="dashed") >> storage
    rg >> Edge(style="dashed") >> asp
    log >> Edge(label="workspace") >> appi
    sql >> Edge(label="contains") >> sqldb
    asp >> Edge(label="hosts") >> app
    appi >> Edge(label="monitors", style="dotted") >> app
