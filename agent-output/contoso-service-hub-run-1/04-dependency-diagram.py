"""Contoso Service Hub — Bicep Module Dependency Diagram.

Shows the deployment dependency graph between Bicep modules across 4 phases.
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import KubernetesServices, VM
from diagrams.azure.database import DatabaseForPostgresqlServers
from diagrams.azure.integration import APIManagement
from diagrams.azure.network import ApplicationGateway, VirtualNetworks, DNSZones, DNSPrivateZones
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.analytics import LogAnalyticsWorkspaces
from diagrams.azure.general import Managementgroups
from diagrams.custom import Custom
import os

# Diagram output path
output_dir = os.path.dirname(os.path.abspath(__file__))

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.0",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
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
    "Contoso Service Hub\nBicep Module Dependencies",
    filename=os.path.join(output_dir, "04-dependency-diagram"),
    show=False,
    direction="TB",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    with Cluster("Phase 1: Foundation", graph_attr={"style": "rounded", "bgcolor": "#E8F5E9", "labelloc": "t"}):
        monitoring = LogAnalyticsWorkspaces("monitoring.bicep\nLog Analytics +\nApp Insights")
        identity = Managementgroups("identity.bicep\nManaged Identity")
        networking = VirtualNetworks("networking.bicep\nVNet + Subnets + NSGs")
        private_dns = DNSPrivateZones("private-dns.bicep\n5 Private DNS Zones")
        key_vault = KeyVaults("key-vault.bicep\nKey Vault + PE")
        dns_zone = DNSZones("dns-zone.bicep\nPublic DNS")

    with Cluster("Phase 2: Data", graph_attr={"style": "rounded", "bgcolor": "#E3F2FD", "labelloc": "t"}):
        postgresql = DatabaseForPostgresqlServers("postgresql.bicep\nPostgreSQL Flex")
        redis = StorageAccounts("redis.bicep\nRedis Enterprise\nE100")
        storage = StorageAccounts("storage.bicep\nStorage Account\nZRS")

    with Cluster("Phase 3: Edge", graph_attr={"style": "rounded", "bgcolor": "#FFF3E0", "labelloc": "t"}):
        waf_policy = ApplicationGateway("waf-policy.bicep\nWAF Policy")
        app_gateway = ApplicationGateway("app-gateway.bicep\nApp Gateway\nWAF v2")
        apim = APIManagement("apim.bicep\nAPI Management\nStandard v2")

    with Cluster("Phase 4: Platform", graph_attr={"style": "rounded", "bgcolor": "#F3E5F5", "labelloc": "t"}):
        aks = KubernetesServices("aks.bicep\nAKS Cluster\nD4s_v5")
        vm = VM("virtual-machine.bicep\nVM D8s_v5")

    # Phase 1 internal dependencies
    networking >> Edge(label="VNet link") >> private_dns
    networking >> Edge(label="subnet") >> key_vault
    identity >> Edge(label="RBAC") >> key_vault
    private_dns >> Edge(label="PE DNS") >> key_vault

    # Phase 2 dependencies on Phase 1
    networking >> Edge(label="subnet", color="#1565C0") >> postgresql
    private_dns >> Edge(label="PE DNS", color="#1565C0") >> postgresql
    identity >> Edge(label="Entra auth", color="#1565C0") >> postgresql
    networking >> Edge(label="subnet", color="#1565C0") >> redis
    private_dns >> Edge(label="PE DNS", color="#1565C0") >> redis
    networking >> Edge(label="subnet", color="#1565C0") >> storage
    private_dns >> Edge(label="PE DNS", color="#1565C0") >> storage

    # Phase 3 dependencies
    waf_policy >> Edge(label="policy", color="#E65100") >> app_gateway
    networking >> Edge(label="subnet", color="#E65100") >> app_gateway
    identity >> Edge(label="MI", color="#E65100") >> app_gateway
    networking >> Edge(label="subnet", color="#E65100") >> apim
    identity >> Edge(label="MI", color="#E65100") >> apim

    # Phase 4 dependencies
    networking >> Edge(label="subnet", color="#7B1FA2") >> aks
    identity >> Edge(label="MI", color="#7B1FA2") >> aks
    monitoring >> Edge(label="Container\nInsights", color="#7B1FA2") >> aks
    networking >> Edge(label="subnet", color="#7B1FA2") >> vm
    identity >> Edge(label="MI", color="#7B1FA2") >> vm
