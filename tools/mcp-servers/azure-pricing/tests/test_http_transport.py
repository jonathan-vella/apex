#!/usr/bin/env python3
"""
Tests for HTTP transport (SSE) of the MCP server.
These tests verify the HTTP/SSE transport works correctly for Docker/remote deployments.
"""

import pytest
from mcp.server.sse import SseServerTransport
from starlette.responses import Response
from starlette.routing import Mount, Route

from azure_pricing_mcp.client import AzurePricingClient
from azure_pricing_mcp.server import create_server
from azure_pricing_mcp.services import PricingService, SKUService
from azure_pricing_mcp.services.retirement import RetirementService


@pytest.fixture
async def services():
    """Create all services for testing."""
    async with AzurePricingClient() as client:
        retirement_service = RetirementService(client)
        pricing_service = PricingService(client, retirement_service)
        sku_service = SKUService(pricing_service)
        yield {
            "pricing": pricing_service,
            "sku": sku_service,
            "retirement": retirement_service,
        }


class TestHTTPTransportConfiguration:
    """Test HTTP/SSE transport configuration and setup."""

    def test_sse_transport_initialization(self):
        """Test that SSE transport can be initialized."""
        sse = SseServerTransport("/messages/")
        assert sse is not None
        assert sse._endpoint == "/messages/"

    def test_http_app_routes(self):
        """Test HTTP app routes can be configured."""
        sse = SseServerTransport("/messages/")

        # Just test that we can create routes without actually running them
        routes = [
            Route("/sse", endpoint=lambda r: Response()),
            Mount("/messages/", app=sse.handle_post_message),
        ]

        assert len(routes) == 2
        assert routes[0].path == "/sse"

    def test_server_creation(self):
        """Test MCP server can be created."""
        server, pricing_server = create_server()
        assert server is not None
        assert server.name == "azure-pricing"
        assert pricing_server is not None


class TestHTTPTransportTools:
    """Test HTTP/SSE transport exposes correct tools."""

    @pytest.mark.asyncio
    async def test_server_tools_listing(self):
        """Test that server exposes expected tools."""
        from mcp.types import ListToolsRequest

        server, _ = create_server()

        # Get tools list using the ListToolsRequest class as key
        handler = server.request_handlers.get(ListToolsRequest)
        assert handler is not None, "ListToolsRequest handler not found"

        # Create a request object
        request = ListToolsRequest()
        result = await handler(request)

        # Handler returns ServerResult wrapping ListToolsResult
        tools_list = result.root.tools if hasattr(result, "root") else result.tools

        # Verify expected tools are present
        tool_names = [tool.name for tool in tools_list]

        expected_tools = [
            "azure_price_search",
            "azure_price_compare",
            "azure_cost_estimate",
            "azure_discover_skus",
            "azure_sku_discovery",
            "get_customer_discount",
        ]

        for expected_tool in expected_tools:
            assert expected_tool in tool_names, f"Missing tool: {expected_tool}"

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_price_search_tool_via_handler(self, services):
        """Test azure_price_search tool through handler."""
        result = await services["pricing"].search_prices(service_name="Virtual Machines", region="eastus", limit=5)

        assert "items" in result
        assert "count" in result
        assert isinstance(result["items"], list)
        assert result["count"] >= 0

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_cost_estimate_tool_via_handler(self, services):
        """Test azure_cost_estimate tool through handler."""
        # First find a valid SKU
        search_result = await services["pricing"].search_prices(
            service_name="Virtual Machines", region="eastus", limit=1
        )

        if search_result["items"]:
            item = search_result["items"][0]
            sku_name = item.get("skuName")

            # Now estimate costs
            result = await services["pricing"].estimate_costs(
                service_name="Virtual Machines",
                sku_name=sku_name,
                region="eastus",
                hours_per_month=730,
            )

            assert "on_demand_pricing" in result
            assert "monthly_cost" in result["on_demand_pricing"]
            assert "hourly_rate" in result["on_demand_pricing"]

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_price_compare_tool_via_handler(self, services):
        """Test azure_price_compare tool through handler."""
        result = await services["pricing"].compare_prices(
            service_name="Virtual Machines",
            regions=["eastus", "westus"],
            currency_code="USD",
        )

        assert "comparisons" in result
        assert "comparison_type" in result
        assert result["comparison_type"] == "regions"
        assert isinstance(result["comparisons"], list)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_discover_skus_tool_via_handler(self, services):
        """Test azure_discover_skus tool through handler."""
        result = await services["sku"].discover_skus(service_name="Virtual Machines", region="eastus", limit=10)

        assert "skus" in result
        assert "total_skus" in result
        assert isinstance(result["skus"], list)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_sku_discovery_with_fuzzy_matching(self, services):
        """Test azure_sku_discovery tool with fuzzy service name matching."""
        # Test with user-friendly name
        result = await services["sku"].discover_service_skus(
            service_hint="vm", limit=5  # Should match "Virtual Machines"
        )

        # Should either find SKUs or provide suggestions
        assert "service_found" in result or "suggestions" in result
        assert "original_search" in result
        assert result["original_search"] == "vm"

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_customer_discount_tool_via_handler(self, services):
        """Test get_customer_discount tool through handler."""
        result = await services["pricing"].get_customer_discount()

        assert "discount_percentage" in result
        assert "customer_id" in result
        assert result["discount_percentage"] == 10.0  # Default discount

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_discount_application_in_search(self, services):
        """Test that discount is properly applied in price search."""
        # Search without discount
        result_no_discount = await services["pricing"].search_prices(
            service_name="Virtual Machines", region="eastus", limit=1
        )

        # Search with discount
        result_with_discount = await services["pricing"].search_prices(
            service_name="Virtual Machines",
            region="eastus",
            limit=1,
            discount_percentage=10.0,
        )

        if result_no_discount["items"] and result_with_discount["items"]:
            original_price = result_no_discount["items"][0]["retailPrice"]
            discounted_price = result_with_discount["items"][0]["retailPrice"]

            # Verify discount was applied (10% off)
            expected_discounted_price = original_price * 0.9
            assert abs(discounted_price - expected_discounted_price) < 0.001

            # Verify discount metadata is present
            assert "discount_applied" in result_with_discount
            assert result_with_discount["discount_applied"]["percentage"] == 10.0


class TestHTTPServerConfiguration:
    """Test HTTP server configuration and startup."""

    def test_server_configuration_defaults(self):
        """Test default HTTP server configuration."""
        server, _ = create_server()
        assert server is not None
        assert server.name == "azure-pricing"

    @pytest.mark.asyncio
    async def test_server_context_manager(self):
        """Test client can be used as async context manager."""
        async with AzurePricingClient() as client:
            assert client.session is not None


class TestHTTPErrorHandling:
    """Test error handling in HTTP transport."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_invalid_service_name_handling(self, services):
        """Test handling of invalid service names."""
        result = await services["pricing"].search_prices(
            service_name="NonExistentService12345",
            limit=5,
            validate_sku=False,  # Disable validation to test raw behavior
        )

        # Should return empty results, not error
        assert result["count"] == 0
        assert result["items"] == []

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_sku_validation_with_suggestions(self, services):
        """Test SKU validation provides suggestions."""
        result = await services["pricing"].search_prices(
            service_name="Virtual Machines",
            sku_name="NonExistentSKU12345",
            limit=5,
            validate_sku=True,
        )

        # Should have validation info with suggestions
        if "sku_validation" in result:
            assert "suggestions" in result["sku_validation"]
            assert "original_sku" in result["sku_validation"]
            assert result["sku_validation"]["original_sku"] == "NonExistentSKU12345"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
