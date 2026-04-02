"""Contoso Service Hub — Bicep module dependency graph.

Shows dependsOn relationships between Bicep modules across 4 deployment phases:
Foundation → Data → Edge → Platform.
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.network import VirtualNetworks, NetworkSecurityGroupsClassic, DNSZones, DNSPrivateZones, ApplicationGateway
from diagrams.azure.security import KeyVaults
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.database import DatabaseForPostgresqlServers, CacheForRedis
from diagrams.azure.integration import APIManagement
from diagrams.azure.compute import KubernetesServices, VirtualMachine
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.monitor import LogAnalyticsWorkspaces, ApplicationInsights
from diagrams.azure.general import Resourcegroups
from diagrams.azure.network import Subnets

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.0",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
    "label": "Contoso Service Hub — Bicep Module Dependencies",
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
    filename="agent-output/contoso-service-hub-run-2/04-dependency-diagram",
    show=False,
    direction="TB",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    with Cluster("Phase 1: Foundation", graph_attr={"style": "dashed", "color": "#0078D4", "fontcolor": "#0078D4", "labelloc": "t"}):
        vnet = VirtualNetworks("networking.bicep\nVNet + Subnets")
        nsg = NetworkSecurityGroupsClassic("networking.bicep\nNSGs (×5)")
        dns = DNSPrivateZones("networking.bicep\nPrivate DNS (×5)")
        law = LogAnalyticsWorkspaces("monitoring.bicep\nLog Analytics")
        appi = ApplicationInsights("monitoring.bicep\nApp Insights (×3)")
        mi = ManagedIdentities("identity.bicep\nManaged Identity")

    with Cluster("Phase 2: Data", graph_attr={"style": "dashed", "color": "#107C10", "fontcolor": "#107C10", "labelloc": "t"}):
        kv = KeyVaults("keyvault.bicep\nKey Vault + PE")
        st = StorageAccounts("storage.bicep\nStorage + PE")
        pg = DatabaseForPostgresqlServers("postgresql.bicep\nPostgreSQL + PE")
        redis = CacheForRedis("redis.bicep\nRedis E50 + PE")

    with Cluster("Phase 3: Edge", graph_attr={"style": "dashed", "color": "#FF8C00", "fontcolor": "#FF8C00", "labelloc": "t"}):
        agw = ApplicationGateway("appgateway.bicep\nApp GW WAF v2")
        apim = APIManagement("apim.bicep\nAPIM Std v2")

    with Cluster("Phase 4: Platform", graph_attr={"style": "dashed", "color": "#C00000", "fontcolor": "#C00000", "labelloc": "t"}):
        aks = KubernetesServices("aks.bicep\nAKS Standard")
        bastion = Subnets("bastion.bicep\nBastion")
        vm = VirtualMachine("vm.bicep\nMgmt VM")
        budget = Resourcegroups("budget.bicep\nBudget")

    # Phase 1 internal dependencies
    vnet >> Edge(color="#999") >> nsg
    vnet >> Edge(color="#999") >> dns
    law >> Edge(color="#999") >> appi

    # Phase 2 depends on Phase 1
    vnet >> Edge(color="#107C10", style="bold") >> kv
    dns >> Edge(color="#107C10") >> kv
    mi >> Edge(color="#107C10") >> kv

    vnet >> Edge(color="#107C10", style="bold") >> st
    dns >> Edge(color="#107C10") >> st

    vnet >> Edge(color="#107C10", style="bold") >> pg
    dns >> Edge(color="#107C10") >> pg
    kv >> Edge(color="#107C10") >> pg

    vnet >> Edge(color="#107C10", style="bold") >> redis
    dns >> Edge(color="#107C10") >> redis

    # Phase 3 depends on Phase 1+2
    vnet >> Edge(color="#FF8C00", style="bold") >> agw
    kv >> Edge(color="#FF8C00") >> agw

    vnet >> Edge(color="#FF8C00", style="bold") >> apim
    agw >> Edge(color="#FF8C00") >> apim

    # Phase 4 depends on Phase 1+2+3
    vnet >> Edge(color="#C00000", style="bold") >> aks
    kv >> Edge(color="#C00000") >> aks
    mi >> Edge(color="#C00000") >> aks
    law >> Edge(color="#C00000") >> aks

    vnet >> Edge(color="#C00000", style="bold") >> bastion

    vnet >> Edge(color="#C00000", style="bold") >> vm
    kv >> Edge(color="#C00000") >> vm
    mi >> Edge(color="#C00000") >> vm
