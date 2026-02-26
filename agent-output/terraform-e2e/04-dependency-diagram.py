from diagrams import Diagram, Cluster, Edge
from diagrams.azure.web import StaticApps, AppServices
from diagrams.azure.database import SQLDatabases
from diagrams.azure.security import KeyVaults
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces
from diagrams.azure.storage import BlobStorage
from diagrams.azure.general import Resourcegroups
from diagrams.generic.compute import Rack

graph_attr = {
    "nodesep": "0.8",
    "ranksep": "1.2",
    "splines": "ortho",
    "pad": "0.5",
}

with Diagram(
    "terraform-e2e module dependency graph",
    show=False,
    direction="TB",
    filename="agent-output/terraform-e2e/04-dependency-diagram",
    graph_attr=graph_attr,
):
    with Cluster("Phase 1: Foundation & Monitoring"):
        n_suffix = Rack("random_string\nsuffix")
        n_rg = Resourcegroups("azurerm_resource_group\nrg-terraform-e2e-dev")
        n_log = LogAnalyticsWorkspaces("avm-res-operationalinsights\nworkspace ~> 0.5")
        n_appi = ApplicationInsights("avm-res-insights\ncomponent ~> 0.3")

    with Cluster("Phase 2: Security & Data"):
        n_kv = KeyVaults("avm-res-keyvault\nvault ~> 0.10")
        n_sql = SQLDatabases("avm-res-sql\nserver ~> 0.1")

    with Cluster("Phase 3: Compute & Frontend"):
        n_asp = AppServices("avm-res-web\nserverfarm ~> 2.0")
        n_app = AppServices("avm-res-web\nsite ~> 0.21")
        n_swa = StaticApps("avm-res-web\nstaticsite ~> 0.6")
        n_state = BlobStorage("bootstrap\nstate backend")

    # Phase 1 internal dependencies
    n_suffix >> Edge(label="suffix", style="dashed") >> n_rg
    n_rg >> Edge(label="resource_group_name") >> n_log
    n_log >> Edge(label="workspace_resource_id") >> n_appi

    # Phase 2 depends on Phase 1
    n_rg >> Edge(label="resource_group_name") >> n_kv
    n_rg >> Edge(label="resource_group_name") >> n_sql

    # Phase 3 depends on Phase 1 + 2
    n_rg >> Edge(label="resource_group_name") >> n_asp
    n_asp >> Edge(label="service_plan_resource_id") >> n_app
    n_kv >> Edge(label="vault_uri", color="darkgreen") >> n_app
    n_appi >> Edge(label="connection_string", style="dashed", color="dimgray") >> n_app
    n_sql >> Edge(label="server_fqdn", color="blue") >> n_app
    n_rg >> Edge(label="resource_group_name") >> n_swa
