"""
Architecture Diagram: the-test Payment Gateway
================================================
PCI-DSS Level 1 compliant payment gateway on Azure.
Hub-spoke network topology with AKS compute, PostgreSQL + Cosmos DB data tier.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Generate:
    cd agent-output/the-test && python3 03-des-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import KubernetesServices, ContainerRegistries
from diagrams.azure.network import (
    FrontDoors,
    Firewall,
    VirtualNetworks,
    Subnets,
    ApplicationSecurityGroups,
    DDOSProtectionPlans,
)
from diagrams.azure.database import (
    DatabaseForPostgresqlServers,
    CosmosDb,
)
from diagrams.azure.integration import APIManagement, ServiceBus
from diagrams.azure.security import KeyVaults
from diagrams.azure.identity import ActiveDirectory
from diagrams.azure.monitor import LogAnalyticsWorkspaces, Monitor, ApplicationInsights
from diagrams.generic.network import Firewall as GenericFirewall
from diagrams.onprem.client import Users

# --- Graph styling ---
graph_attr = {
    "bgcolor": "white",
    "pad": "1.0",
    "nodesep": "1.0",
    "ranksep": "1.2",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "18",
    "dpi": "150",
    "label": "the-test: PCI-DSS Payment Gateway\nswedencentral | 10,000 TPS | 99.99% SLA",
    "labelloc": "t",
}

node_attr = {
    "fontname": "Arial Bold",
    "fontsize": "10",
    "labelloc": "t",
}

cluster_style = {
    "margin": "30",
    "fontname": "Arial Bold",
    "fontsize": "13",
}

cluster_hub = {**cluster_style, "bgcolor": "#FFF3E0", "style": "rounded"}
cluster_spoke = {**cluster_style, "bgcolor": "#E3F2FD", "style": "rounded"}
cluster_cde = {**cluster_style, "bgcolor": "#FFEBEE", "style": "rounded,bold", "fontcolor": "#C62828"}
cluster_data = {**cluster_style, "bgcolor": "#E8F5E9", "style": "rounded"}
cluster_monitor = {**cluster_style, "bgcolor": "#F3E5F5", "style": "rounded"}
cluster_edge = {**cluster_style, "bgcolor": "#FFFDE7", "style": "rounded"}

with Diagram(
    "",
    filename="agent-output/the-test/03-des-diagram",
    show=False,
    direction="TB",
    outformat="png",
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    # --- External ---
    merchants = Users("Merchant\nSystems")
    card_networks = GenericFirewall("Card Networks\n(Visa, MC)")

    # --- Edge / Global Services ---
    with Cluster("Global Edge Services", graph_attr=cluster_edge):
        ddos = DDOSProtectionPlans("DDoS Network\nProtection")
        front_door = FrontDoors("fd-the-test-prod\nFront Door Premium\n+ WAF (OWASP 3.2)")

    # --- Identity & Monitoring (Shared) ---
    with Cluster("Shared Services", graph_attr=cluster_monitor):
        entra = ActiveDirectory("Entra ID\n+ Workload Identity\n+ PIM")
        monitor = Monitor("Azure Monitor")
        log_analytics = LogAnalyticsWorkspaces("log-the-test-prod\n1-year retention")
        app_insights = ApplicationInsights("appi-the-test-prod\nDistributed Tracing")
        defender = ApplicationSecurityGroups("Microsoft Defender\nfor Cloud + Containers")

    # --- Hub VNet ---
    with Cluster("Hub VNet (10.0.0.0/16)", graph_attr=cluster_hub):
        with Cluster("snet-firewall (10.0.1.0/24)", graph_attr=cluster_style):
            az_firewall = Firewall("fw-the-test-prod\nFirewall Premium\n(IDPS enabled)")

    # --- Spoke VNet ---
    with Cluster("Spoke VNet (10.1.0.0/16)", graph_attr=cluster_spoke):

        # --- API Management Subnet ---
        with Cluster("snet-apim (10.1.0.0/24)", graph_attr=cluster_style):
            apim = APIManagement("apim-the-test-prod\nAPIM Premium\n(VNet-integrated)")

        # --- CDE Subnet (PCI-DSS) ---
        with Cluster("snet-aks-cde (10.1.1.0/24)\nPCI-DSS Cardholder Data Environment", graph_attr=cluster_cde):
            aks = KubernetesServices("aks-the-test-prod\nAKS Standard\nD8s_v5 × 3-20 nodes")
            acr = ContainerRegistries("acr-the-test-prod\nACR Premium\n(geo-replicated)")

        # --- Messaging Subnet ---
        with Cluster("snet-messaging (10.1.2.0/24)", graph_attr=cluster_style):
            service_bus = ServiceBus("sb-the-test-prod\nService Bus Premium\n1 MU")

        # --- Data Subnet ---
        with Cluster("snet-data (10.1.3.0/24)\nPrivate Endpoints Only", graph_attr=cluster_data):
            postgresql = DatabaseForPostgresqlServers("psql-the-test-prod\nPostgreSQL Flex\nE16s v5 (16 vCores)\nZone-redundant HA")
            cosmos = CosmosDb("cosmos-the-test-prod\nCosmos DB NoSQL\nAutoscale 10-50K RU/s\nSession consistency")
            keyvault = KeyVaults("kv-the-test-prod\nKey Vault Premium\n(HSM-backed)")

    # =========================
    # Data Flow (Top to Bottom)
    # =========================

    # External → Edge
    merchants >> Edge(label="HTTPS/OAuth 2.0", color="#1565C0") >> front_door
    ddos - Edge(style="dashed", color="#E65100") - front_door

    # Edge → Hub Firewall
    front_door >> Edge(label="WAF inspected", color="#1565C0") >> az_firewall

    # Hub → Spoke
    az_firewall >> Edge(label="IDPS inspected\neast-west", color="#C62828") >> apim

    # APIM → AKS
    apim >> Edge(label="REST API\nrate limited", color="#1565C0") >> aks

    # AKS → Data Tier
    aks >> Edge(label="ACID transactions\nmTLS", color="#2E7D32") >> postgresql
    aks >> Edge(label="Session/cache\n≤ 10ms reads", color="#6A1B9A") >> cosmos
    aks >> Edge(label="Secrets\nmanaged identity", style="dashed", color="#E65100") >> keyvault
    aks >> Edge(label="Transaction\nqueues + DLQ", color="#F57F17") >> service_bus

    # AKS ← ACR
    acr >> Edge(label="Image pull\ncontent trust", style="dashed", color="#455A64") >> aks

    # AKS → Card Networks (outbound)
    aks >> Edge(label="Payment auth\nmTLS outbound", color="#C62828") >> card_networks

    # Monitoring
    aks >> Edge(style="dotted", color="#7B1FA2") >> app_insights
    aks >> Edge(style="dotted", color="#7B1FA2") >> log_analytics
    az_firewall >> Edge(style="dotted", color="#7B1FA2") >> log_analytics
    apim >> Edge(style="dotted", color="#7B1FA2") >> log_analytics
    postgresql >> Edge(style="dotted", color="#7B1FA2") >> log_analytics

    # Identity
    entra >> Edge(style="dashed", label="Workload\nIdentity", color="#0D47A1") >> aks
