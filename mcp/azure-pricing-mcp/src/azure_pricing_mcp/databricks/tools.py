"""Tool definitions for Databricks DBU pricing."""

from mcp.types import Tool


def get_databricks_tool_definitions() -> list[Tool]:
    """Return MCP tool definitions for Databricks DBU pricing."""
    return [
        Tool(
            name="databricks_dbu_pricing",
            description=(
                "Search and list Azure Databricks DBU (Databricks Unit) rates by workload type, "
                "pricing tier, and region. Returns real-time pricing from the Azure Retail Prices API."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "workload_type": {
                        "type": "string",
                        "description": (
                            "Workload type filter (e.g., 'all-purpose', 'jobs', 'jobs light', "
                            "'sql pro', 'serverless sql', 'automated serverless', "
                            "'delta live tables pro', 'model training'). "
                            "Supports aliases like 'etl', 'notebook', 'warehouse'."
                        ),
                    },
                    "tier": {
                        "type": "string",
                        "description": "Pricing tier: 'Premium' or 'Standard'. If omitted, returns both.",
                        "enum": ["Premium", "Standard"],
                    },
                    "region": {
                        "type": "string",
                        "description": "Azure region (default: 'eastus')",
                        "default": "eastus",
                    },
                    "currency_code": {
                        "type": "string",
                        "description": "Currency code (default: USD)",
                        "default": "USD",
                    },
                },
            },
        ),
        Tool(
            name="databricks_cost_estimate",
            description=(
                "Estimate monthly and annual Azure Databricks costs based on DBU consumption. "
                "Calculates: DBU_rate x dbu_count x num_workers x hours_per_day x days_per_month. "
                "Note: VM compute, storage, and networking costs are billed separately."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "workload_type": {
                        "type": "string",
                        "description": (
                            "Type of Databricks workload (e.g., 'all-purpose', 'jobs', 'sql pro', 'serverless sql')"
                        ),
                    },
                    "dbu_count": {
                        "type": "number",
                        "description": (
                            "Number of DBUs per worker per hour "
                            "(depends on VM instance type, e.g., Standard_DS3_v2 = 0.75 DBU)"
                        ),
                    },
                    "hours_per_day": {
                        "type": "number",
                        "description": "Hours of usage per day (default: 8)",
                        "default": 8,
                    },
                    "days_per_month": {
                        "type": "integer",
                        "description": "Working days per month (default: 22)",
                        "default": 22,
                    },
                    "tier": {
                        "type": "string",
                        "description": "Pricing tier (default: 'Premium')",
                        "enum": ["Premium", "Standard"],
                        "default": "Premium",
                    },
                    "region": {
                        "type": "string",
                        "description": "Azure region (default: 'eastus')",
                        "default": "eastus",
                    },
                    "currency_code": {
                        "type": "string",
                        "description": "Currency code (default: USD)",
                        "default": "USD",
                    },
                    "num_workers": {
                        "type": "integer",
                        "description": "Number of worker nodes (default: 1)",
                        "default": 1,
                    },
                    "discount_percentage": {
                        "type": "number",
                        "description": "Discount percentage to apply (e.g., 10 for 10%)",
                    },
                },
                "required": ["workload_type", "dbu_count"],
            },
        ),
        Tool(
            name="databricks_compare_workloads",
            description=(
                "Compare Azure Databricks DBU costs across workload types or regions. "
                "Useful for choosing the most cost-effective workload type or region "
                "for your Databricks deployment."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "workload_types": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "List of workload types to compare "
                            "(e.g., ['all-purpose', 'jobs', 'serverless sql']). "
                            "If omitted, compares common workload types."
                        ),
                    },
                    "regions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "List of regions to compare (default: ['eastus']). "
                            "Provide multiple regions to compare costs across regions."
                        ),
                    },
                    "tier": {
                        "type": "string",
                        "description": "Pricing tier (default: 'Premium')",
                        "enum": ["Premium", "Standard"],
                        "default": "Premium",
                    },
                    "currency_code": {
                        "type": "string",
                        "description": "Currency code (default: USD)",
                        "default": "USD",
                    },
                    "dbu_count": {
                        "type": "number",
                        "description": "Optional DBU count per worker for monthly cost projection",
                    },
                    "hours_per_month": {
                        "type": "number",
                        "description": (
                            "Optional hours per month for cost projection (default: 730 if dbu_count is provided)"
                        ),
                    },
                },
            },
        ),
    ]
