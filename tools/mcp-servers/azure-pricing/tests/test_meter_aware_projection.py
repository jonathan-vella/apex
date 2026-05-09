"""Regression tests for v5.3 meter-aware projection (the azure-pricing-mcp-test bugs).

This suite locks in the v5.3 fixes for the bugs surfaced by the
``azure-pricing-mcp-test`` agent run on 2026-05-09:

1. ACR Premium was returning $73/month (= $0.10/GB/month × 730) when the
   correct flat rate is ≈$50/month ($1.6666/day).
2. Storage Account / Private DNS Zone / Private Endpoint were all
   returning ``no pricing found`` due to service-name mismatches and
   meters not surfaced by the public Retail Prices API.
3. Key Vault Standard was matching ``Standard B1`` (Managed HSM Pool) at
   $3.20/hr instead of its own per-rotation meter.

These tests use mocked search results so they don't require network or
the live Azure API.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from azure_pricing_mcp.meter_units import (
    MeterDimension,
    parse_unit_of_measure,
    project_monthly_cost,
    select_primary_meter,
)
from azure_pricing_mcp.services.pricing import (
    PricingService,
    _lookup_static_fallback,
    _normalize_sku_for_search,
    _resolve_service_name,
)

# ─── parse_unit_of_measure ──────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected_dim,expected_qty",
    [
        ("1 Hour", MeterDimension.HOUR, 1.0),
        ("100 Hours", MeterDimension.HOUR, 100.0),
        ("1/Day", MeterDimension.DAY, 1.0),
        ("1 Day", MeterDimension.DAY, 1.0),
        ("1 GB/Month", MeterDimension.GB_MONTH, 1.0),
        ("1 GB / Month", MeterDimension.GB_MONTH, 1.0),
        ("10 GB", MeterDimension.GB, 10.0),
        ("1 Second", MeterDimension.SECOND, 1.0),
        ("10K", MeterDimension.TRANSACTIONS, 10_000),
        ("1M", MeterDimension.TRANSACTIONS, 1_000_000),
        ("1 Month", MeterDimension.MONTH, 1.0),
        ("Foobar", MeterDimension.UNKNOWN, 1.0),
        ("", MeterDimension.UNKNOWN, 1.0),
        (None, MeterDimension.UNKNOWN, 1.0),
    ],
)
def test_parse_unit_of_measure(raw, expected_dim, expected_qty):
    unit = parse_unit_of_measure(raw)
    assert unit.dimension == expected_dim
    assert unit.quantity == expected_qty


# ─── project_monthly_cost ──────────────────────────────────────────────


def test_acr_premium_daily_meter_projects_correctly():
    """ACR Premium $1.6666/day must project to ≈$50.65/mo, not $73 (the v5.0 bug)."""
    item = {"retailPrice": 1.6666, "unitOfMeasure": "1/Day"}
    monthly, unit, warning = project_monthly_cost(item)
    assert unit.dimension == MeterDimension.DAY
    assert monthly == pytest.approx(50.73, rel=0.01)
    assert warning is None


def test_hourly_meter_projects_730x():
    item = {"retailPrice": 0.10, "unitOfMeasure": "1 Hour"}
    monthly, unit, _ = project_monthly_cost(item)
    assert unit.dimension == MeterDimension.HOUR
    assert monthly == pytest.approx(73.0)


def test_gb_month_meter_refuses_blind_projection():
    """Per-GB/month storage meter must NOT be multiplied by 730 — that's the
    v5.0 bug. Should return $0 with a warning so the caller knows to supply
    a volume estimate."""
    item = {"retailPrice": 0.10, "unitOfMeasure": "1 GB/Month"}
    monthly, unit, warning = project_monthly_cost(item)
    assert unit.dimension == MeterDimension.GB_MONTH
    assert monthly == 0.0
    assert warning is not None
    assert "GB/month" in warning.lower() or "storage" in warning.lower()


def test_transactions_meter_refuses_blind_projection():
    item = {"retailPrice": 0.03, "unitOfMeasure": "10K"}
    monthly, unit, warning = project_monthly_cost(item)
    assert unit.dimension == MeterDimension.TRANSACTIONS
    assert monthly == 0.0
    assert warning is not None


def test_seconds_meter_refuses_blind_projection():
    """Per-second meters (like ACR build tasks) should not naively × 730 × 3600."""
    item = {"retailPrice": 0.0001, "unitOfMeasure": "1 Second"}
    monthly, _, warning = project_monthly_cost(item)
    assert monthly == 0.0
    assert warning is not None


def test_unknown_unit_refuses_projection():
    """Key Vault per-rotation `1` meters parse as UNKNOWN and refuse projection."""
    item = {"retailPrice": 1.0, "unitOfMeasure": "1"}
    monthly, _, warning = project_monthly_cost(item)
    assert monthly == 0.0
    assert warning is not None


# ─── select_primary_meter ──────────────────────────────────────────────


def test_acr_premium_picks_daily_over_gb_month():
    """The ACR Premium scenario from the test failure: 7 meters, the GB/Month
    one comes first in the API response, but our heuristic must pick the
    daily flat-fee meter."""
    items = [
        {"skuName": "Premium", "retailPrice": 0.10, "unitOfMeasure": "1 GB/Month", "type": "Consumption"},
        {"skuName": "Premium", "retailPrice": 0.0, "unitOfMeasure": "1 Second", "type": "Consumption"},
        {"skuName": "Premium", "retailPrice": 0.0001, "unitOfMeasure": "1 Second", "type": "Consumption"},
        {"skuName": "Premium", "retailPrice": 1.6666, "unitOfMeasure": "1/Day", "type": "Consumption"},
        {"skuName": "Premium", "retailPrice": 0.33333, "unitOfMeasure": "1/Day", "type": "Consumption"},
    ]
    picked = select_primary_meter(items, requested_sku="Premium")
    assert picked is not None
    assert picked["unitOfMeasure"] == "1/Day"
    # And it picks the higher-priced daily meter (the actual SKU rate, not
    # an overage):
    assert picked["retailPrice"] == 1.6666


def test_key_vault_picks_standard_over_standard_b1():
    """Key Vault Standard scenario: API also returns ``Standard B1`` (Managed
    HSM Pool) at $3.20/hr, which is a different and much more expensive SKU.
    Exact sku-name match must win over dimension preference."""
    items = [
        {"skuName": "Standard", "retailPrice": 3.0, "unitOfMeasure": "1", "type": "Consumption"},
        {"skuName": "Standard", "retailPrice": 1.0, "unitOfMeasure": "1", "type": "Consumption"},
        {"skuName": "Standard B1", "retailPrice": 3.2, "unitOfMeasure": "1 Hour", "type": "Consumption"},
        {"skuName": "Standard", "retailPrice": 0.03, "unitOfMeasure": "10K", "type": "Consumption"},
    ]
    picked = select_primary_meter(items, requested_sku="Standard")
    assert picked is not None
    # MUST pick a Standard meter, not Standard B1 (Managed HSM):
    assert picked["skuName"] == "Standard"


def test_select_primary_returns_none_for_empty_list():
    assert select_primary_meter([], requested_sku="Anything") is None


# ─── _resolve_service_name ─────────────────────────────────────────────


@pytest.mark.parametrize(
    "user_input,expected",
    [
        ("Storage Account", "Storage"),
        ("Storage Accounts", "Storage"),
        ("storage account", "Storage"),
        ("Container Registry", "Container Registry"),  # already canonical
        ("vm", "Virtual Machines"),
        ("VM", "Virtual Machines"),
    ],
)
def test_resolve_service_name(user_input, expected):
    assert _resolve_service_name(user_input) == expected


# ─── _normalize_sku_for_search ─────────────────────────────────────────


@pytest.mark.parametrize(
    "user_sku,expected",
    [
        ("Standard LRS GPv2", "Standard LRS"),
        ("Standard LRS GPv1", "Standard LRS"),
        ("Standard LRS", "Standard LRS"),
        ("Premium SSD v2", "Premium SSD"),
        ("S1", "S1"),
    ],
)
def test_normalize_sku_for_search(user_sku, expected):
    assert _normalize_sku_for_search(user_sku) == expected


# ─── _lookup_static_fallback ───────────────────────────────────────────


def test_static_fallback_private_dns_zone():
    """Private DNS Zone is not exposed by the public Retail Prices API —
    we ship a static fallback price."""
    fb = _lookup_static_fallback("Azure DNS", "Private DNS Zone")
    assert fb is not None
    assert fb["monthly_cost"] > 0
    assert "Azure DNS" in fb["service_name"]


def test_static_fallback_private_endpoint():
    """Private Endpoint is not exposed by the public Retail Prices API."""
    fb = _lookup_static_fallback("Virtual Network", "Private Endpoint Standard")
    assert fb is not None
    assert fb["monthly_cost"] > 0


def test_static_fallback_no_match_returns_none():
    assert _lookup_static_fallback("Virtual Machines", "Standard_D4s_v5") is None


# ─── End-to-end: estimate_costs with mocked client ─────────────────────


@pytest.mark.asyncio
async def test_estimate_costs_picks_correct_meter_acr_premium():
    """Smoke test: estimate_costs returns ≈$50/mo for ACR Premium (was $73)."""
    client = MagicMock()
    # Mock fetch_prices to return the canonical 7-meter ACR Premium response
    client.fetch_prices = AsyncMock(
        return_value={
            "Items": [
                {
                    "serviceName": "Container Registry",
                    "skuName": "Premium",
                    "armRegionName": "swedencentral",
                    "retailPrice": 0.10,
                    "unitOfMeasure": "1 GB/Month",
                    "productName": "Container Registry",
                    "type": "Consumption",
                },
                {
                    "serviceName": "Container Registry",
                    "skuName": "Premium",
                    "armRegionName": "swedencentral",
                    "retailPrice": 1.6666,
                    "unitOfMeasure": "1/Day",
                    "productName": "Container Registry",
                    "type": "Consumption",
                },
                {
                    "serviceName": "Container Registry",
                    "skuName": "Premium",
                    "armRegionName": "swedencentral",
                    "retailPrice": 0.0001,
                    "unitOfMeasure": "1 Second",
                    "productName": "Container Registry",
                    "type": "Consumption",
                },
            ]
        }
    )
    retirement = MagicMock()
    retirement.get_retirement_data = AsyncMock(return_value={})
    svc = PricingService(client, retirement)

    result = await svc.estimate_costs(
        service_name="Container Registry",
        sku_name="Premium",
        region="swedencentral",
    )

    assert "error" not in result
    assert result["unit_of_measure"] == "1/Day"
    assert result["meter_dimension"] == "day"
    assert result["on_demand_pricing"]["monthly_cost"] == pytest.approx(50.73, rel=0.01)


@pytest.mark.asyncio
async def test_estimate_costs_falls_back_to_static_for_private_dns_zone():
    """Private DNS Zone has no API meter; we should return the static fallback."""
    client = MagicMock()
    # Mock empty results for all search_prices calls
    client.fetch_prices = AsyncMock(return_value={"Items": []})
    retirement = MagicMock()
    retirement.get_retirement_data = AsyncMock(return_value={})
    svc = PricingService(client, retirement)

    result = await svc.estimate_costs(
        service_name="Azure DNS",
        sku_name="Private DNS Zone",
        region="swedencentral",
    )

    assert "error" not in result
    assert result["meter_dimension"] == "static_fallback"
    assert result["on_demand_pricing"]["monthly_cost"] > 0
    assert "projection_warning" in result
    assert "static fallback" in result["projection_warning"].lower()
