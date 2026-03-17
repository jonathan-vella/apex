"""
04-dependency-diagram.py — Contoso Service Hub Module Dependency Graph

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    python3 agent-output/contoso-service-hub-run-2/04-dependency-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import KubernetesServices, VirtualMachinesClassic
from diagrams.azure.database import DatabaseForPostgresqlServers
from diagrams.azure.network import VirtualNetworks, DNSZones, FrontDoors, PrivateEndpoint
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.integration import APIManagement
from diagrams.azure.analytics import LogAnalyticsWorkspaces
from diagrams.azure.devops import ApplicationInsights
from diagrams.azure.general import Cache, CostBudgets
import os

output_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(output_dir, "04-dependency-diagram")

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.2",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "18",
    "dpi": "150",
    "label": "Contoso Service Hub — Module Dependency Graph\n(Bicep deployment order)",
    "labelloc": "t",
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

with Diagram(
    "",
    filename=output_path,
    show=False,
    direction="TB",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
    outformat="png",
):
    # Phase 1: Foundation (no dependencies)
    with Cluster(
        "Phase 1: Foundation",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "style": "dashed", "color": "#0078D4", "bgcolor": "#F0F8FF"},
    ):
        n_ops_law = LogAnalyticsWorkspaces("monitoring.bicep\nLog Analytics +\nApp Insights +\nAction Group")
        n_id_mi = ManagedIdentities("managed-identity.bicep\nUser-Assigned MI")
        n_cost_budget = CostBudgets("budget.bicep\nBudget +\nForecast Alerts")

    # Phase 2: Networking
    with Cluster(
        "Phase 2: Networking",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "style": "dashed", "color": "#107C10", "bgcolor": "#F0FFF0"},
    ):
        n_net_vnet = VirtualNetworks("networking.bicep\nVNet + 6 Subnets +\n6 NSGs")
        n_net_dns = DNSZones("private-dns-zones.bicep\n5 DNS Zones +\nVNet Links")

    # Phase 3: Security
    with Cluster(
        "Phase 3: Security",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "style": "dashed", "color": "#C00000", "bgcolor": "#FFF0F0"},
    ):
        n_sec_kv = KeyVaults("key-vault.bicep\nKey Vault + PE +\nRBAC")

    # Phase 4: Data Services
    with Cluster(
        "Phase 4: Data Services",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "style": "dashed", "color": "#FF8C00", "bgcolor": "#FFF8F0"},
    ):
        n_data_blob = StorageAccounts("storage-blob.bicep\nBlob Storage + PE")
        n_data_files = StorageAccounts("storage-files.bicep\nFiles Premium + PE")
        n_data_psql = DatabaseForPostgresqlServers("postgresql.bicep\nPostgreSQL Flex +\nDelegated Subnet")
        n_data_redis = Cache("redis.bicep\nManaged Redis +\nPE")

    # Phase 5: Compute
    with Cluster(
        "Phase 5: Compute",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "style": "dashed", "color": "#8764B8", "bgcolor": "#F8F0FF"},
    ):
        n_app_aks = KubernetesServices("aks.bicep\nAKS Standard +\n2 Node Pools")
        n_app_vm = VirtualMachinesClassic("virtual-machine.bicep\nVM D8sv5 +\nManaged Disk")
        n_app_apim = APIManagement("apim.bicep\nAPIM Standard v2 +\nVNet Integration")

    # Phase 6: Edge
    with Cluster(
        "Phase 6: Edge",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "style": "dashed", "color": "#FFB900", "bgcolor": "#FFFFF0"},
    ):
        n_edge_fd = FrontDoors("front-door.bicep\nFront Door Premium +\nWAF Policy")

    # --- Dependencies ---
    # Phase 1 → Phase 2
    n_ops_law >> Edge(label="diagnostics", color="#666666", style="dashed") >> n_net_vnet
    n_net_vnet >> Edge(label="VNet link", color="#107C10") >> n_net_dns

    # Phase 1 → Phase 3
    n_net_vnet >> Edge(label="PE subnet", color="#C00000") >> n_sec_kv
    n_net_dns >> Edge(label="DNS zone", color="#C00000") >> n_sec_kv
    n_id_mi >> Edge(label="RBAC", color="#C00000") >> n_sec_kv
    n_ops_law >> Edge(label="diagnostics", color="#666666", style="dashed") >> n_sec_kv

    # Phase 2/3 → Phase 4
    n_net_vnet >> Edge(label="PE subnet", color="#FF8C00") >> n_data_blob
    n_net_dns >> Edge(label="DNS zone", color="#FF8C00") >> n_data_blob
    n_net_vnet >> Edge(label="PE subnet", color="#FF8C00") >> n_data_files
    n_net_dns >> Edge(label="DNS zone", color="#FF8C00") >> n_data_files
    n_net_vnet >> Edge(label="delegated subnet", color="#FF8C00") >> n_data_psql
    n_net_dns >> Edge(label="DNS zone", color="#FF8C00") >> n_data_psql
    n_sec_kv >> Edge(label="admin password", color="#C00000") >> n_data_psql
    n_net_vnet >> Edge(label="PE subnet", color="#FF8C00") >> n_data_redis
    n_net_dns >> Edge(label="DNS zone", color="#FF8C00") >> n_data_redis

    # Phase 2/3 → Phase 5
    n_net_vnet >> Edge(label="AKS subnet", color="#8764B8") >> n_app_aks
    n_id_mi >> Edge(label="identity", color="#8764B8") >> n_app_aks
    n_sec_kv >> Edge(label="CSI driver", color="#8764B8") >> n_app_aks
    n_ops_law >> Edge(label="Container Insights", color="#666666", style="dashed") >> n_app_aks

    n_net_vnet >> Edge(label="VM subnet", color="#8764B8") >> n_app_vm
    n_id_mi >> Edge(label="identity", color="#8764B8") >> n_app_vm

    n_net_vnet >> Edge(label="APIM subnet", color="#8764B8") >> n_app_apim
    n_id_mi >> Edge(label="identity", color="#8764B8") >> n_app_apim
    n_sec_kv >> Edge(label="named values", color="#8764B8") >> n_app_apim

    # Phase 5 → Phase 6
    n_app_apim >> Edge(label="origin", color="#FFB900") >> n_edge_fd

    # Budget depends on action group
    n_ops_law >> Edge(label="action group", color="#666666", style="dashed") >> n_cost_budget

print(f"Dependency diagram saved to {output_path}.png")
