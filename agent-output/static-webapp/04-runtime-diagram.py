"""Step 4 runtime flow diagram for static-webapp (non-Mermaid)."""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.database import SQLDatabases, SQLServers
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces
from diagrams.azure.web import StaticApps
from diagrams.onprem.client import Users

graph_attr = {
    "bgcolor": "white",
    "pad": "0.6",
    "nodesep": "1.0",
    "ranksep": "1.2",
    "splines": "polyline",
    "fontsize": "14",
    "labelloc": "t",
    "label": "Step 4 Runtime Flows | static-webapp",
}

cluster_attr = {"style": "rounded", "fontsize": "12"}

with Diagram(
    "static-webapp-runtime",
    filename="agent-output/static-webapp/04-runtime-diagram",
    show=False,
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
):
    with Cluster("clu_ext_global", graph_attr=cluster_attr):
        n_edge_user_browser = Users("users")

    with Cluster("clu_tier_app", graph_attr=cluster_attr):
        n_web_swa_frontend = StaticApps("static-web-app")

    with Cluster("clu_tier_data", graph_attr=cluster_attr):
        n_data_sqlserver_core = SQLServers("sql-server")
        n_data_sqldb_app = SQLDatabases("sql-database")

    with Cluster("clu_tier_ops", graph_attr=cluster_attr):
        n_ops_loganalytics_main = LogAnalyticsWorkspaces("log-analytics")
        n_ops_appi_main = ApplicationInsights("app-insights")

    e_runtime = Edge(color="#1565C0", style="bold", penwidth="1.3")
    e_observe = Edge(color="#6A1B9A", style="dotted")

    n_edge_user_browser >> Edge(label="request", **e_runtime.attrs) >> n_web_swa_frontend
    n_web_swa_frontend >> Edge(label="request", **e_runtime.attrs) >> n_data_sqlserver_core
    n_data_sqlserver_core >> Edge(label="write", **e_runtime.attrs) >> n_data_sqldb_app

    n_web_swa_frontend >> Edge(label="telemetry", **e_observe.attrs) >> n_ops_appi_main
    n_data_sqlserver_core >> Edge(label="telemetry", **e_observe.attrs) >> n_ops_loganalytics_main
