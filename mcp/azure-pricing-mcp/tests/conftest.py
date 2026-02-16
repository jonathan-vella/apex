"""Shared pytest fixtures for Azure Pricing MCP tests."""

import pytest

from azure_pricing_mcp.cache import PricingCache

# Sample API response used across tests
SAMPLE_API_RESPONSE = {
    "Items": [
        {
            "retailPrice": 0.096,
            "unitOfMeasure": "1 Hour",
            "armRegionName": "eastus",
            "location": "US East",
            "serviceName": "Virtual Machines",
            "productName": "Virtual Machines D Series",
            "skuName": "D2s v3",
            "type": "Consumption",
            "savingsPlan": [
                {"term": "1 Year", "retailPrice": 0.062},
                {"term": "3 Years", "retailPrice": 0.040},
            ],
        }
    ],
    "Count": 1,
    "NextPageLink": None,
}

SAMPLE_STORAGE_RESPONSE = {
    "Items": [
        {
            "retailPrice": 0.018,
            "unitOfMeasure": "1 GB/Month",
            "armRegionName": "eastus",
            "location": "US East",
            "serviceName": "Storage",
            "productName": "Blob Storage",
            "skuName": "Hot LRS",
            "type": "Consumption",
            "savingsPlan": [],
        }
    ],
    "Count": 1,
    "NextPageLink": None,
}


@pytest.fixture()
def pricing_cache():
    """Fresh cache instance for each test."""
    return PricingCache(maxsize=64, ttl=60)


class FakeClient:
    """Minimal fake for AzurePricingClient."""

    def __init__(self, responses=None):
        self.responses = responses or [SAMPLE_API_RESPONSE]
        self._call_index = 0
        self.session = True  # Satisfy session check in services

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def fetch_prices(self, filter_conditions=None, currency_code="USD", limit=None):
        resp = self.responses[self._call_index % len(self.responses)]
        self._call_index += 1
        return resp

    async def fetch_all_prices(self, filter_conditions=None, currency_code="USD", max_pages=10):
        return await self.fetch_prices(filter_conditions, currency_code)

    async def fetch_text(self, url, timeout=10.0):
        return ""

    async def make_request(self, url=None, params=None, max_retries=3):
        return await self.fetch_prices()
