"""Bulk cost estimation service for Azure Pricing MCP Server.

Accepts a list of resource specifications and estimates costs for all of them
in a single tool call, returning a consolidated summary with per-resource
and total monthly/yearly costs.

Features:
- Service-name alias resolution via SERVICE_NAME_MAPPINGS
- Request deduplication (identical service/sku/region → sum quantities)
- Concurrent dispatch with configurable semaphore
- Per-item retry with exponential backoff
"""

import asyncio
import logging
from typing import Any

from ..config import SERVICE_NAME_MAPPINGS
from ..error_codes import ErrorCode
from .pricing import PricingService

logger = logging.getLogger(__name__)

BULK_CONCURRENCY_LIMIT = 5
BULK_ITEM_MAX_RETRIES = 2
BULK_RETRY_BASE_WAIT = 0.5  # seconds


def _resolve_service_alias(name: str) -> str:
    """Map user-friendly service names to official Azure names."""
    mapped = SERVICE_NAME_MAPPINGS.get(name.lower().strip())
    return mapped if mapped else name


def _dedup_key(res: dict[str, Any]) -> str:
    """Build a deduplication key from service_name + sku_name + region."""
    return f"{res.get('service_name', '')}|{res.get('sku_name', '')}|{res.get('region', '')}".lower()


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
        # --- Phase A: resolve service aliases ---
        for res in resources:
            if "service_name" in res and res["service_name"]:
                original = res["service_name"]
                resolved = _resolve_service_alias(original)
                if resolved != original:
                    res["_original_service_name"] = original
                    res["service_name"] = resolved

        # --- Phase B: deduplicate identical specs, summing quantities ---
        deduped: dict[str, dict[str, Any]] = {}
        original_indices: dict[str, list[int]] = {}
        for idx, res in enumerate(resources):
            key = _dedup_key(res)
            if key in deduped:
                deduped[key]["quantity"] = deduped[key].get("quantity", 1) + res.get("quantity", 1)
                original_indices[key].append(idx)
            else:
                deduped[key] = dict(res)
                deduped[key].setdefault("quantity", res.get("quantity", 1))
                original_indices[key] = [idx]

        deduped_list = list(deduped.values())
        index_map = list(original_indices.values())

        # --- Phase C: concurrent dispatch with semaphore ---
        sem = asyncio.Semaphore(BULK_CONCURRENCY_LIMIT)

        async def _estimate_one(
            res: dict[str, Any],
            indices: list[int],
        ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
            """Estimate a single resource with retry logic."""
            service_name = res.get("service_name", "")
            sku_name = res.get("sku_name", "")
            region = res.get("region", "")

            if not service_name or not sku_name or not region:
                return None, {
                    "indices": indices,
                    "code": ErrorCode.MISSING_REQUIRED_FIELD.value,
                    "error": "Missing required field(s): service_name, sku_name, region",
                    "input": res,
                }

            quantity = res.get("quantity", 1)
            hours_per_month = res.get("hours_per_month", 730)
            last_exc: Exception | None = None

            async with sem:
                for attempt in range(1, BULK_ITEM_MAX_RETRIES + 1):
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
                            return None, {
                                "indices": indices,
                                "code": ErrorCode.BULK_ITEM_FAILED.value,
                                "error": estimate.get("message", estimate.get("error", "Unknown error")),
                                "input": res,
                            }

                        monthly = estimate["on_demand_pricing"]["monthly_cost"]
                        yearly = estimate["on_demand_pricing"]["yearly_cost"]

                        return {
                            "indices": indices,
                            "service_name": estimate.get("service_name"),
                            "sku_name": estimate.get("sku_name"),
                            "region": region,
                            "product_name": estimate.get("product_name"),
                            "unit_of_measure": estimate.get("unit_of_measure"),
                            "pricing_model": estimate.get("pricing_model"),
                            "quantity": quantity,
                            "monthly_cost": monthly,
                            "yearly_cost": yearly,
                        }, None

                    except Exception as exc:
                        last_exc = exc
                        if attempt < BULK_ITEM_MAX_RETRIES:
                            wait = BULK_RETRY_BASE_WAIT * (2 ** (attempt - 1))
                            logger.warning(
                                "Bulk item %s attempt %d failed, retrying in %.1fs: %s",
                                indices, attempt, wait, exc,
                            )
                            await asyncio.sleep(wait)

                logger.warning(
                    "Bulk estimate failed for items %s after %d attempts: %s",
                    indices, BULK_ITEM_MAX_RETRIES, last_exc,
                )
                return None, {
                    "indices": indices,
                    "code": ErrorCode.BULK_ITEM_FAILED.value,
                    "error": str(last_exc),
                    "input": res,
                }

        tasks = [
            _estimate_one(res, idxs)
            for res, idxs in zip(deduped_list, index_map, strict=True)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # --- Phase D: aggregate ---
        line_items: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        total_monthly = 0.0
        total_yearly = 0.0

        for r in results:
            if isinstance(r, Exception):
                errors.append({
                    "indices": [],
                    "code": ErrorCode.INTERNAL_ERROR.value,
                    "error": str(r),
                })
                continue
            item, err = r
            if err:
                errors.append(err)
            elif item:
                total_monthly += item["monthly_cost"]
                total_yearly += item["yearly_cost"]
                line_items.append(item)

        return {
            "currency": currency_code,
            "resource_count": len(resources),
            "unique_specs": len(deduped_list),
            "successful": len(line_items),
            "failed": len(errors),
            "line_items": line_items,
            "errors": errors,
            "totals": {
                "monthly": round(total_monthly, 2),
                "yearly": round(total_yearly, 2),
            },
        }
