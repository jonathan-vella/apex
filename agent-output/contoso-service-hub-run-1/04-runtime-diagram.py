"""Contoso Service Hub — Runtime Data Flow Diagram.

Shows request, auth, secret, and telemetry paths at runtime.
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import KubernetesServices, VM
from diagrams.azure.database import DatabaseForPostgresqlServers
from diagrams.azure.integration import APIManagement
from diagrams.azure.network import ApplicationGateway
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.analytics import LogAnalyticsWorkspaces
from diagrams.azure.identity import ManagedIdentities
from diagrams.onprem.client import Users
import os

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
    "Contoso Service Hub\nRuntime Data Flow",
    filename=os.path.join(output_dir, "04-runtime-diagram"),
    show=False,
    direction="TB",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    users = Users("Users\n(Residents, Visitors,\nTenants, Partners)")

    with Cluster("Edge Services", graph_attr={"style": "rounded", "bgcolor": "#FFF3E0", "labelloc": "t"}):
        entra = ManagedIdentities("Entra External ID\n15K MAU\nFIDO2/TOTP MFA")
        app_gw = ApplicationGateway("App Gateway\nWAF v2\n(Prevention)")
        apim = APIManagement("API Management\nStandard v2\nTLS 1.2")

    with Cluster("Compute (VNet: swedencentral)", graph_attr={"style": "rounded", "bgcolor": "#E3F2FD", "labelloc": "t"}):
        aks = KubernetesServices("AKS Cluster\n2x D4s_v5\nAzure CNI Overlay")
        vm = VM("General VM\nD8s_v5\nUbuntu 24.04")

    with Cluster("Data Services (Private Endpoints)", graph_attr={"style": "rounded", "bgcolor": "#E8F5E9", "labelloc": "t"}):
        postgresql = DatabaseForPostgresqlServers("PostgreSQL Flex\nGP D4s_v3\nEntra Auth Only")
        redis = StorageAccounts("Redis Enterprise\nE100 (128 GB)\nZone Redundant")
        storage = StorageAccounts("Blob Storage\nZRS, Hot\nHTTPS Only")

    with Cluster("Security", graph_attr={"style": "rounded", "bgcolor": "#FFEBEE", "labelloc": "t"}):
        key_vault = KeyVaults("Key Vault\nRBAC + PE\nPurge Protected")
        identity = ManagedIdentities("Managed Identity\nUser-Assigned\nShared")

    with Cluster("Observability", graph_attr={"style": "rounded", "bgcolor": "#F3E5F5", "labelloc": "t"}):
        monitoring = LogAnalyticsWorkspaces("Log Analytics\n+ App Insights\n90-day retention")

    # Request path (blue)
    users >> Edge(label="HTTPS", color="#0078D4", style="bold") >> app_gw
    app_gw >> Edge(label="route", color="#0078D4", style="bold") >> apim
    apim >> Edge(label="API calls", color="#0078D4", style="bold") >> aks

    # Auth path (orange)
    users >> Edge(label="OIDC/MFA", color="#FF8C00", style="dashed") >> entra
    entra >> Edge(label="token", color="#FF8C00", style="dashed") >> apim

    # Data flow (green)
    aks >> Edge(label="queries", color="#107C10") >> postgresql
    aks >> Edge(label="cache R/W", color="#107C10") >> redis
    aks >> Edge(label="blob R/W", color="#107C10") >> storage

    # Secret path (red)
    aks >> Edge(label="secrets\n(MI + PE)", color="#C00000", style="dotted") >> key_vault
    vm >> Edge(label="secrets\n(MI + PE)", color="#C00000", style="dotted") >> key_vault
    identity >> Edge(label="RBAC", color="#C00000", style="dotted") >> key_vault

    # Telemetry path (purple)
    aks >> Edge(label="logs", color="#7B1FA2", style="dashed") >> monitoring
    apim >> Edge(label="logs", color="#7B1FA2", style="dashed") >> monitoring
    app_gw >> Edge(label="logs", color="#7B1FA2", style="dashed") >> monitoring
    postgresql >> Edge(label="diag", color="#7B1FA2", style="dashed") >> monitoring
