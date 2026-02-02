# Integration Migration Patterns

Common migration scenarios for Transparity presales - from legacy integration platforms to Azure Integration Services.

## BizTalk to Azure Migration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import (
    LogicApps, ServiceBus, APIManagement, IntegrationAccounts, 
    EventGridTopics, DataFactories
)
from diagrams.azure.compute import FunctionApps
from diagrams.azure.storage import BlobStorage
from diagrams.azure.database import SQL
from diagrams.azure.security import KeyVaults
from diagrams.onprem.compute import Server
from diagrams.onprem.database import MSSQL

with Diagram("BizTalk Migration to Azure", show=False, filename="biztalk-migration", direction="TB"):
    
    with Cluster("Legacy BizTalk (Decommission)"):
        biztalk = Server("BizTalk Server")
    
    with Cluster("Azure Integration Services"):
        with Cluster("Orchestration (replaces Orchestrations)"):
            logic = LogicApps("Logic Apps\\nStandard")
        
        with Cluster("Messaging (replaces MessageBox)"):
            bus = ServiceBus("Service Bus")
            grid = EventGridTopics("Event Grid")
        
        with Cluster("Transformation (replaces Maps/Pipelines)"):
            ia = IntegrationAccounts("Integration Account\\nMaps, Schemas")
            func = FunctionApps("Functions\\nCustom Transforms")
        
        with Cluster("APIs (replaces WCF Adapters)"):
            apim = APIManagement("API Management")
        
        with Cluster("B2B (replaces EDI)"):
            ia_b2b = IntegrationAccounts("B2B Trading\\nAS2, X12, EDIFACT")
    
    with Cluster("Data"):
        sql = SQL("Azure SQL")
        blob = BlobStorage("Blob Storage")
    
    kv = KeyVaults("Key Vault")
    
    biztalk >> Edge(style="dashed", label="Migrate") >> logic
    apim >> logic >> bus >> func
    logic - Edge(style="dashed") - ia
    func >> [sql, blob]
    logic >> Edge(style="dashed") >> kv
```

## MuleSoft to Azure Migration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus
from diagrams.azure.compute import FunctionApps, ContainerApps
from diagrams.azure.database import CosmosDb
from diagrams.azure.security import KeyVaults

with Diagram("MuleSoft Migration to Azure", show=False, filename="mulesoft-migration", direction="LR"):
    
    with Cluster("Azure Replacement"):
        with Cluster("API Layer (Anypoint → APIM)"):
            apim = APIManagement("API Management")
        
        with Cluster("Integration (Mule Flows → Logic Apps)"):
            logic = LogicApps("Logic Apps")
            func = FunctionApps("Functions")
        
        with Cluster("Messaging (MQ → Service Bus)"):
            bus = ServiceBus("Service Bus")
        
        with Cluster("Runtime (Mule Runtime → Container Apps)"):
            containers = ContainerApps("Container Apps\\n(Custom Code)")
    
    cosmos = CosmosDb("Cosmos DB")
    kv = KeyVaults("Key Vault")
    
    apim >> [logic, containers]
    logic >> bus >> func
    containers >> cosmos
    [logic, func, containers] >> Edge(style="dashed") >> kv
```

## SSIS to Azure Data Factory Migration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import DataFactories
from diagrams.azure.analytics import AzureDatabricks, AzureSynapseAnalytics
from diagrams.azure.storage import DataLakeStorage
from diagrams.azure.database import SQL, SQLManagedInstances
from diagrams.onprem.database import MSSQL

with Diagram("SSIS Migration to Azure Data Factory", show=False, filename="ssis-migration", direction="LR"):
    
    with Cluster("Legacy SSIS"):
        ssis = MSSQL("SSIS Packages")
    
    with Cluster("Azure Data Platform"):
        with Cluster("Orchestration"):
            adf = DataFactories("Data Factory\\nPipelines & Data Flows")
        
        with Cluster("Transformation"):
            databricks = AzureDatabricks("Databricks\\n(Complex ETL)")
            mapping = DataFactories("ADF Mapping\\nData Flows")
        
        with Cluster("Storage"):
            lake = DataLakeStorage("Data Lake Gen2")
        
        with Cluster("Serving"):
            synapse = AzureSynapseAnalytics("Synapse")
            sql = SQL("Azure SQL")
    
    ssis >> Edge(style="dashed", label="Migrate") >> adf
    adf >> [mapping, databricks] >> lake
    lake >> [synapse, sql]
```

## Dell Boomi to Azure Migration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus, AppConfiguration
from diagrams.azure.compute import FunctionApps
from diagrams.azure.security import KeyVaults
from diagrams.azure.monitor import ApplicationInsights

with Diagram("Boomi Migration to Azure", show=False, filename="boomi-migration", direction="LR"):
    
    with Cluster("Azure Integration Platform"):
        with Cluster("API Management (API Gateway)"):
            apim = APIManagement("APIM")
        
        with Cluster("Process Orchestration (Boomi Processes)"):
            logic = LogicApps("Logic Apps\\nWorkflows")
        
        with Cluster("Custom Logic (Scripting)"):
            func = FunctionApps("Functions")
        
        with Cluster("Messaging"):
            bus = ServiceBus("Service Bus")
        
        with Cluster("Configuration"):
            config = AppConfiguration("App Config")
    
    kv = KeyVaults("Key Vault")
    insights = ApplicationInsights("Monitoring")
    
    apim >> logic >> bus >> func
    [logic, func] >> Edge(style="dashed") >> kv
    [logic, func] >> Edge(style="dashed") >> config
    [logic, func] >> Edge(style="dotted") >> insights
```

## Common Customer Scenarios

### Scenario 1: D365/Dynamics Integration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus, DataFactories
from diagrams.azure.compute import FunctionApps
from diagrams.azure.database import SQL
from diagrams.azure.storage import DataLakeStorage
from diagrams.onprem.database import MSSQL

with Diagram("Dynamics 365 Integration", show=False, filename="d365-integration", direction="LR"):
    
    with Cluster("Dynamics 365"):
        d365 = SQL("Dataverse")
    
    with Cluster("Azure Integration"):
        apim = APIManagement("API Management")
        logic = LogicApps("Logic Apps")
        bus = ServiceBus("Service Bus")
        adf = DataFactories("Data Factory")
    
    with Cluster("Backend Systems"):
        erp = MSSQL("ERP")
        lake = DataLakeStorage("Data Lake")
    
    d365 >> apim >> logic >> bus >> erp
    d365 >> adf >> lake
```

### Scenario 2: SharePoint/M365 Integration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import LogicApps, ServiceBus, EventGridTopics
from diagrams.azure.compute import FunctionApps
from diagrams.azure.storage import BlobStorage
from diagrams.azure.database import SQL

with Diagram("SharePoint M365 Integration", show=False, filename="sharepoint-integration", direction="LR"):
    
    with Cluster("Microsoft 365"):
        sharepoint = BlobStorage("SharePoint")
        # Note: Using generic icon for M365
    
    grid = EventGridTopics("Event Grid\\n(M365 Events)")
    
    with Cluster("Processing"):
        logic = LogicApps("Logic Apps")
        func = FunctionApps("Functions")
    
    with Cluster("Backend"):
        bus = ServiceBus("Service Bus")
        sql = SQL("Azure SQL")
        blob = BlobStorage("Archive")
    
    sharepoint >> grid >> [logic, func]
    logic >> bus
    func >> [sql, blob]
```

### Scenario 3: SAP Integration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus, DataFactories
from diagrams.azure.compute import FunctionApps
from diagrams.azure.storage import DataLakeStorage
from diagrams.azure.database import CosmosDb
from diagrams.onprem.compute import Server

with Diagram("SAP Integration", show=False, filename="sap-integration", direction="LR"):
    
    with Cluster("SAP Landscape"):
        sap_ecc = Server("SAP ECC/S4")
        sap_bw = Server("SAP BW")
    
    with Cluster("Azure Integration"):
        with Cluster("Real-time"):
            apim = APIManagement("APIM\\n(OData/RFC)")
            logic = LogicApps("Logic Apps\\n(SAP Connector)")
            bus = ServiceBus("Service Bus")
        
        with Cluster("Batch"):
            adf = DataFactories("Data Factory\\n(SAP Table/CDC)")
    
    with Cluster("Azure Data"):
        cosmos = CosmosDb("Cosmos DB")
        lake = DataLakeStorage("Data Lake")
    
    sap_ecc >> apim >> logic >> bus >> cosmos
    [sap_ecc, sap_bw] >> adf >> lake
```

### Scenario 4: Salesforce Integration

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus, EventGridTopics
from diagrams.azure.compute import FunctionApps
from diagrams.azure.database import SQL, CosmosDb
from diagrams.generic.compute import Rack

with Diagram("Salesforce Integration", show=False, filename="salesforce-integration", direction="LR"):
    
    salesforce = Rack("Salesforce")
    
    with Cluster("Event Capture"):
        grid = EventGridTopics("Event Grid\\n(Platform Events)")
        webhook = FunctionApps("Webhook\\nReceiver")
    
    with Cluster("Integration"):
        logic = LogicApps("Logic Apps\\n(SF Connector)")
        bus = ServiceBus("Service Bus")
    
    with Cluster("Azure Systems"):
        sql = SQL("Azure SQL")
        cosmos = CosmosDb("Cosmos DB")
    
    apim = APIManagement("APIM\\n(Outbound)")
    
    salesforce >> [webhook, grid] >> logic >> bus
    logic >> [sql, cosmos]
    apim >> salesforce
```

## Landing Zone Integration Pattern

Standard integration deployment within Azure Landing Zone:

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.integration import APIManagement, LogicApps, ServiceBus
from diagrams.azure.compute import FunctionApps
from diagrams.azure.networking import (
    VirtualNetworks, ApplicationGateways, Firewalls,
    ExpressrouteCircuits, PrivateLink
)
from diagrams.azure.security import KeyVaults, Sentinel
from diagrams.azure.monitor import Monitor, LogAnalyticsWorkspaces
from diagrams.azure.database import SQL, CosmosDb
from diagrams.azure.identity import ActiveDirectory
from diagrams.azure.managementgovernance import Policy

with Diagram("Landing Zone Integration", show=False, filename="landing-zone", direction="TB"):
    
    with Cluster("Platform"):
        aad = ActiveDirectory("Azure AD")
        policy = Policy("Azure Policy")
        sentinel = Sentinel("Sentinel")
        logs = LogAnalyticsWorkspaces("Log Analytics")
    
    with Cluster("Connectivity"):
        expressroute = ExpressrouteCircuits("ExpressRoute")
        firewall = Firewalls("Azure Firewall")
    
    with Cluster("Landing Zone - Integration"):
        with Cluster("DMZ"):
            appgw = ApplicationGateways("App Gateway WAF")
        
        with Cluster("Integration VNet"):
            apim = APIManagement("APIM")
            logic = LogicApps("Logic Apps")
            func = FunctionApps("Functions")
            bus = ServiceBus("Service Bus")
        
        with Cluster("Data VNet"):
            sql = SQL("Azure SQL")
            cosmos = CosmosDb("Cosmos DB")
            kv = KeyVaults("Key Vault")
    
    expressroute >> firewall >> appgw >> apim
    apim >> [logic, func] >> bus
    [logic, func] >> [sql, cosmos]
    [logic, func] >> Edge(style="dashed") >> kv
    [apim, logic, func] >> Edge(style="dotted") >> logs >> sentinel
    policy >> [apim, logic, func, sql, cosmos]
```
