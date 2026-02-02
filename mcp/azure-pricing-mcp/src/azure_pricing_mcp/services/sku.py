"""SKU discovery service for Azure Pricing MCP Server."""

import logging
from typing import Any

from ..config import SERVICE_NAME_MAPPINGS
from .pricing import PricingService

logger = logging.getLogger(__name__)


class SKUService:
    """Service for SKU discovery and matching operations."""

    def __init__(self, pricing_service: PricingService) -> None:
        self._pricing_service = pricing_service

    async def discover_skus(
        self,
        service_name: str,
        region: str | None = None,
        price_type: str = "Consumption",
        limit: int = 100,
    ) -> dict[str, Any]:
        """Discover available SKUs for a specific Azure service."""
        filter_conditions = [f"serviceName eq '{service_name}'"]

        if region:
            filter_conditions.append(f"armRegionName eq '{region}'")

        if price_type:
            filter_conditions.append(f"priceType eq '{price_type}'")

        data = await self._pricing_service._client.fetch_prices(
            filter_conditions=filter_conditions,
            currency_code="USD",
            limit=limit,
        )

        skus: dict[str, dict[str, Any]] = {}
        items = data.get("Items", [])

        for item in items:
            sku_name = item.get("skuName")
            arm_sku_name = item.get("armSkuName")
            product_name = item.get("productName")
            item_region = item.get("armRegionName")
            price = item.get("retailPrice", 0)
            unit = item.get("unitOfMeasure")
            meter_name = item.get("meterName")

            if sku_name and sku_name not in skus:
                skus[sku_name] = {
                    "sku_name": sku_name,
                    "arm_sku_name": arm_sku_name,
                    "product_name": product_name,
                    "sample_price": price,
                    "unit_of_measure": unit,
                    "meter_name": meter_name,
                    "sample_region": item_region,
                    "available_regions": [item_region] if item_region else [],
                }
            elif sku_name and item_region and item_region not in skus[sku_name]["available_regions"]:
                skus[sku_name]["available_regions"].append(item_region)

        sku_list = list(skus.values())
        sku_list.sort(key=lambda x: x["sku_name"])

        return {
            "service_name": service_name,
            "skus": sku_list,
            "total_skus": len(sku_list),
            "price_type": price_type,
            "region_filter": region,
        }

    async def search_with_fuzzy_matching(
        self,
        service_name: str | None = None,
        service_family: str | None = None,
        region: str | None = None,
        sku_name: str | None = None,
        price_type: str | None = None,
        currency_code: str = "USD",
        limit: int = 50,
        suggest_alternatives: bool = True,
    ) -> dict[str, Any]:
        """Search Azure retail prices with fuzzy matching and suggestions."""
        exact_result = await self._pricing_service.search_prices(
            service_name=service_name,
            service_family=service_family,
            region=region,
            sku_name=sku_name,
            price_type=price_type,
            currency_code=currency_code,
            limit=limit,
        )

        if exact_result["items"]:
            return exact_result

        if suggest_alternatives and (service_name or service_family):
            return await self._find_similar_services(
                service_name=service_name,
                service_family=service_family,
                currency_code=currency_code,
                limit=limit,
            )

        return exact_result

    async def _find_similar_services(
        self,
        service_name: str | None = None,
        service_family: str | None = None,
        currency_code: str = "USD",
        limit: int = 50,
    ) -> dict[str, Any]:
        """Find services with similar names or suggest alternatives."""
        suggestions = []
        search_term = service_name.lower() if service_name else ""

        # Try exact mapping first
        if search_term in SERVICE_NAME_MAPPINGS:
            correct_name = SERVICE_NAME_MAPPINGS[search_term]
            result = await self._pricing_service.search_prices(
                service_name=correct_name,
                currency_code=currency_code,
                limit=limit,
            )

            if result["items"]:
                result["suggestion_used"] = correct_name
                result["original_search"] = service_name
                result["match_type"] = "exact_mapping"
                return result

        # Try partial matching
        partial_matches = []
        for user_term, azure_service in SERVICE_NAME_MAPPINGS.items():
            if search_term in user_term or user_term in search_term:
                partial_matches.append(azure_service)

        for azure_service in list(set(partial_matches)):
            result = await self._pricing_service.search_prices(
                service_name=azure_service,
                currency_code=currency_code,
                limit=5,
            )

            if result["items"]:
                suggestions.append(
                    {
                        "service_name": azure_service,
                        "match_reason": f"Partial match for '{service_name}'",
                        "sample_items": result["items"][:3],
                    }
                )

        # Broad search if no matches
        if not suggestions:
            broad_result = await self._pricing_service.search_prices(
                service_family=service_family,
                currency_code=currency_code,
                limit=100,
            )

            matching_services: set[str] = set()
            for item in broad_result.get("items", []):
                service = item.get("serviceName", "")
                product = item.get("productName", "")

                if (
                    search_term in service.lower()
                    or search_term in product.lower()
                    or any(word in service.lower() for word in search_term.split())
                ):
                    matching_services.add(service)

            for service in list(matching_services)[:5]:
                service_result = await self._pricing_service.search_prices(
                    service_name=service,
                    currency_code=currency_code,
                    limit=3,
                )

                if service_result["items"]:
                    suggestions.append(
                        {
                            "service_name": service,
                            "match_reason": f"Contains '{search_term}'",
                            "sample_items": service_result["items"][:2],
                        }
                    )

        return {
            "items": [],
            "count": 0,
            "has_more": False,
            "currency": currency_code,
            "original_search": service_name or service_family,
            "suggestions": suggestions,
            "match_type": "suggestions_only",
        }

    async def discover_service_skus(
        self,
        service_hint: str,
        region: str | None = None,
        currency_code: str = "USD",
        limit: int = 30,
    ) -> dict[str, Any]:
        """Discover SKUs for a service with intelligent service name matching."""
        result = await self.search_with_fuzzy_matching(
            service_name=service_hint,
            region=region,
            currency_code=currency_code,
            limit=limit,
        )

        if result["items"]:
            skus: dict[str, dict[str, Any]] = {}
            service_used = result.get("suggestion_used", service_hint)

            for item in result["items"]:
                sku_name = item.get("skuName", "Unknown")
                arm_sku = item.get("armSkuName", "Unknown")
                product = item.get("productName", "Unknown")
                price = item.get("retailPrice", 0)
                unit = item.get("unitOfMeasure", "Unknown")
                item_region = item.get("armRegionName", "Unknown")

                if sku_name not in skus:
                    skus[sku_name] = {
                        "sku_name": sku_name,
                        "arm_sku_name": arm_sku,
                        "product_name": product,
                        "prices": [],
                        "regions": set(),
                    }

                skus[sku_name]["prices"].append({"price": price, "unit": unit, "region": item_region})
                skus[sku_name]["regions"].add(item_region)

            for sku_data in skus.values():
                sku_data["regions"] = list(sku_data["regions"])

                if not sku_data["prices"]:
                    sku_data["min_price"] = 0
                    sku_data["sample_unit"] = "Unknown"
                else:
                    valid_prices = [p["price"] for p in sku_data["prices"] if p.get("price", 0) > 0]
                    if valid_prices:
                        sku_data["min_price"] = min(valid_prices)
                    else:
                        sku_data["min_price"] = sku_data["prices"][0].get("price", 0)
                    sku_data["sample_unit"] = sku_data["prices"][0].get("unit", "Unknown")

            return {
                "service_found": service_used,
                "original_search": service_hint,
                "skus": skus,
                "total_skus": len(skus),
                "currency": currency_code,
                "match_type": result.get("match_type", "exact"),
            }

        return {
            "service_found": None,
            "original_search": service_hint,
            "skus": {},
            "total_skus": 0,
            "currency": currency_code,
            "suggestions": result.get("suggestions", []),
            "match_type": "no_match",
        }
