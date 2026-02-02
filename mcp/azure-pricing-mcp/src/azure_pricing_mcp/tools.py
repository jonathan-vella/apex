"""Tool definitions for Azure Pricing MCP Server."""

from mcp.types import Tool


def get_tool_definitions() -> list[Tool]:
    """Get all tool definitions for the Azure Pricing MCP Server."""
    return [
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
    ]
