"""Tests for Azure Databricks DBU pricing tools."""

from typing import Any
from unittest.mock import patch

import pytest
from mcp.types import TextContent

from azure_pricing_mcp.client import AzurePricingClient
from azure_pricing_mcp.databricks.formatters import (
    format_databricks_compare_workloads_response,
    format_databricks_cost_estimate_response,
    format_databricks_dbu_pricing_response,
)
from azure_pricing_mcp.handlers import ToolHandlers
from azure_pricing_mcp.services import PricingService, SKUService
from azure_pricing_mcp.services.databricks import DatabricksService, _resolve_workload_type
from azure_pricing_mcp.services.retirement import RetirementService

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_databricks_api_response() -> dict[str, Any]:
    """Sample Azure Retail Prices API response for Databricks."""
    return {
        "BillingCurrency": "USD",
        "Items": [
            {
                "currencyCode": "USD",
                "retailPrice": 0.55,
                "armRegionName": "eastus",
                "location": "US East",
                "skuName": "Premium All-purpose Compute",
                "meterName": "Premium All-purpose DBU",
                "serviceName": "Azure Databricks",
                "unitOfMeasure": "1 Hour",
                "type": "Consumption",
                "effectiveStartDate": "2024-01-01T00:00:00Z",
                "productName": "Azure Databricks",
            },
            {
                "currencyCode": "USD",
                "retailPrice": 0.65,
                "armRegionName": "eastus",
                "location": "US East",
                "skuName": "Premium All-Purpose Photon",
                "meterName": "Premium All-Purpose Photon DBU",
                "serviceName": "Azure Databricks",
                "unitOfMeasure": "1 Hour",
                "type": "Consumption",
                "effectiveStartDate": "2024-01-01T00:00:00Z",
                "productName": "Azure Databricks",
            },
            {
                "currencyCode": "USD",
                "retailPrice": 0.30,
                "armRegionName": "eastus",
                "location": "US East",
                "skuName": "Premium Jobs Compute",
                "meterName": "Premium Jobs Compute DBU",
                "serviceName": "Azure Databricks",
                "unitOfMeasure": "1 Hour",
                "type": "Consumption",
                "effectiveStartDate": "2024-01-01T00:00:00Z",
                "productName": "Azure Databricks",
            },
            {
                "currencyCode": "USD",
                "retailPrice": 0.40,
                "armRegionName": "eastus",
                "location": "US East",
                "skuName": "Standard All-purpose Compute",
                "meterName": "Standard All-purpose DBU",
                "serviceName": "Azure Databricks",
                "unitOfMeasure": "1 Hour",
                "type": "Consumption",
                "effectiveStartDate": "2024-01-01T00:00:00Z",
                "productName": "Azure Databricks",
            },
        ],
        "NextPageLink": None,
        "Count": 4,
    }


@pytest.fixture
def mock_databricks_api_response_jobs_only() -> dict[str, Any]:
    """API response with only Jobs Compute SKUs."""
    return {
        "BillingCurrency": "USD",
        "Items": [
            {
                "currencyCode": "USD",
                "retailPrice": 0.30,
                "armRegionName": "eastus",
                "location": "US East",
                "skuName": "Premium Jobs Compute",
                "meterName": "Premium Jobs Compute DBU",
                "serviceName": "Azure Databricks",
                "unitOfMeasure": "1 Hour",
                "type": "Consumption",
                "effectiveStartDate": "2024-01-01T00:00:00Z",
                "productName": "Azure Databricks",
            },
        ],
        "NextPageLink": None,
        "Count": 1,
    }


@pytest.fixture
async def pricing_client():
    """Create a pricing client instance for testing."""
    client = AzurePricingClient()
    async with client:
        yield client


@pytest.fixture
async def databricks_service(pricing_client):
    """Create a DatabricksService instance for testing."""
    return DatabricksService(pricing_client)


@pytest.fixture
async def tool_handlers_with_databricks(pricing_client):
    """Create ToolHandlers with DatabricksService for testing."""
    retirement_service = RetirementService(pricing_client)
    pricing_service = PricingService(pricing_client, retirement_service)
    sku_service = SKUService(pricing_service)
    databricks_service = DatabricksService(pricing_client)
    return ToolHandlers(pricing_service, sku_service, databricks_service=databricks_service)


# =============================================================================
# _resolve_workload_type Tests
# =============================================================================


class TestResolveWorkloadType:
    """Test workload type resolution logic."""

    def test_direct_match(self):
        assert _resolve_workload_type("all-purpose") == "all-purpose"
        assert _resolve_workload_type("jobs") == "jobs"
        assert _resolve_workload_type("serverless sql") == "serverless sql"

    def test_alias_match(self):
        assert _resolve_workload_type("etl") == "jobs"
        assert _resolve_workload_type("notebook") == "all-purpose"
        assert _resolve_workload_type("warehouse") == "serverless sql"
        assert _resolve_workload_type("ml") == "model training"

    def test_case_insensitive(self):
        assert _resolve_workload_type("ALL-PURPOSE") == "all-purpose"
        assert _resolve_workload_type("Jobs") == "jobs"
        assert _resolve_workload_type("ETL") == "jobs"

    def test_whitespace_handling(self):
        assert _resolve_workload_type("  all-purpose  ") == "all-purpose"
        assert _resolve_workload_type("  etl  ") == "jobs"

    def test_unknown_returns_none(self):
        assert _resolve_workload_type("nonexistent") is None
        assert _resolve_workload_type("") is None

    def test_partial_match(self):
        assert _resolve_workload_type("all") == "all-purpose"
        assert _resolve_workload_type("sql pro") == "sql pro"


# =============================================================================
# DatabricksService Tests
# =============================================================================


class TestDatabricksService:
    """Test suite for DatabricksService."""

    @pytest.mark.asyncio
    async def test_get_dbu_pricing_all(self, databricks_service, mock_databricks_api_response):
        """Test fetching all DBU pricing."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.get_dbu_pricing(region="eastus")

            assert result["region"] == "eastus"
            assert result["currency"] == "USD"
            assert result["total_items"] == 4
            assert len(result["workloads"]) > 0
            assert "available_workload_types" in result

    @pytest.mark.asyncio
    async def test_get_dbu_pricing_filtered_by_workload(self, databricks_service, mock_databricks_api_response):
        """Test fetching DBU pricing filtered by workload type."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.get_dbu_pricing(workload_type="all-purpose", region="eastus")

            assert result["workload_filter"] == "all-purpose"
            assert result["resolved_workload"] == "all-purpose"

    @pytest.mark.asyncio
    async def test_get_dbu_pricing_filtered_by_tier(self, databricks_service, mock_databricks_api_response):
        """Test fetching DBU pricing filtered by tier."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.get_dbu_pricing(tier="Premium", region="eastus")

            assert result["tier_filter"] == "Premium"

    @pytest.mark.asyncio
    async def test_get_dbu_pricing_excludes_free_trial(self, databricks_service):
        """Test that Free Trial and POC Non-Billable SKUs are excluded."""
        response_with_free = {
            "Items": [
                {
                    "currencyCode": "USD",
                    "retailPrice": 0.0,
                    "armRegionName": "eastus",
                    "location": "US East",
                    "skuName": "Free Trial All-purpose Compute",
                    "meterName": "Free Trial DBU",
                    "serviceName": "Azure Databricks",
                    "unitOfMeasure": "1 Hour",
                    "type": "Consumption",
                    "effectiveStartDate": "2024-01-01T00:00:00Z",
                    "productName": "Azure Databricks",
                },
                {
                    "currencyCode": "USD",
                    "retailPrice": 0.55,
                    "armRegionName": "eastus",
                    "location": "US East",
                    "skuName": "Premium All-purpose Compute",
                    "meterName": "Premium All-purpose DBU",
                    "serviceName": "Azure Databricks",
                    "unitOfMeasure": "1 Hour",
                    "type": "Consumption",
                    "effectiveStartDate": "2024-01-01T00:00:00Z",
                    "productName": "Azure Databricks",
                },
            ],
            "NextPageLink": None,
            "Count": 2,
        }

        with patch.object(databricks_service._client, "fetch_prices", return_value=response_with_free):
            result = await databricks_service.get_dbu_pricing()

            assert result["total_items"] == 1
            # Only the Premium All-purpose should remain
            all_entries = []
            for entries in result["workloads"].values():
                all_entries.extend(entries)
            assert all(e["tier"] != "Free Trial" for e in all_entries)

    @pytest.mark.asyncio
    async def test_estimate_dbu_cost_basic(self, databricks_service, mock_databricks_api_response):
        """Test basic cost estimation."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.estimate_dbu_cost(
                workload_type="all-purpose",
                dbu_count=2.0,
                hours_per_day=8,
                days_per_month=22,
                tier="Premium",
                region="eastus",
            )

            # Derive expected values from the mock fixture
            mock_rate = mock_databricks_api_response["Items"][0]["retailPrice"]  # Premium All-purpose
            dbu_count = 2.0
            hours_per_day = 8
            days_per_month = 22
            total_hours = hours_per_day * days_per_month
            total_dbu_hours = dbu_count * 1 * total_hours
            expected_monthly = mock_rate * total_dbu_hours

            assert "error" not in result
            assert result["workload_type"] == "all-purpose"
            assert result["dbu_rate_per_hour"] == mock_rate
            assert result["dbu_count_per_worker"] == dbu_count
            assert result["total_hours"] == total_hours
            assert result["total_dbu_hours"] == total_dbu_hours
            assert result["monthly_dbu_cost"] == pytest.approx(expected_monthly)
            assert result["annual_estimate"] == pytest.approx(expected_monthly * 12)

    @pytest.mark.asyncio
    async def test_estimate_dbu_cost_with_discount(self, databricks_service, mock_databricks_api_response):
        """Test cost estimation with discount applied."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.estimate_dbu_cost(
                workload_type="all-purpose",
                dbu_count=2.0,
                hours_per_day=8,
                days_per_month=22,
                tier="Premium",
                region="eastus",
                discount_percentage=10.0,
            )

            assert result["discount_percentage"] == 10.0
            assert result["discounted_monthly_cost"] < result["monthly_dbu_cost"]
            assert result["discount_amount"] == pytest.approx(result["monthly_dbu_cost"] * 0.1, rel=0.01)

    @pytest.mark.asyncio
    async def test_estimate_dbu_cost_with_workers(self, databricks_service, mock_databricks_api_response):
        """Test cost estimation with multiple workers."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.estimate_dbu_cost(
                workload_type="all-purpose",
                dbu_count=2.0,
                num_workers=4,
                hours_per_day=8,
                days_per_month=22,
                tier="Premium",
            )

            assert result["num_workers"] == 4
            # 2.0 DBU * 4 workers * 176 hours = 1408 DBU-hours
            assert result["total_dbu_hours"] == 1408.0

    @pytest.mark.asyncio
    async def test_estimate_dbu_cost_photon_info(self, databricks_service, mock_databricks_api_response):
        """Test that Photon pricing info is included when available."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.estimate_dbu_cost(
                workload_type="all-purpose",
                dbu_count=1.0,
                tier="Premium",
            )

            # Photon rate comes from the mock fixture's Photon SKU
            mock_photon_rate = mock_databricks_api_response["Items"][1]["retailPrice"]  # Premium All-Purpose Photon
            assert result["photon_pricing"] is not None
            assert result["photon_pricing"]["dbu_rate"] == mock_photon_rate

    @pytest.mark.asyncio
    async def test_estimate_dbu_cost_unknown_workload(self, databricks_service):
        """Test error for unknown workload type."""
        result = await databricks_service.estimate_dbu_cost(
            workload_type="nonexistent",
            dbu_count=1.0,
        )

        assert result["error"] == "unknown_workload_type"
        assert "available_types" in result

    @pytest.mark.asyncio
    async def test_compare_workloads_basic(self, databricks_service, mock_databricks_api_response):
        """Test basic workload comparison."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.compare_workloads(
                workload_types=["all-purpose", "jobs"],
                tier="Premium",
            )

            assert result["compared_by"] == "workload_type"
            assert result["total_comparisons"] == 2
            assert len(result["comparison"]) == 2

    @pytest.mark.asyncio
    async def test_compare_workloads_with_cost_projection(self, databricks_service, mock_databricks_api_response):
        """Test workload comparison with monthly cost projection."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.compare_workloads(
                workload_types=["all-purpose", "jobs"],
                tier="Premium",
                dbu_count=2.0,
                hours_per_month=730,
            )

            valid = [c for c in result["comparison"] if "error" not in c and c.get("dbu_rate") is not None]
            for comp in valid:
                assert "monthly_cost" in comp

    @pytest.mark.asyncio
    async def test_compare_workloads_multi_region(self, databricks_service, mock_databricks_api_response):
        """Test comparison across multiple regions."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.compare_workloads(
                workload_types=["all-purpose"],
                regions=["eastus", "westus"],
                tier="Premium",
            )

            assert result["compared_by"] == "region"
            assert result["total_comparisons"] == 2

    @pytest.mark.asyncio
    async def test_compare_workloads_savings_calculated(self, databricks_service, mock_databricks_api_response):
        """Test that savings vs most expensive are calculated."""
        with patch.object(databricks_service._client, "fetch_prices", return_value=mock_databricks_api_response):
            result = await databricks_service.compare_workloads(
                workload_types=["all-purpose", "jobs"],
                tier="Premium",
            )

            valid = [c for c in result["comparison"] if "error" not in c and c.get("dbu_rate") is not None]
            if len(valid) >= 2:
                # The cheapest should have positive savings
                assert valid[0].get("savings_vs_most_expensive", 0) >= 0


# =============================================================================
# Formatter Tests
# =============================================================================


class TestDatabricksFormatters:
    """Test Databricks formatter functions."""

    def test_format_dbu_pricing_response(self):
        """Test formatting of DBU pricing results."""
        dbu_rate = 0.55
        result = {
            "region": "eastus",
            "tier_filter": "Premium",
            "workload_filter": None,
            "resolved_workload": None,
            "currency": "USD",
            "total_items": 2,
            "workloads": {
                "All-purpose Compute": [
                    {
                        "workload": "All-purpose Compute",
                        "tier": "Premium",
                        "dbu_rate": dbu_rate,
                        "unit": "1 Hour",
                        "sku_name": "Premium All-purpose Compute",
                        "meter_name": "Premium All-purpose DBU",
                        "region": "US East",
                        "arm_region": "eastus",
                        "currency": "USD",
                        "effective_date": "2024-01-01",
                    }
                ],
            },
            "available_workload_types": ["all-purpose", "jobs"],
        }

        output = format_databricks_dbu_pricing_response(result)
        assert "eastus" in output
        assert f"${dbu_rate:.4f}" in output
        assert "Premium" in output

    def test_format_dbu_pricing_empty(self):
        """Test formatting when no pricing found."""
        result = {
            "region": "eastus",
            "tier_filter": None,
            "workload_filter": "nonexistent",
            "resolved_workload": None,
            "currency": "USD",
            "total_items": 0,
            "workloads": {},
            "available_workload_types": ["all-purpose", "jobs"],
        }

        output = format_databricks_dbu_pricing_response(result)
        assert "No Databricks DBU pricing found" in output
        assert "not recognized" in output

    def test_format_cost_estimate_response(self):
        """Test formatting of cost estimate results."""
        dbu_rate = 0.55
        monthly_cost = 193.60
        photon_rate = 0.65
        photon_monthly = 228.80
        result = {
            "workload_type": "all-purpose",
            "tier": "Premium",
            "region": "eastus",
            "currency": "USD",
            "dbu_rate_per_hour": dbu_rate,
            "dbu_count_per_worker": 2.0,
            "num_workers": 1,
            "hours_per_day": 8,
            "days_per_month": 22,
            "total_hours": 176,
            "total_dbu_hours": 352.0,
            "monthly_dbu_cost": monthly_cost,
            "discount_percentage": 0,
            "discount_amount": 0,
            "discounted_monthly_cost": monthly_cost,
            "annual_estimate": monthly_cost * 12,
            "photon_pricing": {
                "dbu_rate": photon_rate,
                "monthly_cost": photon_monthly,
                "rate_difference": photon_rate - dbu_rate,
            },
            "note": "DBU costs only.",
        }

        output = format_databricks_cost_estimate_response(result)
        assert "all-purpose" in output
        assert f"${monthly_cost:.2f}" in output
        assert "Photon" in output
        assert f"${photon_rate:.4f}" in output

    def test_format_cost_estimate_error(self):
        """Test formatting of cost estimate error."""
        result = {
            "error": "unknown_workload_type",
            "message": "Unknown workload type: 'bad'",
            "available_types": ["all-purpose", "jobs"],
            "help": "Use one of the available workload types.",
        }

        output = format_databricks_cost_estimate_response(result)
        assert "Error" in output
        assert "all-purpose" in output

    def test_format_compare_workloads_response(self):
        """Test formatting of workload comparison results."""
        jobs_rate = 0.30
        allpurpose_rate = 0.55
        photon_rate = 0.65
        savings_pct = 45.5
        result = {
            "comparison": [
                {
                    "workload_type": "jobs",
                    "region": "eastus",
                    "tier": "Premium",
                    "dbu_rate": jobs_rate,
                    "photon_dbu_rate": None,
                    "currency": "USD",
                    "savings_vs_most_expensive": savings_pct,
                },
                {
                    "workload_type": "all-purpose",
                    "region": "eastus",
                    "tier": "Premium",
                    "dbu_rate": allpurpose_rate,
                    "photon_dbu_rate": photon_rate,
                    "currency": "USD",
                    "savings_vs_most_expensive": 0.0,
                },
            ],
            "tier": "Premium",
            "currency": "USD",
            "compared_by": "workload_type",
            "total_comparisons": 2,
            "note": "DBU rates shown per hour.",
        }

        output = format_databricks_compare_workloads_response(result)
        assert "jobs" in output
        assert "all-purpose" in output
        assert f"${jobs_rate:.4f}" in output
        assert f"${allpurpose_rate:.4f}" in output
        assert f"{savings_pct}%" in output


# =============================================================================
# Handler Tests
# =============================================================================


class TestDatabricksHandlers:
    """Test Databricks tool handler methods."""

    @pytest.mark.asyncio
    async def test_handle_databricks_dbu_pricing(self, tool_handlers_with_databricks, mock_databricks_api_response):
        """Test databricks_dbu_pricing handler."""
        with patch.object(
            tool_handlers_with_databricks._databricks_service._client,
            "fetch_prices",
            return_value=mock_databricks_api_response,
        ):
            result = await tool_handlers_with_databricks.handle_databricks_dbu_pricing({"region": "eastus"})

            assert isinstance(result, list)
            assert len(result) == 1
            assert isinstance(result[0], TextContent)
            assert "eastus" in result[0].text

    @pytest.mark.asyncio
    async def test_handle_databricks_cost_estimate(self, tool_handlers_with_databricks, mock_databricks_api_response):
        """Test databricks_cost_estimate handler."""
        with patch.object(
            tool_handlers_with_databricks._databricks_service._client,
            "fetch_prices",
            return_value=mock_databricks_api_response,
        ):
            result = await tool_handlers_with_databricks.handle_databricks_cost_estimate(
                {
                    "workload_type": "all-purpose",
                    "dbu_count": 2.0,
                    "hours_per_day": 8,
                    "days_per_month": 22,
                    "tier": "Premium",
                    "region": "eastus",
                }
            )

            assert isinstance(result, list)
            assert len(result) == 1
            assert isinstance(result[0], TextContent)
            assert "all-purpose" in result[0].text

    @pytest.mark.asyncio
    async def test_handle_databricks_compare_workloads(
        self, tool_handlers_with_databricks, mock_databricks_api_response
    ):
        """Test databricks_compare_workloads handler."""
        with patch.object(
            tool_handlers_with_databricks._databricks_service._client,
            "fetch_prices",
            return_value=mock_databricks_api_response,
        ):
            result = await tool_handlers_with_databricks.handle_databricks_compare_workloads(
                {
                    "workload_types": ["all-purpose", "jobs"],
                    "tier": "Premium",
                }
            )

            assert isinstance(result, list)
            assert len(result) == 1
            assert isinstance(result[0], TextContent)
            assert "Comparison" in result[0].text or "comparison" in result[0].text.lower()
