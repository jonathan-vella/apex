"""Tests for ToolHandlers — validation, error boundaries, and basic dispatch."""

import json

import pytest
from conftest import FakeClient

from azure_pricing_mcp.handlers import ToolHandlers
from azure_pricing_mcp.services.bulk import BulkEstimateService
from azure_pricing_mcp.services.pricing import PricingService
from azure_pricing_mcp.services.retirement import RetirementService


@pytest.fixture()
def handlers():
    client = FakeClient()
    retirement = RetirementService(client)
    pricing = PricingService(client, retirement)
    bulk = BulkEstimateService(pricing)
    return ToolHandlers(pricing, None, bulk_service=bulk)


@pytest.fixture()
def handlers_with_sku(handlers):
    """Handlers with a real SKU service."""
    from azure_pricing_mcp.services.sku import SKUService

    client = FakeClient()
    retirement = RetirementService(client)
    pricing = PricingService(client, retirement)
    bulk = BulkEstimateService(pricing)
    sku = SKUService(pricing)
    return ToolHandlers(pricing, sku, bulk_service=bulk)


class TestSafeHandleValidation:
    """Verify that _safe_handle rejects invalid inputs before calling service."""

    @pytest.mark.asyncio
    async def test_missing_required_fields_returns_error(self, handlers):
        result = await handlers.handle_cost_estimate({"service_name": "VM"})
        assert len(result) == 1
        body = json.loads(result[0].text)
        assert body["error"] is True
        assert body["code"] == "MISSING_REQUIRED_FIELD"

    @pytest.mark.asyncio
    async def test_empty_service_name_returns_error(self, handlers):
        result = await handlers.handle_cost_estimate(
            {"service_name": "", "sku_name": "D2s_v3", "region": "eastus"}
        )
        body = json.loads(result[0].text)
        assert body["code"] == "INVALID_FIELD_VALUE"

    @pytest.mark.asyncio
    async def test_negative_limit_returns_error(self, handlers):
        result = await handlers.handle_price_search({"limit": -1})
        body = json.loads(result[0].text)
        assert body["code"] == "INVALID_FIELD_VALUE"

    @pytest.mark.asyncio
    async def test_empty_bulk_list_returns_error(self, handlers):
        result = await handlers.handle_bulk_estimate({"resources": []})
        body = json.loads(result[0].text)
        assert body["code"] == "EMPTY_RESOURCE_LIST"


class TestSafeHandleErrorBoundary:
    """Verify that _safe_handle catches unexpected exceptions."""

    @pytest.mark.asyncio
    async def test_internal_error_caught(self, handlers):
        """If the service raises, the handler returns INTERNAL_ERROR JSON."""

        async def boom(_args):
            raise RuntimeError("kaboom")

        result = await handlers._safe_handle("azure_price_search", {}, boom)
        body = json.loads(result[0].text)
        assert body["error"] is True
        assert body["code"] == "INTERNAL_ERROR"
        assert "kaboom" not in body["message"]  # Don't leak internals


class TestHandlerDispatch:
    """Verify that valid calls actually reach the service layer."""

    @pytest.mark.asyncio
    async def test_price_search_success(self, handlers):
        result = await handlers.handle_price_search({"service_name": "Virtual Machines"})
        assert len(result) == 1
        assert "Virtual Machines" in result[0].text or "D2s v3" in result[0].text

    @pytest.mark.asyncio
    async def test_cost_estimate_success(self, handlers):
        result = await handlers.handle_cost_estimate(
            {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"}
        )
        assert len(result) == 1
        assert "error" not in result[0].text.lower() or "MISSING" not in result[0].text

    @pytest.mark.asyncio
    async def test_bulk_estimate_success(self, handlers):
        resources = [{"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"}]
        result = await handlers.handle_bulk_estimate({"resources": resources})
        assert len(result) == 1
        assert "MISSING_REQUIRED_FIELD" not in result[0].text

    @pytest.mark.asyncio
    async def test_bulk_not_initialized(self):
        """BulkEstimateService is None → SERVICE_NOT_INITIALIZED."""
        client = FakeClient()
        retirement = RetirementService(client)
        pricing = PricingService(client, retirement)
        h = ToolHandlers(pricing, None, bulk_service=None)
        resources = [{"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"}]
        result = await h.handle_bulk_estimate({"resources": resources})
        body = json.loads(result[0].text)
        assert body["code"] == "SERVICE_NOT_INITIALIZED"

    @pytest.mark.asyncio
    async def test_customer_discount_success(self, handlers):
        result = await handlers.handle_customer_discount({})
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_discover_skus_success(self, handlers_with_sku):
        result = await handlers_with_sku.handle_discover_skus({"service_name": "Virtual Machines"})
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_compact_output_format(self, handlers):
        result = await handlers.handle_price_search(
            {"service_name": "Virtual Machines", "output_format": "compact"}
        )
        assert len(result) == 1
        body = json.loads(result[0].text)
        assert isinstance(body, dict)
