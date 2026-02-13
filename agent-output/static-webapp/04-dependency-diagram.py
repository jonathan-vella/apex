"""Step 4 deployment dependency diagram for static-webapp (non-Mermaid)."""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLDatabases, SQLServers
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces
from diagrams.azure.web import StaticApps

graph_attr = {
    "bgcolor": "white",
    "pad": "0.6",
    "nodesep": "1.0",
    "ranksep": "1.2",
    "splines": "polyline",
    "fontsize": "14",
    "labelloc": "t",
    "label": "Step 4 Deployment Dependencies | static-webapp",
}

cluster_attr = {"style": "rounded", "fontsize": "12"}

with Diagram(
    "static-webapp-dependencies",
    filename="agent-output/static-webapp/04-dependency-diagram",
    show=False,
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
):
    with Cluster("clu_tier_orchestration", graph_attr=cluster_attr):
        n_ops_main_orch = AppServices("main.bicep")

    with Cluster("clu_tier_foundation", graph_attr=cluster_attr):
        n_ops_monitor_log = LogAnalyticsWorkspaces("monitoring")
        n_data_sqlserver_core = SQLServers("sql-server")

    with Cluster("clu_tier_data", graph_attr=cluster_attr):
        n_data_sqldb_app = SQLDatabases("sql-database")

    with Cluster("clu_tier_app", graph_attr=cluster_attr):
        n_web_swa_frontend = StaticApps("static-web-app")
        n_ops_appi_main = ApplicationInsights("app-insights")

    e_runtime = Edge(color="#1565C0", style="bold", penwidth="1.3")
    e_observe = Edge(color="#6A1B9A", style="dotted")

    n_ops_main_orch >> e_runtime >> [n_ops_monitor_log, n_data_sqlserver_core]
    n_data_sqlserver_core >> e_runtime >> n_data_sqldb_app
    n_ops_main_orch >> e_runtime >> n_web_swa_frontend
    n_ops_monitor_log >> Edge(label="telemetry", **e_observe.attrs) >> n_ops_appi_main
    n_ops_appi_main >> Edge(label="telemetry", **e_observe.attrs) >> n_web_swa_frontend
