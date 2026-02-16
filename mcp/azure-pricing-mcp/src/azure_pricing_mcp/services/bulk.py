"""Bulk cost estimation service for Azure Pricing MCP Server.

Accepts a list of resource specifications and estimates costs for all of them
in a single tool call, returning a consolidated summary with per-resource
and total monthly/yearly costs.
"""

import logging
from typing import Any

from .pricing import PricingService

logger = logging.getLogger(__name__)


class BulkEstimateService:
    """Estimate costs for multiple Azure resources in one call."""

    def __init__(self, pricing_service: PricingService) -> None:
        self._pricing = pricing_service

    async def bulk_estimate(
        self,
        resources: list[dict[str, Any]],
        currency_code: str = "USD",
        discount_percentage: float | None = None,
    ) -> dict[str, Any]:
        """Estimate costs for a list of resources.

        Each entry in *resources* must contain:
            service_name, sku_name, region
        Optional keys:
            quantity (default 1), hours_per_month (default 730)
        """
        line_items: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        total_monthly = 0.0
        total_yearly = 0.0

        for idx, res in enumerate(resources):
            service_name = res.get("service_name", "")
            sku_name = res.get("sku_name", "")
            region = res.get("region", "")

            if not service_name or not sku_name or not region:
                errors.append({"index": idx, "error": "Missing required field(s): service_name, sku_name, region", "input": res})
                continue

            quantity = res.get("quantity", 1)
            hours_per_month = res.get("hours_per_month", 730)

            try:
                estimate = await self._pricing.estimate_costs(
                    service_name=service_name,
                    sku_name=sku_name,
                    region=region,
                    hours_per_month=hours_per_month,
                    currency_code=currency_code,
                    discount_percentage=discount_percentage,
                    quantity=quantity,
                )

                if "error" in estimate:
                    errors.append({"index": idx, "error": estimate["error"], "input": res})
                    continue

                monthly = estimate["on_demand_pricing"]["monthly_cost"]
                yearly = estimate["on_demand_pricing"]["yearly_cost"]
                total_monthly += monthly
                total_yearly += yearly

                line_items.append({
                    "index": idx,
                    "service_name": estimate.get("service_name"),
                    "sku_name": estimate.get("sku_name"),
                    "region": region,
                    "product_name": estimate.get("product_name"),
                    "unit_of_measure": estimate.get("unit_of_measure"),
                    "pricing_model": estimate.get("pricing_model"),
                    "quantity": quantity,
                    "monthly_cost": monthly,
                    "yearly_cost": yearly,
                })
            except Exception as exc:
                logger.warning("Bulk estimate failed for item %d: %s", idx, exc)
                errors.append({"index": idx, "error": str(exc), "input": res})

        return {
            "currency": currency_code,
            "resource_count": len(resources),
            "successful": len(line_items),
            "failed": len(errors),
            "line_items": line_items,
            "errors": errors,
            "totals": {
                "monthly": round(total_monthly, 2),
                "yearly": round(total_yearly, 2),
            },
        }
