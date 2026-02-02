"""Configuration constants for Azure Pricing MCP Server."""

import os
from datetime import timedelta

# Azure Retail Prices API configuration
AZURE_PRICING_BASE_URL = "https://prices.azure.com/api/retail/prices"
DEFAULT_API_VERSION = "2023-01-01-preview"
MAX_RESULTS_PER_REQUEST = 1000

# Retry and rate limiting configuration
MAX_RETRIES = 3
RATE_LIMIT_RETRY_BASE_WAIT = 5  # seconds
DEFAULT_CUSTOMER_DISCOUNT = 10.0  # percent

# SSL verification configuration
# Set to False if behind a corporate proxy with self-signed certificates
# Can also be set via environment variable AZURE_PRICING_SSL_VERIFY=false


SSL_VERIFY = os.environ.get("AZURE_PRICING_SSL_VERIFY", "true").lower() != "false"

# VM Retirement status configuration
RETIRED_SIZES_URL = "https://raw.githubusercontent.com/MicrosoftDocs/azure-compute-docs/main/articles/virtual-machines/sizes/retirement/retired-sizes-list.md"
PREVIOUS_GEN_URL = "https://raw.githubusercontent.com/MicrosoftDocs/azure-compute-docs/main/articles/virtual-machines/sizes/previous-gen-sizes-list.md"
RETIREMENT_CACHE_TTL = timedelta(hours=24)

# Common service name mappings for fuzzy search
# Maps user-friendly terms to official Azure service names
SERVICE_NAME_MAPPINGS: dict[str, str] = {
    # User input -> Correct Azure service name
    "app service": "Azure App Service",
    "web app": "Azure App Service",
    "web apps": "Azure App Service",
    "app services": "Azure App Service",
    "websites": "Azure App Service",
    "web service": "Azure App Service",
    "virtual machine": "Virtual Machines",
    "vm": "Virtual Machines",
    "vms": "Virtual Machines",
    "compute": "Virtual Machines",
    "storage": "Storage",
    "blob": "Storage",
    "blob storage": "Storage",
    "file storage": "Storage",
    "disk": "Storage",
    "sql": "Azure SQL Database",
    "sql database": "Azure SQL Database",
    "database": "Azure SQL Database",
    "sql server": "Azure SQL Database",
    "cosmos": "Azure Cosmos DB",
    "cosmosdb": "Azure Cosmos DB",
    "cosmos db": "Azure Cosmos DB",
    "document db": "Azure Cosmos DB",
    "kubernetes": "Azure Kubernetes Service",
    "aks": "Azure Kubernetes Service",
    "k8s": "Azure Kubernetes Service",
    "container service": "Azure Kubernetes Service",
    "functions": "Azure Functions",
    "function app": "Azure Functions",
    "serverless": "Azure Functions",
    "redis": "Azure Cache for Redis",
    "cache": "Azure Cache for Redis",
    "ai": "Azure AI services",
    "cognitive": "Azure AI services",
    "cognitive services": "Azure AI services",
    "openai": "Azure OpenAI",
    "networking": "Virtual Network",
    "network": "Virtual Network",
    "vnet": "Virtual Network",
    "load balancer": "Load Balancer",
    "lb": "Load Balancer",
    "application gateway": "Application Gateway",
    "app gateway": "Application Gateway",
}

# VM series replacement recommendations
VM_SERIES_REPLACEMENTS: dict[str, str] = {
    # Storage optimized
    "Ls": "Lsv3, Lasv3, Lsv4, or Lasv4 series",
    "Lsv2": "Lsv3, Lasv3, Lsv4, or Lasv4 series",
    # General purpose
    "D": "Dv5, Dasv5, or Ddsv5 series",
    "Ds": "Dsv5, Dadsv5, or Ddsv5 series",
    "Dv2": "Dv5, Dasv5, or Ddsv5 series",
    "Dsv2": "Dsv5, Dadsv5, or Ddsv5 series",
    "Dv3": "Dv5 or Dv6 series",
    "Dsv3": "Dsv5 or Dsv6 series",
    "Dv4": "Dv5 or Dv6 series",
    "Dsv4": "Dsv5 or Dsv6 series",
    "Ddsv4": "Ddsv5 or Ddsv6 series",
    "Dasv4": "Dasv5 or Dasv6 series",
    "Dadsv4": "Dadsv5 or Dadsv6 series",
    "Av2": "Dasv5 or Dadsv5 series",
    "B": "Bsv2, Basv2, or Bpsv2 series",
    "Bv1": "Bsv2, Basv2, or Bpsv2 series",
    # Compute optimized
    "F": "Fasv6 or Falsv6 series",
    "Fs": "Fasv6 or Falsv6 series",
    "Fsv2": "Fasv6 or Falsv6 series",
    # Memory optimized
    "E": "Ev5 or Ev6 series",
    "Ev3": "Ev5 or Ev6 series",
    "Esv3": "Esv5 or Esv6 series",
    "Ev4": "Ev5 or Ev6 series",
    "Esv4": "Esv5 or Esv6 series",
    "Edsv4": "Edsv5 or Edsv6 series",
    "Easv4": "Easv5 or Easv6 series",
    "Eav4": "Eav5 or Eav6 series",
    "G": "Ev5 or Edsv5 series",
    "Gs": "Edsv5 or Edsv6 series",
}

# =============================================================================
# Spot VM Tools Configuration (requires Azure authentication)
# =============================================================================

# Azure Resource Graph API configuration
AZURE_RESOURCE_GRAPH_URL = "https://management.azure.com/providers/Microsoft.ResourceGraph/resources"
AZURE_RESOURCE_GRAPH_API_VERSION = "2022-10-01"

# Azure Compute API configuration
AZURE_COMPUTE_API_VERSION = "2024-07-01"

# Spot data cache configuration
SPOT_CACHE_TTL = timedelta(hours=1)

# Azure authentication scopes
AZURE_MANAGEMENT_SCOPE = "https://management.azure.com/.default"

# Least-privilege permissions documentation
SPOT_PERMISSIONS: dict[str, dict[str, str]] = {
    "eviction_rates": {
        "permission": "Microsoft.ResourceGraph/resources/read",
        "built_in_role": "Reader",
        "description": "Query Azure Resource Graph for Spot VM eviction rates",
    },
    "price_history": {
        "permission": "Microsoft.ResourceGraph/resources/read",
        "built_in_role": "Reader",
        "description": "Query Azure Resource Graph for Spot price history",
    },
    "simulate_eviction": {
        "permission": "Microsoft.Compute/virtualMachines/simulateEviction/action",
        "built_in_role": "Virtual Machine Contributor",
        "description": "Trigger eviction simulation on a Spot VM",
    },
}
