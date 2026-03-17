"""
04-runtime-diagram.py — Contoso Service Hub Runtime Flow Diagram

Shows request, authentication, secret, and telemetry paths at runtime.

Prerequisites:
    pip install diagrams matplotlib pillow
    apt-get install -y graphviz

Usage:
    python3 agent-output/contoso-service-hub-run-2/04-runtime-diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import KubernetesServices, VirtualMachinesClassic
from diagrams.azure.database import DatabaseForPostgresqlServers
from diagrams.azure.network import FrontDoors
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.integration import APIManagement
from diagrams.azure.analytics import LogAnalyticsWorkspaces
from diagrams.azure.devops import ApplicationInsights
from diagrams.azure.general import Cache, Mobile
import os

output_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(output_dir, "04-runtime-diagram")

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.0",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "18",
    "dpi": "150",
    "label": "Contoso Service Hub — Runtime Flow\n(Request · Auth · Secret · Telemetry paths)",
    "labelloc": "t",
}

node_attr = {
    "fontname": "Arial Bold",
    "fontsize": "11",
    "labelloc": "t",
}

with Diagram(
    "",
    filename=output_path,
    show=False,
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
    outformat="png",
):
    # External users
    with Cluster(
        "Clients",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#F8F9FA", "style": "rounded"},
    ):
        n_ext_mobile = Mobile("Mobile App\n(iOS/Android)")
        n_ext_web = Mobile("Web App\n(Browser)")

    # Identity
    with Cluster(
        "Identity (Entra)",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#FFF8E1", "style": "rounded", "color": "#FFB900"},
    ):
        n_id_ciam = ManagedIdentities("Entra External ID\n(CIAM — 15K MAU)")
        n_id_entra = ManagedIdentities("Entra ID\n(Internal Staff)")

    # Edge layer
    with Cluster(
        "Edge (Global)",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#E8F5E9", "style": "rounded", "color": "#107C10"},
    ):
        n_edge_fd = FrontDoors("Azure Front Door\nPremium + WAF\n(OWASP 3.2)")

    # API Gateway
    with Cluster(
        "API Gateway (swedencentral)",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#E3F2FD", "style": "rounded", "color": "#0078D4"},
    ):
        n_app_apim = APIManagement("API Management\nStandard v2\n(JWT validation)")

    # Compute layer
    with Cluster(
        "Compute (VNet-integrated)",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#F3E5F5", "style": "rounded", "color": "#8764B8"},
    ):
        n_app_aks = KubernetesServices("AKS Standard\n15+ Microservices\n(2× D8sv5)")
        n_app_vm = VirtualMachinesClassic("VM D8sv5\n(Non-container\nworkloads)")

    # Data layer (Private Endpoints)
    with Cluster(
        "Data Services (Private Endpoints only)",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#FFF3E0", "style": "rounded", "color": "#FF8C00"},
    ):
        n_data_psql = DatabaseForPostgresqlServers("PostgreSQL Flex\nGP 4vCore + HA\n256 GB")
        n_data_redis = Cache("Managed Redis\nM150 Memory Opt\n150 GB")
        n_data_blob = StorageAccounts("Blob Storage\n200 GB Hot LRS")
        n_data_files = StorageAccounts("Azure Files\nPremium 256 GB")

    # Security
    with Cluster(
        "Secrets",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#FFEBEE", "style": "rounded", "color": "#C00000"},
    ):
        n_sec_kv = KeyVaults("Key Vault\n(CSI Driver +\nManaged Identity)")
        n_sec_mi = ManagedIdentities("User-Assigned MI")

    # Observability
    with Cluster(
        "Observability",
        graph_attr={"margin": "30", "fontname": "Arial Bold", "fontsize": "14",
                    "bgcolor": "#ECEFF1", "style": "rounded", "color": "#666666"},
    ):
        n_ops_law = LogAnalyticsWorkspaces("Log Analytics\nWorkspace")
        n_ops_ai = ApplicationInsights("Application\nInsights")

    # --- Request Flow (blue solid) ---
    n_ext_mobile >> Edge(label="HTTPS", color="#0078D4", style="bold") >> n_edge_fd
    n_ext_web >> Edge(label="HTTPS", color="#0078D4", style="bold") >> n_edge_fd
    n_edge_fd >> Edge(label="route /api/*", color="#0078D4", style="bold") >> n_app_apim
    n_app_apim >> Edge(label="VNet internal", color="#0078D4", style="bold") >> n_app_aks

    # --- Auth Flow (orange dashed) ---
    n_ext_mobile >> Edge(label="OIDC/OAuth", color="#FF8C00", style="dashed") >> n_id_ciam
    n_ext_web >> Edge(label="OIDC/OAuth", color="#FF8C00", style="dashed") >> n_id_ciam
    n_id_ciam >> Edge(label="JWT token", color="#FF8C00", style="dashed") >> n_ext_mobile

    # --- Data Flow (green) ---
    n_app_aks >> Edge(label="queries (PE)", color="#107C10") >> n_data_psql
    n_app_aks >> Edge(label="cache R/W (PE)", color="#107C10") >> n_data_redis
    n_app_aks >> Edge(label="blob R/W (PE)", color="#107C10") >> n_data_blob
    n_app_aks >> Edge(label="file R/W (PE)", color="#107C10") >> n_data_files
    n_app_vm >> Edge(label="queries (PE)", color="#107C10") >> n_data_psql

    # --- Secret Flow (red dashed) ---
    n_app_aks >> Edge(label="CSI mount", color="#C00000", style="dashed") >> n_sec_kv
    n_sec_mi >> Edge(label="auth", color="#C00000", style="dashed") >> n_sec_kv
    n_sec_mi >> Edge(label="identity", color="#C00000", style="dashed") >> n_app_aks

    # --- Telemetry Flow (grey dotted) ---
    n_app_aks >> Edge(label="traces", color="#666666", style="dotted") >> n_ops_ai
    n_app_apim >> Edge(label="metrics", color="#666666", style="dotted") >> n_ops_ai
    n_ops_ai >> Edge(label="ingest", color="#666666", style="dotted") >> n_ops_law
    n_edge_fd >> Edge(label="access logs", color="#666666", style="dotted") >> n_ops_law
    n_app_aks >> Edge(label="Container Insights", color="#666666", style="dotted") >> n_ops_law

print(f"Runtime diagram saved to {output_path}.png")
