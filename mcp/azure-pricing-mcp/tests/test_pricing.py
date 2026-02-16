"""Tests for PricingService._compute_monthly_cost and estimate_costs."""

import pytest

from azure_pricing_mcp.services.pricing import PricingService


class TestComputeMonthlyCost:
    """Unit tests for the static _compute_monthly_cost helper."""

    def test_hourly_unit(self):
        monthly, daily, yearly, model = PricingService._compute_monthly_cost(0.10, "1 Hour", 730, 1)
        assert model == "per-hour"
        assert monthly == pytest.approx(73.0)
        assert daily == pytest.approx(2.4)
        assert yearly == pytest.approx(876.0)

    def test_hourly_with_quantity(self):
        monthly, _, _, _ = PricingService._compute_monthly_cost(0.10, "1 Hour", 730, 3)
        assert monthly == pytest.approx(219.0)

    def test_gb_month_unit(self):
        monthly, daily, yearly, model = PricingService._compute_monthly_cost(0.018, "1 GB/Month", 730, 100)
        assert model == "per-GB"
        assert monthly == pytest.approx(1.8)
        assert yearly == pytest.approx(21.6)

    def test_per_month_unit(self):
        monthly, _, _, model = PricingService._compute_monthly_cost(10.0, "1/Month", 730, 2)
        assert model == "per-month"
        assert monthly == pytest.approx(20.0)

    def test_per_day_unit(self):
        monthly, daily, _, model = PricingService._compute_monthly_cost(1.0, "1/Day", 730, 1)
        assert model == "per-day"
        assert daily == pytest.approx(1.0)
        assert monthly == pytest.approx(30.44)

    def test_10k_transactions(self):
        monthly, _, _, model = PricingService._compute_monthly_cost(0.004, "10K Transactions", 730, 5)
        assert model == "per-10K-transactions"
        assert monthly == pytest.approx(0.02)

    def test_fallback_to_hourly(self):
        monthly, _, _, model = PricingService._compute_monthly_cost(0.05, "Unknown Unit", 730, 1)
        assert model == "per-hour"
        assert monthly == pytest.approx(36.5)
