"""Tool definitions for Azure Pricing MCP Server."""

from mcp.types import Tool

# Shared output_format property — reused across 8 tools
_OUTPUT_FORMAT_PROP = {
    "type": "string",
    "enum": ["verbose", "compact"],
    "description": "'compact' (projected JSON, default) or 'verbose' (human-friendly markdown)",
    "default": "compact",
}

# Shared discount properties — reused across 5 pricing tools
_DISCOUNT_PROPS = {
    "discount_percentage": {
        "type": "number",
        "description": "Discount % to apply (e.g., 10). Combines with show_with_discount.",
    },
    "show_with_discount": {
        "type": "boolean",
        "description": "Apply default 10% discount unless discount_percentage is set.",
        "default": False,
    },
}


def get_tool_definitions() -> list[Tool]:
    """Get all tool definitions for the Azure Pricing MCP Server."""
    return [
        Tool(
            name="azure_price_search",
            description="Search Azure retail prices with filters (service, region, SKU, price type).",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "Azure service name (e.g., 'Virtual Machines')"},
                    "service_family": {"type": "string", "description": "Service family (e.g., 'Compute', 'Storage')"},
                    "region": {"type": "string", "description": "Azure region (e.g., 'eastus')"},
                    "sku_name": {"type": "string", "description": "SKU name (partial match supported)"},
                    "price_type": {"type": "string", "description": "'Consumption', 'Reservation', or 'DevTestConsumption'"},
                    "currency_code": {"type": "string", "default": "USD"},
                    "limit": {"type": "integer", "description": "Max results", "default": 50},
                    **_DISCOUNT_PROPS,
                    "validate_sku": {"type": "boolean", "description": "Validate SKU names and suggest alternatives", "default": True},
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
            },
        ),
        Tool(
            name="azure_price_compare",
            description="Compare Azure prices across regions or SKUs for a service.",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "Azure service name"},
                    "sku_name": {"type": "string", "description": "Specific SKU to compare"},
                    "regions": {"type": "array", "items": {"type": "string"}, "description": "Regions to compare"},
                    "currency_code": {"type": "string", "default": "USD"},
                    **_DISCOUNT_PROPS,
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
                "required": ["service_name"],
            },
        ),
        Tool(
            name="azure_cost_estimate",
            description="Estimate Azure costs for a single resource. Handles hourly, monthly, per-GB, and per-transaction pricing.",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "Azure service name"},
                    "sku_name": {"type": "string", "description": "SKU name"},
                    "region": {"type": "string", "description": "Azure region"},
                    "hours_per_month": {"type": "number", "description": "Usage hours per month", "default": 730},
                    "currency_code": {"type": "string", "default": "USD"},
                    **_DISCOUNT_PROPS,
                    "quantity": {"type": "number", "description": "Number of instances", "default": 1},
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
                "required": ["service_name", "sku_name", "region"],
            },
        ),
        Tool(
            name="azure_discover_skus",
            description="List available SKUs for a specific Azure service.",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "Azure service name"},
                    "region": {"type": "string", "description": "Azure region filter"},
                    "price_type": {"type": "string", "default": "Consumption"},
                    "limit": {"type": "integer", "description": "Max SKUs to return", "default": 100},
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
                "required": ["service_name"],
            },
        ),
        Tool(
            name="azure_sku_discovery",
            description="Fuzzy-match Azure service names and discover their SKUs.",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_hint": {"type": "string", "description": "Service name or alias (e.g., 'vm', 'app service', 'storage')"},
                    "region": {"type": "string", "description": "Azure region filter"},
                    "currency_code": {"type": "string", "default": "USD"},
                    "limit": {"type": "integer", "default": 30},
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
                "required": ["service_hint"],
            },
        ),
        Tool(
            name="azure_region_recommend",
            description="Rank cheapest Azure regions for a service+SKU. Returns top regions with prices and savings.",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "Azure service name"},
                    "sku_name": {"type": "string", "description": "SKU to price across regions"},
                    "top_n": {"type": "integer", "description": "Top N recommendations", "default": 10},
                    "currency_code": {"type": "string", "default": "USD"},
                    **_DISCOUNT_PROPS,
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
                "required": ["service_name", "sku_name"],
            },
        ),
        Tool(
            name="azure_ri_pricing",
            description="Get Reserved Instance pricing with savings analysis and break-even calculation.",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "Azure service name"},
                    "sku_name": {"type": "string", "description": "SKU name"},
                    "region": {"type": "string", "description": "Azure region"},
                    "reservation_term": {"type": "string", "enum": ["1 Year", "3 Years"]},
                    "currency_code": {"type": "string", "default": "USD"},
                    "compare_on_demand": {"type": "boolean", "description": "Compare with on-demand prices", "default": True},
                    "limit": {"type": "integer", "default": 50},
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
                "required": ["service_name"],
            },
        ),
        Tool(
            name="azure_bulk_estimate",
            description="Estimate costs for multiple Azure resources in one call. Returns per-resource and total monthly/yearly costs.",
            inputSchema={
                "type": "object",
                "properties": {
                    "resources": {
                        "type": "array",
                        "description": "Resources to estimate (service_name, sku_name, region required; quantity, hours_per_month optional).",
                        "items": {
                            "type": "object",
                            "properties": {
                                "service_name": {"type": "string"},
                                "sku_name": {"type": "string"},
                                "region": {"type": "string"},
                                "quantity": {"type": "number", "default": 1},
                                "hours_per_month": {"type": "number", "default": 730},
                            },
                            "required": ["service_name", "sku_name", "region"],
                        },
                    },
                    "currency_code": {"type": "string", "default": "USD"},
                    **_DISCOUNT_PROPS,
                    "output_format": _OUTPUT_FORMAT_PROP,
                },
                "required": ["resources"],
            },
        ),
        Tool(
            name="get_customer_discount",
            description="Get customer discount info. Returns default 10%.",
            inputSchema={
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer ID (optional)"},
                },
            },
        ),
        Tool(
            name="spot_eviction_rates",
            description="Get Spot VM eviction rates by SKU and region. Requires Azure auth.",
            inputSchema={
                "type": "object",
                "properties": {
                    "skus": {"type": "array", "items": {"type": "string"}, "description": "VM SKU names"},
                    "locations": {"type": "array", "items": {"type": "string"}, "description": "Azure regions"},
                },
                "required": ["skus", "locations"],
            },
        ),
        Tool(
            name="spot_price_history",
            description="Get 90-day Spot VM price history for a SKU+region. Requires Azure auth.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "description": "VM SKU name"},
                    "location": {"type": "string", "description": "Azure region"},
                    "os_type": {"type": "string", "enum": ["linux", "windows"], "default": "linux"},
                },
                "required": ["sku", "location"],
            },
        ),
        Tool(
            name="simulate_eviction",
            description="Simulate Spot VM eviction (30s notice). Requires VM Contributor role.",
            inputSchema={
                "type": "object",
                "properties": {
                    "vm_resource_id": {"type": "string", "description": "Full Azure VM resource ID"},
                },
                "required": ["vm_resource_id"],
            },
        ),
        Tool(
            name="azure_cache_stats",
            description="Show pricing cache hit/miss statistics.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]
