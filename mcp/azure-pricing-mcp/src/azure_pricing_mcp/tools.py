"""Tool definitions for Azure Pricing MCP Server."""

from mcp.types import Tool

from .databricks.tools import get_databricks_tool_definitions
from .github_pricing.tools import get_github_pricing_tool_definitions


def get_tool_definitions() -> list[Tool]:
    """Get all tool definitions for the Azure Pricing MCP Server."""
    return (
        [
            Tool(
                name="azure_price_search",
                description="Search Azure retail prices with various filters",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name (e.g., 'Virtual Machines', 'Storage')",
                        },
                        "service_family": {
                            "type": "string",
                            "description": "Service family (e.g., 'Compute', 'Storage', 'Networking')",
                        },
                        "region": {
                            "type": "string",
                            "description": "Azure region (e.g., 'eastus', 'westeurope')",
                        },
                        "sku_name": {
                            "type": "string",
                            "description": "SKU name to search for (partial matches supported)",
                        },
                        "price_type": {
                            "type": "string",
                            "description": "Price type: 'Consumption', 'Reservation', or 'DevTestConsumption'",
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 50)",
                            "default": 50,
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount). If not specified and show_with_discount is false, no discount is applied. If show_with_discount is true, defaults to 10%.",
                        },
                        "show_with_discount": {
                            "type": "boolean",
                            "description": "Set to true to apply a discount; uses default 10% unless discount_percentage is explicitly specified.",
                            "default": False,
                        },
                        "validate_sku": {
                            "type": "boolean",
                            "description": "Whether to validate SKU names and provide suggestions (default: true)",
                            "default": True,
                        },
                    },
                },
            ),
            Tool(
                name="azure_price_compare",
                description="Compare Azure prices across regions or SKUs",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name to compare",
                        },
                        "sku_name": {
                            "type": "string",
                            "description": "Specific SKU to compare (optional)",
                        },
                        "regions": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of regions to compare (if not provided, compares SKUs)",
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount). If not specified and show_with_discount is false, no discount is applied. If show_with_discount is true, defaults to 10%.",
                        },
                        "show_with_discount": {
                            "type": "boolean",
                            "description": "Set to true to apply a discount; uses default 10% unless discount_percentage is explicitly specified.",
                            "default": False,
                        },
                    },
                    "required": ["service_name"],
                },
            ),
            Tool(
                name="azure_cost_estimate",
                description="Estimate Azure costs based on usage patterns",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name",
                        },
                        "sku_name": {
                            "type": "string",
                            "description": "SKU name",
                        },
                        "region": {
                            "type": "string",
                            "description": "Azure region",
                        },
                        "hours_per_month": {
                            "type": "number",
                            "description": "Expected hours of usage per month (default: 730 for full month)",
                            "default": 730,
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount). If not specified and show_with_discount is false, no discount is applied. If show_with_discount is true, defaults to 10%.",
                        },
                        "show_with_discount": {
                            "type": "boolean",
                            "description": "Set to true to apply a discount; uses default 10% unless discount_percentage is explicitly specified.",
                            "default": False,
                        },
                    },
                    "required": ["service_name", "sku_name", "region"],
                },
            ),
            Tool(
                name="azure_discover_skus",
                description="Discover available SKUs for a specific Azure service",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name",
                        },
                        "region": {
                            "type": "string",
                            "description": "Azure region (optional)",
                        },
                        "price_type": {
                            "type": "string",
                            "description": "Price type (default: 'Consumption')",
                            "default": "Consumption",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of SKUs to return (default: 100)",
                            "default": 100,
                        },
                    },
                    "required": ["service_name"],
                },
            ),
            Tool(
                name="azure_sku_discovery",
                description="Discover available SKUs for Azure services with intelligent name matching",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_hint": {
                            "type": "string",
                            "description": "Service name or description (e.g., 'app service', 'web app', 'vm', 'storage'). Supports fuzzy matching.",
                        },
                        "region": {
                            "type": "string",
                            "description": "Optional Azure region to filter results",
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 30)",
                            "default": 30,
                        },
                    },
                    "required": ["service_hint"],
                },
            ),
            Tool(
                name="azure_region_recommend",
                description="Find the cheapest Azure regions for a given service and SKU. Dynamically discovers all available regions, compares prices, and returns ranked recommendations with savings percentages.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name (e.g., 'Virtual Machines', 'Azure App Service')",
                        },
                        "sku_name": {
                            "type": "string",
                            "description": "SKU name to price across regions (e.g., 'D4s v3', 'P1v3')",
                        },
                        "top_n": {
                            "type": "integer",
                            "description": "Number of top recommendations to return (default: 10)",
                            "default": 10,
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount). If not specified and show_with_discount is false, no discount is applied. If show_with_discount is true, defaults to 10%.",
                        },
                        "show_with_discount": {
                            "type": "boolean",
                            "description": "Set to true to apply a discount; uses default 10% unless discount_percentage is explicitly specified.",
                            "default": False,
                        },
                    },
                    "required": ["service_name", "sku_name"],
                },
            ),
            Tool(
                name="azure_ri_pricing",
                description="Get Reserved Instance pricing and savings analysis",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name (e.g., 'Virtual Machines')",
                        },
                        "sku_name": {
                            "type": "string",
                            "description": "SKU name (e.g., 'D4s v3')",
                        },
                        "region": {
                            "type": "string",
                            "description": "Azure region (e.g., 'eastus')",
                        },
                        "reservation_term": {
                            "type": "string",
                            "description": "Reservation term ('1 Year' or '3 Years')",
                            "enum": ["1 Year", "3 Years"],
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "compare_on_demand": {
                            "type": "boolean",
                            "description": "Compare with On-Demand prices to calculate savings (default: true)",
                            "default": True,
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 50)",
                            "default": 50,
                        },
                    },
                    "required": ["service_name"],
                },
            ),
            Tool(
                name="get_customer_discount",
                description="Get customer discount information. Returns default 10% discount for all customers.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "customer_id": {
                            "type": "string",
                            "description": "Customer ID (optional, defaults to 'default' customer)",
                        }
                    },
                },
            ),
            # Spot VM Tools (require Azure authentication)
            Tool(
                name="spot_eviction_rates",
                description="Get Spot VM eviction rates for specified SKUs and regions. Requires Azure authentication (az login or environment variables). Returns eviction rate categories: 0-5%, 5-10%, 10-15%, 15-20%, 20%+.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "skus": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of VM SKU names (e.g., ['Standard_D2s_v4', 'Standard_D4s_v4'])",
                        },
                        "locations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of Azure regions (e.g., ['eastus', 'westus2'])",
                        },
                    },
                    "required": ["skus", "locations"],
                },
            ),
            Tool(
                name="spot_price_history",
                description="Get Spot VM price history for a specific SKU and region. Requires Azure authentication (az login or environment variables). Returns up to 90 days of historical Spot pricing data.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "sku": {
                            "type": "string",
                            "description": "VM SKU name (e.g., 'Standard_D2s_v4')",
                        },
                        "location": {
                            "type": "string",
                            "description": "Azure region (e.g., 'eastus')",
                        },
                        "os_type": {
                            "type": "string",
                            "description": "Operating system type ('linux' or 'windows')",
                            "enum": ["linux", "windows"],
                            "default": "linux",
                        },
                    },
                    "required": ["sku", "location"],
                },
            ),
            Tool(
                name="simulate_eviction",
                description="Simulate eviction of a Spot VM for testing application resilience. Requires Azure authentication with 'Virtual Machine Contributor' role. The VM will receive a 30-second eviction notice via Scheduled Events.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "vm_resource_id": {
                            "type": "string",
                            "description": "Full Azure resource ID of the Spot VM (e.g., '/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{vmName}')",
                        },
                    },
                    "required": ["vm_resource_id"],
                },
            ),
            # Orphaned Resources Tool (requires Azure authentication)
            Tool(
                name="find_orphaned_resources",
                description="Detect orphaned Azure resources (unattached disks, public IPs, App Service Plans, SQL Elastic Pools, Application Gateways, NAT Gateways, Load Balancers, Private DNS Zones, Private Endpoints, Virtual Network Gateways, DDoS Protection Plans) across subscriptions and compute their real historical cost via Azure Cost Management. Requires Azure authentication (az login or environment variables).",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "integer",
                            "description": "Number of days to look back for cost data (default: 60)",
                            "default": 60,
                        },
                        "all_subscriptions": {
                            "type": "boolean",
                            "description": "Scan all accessible subscriptions (default: true). Set to false to scan only the first subscription.",
                            "default": True,
                        },
                    },
                },
            ),
            # PTU Sizing + Cost Planner (no auth required for sizing; public API for cost)
            Tool(
                name="azure_ptu_sizing",
                description=(
                    "Estimate required Provisioned Throughput Units (PTUs) for Azure OpenAI / "
                    "AI Foundry model deployments. Calculates PTUs based on workload shape "
                    "(RPM, input/output tokens, caching) with official rounding rules. "
                    "Optionally estimates hourly/monthly cost via Azure Retail Prices API. "
                    "Supports Global, Data Zone, and Regional Provisioned deployment types."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "model": {
                            "type": "string",
                            "description": (
                                "Model identifier. Supported: gpt-5.2, gpt-5.2-codex, gpt-5.1, "
                                "gpt-5.1-codex, gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini, "
                                "gpt-4.1-nano, o3, o4-mini, gpt-4o, gpt-4o-mini, o3-mini, o1, "
                                "Llama-3.3-70B-Instruct, DeepSeek-R1, DeepSeek-V3-0324, DeepSeek-R1-0528"
                            ),
                        },
                        "deployment_type": {
                            "type": "string",
                            "description": "Provisioned deployment type",
                            "enum": ["GlobalProvisioned", "DataZoneProvisioned", "RegionalProvisioned"],
                        },
                        "rpm": {
                            "type": "integer",
                            "description": "Requests per minute at peak workload",
                        },
                        "avg_input_tokens": {
                            "type": "integer",
                            "description": "Average input (prompt) tokens per request",
                        },
                        "avg_output_tokens": {
                            "type": "integer",
                            "description": "Average output (completion) tokens per request",
                        },
                        "cached_tokens_per_request": {
                            "type": "integer",
                            "description": "Average cached tokens per request (deducted 100%% from utilization). Default: 0",
                            "default": 0,
                        },
                        "include_cost": {
                            "type": "boolean",
                            "description": "Fetch live $/PTU/hr pricing from Azure Retail Prices API. Default: false",
                            "default": False,
                        },
                        "region": {
                            "type": "string",
                            "description": "Azure region for cost lookup (e.g., 'eastus', 'westeurope'). Default: 'eastus'",
                            "default": "eastus",
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code for pricing (default: 'USD')",
                            "default": "USD",
                        },
                    },
                    "required": ["model", "deployment_type", "rpm", "avg_input_tokens", "avg_output_tokens"],
                },
            ),
            # Bulk cost estimation
            Tool(
                name="azure_bulk_estimate",
                description=(
                    "Estimate costs for multiple Azure resources in a single call. "
                    "Returns per-resource and total monthly/yearly costs. "
                    "Ideal for full-stack cost estimates. Supports service-name aliases, "
                    "request deduplication, and concurrent pricing lookups."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "resources": {
                            "type": "array",
                            "description": (
                                "List of resources to estimate. Each must have service_name, sku_name, region. "
                                "Optional: quantity (default 1), hours_per_month (default 730)."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "service_name": {"type": "string", "description": "Azure service name"},
                                    "sku_name": {"type": "string", "description": "SKU name"},
                                    "region": {"type": "string", "description": "Azure region"},
                                    "quantity": {
                                        "type": "number",
                                        "description": "Number of instances (default: 1)",
                                        "default": 1,
                                    },
                                    "hours_per_month": {
                                        "type": "number",
                                        "description": "Usage hours per month (default: 730)",
                                        "default": 730,
                                    },
                                },
                                "required": ["service_name", "sku_name", "region"],
                            },
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to all resources",
                        },
                    },
                    "required": ["resources"],
                },
            ),
        ]
        + get_databricks_tool_definitions()
        + get_github_pricing_tool_definitions()
    )
