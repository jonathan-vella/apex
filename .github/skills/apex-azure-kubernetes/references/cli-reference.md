<!-- ref:cli-reference-v1 -->

# CLI Reference for AKS

Read-only commands for inspecting existing clusters. Cluster creation, add-ons and feature flags are IaC
settings (AVM `avm/res/container-service/managed-cluster` for Bicep,
`Azure/avm-res-containerservice-managedcluster/azurerm` for Terraform) owned by 06b/06t.

```bash
# List AKS clusters
az aks list --output table

# Show cluster details
az aks show --name <cluster-name> --resource-group <resource-group>

# Get available Kubernetes versions
az aks get-versions --location <location> --output table

# Get user credentials (never --admin)
az aks get-credentials --name <cluster-name> --resource-group <resource-group>

# List node pools
az aks nodepool list --cluster-name <cluster-name> --resource-group <resource-group> --output table
```
