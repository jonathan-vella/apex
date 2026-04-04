"""Databricks DBU pricing service for Azure Pricing MCP Server.

Provides tools for querying Azure Databricks Unit (DBU) pricing,
estimating costs for Databricks workloads, and comparing prices
across workload types and regions.

All pricing data is fetched in real-time from the Azure Retail Prices API
(https://prices.azure.com/api/retail/prices) with serviceName='Azure Databricks'.
"""

import logging
from typing import Any

from ..client import AzurePricingClient
from ..config import (
    DATABRICKS_SERVICE_NAME,
    DATABRICKS_WORKLOAD_ALIASES,
    DATABRICKS_WORKLOAD_MAPPINGS,
)

logger = logging.getLogger(__name__)


def _resolve_workload_type(workload_type: str) -> str | None:
    """Resolve user input to a canonical workload type key.

    Args:
        workload_type: User-provided workload type string.

    Returns:
        Canonical workload key from DATABRICKS_WORKLOAD_MAPPINGS, or None if not found.
    """
    normalized = workload_type.strip().lower()

    # Empty input
    if not normalized:
        return None

    # Direct match
    if normalized in DATABRICKS_WORKLOAD_MAPPINGS:
        return normalized

    # Alias match
    if normalized in DATABRICKS_WORKLOAD_ALIASES:
        return DATABRICKS_WORKLOAD_ALIASES[normalized]

    # Partial match - find keys that contain the input
    for key in DATABRICKS_WORKLOAD_MAPPINGS:
        if normalized in key or key in normalized:
            return key

    return None


class DatabricksService:
    """Service for Azure Databricks DBU pricing operations.

    Fetches real-time pricing from the Azure Retail Prices API.
    No auth required - uses the public pricing API.
    """

    def __init__(self, client: AzurePricingClient) -> None:
        self._client = client

    async def get_dbu_pricing(
        self,
        workload_type: str | None = None,
        tier: str | None = None,
        region: str = "eastus",
        currency_code: str = "USD",
    ) -> dict[str, Any]:
        """Get DBU pricing for Databricks workloads.

        Args:
            workload_type: Workload type filter (e.g., 'all-purpose', 'jobs', 'sql').
                          Supports fuzzy matching via aliases.
            tier: Pricing tier filter ('Premium' or 'Standard'). If None, returns both.
            region: Azure region (default: eastus).
            currency_code: Currency code (default: USD).

        Returns:
            Dict with workload pricing items grouped by workload category.
        """
        filter_conditions = [
            f"serviceName eq '{DATABRICKS_SERVICE_NAME}'",
            f"armRegionName eq '{region}'",
            "type eq 'Consumption'",
        ]

        # Filter by tier if specified
        if tier:
            tier_normalized = tier.strip().capitalize()
            if tier_normalized in ("Premium", "Standard"):
                filter_conditions.append(f"contains(skuName, '{tier_normalized}')")

        # Filter by workload type if specified
        resolved_workload = None
        sku_filters: list[str] = []
        if workload_type:
            resolved_workload = _resolve_workload_type(workload_type)
            if resolved_workload:
                sku_names = DATABRICKS_WORKLOAD_MAPPINGS[resolved_workload]
                for sku_name in sku_names:
                    sku_filters.append(f"contains(skuName, '{sku_name}')")

        # Build the OData filter
        if sku_filters:
            sku_filter_str = " or ".join(sku_filters)
            filter_conditions.append(f"({sku_filter_str})")

        result = await self._client.fetch_prices(
            filter_conditions=filter_conditions,
            currency_code=currency_code,
            limit=200,
        )

        items = result.get("Items", [])

        # Exclude free trial and POC non-billable SKUs
        items = [
            item
            for item in items
            if "Free Trial" not in item.get("skuName", "")
            and "POC Non-Billable" not in item.get("skuName", "")
            and item.get("retailPrice", 0) > 0
        ]

        # Group items by workload category
        grouped: dict[str, list[dict[str, Any]]] = {}
        for item in items:
            sku_name = item.get("skuName", "")
            # Determine tier
            item_tier = "Premium" if sku_name.startswith("Premium") else "Standard"
            # Strip tier prefix for display
            workload_label = sku_name.replace("Premium ", "").replace("Standard ", "")

            entry = {
                "workload": workload_label,
                "tier": item_tier,
                "sku_name": sku_name,
                "meter_name": item.get("meterName", ""),
                "dbu_rate": item.get("retailPrice", 0),
                "unit": item.get("unitOfMeasure", "1 Hour"),
                "region": item.get("location", ""),
                "arm_region": item.get("armRegionName", ""),
                "currency": item.get("currencyCode", "USD"),
                "effective_date": item.get("effectiveStartDate", ""),
            }

            if workload_label not in grouped:
                grouped[workload_label] = []
            grouped[workload_label].append(entry)

        return {
            "region": region,
            "tier_filter": tier,
            "workload_filter": workload_type,
            "resolved_workload": resolved_workload,
            "currency": currency_code,
            "workloads": grouped,
            "total_items": len(items),
            "available_workload_types": sorted(DATABRICKS_WORKLOAD_MAPPINGS.keys()),
        }

    async def estimate_dbu_cost(
        self,
        workload_type: str,
        dbu_count: float,
        hours_per_day: float = 8.0,
        days_per_month: int = 22,
        tier: str = "Premium",
        region: str = "eastus",
        currency_code: str = "USD",
        num_workers: int = 1,
        discount_percentage: float = 0.0,
    ) -> dict[str, Any]:
        """Estimate Databricks costs based on DBU consumption.

        Total cost = DBU_rate * dbu_count * num_workers * hours_per_day * days_per_month

        Args:
            workload_type: Type of workload (e.g., 'all-purpose', 'jobs').
            dbu_count: Number of DBUs per worker per hour (depends on VM instance type).
            hours_per_day: Hours of usage per day (default: 8).
            days_per_month: Working days per month (default: 22).
            tier: Pricing tier ('Premium' or 'Standard', default: Premium).
            region: Azure region (default: eastus).
            currency_code: Currency code (default: USD).
            num_workers: Number of worker nodes (default: 1).
            discount_percentage: Discount to apply (default: 0).

        Returns:
            Dict with cost breakdown and estimates.
        """
        resolved_workload = _resolve_workload_type(workload_type)
        if not resolved_workload:
            return {
                "error": "unknown_workload_type",
                "message": f"Unknown workload type: '{workload_type}'",
                "available_types": sorted(DATABRICKS_WORKLOAD_MAPPINGS.keys()),
                "help": "Use one of the available workload types listed above.",
            }

        # Fetch pricing for this workload type
        pricing = await self.get_dbu_pricing(
            workload_type=resolved_workload,
            tier=tier,
            region=region,
            currency_code=currency_code,
        )

        # Find the base (non-Photon) rate for the workload
        all_items = []
        for entries in pricing.get("workloads", {}).values():
            all_items.extend(entries)

        # Filter to matching tier
        tier_items = [item for item in all_items if item["tier"].lower() == tier.lower()]

        if not tier_items:
            return {
                "error": "no_pricing_found",
                "message": f"No {tier} tier pricing found for '{resolved_workload}' in {region}",
                "help": "Try a different region or tier.",
            }

        # Prefer the non-Photon variant as the base rate
        base_item = None
        for item in tier_items:
            if "Photon" not in item["workload"]:
                base_item = item
                break
        if not base_item:
            base_item = tier_items[0]

        dbu_rate = base_item["dbu_rate"]

        # Calculate costs
        total_hours = hours_per_day * days_per_month
        total_dbu_hours = dbu_count * num_workers * total_hours
        monthly_dbu_cost = dbu_rate * total_dbu_hours

        # Apply discount
        discount_amount = 0.0
        discounted_cost = monthly_dbu_cost
        if discount_percentage > 0:
            discount_amount = monthly_dbu_cost * (discount_percentage / 100)
            discounted_cost = monthly_dbu_cost - discount_amount

        # Check for Photon variant
        photon_item = None
        for item in tier_items:
            if "Photon" in item["workload"]:
                photon_item = item
                break

        photon_info = None
        if photon_item:
            photon_monthly = photon_item["dbu_rate"] * total_dbu_hours
            photon_info = {
                "dbu_rate": photon_item["dbu_rate"],
                "monthly_cost": round(photon_monthly, 2),
                "rate_difference": round(photon_item["dbu_rate"] - dbu_rate, 4),
            }

        return {
            "workload_type": resolved_workload,
            "tier": tier,
            "region": region,
            "currency": currency_code,
            "dbu_rate_per_hour": dbu_rate,
            "dbu_count_per_worker": dbu_count,
            "num_workers": num_workers,
            "hours_per_day": hours_per_day,
            "days_per_month": days_per_month,
            "total_hours": total_hours,
            "total_dbu_hours": round(total_dbu_hours, 2),
            "monthly_dbu_cost": round(monthly_dbu_cost, 2),
            "discount_percentage": discount_percentage,
            "discount_amount": round(discount_amount, 2),
            "discounted_monthly_cost": round(discounted_cost, 2),
            "annual_estimate": round(discounted_cost * 12, 2),
            "photon_pricing": photon_info,
            "note": "This estimate covers DBU costs only. VM compute, storage, and networking are billed separately.",
        }

    async def compare_workloads(
        self,
        workload_types: list[str] | None = None,
        regions: list[str] | None = None,
        tier: str = "Premium",
        currency_code: str = "USD",
        dbu_count: float | None = None,
        hours_per_month: float | None = None,
    ) -> dict[str, Any]:
        """Compare DBU pricing across workload types or regions.

        Either provide multiple workload_types (compared in a single region)
        or multiple regions (compared for a single workload type).

        Args:
            workload_types: List of workload types to compare.
            regions: List of regions to compare. Defaults to ['eastus'] if not provided.
            tier: Pricing tier (default: Premium).
            currency_code: Currency code (default: USD).
            dbu_count: Optional DBU count for monthly cost projection.
            hours_per_month: Optional hours/month for cost projection (default: 730).

        Returns:
            Dict with comparison data.
        """
        if not regions:
            regions = ["eastus"]

        if not workload_types:
            # Default to the most common workload types
            workload_types = ["all-purpose", "jobs", "jobs light", "serverless sql", "automated serverless"]

        comparison_rows: list[dict[str, Any]] = []

        for region in regions:
            for wt in workload_types:
                resolved = _resolve_workload_type(wt)
                if not resolved:
                    comparison_rows.append(
                        {
                            "workload_type": wt,
                            "region": region,
                            "tier": tier,
                            "error": f"Unknown workload type: '{wt}'",
                        }
                    )
                    continue

                pricing = await self.get_dbu_pricing(
                    workload_type=resolved,
                    tier=tier,
                    region=region,
                    currency_code=currency_code,
                )

                all_items = []
                for entries in pricing.get("workloads", {}).values():
                    all_items.extend(entries)

                tier_items = [item for item in all_items if item["tier"].lower() == tier.lower()]

                # Get the base (non-Photon) rate
                base_rate = None
                photon_rate = None
                for item in tier_items:
                    if "Photon" not in item["workload"]:
                        base_rate = item["dbu_rate"]
                    else:
                        photon_rate = item["dbu_rate"]

                if base_rate is None and tier_items:
                    base_rate = tier_items[0]["dbu_rate"]

                row: dict[str, Any] = {
                    "workload_type": resolved,
                    "region": region,
                    "tier": tier,
                    "dbu_rate": base_rate,
                    "photon_dbu_rate": photon_rate,
                    "currency": currency_code,
                }

                # Add cost projection if dbu_count provided
                if base_rate is not None and dbu_count is not None:
                    hrs = hours_per_month if hours_per_month else 730
                    row["monthly_cost"] = round(base_rate * dbu_count * hrs, 2)
                    row["dbu_count"] = dbu_count
                    row["hours_per_month"] = hrs

                comparison_rows.append(row)

        # Sort by dbu_rate (cheapest first), putting errors at the end
        valid_rows = [r for r in comparison_rows if "error" not in r and r.get("dbu_rate") is not None]
        error_rows = [r for r in comparison_rows if "error" in r or r.get("dbu_rate") is None]
        valid_rows.sort(key=lambda r: r.get("dbu_rate", float("inf")))

        # Calculate savings relative to most expensive
        if valid_rows:
            max_rate = max(r["dbu_rate"] for r in valid_rows)
            for row in valid_rows:
                if max_rate > 0:
                    row["savings_vs_most_expensive"] = round((1 - row["dbu_rate"] / max_rate) * 100, 1)

        return {
            "comparison": valid_rows + error_rows,
            "tier": tier,
            "currency": currency_code,
            "compared_by": "region" if len(regions) > 1 else "workload_type",
            "total_comparisons": len(comparison_rows),
            "note": "DBU rates shown per hour. VM compute costs are billed separately.",
        }
