"""
Step 4 Runtime Flow Diagram — my-demo
Visualizes runtime request, telemetry, and CI/CD flows for the my-demo project.

Prerequisites:
    pip install diagrams
    apt-get install -y graphviz

Generate:
    python3 agent-output/my-demo/04-runtime-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.client import Users
from diagrams.onprem.vcs import Github

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.0",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
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
    "my-demo — Runtime Flow",
    filename="agent-output/my-demo/04-runtime-diagram",
    direction="LR",
    show=False,
    outformat="png",
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    from diagrams.azure.web import AppServices
    from diagrams.azure.compute import FunctionApps
    from diagrams.azure.devops import ApplicationInsights
    from diagrams.azure.analytics import LogAnalyticsWorkspaces

    # External actors
    n_edge_users = Users("Demo Viewers")
    n_ext_github = Github("GitHub\nCI/CD")

    # Azure resources
    with Cluster("Azure (westeurope) — rg-my-demo-dev", graph_attr={**cluster_style, "bgcolor": "#E8F4FD", "style": "rounded"}):

        with Cluster("Application Tier", graph_attr={**cluster_style, "bgcolor": "#F0FFF0"}):
            n_web_swa = AppServices("stapp-my-demo-dev\nStandard SKU")
            n_app_func = FunctionApps("Managed Functions\nConsumption")

        with Cluster("Observability Tier", graph_attr={**cluster_style, "bgcolor": "#FFF8E1"}):
            n_ops_appi = ApplicationInsights("appi-my-demo-dev\nFree 5 GB/mo")
            n_ops_law = LogAnalyticsWorkspaces("log-my-demo-dev\n30-day retention")

    # Runtime request flow (solid blue)
    n_edge_users >> Edge(label="HTTPS", color="#0078D4", style="bold") >> n_web_swa
    n_web_swa >> Edge(label="API calls", color="#0078D4", style="bold") >> n_app_func

    # CI/CD flow (dashed green)
    n_ext_github >> Edge(label="deploy", color="#28A745", style="dashed") >> n_web_swa

    # Telemetry flow (dotted orange)
    n_web_swa >> Edge(label="telemetry", color="#FF8C00", style="dotted") >> n_ops_appi
    n_app_func >> Edge(label="telemetry", color="#FF8C00", style="dotted") >> n_ops_appi
    n_ops_appi >> Edge(label="store", color="#FF8C00", style="dotted") >> n_ops_law
