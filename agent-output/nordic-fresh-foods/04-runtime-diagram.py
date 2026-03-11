"""
Nordic Fresh Foods — Runtime Flow Diagram (Step 4)
Visualizes runtime request and data flows for the FreshConnect MVP.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    python3 agent-output/nordic-fresh-foods/04-runtime-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLServers
from diagrams.azure.network import VirtualNetworks, PrivateEndpoint
from diagrams.azure.security import KeyVaults
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
    "label": "Nordic Fresh Foods — Runtime Flow",
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
    n_ext_users = Users("Buyers &\nFarmers")

    with Cluster("Azure (swedencentral)", graph_attr={**cluster_style, "bgcolor": "#E3F2FD", "style": "rounded"}):

        with Cluster("VNet: 10.0.0.0/16", graph_attr={**cluster_style, "bgcolor": "#E8F5E9", "style": "rounded"}):

            with Cluster("snet-app (10.0.1.0/24)", graph_attr={**cluster_style, "bgcolor": "#C8E6C9"}):
                n_web_app = AppServices("App Service\n(VNet integrated)\napp-nff-prod")

            with Cluster("snet-pe (10.0.3.0/24)", graph_attr={**cluster_style, "bgcolor": "#FFF9C4"}):
                n_pe_sql = PrivateEndpoint("PE: SQL")
                n_pe_blob = PrivateEndpoint("PE: Blob")

        with Cluster("Data Services", graph_attr={**cluster_style, "bgcolor": "#F3E5F5", "style": "rounded"}):
            n_data_sql = SQLServers("Azure SQL\nsql-nff-prod\n(AD-only auth)")
            n_data_st = StorageAccounts("Storage Account\nstnffprod\n(HTTPS-only)")

        with Cluster("Security & Observability", graph_attr={**cluster_style, "bgcolor": "#FFF3E0", "style": "rounded"}):
            n_sec_kv = KeyVaults("Key Vault\nkv-nff-prod\n(RBAC)")
            n_ops_appi = ApplicationInsights("App Insights\nappi-nff-prod")

    # Request flow: Users → App Service (HTTPS)
    n_ext_users >> Edge(label="HTTPS (TLS 1.2+)", color="#1565C0", style="bold") >> n_web_app

    # App Service → Data via Private Endpoints
    n_web_app >> Edge(label="SQL (TCP 1433)", color="#7B1FA2") >> n_pe_sql
    n_pe_sql >> Edge(color="#7B1FA2") >> n_data_sql

    n_web_app >> Edge(label="Blob (HTTPS 443)", color="#7B1FA2") >> n_pe_blob
    n_pe_blob >> Edge(color="#7B1FA2") >> n_data_st

    # App Service → Key Vault (Managed Identity, public endpoint w/ firewall)
    n_web_app >> Edge(label="Secrets (MI)", style="dashed", color="#E65100") >> n_sec_kv

    # App Service → App Insights (telemetry)
    n_web_app >> Edge(label="Telemetry", style="dotted", color="#757575") >> n_ops_appi

print(f"Runtime diagram generated: {output_path}.png")
