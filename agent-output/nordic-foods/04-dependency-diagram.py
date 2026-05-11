"""Nordic Fresh Foods — FreshConnect MVP — IaC Module Dependency Graph.

Maps Bicep module deploy order: Foundation -> Security -> Data -> Compute -> Edge.
Each node label matches an Implementation Task heading in 04-implementation-plan.md.
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import AppServices
from diagrams.azure.database import SQLDatabases
from diagrams.azure.devops import ApplicationInsights
from diagrams.azure.general import Resourcegroups, Subscriptions
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.monitor import LogAnalyticsWorkspaces
from diagrams.azure.network import (
    DNSPrivateZones,
    PrivateEndpoint,
    VirtualNetworks,
)
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import StorageAccounts
from diagrams.azure.web import AppServicePlans

graph_attr = {
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "0.9",
    "ranksep": "1.0",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "dpi": "150",
}
node_attr = {"fontname": "Arial Bold", "fontsize": "11", "labelloc": "t"}

with Diagram(
    "FreshConnect MVP - Module Dependency Graph (Bicep AVM)",
    filename="agent-output/nordic-foods/04-dependency-diagram",
    show=False,
    direction="TB",
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    sub = Subscriptions("Subscription\n(00858ffc...)")
    rg = Resourcegroups("rg-nordic-foods-prod\nswedencentral\n9 required tags")
    sub >> Edge(label="scope") >> rg

    with Cluster("Phase 1 - Foundation"):
        vnet = VirtualNetworks("vnet-nordic-foods-prod\navm/res/network/virtual-network 0.9.0\n10.40.0.0/22")
        law = LogAnalyticsWorkspaces("log-nordic-foods-prod\navm/res/operational-insights/workspace 0.15.1\nPAYG / 30d")
        ai = ApplicationInsights("appi-nordic-foods-prod\navm/res/insights/component 0.7.1\nworkspace-based")

    with Cluster("Phase 2 - Security"):
        kv = KeyVaults("kv-nf-prod-{sfx}\navm/res/key-vault/vault 0.13.3\nStandard / RBAC / SD+PP")
        kv_pe = PrivateEndpoint("pe-kv\nprivatelink.vaultcore.azure.net")
        kv_dns = DNSPrivateZones("privatelink.\nvaultcore.azure.net")

    with Cluster("Phase 3 - Data"):
        sql = SQLDatabases("sql-nordic-foods-prod\navm/res/sql/server 0.21.2\nS3 100 DTU AAD-only")
        sql_pe = PrivateEndpoint("pe-sql\nprivatelink.database.windows.net")
        sql_dns = DNSPrivateZones("privatelink.\ndatabase.windows.net")
        stg = StorageAccounts("stnfprod{sfx}\navm/res/storage/storage-account 0.32.0\nZRS Hot / blob-public=false")
        stg_pe = PrivateEndpoint("pe-blob\nprivatelink.blob.core.windows.net")
        stg_dns = DNSPrivateZones("privatelink.\nblob.core.windows.net")

    with Cluster("Phase 4 - Compute"):
        asp = AppServicePlans("asp-nordic-foods-prod\navm/res/web/serverfarm 0.7.0\nP1v3 Linux / autoscale 1-3")
        web = AppServices("app-nf-web-prod\navm/res/web/site 0.22.0\nSMI / TLS1.2 / HTTPS-only")
        api = AppServices("app-nf-api-prod\navm/res/web/site 0.22.0\nSMI / TLS1.2 / HTTPS-only")
        smi_web = ManagedIdentities("SMI (web)")
        smi_api = ManagedIdentities("SMI (api)")

    with Cluster("Phase 5 - Edge & Observability"):
        ag = ApplicationInsights("ag-nordic-foods-prod\navm/res/insights/action-group 0.8.0\nEmail + optional Teams")
        budget = ApplicationInsights("bdg-nordic-foods-prod\navm/res/consumption/budget/rg-scope 0.1.0\n80/100/120%")
        alert_web = ApplicationInsights("alert-nf-web-5xx-prod\navm/res/insights/metric-alert 0.5.0")
        alert_api = ApplicationInsights("alert-nf-api-5xx-prod\navm/res/insights/metric-alert 0.5.0")
        alert_sql = ApplicationInsights("alert-nf-sql-dtu-prod\navm/res/insights/metric-alert 0.5.0")

    # Phase 1 has no intra-RG deps; App Insights co-located with LAW
    rg >> Edge(style="dashed") >> [vnet, law, ai]
    ai >> Edge(label="workspace") >> law

    # Phase 2: KV PE needs VNet; KV diag needs LAW
    vnet >> Edge(label="subnet") >> kv_pe
    kv_pe >> kv
    kv_dns >> Edge(label="vnet-link") >> vnet
    kv_pe >> Edge(label="A record") >> kv_dns
    kv >> Edge(label="diag", style="dotted") >> law

    # Phase 3: SQL + Storage need VNet/PEs, LAW; not KV
    vnet >> Edge(label="subnet") >> sql_pe
    sql_pe >> sql
    sql_dns >> Edge(label="vnet-link") >> vnet
    sql_pe >> Edge(label="A record") >> sql_dns
    sql >> Edge(label="diag", style="dotted") >> law

    vnet >> Edge(label="subnet") >> stg_pe
    stg_pe >> stg
    stg_dns >> Edge(label="vnet-link") >> vnet
    stg_pe >> Edge(label="A record") >> stg_dns
    stg >> Edge(label="diag", style="dotted") >> law

    # Phase 4: Compute needs VNet (integration subnet), KV (secrets), SQL (AAD), Storage
    vnet >> Edge(label="vnet-int") >> asp
    asp >> web
    asp >> api
    web >> smi_web
    api >> smi_api
    smi_web >> Edge(label="role: KV Secrets User") >> kv
    smi_api >> Edge(label="role: KV Secrets User") >> kv
    smi_web >> Edge(label="role: Storage Blob Data Contrib") >> stg
    smi_api >> Edge(label="role: Storage Blob Data Contrib") >> stg
    smi_api >> Edge(label="AAD DB user (deploymentScript)") >> sql
    # Phase 4 apps consume Phase-1 App Insights connection string at deploy time
    web >> Edge(label="APPINSIGHTS_CONNECTIONSTRING") >> ai
    api >> Edge(label="APPINSIGHTS_CONNECTIONSTRING") >> ai
    web >> Edge(label="diag", style="dotted") >> law
    api >> Edge(label="diag", style="dotted") >> law

    # Phase 5: AG wired to alerts + budget; metric alerts scoped to Phase-4 resources
    ag >> Edge(label="alerts") >> law
    budget >> Edge(label="80/100/120% -> AG") >> ag
    alert_web >> Edge(label="scope") >> web
    alert_api >> Edge(label="scope") >> api
    alert_sql >> Edge(label="scope") >> sql
    [alert_web, alert_api, alert_sql] >> Edge(label="action") >> ag
