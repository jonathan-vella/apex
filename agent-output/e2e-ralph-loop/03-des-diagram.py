"""Nordic Fresh Foods Lite — proposed Azure architecture diagram.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    /workspaces/azure-agentic-infraops/.venv/bin/python agent-output/e2e-ralph-loop/03-des-diagram.py

Output:
    agent-output/e2e-ralph-loop/03-des-diagram.png
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLDatabases
from diagrams.azure.identity import ActiveDirectory, ManagedIdentities
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import StorageAccounts
from diagrams.onprem.client import Users

OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = OUTPUT_DIR / "03-des-diagram"

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "0.9",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
    "label": "Nordic Fresh Foods Lite\nswedencentral | Single prod env | Cost-optimized Azure MVP",
    "labelloc": "t",
    "labeljust": "c",
}

node_attr = {
    "fontname": "Arial Bold",
    "fontsize": "11",
    "labelloc": "t",
}

edge_attr = {
    "fontname": "Arial",
    "fontsize": "9",
}

cluster_style = {
    "margin": "30",
    "fontname": "Arial Bold",
    "fontsize": "14",
}

EDGE_AUTH = {"style": "bold", "color": "#0078D4", "penwidth": "2.0"}
EDGE_DATA = {"style": "solid", "color": "#333333", "penwidth": "1.5"}
EDGE_SECRET = {"style": "dashed", "color": "#C00000", "penwidth": "1.5"}
EDGE_TELEMETRY = {"style": "dotted", "color": "#8764B8", "penwidth": "1.5"}

with Diagram(
    "",
    show=False,
    filename=str(OUTPUT_FILE),
    outformat="png",
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    n_edge_users = Users("Customers\nAdmins")

    with Cluster("Identity & Access", graph_attr={**cluster_style, "bgcolor": "#E8F0FE", "style": "rounded"}):
        n_id_entra = ActiveDirectory("Microsoft Entra ID\nCustomer + Admin auth")
        n_id_mi = ManagedIdentities("Managed Identity\nSystem-assigned")

    with Cluster(
        "Azure Subscription\nrg-e2e-ralph-loop-prod",
        graph_attr={**cluster_style, "bgcolor": "#F0F8FF", "style": "rounded"},
    ):
        with Cluster("Web Tier", graph_attr={**cluster_style, "bgcolor": "#E6F4EA", "style": "rounded"}):
            n_web_appservice = AppServices("App Service\nB1 Linux")

        with Cluster(
            "Secrets Management",
            graph_attr={**cluster_style, "bgcolor": "#FCE4EC", "style": "rounded"},
        ):
            n_sec_keyvault = KeyVaults("Key Vault\nStandard")

        with Cluster(
            "Data Tier\nswedencentral | GDPR data residency",
            graph_attr={**cluster_style, "bgcolor": "#FFF9C4", "style": "rounded"},
        ):
            n_data_sql = SQLDatabases("Azure SQL Database\nBasic 5 DTU")
            n_data_storage = StorageAccounts("Storage Account\nStandard LRS Hot")

        with Cluster("Observability", graph_attr={**cluster_style, "bgcolor": "#F3E8FD", "style": "rounded"}):
            n_ops_appinsights = ApplicationInsights("Application Insights\nWorkspace-based")
            n_ops_loganalytics = LogAnalyticsWorkspaces("Log Analytics\n5 GB free tier")

    n_edge_users >> Edge(label="HTTPS", **EDGE_AUTH) >> n_id_entra
    n_id_entra >> Edge(label="OIDC token", **EDGE_AUTH) >> n_web_appservice

    n_web_appservice >> Edge(label="MI auth", **EDGE_AUTH) >> n_id_mi
    n_web_appservice >> Edge(label="Secrets via MI", **EDGE_SECRET) >> n_sec_keyvault

    n_web_appservice >> Edge(label="Orders + catalog\nAzure AD-only auth", **EDGE_DATA) >> n_data_sql
    n_web_appservice >> Edge(label="Images + files\nHTTPS-only", **EDGE_DATA) >> n_data_storage

    n_web_appservice >> Edge(label="Telemetry", **EDGE_TELEMETRY) >> n_ops_appinsights
    n_ops_appinsights >> Edge(label="Logs", **EDGE_TELEMETRY) >> n_ops_loganalytics

print(f"Diagram saved to: {OUTPUT_FILE}.png")
