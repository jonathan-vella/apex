"""Tests for BulkEstimateService."""

import pytest

from azure_pricing_mcp.services.bulk import BulkEstimateService
from azure_pricing_mcp.services.pricing import PricingService
from azure_pricing_mcp.services.retirement import RetirementService

from conftest import FakeClient, SAMPLE_API_RESPONSE


@pytest.fixture()
def bulk_service():
    client = FakeClient()
    retirement = RetirementService(client)
    pricing = PricingService(client, retirement)
    return BulkEstimateService(pricing)


@pytest.mark.asyncio
async def test_bulk_success(bulk_service):
    resources = [
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"},
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus", "quantity": 2},
    ]
    result = await bulk_service.bulk_estimate(resources)
    assert result["successful"] == 2
    assert result["failed"] == 0
    assert len(result["line_items"]) == 2
    assert result["totals"]["monthly"] > 0
    assert result["line_items"][1]["quantity"] == 2


@pytest.mark.asyncio
async def test_bulk_missing_fields(bulk_service):
    resources = [
        {"service_name": "Virtual Machines"},  # missing sku_name & region
    ]
    result = await bulk_service.bulk_estimate(resources)
    assert result["successful"] == 0
    assert result["failed"] == 1
    assert "Missing required field" in result["errors"][0]["error"]


@pytest.mark.asyncio
async def test_bulk_empty_list(bulk_service):
    result = await bulk_service.bulk_estimate([])
    assert result["successful"] == 0
    assert result["failed"] == 0
    assert result["totals"]["monthly"] == 0
