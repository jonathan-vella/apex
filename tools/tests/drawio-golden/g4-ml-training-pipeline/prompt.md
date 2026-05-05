# G4 — ML Training Pipeline

Generate a deployment diagram for an Azure Machine Learning training pipeline.

## Resources (variant-aware — exact tiers matter)

- Azure Machine Learning **Workspace**
- AML **Compute Cluster — GPU (NC24ads_A100_v4)**
- Azure Data Lake Storage **Gen2** (Storage Account with HNS enabled)
- Azure Container Registry **Premium** (geo-replication-ready)
- Key Vault (Standard)
- Application Insights
- Storage Account (general-purpose v2 — workspace default)
- Log Analytics workspace
- User-assigned Managed Identity (referenced by compute cluster)

## Constraints

- Single resource group (`rg-mltrain-prod`)
- Single region (Sweden Central)
- ACR Premium required for content trust + private endpoints
- Data lake uses hierarchical namespace; data accessed via `abfss://`

## Diagram expectations

- **Type:** deployment.
- **Variant icons:** GPU compute distinct from CPU compute; ACR Premium
  distinct from Basic/Standard; ADLS Gen2 distinct from generic Storage.
- **Zones:** `ML Workspace` and `Data Zone` (logical groupings).
- **Edges:** `AML SDK`, `ABFS`, `Pull` (image pull) labels.
- **Legend:** required.
