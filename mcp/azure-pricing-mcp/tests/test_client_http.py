"""HTTP-level tests for AzurePricingClient using aioresponses.

Tests Retry-After header parsing, per-request timeout, and connection pooling.
"""

from unittest.mock import AsyncMock, patch

import aiohttp
import pytest
from aioresponses import aioresponses

from azure_pricing_mcp.client import AzurePricingClient
from azure_pricing_mcp.config import AZURE_PRICING_BASE_URL


@pytest.fixture
def mock_aio():
    with aioresponses() as m:
        yield m


class TestRetryAfterHeader:
    @pytest.mark.asyncio
    async def test_respects_retry_after_header(self, mock_aio):
        """When the API returns 429 with Retry-After, use that value."""
        mock_aio.get(
            AZURE_PRICING_BASE_URL,
            status=429,
            headers={"Retry-After": "1"},
        )
        mock_aio.get(
            AZURE_PRICING_BASE_URL,
            status=200,
            payload={"Items": [], "Count": 0},
        )

        with patch("azure_pricing_mcp.client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            async with AzurePricingClient() as client:
                result = await client.make_request(max_retries=1)
                assert result["Count"] == 0
                mock_sleep.assert_awaited_once_with(1)

    @pytest.mark.asyncio
    async def test_falls_back_without_retry_after(self, mock_aio):
        """Without Retry-After header, fall back to exponential backoff."""
        mock_aio.get(AZURE_PRICING_BASE_URL, status=429)
        mock_aio.get(
            AZURE_PRICING_BASE_URL,
            status=200,
            payload={"Items": [{"skuName": "test"}], "Count": 1},
        )

        with patch("azure_pricing_mcp.client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            async with AzurePricingClient() as client:
                result = await client.make_request(max_retries=1)
                assert result["Count"] == 1
                # Default backoff: RATE_LIMIT_RETRY_BASE_WAIT * (attempt + 1) = 5 * 1 = 5
                mock_sleep.assert_awaited_once_with(5)

    @pytest.mark.asyncio
    async def test_caps_retry_after_at_60s(self, mock_aio):
        """Retry-After values over 60s should be capped at 60."""
        mock_aio.get(
            AZURE_PRICING_BASE_URL,
            status=429,
            headers={"Retry-After": "999"},
        )
        mock_aio.get(
            AZURE_PRICING_BASE_URL,
            status=200,
            payload={"Items": [], "Count": 0},
        )

        with patch("azure_pricing_mcp.client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            async with AzurePricingClient() as client:
                result = await client.make_request(max_retries=1)
                assert result["Count"] == 0
                mock_sleep.assert_awaited_once_with(60)


class TestConnectionPooling:
    @pytest.mark.asyncio
    async def test_connector_has_pool_limits(self):
        """The client should create a TCPConnector with pool limits."""
        async with AzurePricingClient() as client:
            assert client.session is not None
            connector = client.session.connector
            assert isinstance(connector, aiohttp.TCPConnector)
            assert connector.limit == 10
            assert connector.limit_per_host == 5
