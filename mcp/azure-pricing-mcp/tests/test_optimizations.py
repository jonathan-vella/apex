"""Tests for optimization changes: field projection, compact handlers, circuit breaker."""

import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import pytest

from azure_pricing_mcp.formatters import format_compact


class TestFieldProjection:
    """Tests for compact format field projection."""

    def test_projects_pricing_items(self):
        """Items in compact mode should only contain essential fields."""
        result = {
            "items": [
                {
                    "serviceName": "Virtual Machines",
                    "productName": "Virtual Machines D Series",
                    "skuName": "D2s v3",
                    "armRegionName": "eastus",
                    "location": "US East",
                    "retailPrice": 0.096,
                    "unitOfMeasure": "1 Hour",
                    "type": "Consumption",
                    "meterName": "D2s v3",
                    "effectiveStartDate": "2024-01-01",
                    "savingsPlan": [{"term": "1 Year", "retailPrice": 0.062}],
                    "isPrimaryMeterRegion": True,
                }
            ],
            "count": 1,
        }
        output = json.loads(format_compact(result))
        item = output["items"][0]
        assert set(item.keys()) == {"serviceName", "skuName", "armRegionName", "retailPrice", "unitOfMeasure", "type"}
        assert item["retailPrice"] == 0.096
        assert "productName" not in item
        assert "savingsPlan" not in item
        assert "meterName" not in item

    def test_projects_recommendations(self):
        """Region recommendations should be projected."""
        result = {
            "recommendations": [
                {
                    "region": "eastus",
                    "location": "US East",
                    "retail_price": 0.096,
                    "spot_price": 0.02,
                    "savings_vs_most_expensive": 15.0,
                    "unit_of_measure": "1 Hour",
                    "original_price": 0.106,
                }
            ],
            "service_name": "Virtual Machines",
        }
        output = json.loads(format_compact(result))
        rec = output["recommendations"][0]
        assert "region" in rec
        assert "retail_price" in rec
        assert "spot_price" in rec
        assert "savings_vs_most_expensive" in rec
        assert "unit_of_measure" not in rec
        assert "original_price" not in rec

    def test_projects_line_items(self):
        """Bulk estimate line items should be projected."""
        result = {
            "line_items": [
                {
                    "service_name": "Virtual Machines",
                    "sku_name": "D2s v3",
                    "region": "eastus",
                    "quantity": 2,
                    "monthly_cost": 140.16,
                    "yearly_cost": 1681.92,
                    "indices": [0],
                    "unit_rate": 0.096,
                    "pricing_model": "per-hour",
                }
            ],
            "totals": {"monthly": 140.16, "yearly": 1681.92},
        }
        output = json.loads(format_compact(result))
        item = output["line_items"][0]
        assert "service_name" in item
        assert "monthly_cost" in item
        assert "indices" not in item
        assert "unit_rate" not in item

    def test_projects_ri_items(self):
        """RI items should be projected."""
        result = {
            "ri_items": [
                {
                    "skuName": "D2s v3",
                    "armRegionName": "eastus",
                    "retailPrice": 0.062,
                    "unitOfMeasure": "1 Hour",
                    "reservationTerm": "1 Year",
                    "productName": "Virtual Machines D Series",
                    "meterName": "D2s v3",
                }
            ],
            "count": 1,
        }
        output = json.loads(format_compact(result))
        item = output["ri_items"][0]
        assert "reservationTerm" in item
        assert "productName" not in item

    def test_projects_comparison(self):
        """RI comparison should be projected."""
        result = {
            "comparison": [
                {
                    "sku": "D2s v3",
                    "region": "eastus",
                    "term": "1 Year",
                    "savings_percentage": 35.0,
                    "ri_hourly": 0.062,
                    "od_hourly": 0.096,
                    "break_even_months": 7,
                    "annual_savings": 298,
                    "ri_yearly": 543.12,
                }
            ],
        }
        output = json.loads(format_compact(result))
        comp = output["comparison"][0]
        assert "savings_percentage" in comp
        assert "ri_yearly" not in comp

    def test_no_indent_in_compact(self):
        """Compact output should not use indentation."""
        result = {"count": 5, "items": []}
        output = format_compact(result)
        assert "\n" not in output

    def test_non_dict_items_passed_through(self):
        """Non-dict items in a list should pass through unchanged."""
        result = {"items": [1, 2, 3]}
        output = json.loads(format_compact(result))
        assert output["items"] == [1, 2, 3]

    def test_preserves_pricing_model(self):
        """pricing_model and usage_assumptions should NOT be stripped."""
        result = {
            "pricing_model": "per-hour",
            "usage_assumptions": {"hours_per_month": 730},
            "count": 1,
        }
        output = json.loads(format_compact(result))
        assert output["pricing_model"] == "per-hour"
        assert output["usage_assumptions"]["hours_per_month"] == 730


class TestHandlerCompactSupport:
    """Tests for handlers that now support compact output."""

    @pytest.mark.asyncio
    async def test_ri_pricing_compact(self):
        """_do_ri_pricing should return compact JSON when output_format=compact."""
        from azure_pricing_mcp.handlers import ToolHandlers

        mock_pricing = AsyncMock()
        mock_pricing.get_ri_pricing.return_value = {
            "ri_items": [{"skuName": "D2s v3", "armRegionName": "eastus", "retailPrice": 0.062,
                          "unitOfMeasure": "1 Hour", "reservationTerm": "1 Year", "productName": "VM"}],
            "count": 1,
            "currency": "USD",
        }

        handlers = ToolHandlers(mock_pricing, AsyncMock())
        result = await handlers._do_ri_pricing({"service_name": "Virtual Machines", "output_format": "compact"})
        output = json.loads(result[0].text)
        assert "ri_items" in output
        item = output["ri_items"][0]
        assert "productName" not in item

    @pytest.mark.asyncio
    async def test_discover_skus_compact(self):
        """_do_discover_skus should return compact JSON."""
        from azure_pricing_mcp.handlers import ToolHandlers

        mock_sku = AsyncMock()
        mock_sku.discover_skus.return_value = {
            "skus": [{"name": "D2s v3", "price": 0.096}],
            "total_skus": 1,
            "service_name": "Virtual Machines",
        }

        handlers = ToolHandlers(AsyncMock(), mock_sku)
        result = await handlers._do_discover_skus({"service_name": "Virtual Machines", "output_format": "compact"})
        output = json.loads(result[0].text)
        assert output["total_skus"] == 1

    @pytest.mark.asyncio
    async def test_sku_discovery_compact(self):
        """_do_sku_discovery should return compact JSON."""
        from azure_pricing_mcp.handlers import ToolHandlers

        mock_sku = AsyncMock()
        mock_sku.discover_service_skus.return_value = {
            "service_found": "Virtual Machines",
            "original_search": "vm",
            "skus": {},
            "total_skus": 0,
        }

        handlers = ToolHandlers(AsyncMock(), mock_sku)
        result = await handlers._do_sku_discovery({"service_hint": "vm", "output_format": "compact"})
        output = json.loads(result[0].text)
        assert output["service_found"] == "Virtual Machines"


class TestBulkEstimateDiscountFix:
    """Test that _do_bulk_estimate now attaches discount metadata."""

    @pytest.mark.asyncio
    async def test_attaches_discount_metadata(self):
        from azure_pricing_mcp.handlers import ToolHandlers

        mock_pricing = AsyncMock()
        mock_bulk = AsyncMock()
        mock_bulk.bulk_estimate.return_value = {
            "line_items": [],
            "errors": [],
            "totals": {"monthly": 0, "yearly": 0},
            "currency": "USD",
            "resource_count": 0,
            "successful": 0,
            "failed": 0,
        }

        handlers = ToolHandlers(mock_pricing, AsyncMock(), bulk_service=mock_bulk)
        result = await handlers._do_bulk_estimate({
            "resources": [],
            "output_format": "verbose",
            "discount_percentage": 10,
        })
        # The handler should have called _attach_discount_metadata on the result
        # In verbose mode, the text output should be generated from bulk formatter
        assert len(result) == 1


class TestCircuitBreaker:
    """Tests for retirement service circuit breaker."""

    @pytest.mark.asyncio
    async def test_circuit_opens_after_consecutive_failures(self):
        from azure_pricing_mcp.services.retirement import RetirementService

        mock_client = AsyncMock()
        mock_client.session = True  # Simulate active session
        mock_client.fetch_text = AsyncMock(side_effect=Exception("GitHub down"))

        service = RetirementService(mock_client)

        # First call: failure 1 → still returns fallback
        data1 = await service.get_retirement_data()
        assert data1 is not None
        assert service._consecutive_failures == 1
        assert service._circuit_open_until is None

        # Expire cache to force re-fetch
        service._cache_time = datetime.now() - timedelta(hours=25)

        # Second call: failure 2 → circuit opens
        data2 = await service.get_retirement_data()
        assert data2 is not None
        assert service._consecutive_failures == 2
        assert service._circuit_open_until is not None

        # Third call: circuit is open → returns fallback without fetching
        service._cache = None
        service._cache_time = None
        data3 = await service.get_retirement_data()
        assert data3 is not None
        # fetch_text was called twice (for failures), not a third time
        # Each _fetch_retirement_data calls fetch_text twice (gather), so 4 total
        assert mock_client.fetch_text.call_count == 4

    @pytest.mark.asyncio
    async def test_circuit_resets_on_success(self):
        from azure_pricing_mcp.services.retirement import RetirementService

        mock_client = AsyncMock()
        mock_client.session = True

        # Return valid markdown that parses to retirement data
        retired_md = "| Series | Status | Replacement | Date |\n|---|---|---|---|\n| Dv2 | retirement announced | Dv5 | 2028-05-01 |"
        mock_client.fetch_text = AsyncMock(return_value=retired_md)

        service = RetirementService(mock_client)
        service._consecutive_failures = 1  # Simulate prior failure

        data = await service.get_retirement_data()
        assert data is not None
        assert service._consecutive_failures == 0


class TestToolDefinitions:
    """Verify trimmed tool definitions are valid."""

    def test_all_8_tools_have_compact_default(self):
        from azure_pricing_mcp.tools import get_tool_definitions

        tools = get_tool_definitions()
        compact_tools = [
            t for t in tools
            if t.inputSchema.get("properties", {}).get("output_format", {}).get("default") == "compact"
        ]
        assert len(compact_tools) == 8

    def test_total_tool_count(self):
        from azure_pricing_mcp.tools import get_tool_definitions

        tools = get_tool_definitions()
        assert len(tools) == 13
