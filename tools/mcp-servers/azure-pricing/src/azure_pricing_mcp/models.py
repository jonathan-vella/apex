"""Domain models and type definitions for Azure Pricing MCP Server."""

from dataclasses import dataclass
from enum import Enum
from typing import Any


class RetirementStatus(Enum):
    """VM series retirement status levels."""

    CURRENT = "current"  # Fully supported, not deprecated
    PREVIOUS_GEN = "previous_gen"  # Newer version available, still supported
    RETIREMENT_ANNOUNCED = "retirement_announced"  # Has planned retirement date
    RETIRED = "retired"  # No longer available


@dataclass
class VMSeriesRetirementInfo:
    """Information about a VM series retirement status."""

    series_name: str
    status: RetirementStatus
    retirement_date: str | None = None  # e.g., "November 15, 2028"
    replacement: str | None = None  # e.g., "Lsv3, Lasv3, or Lsv4"
    migration_guide_url: str | None = None


@dataclass
class PricingItem:
    """Represents a single pricing item from Azure API."""

    service_name: str
    product_name: str
    sku_name: str
    arm_region_name: str
    location: str
    retail_price: float
    unit_of_measure: str
    price_type: str
    savings_plan: list[dict[str, Any]] | None = None
    original_price: float | None = None

    @classmethod
    def from_api_response(cls, item: dict[str, Any]) -> "PricingItem":
        """Create PricingItem from API response dictionary."""
        return cls(
            service_name=item.get("serviceName", ""),
            product_name=item.get("productName", ""),
            sku_name=item.get("skuName", ""),
            arm_region_name=item.get("armRegionName", ""),
            location=item.get("location", ""),
            retail_price=item.get("retailPrice", 0),
            unit_of_measure=item.get("unitOfMeasure", ""),
            price_type=item.get("type", ""),
            savings_plan=item.get("savingsPlan"),
            original_price=item.get("originalPrice"),
        )


@dataclass
class SKUInfo:
    """Information about a specific SKU."""

    sku_name: str
    arm_sku_name: str | None
    product_name: str
    min_price: float
    sample_unit: str
    regions: list[str]


@dataclass
class RegionRecommendation:
    """Recommendation for a region with pricing info."""

    region: str
    location: str
    retail_price: float
    unit_of_measure: str
    savings_vs_most_expensive: float = 0.0
    spot_price: float | None = None
    original_price: float | None = None


@dataclass
class CostEstimate:
    """Cost estimate for a service."""

    hourly_rate: float
    daily_cost: float
    monthly_cost: float
    yearly_cost: float
    original_hourly_rate: float | None = None
    original_daily_cost: float | None = None
    original_monthly_cost: float | None = None
    original_yearly_cost: float | None = None


@dataclass
class SavingsPlanEstimate:
    """Savings plan cost estimate."""

    term: str
    hourly_rate: float
    monthly_cost: float
    yearly_cost: float
    savings_percent: float
    annual_savings: float
    original_hourly_rate: float | None = None
    original_monthly_cost: float | None = None
    original_yearly_cost: float | None = None


@dataclass
class RIComparison:
    """Reserved Instance comparison with On-Demand pricing."""

    sku: str
    region: str
    term: str
    ri_hourly: float
    od_hourly: float
    savings_percentage: float
    break_even_months: float | None
    annual_savings: float
