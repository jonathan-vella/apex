"""Tests for Reserved Instance pricing functionality."""

from unittest.mock import AsyncMock, patch

import pytest

from azure_pricing_mcp.client import AzurePricingClient
from azure_pricing_mcp.services import PricingService
from azure_pricing_mcp.services.retirement import RetirementService


@pytest.fixture
async def services():
    """Create pricing service for testing."""
    async with AzurePricingClient() as client:
        retirement_service = RetirementService(client)
        pricing_service = PricingService(client, retirement_service)
        yield {"pricing": pricing_service, "client": client}


@pytest.mark.asyncio
async def test_get_ri_pricing(services):
    """Test RI pricing with comparison to on-demand."""
    # Mock RI response
    with patch.object(services["client"], "fetch_prices", new_callable=AsyncMock) as mock_request:
        mock_request.side_effect = [
            {
                "Items": [
                    {
                        "skuName": "D4s v3",
                        "armRegionName": "eastus",
                        "retailPrice": 3504.0,  # Total cost for 1 year
                        "reservationTerm": "1 Year",
                        "unitOfMeasure": "1 Hour",
                    }
                ]
            },
            {
                "Items": [
                    {
                        "skuName": "D4s v3",
                        "armRegionName": "eastus",
                        "retailPrice": 0.8,
                        "priceType": "Consumption",
                        "unitOfMeasure": "1 Hour",
                    }
                ]
            },
        ]

        result = await services["pricing"].get_ri_pricing(
            service_name="Virtual Machines",
            sku_name="D4s v3",
            region="eastus",
            compare_on_demand=True,
        )

        assert len(result["ri_items"]) == 1
        assert "comparison" in result
        comp = result["comparison"][0]
        assert comp["sku"] == "D4s v3"
