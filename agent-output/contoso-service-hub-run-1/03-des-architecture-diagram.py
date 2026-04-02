# pyright: reportMissingImports=false, reportUnusedExpression=false
"""Generate the Contoso Service Hub architecture diagram as a PNG."""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import AKS, ContainerApps, VM
from diagrams.azure.database import CacheForRedis, DatabaseForPostgresqlServers
from diagrams.azure.identity import ExternalIdentities
from diagrams.azure.integration import APIManagement
from diagrams.azure.monitor import ApplicationInsights, LogAnalyticsWorkspaces, Monitor
from diagrams.azure.network import ApplicationGateway, PrivateEndpoint
from diagrams.azure.security import KeyVaults
from diagrams.azure.storage import StorageAccounts
from diagrams.onprem.client import Users


OUTPUT_STEM = Path(__file__).with_name("03-des-architecture-diagram")
GRAPH_ATTR = {
    "bgcolor": "white",
    "dpi": "160",
    "fontname": "Arial Bold",
    "fontsize": "16",
    "nodesep": "0.8",
    "pad": "0.6",
    "rankdir": "LR",
    "ranksep": "1.0",
    "splines": "ortho",
}
NODE_ATTR = {
    "fontname": "Arial Bold",
    "fontsize": "11",
}
VNET_ATTR = {
    "bgcolor": "#E7F5FF",
    "fontname": "Arial Bold",
    "fontsize": "14",
    "labeljust": "l",
    "margin": "24",
}
SUBNET_ATTR = {
    "bgcolor": "#F8FBFF",
    "fontname": "Arial Bold",
    "fontsize": "12",
    "labeljust": "l",
    "margin": "20",
}
DATA_ATTR = {
    "bgcolor": "#FFF7E6",
    "fontname": "Arial Bold",
    "fontsize": "12",
    "labeljust": "l",
    "margin": "20",
}


def main() -> None:
    with Diagram(
        "Contoso Service Hub Architecture",
        show=False,
        filename=str(OUTPUT_STEM),
        direction="LR",
        graph_attr=GRAPH_ATTR,
        node_attr=NODE_ATTR,
        outformat="png",
    ):
        users = Users("EU Users")
        external_id = ExternalIdentities("Entra External ID\nCIAM + MFA")

        monitor = Monitor("Azure Monitor")
        app_insights = ApplicationInsights("Application Insights")
        log_analytics = LogAnalyticsWorkspaces("Log Analytics")

        with Cluster("Contoso Service Hub - swedencentral", graph_attr={"margin": "28"}):
            with Cluster("Virtual Network 10.20.0.0/16", graph_attr=VNET_ATTR):
                with Cluster("Ingress Subnet 10.20.0.0/24", graph_attr=SUBNET_ATTR):
                    app_gateway = ApplicationGateway("App Gateway\nWAF")
                    apim = APIManagement("API Management")

                with Cluster("AKS Subnet 10.20.1.0/24", graph_attr=SUBNET_ATTR):
                    aks = AKS("AKS Cluster")
                    web_pod = ContainerApps("web pod")
                    api_pod = ContainerApps("api pod")
                    worker_pod = ContainerApps("worker pod")

                with Cluster("Operations Subnet 10.20.2.0/24", graph_attr=SUBNET_ATTR):
                    ops_vm = VM("Operations VM")

                with Cluster("Private Endpoint Subnet 10.20.3.0/24", graph_attr=SUBNET_ATTR):
                    pe_postgres = PrivateEndpoint("PE - PostgreSQL")
                    pe_redis = PrivateEndpoint("PE - Redis")
                    pe_storage = PrivateEndpoint("PE - Storage")
                    pe_key_vault = PrivateEndpoint("PE - Key Vault")

            with Cluster("Managed Data Services", graph_attr=DATA_ATTR):
                postgres = DatabaseForPostgresqlServers("PostgreSQL\nFlexible Server")
                redis = CacheForRedis("Managed Redis\nEnterprise E100")
                storage = StorageAccounts("Storage Account\nZRS")
                key_vault = KeyVaults("Key Vault")

        users >> Edge(color="#0078D4", label="HTTPS") >> app_gateway
        users >> Edge(color="#5B2C83", style="dashed", label="OIDC / MFA") >> external_id
        external_id >> Edge(color="#5B2C83", style="dashed", label="tokens") >> app_gateway

        app_gateway >> Edge(color="#0078D4", label="ingress") >> apim
        apim >> Edge(color="#0078D4", label="private APIs") >> aks

        aks >> Edge(color="#0078D4") >> web_pod
        aks >> Edge(color="#0078D4") >> api_pod
        aks >> Edge(color="#0078D4") >> worker_pod

        api_pod >> Edge(color="#0078D4") >> pe_postgres >> postgres
        api_pod >> Edge(color="#0078D4") >> pe_redis >> redis
        web_pod >> Edge(color="#0078D4") >> pe_storage >> storage
        worker_pod >> Edge(color="#0078D4") >> pe_storage

        web_pod >> Edge(color="#666666", style="dashed") >> pe_key_vault >> key_vault
        api_pod >> Edge(color="#666666", style="dashed") >> pe_key_vault
        worker_pod >> Edge(color="#666666", style="dashed") >> pe_key_vault
        ops_vm >> Edge(color="#666666", style="dashed", label="admin") >> pe_key_vault

        app_gateway >> Edge(color="#8764B8", style="dashed") >> monitor
        apim >> Edge(color="#8764B8", style="dashed") >> monitor
        aks >> Edge(color="#8764B8", style="dashed") >> app_insights >> monitor
        ops_vm >> Edge(color="#8764B8", style="dashed") >> monitor
        monitor >> Edge(color="#8764B8", style="dashed") >> log_analytics


if __name__ == "__main__":
    main()