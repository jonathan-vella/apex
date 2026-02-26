from diagrams import Diagram, Cluster, Edge
from diagrams.azure.web import StaticApps, AppServices
from diagrams.azure.database import SQLDatabases
from diagrams.azure.security import KeyVaults
from diagrams.azure.identity import ActiveDirectory
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces
from diagrams.onprem.client import Users

graph_attr = {
    "nodesep": "0.8",
    "ranksep": "1.0",
    "splines": "ortho",
    "pad": "0.5",
}

with Diagram(
    "terraform-e2e runtime flow",
    show=False,
    direction="LR",
    filename="agent-output/terraform-e2e/04-runtime-diagram",
    graph_attr=graph_attr,
):
    users = Users("customers")

    with Cluster("Azure (swedencentral)"):
        with Cluster("Frontend"):
            swa = StaticApps("static web app\n(free tier)")

        with Cluster("Backend"):
            app = AppServices("app service\n(B1 linux)")

        with Cluster("Data"):
            sql = SQLDatabases("azure sql\n(basic 5 DTU)")

        with Cluster("Security"):
            kv = KeyVaults("key vault\n(standard)")
            entra = ActiveDirectory("entra id\n(managed identity)")

        with Cluster("Observability"):
            appi = ApplicationInsights("app insights")
            log = LogAnalyticsWorkspaces("log analytics")

    # Request flow (solid blue)
    users >> Edge(label="HTTPS request", color="blue") >> swa
    swa >> Edge(label="API call", color="blue") >> app
    app >> Edge(label="SQL query", color="blue") >> sql

    # Auth flow (solid green)
    app >> Edge(label="managed identity\ntoken", color="darkgreen") >> entra
    entra >> Edge(label="RBAC auth", color="darkgreen") >> kv
    entra >> Edge(label="AAD auth", color="darkgreen") >> sql

    # Secret flow (dashed green)
    app >> Edge(label="get secret", style="dashed", color="darkgreen") >> kv

    # Telemetry flow (dashed gray)
    app >> Edge(label="traces + metrics", style="dashed", color="dimgray") >> appi
    appi >> Edge(label="ingest", style="dashed", color="dimgray") >> log
    sql >> Edge(label="diagnostics", style="dashed", color="dimgray") >> log
    kv >> Edge(label="audit logs", style="dashed", color="dimgray") >> log
