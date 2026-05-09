"""Pricing service for Azure Pricing MCP Server."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from ..client import AzurePricingClient
from ..config import DEFAULT_CUSTOMER_DISCOUNT, NEGATIVE_CACHE_TTL, REQUEST_DEDUP_TTL, SERVICE_NAME_MAPPINGS
from .retirement import RetirementService

logger = logging.getLogger(__name__)


def normalize_sku_name(sku_name: str) -> tuple[list[str], str]:
    """Normalize SKU name to handle different formats and generate search variants.

    Returns:
        Tuple of (search_terms, display_name)
    """
    if not sku_name:
        return ([], "")

    original = sku_name.strip()
    normalized = original

    prefixes_to_remove = ["Standard_", "Basic_", "standard_", "basic_"]
    for prefix in prefixes_to_remove:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix) :]
            break

    display_name = normalized.replace("_", " ")

    search_terms = []

    underscore_variant = normalized.replace(" ", "_")
    if underscore_variant not in search_terms:
        search_terms.append(underscore_variant)

    space_variant = normalized.replace("_", " ")
    if space_variant not in search_terms:
        search_terms.append(space_variant)

    if normalized not in search_terms:
        search_terms.append(normalized)

    return (search_terms, display_name)


# v5.3 — Suffix words that users append to service names but that the Azure
# Retail Prices API does NOT include in its canonical ``serviceName`` field.
# Stripping these turns "Storage Account" into "Storage" before alias lookup.
_SERVICE_NAME_SUFFIXES = (" account", " accounts", " service", " services")


def _resolve_service_name(name: str) -> str:
    """Resolve a free-form service name to the canonical Azure ``serviceName``.

    Pipeline:
    1. Strip common user-facing suffixes ("Account", "Service", …).
    2. Lowercase + alias-table lookup.
    3. Title-case fallback for inputs that already match the canonical form.

    Examples (verified against the Azure Retail Prices API):
    >>> _resolve_service_name("Storage Account")
    'Storage'
    >>> _resolve_service_name("Container Registry")
    'Container Registry'
    >>> _resolve_service_name("Azure DNS")
    'Azure DNS'  # (callers should also try "Virtual Network" — Private DNS Zone
                  # meters actually live there. See `_FALLBACK_SERVICE_NAMES`.)
    """
    candidate = name.strip()
    if not candidate:
        return name

    lowered = candidate.lower()

    # Strip user-facing suffixes once, then re-check the alias table.
    for suffix in _SERVICE_NAME_SUFFIXES:
        if lowered.endswith(suffix) and len(lowered) > len(suffix):
            stripped = lowered[: -len(suffix)].rstrip()
            if stripped in SERVICE_NAME_MAPPINGS:
                return SERVICE_NAME_MAPPINGS[stripped]
            # Direct match against the canonical-form table.
            if stripped in {v.lower() for v in SERVICE_NAME_MAPPINGS.values()}:
                # Reverse-look-up the canonical case.
                for v in SERVICE_NAME_MAPPINGS.values():
                    if v.lower() == stripped:
                        return v

    # Direct alias hit.
    if lowered in SERVICE_NAME_MAPPINGS:
        return SERVICE_NAME_MAPPINGS[lowered]

    # No alias — return the original (caller may have passed the canonical name).
    return candidate


# v5.3 — When a SKU is not found under the resolved service name, fall back
# to these alternatives. Driven by empirical retail-prices API observations:
# ``Private DNS Zone`` and ``Private Endpoint`` meters live under
# ``Virtual Network``, not ``Azure DNS`` / ``Private Link``.
_FALLBACK_SERVICE_NAMES: dict[str, tuple[str, ...]] = {
    "Azure DNS": ("Virtual Network",),  # Private DNS Zone meter
    "Private Link": ("Virtual Network",),  # Private Endpoint meter
    "Private Endpoint": ("Virtual Network",),
}


# v5.3 — Suffix words that users append to SKU names but that the Azure
# Retail Prices API doesn't carry in its ``skuName`` field. Stripping these
# turns "Standard LRS GPv2" → "Standard LRS" before the contains() filter.
_SKU_SUFFIXES_TO_STRIP = (
    " GPv2",  # Storage account performance tier — lives in productName, not skuName
    " GPv1",
    " v2",  # generic
)


def _normalize_sku_for_search(sku_name: str) -> str:
    """Strip variant suffixes that the Retail Prices API doesn't carry in its
    ``skuName`` field but that users naturally include when describing a SKU.
    """
    if not sku_name:
        return sku_name
    cleaned = sku_name
    for suffix in _SKU_SUFFIXES_TO_STRIP:
        if cleaned.lower().endswith(suffix.lower()):
            cleaned = cleaned[: -len(suffix)].rstrip()
            break
    return cleaned


# v5.3 — Static-fallback prices for SKUs that the public Azure Retail Prices
# API does NOT expose. These are typically flat-fee small-charge meters
# (Private DNS Zone, Private Endpoint, NAT Gateway base hour) that Microsoft
# documents on its pricing pages but does not surface through the API.
#
# Sourced from learn.microsoft.com pricing pages, current as of 2026-05.
# Each entry maps ``(canonical_service_name, sku_substring)`` → price dict.
# Match is case-insensitive ``in`` test against ``service_name`` and ``sku_name``.
_STATIC_FALLBACK_PRICES: list[dict[str, Any]] = [
    {
        "service_match": "Azure DNS",
        "sku_match": "Private DNS Zone",
        "service_name": "Azure DNS",
        "sku_name": "Private DNS Zone",
        "product_name": "Azure DNS — Private DNS Zone (static fallback)",
        "monthly_cost": 0.50,  # First 25 zones / month, billed per zone
        "unit_of_measure": "1 Zone/Month",
        "source": "learn.microsoft.com — azure DNS pricing page (2026-05)",
        "note": "Public Retail Prices API does not surface this meter. Flat $0.50/zone/month; included free for first 25 zones across the subscription.",
    },
    {
        "service_match": "Virtual Network",
        "sku_match": "Private Endpoint",
        "service_name": "Virtual Network",
        "sku_name": "Private Endpoint Standard",
        "product_name": "Private Link — Standard Endpoint (static fallback)",
        "monthly_cost": 7.20,  # Microsoft's flat per-PE rate (matches public pricing page)
        "unit_of_measure": "1 Endpoint/Month",
        "source": "learn.microsoft.com — private link pricing page (2026-05)",
        "note": "Public Retail Prices API does not surface this meter. Flat $7.20/endpoint/month + data processing; baseline assumes no data processing.",
    },
    # v5.4 — known zero-cost services. Without these, the meter selector
    # picks an unrelated meter (e.g. "Virtual Network Standard" matched
    # "Public IP Prefix Standard" at $0.006/hr → bogus $4.38/mo).
    {
        "service_match": "Virtual Network",
        "sku_match": "Standard",
        # Match must NOT be too broad — Private Endpoint Standard is also
        # under "Virtual Network" service. The lookup function checks rules
        # in declared order, so the more-specific Private Endpoint entry
        # above wins for that case.
        "service_name": "Virtual Network",
        "sku_name": "Standard",
        "product_name": "Virtual Network (no base charge)",
        "monthly_cost": 0.0,
        "unit_of_measure": "n/a",
        "source": "learn.microsoft.com — virtual network pricing page (2026-05)",
        "note": "Virtual Networks have no per-VNet base charge. Egress, peering, NAT Gateway, and VPN Gateway cost extra and must be priced separately.",
    },
    {
        "service_match": "Resource Group",
        "sku_match": "",  # any SKU
        "service_name": "Resource Group",
        "sku_name": "n/a",
        "product_name": "Resource Group (no charge)",
        "monthly_cost": 0.0,
        "unit_of_measure": "n/a",
        "source": "learn.microsoft.com — Azure resource model (2026-05)",
        "note": "Resource Groups are organisational containers and have no cost.",
    },
    {
        "service_match": "Managed Identity",
        "sku_match": "",
        "service_name": "Managed Identity",
        "sku_name": "n/a",
        "product_name": "Managed Identity (no charge)",
        "monthly_cost": 0.0,
        "unit_of_measure": "n/a",
        "source": "learn.microsoft.com — managed identity pricing (2026-05)",
        "note": "Managed Identities themselves are free; only the resources they authenticate to incur cost.",
    },
]


def _lookup_static_fallback(service_name: str, sku_name: str) -> dict[str, Any] | None:
    """Return a static fallback meter or None when no rule matches.

    Rules with an empty ``sku_match`` apply to any SKU under the matching
    service (used for "no-charge" services like Resource Group). The list is
    iterated in declared order; more-specific rules (longer ``sku_match``)
    should appear before more-general ones.
    """
    if not service_name:
        return None
    svc_lower = service_name.lower()
    sku_lower = (sku_name or "").lower()
    for entry in _STATIC_FALLBACK_PRICES:
        if entry["service_match"].lower() not in svc_lower:
            continue
        sku_match = entry["sku_match"].lower()
        if sku_match and sku_match not in sku_lower:
            continue
        return entry
    return None


class PricingService:
    """Service for Azure pricing operations."""

    def __init__(self, client: AzurePricingClient, retirement_service: RetirementService) -> None:
        self._client = client
        self._retirement_service = retirement_service
        self._request_cache: dict[str, tuple[dict[str, Any], datetime]] = {}
        # Phase 3.9: in-flight request coalescing. When N concurrent agent
        # calls hit the same (filter, currency, limit) key, share one
        # asyncio.Future so only one HTTP request is in flight.
        self._inflight: dict[str, asyncio.Future[dict[str, Any]]] = {}

    async def _fetch_prices_cached(
        self,
        filter_conditions: list[str] | None = None,
        currency_code: str = "USD",
        limit: int | None = None,
    ) -> dict[str, Any]:
        """Fetch prices with request-level deduplication + in-flight coalescing.

        Cache layers (Phase 3 hardening):
        1. Completed-result cache (TTL: ``REQUEST_DEDUP_TTL`` for hits,
           ``NEGATIVE_CACHE_TTL`` for empty results — Phase 3.11).
        2. In-flight ``asyncio.Future`` map so concurrent callers with the
           same key share one HTTP round-trip (Phase 3.9).
        """
        cache_key = json.dumps({"f": filter_conditions, "c": currency_code, "l": limit}, sort_keys=True)
        now = datetime.now()

        # Layer 1: completed-result cache with negative-result short TTL.
        if cache_key in self._request_cache:
            cached_result, cached_time = self._request_cache[cache_key]
            age = (now - cached_time).total_seconds()
            is_empty = not cached_result.get("Items")
            ttl = NEGATIVE_CACHE_TTL if is_empty else REQUEST_DEDUP_TTL
            if age < ttl:
                return cached_result

        # Layer 2: in-flight coalescing.
        if cache_key in self._inflight:
            return await self._inflight[cache_key]

        loop = asyncio.get_running_loop()
        future: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._inflight[cache_key] = future
        try:
            result = await self._client.fetch_prices(filter_conditions, currency_code, limit)
            self._request_cache[cache_key] = (result, datetime.now())
            future.set_result(result)
        except Exception as exc:
            future.set_exception(exc)
            raise
        finally:
            # Pop only after the future has been set/raised; concurrent
            # awaiters resolved via ``await self._inflight[cache_key]`` above.
            self._inflight.pop(cache_key, None)

        # Lazy eviction when cache exceeds configured capacity. Keeps hot
        # paths fast; only pays cost on overflow.
        from ..config import REQUEST_DEDUP_MAX_ENTRIES

        if len(self._request_cache) > REQUEST_DEDUP_MAX_ENTRIES:
            cutoff = datetime.now()
            self._request_cache = {
                k: v for k, v in self._request_cache.items() if (cutoff - v[1]).total_seconds() < REQUEST_DEDUP_TTL
            }
        return result

    async def search_prices(
        self,
        service_name: str | None = None,
        service_family: str | None = None,
        region: str | None = None,
        sku_name: str | None = None,
        price_type: str | None = None,
        currency_code: str = "USD",
        limit: int = 50,
        discount_percentage: float | None = None,
        validate_sku: bool = True,
    ) -> dict[str, Any]:
        """Search Azure retail prices with various filters."""
        # v5.3 — Resolve user-friendly names to canonical Azure service names.
        # The Retail Prices API requires the exact ``serviceName`` string;
        # common user inputs like ``"Storage Account"`` need to map to the
        # canonical ``"Storage"`` and ``"Azure DNS"`` Private DNS Zone meters
        # actually live under ``"Virtual Network"``.
        if service_name:
            service_name = _resolve_service_name(service_name)

        filter_conditions = []

        if service_name:
            filter_conditions.append(f"serviceName eq '{service_name}'")
        if service_family:
            filter_conditions.append(f"serviceFamily eq '{service_family}'")
        if region:
            filter_conditions.append(f"armRegionName eq '{region}'")
        if sku_name:
            filter_conditions.append(f"contains(skuName, '{sku_name}')")
        if price_type:
            filter_conditions.append(f"priceType eq '{price_type}'")

        data = await self._client.fetch_prices(
            filter_conditions=filter_conditions,
            currency_code=currency_code,
            limit=limit,
        )

        items = data.get("Items", [])

        if len(items) > limit:
            items = items[:limit]

        # SKU validation and clarification
        validation_info: dict[str, Any] = {}
        if validate_sku and sku_name and not items:
            validation_info = await self._validate_and_suggest_skus(service_name, sku_name, currency_code)
        elif validate_sku and sku_name and isinstance(items, list) and len(items) > 10:
            validation_info["clarification"] = {
                "message": f"Found {len(items)} SKUs matching '{sku_name}'. Consider being more specific.",
                "suggestions": [item.get("skuName") for item in items[:5] if item and item.get("skuName")],
            }

        # Apply discount
        if discount_percentage is not None and discount_percentage > 0 and isinstance(items, list):
            items = self._apply_discount_to_items(items, discount_percentage)

        # Check retirement status for VM SKUs
        retirement_warnings = []
        if items and service_name and "virtual machine" in service_name.lower():
            retirement_warnings = await self._retirement_service.check_skus_retirement_status(items)

        result: dict[str, Any] = {
            "items": items,
            "count": len(items) if isinstance(items, list) else 0,
            "has_more": bool(data.get("NextPageLink")),
            "currency": currency_code,
            "filters_applied": filter_conditions,
        }

        if retirement_warnings:
            result["retirement_warnings"] = retirement_warnings

        if discount_percentage is not None and discount_percentage > 0:
            result["discount_applied"] = {"percentage": discount_percentage, "note": "Prices shown are after discount"}

        if validation_info:
            result.update(validation_info)

        return result

    async def _validate_and_suggest_skus(
        self, service_name: str | None, sku_name: str, currency_code: str = "USD"
    ) -> dict[str, Any]:
        """Validate SKU name and suggest alternatives if not found."""
        suggestions = []

        if service_name:
            broad_search = await self.search_prices(
                service_name=service_name,
                currency_code=currency_code,
                limit=100,
                validate_sku=False,
            )

            sku_lower = sku_name.lower()
            items = broad_search.get("items", [])
            if items:
                for item in items:
                    item_sku = item.get("skuName")
                    if not item_sku:
                        continue
                    item_sku_lower = item_sku.lower()
                    if (
                        sku_lower in item_sku_lower
                        or item_sku_lower in sku_lower
                        or any(word in item_sku_lower for word in sku_lower.split() if word)
                    ):
                        suggestions.append(
                            {
                                "sku_name": item_sku,
                                "product_name": item.get("productName", "Unknown"),
                                "price": item.get("retailPrice", 0),
                                "unit": item.get("unitOfMeasure", "Unknown"),
                                "region": item.get("armRegionName", "Unknown"),
                            }
                        )

        seen_skus: set[str] = set()
        unique_suggestions = []
        for suggestion in suggestions:
            sku = suggestion["sku_name"]
            if sku not in seen_skus:
                seen_skus.add(sku)
                unique_suggestions.append(suggestion)
                if len(unique_suggestions) >= 5:
                    break

        return {
            "sku_validation": {
                "original_sku": sku_name,
                "found": False,
                "message": f"SKU '{sku_name}' not found" + (f" in service '{service_name}'" if service_name else ""),
                "suggestions": unique_suggestions,
            }
        }

    def _apply_discount_to_items(self, items: list[dict], discount_percentage: float) -> list[dict]:
        """Apply discount percentage to pricing items."""
        if not items:
            return []

        discounted_items = []

        for item in items:
            discounted_item = item.copy()

            if "retailPrice" in item and item["retailPrice"]:
                original_price = item["retailPrice"]
                discounted_price = original_price * (1 - discount_percentage / 100)
                discounted_item["retailPrice"] = round(discounted_price, 6)
                discounted_item["originalPrice"] = original_price

            if "savingsPlan" in item and item["savingsPlan"] and isinstance(item["savingsPlan"], list):
                discounted_savings = []
                for plan in item["savingsPlan"]:
                    discounted_plan = plan.copy()
                    if "retailPrice" in plan and plan["retailPrice"]:
                        original_plan_price = plan["retailPrice"]
                        discounted_plan_price = original_plan_price * (1 - discount_percentage / 100)
                        discounted_plan["retailPrice"] = round(discounted_plan_price, 6)
                        discounted_plan["originalPrice"] = original_plan_price
                    discounted_savings.append(discounted_plan)
                discounted_item["savingsPlan"] = discounted_savings

            discounted_items.append(discounted_item)

        return discounted_items

    async def compare_prices(
        self,
        service_name: str,
        sku_name: str | None = None,
        regions: list[str] | None = None,
        currency_code: str = "USD",
        discount_percentage: float | None = None,
    ) -> dict[str, Any]:
        """Compare prices across different regions or SKUs."""
        comparisons = []

        if regions and isinstance(regions, list):
            for region in regions:
                try:
                    result = await self.search_prices(
                        service_name=service_name,
                        sku_name=sku_name,
                        region=region,
                        currency_code=currency_code,
                        limit=10,
                    )

                    if result["items"]:
                        item = result["items"][0]
                        comparisons.append(
                            {
                                "region": region,
                                "sku_name": item.get("skuName"),
                                "retail_price": item.get("retailPrice"),
                                "unit_of_measure": item.get("unitOfMeasure"),
                                "product_name": item.get("productName"),
                                "meter_name": item.get("meterName"),
                            }
                        )
                except Exception as e:
                    logger.warning(f"Failed to get prices for region {region}: {e}")
        else:
            result = await self.search_prices(
                service_name=service_name,
                currency_code=currency_code,
                limit=20,
            )

            sku_prices: dict[str, dict[str, Any]] = {}
            items = result.get("items", [])
            for item in items:
                sku = item.get("skuName")
                if sku and sku not in sku_prices:
                    sku_prices[sku] = {
                        "sku_name": sku,
                        "retail_price": item.get("retailPrice"),
                        "unit_of_measure": item.get("unitOfMeasure"),
                        "product_name": item.get("productName"),
                        "region": item.get("armRegionName"),
                        "meter_name": item.get("meterName"),
                    }

            comparisons = list(sku_prices.values())

        if discount_percentage is not None and discount_percentage > 0:
            for comparison in comparisons:
                if "retail_price" in comparison and comparison["retail_price"]:
                    original_price = comparison["retail_price"]
                    discounted_price = original_price * (1 - discount_percentage / 100)
                    comparison["retail_price"] = round(discounted_price, 6)
                    comparison["original_price"] = original_price

        comparisons.sort(key=lambda x: x.get("retail_price", 0))

        result_data: dict[str, Any] = {
            "comparisons": comparisons,
            "service_name": service_name,
            "currency": currency_code,
            "comparison_type": "regions" if regions else "skus",
        }

        if discount_percentage is not None and discount_percentage > 0:
            result_data["discount_applied"] = {
                "percentage": discount_percentage,
                "note": "Prices shown are after discount",
            }

        return result_data

    async def recommend_regions(
        self,
        service_name: str,
        sku_name: str,
        top_n: int = 10,
        currency_code: str = "USD",
        discount_percentage: float | None = None,
    ) -> dict[str, Any]:
        """Recommend the cheapest Azure regions for a given service and SKU."""
        search_terms, display_sku = normalize_sku_name(sku_name)

        discovery_result: dict[str, Any] = {"items": []}

        for search_term in search_terms:
            discovery_result = await self.search_prices(
                service_name=service_name,
                sku_name=search_term,
                currency_code=currency_code,
                limit=500,
                validate_sku=False,
            )
            if discovery_result.get("items"):
                break

        if not discovery_result["items"]:
            return {
                "error": f"No pricing found for {display_sku} in service {service_name}",
                "service_name": service_name,
                "sku_name": display_sku,
                "sku_input": sku_name,
                "search_terms_tried": search_terms,
                "recommendations": [],
            }

        region_data: dict[str, dict[str, Any]] = {}
        spot_data: dict[str, dict[str, Any]] = {}

        for item in discovery_result["items"]:
            region = item.get("armRegionName")
            price = item.get("retailPrice", 0)
            location = item.get("location", region)
            sku_name_item = item.get("skuName", "")
            meter_name = item.get("meterName", "")

            is_spot = "Spot" in sku_name_item or "Spot" in meter_name
            is_low_priority = "Low Priority" in sku_name_item or "Low Priority" in meter_name

            if region and price and price > 0:
                item_data = {
                    "region": region,
                    "location": location,
                    "retail_price": price,
                    "sku_name": item.get("skuName"),
                    "product_name": item.get("productName"),
                    "unit_of_measure": item.get("unitOfMeasure"),
                    "meter_name": item.get("meterName"),
                }

                if is_spot or is_low_priority:
                    pricing_type = "Spot" if is_spot else "Low Priority"
                    if region not in spot_data or price < spot_data[region]["retail_price"]:
                        spot_data[region] = {**item_data, "pricing_type": pricing_type}
                else:
                    if region not in region_data or price < region_data[region]["retail_price"]:
                        region_data[region] = {**item_data, "pricing_type": "On-Demand"}

        for region, on_demand in region_data.items():
            if region in spot_data:
                spot = spot_data[region]
                on_demand["spot_price"] = spot["retail_price"]
                on_demand["spot_sku_name"] = spot["sku_name"]

        if not region_data:
            return {
                "error": f"No regions with valid pricing found for {display_sku}",
                "service_name": service_name,
                "sku_name": display_sku,
                "sku_input": sku_name,
                "recommendations": [],
            }

        recommendations = list(region_data.values())

        if discount_percentage is not None and discount_percentage > 0:
            for rec in recommendations:
                original_price = rec["retail_price"]
                discounted_price = original_price * (1 - discount_percentage / 100)
                rec["original_price"] = original_price
                rec["retail_price"] = round(discounted_price, 6)

        recommendations.sort(key=lambda x: x.get("retail_price", float("inf")))

        if recommendations:
            max_price = max(r.get("retail_price", 0) for r in recommendations)

            for rec in recommendations:
                price = rec.get("retail_price", 0)
                if max_price > 0:
                    savings_vs_max = ((max_price - price) / max_price) * 100
                    rec["savings_vs_most_expensive"] = round(savings_vs_max, 2)
                else:
                    rec["savings_vs_most_expensive"] = 0.0

        top_recommendations = recommendations[:top_n]

        result: dict[str, Any] = {
            "service_name": service_name,
            "sku_name": display_sku,
            "sku_input": sku_name,
            "currency": currency_code,
            "total_regions_found": len(recommendations),
            "showing_top": min(top_n, len(recommendations)),
            "recommendations": top_recommendations,
        }

        if recommendations:
            result["summary"] = {
                "cheapest_region": recommendations[0]["region"],
                "cheapest_location": recommendations[0]["location"],
                "cheapest_price": recommendations[0]["retail_price"],
                "most_expensive_region": recommendations[-1]["region"],
                "most_expensive_location": recommendations[-1]["location"],
                "most_expensive_price": recommendations[-1]["retail_price"],
                "max_savings_percentage": recommendations[0].get("savings_vs_most_expensive", 0),
            }

        if discount_percentage is not None and discount_percentage > 0:
            result["discount_applied"] = {
                "percentage": discount_percentage,
                "note": "Prices shown are after discount",
            }

        return result

    async def estimate_costs(
        self,
        service_name: str,
        sku_name: str,
        region: str = "",
        hours_per_month: float = 730,
        currency_code: str = "USD",
        discount_percentage: float | None = None,
        usage: dict[str, float] | None = None,
        product_filter: str | None = None,
    ) -> dict[str, Any]:
        """Estimate monthly costs based on usage.

        v5.4 — accepts an optional ``usage`` dict that lets callers supply
        workload estimates so non-time-based meters can be projected:

        * ``transactions_per_month`` → applied to per-10K/1M transaction meters
          (e.g. Key Vault Standard ops, Storage Tables write ops).
        * ``gb_stored`` → applied to per-GB/month storage-retention meters.
        * ``gb_transferred`` → applied to per-GB egress meters.
        * ``seconds_runtime`` → applied to per-second meters.

        Usage is applied to the **primary** meter selected by
        ``select_primary_meter``. For multi-product services like Storage
        Account that have separate meters per product (Tables, Blobs, Files,
        Queues), use ``product_filter`` to narrow the search to a single
        product, or model each product as a separate ``bulk_estimate`` line
        item with its own ``usage`` dict.

        v5.3 — unit-aware projection. The Azure Retail Prices API frequently
        returns multiple meters per SKU (e.g., ACR Premium has 7: GB/Month,
        1/Day, 1 Second, …). Picks the most likely primary billing meter
        (Hour > Day > Month > GB-Month > …) and projects to monthly using
        the meter's actual dimension.
        """
        from ..meter_units import (
            MeterDimension,
            project_monthly_cost,
            select_primary_meter,
        )

        # v5.3 — strip user-facing SKU suffixes that the API doesn't carry
        # ("Standard LRS GPv2" → "Standard LRS"). The "GPv2" distinction
        # is in productName, not skuName.
        original_sku = sku_name
        sku_name = _normalize_sku_for_search(sku_name)

        # v5.4 — Static-fallback check FIRST (not last). Known zero-cost
        # services (Virtual Network base, Resource Group, Managed Identity)
        # and un-API'd flat-fee meters (Private DNS Zone, Private Endpoint)
        # use the static table. Without this, the meter selector picks an
        # unrelated meter (e.g. "Virtual Network Standard" matched
        # "Public IP Prefix Standard" at $0.006/hr → bogus $4.38/mo).
        fallback = _lookup_static_fallback(service_name, original_sku)
        if fallback is not None:
            return {
                "service_name": fallback["service_name"],
                "sku_name": fallback["sku_name"],
                "region": region,
                "product_name": fallback["product_name"],
                "unit_of_measure": fallback["unit_of_measure"],
                "meter_dimension": "static_fallback",
                "currency": currency_code,
                "on_demand_pricing": {
                    "hourly_rate": round(fallback["monthly_cost"] / hours_per_month, 6) if hours_per_month else 0.0,
                    "daily_cost": round(fallback["monthly_cost"] / 30.4375, 2),
                    "monthly_cost": fallback["monthly_cost"],
                    "yearly_cost": fallback["monthly_cost"] * 12,
                },
                "usage_assumptions": {
                    "hours_per_month": hours_per_month,
                    "hours_per_day": round(hours_per_month / 30.44, 2),
                },
                "savings_plans": [],
                "available_meters": [],
                "projection_warning": (f"Static fallback used: {fallback['note']} (source: {fallback['source']})"),
            }

        # Fetch up to 50 candidate meters so we can heuristically pick the
        # right one (v5.0 only fetched 5 — too few to find the daily flat-fee
        # meter for ACR Premium when GB/Month meters take the top slots).
        result = await self.search_prices(
            service_name=service_name,
            sku_name=sku_name,
            region=region or None,
            currency_code=currency_code,
            limit=50,
            validate_sku=False,  # We're projecting, not validating SKU spelling.
        )

        # v5.3 — fall back to alternate canonical service names when the
        # primary one returns nothing (e.g. Private DNS Zone meters live under
        # ``Virtual Network`` rather than ``Azure DNS``).
        if not result["items"]:
            resolved = _resolve_service_name(service_name)
            for alt in _FALLBACK_SERVICE_NAMES.get(resolved, ()):
                alt_result = await self.search_prices(
                    service_name=alt,
                    sku_name=sku_name,
                    region=region or None,
                    currency_code=currency_code,
                    limit=50,
                    validate_sku=False,
                )
                if alt_result["items"]:
                    result = alt_result
                    break

        if not result["items"]:
            return {
                "error": f"No pricing found for {sku_name} in {region}",
                "service_name": service_name,
                "sku_name": sku_name,
                "region": region,
            }

        # Filter out RI/Reservation/SavingsPlan/DevTest meters so we don't
        # accidentally return a 1-year reservation rate when the caller wanted
        # consumption pricing.
        consumption = [it for it in result["items"] if (it.get("type") or "").lower() == "consumption"] or result[
            "items"
        ]

        # v5.4 — narrow to a specific productName when the caller supplied
        # ``product_filter``. Useful for multi-product services like Storage
        # Account where the API returns Tables/Blob/Queue/Files meters
        # under the same skuName and the agent wants only one.
        if product_filter:
            pf_lower = product_filter.lower()
            filtered = [it for it in consumption if pf_lower in (it.get("productName") or "").lower()]
            if filtered:
                consumption = filtered

        item = select_primary_meter(consumption, requested_sku=sku_name, usage=usage)
        if item is None:
            return {
                "error": f"No consumption meter found for {sku_name} in {region}",
                "service_name": service_name,
                "sku_name": sku_name,
                "region": region,
            }

        rate = float(item.get("retailPrice", 0) or 0)
        original_rate = rate
        if discount_percentage is not None and discount_percentage > 0:
            rate = rate * (1 - discount_percentage / 100)
            # We need to project against the *discounted* rate, so swap the
            # retailPrice on the item temporarily for the projection.
            projection_item = {**item, "retailPrice": rate}
        else:
            projection_item = item

        monthly_cost, unit, warning = project_monthly_cost(
            projection_item, hours_per_month=hours_per_month, usage=usage
        )
        # daily_cost / yearly_cost are still rate-based for back-compat with
        # v5.x consumers that read ``hourly_rate`` directly.
        if unit.dimension == MeterDimension.HOUR:
            hourly_rate = rate / unit.quantity
        elif unit.dimension == MeterDimension.DAY:
            # Surface an effective hourly rate so existing callers can sanity-check.
            hourly_rate = rate / (unit.quantity * 24)
        else:
            hourly_rate = 0.0  # Don't fabricate one for non-time meters.
        daily_cost = hourly_rate * 24 if unit.is_time_based else 0.0
        yearly_cost = monthly_cost * 12

        # All available meters in compact form — lets the cost-estimate-subagent
        # see why the primary was picked and flag mismatches.
        all_meters = [
            {
                "sku_name": it.get("skuName"),
                "product_name": it.get("productName"),
                "retail_price": it.get("retailPrice"),
                "unit_of_measure": it.get("unitOfMeasure"),
                "type": it.get("type"),
            }
            for it in consumption[:10]
        ]

        savings_plans = item.get("savingsPlan", []) or []
        savings_estimates = []
        for plan in savings_plans:
            plan_hourly = plan.get("retailPrice", 0)
            original_plan_hourly = plan_hourly

            if discount_percentage is not None and discount_percentage > 0:
                plan_hourly = plan_hourly * (1 - discount_percentage / 100)

            plan_monthly = plan_hourly * hours_per_month
            plan_yearly = plan_monthly * 12
            savings_percent = ((hourly_rate - plan_hourly) / hourly_rate) * 100 if hourly_rate > 0 else 0

            plan_data: dict[str, Any] = {
                "term": plan.get("term"),
                "hourly_rate": round(plan_hourly, 6),
                "monthly_cost": round(plan_monthly, 2),
                "yearly_cost": round(plan_yearly, 2),
                "savings_percent": round(savings_percent, 2),
                "annual_savings": round((yearly_cost - plan_yearly), 2),
            }

            if discount_percentage is not None and discount_percentage > 0:
                plan_data["original_hourly_rate"] = original_plan_hourly
                plan_data["original_monthly_cost"] = round(original_plan_hourly * hours_per_month, 2)
                plan_data["original_yearly_cost"] = round(original_plan_hourly * hours_per_month * 12, 2)

            savings_estimates.append(plan_data)

        estimate_result: dict[str, Any] = {
            "service_name": service_name,
            "sku_name": item.get("skuName"),
            "region": region,
            "product_name": item.get("productName"),
            "unit_of_measure": item.get("unitOfMeasure"),
            "meter_dimension": unit.dimension.value,
            "currency": currency_code,
            "on_demand_pricing": {
                "hourly_rate": round(hourly_rate, 6),
                "daily_cost": round(daily_cost, 2),
                "monthly_cost": round(monthly_cost, 2),
                "yearly_cost": round(yearly_cost, 2),
            },
            "usage_assumptions": {
                "hours_per_month": hours_per_month,
                "hours_per_day": round(hours_per_month / 30.44, 2),
            },
            "savings_plans": savings_estimates,
            "available_meters": all_meters,
        }

        if usage:
            estimate_result["usage_assumptions"]["usage"] = usage

        if warning:
            estimate_result["projection_warning"] = warning
        if discount_percentage is not None and discount_percentage > 0:
            estimate_result["discount_applied"] = {
                "percentage": discount_percentage,
                "note": "All prices shown are after discount",
            }
            estimate_result["on_demand_pricing"]["original_hourly_rate"] = original_rate
            estimate_result["on_demand_pricing"]["original_daily_cost"] = round(original_rate * 24, 2)
            estimate_result["on_demand_pricing"]["original_monthly_cost"] = round(original_rate * hours_per_month, 2)
            estimate_result["on_demand_pricing"]["original_yearly_cost"] = round(
                original_rate * hours_per_month * 12, 2
            )

        return estimate_result

    async def get_ri_pricing(
        self,
        service_name: str | None = None,
        sku_name: str | None = None,
        region: str | None = None,
        reservation_term: str | None = None,
        currency_code: str = "USD",
        compare_on_demand: bool = True,
        limit: int = 50,
    ) -> dict[str, Any]:
        """Get Reserved Instance pricing and optionally compare with On-Demand."""
        ri_filter = ["priceType eq 'Reservation'"]
        if service_name:
            ri_filter.append(f"serviceName eq '{service_name}'")
        if region:
            ri_filter.append(f"armRegionName eq '{region}'")
        if sku_name:
            ri_filter.append(f"contains(skuName, '{sku_name}')")

        ri_data = await self._client.fetch_prices(
            filter_conditions=ri_filter,
            currency_code=currency_code,
            limit=limit,
        )
        ri_items = ri_data.get("Items", [])

        if reservation_term:
            ri_items = [item for item in ri_items if item.get("reservationTerm") == reservation_term]

        result: dict[str, Any] = {
            "ri_items": ri_items,
            "currency": currency_code,
            "count": len(ri_items),
        }

        if compare_on_demand and ri_items:
            od_filter = ["priceType eq 'Consumption'"]
            if service_name:
                od_filter.append(f"serviceName eq '{service_name}'")
            if region:
                od_filter.append(f"armRegionName eq '{region}'")
            if sku_name:
                od_filter.append(f"contains(skuName, '{sku_name}')")

            od_data = await self._client.fetch_prices(
                filter_conditions=od_filter,
                currency_code=currency_code,
                limit=limit * 2,
            )
            od_items = od_data.get("Items", [])

            comparison = self._calculate_ri_savings(ri_items, od_items)
            result["comparison"] = comparison

        return result

    def _calculate_ri_savings(self, ri_items: list[dict], od_items: list[dict]) -> list[dict]:
        """Calculate savings and break-even for RI vs On-Demand."""
        comparison_results = []

        od_map = {}
        for item in od_items:
            key = (item.get("skuName"), item.get("armRegionName"))
            od_map[key] = item

        for ri in ri_items:
            key = (ri.get("skuName"), ri.get("armRegionName"))
            od = od_map.get(key)

            if od:
                ri_price = ri.get("retailPrice", 0)
                od_price = od.get("retailPrice", 0)
                term = ri.get("reservationTerm", "")

                if od_price > 0:
                    hours_in_term = 8760 if "1 Year" in term else (26280 if "3 Year" in term else 0)

                    if hours_in_term > 0 and ri_price > od_price:
                        ri_hourly = ri_price / hours_in_term
                        total_ri_cost = ri_price
                    else:
                        ri_hourly = ri_price / hours_in_term if hours_in_term > 0 else ri_price
                        total_ri_cost = ri_price

                    savings_percent = ((od_price - ri_hourly) / od_price) * 100

                    break_even_months = 0.0
                    if total_ri_cost > 0:
                        monthly_od_cost = od_price * 730
                        if monthly_od_cost > 0:
                            break_even_months = total_ri_cost / monthly_od_cost

                    comparison_results.append(
                        {
                            "sku": ri.get("skuName"),
                            "region": ri.get("armRegionName"),
                            "term": term,
                            "ri_hourly": round(ri_hourly, 5),
                            "od_hourly": od_price,
                            "savings_percentage": round(savings_percent, 2),
                            "break_even_months": round(break_even_months, 1) if break_even_months else None,
                            "annual_savings": round((od_price - ri_hourly) * 8760, 2),
                        }
                    )

        return comparison_results

    async def get_customer_discount(self, customer_id: str | None = None) -> dict[str, Any]:
        """Get customer discount information."""
        return {
            "customer_id": customer_id or "default",
            "discount_percentage": DEFAULT_CUSTOMER_DISCOUNT,
            "discount_type": "standard",
            "description": "Standard customer discount",
            "valid_until": None,
            "applicable_services": "all",
            "note": "This is a default discount applied to all customers. Contact sales for enterprise discounts.",
        }
