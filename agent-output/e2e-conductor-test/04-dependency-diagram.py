"""Step 4 deployment dependency diagram for e2e-conductor-test (non-Mermaid)."""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.monitor import LogAnalyticsWorkspaces, Monitor
from diagrams.azure.web import FrontDoorAndCDNProfiles, StaticApps
from diagrams.azure.devops import Pipelines

graph_attr = {
    "bgcolor": "white",
    "pad": "0.6",
    "nodesep": "1.0",
    "ranksep": "1.2",
    "splines": "polyline",
    "fontsize": "14",
    "labelloc": "t",
    "label": "Step 4 Deployment Dependencies | e2e-conductor-test",
}

cluster_attr = {"style": "rounded", "fontsize": "12"}

with Diagram(
    "e2e-conductor-test-dependencies",
    filename="agent-output/e2e-conductor-test/04-dependency-diagram",
    show=False,
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
):
    with Cluster("clu_tier_orchestration", graph_attr=cluster_attr):
        n_ops_pipeline_main = Pipelines("main.bicep")

    with Cluster("clu_tier_foundation", graph_attr=cluster_attr):
        n_ops_loganalytics_main = LogAnalyticsWorkspaces("log-analytics")
        n_ops_alert_group = Monitor("action-group")

    with Cluster("clu_tier_app", graph_attr=cluster_attr):
        n_web_swa_frontend = StaticApps("static-web-app")
        n_edge_cdn_global = FrontDoorAndCDNProfiles("cdn-profile")

    with Cluster("clu_tier_ops", graph_attr=cluster_attr):
        n_ops_metric_alert = Monitor("metric-alert")

    e_runtime = Edge(color="#1565C0", style="bold", penwidth="1.3")
    e_observe = Edge(color="#6A1B9A", style="dotted")

    n_ops_pipeline_main >> e_runtime >> [
        n_ops_loganalytics_main,
        n_ops_alert_group,
        n_web_swa_frontend,
    ]
    n_web_swa_frontend >> e_runtime >> n_edge_cdn_global
    n_edge_cdn_global >> Edge(label="request", **e_runtime.attrs) >> n_ops_metric_alert
    n_ops_alert_group >> Edge(label="admin", color="#E65100", style="dashed") >> n_ops_metric_alert
    n_ops_loganalytics_main >> Edge(label="telemetry", **e_observe.attrs) >> n_ops_metric_alert
