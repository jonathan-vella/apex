"""Regression tests for v5.4 usage-aware projection + zero-cost service fallbacks.

Locks in the v5.4 fixes for the bugs surfaced when comparing v5.3 output to
the bmit-2026/malta-catering reference cost estimate:

1. Virtual Network Standard returned $4.38 (wrong meter — Public IP Prefix
   matched on `skuName=Standard`). Now returns $0 via the static-fallback
   table since VNets have no per-VNet base charge.

2. Key Vault Standard with `usage.transactions_per_month=100_000` was
   returning $1.50 (picked the $0.15/10K Renewals meter instead of the
   $0.03/10K Operations meter). Now returns $0.30 — the cheapest meter in
   the matching dimension is the typical baseline.

3. Storage Account / DNS Zone / Private Endpoint now correctly resolve via
   service-name normalization + static fallbacks; the v5.3 tests already
   cover those paths.
"""

from __future__ import annotations

import pytest

from azure_pricing_mcp.meter_units import (
    project_monthly_cost,
    select_primary_meter,
)
from azure_pricing_mcp.services.pricing import _lookup_static_fallback

# ─── Static-fallback for VNet base / no-charge services ────────────────


def test_static_fallback_virtual_network_base_is_zero():
    """Virtual Network Standard has no per-VNet base charge; the static
    fallback must return $0 to prevent the v5.3 regression where the
    meter selector matched 'Public IP Prefix Standard' at $0.006/hr."""
    fb = _lookup_static_fallback("Virtual Network", "Standard")
    assert fb is not None
    assert fb["monthly_cost"] == 0.0


def test_static_fallback_resource_group_is_zero():
    fb = _lookup_static_fallback("Resource Group", "")
    assert fb is not None
    assert fb["monthly_cost"] == 0.0


def test_static_fallback_managed_identity_is_zero():
    fb = _lookup_static_fallback("Managed Identity", "")
    assert fb is not None
    assert fb["monthly_cost"] == 0.0


def test_static_fallback_private_endpoint_uses_microsoft_flat_rate():
    """Private Endpoint static fallback should reflect Microsoft's flat
    $7.20/PE/month from the public pricing page, not $0.01/hr × 730."""
    fb = _lookup_static_fallback("Virtual Network", "Private Endpoint Standard")
    assert fb is not None
    assert fb["monthly_cost"] == pytest.approx(7.20, rel=0.01)


def test_static_fallback_private_endpoint_takes_precedence_over_vnet_base():
    """A Virtual Network entry with sku 'Private Endpoint' must hit the
    PE-specific rule, not the catch-all 'Virtual Network / Standard' $0
    rule. The lookup function iterates in declared order — PE rule appears
    first in `_STATIC_FALLBACK_PRICES`."""
    fb = _lookup_static_fallback("Virtual Network", "Private Endpoint Standard")
    assert fb is not None
    assert "Private" in fb["product_name"]
    assert fb["monthly_cost"] > 0


# ─── Usage-aware projection ────────────────────────────────────────────


def test_usage_transactions_projects_correctly():
    """Per-10K transactions meter must project from caller-supplied ops/month."""
    item = {"retailPrice": 0.03, "unitOfMeasure": "10K"}
    monthly, _, warning = project_monthly_cost(item, usage={"transactions_per_month": 100_000})
    # 100K / 10K = 10 × $0.03 = $0.30
    assert monthly == pytest.approx(0.30, rel=0.001)
    assert warning is None


def test_usage_gb_stored_projects_correctly():
    item = {"retailPrice": 0.045, "unitOfMeasure": "1 GB/Month"}
    monthly, _, warning = project_monthly_cost(item, usage={"gb_stored": 10})
    assert monthly == pytest.approx(0.45, rel=0.001)
    assert warning is None


def test_usage_gb_transferred_projects_correctly():
    item = {"retailPrice": 0.05, "unitOfMeasure": "1 GB"}
    monthly, _, warning = project_monthly_cost(item, usage={"gb_transferred": 100})
    assert monthly == pytest.approx(5.0, rel=0.001)
    assert warning is None


def test_usage_seconds_runtime_projects_correctly():
    item = {"retailPrice": 0.0001, "unitOfMeasure": "1 Second"}
    monthly, _, warning = project_monthly_cost(item, usage={"seconds_runtime": 3600})
    assert monthly == pytest.approx(0.36, rel=0.001)
    assert warning is None


def test_usage_unrelated_dimension_not_applied():
    """If usage.transactions_per_month is supplied but the meter is GB-Month,
    we should NOT apply transactions to a GB meter — return $0 with warning."""
    item = {"retailPrice": 0.045, "unitOfMeasure": "1 GB/Month"}
    monthly, _, warning = project_monthly_cost(item, usage={"transactions_per_month": 100_000})
    assert monthly == 0.0
    assert warning is not None


def test_no_usage_returns_zero_with_warning():
    """Without usage params, transaction/storage meters still return $0
    with a warning (v5.3 behaviour preserved)."""
    item = {"retailPrice": 0.03, "unitOfMeasure": "10K"}
    monthly, _, warning = project_monthly_cost(item)
    assert monthly == 0.0
    assert warning is not None


# ─── Meter selection prefers usage-matching dimension ─────────────────


def test_select_primary_prefers_transaction_meter_when_usage_supplied():
    """Storage Account scenario: meters span GB/Month + transactions. With
    usage.transactions_per_month set, transaction meters must out-rank
    GB/Month even though GB/Month normally ranks higher."""
    items = [
        {"skuName": "Standard LRS", "retailPrice": 0.045, "unitOfMeasure": "1 GB/Month", "type": "Consumption"},
        {"skuName": "Standard LRS", "retailPrice": 0.00036, "unitOfMeasure": "10K", "type": "Consumption"},
    ]
    picked_no_usage = select_primary_meter(items, requested_sku="Standard LRS")
    assert picked_no_usage is not None
    assert picked_no_usage["unitOfMeasure"] == "1 GB/Month"  # default = GB-Month wins

    picked_with_usage = select_primary_meter(
        items, requested_sku="Standard LRS", usage={"transactions_per_month": 100_000}
    )
    assert picked_with_usage is not None
    assert picked_with_usage["unitOfMeasure"] == "10K"


def test_select_primary_picks_cheapest_in_matching_dimension_when_usage():
    """Key Vault Standard scenario: $0.03/10K Operations vs $0.15/10K
    Renewals. With usage supplied, the cheapest matching meter wins (typical
    baseline rate) rather than the most expensive."""
    items = [
        {"skuName": "Standard", "retailPrice": 0.15, "unitOfMeasure": "10K", "type": "Consumption"},
        {"skuName": "Standard", "retailPrice": 0.03, "unitOfMeasure": "10K", "type": "Consumption"},
    ]
    picked = select_primary_meter(items, requested_sku="Standard", usage={"transactions_per_month": 100_000})
    assert picked is not None
    assert picked["retailPrice"] == 0.03


def test_select_primary_without_usage_keeps_v53_descending_price_tiebreak():
    """Without usage, v5.3 behaviour preserved: surface the higher-priced
    meter to find the actual SKU rate over $0.0001 add-ons."""
    items = [
        {"skuName": "Standard", "retailPrice": 0.0001, "unitOfMeasure": "1 Second", "type": "Consumption"},
        {"skuName": "Standard", "retailPrice": 1.6666, "unitOfMeasure": "1/Day", "type": "Consumption"},
        {"skuName": "Standard", "retailPrice": 0.10, "unitOfMeasure": "1 GB/Month", "type": "Consumption"},
    ]
    picked = select_primary_meter(items, requested_sku="Standard")
    # Day dimension wins (0,0,1,...) and the only Day meter is the high-priced one.
    assert picked is not None
    assert picked["unitOfMeasure"] == "1/Day"
    assert picked["retailPrice"] == 1.6666
