"""Input validation for Azure Pricing MCP tool arguments.

Centralizes argument validation so that handlers fail fast with clear,
structured error messages before calling service methods.
"""

import logging
from typing import Any

from .error_codes import ErrorCode, error_response

logger = logging.getLogger(__name__)

# Per-tool required-fields and basic type constraints
_TOOL_REQUIRED_FIELDS: dict[str, list[str]] = {
    "azure_price_search": [],
    "azure_price_compare": ["service_name"],
    "azure_cost_estimate": ["service_name", "sku_name", "region"],
    "azure_discover_skus": ["service_name"],
    "azure_sku_discovery": ["service_hint"],
    "azure_region_recommend": ["service_name", "sku_name"],
    "azure_ri_pricing": ["service_name"],
    "azure_bulk_estimate": ["resources"],
    "get_customer_discount": [],
    "spot_eviction_rates": ["skus", "locations"],
    "spot_price_history": ["sku", "location"],
    "simulate_eviction": ["vm_resource_id"],
    "azure_cache_stats": [],
}

# Fields that must be non-negative numbers when present
_NON_NEGATIVE_FIELDS = {"limit", "top_n", "hours_per_month", "quantity", "discount_percentage"}

# Fields that must be non-empty strings when present
_NON_EMPTY_STRING_FIELDS = {"service_name", "sku_name", "region", "service_hint", "sku", "location", "vm_resource_id"}


def validate_arguments(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any] | None:
    """Validate tool arguments and return an error_response dict on failure.

    Args:
        tool_name: The MCP tool name (e.g. ``azure_cost_estimate``).
        arguments: The raw arguments dict from the tool call.

    Returns:
        ``None`` if validation passes, otherwise a structured error dict.
    """
    required = _TOOL_REQUIRED_FIELDS.get(tool_name, [])

    missing = [f for f in required if f not in arguments or arguments[f] is None]
    if missing:
        return error_response(
            ErrorCode.MISSING_REQUIRED_FIELD,
            f"Missing required field(s): {', '.join(missing)}",
            details={"tool": tool_name, "missing_fields": missing},
        )

    for field in _NON_EMPTY_STRING_FIELDS:
        if field in arguments and isinstance(arguments[field], str) and not arguments[field].strip():
            return error_response(
                ErrorCode.INVALID_FIELD_VALUE,
                f"Field '{field}' must be a non-empty string",
                details={"tool": tool_name, "field": field},
            )

    for field in _NON_NEGATIVE_FIELDS:
        val = arguments.get(field)
        if val is not None and isinstance(val, (int, float)) and val < 0:
            return error_response(
                ErrorCode.INVALID_FIELD_VALUE,
                f"Field '{field}' must be non-negative, got {val}",
                details={"tool": tool_name, "field": field, "value": val},
            )

    if tool_name == "azure_bulk_estimate":
        resources = arguments.get("resources")
        if isinstance(resources, list) and len(resources) == 0:
            return error_response(
                ErrorCode.EMPTY_RESOURCE_LIST,
                "The 'resources' list must contain at least one item",
                details={"tool": tool_name},
            )

    return None
