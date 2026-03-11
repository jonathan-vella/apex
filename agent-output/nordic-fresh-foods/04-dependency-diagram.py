"""
Nordic Fresh Foods — Dependency Diagram (Step 4)
Visualizes resource dependencies for the Bicep deployment.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    python3 agent-output/nordic-fresh-foods/04-dependency-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.web import AppServicePlans
from diagrams.azure.database import SQLServers, SQLDatabases
from diagrams.azure.network import VirtualNetworks, Subnets, PrivateEndpoint, DNSZones
from diagrams.azure.security import KeyVaults
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
    "label": "Nordic Fresh Foods — Resource Dependencies",
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
        n_net_vnet = VirtualNetworks("VNet\n10.0.0.0/16")
        with Cluster("Subnets", graph_attr={**cluster_style, "bgcolor": "#C8E6C9"}):
            n_net_snet_app = Subnets("snet-app\n10.0.1.0/24")
            n_net_snet_data = Subnets("snet-data\n10.0.2.0/24")
            n_net_snet_pe = Subnets("snet-pe\n10.0.3.0/24")

    with Cluster("Phase 2: Observability", graph_attr={**cluster_style, "bgcolor": "#E3F2FD", "style": "rounded"}):
        n_ops_log = ApplicationInsights("Log Analytics\nlog-nff-prod")
        n_ops_appi = ApplicationInsights("App Insights\nappi-nff-prod")

    with Cluster("Phase 3: Security + DNS", graph_attr={**cluster_style, "bgcolor": "#FFF3E0", "style": "rounded"}):
        n_sec_kv = KeyVaults("Key Vault\nkv-nff-prod")
        n_net_dns_sql = DNSZones("DNS Zone\nprivatelink\n.database\n.windows.net")
        n_net_dns_blob = DNSZones("DNS Zone\nprivatelink\n.blob.core\n.windows.net")

    with Cluster("Phase 4: Data", graph_attr={**cluster_style, "bgcolor": "#F3E5F5", "style": "rounded"}):
        n_data_sql = SQLServers("SQL Server\nsql-nff-prod")
        n_data_sqldb = SQLDatabases("SQL Database\nS0 (10 DTU)")
        n_data_pe_sql = PrivateEndpoint("PE (SQL)")
        n_data_st = StorageAccounts("Storage\nstnffprod")
        n_data_pe_st = PrivateEndpoint("PE (Blob)")

    with Cluster("Phase 5: Compute + Budget", graph_attr={**cluster_style, "bgcolor": "#FFEBEE", "style": "rounded"}):
        n_web_asp = AppServicePlans("ASP S1\nasp-nff-prod")
        n_web_app = AppServices("App Service\napp-nff-prod")

    # Phase 1 internal
    n_net_vnet >> Edge(style="dashed", color="#388E3C") >> n_net_snet_app
    n_net_vnet >> Edge(style="dashed", color="#388E3C") >> n_net_snet_data
    n_net_vnet >> Edge(style="dashed", color="#388E3C") >> n_net_snet_pe

    # Phase 2 dependencies
    n_ops_log >> Edge(color="#1565C0") >> n_ops_appi

    # Phase 3 dependencies
    n_net_vnet >> Edge(label="VNet link", color="#E65100") >> n_net_dns_sql
    n_net_vnet >> Edge(label="VNet link", color="#E65100") >> n_net_dns_blob

    # Phase 4 dependencies
    n_data_sql >> Edge(color="#7B1FA2") >> n_data_sqldb
    n_data_sql >> Edge(color="#7B1FA2") >> n_data_pe_sql
    n_net_snet_pe >> Edge(style="dashed", color="#7B1FA2") >> n_data_pe_sql
    n_net_dns_sql >> Edge(style="dashed", color="#7B1FA2") >> n_data_pe_sql
    n_net_snet_pe >> Edge(style="dashed", color="#7B1FA2") >> n_data_pe_st
    n_net_dns_blob >> Edge(style="dashed", color="#7B1FA2") >> n_data_pe_st
    n_data_st >> Edge(color="#7B1FA2") >> n_data_pe_st
    n_ops_log >> Edge(label="diagnostics", style="dotted", color="#757575") >> n_data_sql
    n_ops_log >> Edge(label="diagnostics", style="dotted", color="#757575") >> n_data_st

    # Phase 5 dependencies
    n_web_asp >> Edge(color="#C62828") >> n_web_app
    n_net_snet_app >> Edge(label="VNet integration", color="#C62828") >> n_web_app
    n_sec_kv >> Edge(label="secrets (MI)", style="dashed", color="#C62828") >> n_web_app
    n_ops_appi >> Edge(label="telemetry", style="dotted", color="#C62828") >> n_web_app
    n_data_sql >> Edge(label="SQL (PE)", color="#C62828") >> n_web_app
    n_data_st >> Edge(label="Blob (PE)", color="#C62828") >> n_web_app

print(f"Dependency diagram generated: {output_path}.png")
