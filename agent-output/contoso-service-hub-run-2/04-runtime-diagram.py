"""Contoso Service Hub — Runtime request flow diagram.

Shows request path, authentication, secrets, data access, and workload telemetry flows.
Subscription activity-log forwarding remains a central ALZ policy concern and is intentionally
not represented as a workload-local retention setting in this diagram.
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.network import ApplicationGateway
from diagrams.azure.integration import APIManagement
from diagrams.azure.compute import KubernetesServices
from diagrams.azure.database import DatabaseForPostgresqlServers, CacheForRedis
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.security import KeyVaults
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.monitor import LogAnalyticsWorkspaces, ApplicationInsights
from diagrams.onprem.client import Users

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "1.0",
    "ranksep": "1.0",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
    "label": "Contoso Service Hub — Runtime Request Flow",
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
    filename="agent-output/contoso-service-hub-run-2/04-runtime-diagram",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    users = Users("EU Users\n(HTTPS)")

    with Cluster("Edge Tier", graph_attr={"style": "rounded", "color": "#0078D4", "fontcolor": "#0078D4", "labelloc": "t"}):
        agw = ApplicationGateway("App Gateway\nWAF v2\n(Prevention)")
        apim = APIManagement("API Management\nStandard v2")

    with Cluster("Compute Tier", graph_attr={"style": "rounded", "color": "#107C10", "fontcolor": "#107C10", "labelloc": "t"}):
        aks = KubernetesServices("AKS Standard\nMicroservices")

    with Cluster("Data Tier (Private Endpoints)", graph_attr={"style": "rounded", "color": "#C00000", "fontcolor": "#C00000", "labelloc": "t"}):
        pg = DatabaseForPostgresqlServers("PostgreSQL\nFlex GP D4ds_v5")
        redis = CacheForRedis("Redis Enterprise\nE50 (128 GB)")
        blob = StorageAccounts("Blob Storage\nZRS (200 GB)")

    with Cluster("Security", graph_attr={"style": "rounded", "color": "#5C2D91", "fontcolor": "#5C2D91", "labelloc": "t"}):
        kv = KeyVaults("Key Vault\n(Secrets/Certs)")
        mi = ManagedIdentities("Managed\nIdentity")

    with Cluster("Observability", graph_attr={"style": "rounded", "color": "#FF8C00", "fontcolor": "#FF8C00", "labelloc": "t"}):
        appi = ApplicationInsights("App Insights\n(×3)")
        law = LogAnalyticsWorkspaces("Log Analytics\n(env-tuned retention)")

    # Request flow (blue)
    users >> Edge(label="HTTPS", color="#0078D4", style="bold") >> agw
    agw >> Edge(label="route", color="#0078D4", style="bold") >> apim
    apim >> Edge(label="API", color="#0078D4", style="bold") >> aks

    # Data access (red)
    aks >> Edge(label="SQL (PE)", color="#C00000") >> pg
    aks >> Edge(label="cache (PE)", color="#C00000") >> redis
    aks >> Edge(label="blobs (PE)", color="#C00000") >> blob

    # Secret retrieval (purple)
    aks >> Edge(label="secrets", color="#5C2D91", style="dashed") >> kv
    agw >> Edge(label="TLS cert", color="#5C2D91", style="dashed") >> kv
    apim >> Edge(label="secrets", color="#5C2D91", style="dashed") >> kv

    # Identity (purple dotted)
    mi >> Edge(label="auth", color="#5C2D91", style="dotted") >> aks
    mi >> Edge(label="auth", color="#5C2D91", style="dotted") >> apim

    # Telemetry (orange)
    aks >> Edge(label="traces", color="#FF8C00", style="dashed") >> appi
    apim >> Edge(label="metrics", color="#FF8C00", style="dashed") >> appi
    agw >> Edge(label="logs", color="#FF8C00", style="dashed") >> law
    appi >> Edge(color="#FF8C00") >> law
