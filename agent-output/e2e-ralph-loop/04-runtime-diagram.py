"""
E2E RALPH Loop — Runtime Flow Diagram (Step 4)
Visualizes runtime request and data flows for the simplified web application.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    python3 agent-output/e2e-ralph-loop/04-runtime-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLServers
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.monitor import ApplicationInsights
from diagrams.onprem.client import Users
import os

output_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(output_dir, "04-runtime-diagram")

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.2",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
    "label": "E2E RALPH Loop — Runtime Flow",
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
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    users = Users("Customers &\nAdmins")

    with Cluster("Azure — swedencentral", graph_attr={**cluster_style, "bgcolor": "#E3F2FD", "style": "rounded"}):
        app = AppServices("App Service\napp-e2e-ralph-loop-prod")
        sql = SQLServers("Azure SQL\nsqldb-e2e-ralph-loop-prod")
        storage = StorageAccounts("Storage\nste2eprodabc")
        appi = ApplicationInsights("App Insights\nappi-e2e-ralph-loop-prod")

    # Runtime flows
    users >> Edge(label="HTTPS", color="darkgreen") >> app
    app >> Edge(label="SQL query", color="blue") >> sql
    app >> Edge(label="Blob read/write", color="orange") >> storage
    app >> Edge(label="Telemetry", style="dotted", color="purple") >> appi
