# Azure Components Reference

Complete list of 700+ Azure components available in the `diagrams` library with official Microsoft icons.

## Quick Import Examples

```python
# Most common services
from diagrams.azure.compute import FunctionApps, AKS, VM, AppServices, ContainerApps
from diagrams.azure.network import ApplicationGateway, LoadBalancers, VirtualNetworks, Firewall
from diagrams.azure.database import CosmosDb, SQLDatabases, CacheForRedis
from diagrams.azure.storage import BlobStorage, StorageAccounts, DataLakeStorage
from diagrams.azure.integration import LogicApps, ServiceBus, APIManagement, EventGridTopics
from diagrams.azure.security import KeyVaults, Sentinel, Defender
from diagrams.azure.identity import ActiveDirectory, ManagedIdentities, ConditionalAccess
from diagrams.azure.ml import CognitiveServices, MachineLearningServiceWorkspaces
from diagrams.azure.analytics import Databricks, SynapseAnalytics, EventHubs
from diagrams.azure.web import AppServices, StaticApps
from diagrams.azure.devops import AzureDevops, Pipelines, Repos
from diagrams.azure.monitor import Monitor, ApplicationInsights, LogAnalyticsWorkspaces
```

---

## AI & Machine Learning (42 components)

### diagrams.azure.aimachinelearning
```python
from diagrams.azure.aimachinelearning import (
    AIStudio, AnomalyDetector, AzureAppliedAIServices, AzureOpenai,
    BotServices, CognitiveSearch, CognitiveServices, ComputerVision,
    ContentModerators, CustomVision, FaceApis, FormRecognizers,
    ImmersiveReaders, Language, LanguageUnderstanding, MachineLearning,
    MetricsAdvisor, Personalizers, QnaMakers, SpeechServices, TranslatorText
)
```

### diagrams.azure.ml
```python
from diagrams.azure.ml import (
    AzureOpenAI, AzureSpeechService, BatchAI, BotServices,
    CognitiveServices, GenomicsAccounts, MachineLearningServiceWorkspaces,
    MachineLearningStudioWebServicePlans, MachineLearningStudioWebServices,
    MachineLearningStudioWorkspaces
)
```

---

## Analytics (20 components)

```python
from diagrams.azure.analytics import (
    AnalysisServices, AzureDataExplorerClusters, AzureDatabricks,
    AzureSynapseAnalytics, AzureWorkbooks, DataExplorerClusters,
    DataFactories, DataLakeAnalytics, DataLakeStoreGen1, Databricks,
    EndpointAnalytics, EventHubClusters, EventHubs, HDInsightClusters,
    LogAnalyticsWorkspaces, PowerBiEmbedded, PowerPlatform,
    PrivateLinkServices, StreamAnalyticsJobs, SynapseAnalytics
)
```

---

## Compute (56 components)

```python
from diagrams.azure.compute import (
    # Core Compute
    VM, VMLinux, VMWindows, VirtualMachine, VMSS, VMScaleSet,
    AvailabilitySets, AutomanagedVM,
    
    # Containers
    AKS, ACR, ContainerApps, ContainerInstances, ContainerRegistries,
    KubernetesServices, ServiceFabricClusters, ManagedServiceFabric,
    
    # App Services
    AppServices, FunctionApps, AzureSpringApps, SpringCloud,
    
    # Virtual Desktop
    ApplicationGroup, HostGroups, HostPools, Hosts, Workspaces,
    CitrixVirtualDesktopsEssentials,
    
    # Other
    BatchAccounts, CloudServices, DiskEncryptionSets, Disks,
    DiskSnapshots, Images, SAPHANAOnAzure, SharedImageGalleries
)
```

---

## Containers (7 components)

```python
from diagrams.azure.containers import (
    AppServices, AzureRedHatOpenshift, BatchAccounts,
    ContainerInstances, ContainerRegistries, KubernetesServices,
    ServiceFabricClusters
)
```

---

## Database (51 components)

### diagrams.azure.database
```python
from diagrams.azure.database import (
    CosmosDb, SQL, SQLDatabases, SQLServers, SQLManagedInstances,
    CacheForRedis, DataFactory, DataLake, DatabaseForMariadbServers,
    DatabaseForMysqlServers, DatabaseForPostgresqlServers,
    ElasticDatabasePools, SQLDatawarehouse, SynapseAnalytics
)
```

### diagrams.azure.databases
```python
from diagrams.azure.databases import (
    AzureCosmosDb, AzureSQL, AzureSQLVM, AzureSynapseAnalytics,
    CacheRedis, DataFactories, OracleDatabase, SQLDatabase,
    SQLElasticPools, SQLManagedInstance, SQLServer
)
```

---

## DevOps (18 components)

```python
from diagrams.azure.devops import (
    AzureDevops, Devops, DevopsStarter, Pipelines, Repos, Boards,
    Artifacts, TestPlans, ApplicationInsights, DevtestLabs,
    LabAccounts, LabServices, LoadTesting, ChangeAnalysis,
    Cloudtest, CodeOptimization, APIConnections, APIManagementServices
)
```

---

## Identity (41 components)

```python
from diagrams.azure.identity import (
    # Core Identity
    ActiveDirectory, AzureActiveDirectory, ADB2C, AzureADB2C,
    
    # Entra ID (new naming)
    EntraConnect, EntraDomainServices, EntraIDProtection,
    EntraManagedIdentities, EntraPrivlegedIdentityManagement, EntraVerifiedID,
    
    # Identity Protection
    ADIdentityProtection, ADPrivilegedIdentityManagement,
    ConditionalAccess, ManagedIdentities, AccessReview,
    
    # App Registration
    AppRegistrations, EnterpriseApplications, APIProxy,
    
    # Groups & Users
    Users, Groups, ExternalIdentities, AdministrativeUnits,
    
    # Security Features
    IdentityGovernance, GlobalSecureAccess, PrivateAccess, InternetAccess,
    AzureInformationProtection, InformationProtection, VerifiableCredentials
)
```

---

## Integration (34 components)

```python
from diagrams.azure.integration import (
    # API Management
    APIManagement, APIManagementServices, APIConnections,
    
    # Messaging
    ServiceBus, AzureServiceBus, ServiceBusRelays, Relays,
    
    # Events
    EventGridDomains, EventGridTopics, EventGridSubscriptions,
    SystemTopic, PartnerTopic, PartnerNamespace, PartnerRegistration,
    
    # Logic Apps
    LogicApps, LogicAppsCustomConnector, IntegrationAccounts,
    IntegrationServiceEnvironments, IntegrationEnvironments,
    
    # Data
    DataFactories, DataCatalog, AzureDataCatalog,
    
    # Other
    AppConfiguration, PowerPlatform, SendgridAccounts,
    SoftwareAsAService, StorsimpleDeviceManagers
)
```

---

## IoT (33 components)

```python
from diagrams.azure.iot import (
    # Core IoT
    IotHub, IotEdge, IotCentralApplications, IotHubSecurity,
    DeviceProvisioningServices, AzureIotOperations,
    
    # Digital Twins & Maps
    DigitalTwins, Maps, AzureMapsAccounts,
    
    # Events & Streaming
    EventHubs, EventHubClusters, EventGridSubscriptions,
    StreamAnalyticsJobs,
    
    # Time Series
    TimeSeriesInsightsEnvironments, TimeSeriesInsightsEventSources,
    TimeSeriesDataSets,
    
    # Edge & Stack
    AzureStack, StackHciPremium, Sphere,
    
    # Notifications
    NotificationHubs, NotificationHubNamespaces,
    
    # Windows IoT
    Windows10IotCoreServices, Windows10CoreServices
)
```

---

## Management & Governance (33 components)

```python
from diagrams.azure.managementgovernance import (
    # Monitoring
    Monitor, ApplicationInsights, Alerts, Metrics, ActivityLog,
    DiagnosticsSettings, LogAnalyticsWorkspaces,
    
    # Governance
    Policy, Blueprints, Compliance, CostManagementAndBilling,
    
    # Azure Arc
    AzureArc, ArcMachines, Machinesazurearc,
    
    # Other
    Advisor, AutomationAccounts, AzureLighthouse,
    CustomerLockboxForMicrosoftAzure, RecoveryServicesVaults,
    ResourceGraphExplorer, ServiceProviders, Solutions
)
```

---

## Monitor (12 components)

```python
from diagrams.azure.monitor import (
    Monitor, ApplicationInsights, LogAnalyticsWorkspaces,
    ActivityLog, AutoScale, AzureWorkbooks, ChangeAnalysis,
    DiagnosticsSettings, Logs, Metrics, NetworkWatcher,
    AzureMonitorsForSAPSolutions
)
```

---

## Networking (79 components)

### diagrams.azure.network
```python
from diagrams.azure.network import (
    # Gateways & Load Balancing
    ApplicationGateway, LoadBalancers, FrontDoors,
    VirtualNetworkGateways, LocalNetworkGateways,
    
    # Virtual Networks
    VirtualNetworks, Subnets, NetworkInterfaces,
    VirtualWans, Connections,
    
    # Security
    Firewall, ApplicationSecurityGroups, DDOSProtectionPlans,
    NetworkSecurityGroupsClassic,
    
    # DNS
    DNSZones, DNSPrivateZones,
    
    # Routing
    RouteTables, RouteFilters, TrafficManagerProfiles,
    
    # Connectivity
    ExpressrouteCircuits, PrivateEndpoint,
    OnPremisesDataGateways, PublicIpAddresses,
    
    # Monitoring
    NetworkWatcher, CDNProfiles
)
```

### diagrams.azure.networking (extended)
```python
from diagrams.azure.networking import (
    # Additional components
    Bastions, Firewalls, Nat, IpGroups, IpAddressManager,
    PrivateLink, PrivateLinkServices, ProximityPlacementGroups,
    AzureFirewallManager, AzureFirewallPolicy,
    DNSPrivateResolver, DNSSecurityPolicy,
    WebApplicationFirewallPolicieswaf,
    TrafficController, VirtualRouter, VirtualWanHub,
    FrontDoorAndCDNProfiles, ConnectedCache, ExpressrouteDirect
)
```

---

## Security (22 components)

```python
from diagrams.azure.security import (
    # Key & Secret Management
    KeyVaults,
    
    # Security Center & Defender
    SecurityCenter, Defender, MicrosoftDefenderForCloud,
    MicrosoftDefenderForIot, MicrosoftDefenderEasm,
    
    # Sentinel (SIEM/SOAR)
    Sentinel, AzureSentinel,
    
    # Identity Security
    AzureADIdentityProtection, AzureADPrivlegedIdentityManagement,
    AzureADRiskySignins, AzureADRiskyUsers,
    AzureADAuthenticationMethods, ConditionalAccess,
    MultifactorAuthentication, IdentitySecureScore,
    
    # Network Security
    ApplicationSecurityGroups,
    
    # Information Protection
    AzureInformationProtection,
    
    # Other
    ExtendedSecurityUpdates, Detonation
)
```

---

## Storage (26 components)

```python
from diagrams.azure.storage import (
    # Core Storage
    StorageAccounts, BlobStorage, QueuesStorage, TableStorage,
    AzureFileshares, GeneralStorage, ArchiveStorage,
    
    # Data Lake
    DataLakeStorage, DataLakeStorageGen1,
    
    # Premium Storage
    AzureNetappFiles, NetappFiles, AzureHcpCache,
    
    # Edge & Hybrid
    DataBox, DataBoxEdgeDataBoxGateway, AzureStackEdge,
    AzureDataboxGateway, Azurefxtedgefiler,
    
    # Data Management
    DataShares, DataShareInvitations, StorageSyncServices,
    StorsimpleDataManagers, StorsimpleDeviceManagers,
    
    # Backup
    RecoveryServicesVaults, ImportExportJobs,
    
    # Tools
    StorageExplorer
)
```

---

## Web (20 components)

```python
from diagrams.azure.web import (
    # App Service
    AppServices, AppServicePlans, AppServiceEnvironments,
    AppServiceCertificates, AppServiceDomains, AppSpace,
    
    # Static & Spring
    StaticApps, AzureSpringApps,
    
    # API
    APICenter, APIConnections, APIManagementServices,
    
    # CDN & Front Door
    FrontDoorAndCDNProfiles,
    
    # Media
    AzureMediaService, MediaServices,
    
    # Search & Cognitive
    Search, CognitiveSearch, CognitiveServices,
    
    # Communication
    Signalr, NotificationHubNamespaces,
    
    # Power Platform
    PowerPlatform
)
```

---

## Migration (6 components)

```python
from diagrams.azure.migration import (
    AzureDatabaseMigrationServices, DatabaseMigrationServices,
    MigrationProjects, DataBox, DataBoxEdge,
    RecoveryServicesVaults
)
```

---

## General Purpose Icons (114 components)

For generic icons, placeholders, and UI elements:

```python
from diagrams.azure.general import (
    # Resources
    AllResources, Resource, ResourceGroups, Subscriptions,
    ManagementGroups, Tags, Templates,
    
    # Files & Storage
    File, Files, FolderBlank, FolderWebsite, BlobBlock, BlobPage,
    
    # Development
    Code, Commit, Branch, Builds, Developertools, Powershell, Ftp,
    
    # Monitoring
    Dashboard, Workflow, Heart, Error, Information, Download,
    
    # Support
    HelpAndSupport, Support, Troubleshoot, Guide, Learn,
    
    # Marketplace
    Marketplace, MarketplaceManagement, FreeServices,
    
    # Management
    Gear, Controls, Extensions, Module, Scheduler
)
```

---

## Special Categories

### Blockchain
```python
from diagrams.azure.blockchain import (
    AzureBlockchainService, BlockchainApplications, Consortium
)
```

### Mixed Reality
```python
from diagrams.azure.mixedreality import (
    RemoteRendering, SpatialAnchorAccounts
)
```

### Azure Stack
```python
from diagrams.azure.azurestack import (
    Capacity, InfrastructureBackup, MultiTenancy, Offers,
    Plans, Updates, UserSubscriptions
)
```

### Intune
```python
from diagrams.azure.intune import (
    Intune, IntuneAppProtection, Devices, DeviceCompliance,
    DeviceConfiguration, DeviceEnrollment, ClientApps
)
```

---

## Finding the Right Component

### By Service Name
If you know the Azure service name, look in the relevant category:
- **App Service** → `compute` or `web`
- **Azure SQL** → `database` or `databases`
- **Cosmos DB** → `database`
- **Functions** → `compute`
- **AKS** → `compute` or `containers`
- **Logic Apps** → `integration`
- **Service Bus** → `integration`
- **Event Grid** → `integration` or `iot`
- **Event Hubs** → `analytics` or `iot`

### Duplicate Components
Some services appear in multiple modules. Generally:
- Use the **most specific** module for your diagram type
- `database` vs `databases` - both work, choose by personal preference
- `network` vs `networking` - `networking` has more modern components

### Missing Components
If a component isn't available:
1. Use `diagrams.azure.general` for generic icons
2. Use a related service icon
3. Create a custom node with `diagrams.custom.Custom`

---

## Best Practices

### Importing
```python
# Good - import what you need
from diagrams.azure.compute import FunctionApps, AKS
from diagrams.azure.database import CosmosDb

# Avoid - importing entire modules
from diagrams.azure import compute  # harder to read
```

### Naming Consistency
```python
# Use descriptive variable names
with Diagram("Architecture"):
    api_gateway = APIManagement("API Gateway")
    order_function = FunctionApps("Process Orders")
    order_db = CosmosDb("Orders DB")
```

### Grouping Related Services
```python
with Cluster("Data Tier"):
    cosmos = CosmosDb("Primary")
    redis = CacheForRedis("Cache")
    
with Cluster("Integration"):
    bus = ServiceBus("Events")
    logic = LogicApps("Workflows")
```
