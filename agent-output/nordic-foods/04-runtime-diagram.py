"""Nordic Fresh Foods — FreshConnect MVP — Runtime Flow Diagram.

Request / auth / secret / data / telemetry paths at runtime.
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLDatabases
from diagrams.azure.devops import ApplicationInsights
from diagrams.azure.identity import ActiveDirectory
from diagrams.azure.monitor import LogAnalyticsWorkspaces
from diagrams.azure.network import PrivateEndpoint, VirtualNetworks
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import BlobStorage
from diagrams.onprem.client import Users

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.1",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
}
node_attr = {"fontname": "Arial Bold", "fontsize": "11", "labelloc": "t"}

with Diagram(
    "FreshConnect MVP - Runtime Flow (request / auth / data / telemetry)",
    filename="agent-output/nordic-foods/04-runtime-diagram",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    users = Users("Restaurants / Consumers /\nSuppliers / Workforce")
    ext = ActiveDirectory("Entra External ID\n(consumers/restaurants)")
    eid = ActiveDirectory("Entra ID\n(workforce)")

    with Cluster("Public edge (oauth-entra)"):
        web = AppServices("app-nf-web-prod\nHTTPS-only / TLS 1.2\nSMI")
        api = AppServices("app-nf-api-prod\nHTTPS-only / TLS 1.2\nSMI / JWT validation")

    with Cluster("VNet (swedencentral) - private data plane"):
        vnet = VirtualNetworks("vnet-nordic-foods-prod\n10.40.0.0/22")
        pe_kv = PrivateEndpoint("pe-kv")
        pe_sql = PrivateEndpoint("pe-sql")
        pe_blob = PrivateEndpoint("pe-blob")
        kv = KeyVaults("Key Vault\nsecrets / KV-issued conn-strings")
        sql = SQLDatabases("Azure SQL DB\nS3 100 DTU / AAD-only")
        blob = BlobStorage("Storage Blob\nZRS / blob-public=false")

    with Cluster("Observability"):
        ai = ApplicationInsights("App Insights\nworkspace-based")
        law = LogAnalyticsWorkspaces("Log Analytics\nswedencentral / 30d")

    # Auth flow
    users >> Edge(label="HTTPS") >> [web, api]
    web >> Edge(label="OAuth login redirect") >> ext
    api >> Edge(label="JWT validate") >> ext
    api >> Edge(label="JWT validate (admin)") >> eid

    # Secrets / data plane (private)
    api >> Edge(label="MI: get-secret") >> pe_kv
    pe_kv >> Edge(style="dotted") >> vnet
    pe_kv >> kv
    api >> Edge(label="AAD token -> SQL") >> pe_sql
    pe_sql >> Edge(style="dotted") >> vnet
    pe_sql >> sql
    api >> Edge(label="MI: blob R/W") >> pe_blob
    pe_blob >> Edge(style="dotted") >> vnet
    pe_blob >> blob

    # Telemetry
    web >> Edge(label="traces / metrics", style="dashed") >> ai
    api >> Edge(label="traces / metrics", style="dashed") >> ai
    ai >> Edge(label="ingest") >> law
    sql >> Edge(label="diag", style="dashed") >> law
    blob >> Edge(label="diag", style="dashed") >> law
    kv >> Edge(label="diag", style="dashed") >> law
