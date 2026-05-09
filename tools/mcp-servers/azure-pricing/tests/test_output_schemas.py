"""Tests for v5.2 outputSchema attachment + structured-content emission.

Verifies:
1. Every in-scope tool definition has a populated ``outputSchema``.
2. ``MCPToolResponse`` behaves as a list (back-compat with v5.0/v5.1 tests).
3. ``strip_private_keys`` removes underscore-prefixed keys.
4. Each in-scope handler's structured payload validates against its schema.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import jsonschema
import pytest
from mcp.types import TextContent

from azure_pricing_mcp.handlers import ToolHandlers
from azure_pricing_mcp.mcp_response import MCPToolResponse, strip_private_keys
from azure_pricing_mcp.schemas import OUTPUT_SCHEMAS
from azure_pricing_mcp.tools import get_tool_definitions


def _get_in_scope_tools():
    """Get in-scope tools, excluding admin-only tools if admin not available."""
    all_in_scope = set(OUTPUT_SCHEMAS.keys())
    try:
        import azure.core.credentials  # noqa: F401
        import azure.identity  # noqa: F401
        return all_in_scope
    except ImportError:
        # Admin extras not available; exclude admin-only tools
        return all_in_scope - {"find_orphaned_resources", "spot_eviction_rates", "spot_price_history", "simulate_eviction"}


def test_in_scope_tools_have_output_schema():
    """Every tool in OUTPUT_SCHEMAS must declare outputSchema in its Tool def."""
    defs = {d.name: d for d in get_tool_definitions()}
    in_scope = _get_in_scope_tools()
    for tool_name in in_scope:
        assert tool_name in defs, f"{tool_name} missing from tool list"
        assert defs[tool_name].outputSchema is not None, f"{tool_name} has no outputSchema"


def test_out_of_scope_tools_have_no_output_schema():
    """Trivial-response tools should NOT advertise outputSchema until they
    emit structured content (else SDK errors on dispatch)."""
    defs = {d.name: d for d in get_tool_definitions()}
    in_scope = _get_in_scope_tools()
    for tool_name in defs:
        if tool_name not in in_scope:
            assert defs[tool_name].outputSchema is None, (
                f"{tool_name} has outputSchema but is not in-scope; SDK will "
                f"error if its handler doesn't emit structured content"
            )


def test_mcp_response_behaves_as_list():
    """MCPToolResponse subclasses list — existing test patterns must work."""
    text = TextContent(type="text", text="hello")
    response = MCPToolResponse([text], structured={"k": "v"})
    assert len(response) == 1
    assert response[0] is text
    assert response[0].text == "hello"
    assert response.structured == {"k": "v"}
    # Iteration works
    assert list(response) == [text]
    # Defaults to None when no structured payload
    bare = MCPToolResponse([text])
    assert bare.structured is None


def test_strip_private_keys():
    assert strip_private_keys({"a": 1, "_b": 2, "c": 3}) == {"a": 1, "c": 3}
    assert strip_private_keys({}) == {}
    assert strip_private_keys({"_only_private": True}) == {}


@pytest.mark.asyncio
async def test_handle_price_search_emits_structured():
    """handle_price_search returns MCPToolResponse with structured payload
    matching the PriceSearchOutput schema."""
    pricing_service = MagicMock()
    pricing_service.search_prices = AsyncMock(
        return_value={
            "items": [
                {
                    "serviceName": "Virtual Machines",
                    "skuName": "Standard_D2s_v5",
                    "armRegionName": "eastus",
                    "retailPrice": 0.096,
                    "unitOfMeasure": "1 Hour",
                    "type": "Consumption",
                }
            ],
            "count": 1,
            "currency": "USD",
        }
    )
    sku_service = MagicMock()
    handlers = ToolHandlers(pricing_service, sku_service)

    result = await handlers.handle_price_search({"service_name": "Virtual Machines"})

    # Back-compat: subscriptable as a list
    assert len(result) == 1
    assert isinstance(result[0], TextContent)

    # New in v5.2: structured payload validates against outputSchema
    assert hasattr(result, "structured")
    assert result.structured is not None
    assert result.structured["count"] == 1
    assert result.structured["currency"] == "USD"
    # Private metadata stripped
    assert "_discount_metadata" not in result.structured

    schema = OUTPUT_SCHEMAS["azure_price_search"].model_json_schema()
    jsonschema.validate(result.structured, schema)


@pytest.mark.asyncio
async def test_handle_bulk_estimate_emits_structured():
    """handle_bulk_estimate emits structured content matching BulkEstimateOutput."""
    pricing_service = MagicMock()
    bulk_service = MagicMock()
    bulk_service.bulk_estimate = AsyncMock(
        return_value={
            "resource_count": 2,
            "unique_specs": 2,
            "successful": 2,
            "failed": 0,
            "currency": "USD",
            "line_items": [
                {
                    "service_name": "Virtual Machines",
                    "sku_name": "Standard_D2s_v5",
                    "region": "eastus",
                    "quantity": 1,
                    "monthly_cost": 70.08,
                    "yearly_cost": 840.96,
                }
            ],
            "totals": {"monthly": 70.08, "yearly": 840.96},
            "errors": [],
        }
    )
    sku_service = MagicMock()
    handlers = ToolHandlers(pricing_service, sku_service, bulk_service=bulk_service)

    result = await handlers.handle_bulk_estimate(
        {"resources": [{"service_name": "Virtual Machines", "sku_name": "Standard_D2s_v5", "region": "eastus"}]}
    )

    assert len(result) == 1
    assert result.structured is not None
    assert result.structured["successful"] == 2

    schema = OUTPUT_SCHEMAS["azure_bulk_estimate"].model_json_schema()
    jsonschema.validate(result.structured, schema)


@pytest.mark.asyncio
async def test_legacy_handler_returns_plain_list():
    """Out-of-scope handlers continue returning plain list[TextContent]."""
    pricing_service = MagicMock()
    pricing_service.get_customer_discount = AsyncMock(
        return_value={
            "customer_id": "default",
            "discount_type": "Standard",
            "discount_percentage": 10,
            "description": "Default customer discount",
            "applicable_services": "All",
            "note": "Test note.",
        }
    )
    sku_service = MagicMock()
    handlers = ToolHandlers(pricing_service, sku_service)

    result = await handlers.handle_customer_discount({})

    assert len(result) == 1
    # Plain list — no .structured attribute
    assert not hasattr(result, "structured") or getattr(result, "structured", None) is None


def test_output_schemas_are_permissive():
    """Schemas must allow extra keys (extra='allow') so service-layer additions
    don't break v5.2 validation."""
    for tool_name, model_cls in OUTPUT_SCHEMAS.items():
        # Building from a payload with unknown fields should NOT raise
        instance = model_cls.model_validate(
            {**{"_unrelated": 1, "future_field": "value"}, **_minimal_payload(tool_name)}
        )
        assert instance is not None


def _minimal_payload(tool_name: str) -> dict:
    """Minimal valid payload per schema (covers required fields)."""
    payloads = {
        "azure_price_search": {},
        "azure_price_compare": {"service_name": "Virtual Machines"},
        "azure_cost_estimate": {},
        "azure_region_recommend": {},
        "azure_ri_pricing": {},
        "azure_bulk_estimate": {},
        "azure_sku_discovery": {"original_search": "vm"},
        "azure_discover_skus": {"service_name": "Virtual Machines"},
        "find_orphaned_resources": {},
        "databricks_dbu_pricing": {},
        "github_pricing": {},
    }
    return payloads.get(tool_name, {})
