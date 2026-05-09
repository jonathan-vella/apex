"""Tool definitions for Azure Pricing MCP Server."""

from mcp.types import Tool, ToolAnnotations

# Phase 4.17 — admin-tier tools (spot/simulate/find_orphaned). The admin
# subpackage is always importable, but admin tools are only registered when the
# ``[admin]`` extras are installed (azure-identity is needed at runtime).
from .admin import get_admin_tool_definitions as _get_admin_tool_definitions
from .admin import is_admin_available
from .databricks.tools import get_databricks_tool_definitions
from .github_pricing.tools import get_github_pricing_tool_definitions
from .response_format import RESPONSE_FORMAT_SCHEMA
from .schemas import get_output_schema

_ADMIN_AVAILABLE = is_admin_available()


def get_admin_tool_definitions() -> list[Tool]:
    """Return admin-tier tool definitions, or empty list when [admin] extras
    aren't installed."""
    return _get_admin_tool_definitions() if _ADMIN_AVAILABLE else []


# v5.0 — Phase 4.13: shared MCP tool annotation presets. Read tools are
# read-only + idempotent.
_READ_ANNOTATIONS = ToolAnnotations(readOnlyHint=True, idempotentHint=True, destructiveHint=False)

# v5.0 — Phase 2.6: shared inputSchema fragments. Repeating these descriptions
# verbatim across 4+ tools wastes tokens in agent ``tools/list`` responses.
_DISCOUNT_PERCENTAGE_SCHEMA: dict = {
    "type": "number",
    "description": (
        "Discount percentage to apply to retail prices (e.g. 10 for 10%). "
        "If omitted and ``show_with_discount`` is false, no discount is applied."
    ),
}
_SHOW_WITH_DISCOUNT_SCHEMA: dict = {
    "type": "boolean",
    "description": "Apply the default discount when ``discount_percentage`` is not given.",
    "default": False,
}
_CURRENCY_CODE_SCHEMA: dict = {
    "type": "string",
    "description": "Currency code (default: USD).",
    "default": "USD",
}


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
                        "currency_code": _CURRENCY_CODE_SCHEMA,
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 50)",
                            "default": 50,
                        },
                        "discount_percentage": _DISCOUNT_PERCENTAGE_SCHEMA,
                        "show_with_discount": _SHOW_WITH_DISCOUNT_SCHEMA,
                        "validate_sku": {
                            "type": "boolean",
                            "description": "Whether to validate SKU names and provide suggestions (default: true)",
                            "default": True,
                        },
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                },
                outputSchema=get_output_schema("azure_price_search"),
                annotations=_READ_ANNOTATIONS,
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
                        "currency_code": _CURRENCY_CODE_SCHEMA,
                        "discount_percentage": _DISCOUNT_PERCENTAGE_SCHEMA,
                        "show_with_discount": _SHOW_WITH_DISCOUNT_SCHEMA,
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                    "required": ["service_name"],
                },
                outputSchema=get_output_schema("azure_price_compare"),
                annotations=_READ_ANNOTATIONS,
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
                        "currency_code": _CURRENCY_CODE_SCHEMA,
                        "discount_percentage": _DISCOUNT_PERCENTAGE_SCHEMA,
                        "show_with_discount": _SHOW_WITH_DISCOUNT_SCHEMA,
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                    "required": ["service_name", "sku_name", "region"],
                },
                outputSchema=get_output_schema("azure_cost_estimate"),
                annotations=_READ_ANNOTATIONS,
            ),
            Tool(
                name="azure_discover_skus",
                description=(
                    "[DEPRECATED v5.0 — use azure_sku_discovery] "
                    "Discover available SKUs for a specific Azure service. "
                    "This tool is now a thin alias of azure_sku_discovery and will be "
                    "removed in v6.0."
                ),
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
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                    "required": ["service_name"],
                },
                outputSchema=get_output_schema("azure_discover_skus"),
                annotations=_READ_ANNOTATIONS,
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
                        "currency_code": _CURRENCY_CODE_SCHEMA,
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 30)",
                            "default": 30,
                        },
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                    "required": ["service_hint"],
                },
                outputSchema=get_output_schema("azure_sku_discovery"),
                annotations=_READ_ANNOTATIONS,
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
                        "currency_code": _CURRENCY_CODE_SCHEMA,
                        "discount_percentage": _DISCOUNT_PERCENTAGE_SCHEMA,
                        "show_with_discount": _SHOW_WITH_DISCOUNT_SCHEMA,
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                    "required": ["service_name", "sku_name"],
                },
                outputSchema=get_output_schema("azure_region_recommend"),
                annotations=_READ_ANNOTATIONS,
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
                        "currency_code": _CURRENCY_CODE_SCHEMA,
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
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                    "required": ["service_name"],
                },
                outputSchema=get_output_schema("azure_ri_pricing"),
                annotations=_READ_ANNOTATIONS,
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
                annotations=_READ_ANNOTATIONS,
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
                annotations=_READ_ANNOTATIONS,
            ),
            # Bulk cost estimation
            Tool(
                name="azure_bulk_estimate",
                description=(
                    "Estimate costs for multiple Azure resources in a single call. "
                    "Returns per-resource and total monthly/yearly costs. "
                    "Ideal for full-stack cost estimates. Supports service-name aliases, "
                    "request deduplication, concurrent pricing lookups, and v5.4 "
                    "usage-aware projection (transactions_per_month, gb_stored, etc.) "
                    "for transaction-based and storage-retention meters."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "resources": {
                            "type": "array",
                            "description": (
                                "List of resources to estimate. Each must have service_name, sku_name, region. "
                                "Optional: quantity (default 1), hours_per_month (default 730), "
                                "usage (transactions_per_month / gb_stored / gb_transferred / seconds_runtime), "
                                "product_filter (substring of productName, e.g. 'Tables' for Storage Account)."
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
                                    "usage": {
                                        "type": "object",
                                        "description": (
                                            "Workload estimates for non-time-based meters. "
                                            "Keys: transactions_per_month, gb_stored, gb_transferred, "
                                            "seconds_runtime."
                                        ),
                                        "properties": {
                                            "transactions_per_month": {
                                                "type": "number",
                                                "description": "Operations per month (e.g., 100K Key Vault ops, 2.6M Storage Tables write ops).",
                                            },
                                            "gb_stored": {
                                                "type": "number",
                                                "description": "GB of data retained per month.",
                                            },
                                            "gb_transferred": {
                                                "type": "number",
                                                "description": "GB of egress / data transfer per month.",
                                            },
                                            "seconds_runtime": {
                                                "type": "number",
                                                "description": "Seconds of per-second-billed compute (e.g., ACR build tasks).",
                                            },
                                        },
                                    },
                                    "product_filter": {
                                        "type": "string",
                                        "description": (
                                            "Substring matched against productName. Use this to "
                                            "disambiguate multi-product services like Storage Account "
                                            "(Tables / Block Blob / Queue / Files share the same skuName)."
                                        ),
                                    },
                                },
                                "required": ["service_name", "sku_name", "region"],
                            },
                        },
                        "currency_code": _CURRENCY_CODE_SCHEMA,
                        "discount_percentage": _DISCOUNT_PERCENTAGE_SCHEMA,
                        "response_format": RESPONSE_FORMAT_SCHEMA,
                    },
                    "required": ["resources"],
                },
                outputSchema=get_output_schema("azure_bulk_estimate"),
                annotations=_READ_ANNOTATIONS,
            ),
        ]
        + get_admin_tool_definitions()
        + get_databricks_tool_definitions()
        + get_github_pricing_tool_definitions()
    )
