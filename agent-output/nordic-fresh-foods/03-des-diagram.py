"""
Nordic Fresh Foods (FreshConnect MVP) — Proposed Architecture Diagram

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    python3 agent-output/nordic-fresh-foods/03-des-diagram.py

Output:
    agent-output/nordic-fresh-foods/03-des-diagram.png
"""

import os
from diagrams import Diagram, Cluster, Edge

# Compute
from diagrams.azure.compute import AppServices

# Database
from diagrams.azure.database import SQLDatabases

# Storage
from diagrams.azure.storage import StorageAccounts

# Security
from diagrams.azure.security import KeyVaults

# Network
from diagrams.azure.network import VirtualNetworks, DNSPrivateZones

# Private Endpoints — use networking extended module
from diagrams.azure.network import PrivateEndpoint

# Monitor
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces

# Identity
from diagrams.azure.identity import ActiveDirectory, ManagedIdentities

# External / On-Prem
from diagrams.onprem.client import Users
from diagrams.generic.network import Firewall as GenericFirewall

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "03-des-diagram")

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "0.9",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
    "label": "Nordic Fresh Foods — FreshConnect MVP\nswedencentral | N-Tier Web App | Bicep (AVM)",
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

# Edge styles
EDGE_AUTH = {"style": "bold", "color": "#0078D4", "penwidth": "2.0"}
EDGE_DATA = {"style": "solid", "color": "#333333", "penwidth": "1.5"}
EDGE_SECRET = {"style": "dashed", "color": "#C00000", "penwidth": "1.5"}
EDGE_TELEMETRY = {"style": "dotted", "color": "#8764B8", "penwidth": "1.5"}
EDGE_EXTERNAL = {"style": "dashed", "color": "#FF8C00", "penwidth": "1.5"}

with Diagram(
    "",
    show=False,
    filename=OUTPUT_FILE,
    outformat="png",
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    # --- Users ---
    n_edge_users = Users("Restaurants\nConsumers\nFarmers")

    # --- Identity ---
    with Cluster("Identity & Auth", graph_attr={**cluster_style, "bgcolor": "#E8F0FE", "style": "rounded"}):
        n_id_entra = ActiveDirectory("Entra External ID\n(Social + Local)")
        n_id_mi = ManagedIdentities("Managed Identity\n(System-Assigned)")

    # --- External Integrations (PCI out-of-scope boundary) ---
    with Cluster("External Services\n(PCI Out-of-Scope)", graph_attr={**cluster_style, "bgcolor": "#FFF3E0", "style": "dashed"}):
        n_ext_payment = GenericFirewall("Payment Gateway\n(Hosted Fields)")
        n_ext_maps = GenericFirewall("Maps / Routing\nAPI")
        n_ext_email = GenericFirewall("Email / SMS\nProvider")

    # --- Subscription / Resource Group boundary ---
    with Cluster("Azure Subscription\nrg-nordic-fresh-foods-prod", graph_attr={**cluster_style, "bgcolor": "#F0F8FF", "style": "rounded"}):

        # --- Observability tier ---
        with Cluster("Observability", graph_attr={**cluster_style, "bgcolor": "#F3E8FD", "style": "rounded"}):
            n_ops_appinsights = ApplicationInsights("App Insights\n(Pay-per-GB)")
            n_ops_loganalytics = LogAnalyticsWorkspaces("Log Analytics\n(5 GB Free)")

        # --- Compute / App tier ---
        with Cluster("App Tier — app-subnet (10.0.1.0/24)", graph_attr={**cluster_style, "bgcolor": "#E6F4EA", "style": "rounded"}):
            n_web_appservice = AppServices("App Service S1\n(Linux, 2 inst)")

        # --- Security tier ---
        with Cluster("Secrets Management", graph_attr={**cluster_style, "bgcolor": "#FCE4EC", "style": "rounded"}):
            n_sec_keyvault = KeyVaults("Key Vault\n(Standard, RBAC)")

        # --- VNet / Network tier ---
        with Cluster("VNet 10.0.0.0/16", graph_attr={**cluster_style, "bgcolor": "#E0F2F1", "style": "rounded"}):

            n_net_vnet = VirtualNetworks("VNet\nswedencentral")

            # --- Private Endpoint subnet ---
            with Cluster("pe-subnet (10.0.3.0/24)", graph_attr={**cluster_style, "bgcolor": "#E0E0E0", "style": "rounded"}):
                n_net_pe_sql = PrivateEndpoint("PE — SQL")
                n_net_pe_storage = PrivateEndpoint("PE — Storage")

            # --- Private DNS Zones ---
            with Cluster("Private DNS Zones", graph_attr={**cluster_style, "bgcolor": "#F5F5F5", "style": "rounded"}):
                n_net_dns_sql = DNSPrivateZones("privatelink.\ndatabase.windows.net")
                n_net_dns_blob = DNSPrivateZones("privatelink.\nblob.core.windows.net")

        # --- Data tier (private access only) ---
        with Cluster("Data Tier — data-subnet (10.0.2.0/24)\npublicNetworkAccess: Disabled", graph_attr={**cluster_style, "bgcolor": "#FFF9C4", "style": "rounded"}):
            n_data_sql = SQLDatabases("Azure SQL S0\n(10 DTU, Geo-backup)")
            n_data_storage = StorageAccounts("Storage LRS\n(HTTPS-only, No Public Blob)")

    # ============================
    # FLOWS
    # ============================

    # Auth flow: Users → Entra → App Service
    n_edge_users >> Edge(label="HTTPS\nOAuth 2.0", **EDGE_AUTH) >> n_id_entra
    n_id_entra >> Edge(label="JWT Token", **EDGE_AUTH) >> n_web_appservice

    # Managed Identity: App Service → MI → downstream
    n_web_appservice >> Edge(label="MI Auth", **EDGE_AUTH) >> n_id_mi

    # Secret flow: App Service → Key Vault (via MI)
    n_web_appservice >> Edge(label="Secrets\n(MI RBAC)", **EDGE_SECRET) >> n_sec_keyvault

    # Data flows via Private Endpoints
    n_web_appservice >> Edge(label="VNet\nIntegration", **EDGE_DATA) >> n_net_vnet
    n_net_vnet >> Edge(**EDGE_DATA) >> n_net_pe_sql
    n_net_vnet >> Edge(**EDGE_DATA) >> n_net_pe_storage
    n_net_pe_sql >> Edge(label="TLS 1.2\nAD Auth", **EDGE_DATA) >> n_data_sql
    n_net_pe_storage >> Edge(label="TLS 1.2\nMI Auth", **EDGE_DATA) >> n_data_storage

    # DNS resolution for Private Endpoints
    n_net_pe_sql >> Edge(style="dotted", color="#999999") >> n_net_dns_sql
    n_net_pe_storage >> Edge(style="dotted", color="#999999") >> n_net_dns_blob

    # Telemetry flow: App Service → App Insights → Log Analytics
    n_web_appservice >> Edge(label="Telemetry", **EDGE_TELEMETRY) >> n_ops_appinsights
    n_ops_appinsights >> Edge(label="Logs", **EDGE_TELEMETRY) >> n_ops_loganalytics

    # External integrations (outbound REST, no card data)
    n_web_appservice >> Edge(label="REST\n(Hosted Fields)", **EDGE_EXTERNAL) >> n_ext_payment
    n_web_appservice >> Edge(label="REST", **EDGE_EXTERNAL) >> n_ext_maps
    n_web_appservice >> Edge(label="REST", **EDGE_EXTERNAL) >> n_ext_email

print(f"Diagram saved to: {OUTPUT_FILE}.png")
