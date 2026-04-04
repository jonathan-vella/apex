"""Configuration constants for Azure Pricing MCP Server."""

import os
from datetime import timedelta

# Azure Retail Prices API configuration
AZURE_PRICING_BASE_URL = "https://prices.azure.com/api/retail/prices"
DEFAULT_API_VERSION = "2023-01-01-preview"
MAX_RESULTS_PER_REQUEST = 1000

# Retry and rate limiting configuration
MAX_RETRIES = 3
RATE_LIMIT_RETRY_BASE_WAIT = 0.5  # seconds (exponential backoff base)
DEFAULT_CUSTOMER_DISCOUNT = 10.0  # percent

# HTTP performance configuration
HTTP_REQUEST_TIMEOUT = float(os.environ.get("AZURE_PRICING_HTTP_TIMEOUT", "30.0"))
HTTP_POOL_SIZE = int(os.environ.get("AZURE_PRICING_HTTP_POOL_SIZE", "10"))
HTTP_POOL_PER_HOST = int(os.environ.get("AZURE_PRICING_HTTP_POOL_PER_HOST", "5"))
REQUEST_DEDUP_TTL = float(os.environ.get("AZURE_PRICING_DEDUP_TTL", "30.0"))

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
    "databricks": "Azure Databricks",
    "spark": "Azure Databricks",
    "dbu": "Azure Databricks",
    # Networking & CDN
    "front door": "Azure Front Door Service",
    "frontdoor": "Azure Front Door Service",
    "afd": "Azure Front Door Service",
    "cdn": "Azure CDN",
    "content delivery": "Azure CDN",
    "waf": "Azure Front Door Service",
    "web application firewall": "Azure Front Door Service",
    # Private networking
    "private endpoint": "Virtual Network",
    "private link": "Virtual Network",
    "private endpoints": "Virtual Network",
    "pe": "Virtual Network",
    # DNS
    "dns": "Azure DNS",
    "dns zone": "Azure DNS",
    "private dns": "Azure DNS",
    "private dns zone": "Azure DNS",
    # Security & compliance
    "defender": "Microsoft Defender for Cloud",
    "defender for cloud": "Microsoft Defender for Cloud",
    "security center": "Microsoft Defender for Cloud",
    "sentinel": "Azure Sentinel",
    "key vault": "Key Vault",
    "keyvault": "Key Vault",
    "kv": "Key Vault",
    # Monitoring
    "monitor": "Azure Monitor",
    "log analytics": "Log Analytics",
    "app insights": "Application Insights",
    "application insights": "Application Insights",
    # Containers
    "container apps": "Azure Container Apps",
    "aca": "Azure Container Apps",
    "container registry": "Container Registry",
    "acr": "Container Registry",
    "container instances": "Container Instances",
    "aci": "Container Instances",
    # Data & messaging
    "event hub": "Event Hubs",
    "event hubs": "Event Hubs",
    "service bus": "Service Bus",
    "event grid": "Event Grid",
    # Bandwidth
    "bandwidth": "Bandwidth",
    "data transfer": "Bandwidth",
    "egress": "Bandwidth",
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
# Azure Databricks DBU Configuration
# =============================================================================

# The official Azure service name for Databricks in the Retail Prices API
DATABRICKS_SERVICE_NAME = "Azure Databricks"

# Workload type mappings: user-friendly names -> OData skuName filter values
# These map to the skuName field returned by the Azure Retail Prices API
DATABRICKS_WORKLOAD_MAPPINGS: dict[str, list[str]] = {
    "all-purpose": ["All-purpose Compute", "All-Purpose Photon"],
    "jobs": ["Jobs Compute", "Jobs Compute Photon"],
    "jobs light": ["Jobs Light Compute"],
    "sql pro": ["SQL Compute Pro"],
    "sql analytics": ["SQL Analytics"],
    "serverless sql": ["Serverless SQL"],
    "automated serverless": ["Automated Serverless Compute"],
    "interactive serverless": ["Interactive Serverless Compute"],
    "delta live tables core": ["Core Compute Delta Live Tables", "Core Compute Photon Delta Live Tables"],
    "delta live tables pro": ["Pro Compute Delta Live Tables", "Pro Compute Photon Delta Live Tables"],
    "delta live tables advanced": [
        "Advanced Compute Delta Live Tables",
        "Advanced Compute Photon Delta Live Tables",
    ],
    "model training": ["Model Training"],
    "serverless inferencing": ["Serverless Realtime Inferencing"],
    "database serverless": ["Database Serverless Compute"],
}

# User-friendly aliases for workload type lookup
DATABRICKS_WORKLOAD_ALIASES: dict[str, str] = {
    "all purpose": "all-purpose",
    "allpurpose": "all-purpose",
    "general": "all-purpose",
    "interactive": "all-purpose",
    "notebook": "all-purpose",
    "job": "jobs",
    "batch": "jobs",
    "etl": "jobs",
    "light": "jobs light",
    "sql": "sql pro",
    "warehouse": "serverless sql",
    "sql warehouse": "serverless sql",
    "serverless": "automated serverless",
    "dlt": "delta live tables pro",
    "delta live tables": "delta live tables pro",
    "pipelines": "delta live tables pro",
    "ml": "model training",
    "training": "model training",
    "inference": "serverless inferencing",
    "serving": "serverless inferencing",
    "model serving": "serverless inferencing",
    "lakebase": "database serverless",
}

# =============================================================================
# GitHub Pricing Configuration (static catalog — not available via Azure API)
# =============================================================================

# Data version tracks the last manual verification date for static pricing data.
# Bump this when prices are re-verified from https://github.com/pricing
GITHUB_PRICING_DATA_VERSION = "2026-03-03"

# ---------------------------------------------------------------------------
# GitHub Plans (per-user/month)
# ---------------------------------------------------------------------------
GITHUB_PLANS: dict[str, dict] = {
    "Free": {
        "price_monthly": 0.0,
        "price_annual_per_month": 0.0,
        "target": "Individual developers & small OSS projects",
        "includes": [
            "Unlimited public/private repos",
            "2,000 Actions minutes/month",
            "500 MB Packages storage",
            "Community support",
        ],
    },
    "Team": {
        "price_monthly": 4.0,
        "price_annual_per_month": 4.0,
        "target": "Small teams wanting collaboration features",
        "includes": [
            "Everything in Free",
            "3,000 Actions minutes/month",
            "2 GB Packages storage",
            "Required reviewers",
            "Code owners",
            "Draft pull requests",
            "Repository insights",
        ],
    },
    "Enterprise": {
        "price_monthly": 21.0,
        "price_annual_per_month": 21.0,
        "target": "Large organisations with advanced security & compliance",
        "includes": [
            "Everything in Team",
            "50,000 Actions minutes/month",
            "50 GB Packages storage",
            "SAML SSO",
            "Advanced auditing",
            "GitHub Connect",
            "Enterprise Managed Users (optional)",
        ],
    },
}

# ---------------------------------------------------------------------------
# GitHub Copilot Plans
# ---------------------------------------------------------------------------
GITHUB_COPILOT_PLANS: dict[str, dict] = {
    "Free": {
        "price_monthly": 0.0,
        "price_annual": 0.0,
        "target": "Individuals — limited completions & chat",
        "includes": [
            "2,000 code completions/month",
            "50 chat messages/month",
            "Access to GPT-4o & Claude 3.5 Sonnet",
        ],
    },
    "Pro": {
        "price_monthly": 10.0,
        "price_annual": 100.0,
        "target": "Individual developers — unlimited usage",
        "includes": [
            "Unlimited code completions",
            "Unlimited chat messages",
            "Access to GPT-4o, Claude 3.5 Sonnet, and more",
            "CLI and IDE support",
        ],
    },
    "Pro+": {
        "price_monthly": 39.0,
        "price_annual": 390.0,
        "target": "Power users — premium models & agents",
        "includes": [
            "Everything in Pro",
            "Access to GPT-o1, Claude 3.7 Sonnet, Gemini 2.5 Pro",
            "Full Copilot agent mode",
            "Unlimited premium model usage",
        ],
    },
    "Business": {
        "price_monthly": 19.0,
        "price_annual": 228.0,
        "target": "Organisations — per-seat with admin controls",
        "includes": [
            "Everything in Pro",
            "Organisation-wide policy management",
            "Audit logs",
            "IP indemnity",
            "Content exclusions",
        ],
    },
    "Enterprise": {
        "price_monthly": 39.0,
        "price_annual": 468.0,
        "target": "Enterprises — advanced customisation & security",
        "includes": [
            "Everything in Business",
            "Fine-tuned custom models",
            "Knowledge bases",
            "SAML SSO enforcement",
        ],
    },
}

# ---------------------------------------------------------------------------
# GitHub Actions Runner Pricing (per-minute rates)
# ---------------------------------------------------------------------------
GITHUB_ACTIONS_RUNNERS: dict[str, dict] = {
    "Linux 2-core": {"per_minute": 0.008, "os": "Linux", "cores": 2},
    "Linux 4-core": {"per_minute": 0.016, "os": "Linux", "cores": 4},
    "Linux 8-core": {"per_minute": 0.032, "os": "Linux", "cores": 8},
    "Linux 16-core": {"per_minute": 0.064, "os": "Linux", "cores": 16},
    "Linux 32-core": {"per_minute": 0.128, "os": "Linux", "cores": 32},
    "Linux 64-core": {"per_minute": 0.256, "os": "Linux", "cores": 64},
    "Windows 2-core": {"per_minute": 0.016, "os": "Windows", "cores": 2},
    "Windows 4-core": {"per_minute": 0.032, "os": "Windows", "cores": 4},
    "Windows 8-core": {"per_minute": 0.064, "os": "Windows", "cores": 8},
    "Windows 16-core": {"per_minute": 0.128, "os": "Windows", "cores": 16},
    "Windows 32-core": {"per_minute": 0.256, "os": "Windows", "cores": 32},
    "Windows 64-core": {"per_minute": 0.512, "os": "Windows", "cores": 64},
    "macOS 3-core (M1)": {"per_minute": 0.08, "os": "macOS", "cores": 3},
    "macOS 4-core (M2 Pro)": {"per_minute": 0.16, "os": "macOS", "cores": 4},
    "macOS 12-core (Intel)": {"per_minute": 0.12, "os": "macOS", "cores": 12},
    "Linux 2-core ARM": {"per_minute": 0.005, "os": "Linux ARM", "cores": 2},
    "Linux 4-core ARM": {"per_minute": 0.01, "os": "Linux ARM", "cores": 4},
    "Linux 8-core ARM": {"per_minute": 0.02, "os": "Linux ARM", "cores": 8},
    "Linux 16-core ARM": {"per_minute": 0.04, "os": "Linux ARM", "cores": 16},
    "Linux 32-core ARM": {"per_minute": 0.08, "os": "Linux ARM", "cores": 32},
    "Linux 64-core ARM": {"per_minute": 0.16, "os": "Linux ARM", "cores": 64},
    "Linux 2-core GPU": {"per_minute": 0.07, "os": "Linux GPU", "cores": 2},
    "Linux 4-core GPU": {"per_minute": 0.14, "os": "Linux GPU", "cores": 4},
}

# Free Actions minutes included per plan (Linux minutes; Windows = 2×, macOS = 10×)
GITHUB_ACTIONS_FREE_MINUTES: dict[str, dict] = {
    "Free": {"minutes": 2000, "storage_gb": 0.5},
    "Team": {"minutes": 3000, "storage_gb": 2},
    "Enterprise": {"minutes": 50000, "storage_gb": 50},
}

# ---------------------------------------------------------------------------
# GitHub Advanced Security Products
# ---------------------------------------------------------------------------
GITHUB_SECURITY_PRODUCTS: dict[str, dict] = {
    "GitHub Advanced Security (GHAS)": {
        "price_monthly_per_committer": 49.0,
        "target": "GitHub Enterprise — required for private repos",
        "includes": [
            "Code scanning (CodeQL)",
            "Secret scanning",
            "Dependency review",
            "Security overview dashboard",
        ],
    },
}

# ---------------------------------------------------------------------------
# GitHub Add-on Services
# ---------------------------------------------------------------------------
GITHUB_ADDONS: dict[str, dict] = {
    "Codespaces Compute": {
        "unit": "per core-hour",
        "price": 0.18,
        "description": "Cloud dev environments — $0.18/core-hour",
    },
    "Codespaces Storage": {
        "unit": "per GB/month",
        "price": 0.07,
        "description": "Codespaces persistent storage — $0.07/GB/month",
    },
    "Copilot for Pull Requests": {
        "unit": "included with Copilot Enterprise",
        "price": 0.0,
        "description": "AI-generated PR summaries — included with Copilot Enterprise",
    },
    "Git LFS Data": {
        "unit": "per 50 GB pack/month",
        "price": 5.0,
        "description": "Large File Storage — $5/50 GB data pack per month",
    },
    "Git LFS Bandwidth": {
        "unit": "per 50 GB pack/month",
        "price": 5.0,
        "description": "Large File Storage bandwidth — $5/50 GB bandwidth pack per month",
    },
    "GitHub Packages": {
        "unit": "per GB/month beyond free tier",
        "price": 0.25,
        "description": "Container & package storage — $0.25/GB/month beyond free",
    },
    "GitHub Packages Data Transfer": {
        "unit": "per GB beyond free tier",
        "price": 0.50,
        "description": "Package data transfer — $0.50/GB beyond free",
    },
}

# ---------------------------------------------------------------------------
# Aliases for natural-language lookup
# ---------------------------------------------------------------------------
GITHUB_PRODUCT_ALIASES: dict[str, str] = {
    # Plans
    "plan": "plans",
    "plans": "plans",
    "github plan": "plans",
    "github plans": "plans",
    "subscription": "plans",
    # Copilot
    "copilot": "copilot",
    "github copilot": "copilot",
    "ai assistant": "copilot",
    "code completion": "copilot",
    "pair programmer": "copilot",
    # Actions
    "actions": "actions",
    "github actions": "actions",
    "ci/cd": "actions",
    "ci cd": "actions",
    "runners": "actions",
    "workflows": "actions",
    "build minutes": "actions",
    # Security
    "security": "security",
    "advanced security": "security",
    "ghas": "security",
    "code scanning": "security",
    "secret scanning": "security",
    # Codespaces
    "codespaces": "codespaces",
    "dev environments": "codespaces",
    "cloud ide": "codespaces",
    # Storage / Add-ons
    "lfs": "storage",
    "git lfs": "storage",
    "large file storage": "storage",
    "packages": "storage",
    "container registry": "storage",
    "storage": "storage",
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
