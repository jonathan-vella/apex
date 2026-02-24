"""
Step 4 Dependency Diagram — my-demo
Visualizes Bicep module deployment dependencies for the my-demo project.

Prerequisites:
    pip install diagrams
    apt-get install -y graphviz

Generate:
    python3 agent-output/my-demo/04-dependency-diagram.py
"""

from diagrams import Diagram, Cluster, Edge

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
    "my-demo — Module Dependencies",
    filename="agent-output/my-demo/04-dependency-diagram",
    direction="LR",
    show=False,
    outformat="png",
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    from diagrams.azure.general import Resourcegroups
    from diagrams.azure.analytics import LogAnalyticsWorkspaces
    from diagrams.azure.devops import ApplicationInsights
    from diagrams.azure.web import AppServices

    # Phase 1: Foundation & Monitoring
    with Cluster("Phase 1: Foundation & Monitoring", graph_attr={**cluster_style, "bgcolor": "#E8F4FD", "style": "rounded"}):
        n_ops_rg = Resourcegroups("rg-my-demo-dev\n(Resource Group)")
        n_ops_law = LogAnalyticsWorkspaces("log-my-demo-dev\n(Log Analytics)")
        n_ops_appi = ApplicationInsights("appi-my-demo-dev\n(App Insights)")

    # Phase 2: Application
    with Cluster("Phase 2: Application", graph_attr={**cluster_style, "bgcolor": "#F0FFF0", "style": "rounded"}):
        n_web_swa = AppServices("stapp-my-demo-dev\n(Static Web App)")

    # Deployment dependency edges (control flow)
    n_ops_rg >> Edge(label="deploys", style="bold", color="#0078D4") >> n_ops_law
    n_ops_law >> Edge(label="workspace", style="bold", color="#0078D4") >> n_ops_appi
    n_ops_appi >> Edge(label="telemetry config", style="bold", color="#0078D4") >> n_web_swa
