"""Admin-tier tool definitions (gated by ``[admin]`` extras)."""

from __future__ import annotations

from mcp.types import Tool, ToolAnnotations

from ..response_format import RESPONSE_FORMAT_SCHEMA
from ..schemas import get_output_schema

_READ_ANNOTATIONS = ToolAnnotations(readOnlyHint=True, idempotentHint=True, destructiveHint=False)
_DESTRUCTIVE_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=False, idempotentHint=False, destructiveHint=True, openWorldHint=True
)


def get_admin_tool_definitions() -> list[Tool]:
    """Return MCP tool definitions for the admin tier.

    Only called when ``[admin]`` extras are installed (the import-time probe
    in :mod:`azure_pricing_mcp.admin.__init__` succeeds).
    """
    return [
        Tool(
            name="spot_eviction_rates",
            description=(
                "Get Spot VM eviction rates for specified SKUs and regions. "
                "Requires the [admin] extras + Azure authentication (az login "
                "or environment variables). Returns eviction rate categories: "
                "0-5%, 5-10%, 10-15%, 15-20%, 20%+."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "skus": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": ("List of VM SKU names (e.g., ['Standard_D2s_v4', 'Standard_D4s_v4'])"),
                    },
                    "locations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of Azure regions (e.g., ['eastus', 'westus2'])",
                    },
                },
                "required": ["skus", "locations"],
            },
            annotations=_READ_ANNOTATIONS,
        ),
        Tool(
            name="spot_price_history",
            description=(
                "Get Spot VM price history for a specific SKU and region. "
                "Requires the [admin] extras + Azure authentication. Returns "
                "up to 90 days of historical Spot pricing data."
            ),
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
            annotations=_READ_ANNOTATIONS,
        ),
        Tool(
            name="simulate_eviction",
            description=(
                "Simulate eviction of a Spot VM for testing application "
                "resilience. Requires the [admin] extras + Azure authentication "
                "with 'Virtual Machine Contributor' role. The VM will receive a "
                "30-second eviction notice via Scheduled Events."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "vm_resource_id": {
                        "type": "string",
                        "description": (
                            "Full Azure resource ID of the Spot VM "
                            "(e.g., '/subscriptions/{sub}/resourceGroups/{rg}/"
                            "providers/Microsoft.Compute/virtualMachines/{vmName}')"
                        ),
                    },
                },
                "required": ["vm_resource_id"],
            },
            annotations=_DESTRUCTIVE_ANNOTATIONS,
        ),
        Tool(
            name="find_orphaned_resources",
            description=(
                "Detect orphaned Azure resources (unattached disks, public IPs, "
                "App Service Plans, SQL Elastic Pools, Application Gateways, NAT "
                "Gateways, Load Balancers, Private DNS Zones, Private Endpoints, "
                "Virtual Network Gateways, DDoS Protection Plans) across "
                "subscriptions and compute their real historical cost via Azure "
                "Cost Management. Requires the [admin] extras + Azure "
                "authentication."
            ),
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
                        "description": (
                            "Scan all accessible subscriptions (default: true). "
                            "Set to false to scan only the first subscription."
                        ),
                        "default": True,
                    },
                    "response_format": RESPONSE_FORMAT_SCHEMA,
                },
            },
            outputSchema=get_output_schema("find_orphaned_resources"),
            annotations=_READ_ANNOTATIONS,
        ),
    ]
