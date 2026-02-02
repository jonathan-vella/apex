# Infrastructure as Code to Diagram

Generate architecture diagrams directly from your Bicep, Terraform, ARM templates, or Azure Pipeline definitions.

## ⚠️ Critical Guidelines

### 1. Always Use Full Resource Names

The whole point of generating from IaC is accuracy. Use the **actual resource names** from the code:

```python
# ✅ CORRECT - Full names from Bicep/Terraform
aks = AKS("aks-ecommerce-prod\n3-10 nodes, D4s_v3")
cosmos = CosmosDb("cosmos-ecommerce-prod\ncatalog, inventory")
kv = KeyVaults("kv-ecommerce-prod")

# ❌ WRONG - Generic abbreviations
aks = AKS("AKS")
cosmos = CosmosDb("Cosmos")
kv = KeyVaults("KV")
```

### 2. Use `labelloc='t'` for Labels Inside Clusters

The `diagrams` library places labels below icons by default, causing them to overflow cluster
boundaries. **Fix: put labels ABOVE icons:**

```python
node_attr = {
    "fontname": "Arial Bold",
    "fontsize": "11",
    "labelloc": "t",  # Labels at TOP - stays inside clusters!
}

with Diagram("My Architecture", node_attr=node_attr, ...):
    with Cluster("Data Tier"):
        sql = SQLDatabases("sql-ecommerce-prod\nS3 tier")  # Label stays inside!
```

**Additional settings for professional output:**

```python
graph_attr = {
    "dpi": "200",              # High resolution
    "fontname": "Arial Bold",  # Bold titles
}

cluster_style = {"margin": "30"}  # Extra padding inside clusters
```

### 3. ALWAYS Review the Output (Mandatory!)

After generating, **you MUST view the image** and check for:

| Issue          | What to Look For          | Fix                                |
| -------------- | ------------------------- | ---------------------------------- |
| Text clipping  | Labels cut off at edges   | Increase `size` and `nodesep`      |
| Overlapping    | Nodes/edges crossing      | Increase spacing, change `splines` |
| Missing arrows | Connections didn't render | Simplify clusters, check syntax    |
| Illegible text | Font too small            | Increase `fontsize`, reduce nodes  |
| Cramped layout | Not enough whitespace     | Increase all spacing params        |

**If ANY issues exist, regenerate with fixes. Never deliver without confirming all resource names are fully readable.**

---

## How It Works

When you have access to your codebase (via GitHub Copilot in your repo, or Claude Code with file access), the AI can:

1. **Read** your IaC files (Bicep, Terraform, ARM, YAML pipelines)
2. **Parse** the resource definitions and relationships
3. **Map** resources to official Azure diagram components
4. **Generate** accurate architecture diagrams

This creates diagrams that are the **source of truth** - directly derived from your actual infrastructure code.

---

## Example Prompts

### From Bicep Files

**Basic diagram generation:**

```
Read the Bicep files in /infra and generate an architecture diagram showing all Azure resources
and their relationships
```

**With module resolution:**

```
Analyze main.bicep and its module references, then create a diagram of the complete
infrastructure. Follow the module references in the modules/ folder.
```

**Network-focused:**

```
Generate a network topology diagram from the Bicep files, focusing on VNets, subnets,
and private endpoints. Show which resources are in which subnet.
```

**With resource details:**

```
Read the Bicep in /infra and create a diagram that includes:
- Resource names as defined in the Bicep
- SKU/tier information where specified
- Subnet CIDR ranges
- Show private endpoints with dashed lines
```

**Grouped by function:**

```
Parse the Bicep files and generate a diagram grouped by logical function
(networking, compute, data, security) rather than by resource group
```

### From Terraform

```
Read the Terraform files in /terraform and generate an Azure architecture diagram
```

```
Parse main.tf and the module definitions, then create a visual representation of the infrastructure
```

```
Create a diagram showing the resources defined in our Terraform, grouped by resource group
```

### From ARM Templates

```
Analyze the ARM template in azuredeploy.json and generate an architecture diagram
```

```
Read all ARM templates in /arm-templates and create a consolidated infrastructure diagram
```

### From Azure Pipelines

**Basic pipeline diagram:**

```
Read our azure-pipelines.yml and create a CI/CD pipeline diagram showing the stages and deployments
```

**With environments:**

```
Analyze the pipeline YAML files and generate a deployment flow diagram showing which
resources are deployed to which environments (dev, test, prod)
```

**Including artifacts:**

```
Create a pipeline diagram from azure-pipelines.yml that shows:
- Build stage with artifact creation
- Each deployment stage
- Artifact flows (dashed lines)
- Environment gates/approvals
- Stage dependencies and conditions
```

**Combined infrastructure + pipeline:**

```
Read our Bicep infrastructure code AND the azure-pipelines.yml to create:
1. An architecture diagram of the deployed resources
2. A deployment pipeline diagram showing how code flows to each environment
```

### Combined Analysis

**Full repo analysis:**

```
Read our Bicep infrastructure code AND the azure-pipelines.yml to create:
1. An architecture diagram of the deployed resources
2. A deployment pipeline diagram showing how code flows to each environment
```

**Multi-environment comparison:**

```
We have Bicep parameter files for dev, test, and prod. Create three architecture diagrams
showing the differences between environments (e.g., different SKUs, node counts,
redundancy settings)
```

**Security-focused from IaC:**

```
Analyze our Bicep/Terraform and create a security architecture diagram highlighting:
- Identity and access (Entra ID, Managed Identities)
- Network security (NSGs, Firewall, Private Endpoints)
- Secrets management (Key Vault connections)
- Which resources have public endpoints vs private only
```

**Cost visualization:**

```
Read the Bicep files and create a diagram that visually indicates cost tiers:
- Group expensive resources (Premium SKUs) with a highlighted border
- Show which resources are consumption-based vs reserved
- Annotate with SKU names
```

---

## Bicep Parsing Guide

### Resource Mapping

| Bicep Resource Type                          | Diagram Component                 |
| -------------------------------------------- | --------------------------------- |
| `Microsoft.Web/sites`                        | `AppServices` or `FunctionApps`   |
| `Microsoft.ContainerService/managedClusters` | `AKS`                             |
| `Microsoft.ContainerRegistry/registries`     | `ACR`                             |
| `Microsoft.Sql/servers`                      | `SQLServers` / `SQLDatabases`     |
| `Microsoft.DocumentDB/databaseAccounts`      | `CosmosDb`                        |
| `Microsoft.Cache/redis`                      | `CacheForRedis`                   |
| `Microsoft.ServiceBus/namespaces`            | `ServiceBus`                      |
| `Microsoft.Storage/storageAccounts`          | `BlobStorage` / `StorageAccounts` |
| `Microsoft.Network/virtualNetworks`          | `VirtualNetworks`                 |
| `Microsoft.Network/applicationGateways`      | `ApplicationGateway`              |
| `Microsoft.Cdn/profiles`                     | `FrontDoors` / `CDNProfiles`      |
| `Microsoft.KeyVault/vaults`                  | `KeyVaults`                       |
| `Microsoft.Insights/components`              | `ApplicationInsights`             |
| `Microsoft.Logic/workflows`                  | `LogicApps`                       |
| `Microsoft.EventGrid/topics`                 | `EventGridTopics`                 |

### Module References

When Bicep uses modules, the AI should:

1. Follow module references to understand the full resource graph
2. Include resources from all referenced modules
3. Show module boundaries as clusters if helpful

```bicep
// Example: Follow this module reference
module aks 'modules/aks.bicep' = {
  name: 'aks-cluster'
  params: {
    // ...
  }
}
```

### Extracting Relationships

Look for these patterns to determine connections:

```bicep
// Subnet references indicate network placement
subnetId: vnet.outputs.subnets[0].id

// Private endpoint connections
privateEndpointSubnetId: vnet.outputs.subnets[2].id

// Resource references indicate dependencies
keyVaultName: keyVault.outputs.name
storageAccountName: storage.outputs.name
```

---

## Terraform Parsing Guide

### Resource Mapping

| Terraform Resource Type        | Diagram Component    |
| ------------------------------ | -------------------- |
| `azurerm_kubernetes_cluster`   | `AKS`                |
| `azurerm_container_registry`   | `ACR`                |
| `azurerm_app_service`          | `AppServices`        |
| `azurerm_function_app`         | `FunctionApps`       |
| `azurerm_mssql_server`         | `SQLServers`         |
| `azurerm_cosmosdb_account`     | `CosmosDb`           |
| `azurerm_redis_cache`          | `CacheForRedis`      |
| `azurerm_servicebus_namespace` | `ServiceBus`         |
| `azurerm_storage_account`      | `StorageAccounts`    |
| `azurerm_virtual_network`      | `VirtualNetworks`    |
| `azurerm_application_gateway`  | `ApplicationGateway` |
| `azurerm_key_vault`            | `KeyVaults`          |

### Following References

```hcl
# Follow resource references
resource "azurerm_kubernetes_cluster" "aks" {
  default_node_pool {
    vnet_subnet_id = azurerm_subnet.aks.id  # <- Connection to subnet
  }
}

# Module references
module "database" {
  source = "./modules/database"
  # ...
}
```

---

## Pipeline Diagram Generation

### Azure Pipelines (YAML)

```yaml
stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - task: Docker@2
            inputs:
              containerRegistry: "acr-connection"

  - stage: DeployDev
    dependsOn: Build
    jobs:
      - deployment: DeployToDev
        environment: "dev"

  - stage: DeployProd
    dependsOn: DeployDev
    jobs:
      - deployment: DeployToProd
        environment: "prod"
```

This generates a pipeline flow diagram showing: Build → DeployDev → DeployProd

### GitHub Actions

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: azure/docker-login@v1

  deploy-dev:
    needs: build
    environment: development

  deploy-prod:
    needs: deploy-dev
    environment: production
```

---

## Example: Full Workflow

### Step 1: User Prompt

```
I have a Bicep-based infrastructure in /infra. Please:
1. Read all the Bicep files including modules
2. Generate an architecture diagram showing all resources
3. Group resources by subnet/network segment
4. Show private endpoint connections with dashed lines
5. Include resource names and SKUs as labels
```

### Step 2: AI Reads Files

The AI reads:

- `/infra/main.bicep`
- `/infra/modules/aks.bicep`
- `/infra/modules/sql.bicep`
- `/infra/modules/cosmos.bicep`
- etc.

### Step 3: AI Generates Diagram

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import AKS
from diagrams.azure.database import SQLDatabases, CosmosDb
# ... imports based on discovered resources

with Diagram("Infrastructure from Bicep", show=False):
    # Resources and connections based on parsed Bicep
    ...
```

### Step 4: Output

A diagram that accurately reflects the actual infrastructure defined in code.

---

## Tips for Best Results

### Be Specific About Scope

```
# Good - specific scope
"Read the Bicep files in /infra/prod and generate a diagram"

# Less good - too vague
"Make a diagram of my infrastructure"
```

### Request Grouping Strategy

```
"Group resources by:
- Resource group
- Subnet/network segment
- Logical tier (web/api/data)
- Environment (dev/prod)"
```

### Ask for Specific Details

```
"Include in the diagram:
- Resource names from the Bicep
- SKU/tier information
- Private endpoint connections (dashed lines)
- VNet peering relationships"
```

### Handle Multiple Environments

```
"We have /infra/dev and /infra/prod Bicep folders. Create:
1. A dev environment diagram
2. A prod environment diagram
3. A comparison showing what's different"
```

---

## Scaling Diagram Size

Choose settings based on the number of resources:

### Small (< 10 resources)

```python
graph_attr = {
    "nodesep": "0.6",
    "ranksep": "0.8",
    "pad": "0.5",
}
```

### Medium (10-25 resources)

```python
graph_attr = {
    "nodesep": "0.8",
    "ranksep": "1.0",
    "pad": "0.6",
    "dpi": "150",
}
```

### Large (25+ resources)

```python
graph_attr = {
    "nodesep": "1.0",
    "ranksep": "1.2",
    "pad": "0.8",
    "dpi": "150",
    "fontsize": "11",  # Slightly smaller font
}
```

### Very Large (50+ resources)

Consider splitting into multiple diagrams:

- Network topology diagram
- Application architecture diagram
- Data flow diagram
- Security architecture diagram

---

## Limitations

1. **Implicit connections**: Some relationships aren't explicit in IaC (e.g., app code
   connecting to database). The AI infers these from common patterns.

2. **Dynamic resources**: Resources created via loops or conditions may need clarification.

3. **External dependencies**: Resources outside the IaC (existing VNets, shared services) should be mentioned in the prompt.

4. **Cross-repo modules**: If modules are in separate repos, provide that context.

---

## Sample Prompt Templates

### Basic Infrastructure Diagram

```
Read the [Bicep/Terraform] files in [path] and generate an architecture diagram
with official Azure icons. Group resources by [VNet/resource group/tier].
```

### Detailed Network Diagram

```
Analyze the networking resources in our IaC code and create a network topology diagram
showing VNets, subnets, peerings, private endpoints, and NSG relationships.
```

### Security-Focused Diagram

```
Generate a diagram from our Bicep that highlights the security architecture: identity
(Entra ID, managed identities), network security (NSGs, firewalls, private endpoints),
and secrets management (Key Vault).
```

### Pipeline + Infrastructure

```
Read both the azure-pipelines.yml and the Bicep infrastructure code. Create two diagrams:
1. The deployed Azure architecture
2. The CI/CD pipeline that deploys it
```
