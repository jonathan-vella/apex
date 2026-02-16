"""Tests for BulkEstimateService."""

import pytest
from conftest import SAMPLE_API_RESPONSE, FakeClient

from azure_pricing_mcp.services.bulk import BulkEstimateService, _dedup_key, _resolve_service_alias
from azure_pricing_mcp.services.pricing import PricingService
from azure_pricing_mcp.services.retirement import RetirementService


@pytest.fixture()
def bulk_service():
    client = FakeClient()
    retirement = RetirementService(client)
    pricing = PricingService(client, retirement)
    return BulkEstimateService(pricing)


# ── Existing tests (updated for new response shape) ──


@pytest.mark.asyncio
async def test_bulk_success(bulk_service):
    resources = [
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"},
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "westus"},
    ]
    result = await bulk_service.bulk_estimate(resources)
    assert result["successful"] == 2
    assert result["failed"] == 0
    assert len(result["line_items"]) == 2
    assert result["totals"]["monthly"] > 0


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


# ── Service-name alias resolution ──


def test_resolve_known_alias():
    assert _resolve_service_alias("vm") == "Virtual Machines"
    assert _resolve_service_alias("aks") == "Azure Kubernetes Service"
    assert _resolve_service_alias("App Service") == "Azure App Service"


def test_resolve_unknown_passthrough():
    assert _resolve_service_alias("Custom Thing") == "Custom Thing"


@pytest.mark.asyncio
async def test_bulk_resolves_alias(bulk_service):
    """User passes 'vm' → service resolves to 'Virtual Machines'."""
    resources = [{"service_name": "vm", "sku_name": "D2s v3", "region": "eastus"}]
    result = await bulk_service.bulk_estimate(resources)
    assert result["successful"] == 1
    item = result["line_items"][0]
    assert item["service_name"] == "Virtual Machines"


# ── Deduplication ──


def test_dedup_key_case_insensitive():
    a = {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "EastUS"}
    b = {"service_name": "virtual machines", "sku_name": "d2s v3", "region": "eastus"}
    assert _dedup_key(a) == _dedup_key(b)


@pytest.mark.asyncio
async def test_bulk_dedup_sums_quantities(bulk_service):
    """3 identical specs (qty 1, 2, 1) → 1 deduped call with qty 4."""
    resources = [
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus", "quantity": 1},
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus", "quantity": 2},
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus", "quantity": 1},
    ]
    result = await bulk_service.bulk_estimate(resources)
    assert result["resource_count"] == 3
    assert result["unique_specs"] == 1
    assert result["successful"] == 1
    assert result["line_items"][0]["quantity"] == 4


# ── Concurrency smoke test ──


@pytest.mark.asyncio
async def test_bulk_concurrent_multiple_distinct(bulk_service):
    """Multiple distinct resources are dispatched without error."""
    resources = [
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"},
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "westus2"},
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "westeurope"},
    ]
    result = await bulk_service.bulk_estimate(resources)
    assert result["successful"] == 3
    assert result["failed"] == 0


# ── Error code in bulk errors ──


@pytest.mark.asyncio
async def test_bulk_errors_have_code(bulk_service):
    resources = [{"service_name": "", "sku_name": "", "region": ""}]
    result = await bulk_service.bulk_estimate(resources)
    assert result["failed"] == 1
    assert result["errors"][0]["code"] == "MISSING_REQUIRED_FIELD"


# ── Per-item retry tests ──


class FailThenSucceedClient(FakeClient):
    """Fails with an exception on the first call, succeeds on the second."""

    def __init__(self):
        super().__init__()
        self._attempt = 0

    async def fetch_prices(self, filter_conditions=None, currency_code="USD", limit=None):
        self._attempt += 1
        if self._attempt == 1:
            raise ConnectionError("transient failure")
        return SAMPLE_API_RESPONSE


class AlwaysFailClient(FakeClient):
    """Always raises an exception."""

    async def fetch_prices(self, filter_conditions=None, currency_code="USD", limit=None):
        raise ConnectionError("persistent failure")


@pytest.mark.asyncio
async def test_retry_success_on_second_attempt():
    """Item that fails once then succeeds should appear in line_items."""
    client = FailThenSucceedClient()
    from azure_pricing_mcp.services.bulk import BulkEstimateService

    retirement = RetirementService(client)
    pricing = PricingService(client, retirement)
    svc = BulkEstimateService(pricing)
    resources = [{"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"}]
    result = await svc.bulk_estimate(resources)
    assert result["successful"] == 1
    assert result["failed"] == 0


@pytest.mark.asyncio
async def test_retry_exhaustion():
    """Item that always fails should end up in errors after max retries."""
    client = AlwaysFailClient()
    retirement = RetirementService(client)
    pricing = PricingService(client, retirement)
    svc = BulkEstimateService(pricing)
    resources = [{"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"}]
    result = await svc.bulk_estimate(resources)
    assert result["successful"] == 0
    assert result["failed"] == 1
    assert "persistent failure" in result["errors"][0]["error"]


@pytest.mark.asyncio
async def test_retry_mixed_success_and_failure():
    """One item succeeds, another always fails."""
    # Use a normal client for the successful item
    client = FakeClient()
    retirement = RetirementService(client)
    pricing = PricingService(client, retirement)
    svc = BulkEstimateService(pricing)

    resources = [
        {"service_name": "Virtual Machines", "sku_name": "D2s v3", "region": "eastus"},
        {"service_name": "", "sku_name": "", "region": ""},  # will fail validation
    ]
    result = await svc.bulk_estimate(resources)
    assert result["successful"] == 1
    assert result["failed"] == 1
