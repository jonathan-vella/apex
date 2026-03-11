"""Nordic Fresh Foods as-built architecture diagram.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz
"""

import os
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLDatabases
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.security import KeyVaults
from diagrams.azure.network import VirtualNetworks, DNSPrivateZones, PrivateEndpoint
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces
from diagrams.azure.identity import ActiveDirectory, ManagedIdentities
from diagrams.onprem.client import Users
from diagrams.generic.network import Firewall


output_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(output_dir, "07-ab-diagram")

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "0.9",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
    "label": "Nordic Fresh Foods - As-Built Architecture\\nswedencentral | rg-nordic-fresh-foods-prod",
    "labelloc": "t",
    "labeljust": "c",
}
node_attr = {"fontname": "Arial Bold", "fontsize": "11", "labelloc": "t"}
edge_attr = {"fontname": "Arial", "fontsize": "9"}
cluster_style = {"margin": "30", "fontname": "Arial Bold", "fontsize": "14"}

with Diagram("", show=False, filename=output_file, outformat="png", direction="LR", graph_attr=graph_attr, node_attr=node_attr, edge_attr=edge_attr):
    n_users = Users("Restaurants\nConsumers\nFarmers")

    with Cluster("Identity", graph_attr={**cluster_style, "bgcolor": "#E8F0FE", "style": "rounded"}):
        n_entra = ActiveDirectory("Entra External ID")
        n_mi = ManagedIdentities("App Service\nManaged Identity")

    with Cluster("External Services", graph_attr={**cluster_style, "bgcolor": "#FFF3E0", "style": "dashed"}):
        n_payment = Firewall("Payment Gateway")
        n_maps = Firewall("Maps API")
        n_email = Firewall("Email/SMS API")

    with Cluster("Azure Subscription\nrg-nordic-fresh-foods-prod", graph_attr={**cluster_style, "bgcolor": "#F0F8FF", "style": "rounded"}):
        with Cluster("Observability", graph_attr={**cluster_style, "bgcolor": "#F3E8FD", "style": "rounded"}):
            n_ai = ApplicationInsights("appi-nordic-fresh-foods-prod")
            n_law = LogAnalyticsWorkspaces("log-nordic-fresh-foods-prod")

        with Cluster("App Tier\nsnet-app 10.0.1.0/24", graph_attr={**cluster_style, "bgcolor": "#E6F4EA", "style": "rounded"}):
            n_app = AppServices("app-nordic-fresh-foods-prod-7jrcjf\n(S1 plan)")

        with Cluster("Security", graph_attr={**cluster_style, "bgcolor": "#FCE4EC", "style": "rounded"}):
            n_kv = KeyVaults("kv-nff-prod-7jrcjfo3iqck\n(Premium)")

        with Cluster("Network\nVNet 10.0.0.0/16", graph_attr={**cluster_style, "bgcolor": "#E0F2F1", "style": "rounded"}):
            n_vnet = VirtualNetworks("vnet-nordic-fresh-foods-prod")
            with Cluster("snet-pe 10.0.3.0/24", graph_attr={**cluster_style, "bgcolor": "#E0E0E0", "style": "rounded"}):
                n_pe_sql = PrivateEndpoint("PE SQL")
                n_pe_blob = PrivateEndpoint("PE Blob")
                n_pe_kv = PrivateEndpoint("PE KeyVault")
            with Cluster("Private DNS", graph_attr={**cluster_style, "bgcolor": "#F5F5F5", "style": "rounded"}):
                n_dns_sql = DNSPrivateZones("privatelink.database.windows.net")
                n_dns_blob = DNSPrivateZones("privatelink.blob.core.windows.net")
                n_dns_kv = DNSPrivateZones("privatelink.vaultcore.azure.net")

        with Cluster("Data Tier\npublicNetworkAccess: Disabled", graph_attr={**cluster_style, "bgcolor": "#FFF9C4", "style": "rounded"}):
            n_sql = SQLDatabases("sqldb-freshconnect-prod\n(S0)")
            n_storage = StorageAccounts("stnffprod7jrcjfo3iqckk\n(Standard_LRS)")

    n_users >> Edge(label="OAuth2/OIDC", color="#0078D4", penwidth="2.0") >> n_entra
    n_entra >> Edge(label="JWT", color="#0078D4", penwidth="2.0") >> n_app
    n_app >> Edge(label="MI auth", color="#0078D4", penwidth="2.0") >> n_mi
    n_app >> Edge(label="secrets", color="#C00000", style="dashed") >> n_kv

    n_app >> Edge(label="VNet integration", color="#333333") >> n_vnet
    n_vnet >> n_pe_sql >> Edge(label="private link", color="#333333") >> n_sql
    n_vnet >> n_pe_blob >> Edge(label="private link", color="#333333") >> n_storage
    n_vnet >> n_pe_kv >> Edge(label="private link", color="#333333") >> n_kv

    n_pe_sql >> Edge(style="dotted", color="#999999") >> n_dns_sql
    n_pe_blob >> Edge(style="dotted", color="#999999") >> n_dns_blob
    n_pe_kv >> Edge(style="dotted", color="#999999") >> n_dns_kv

    n_app >> Edge(label="telemetry", style="dotted", color="#8764B8") >> n_ai >> n_law

    n_app >> Edge(label="REST", style="dashed", color="#FF8C00") >> n_payment
    n_app >> Edge(label="REST", style="dashed", color="#FF8C00") >> n_maps
    n_app >> Edge(label="REST", style="dashed", color="#FF8C00") >> n_email

print(f"Diagram saved to: {output_file}.png")
