#!/usr/bin/env python3
"""Test the MCP server by simulating stdin/stdout communication."""

from unittest.mock import AsyncMock

import pytest

from azure_pricing_mcp.client import AzurePricingClient
from azure_pricing_mcp.config import DEFAULT_CUSTOMER_DISCOUNT
from azure_pricing_mcp.formatters import (
    DISCOUNT_TIP_DEFAULT_USED,
    DISCOUNT_TIP_NO_DISCOUNT,
    _get_discount_tip,
)
from azure_pricing_mcp.handlers import ToolHandlers
from azure_pricing_mcp.server import AzurePricingServer, create_server
from azure_pricing_mcp.services import PricingService, SKUService
from azure_pricing_mcp.services.retirement import RetirementService


@pytest.fixture
async def services():
    """Create all services for testing."""
    async with AzurePricingClient() as client:
        retirement_service = RetirementService(client)
        pricing_service = PricingService(client, retirement_service)
        sku_service = SKUService(pricing_service)
        tool_handlers = ToolHandlers(pricing_service, sku_service)
        yield {
            "pricing": pricing_service,
            "sku": sku_service,
            "handlers": tool_handlers,
        }


@pytest.mark.integration
@pytest.mark.asyncio
async def test_mcp_server(services):
    """Test the MCP server tool handlers."""
    # Simulate tool call through the handler
    result = await services["handlers"].handle_price_search(
        {
            "service_name": "Virtual Machines",
            "sku_name": "Standard_F16",
            "price_type": "Consumption",
            "limit": 10,
        },
    )

    print("Tool call result:")
    for item in result:
        print(f"Type: {type(item)}")
        if hasattr(item, "text"):
            print(f"Text length: {len(item.text)}")
            print(f"Text preview: {item.text[:200]}...")

    assert len(result) > 0
    assert hasattr(result[0], "text")


@pytest.mark.asyncio
async def test_server_creation():
    """Test that server can be created with tuple return (default)."""
    server, pricing_server = create_server()
    assert server is not None
    assert server.name == "azure-pricing"
    assert pricing_server is not None
    assert isinstance(pricing_server, AzurePricingServer)


@pytest.mark.asyncio
async def test_server_creation_without_pricing_server():
    """Test that server can be created with only Server return."""
    server = create_server(return_pricing_server=False)
    assert server is not None
    assert server.name == "azure-pricing"
    # Should not be a tuple
    assert not isinstance(server, tuple)


@pytest.mark.asyncio
async def test_pricing_server_lifecycle():
    """Test AzurePricingServer lifecycle methods."""
    pricing_server = AzurePricingServer()

    # Initially not active
    assert not pricing_server.is_active

    # Initialize
    await pricing_server.initialize()
    assert pricing_server.is_active

    # Shutdown
    await pricing_server.shutdown()
    assert not pricing_server.is_active


@pytest.mark.asyncio
async def test_pricing_server_context_manager():
    """Test AzurePricingServer as async context manager."""
    pricing_server = AzurePricingServer()

    assert not pricing_server.is_active

    async with pricing_server:
        assert pricing_server.is_active

    assert not pricing_server.is_active


@pytest.mark.integration
@pytest.mark.asyncio
async def test_all_tool_handlers(services):
    """Test all tool handlers work."""
    # Test price search
    result = await services["handlers"].handle_price_search({"service_name": "Virtual Machines", "limit": 5})
    assert len(result) > 0

    # Test price compare
    result = await services["handlers"].handle_price_compare(
        {"service_name": "Virtual Machines", "regions": ["eastus", "westus"]}
    )
    assert len(result) > 0

    # Test cost estimate
    search = await services["pricing"].search_prices(service_name="Virtual Machines", region="eastus", limit=1)
    if search["items"]:
        sku = search["items"][0]["skuName"]
        result = await services["handlers"].handle_cost_estimate(
            {"service_name": "Virtual Machines", "sku_name": sku, "region": "eastus"}
        )
        assert len(result) > 0

    # Test discover SKUs
    result = await services["handlers"].handle_discover_skus({"service_name": "Virtual Machines", "limit": 10})
    assert len(result) > 0

    # Test SKU discovery
    result = await services["handlers"].handle_sku_discovery({"service_hint": "vm"})
    assert len(result) > 0

    # Test customer discount
    result = await services["handlers"].handle_customer_discount({})
    assert len(result) > 0


class TestResolveDiscount:
    """Tests for the _resolve_discount helper method."""

    @pytest.fixture
    def tool_handlers(self):
        """Create a ToolHandlers instance with mock services."""
        mock_pricing = AsyncMock(spec=PricingService)
        mock_sku = AsyncMock(spec=SKUService)
        return ToolHandlers(mock_pricing, mock_sku)

    def test_show_with_discount_true_no_discount_percentage(self, tool_handlers):
        """Test that show_with_discount=True without discount_percentage uses default discount."""
        arguments = {"show_with_discount": True, "service_name": "Virtual Machines"}

        discount_pct, discount_specified, used_default = tool_handlers._resolve_discount(arguments)

        assert discount_pct == DEFAULT_CUSTOMER_DISCOUNT
        assert discount_specified is False
        assert used_default is True
        # Verify arguments dict was modified correctly
        assert arguments["discount_percentage"] == DEFAULT_CUSTOMER_DISCOUNT
        assert "show_with_discount" not in arguments  # Should be popped

    def test_neither_discount_arg_provided(self, tool_handlers):
        """Test that no discount args results in 0% discount with no flags set."""
        arguments = {"service_name": "Virtual Machines"}

        discount_pct, discount_specified, used_default = tool_handlers._resolve_discount(arguments)

        assert discount_pct == 0.0
        assert discount_specified is False
        assert used_default is False
        # Verify arguments dict was modified correctly
        assert arguments["discount_percentage"] == 0.0

    def test_explicit_discount_percentage(self, tool_handlers):
        """Test that explicit discount_percentage is used and flags are set correctly."""
        arguments = {"discount_percentage": 15.0, "service_name": "Virtual Machines"}

        discount_pct, discount_specified, used_default = tool_handlers._resolve_discount(arguments)

        assert discount_pct == 15.0
        assert discount_specified is True
        assert used_default is False
        assert arguments["discount_percentage"] == 15.0

    def test_explicit_discount_percentage_zero(self, tool_handlers):
        """Test that explicit discount_percentage=0 is treated as user-specified (no discount intended)."""
        arguments = {"discount_percentage": 0.0, "service_name": "Virtual Machines"}

        discount_pct, discount_specified, used_default = tool_handlers._resolve_discount(arguments)

        assert discount_pct == 0.0
        assert discount_specified is True  # User explicitly specified 0
        assert used_default is False
        assert arguments["discount_percentage"] == 0.0

    def test_both_show_with_discount_and_discount_percentage(self, tool_handlers):
        """Test that explicit discount_percentage takes precedence over show_with_discount."""
        arguments = {
            "show_with_discount": True,
            "discount_percentage": 20.0,
            "service_name": "Virtual Machines",
        }

        discount_pct, discount_specified, used_default = tool_handlers._resolve_discount(arguments)

        assert discount_pct == 20.0
        assert discount_specified is True
        assert used_default is False
        assert arguments["discount_percentage"] == 20.0
        assert "show_with_discount" not in arguments  # Should be popped

    def test_show_with_discount_false_explicit(self, tool_handlers):
        """Test that show_with_discount=False explicit behaves same as omitted."""
        arguments = {"show_with_discount": False, "service_name": "Virtual Machines"}

        discount_pct, discount_specified, used_default = tool_handlers._resolve_discount(arguments)

        assert discount_pct == 0.0
        assert discount_specified is False
        assert used_default is False
        assert arguments["discount_percentage"] == 0.0
        assert "show_with_discount" not in arguments


class TestDiscountMetadataPropagation:
    """Tests for _discount_metadata propagation and formatting."""

    def test_get_discount_tip_default_used(self):
        """Test that _get_discount_tip returns correct tip when default discount was used."""
        result = {
            "_discount_metadata": {
                "discount_specified": False,
                "used_default_discount": True,
                "discount_percentage": DEFAULT_CUSTOMER_DISCOUNT,
            }
        }

        tip = _get_discount_tip(result)

        assert tip == DISCOUNT_TIP_DEFAULT_USED
        assert "10% discount applied" in tip
        assert "default" in tip.lower()

    def test_get_discount_tip_no_discount(self):
        """Test that _get_discount_tip returns correct tip when no discount was applied."""
        result = {
            "_discount_metadata": {
                "discount_specified": False,
                "used_default_discount": False,
                "discount_percentage": 0.0,
            }
        }

        tip = _get_discount_tip(result)

        assert tip == DISCOUNT_TIP_NO_DISCOUNT
        assert "Want to see potential savings?" in tip

    def test_get_discount_tip_explicit_discount(self):
        """Test that _get_discount_tip returns empty string when user specified discount."""
        result = {
            "_discount_metadata": {
                "discount_specified": True,
                "used_default_discount": False,
                "discount_percentage": 15.0,
            }
        }

        tip = _get_discount_tip(result)

        assert tip == ""

    def test_get_discount_tip_explicit_zero_discount(self):
        """Test that _get_discount_tip returns empty string when user explicitly set 0% discount."""
        result = {
            "_discount_metadata": {
                "discount_specified": True,
                "used_default_discount": False,
                "discount_percentage": 0.0,
            }
        }

        tip = _get_discount_tip(result)

        # User explicitly chose 0%, so no tip needed
        assert tip == ""

    def test_get_discount_tip_missing_metadata(self):
        """Test that _get_discount_tip handles missing metadata - treats as no discount scenario."""
        result = {}

        tip = _get_discount_tip(result)

        # With no metadata, the condition for no discount tip is met (not specified + 0%)
        assert tip == DISCOUNT_TIP_NO_DISCOUNT


class TestHandlerDiscountIntegration:
    """Integration tests for discount handling in tool handlers."""

    @pytest.fixture
    def tool_handlers(self):
        """Create a ToolHandlers instance with mock services."""
        mock_pricing = AsyncMock(spec=PricingService)
        mock_sku = AsyncMock(spec=SKUService)
        return ToolHandlers(mock_pricing, mock_sku)

    @pytest.mark.asyncio
    async def test_handle_price_search_with_show_with_discount(self, tool_handlers):
        """Test handle_price_search with show_with_discount=True applies default discount."""
        # Mock the service response
        tool_handlers._pricing_service.search_prices.return_value = {
            "items": [],
            "count": 0,
            "has_more": False,
            "currency": "USD",
            "filters_applied": [],
        }

        await tool_handlers.handle_price_search(
            {
                "service_name": "Virtual Machines",
                "show_with_discount": True,
            }
        )

        # Verify the service was called with the default discount
        call_kwargs = tool_handlers._pricing_service.search_prices.call_args.kwargs
        assert call_kwargs["discount_percentage"] == DEFAULT_CUSTOMER_DISCOUNT

    @pytest.mark.asyncio
    async def test_handle_price_search_no_discount_args(self, tool_handlers):
        """Test handle_price_search without discount args uses 0% discount."""
        # Mock the service response with at least one item to trigger tip display
        tool_handlers._pricing_service.search_prices.return_value = {
            "items": [
                {
                    "serviceName": "Virtual Machines",
                    "productName": "Test Product",
                    "skuName": "Standard_D2s_v3",
                    "armRegionName": "eastus",
                    "location": "East US",
                    "retailPrice": 0.096,
                    "unitOfMeasure": "1 Hour",
                    "type": "Consumption",
                }
            ],
            "count": 1,
            "has_more": False,
            "currency": "USD",
            "filters_applied": [],
        }

        result = await tool_handlers.handle_price_search(
            {
                "service_name": "Virtual Machines",
            }
        )

        # Verify the service was called with 0% discount
        call_kwargs = tool_handlers._pricing_service.search_prices.call_args.kwargs
        assert call_kwargs["discount_percentage"] == 0.0

        # Verify the response includes the no-discount tip
        assert len(result) == 1
        assert DISCOUNT_TIP_NO_DISCOUNT in result[0].text

    @pytest.mark.asyncio
    async def test_handle_price_search_discount_metadata_in_result(self, tool_handlers):
        """Test that _discount_metadata is correctly attached to service result."""
        # Mock the service response
        mock_result = {
            "items": [
                {
                    "serviceName": "Virtual Machines",
                    "productName": "Test Product",
                    "skuName": "Standard_D2s_v3",
                    "armRegionName": "eastus",
                    "location": "East US",
                    "retailPrice": 0.096,
                    "unitOfMeasure": "1 Hour",
                    "type": "Consumption",
                }
            ],
            "count": 1,
            "has_more": False,
            "currency": "USD",
            "filters_applied": [],
        }
        tool_handlers._pricing_service.search_prices.return_value = mock_result

        result = await tool_handlers.handle_price_search(
            {
                "service_name": "Virtual Machines",
                "show_with_discount": True,
            }
        )

        # The formatted response should contain the default discount tip
        assert len(result) == 1
        assert DISCOUNT_TIP_DEFAULT_USED in result[0].text

    @pytest.mark.asyncio
    async def test_handle_price_compare_with_show_with_discount(self, tool_handlers):
        """Test handle_price_compare with show_with_discount=True applies default discount."""
        tool_handlers._pricing_service.compare_prices.return_value = {
            "service_name": "Virtual Machines",
            "comparison_type": "region",
            "comparisons": [],
            "currency": "USD",
        }

        await tool_handlers.handle_price_compare(
            {
                "service_name": "Virtual Machines",
                "regions": ["eastus", "westus"],
                "show_with_discount": True,
            }
        )

        call_kwargs = tool_handlers._pricing_service.compare_prices.call_args.kwargs
        assert call_kwargs["discount_percentage"] == DEFAULT_CUSTOMER_DISCOUNT

    @pytest.mark.asyncio
    async def test_handle_cost_estimate_with_show_with_discount(self, tool_handlers):
        """Test handle_cost_estimate with show_with_discount=True applies default discount."""
        tool_handlers._pricing_service.estimate_costs.return_value = {
            "service_name": "Virtual Machines",
            "sku_name": "Standard_D2s_v3",
            "region": "eastus",
            "product_name": "Virtual Machines D Series",
            "unit_of_measure": "1 Hour",
            "currency": "USD",
            "usage_assumptions": {
                "hours_per_month": 730,
                "hours_per_day": 24,
            },
            "on_demand_pricing": {
                "hourly_rate": 0.096,
                "daily_cost": 2.304,
                "monthly_cost": 70.08,
                "yearly_cost": 840.96,
            },
            "savings_plans": [],
        }

        await tool_handlers.handle_cost_estimate(
            {
                "service_name": "Virtual Machines",
                "sku_name": "Standard_D2s_v3",
                "region": "eastus",
                "show_with_discount": True,
            }
        )

        call_kwargs = tool_handlers._pricing_service.estimate_costs.call_args.kwargs
        assert call_kwargs["discount_percentage"] == DEFAULT_CUSTOMER_DISCOUNT

    @pytest.mark.asyncio
    async def test_handle_region_recommend_with_show_with_discount(self, tool_handlers):
        """Test handle_region_recommend with show_with_discount=True applies default discount."""
        tool_handlers._pricing_service.recommend_regions.return_value = {
            "recommendations": [],
            "currency": "USD",
        }

        await tool_handlers.handle_region_recommend(
            {
                "service_name": "Virtual Machines",
                "sku_name": "Standard_D2s_v3",
                "show_with_discount": True,
            }
        )

        call_kwargs = tool_handlers._pricing_service.recommend_regions.call_args.kwargs
        assert call_kwargs["discount_percentage"] == DEFAULT_CUSTOMER_DISCOUNT
