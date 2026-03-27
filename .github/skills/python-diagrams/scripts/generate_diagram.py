#!/usr/bin/env python3
"""
Azure Architecture Diagram Generator
Interactive script for quickly generating professional diagrams.

Usage:
    python generate_diagram.py --name "Customer Integration" --pattern api-led --output customer-arch
    python generate_diagram.py --interactive
"""

import argparse
import sys
from pathlib import Path

# Pattern templates - easily extensible
PATTERNS = {
    "api-led": {
        "description": "API-Led Connectivity (3-tier: Experience, Process, System)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus
from diagrams.azure.compute import FunctionApps
from diagrams.azure.database import CosmosDb, SQL
from diagrams.azure.storage import BlobStorage
from diagrams.azure.security import KeyVaults
from diagrams.onprem.client import Users

with Diagram("{name}", show=False, filename="{output}", direction="LR",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    users = Users("API Consumers")
    
    with Cluster("Experience Layer"):
        apim = APIManagement("API Management")
    
    with Cluster("Process Layer"):
        logic = LogicApps("Orchestration")
        func = FunctionApps("Transformation")
    
    with Cluster("System Layer"):
        bus = ServiceBus("Service Bus")
    
    with Cluster("Data Layer"):
        cosmos = CosmosDb("Cosmos DB")
        sql = SQL("Azure SQL")
        blob = BlobStorage("Blob Storage")
    
    kv = KeyVaults("Key Vault")
    
    users >> apim >> logic >> bus >> func
    func >> [cosmos, sql, blob]
    logic >> Edge(style="dashed") >> kv
'''
    },
    
    "hybrid": {
        "description": "Hybrid Integration (On-premises to Azure)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import LogicApps, ServiceBus, DataFactories
from diagrams.azure.networking import OnPremisesDataGateways
from diagrams.azure.storage import DataLakeStorage, BlobStorage
from diagrams.azure.database import CosmosDb
from diagrams.azure.security import KeyVaults
from diagrams.onprem.database import MSSQL
from diagrams.onprem.compute import Server

with Diagram("{name}", show=False, filename="{output}", direction="LR",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    with Cluster("On-Premises"):
        erp = Server("ERP System")
        sql = MSSQL("SQL Server")
        files = Server("File Server")
    
    gateway = OnPremisesDataGateways("Data Gateway")
    
    with Cluster("Azure Integration"):
        logic = LogicApps("Logic Apps")
        adf = DataFactories("Data Factory")
        bus = ServiceBus("Service Bus")
    
    with Cluster("Azure Data"):
        cosmos = CosmosDb("Cosmos DB")
        lake = DataLakeStorage("Data Lake")
        blob = BlobStorage("Blob Storage")
    
    kv = KeyVaults("Key Vault")
    
    [erp, sql] >> gateway >> logic >> bus
    files >> gateway >> adf >> lake
    logic >> cosmos
    adf >> blob
    logic >> Edge(style="dashed") >> kv
'''
    },
    
    "event-driven": {
        "description": "Event-Driven Architecture (Pub/Sub with multiple handlers)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import ServiceBus, EventGridTopics, LogicApps
from diagrams.azure.compute import FunctionApps, AppServices
from diagrams.azure.database import CosmosDb
from diagrams.azure.storage import BlobStorage
from diagrams.azure.monitor import ApplicationInsights

with Diagram("{name}", show=False, filename="{output}", direction="TB",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    with Cluster("Event Producers"):
        app1 = AppServices("Order Service")
        app2 = AppServices("Inventory Service")
    
    with Cluster("Event Routing"):
        bus = ServiceBus("Service Bus Topics")
        grid = EventGridTopics("Event Grid")
    
    with Cluster("Event Handlers"):
        func1 = FunctionApps("Notifier")
        func2 = FunctionApps("Analytics")
        logic = LogicApps("Fulfillment")
        func3 = FunctionApps("Audit")
    
    with Cluster("Data"):
        cosmos = CosmosDb("Event Store")
        blob = BlobStorage("Archive")
    
    insights = ApplicationInsights("Monitoring")
    
    [app1, app2] >> bus >> [func1, func2, logic]
    app1 >> grid >> func3
    [func1, logic] >> cosmos
    func3 >> blob
    func2 >> Edge(style="dotted") >> insights
'''
    },
    
    "microservices": {
        "description": "Microservices with Service Bus (Domain-driven design)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, ServiceBus
from diagrams.azure.compute import ContainerApps, FunctionApps
from diagrams.azure.database import CosmosDb, SQL, CacheForRedis
from diagrams.azure.monitor import ApplicationInsights

with Diagram("{name}", show=False, filename="{output}", direction="TB",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    apim = APIManagement("API Gateway")
    
    with Cluster("Microservices"):
        with Cluster("Order Domain"):
            order_svc = ContainerApps("Order Service")
            order_db = CosmosDb("Orders")
        
        with Cluster("Product Domain"):
            product_svc = ContainerApps("Product Service")
            product_db = SQL("Products")
        
        with Cluster("Notification Domain"):
            notif_svc = FunctionApps("Notification Service")
    
    bus = ServiceBus("Event Bus")
    cache = CacheForRedis("Cache")
    insights = ApplicationInsights("App Insights")
    
    apim >> [order_svc, product_svc]
    order_svc >> order_db
    product_svc >> product_db
    order_svc >> bus >> [product_svc, notif_svc]
    [order_svc, product_svc] >> cache
    [order_svc, product_svc, notif_svc] >> Edge(style="dotted") >> insights
'''
    },
    
    "b2b-edi": {
        "description": "B2B/EDI Integration (Trading partners with Integration Accounts)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, IntegrationAccounts, ServiceBus
from diagrams.azure.storage import BlobStorage
from diagrams.azure.security import KeyVaults
from diagrams.onprem.client import Client
from diagrams.onprem.compute import Server

with Diagram("{name}", show=False, filename="{output}", direction="LR",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    with Cluster("Trading Partners"):
        partner1 = Client("Supplier A")
        partner2 = Client("Supplier B")
        partner3 = Client("Customer")
    
    apim = APIManagement("AS2/SFTP Gateway")
    
    with Cluster("B2B Processing"):
        ia = IntegrationAccounts("Integration Account\\n(Maps, Schemas, Certs)")
        logic = LogicApps("EDI Processing")
        bus = ServiceBus("Message Queue")
    
    with Cluster("Backend"):
        erp = Server("ERP System")
        archive = BlobStorage("EDI Archive")
    
    kv = KeyVaults("Certificates & Keys")
    
    [partner1, partner2, partner3] >> apim >> logic
    logic - Edge(style="dashed") - ia
    logic >> bus >> erp
    logic >> archive
    ia >> Edge(style="dashed") >> kv
'''
    },
    
    "data-pipeline": {
        "description": "Data Pipeline (ETL/ELT with Data Factory and Synapse)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import DataFactories
from diagrams.azure.analytics import AzureDatabricks, AzureSynapseAnalytics
from diagrams.azure.storage import DataLakeStorage, BlobStorage
from diagrams.azure.database import SQL
from diagrams.onprem.database import MSSQL, Oracle

with Diagram("{name}", show=False, filename="{output}", direction="LR",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    with Cluster("Data Sources"):
        sql_src = MSSQL("On-Prem SQL")
        oracle = Oracle("Oracle")
        blob_src = BlobStorage("File Drops")
    
    with Cluster("Ingestion"):
        adf = DataFactories("Data Factory")
    
    with Cluster("Data Lake"):
        raw = DataLakeStorage("Raw Zone")
        curated = DataLakeStorage("Curated Zone")
    
    with Cluster("Transform"):
        databricks = AzureDatabricks("Databricks")
    
    with Cluster("Serve"):
        synapse = AzureSynapseAnalytics("Synapse Analytics")
        sql_dw = SQL("Azure SQL DW")
    
    [sql_src, oracle, blob_src] >> adf >> raw
    raw >> databricks >> curated
    curated >> [synapse, sql_dw]
'''
    },
    
    "secure-private": {
        "description": "Secure Architecture (Private Endpoints and VNet Integration)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus
from diagrams.azure.compute import FunctionApps
from diagrams.azure.networking import ApplicationGateways, VirtualNetworks
from diagrams.azure.database import SQL, CosmosDb
from diagrams.azure.storage import BlobStorage
from diagrams.azure.security import KeyVaults
from diagrams.onprem.client import Users

with Diagram("{name}", show=False, filename="{output}", direction="TB",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    users = Users("Users")
    appgw = ApplicationGateways("App Gateway + WAF")
    
    with Cluster("Virtual Network"):
        with Cluster("Integration Subnet"):
            apim = APIManagement("APIM (Internal)")
            logic = LogicApps("Logic Apps")
            func = FunctionApps("Functions")
        
        with Cluster("Data Subnet (Private Endpoints)"):
            sql = SQL("Azure SQL")
            cosmos = CosmosDb("Cosmos DB")
            blob = BlobStorage("Storage")
            bus = ServiceBus("Service Bus")
            kv = KeyVaults("Key Vault")
    
    users >> appgw >> apim >> [logic, func]
    logic >> bus
    logic >> [sql, cosmos, blob]
    func >> [sql, cosmos]
    logic >> Edge(style="dashed") >> kv
    func >> Edge(style="dashed") >> kv
'''
    },
    
    "multi-region": {
        "description": "Multi-Region HA (Geo-redundant with Front Door)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus
from diagrams.azure.networking import FrontDoorAndCDNProfiles
from diagrams.azure.database import CosmosDb, SQL

with Diagram("{name}", show=False, filename="{output}", direction="TB",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    frontdoor = FrontDoorAndCDNProfiles("Azure Front Door")
    
    with Cluster("UK South (Primary)"):
        apim1 = APIManagement("APIM")
        logic1 = LogicApps("Logic Apps")
        bus1 = ServiceBus("Service Bus")
        sql1 = SQL("SQL Primary")
    
    with Cluster("UK West (DR)"):
        apim2 = APIManagement("APIM")
        logic2 = LogicApps("Logic Apps")
        bus2 = ServiceBus("Service Bus")
        sql2 = SQL("SQL Secondary")
    
    cosmos = CosmosDb("Cosmos DB\\n(Multi-Region)")
    
    frontdoor >> [apim1, apim2]
    apim1 >> logic1 >> bus1
    apim2 >> logic2 >> bus2
    logic1 >> cosmos
    logic2 >> cosmos
    sql1 - Edge(style="dashed", label="Geo-Rep") - sql2
'''
    },
    
    "iot-streaming": {
        "description": "IoT & Streaming (Real-time data ingestion and processing)",
        "template": '''
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.iot import IotHub, IotEdge
from diagrams.azure.analytics import EventHubs, StreamAnalyticsJobs
from diagrams.azure.compute import FunctionApps
from diagrams.azure.database import CosmosDb
from diagrams.azure.storage import DataLakeStorage
from diagrams.azure.ml import MachineLearningServiceWorkspaces

with Diagram("{name}", show=False, filename="{output}", direction="LR",
             graph_attr={{"fontsize": "20", "bgcolor": "white", "pad": "0.5"}}):
    
    with Cluster("Edge"):
        edge = IotEdge("IoT Edge")
    
    with Cluster("Ingestion"):
        iot = IotHub("IoT Hub")
        eh = EventHubs("Event Hubs")
    
    with Cluster("Processing"):
        asa = StreamAnalyticsJobs("Stream Analytics")
        func = FunctionApps("Alerting")
    
    with Cluster("Storage"):
        cosmos = CosmosDb("Hot Store")
        lake = DataLakeStorage("Cold Store")
    
    ml = MachineLearningServiceWorkspaces("ML Workspace")
    
    edge >> iot >> asa
    asa >> [cosmos, lake, func]
    eh >> asa
    lake >> ml
'''
    },
}


def generate_diagram(name: str, pattern: str, output: str):
    """Generate a diagram from a pattern template."""
    if pattern not in PATTERNS:
        print(f"Error: Unknown pattern '{pattern}'")
        print(f"Available patterns: {', '.join(PATTERNS.keys())}")
        sys.exit(1)
    
    template = PATTERNS[pattern]["template"]
    code = template.format(name=name, output=output)
    
    # Execute the generated code
    exec(code)
    print(f"✅ Generated: {output}.png")


def interactive_mode():
    """Interactive diagram generation."""
    print("\n🔷 Azure Architecture Diagram Generator")
    print("=" * 50)
    
    # Show available patterns
    print("\nAvailable patterns:")
    for i, (key, val) in enumerate(PATTERNS.items(), 1):
        print(f"  {i}. {key}: {val['description']}")
    
    # Get pattern selection
    print()
    choice = input("Select pattern (number or name): ").strip()
    
    # Handle numeric or name input
    if choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(PATTERNS):
            pattern = list(PATTERNS.keys())[idx]
        else:
            print("Invalid selection")
            sys.exit(1)
    else:
        pattern = choice.lower().replace(" ", "-")
    
    if pattern not in PATTERNS:
        print(f"Unknown pattern: {pattern}")
        sys.exit(1)
    
    # Get diagram name
    name = input("Diagram title [Azure Architecture]: ").strip()
    if not name:
        name = "Azure Architecture"
    
    # Get output filename
    output = input("Output filename [architecture]: ").strip()
    if not output:
        output = "architecture"
    
    # Remove .png extension if provided
    output = output.replace(".png", "")
    
    print(f"\nGenerating {pattern} diagram: '{name}'...")
    generate_diagram(name, pattern, output)


def list_patterns():
    """List all available patterns."""
    print("\n🔷 Available Architecture Patterns")
    print("=" * 50)
    for key, val in PATTERNS.items():
        print(f"\n  {key}")
        print(f"    {val['description']}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Generate Azure architecture diagrams",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --interactive
  %(prog)s --list
  %(prog)s --name "Customer Portal" --pattern api-led --output customer-portal
  %(prog)s -n "Data Platform" -p data-pipeline -o data-arch
        """
    )
    
    parser.add_argument("-i", "--interactive", action="store_true",
                        help="Interactive mode")
    parser.add_argument("-l", "--list", action="store_true",
                        help="List available patterns")
    parser.add_argument("-n", "--name", type=str,
                        help="Diagram title")
    parser.add_argument("-p", "--pattern", type=str,
                        help="Pattern name (e.g., api-led, hybrid, event-driven)")
    parser.add_argument("-o", "--output", type=str, default="architecture",
                        help="Output filename (without extension)")
    
    args = parser.parse_args()
    
    if args.list:
        list_patterns()
    elif args.interactive:
        interactive_mode()
    elif args.name and args.pattern:
        generate_diagram(args.name, args.pattern, args.output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
