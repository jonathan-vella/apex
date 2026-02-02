# Azure Integration Components Reference

Complete import reference for Azure architecture diagrams.

## Integration Services

```python
from diagrams.azure.integration import (
    LogicApps,                    # Logic Apps workflows
    LogicAppsCustomConnector,     # Custom connectors
    IntegrationAccounts,          # B2B/EDI integration accounts
    IntegrationServiceEnvironments, # ISE (dedicated)
    ServiceBus,                   # Service Bus namespaces
    APIManagement,                # API Management
    EventGridTopics,              # Event Grid custom topics
    EventGridDomains,             # Event Grid domains
    EventGridSubscriptions,       # Event Grid subscriptions
    SystemTopic,                  # Event Grid system topics
    DataFactories,                # Data Factory
    AppConfiguration,             # App Configuration
    Relays,                       # Azure Relay
    ServiceBusRelays,             # Hybrid Connections
    AzureDataCatalog,             # Data Catalog
    AzureDataboxGateway,          # Data Box Gateway
    SendgridAccounts,             # SendGrid
    PartnerTopic,                 # Event Grid partner topics
    PartnerNamespace,             # Event Grid partner namespaces
)
```

## Compute

```python
from diagrams.azure.compute import (
    FunctionApps,          # Azure Functions
    AppServices,           # App Service / Web Apps
    ContainerApps,         # Container Apps
    ContainerInstances,    # Container Instances
    AKS,                   # Azure Kubernetes Service
    KubernetesServices,    # AKS (alternate)
    ACR,                   # Container Registry
    VM,                    # Virtual Machines
    VMLinux,               # Linux VM
    VMWindows,             # Windows VM
    VMSS,                  # VM Scale Sets
    BatchAccounts,         # Azure Batch
    ServiceFabricClusters, # Service Fabric
    AzureSpringApps,       # Spring Apps
    CloudServices,         # Cloud Services
)
```

## Analytics & Streaming

```python
from diagrams.azure.analytics import (
    EventHubs,              # Event Hubs
    EventHubClusters,       # Event Hubs dedicated clusters
    StreamAnalyticsJobs,    # Stream Analytics
    AzureDatabricks,        # Databricks
    DataFactories,          # Data Factory (also in integration)
    AzureSynapseAnalytics,  # Synapse Analytics
    DataLakeAnalytics,      # Data Lake Analytics
    DataLakeStoreGen1,      # Data Lake Storage Gen1
    HDInsightClusters,      # HDInsight
    LogAnalyticsWorkspaces, # Log Analytics
    PowerBiEmbedded,        # Power BI Embedded
)
```

## Storage

```python
from diagrams.azure.storage import (
    StorageAccounts,        # Storage Accounts
    BlobStorage,            # Blob Storage
    QueuesStorage,          # Queue Storage
    TableStorage,           # Table Storage
    AzureFileshares,        # File Shares
    DataLakeStorage,        # Data Lake Gen2
    AzureNetappFiles,       # NetApp Files
    DataBox,                # Data Box
    ArchiveStorage,         # Archive tier
    DataShares,             # Data Share
)
```

## Database

```python
from diagrams.azure.database import (
    CosmosDb,                      # Cosmos DB
    SQL,                           # Azure SQL
    SQLDatabases,                  # SQL Database
    SQLManagedInstances,           # SQL Managed Instance
    SQLServers,                    # SQL Server
    CacheForRedis,                 # Redis Cache
    DatabaseForMysqlServers,       # MySQL
    DatabaseForPostgresqlServers,  # PostgreSQL
    DatabaseForMariadbServers,     # MariaDB
    DataFactory,                   # Data Factory
    SynapseAnalytics,              # Synapse
)
```

## Networking

```python
from diagrams.azure.networking import (
    VirtualNetworks,          # VNet
    Subnet,                   # Subnet
    ApplicationGateways,      # Application Gateway
    LoadBalancers,            # Load Balancer
    Firewalls,                # Azure Firewall
    FrontDoorAndCDNProfiles,  # Front Door / CDN
    CDNProfiles,              # CDN
    ExpressrouteCircuits,     # ExpressRoute
    VirtualNetworkGateways,   # VPN Gateway
    LocalNetworkGateways,     # On-prem gateway
    Bastions,                 # Bastion
    PrivateLink,              # Private Link
    PrivateLinkService,       # Private Link Service
    DNSZones,                 # DNS Zones
    TrafficManagerProfiles,   # Traffic Manager
    NetworkSecurityGroups,    # NSG
    PublicIpAddresses,        # Public IP
    OnPremisesDataGateways,   # On-premises data gateway
)
```

## Security & Identity

```python
from diagrams.azure.security import (
    KeyVaults,                 # Key Vault
    SecurityCenter,            # Security Center
    Sentinel,                  # Microsoft Sentinel
    Defender,                  # Defender for Cloud
    ApplicationSecurityGroups, # ASG
    AzureInformationProtection,# AIP
)

from diagrams.azure.identity import (
    ActiveDirectory,           # Azure AD / Entra ID
    ManagedIdentities,         # Managed Identities
    AzureADB2C,               # Azure AD B2C
    ConditionalAccess,         # Conditional Access
    ADDomainServices,          # Domain Services
    AppRegistrations,          # App Registrations
)
```

## Monitoring & Management

```python
from diagrams.azure.monitor import (
    Monitor,               # Azure Monitor
    ApplicationInsights,   # App Insights
    LogAnalyticsWorkspaces,# Log Analytics
    Metrics,               # Metrics
    Alerts,                # Alerts (use from managementgovernance)
    ChangeAnalysis,        # Change Analysis
)

from diagrams.azure.managementgovernance import (
    Policy,                # Azure Policy
    Blueprints,            # Blueprints
    Advisor,               # Advisor
    CostManagementAndBilling, # Cost Management
    AutomationAccounts,    # Automation
    AzureArc,              # Azure Arc
)
```

## DevOps

```python
from diagrams.azure.devops import (
    AzureDevops,           # Azure DevOps
    Repos,                 # Azure Repos
    Pipelines,             # Azure Pipelines
    Boards,                # Azure Boards
    Artifacts,             # Azure Artifacts
    TestPlans,             # Test Plans
    DevtestLabs,           # DevTest Labs
    ApplicationInsights,   # App Insights
)
```

## AI / ML

```python
from diagrams.azure.ml import (
    MachineLearningServiceWorkspaces,  # ML Workspace
    CognitiveServices,                 # Cognitive Services
    BotServices,                       # Bot Services
    AzureOpenAI,                       # Azure OpenAI
)

from diagrams.azure.aimachinelearning import (
    AIStudio,              # AI Studio
    AzureOpenai,           # OpenAI
    CognitiveSearch,       # Cognitive Search
    FormRecognizers,       # Form Recognizer
    Language,              # Language Service
    TranslatorText,        # Translator
)
```

## IoT

```python
from diagrams.azure.iot import (
    IotHub,                    # IoT Hub
    IotEdge,                   # IoT Edge
    IotCentralApplications,    # IoT Central
    DigitalTwins,              # Digital Twins
    DeviceProvisioningServices,# DPS
    TimeSeriesInsightsEnvironments, # Time Series Insights
)
```

## On-Premises / External Systems

```python
from diagrams.onprem.database import (
    MSSQL,         # SQL Server on-prem
    Oracle,        # Oracle DB
    MySQL,         # MySQL
    PostgreSQL,    # PostgreSQL
    MongoDB,       # MongoDB
)

from diagrams.onprem.compute import (
    Server,        # Generic server
)

from diagrams.onprem.client import (
    Users,         # Users icon
    Client,        # Client application
)

from diagrams.onprem.network import (
    Internet,      # Internet cloud
)

from diagrams.generic.database import SQL as GenericSQL
from diagrams.generic.compute import Rack
from diagrams.generic.storage import Storage as GenericStorage

from diagrams.saas.chat import Teams
from diagrams.saas.erp import SAP
from diagrams.saas.cdn import Cloudflare
```

## Custom Icons

For services not in the library, use custom icons:

```python
from diagrams.custom import Custom

# Download icon to local file first
dynamics = Custom("Dynamics 365", "./icons/dynamics365.png")
power_platform = Custom("Power Platform", "./icons/powerplatform.png")
```
