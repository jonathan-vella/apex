"""Step 4 runtime flow diagram for e2e-conductor-test (non-Mermaid)."""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.monitor import LogAnalyticsWorkspaces, Monitor
from diagrams.azure.web import FrontDoorAndCDNProfiles, StaticApps
from diagrams.onprem.client import Users

graph_attr = {
    "bgcolor": "white",
    "pad": "0.6",
    "nodesep": "1.0",
    "ranksep": "1.2",
    "splines": "polyline",
    "fontsize": "14",
    "labelloc": "t",
    "label": "Step 4 Runtime Flows | e2e-conductor-test",
}

cluster_attr = {"style": "rounded", "fontsize": "12"}

with Diagram(
    "e2e-conductor-test-runtime",
    filename="agent-output/e2e-conductor-test/04-runtime-diagram",
    show=False,
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
):
    with Cluster("clu_ext_global", graph_attr=cluster_attr):
        n_edge_user_browser = Users("users")

    with Cluster("clu_tier_app", graph_attr=cluster_attr):
        n_web_swa_frontend = StaticApps("static-web-app")
        n_edge_cdn_global = FrontDoorAndCDNProfiles("cdn-profile")

    with Cluster("clu_tier_ops", graph_attr=cluster_attr):
        n_ops_loganalytics_main = LogAnalyticsWorkspaces("log-analytics")
        n_ops_metric_alert = Monitor("metric-alert")
        n_ops_action_group = Monitor("action-group")

    e_runtime = Edge(color="#1565C0", style="bold", penwidth="1.3")
    e_control = Edge(color="#E65100", style="dashed")
    e_observe = Edge(color="#6A1B9A", style="dotted")

    n_edge_user_browser >> Edge(label="request", **e_runtime.attrs) >> n_edge_cdn_global
    n_edge_cdn_global >> Edge(label="request", **e_runtime.attrs) >> n_web_swa_frontend

    n_edge_cdn_global >> Edge(label="telemetry", **e_observe.attrs) >> n_ops_metric_alert
    n_web_swa_frontend >> Edge(label="telemetry", **e_observe.attrs) >> n_ops_loganalytics_main
    n_ops_metric_alert >> Edge(label="admin", **e_control.attrs) >> n_ops_action_group
