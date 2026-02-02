#!/usr/bin/env python3
"""
Azure Pricing MCP Server

A Model Context Protocol server that provides tools for querying Azure retail pricing.
"""

import asyncio
import hashlib
import json
import logging
import sys
from typing import Any

import aiohttp
from cachetools import TTLCache
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool

# Configure logging - redirect to stderr to avoid corrupting JSON-RPC on stdout
# For stdio transport, all logging MUST go to stderr, not stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("azure_pricing_mcp")

# Azure Retail Prices API configuration
AZURE_PRICING_BASE_URL = "https://prices.azure.com/api/retail/prices"
DEFAULT_API_VERSION = "2023-01-01-preview"
MAX_RESULTS_PER_REQUEST = 1000

# Retry and rate limiting configuration
MAX_RETRIES = 3
RATE_LIMIT_RETRY_BASE_WAIT = 5  # seconds
DEFAULT_CUSTOMER_DISCOUNT = 0.0  # percent (disabled by default)

# Common service name mappings for fuzzy search
# Maps user-friendly terms to official Azure service names
SERVICE_NAME_MAPPINGS = {
    # User input -> Correct Azure service name
    "app service": "Azure App Service",
    "web app": "Azure App Service",
    "web apps": "Azure App Service",
    "app services": "Azure App Service",
    "websites": "Azure App Service",
    "web service": "Azure App Service",
    "virtual machine": "Virtual Machines",
    "vm": "Virtual Machines",
    "vms": "Virtual Machines",
    "compute": "Virtual Machines",
    "storage": "Storage",
    "blob": "Storage",
    "blob storage": "Storage",
    "file storage": "Storage",
    "disk": "Storage",
    "sql": "Azure SQL Database",
    "sql database": "Azure SQL Database",
    "database": "Azure SQL Database",
    "sql server": "Azure SQL Database",
    "cosmos": "Azure Cosmos DB",
    "cosmosdb": "Azure Cosmos DB",
    "cosmos db": "Azure Cosmos DB",
    "document db": "Azure Cosmos DB",
    "kubernetes": "Azure Kubernetes Service",
    "aks": "Azure Kubernetes Service",
    "k8s": "Azure Kubernetes Service",
    "container service": "Azure Kubernetes Service",
    "functions": "Azure Functions",
    "function app": "Azure Functions",
    "serverless": "Azure Functions",
    "redis": "Azure Cache for Redis",
    "cache": "Azure Cache for Redis",
    "ai": "Azure AI services",
    "cognitive": "Azure AI services",
    "cognitive services": "Azure AI services",
    "openai": "Azure OpenAI",
    "networking": "Virtual Network",
    "network": "Virtual Network",
    "vnet": "Virtual Network",
    "load balancer": "Load Balancer",
    "lb": "Load Balancer",
    "application gateway": "Application Gateway",
    "app gateway": "Application Gateway",
}


def normalize_sku_name(sku_name: str) -> tuple[list[str], str]:
    """
    Normalize SKU name to handle different formats and generate search variants.

    Azure API uses different formats across VM generations:
    - v3, v4: "D4s v3", "D4s v4" (space format)
    - v5, v6: "Standard_D4s_v5" (ARM format with prefix)

    This function generates multiple search terms to ensure we find the SKU
    regardless of input format.

    Handles input formats like:
    - "D4s v5" -> searches: ["D4s v5", "D4s_v5"]
    - "Standard_D4s_v5" -> searches: ["D4s_v5", "D4s v5"]
    - "D4s_v5" -> searches: ["D4s_v5", "D4s v5"]
    - "D4s" -> searches: ["D4s"]

    Returns:
        Tuple of (search_terms, display_name):
        - search_terms: List of search terms to try (in order of priority)
        - display_name: Human-readable format (e.g., "D4s v5")
    """
    if not sku_name:
        return ([], "")

    original = sku_name.strip()
    normalized = original

    # Remove "Standard_" or "Basic_" prefix if present (ARM format)
    prefixes_to_remove = ["Standard_", "Basic_", "standard_", "basic_"]
    for prefix in prefixes_to_remove:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
            break

    # Create display name with spaces
    display_name = normalized.replace("_", " ")

    # Generate search term variants
    search_terms = []

    # Variant 1: Underscore format (for v5, v6 SKUs like "Standard_D4s_v5")
    underscore_variant = normalized.replace(" ", "_")
    if underscore_variant not in search_terms:
        search_terms.append(underscore_variant)

    # Variant 2: Space format (for v3, v4 SKUs like "D4s v3")
    space_variant = normalized.replace("_", " ")
    if space_variant not in search_terms:
        search_terms.append(space_variant)

    # Variant 3: Original normalized (no prefix) - might be useful
    if normalized not in search_terms:
        search_terms.append(normalized)

    return (search_terms, display_name)


class AzurePricingServer:
    """Azure Pricing MCP Server implementation with singleton session and caching."""

    _session: aiohttp.ClientSession | None = None
    _session_lock: asyncio.Lock | None = None
    # Cache responses for 1 hour (3600 seconds), max 100 entries
    _cache: TTLCache = TTLCache(maxsize=100, ttl=3600)

    def __init__(self):
        if AzurePricingServer._session_lock is None:
            AzurePricingServer._session_lock = asyncio.Lock()

    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create singleton HTTP session with connection pooling."""
        if AzurePricingServer._session is None or AzurePricingServer._session.closed:
            async with AzurePricingServer._session_lock:
                if AzurePricingServer._session is None or AzurePricingServer._session.closed:
                    # Configure timeout and connection pool
                    timeout = aiohttp.ClientTimeout(total=30, connect=10)
                    connector = aiohttp.TCPConnector(
                        limit=10, limit_per_host=5)
                    AzurePricingServer._session = aiohttp.ClientSession(
                        timeout=timeout,
                        connector=connector
                    )
        return AzurePricingServer._session

    async def __aenter__(self):
        """Async context manager entry - session is managed as singleton."""
        await self.get_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - keep session alive for reuse."""
        # Don't close session - it's a singleton for reuse across calls
        pass

    @staticmethod
    async def close_session():
        """Explicitly close the singleton session (for cleanup)."""
        if AzurePricingServer._session and not AzurePricingServer._session.closed:
            await AzurePricingServer._session.close()
            AzurePricingServer._session = None

    def _cache_key(self, url: str, params: dict[str, Any] | None) -> str:
        """Generate cache key from URL and parameters."""
        params_str = json.dumps(params or {}, sort_keys=True)
        return hashlib.md5(f"{url}{params_str}".encode()).hexdigest()

    async def _make_request(
        self, url: str, params: dict[str, Any] | None = None, max_retries: int = MAX_RETRIES
    ) -> dict[str, Any]:
        """Make HTTP request to Azure Pricing API with caching and retry logic."""
        # Check cache first
        cache_key = self._cache_key(url, params)
        if cache_key in AzurePricingServer._cache:
            logger.debug(f"Cache hit for {url}")
            return AzurePricingServer._cache[cache_key]

        session = await self.get_session()
        last_exception = None

        for attempt in range(max_retries + 1):  # 0, 1, 2, 3 (4 total attempts)
            try:
                async with session.get(url, params=params) as response:
                    if response.status == 429:  # Too Many Requests
                        if attempt < max_retries:
                            wait_time = RATE_LIMIT_RETRY_BASE_WAIT * \
                                (attempt + 1)  # 5, 10, 15 seconds
                            logger.warning(
                                f"Rate limited (429). Retrying in {wait_time} seconds... (attempt {attempt + 1}/{max_retries + 1})"
                            )
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            # Last attempt failed, raise the error
                            response.raise_for_status()

                    response.raise_for_status()
                    json_data: dict[str, Any] = await response.json()

                    # Cache successful response
                    AzurePricingServer._cache[cache_key] = json_data
                    return json_data

            except aiohttp.ClientResponseError as e:
                if e.status == 429 and attempt < max_retries:
                    wait_time = RATE_LIMIT_RETRY_BASE_WAIT * (attempt + 1)
                    logger.warning(
                        f"Rate limited (429). Retrying in {wait_time} seconds... (attempt {attempt + 1}/{max_retries + 1})"
                    )
                    await asyncio.sleep(wait_time)
                    last_exception = e
                    continue
                else:
                    logger.error(f"HTTP request failed: {e}")
                    raise
            except aiohttp.ClientError as e:
                logger.error(f"HTTP request failed: {e}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error during request: {e}")
                raise

        # If we get here, all retries failed
        if last_exception:
            raise last_exception
        raise RuntimeError("Request failed without exception")

    async def search_azure_prices(
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
        """Search Azure retail prices with various filters, SKU validation, and discount support."""

        # Build filter conditions
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

        # Construct query parameters
        params = {"api-version": DEFAULT_API_VERSION,
                  "currencyCode": currency_code}

        if filter_conditions:
            params["$filter"] = " and ".join(filter_conditions)

        # Limit results
        if limit < MAX_RESULTS_PER_REQUEST:
            params["$top"] = str(limit)

        # Make request
        data = await self._make_request(AZURE_PRICING_BASE_URL, params)

        # Process results
        items = data.get("Items", [])

        # If we have more results than requested, truncate
        if len(items) > limit:
            items = items[:limit]

        # SKU validation and clarification
        validation_info = {}
        if validate_sku and sku_name and not items:
            validation_info = await self._validate_and_suggest_skus(service_name, sku_name, currency_code)
        elif validate_sku and sku_name and isinstance(items, list) and len(items) > 10:
            # Too many results - provide clarification
            validation_info["clarification"] = {
                "message": f"Found {len(items)} SKUs matching '{sku_name}'. Consider being more specific.",
                "suggestions": [item.get("skuName") for item in items[:5] if item and item.get("skuName")],
            }

        # Apply discount if provided
        if discount_percentage is not None and discount_percentage > 0 and isinstance(items, list):
            items = self._apply_discount_to_items(items, discount_percentage)

        result = {
            "items": items,
            "count": len(items) if isinstance(items, list) else 0,
            "has_more": bool(data.get("NextPageLink")),
            "currency": currency_code,
            "filters_applied": filter_conditions,
        }

        # Add discount info if applied
        if discount_percentage is not None and discount_percentage > 0:
            result["discount_applied"] = {
                "percentage": discount_percentage, "note": "Prices shown are after discount"}

        # Add validation info if available
        if validation_info:
            result.update(validation_info)

        return result

    async def _validate_and_suggest_skus(
        self, service_name: str | None, sku_name: str, currency_code: str = "USD"
    ) -> dict[str, Any]:
        """Validate SKU name and suggest alternatives if not found."""

        # Try to find similar SKUs
        suggestions = []

        if service_name:
            # Search for SKUs within the service
            broad_search = await self.search_azure_prices(
                # Avoid recursion
                service_name=service_name, currency_code=currency_code, limit=100, validate_sku=False
            )

            # Find SKUs that partially match
            sku_lower = sku_name.lower()
            items = broad_search.get("items", [])
            if items:  # Only process if items exist
                for item in items:
                    item_sku = item.get("skuName")
                    if not item_sku:  # Skip items without SKU names
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

        # Remove duplicates and limit suggestions
        seen_skus = set()
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

            # Apply discount to retail price
            if "retailPrice" in item and item["retailPrice"]:
                original_price = item["retailPrice"]
                discounted_price = original_price * \
                    (1 - discount_percentage / 100)
                discounted_item["retailPrice"] = round(discounted_price, 6)
                discounted_item["originalPrice"] = original_price

            # Apply discount to savings plans if present
            if "savingsPlan" in item and item["savingsPlan"] and isinstance(item["savingsPlan"], list):
                discounted_savings = []
                for plan in item["savingsPlan"]:
                    discounted_plan = plan.copy()
                    if "retailPrice" in plan and plan["retailPrice"]:
                        original_plan_price = plan["retailPrice"]
                        discounted_plan_price = original_plan_price * \
                            (1 - discount_percentage / 100)
                        discounted_plan["retailPrice"] = round(
                            discounted_plan_price, 6)
                        discounted_plan["originalPrice"] = original_plan_price
                    discounted_savings.append(discounted_plan)
                discounted_item["savingsPlan"] = discounted_savings

            discounted_items.append(discounted_item)

        return discounted_items

    async def get_customer_discount(self, customer_id: str | None = None) -> dict[str, Any]:
        """Get customer discount information. Currently returns 10% default discount for all customers."""

        # For now, return a default discount for all customers
        # In the future, this could be enhanced to query a customer database

        return {
            "customer_id": customer_id or "default",
            "discount_percentage": DEFAULT_CUSTOMER_DISCOUNT,
            "discount_type": "standard",
            "description": "Standard customer discount",
            "valid_until": None,  # No expiration for standard discount
            "applicable_services": "all",  # Applies to all Azure services
            "note": "This is a default discount applied to all customers. Contact sales for enterprise discounts.",
        }

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
            # Compare across regions
            for region in regions:
                try:
                    result = await self.search_azure_prices(
                        service_name=service_name,
                        sku_name=sku_name,
                        region=region,
                        currency_code=currency_code,
                        limit=10,
                    )

                    if result["items"]:
                        # Get the first item for comparison
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
                    logger.warning(
                        f"Failed to get prices for region {region}: {e}")
        else:
            # Compare different SKUs within the same service
            result = await self.search_azure_prices(service_name=service_name, currency_code=currency_code, limit=20)

            # Group by SKU
            sku_prices = {}
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

        # Apply discount if provided
        if discount_percentage is not None and discount_percentage > 0:
            for comparison in comparisons:
                if "retail_price" in comparison and comparison["retail_price"]:
                    original_price = comparison["retail_price"]
                    discounted_price = original_price * \
                        (1 - discount_percentage / 100)
                    comparison["retail_price"] = round(discounted_price, 6)
                    comparison["original_price"] = original_price

        # Sort by price
        comparisons.sort(key=lambda x: x.get("retail_price", 0))

        result = {
            "comparisons": comparisons,
            "service_name": service_name,
            "currency": currency_code,
            "comparison_type": "regions" if regions else "skus",
        }

        # Add discount info if applied
        if discount_percentage is not None and discount_percentage > 0:
            result["discount_applied"] = {
                "percentage": discount_percentage, "note": "Prices shown are after discount"}

        return result

    async def recommend_regions(
        self,
        service_name: str,
        sku_name: str,
        top_n: int = 10,
        currency_code: str = "USD",
        discount_percentage: float | None = None,
    ) -> dict[str, Any]:
        """
        Recommend the cheapest Azure regions for a given service and SKU.

        Dynamically discovers all available regions, fetches pricing in parallel batches,
        and returns ranked recommendations sorted by price.

        Args:
            service_name: Azure service name (e.g., 'Virtual Machines')
            sku_name: SKU name to price across regions. Supports multiple formats:
                      - "D4s v5" (display format)
                      - "Standard_D4s_v5" (ARM format)
                      - "D4s_v5" (underscore format)
            top_n: Number of top recommendations to return (default: 10)
            currency_code: Currency for pricing (default: USD)
            discount_percentage: Optional discount to apply to all prices

        Returns:
            Dict with ranked region recommendations and pricing details
        """
        # Normalize the SKU name to handle different input formats
        # Returns list of search variants and a display name
        search_terms, display_sku = normalize_sku_name(sku_name)

        # Step 1: Discover all regions where this SKU is available
        # Try each search term variant until we get results
        discovery_result: dict[str, Any] = {"items": []}

        for search_term in search_terms:
            discovery_result = await self.search_azure_prices(
                service_name=service_name,
                sku_name=search_term,
                currency_code=currency_code,
                limit=500,  # Get many results to discover regions
                validate_sku=False,  # Skip validation for discovery
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

        # Extract unique regions with non-zero prices
        # Track both On-Demand and Spot pricing separately per region
        region_data: dict[str, dict[str, Any]] = {}
        # Track Spot pricing separately
        spot_data: dict[str, dict[str, Any]] = {}

        for item in discovery_result["items"]:
            region = item.get("armRegionName")
            price = item.get("retailPrice", 0)
            location = item.get("location", region)
            sku_name_item = item.get("skuName", "")
            meter_name = item.get("meterName", "")

            # Determine pricing type from SKU/meter name
            is_spot = "Spot" in sku_name_item or "Spot" in meter_name
            is_low_priority = "Low Priority" in sku_name_item or "Low Priority" in meter_name

            # Filter out items with $0 prices (preview/unavailable)
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
                    # Track Spot/Low Priority pricing separately
                    pricing_type = "Spot" if is_spot else "Low Priority"
                    if region not in spot_data or price < spot_data[region]["retail_price"]:
                        spot_data[region] = {**item_data,
                                             "pricing_type": pricing_type}
                else:
                    # On-Demand pricing
                    if region not in region_data or price < region_data[region]["retail_price"]:
                        region_data[region] = {
                            **item_data, "pricing_type": "On-Demand"}

        # Merge Spot pricing info into On-Demand entries
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

        # Step 2: If we need more detailed pricing, fetch in parallel batches
        # For now, we already have pricing from discovery - use it directly
        recommendations = list(region_data.values())

        # Step 3: Apply discount if provided
        if discount_percentage is not None and discount_percentage > 0:
            for rec in recommendations:
                original_price = rec["retail_price"]
                discounted_price = original_price * \
                    (1 - discount_percentage / 100)
                rec["original_price"] = original_price
                rec["retail_price"] = round(discounted_price, 6)

        # Step 4: Sort by price (cheapest first)
        recommendations.sort(key=lambda x: x.get("retail_price", float("inf")))

        # Step 5: Calculate savings vs most expensive region
        if recommendations:
            max_price = max(r.get("retail_price", 0) for r in recommendations)

            for rec in recommendations:
                price = rec.get("retail_price", 0)
                if max_price > 0:
                    savings_vs_max = ((max_price - price) / max_price) * 100
                    rec["savings_vs_most_expensive"] = round(savings_vs_max, 2)
                else:
                    rec["savings_vs_most_expensive"] = 0.0

        # Step 6: Limit to top N recommendations
        top_recommendations = recommendations[:top_n]

        # Build result
        result: dict[str, Any] = {
            "service_name": service_name,
            "sku_name": display_sku,
            "sku_input": sku_name,  # Original input for transparency
            "currency": currency_code,
            "total_regions_found": len(recommendations),
            "showing_top": min(top_n, len(recommendations)),
            "recommendations": top_recommendations,
        }

        # Add summary statistics
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

        # Add discount info if applied
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
        region: str,
        hours_per_month: float = 730,  # Default to full month
        currency_code: str = "USD",
        discount_percentage: float | None = None,
    ) -> dict[str, Any]:
        """Estimate monthly costs based on usage."""

        # Get pricing information
        result = await self.search_azure_prices(
            service_name=service_name, sku_name=sku_name, region=region, currency_code=currency_code, limit=5
        )

        if not result["items"]:
            return {
                "error": f"No pricing found for {sku_name} in {region}",
                "service_name": service_name,
                "sku_name": sku_name,
                "region": region,
            }

        item = result["items"][0]
        hourly_rate = item.get("retailPrice", 0)

        # Apply discount if provided
        if discount_percentage is not None and discount_percentage > 0:
            original_hourly_rate = hourly_rate
            hourly_rate = hourly_rate * (1 - discount_percentage / 100)

        # Calculate estimates
        monthly_cost = hourly_rate * hours_per_month
        daily_cost = hourly_rate * 24
        yearly_cost = monthly_cost * 12

        # Check for savings plans
        savings_plans = item.get("savingsPlan", [])
        savings_estimates = []

        for plan in savings_plans:
            plan_hourly = plan.get("retailPrice", 0)

            # Apply discount to savings plan prices too
            if discount_percentage is not None and discount_percentage > 0:
                original_plan_hourly = plan_hourly
                plan_hourly = plan_hourly * (1 - discount_percentage / 100)

            plan_monthly = plan_hourly * hours_per_month
            plan_yearly = plan_monthly * 12
            savings_percent = ((hourly_rate - plan_hourly) /
                               hourly_rate) * 100 if hourly_rate > 0 else 0

            plan_data = {
                "term": plan.get("term"),
                "hourly_rate": round(plan_hourly, 6),
                "monthly_cost": round(plan_monthly, 2),
                "yearly_cost": round(plan_yearly, 2),
                "savings_percent": round(savings_percent, 2),
                "annual_savings": round((yearly_cost - plan_yearly), 2),
            }

            # Add original prices if discount was applied
            if discount_percentage is not None and discount_percentage > 0:
                plan_data["original_hourly_rate"] = original_plan_hourly
                plan_data["original_monthly_cost"] = round(
                    original_plan_hourly * hours_per_month, 2)
                plan_data["original_yearly_cost"] = round(
                    original_plan_hourly * hours_per_month * 12, 2)

            savings_estimates.append(plan_data)

        result = {
            "service_name": service_name,
            "sku_name": item.get("skuName"),
            "region": region,
            "product_name": item.get("productName"),
            "unit_of_measure": item.get("unitOfMeasure"),
            "currency": currency_code,
            "on_demand_pricing": {
                "hourly_rate": round(hourly_rate, 6),
                "daily_cost": round(daily_cost, 2),
                "monthly_cost": round(monthly_cost, 2),
                "yearly_cost": round(yearly_cost, 2),
            },
            "usage_assumptions": {
                "hours_per_month": hours_per_month,
                # Average days per month
                "hours_per_day": round(hours_per_month / 30.44, 2),
            },
            "savings_plans": savings_estimates,
        }

        # Add discount info and original prices if discount was applied
        if discount_percentage is not None and discount_percentage > 0:
            result["discount_applied"] = {
                "percentage": discount_percentage,
                "note": "All prices shown are after discount",
            }
            result["on_demand_pricing"]["original_hourly_rate"] = original_hourly_rate
            result["on_demand_pricing"]["original_daily_cost"] = round(
                original_hourly_rate * 24, 2)
            result["on_demand_pricing"]["original_monthly_cost"] = round(
                original_hourly_rate * hours_per_month, 2)
            result["on_demand_pricing"]["original_yearly_cost"] = round(
                original_hourly_rate * hours_per_month * 12, 2)

        return result

    async def discover_skus(
        self, service_name: str, region: str | None = None, price_type: str = "Consumption", limit: int = 100
    ) -> dict[str, Any]:
        """Discover available SKUs for a specific Azure service."""

        # Build filter conditions
        filter_conditions = [f"serviceName eq '{service_name}'"]

        if region:
            filter_conditions.append(f"armRegionName eq '{region}'")

        if price_type:
            filter_conditions.append(f"priceType eq '{price_type}'")

        # Construct query parameters
        params = {"api-version": DEFAULT_API_VERSION, "currencyCode": "USD"}

        if filter_conditions:
            params["$filter"] = " and ".join(filter_conditions)

        # Limit results
        if limit < MAX_RESULTS_PER_REQUEST:
            params["$top"] = str(limit)

        # Make request
        data = await self._make_request(AZURE_PRICING_BASE_URL, params)

        # Process and deduplicate SKUs
        skus = {}
        items = data.get("Items", [])

        for item in items:
            sku_name = item.get("skuName")
            arm_sku_name = item.get("armSkuName")
            product_name = item.get("productName")
            region = item.get("armRegionName")
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
                    "sample_region": region,
                    "available_regions": [region] if region else [],
                }
            elif sku_name and region and region not in skus[sku_name]["available_regions"]:
                # Add region to existing SKU
                skus[sku_name]["available_regions"].append(region)

        # Convert to list and sort by SKU name
        sku_list = list(skus.values())
        sku_list.sort(key=lambda x: x["sku_name"])

        return {
            "service_name": service_name,
            "skus": sku_list,
            "total_skus": len(sku_list),
            "price_type": price_type,
            "region_filter": region,
        }

    async def search_azure_prices_with_fuzzy_matching(
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
        """
        Search Azure retail prices with fuzzy matching and suggestions.
        If exact matches aren't found, suggests similar services.
        """

        # First try exact search
        exact_result = await self.search_azure_prices(
            service_name=service_name,
            service_family=service_family,
            region=region,
            sku_name=sku_name,
            price_type=price_type,
            currency_code=currency_code,
            limit=limit,
        )

        # If we got results, return them
        if exact_result["items"]:
            return exact_result

        # If no results and suggest_alternatives is True, try fuzzy matching
        if suggest_alternatives and (service_name or service_family):
            return await self._find_similar_services(
                service_name=service_name, service_family=service_family, currency_code=currency_code, limit=limit
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
            result = await self.search_azure_prices(service_name=correct_name, currency_code=currency_code, limit=limit)

            if result["items"]:
                result["suggestion_used"] = correct_name
                result["original_search"] = service_name
                result["match_type"] = "exact_mapping"
                return result

        # Try partial matching for common terms
        partial_matches = []
        for user_term, azure_service in SERVICE_NAME_MAPPINGS.items():
            if search_term in user_term or user_term in search_term:
                partial_matches.append(azure_service)

        # Remove duplicates and try each match
        for azure_service in list(set(partial_matches)):
            result = await self.search_azure_prices(service_name=azure_service, currency_code=currency_code, limit=5)

            if result["items"]:
                suggestions.append(
                    {
                        "service_name": azure_service,
                        "match_reason": f"Partial match for '{service_name}'",
                        "sample_items": result["items"][:3],
                    }
                )

        # If still no matches, do a broad search and look for similar services
        if not suggestions:
            broad_result = await self.search_azure_prices(
                service_family=service_family, currency_code=currency_code, limit=100
            )

            # Find services that contain the search term
            matching_services = set()
            for item in broad_result.get("items", []):
                service = item.get("serviceName", "")
                product = item.get("productName", "")

                if (
                    search_term in service.lower()
                    or search_term in product.lower()
                    or any(word in service.lower() for word in search_term.split())
                ):
                    matching_services.add(service)

            # Create suggestions from found services
            for service in list(matching_services)[:5]:  # Limit to top 5
                service_result = await self.search_azure_prices(
                    service_name=service, currency_code=currency_code, limit=3
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
        self, service_hint: str, region: str | None = None, currency_code: str = "USD", limit: int = 30
    ) -> dict[str, Any]:
        """
        Discover SKUs for a service with intelligent service name matching.

        Args:
            service_hint: User's description of the service (e.g., "app service", "web app")
            region: Optional specific region to filter by
            currency_code: Currency for pricing
            limit: Maximum number of results
        """

        # Use fuzzy matching to find the right service
        result = await self.search_azure_prices_with_fuzzy_matching(
            service_name=service_hint, region=region, currency_code=currency_code, limit=limit
        )

        # If we found exact matches, process SKUs
        if result["items"]:
            skus = {}
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

                skus[sku_name]["prices"].append(
                    {"price": price, "unit": unit, "region": item_region})
                skus[sku_name]["regions"].add(item_region)

            # Convert sets to lists for JSON serialization
            for sku_data in skus.values():
                sku_data["regions"] = list(sku_data["regions"])

                # Keep only the cheapest price for summary - handle empty sequences safely
                if not sku_data["prices"]:
                    sku_data["min_price"] = 0
                    sku_data["sample_unit"] = "Unknown"
                else:
                    valid_prices = [p["price"]
                                    for p in sku_data["prices"] if p.get("price", 0) > 0]
                    if valid_prices:
                        sku_data["min_price"] = min(valid_prices)
                    else:
                        # If no valid prices > 0, use the first price (even if 0)
                        sku_data["min_price"] = sku_data["prices"][0].get(
                            "price", 0)
                    sku_data["sample_unit"] = sku_data["prices"][0].get(
                        "unit", "Unknown")

            return {
                "service_found": service_used,
                "original_search": service_hint,
                "skus": skus,
                "total_skus": len(skus),
                "currency": currency_code,
                "match_type": result.get("match_type", "exact"),
            }

        # If no exact matches, return suggestions
        return {
            "service_found": None,
            "original_search": service_hint,
            "skus": {},
            "total_skus": 0,
            "currency": currency_code,
            "suggestions": result.get("suggestions", []),
            "match_type": "no_match",
        }


def create_server() -> Server:
    """Create and configure the MCP server instance."""
    server = Server("azure-pricing")
    pricing_server = AzurePricingServer()

    @server.list_tools()
    async def handle_list_tools() -> list[Tool]:
        """List available tools."""
        return [
            Tool(
                name="azure_price_search",
                description="Search Azure retail prices with various filters",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name (e.g., 'Virtual Machines', 'Storage')",
                        },
                        "service_family": {
                            "type": "string",
                            "description": "Service family (e.g., 'Compute', 'Storage', 'Networking')",
                        },
                        "region": {"type": "string", "description": "Azure region (e.g., 'eastus', 'westeurope')"},
                        "sku_name": {
                            "type": "string",
                            "description": "SKU name to search for (partial matches supported)",
                        },
                        "price_type": {
                            "type": "string",
                            "description": "Price type: 'Consumption', 'Reservation', or 'DevTestConsumption'",
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 50)",
                            "default": 50,
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount)",
                        },
                        "validate_sku": {
                            "type": "boolean",
                            "description": "Whether to validate SKU names and provide suggestions (default: true)",
                            "default": True,
                        },
                    },
                },
            ),
            Tool(
                name="azure_price_compare",
                description="Compare Azure prices across regions or SKUs",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {"type": "string", "description": "Azure service name to compare"},
                        "sku_name": {"type": "string", "description": "Specific SKU to compare (optional)"},
                        "regions": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of regions to compare (if not provided, compares SKUs)",
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount)",
                        },
                    },
                    "required": ["service_name"],
                },
            ),
            Tool(
                name="azure_cost_estimate",
                description="Estimate Azure costs based on usage patterns",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {"type": "string", "description": "Azure service name"},
                        "sku_name": {"type": "string", "description": "SKU name"},
                        "region": {"type": "string", "description": "Azure region"},
                        "hours_per_month": {
                            "type": "number",
                            "description": "Expected hours of usage per month (default: 730 for full month)",
                            "default": 730,
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount)",
                        },
                    },
                    "required": ["service_name", "sku_name", "region"],
                },
            ),
            Tool(
                name="azure_discover_skus",
                description="Discover available SKUs for a specific Azure service",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {"type": "string", "description": "Azure service name"},
                        "region": {"type": "string", "description": "Azure region (optional)"},
                        "price_type": {
                            "type": "string",
                            "description": "Price type (default: 'Consumption')",
                            "default": "Consumption",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of SKUs to return (default: 100)",
                            "default": 100,
                        },
                    },
                    "required": ["service_name"],
                },
            ),
            Tool(
                name="azure_sku_discovery",
                description="Discover available SKUs for Azure services with intelligent name matching",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_hint": {
                            "type": "string",
                            "description": "Service name or description (e.g., 'app service', 'web app', 'vm', 'storage'). Supports fuzzy matching.",
                        },
                        "region": {"type": "string", "description": "Optional Azure region to filter results"},
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 30)",
                            "default": 30,
                        },
                    },
                    "required": ["service_hint"],
                },
            ),
            Tool(
                name="azure_region_recommend",
                description="Find the cheapest Azure regions for a given service and SKU. Dynamically discovers all available regions, compares prices, and returns ranked recommendations with savings percentages.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "service_name": {
                            "type": "string",
                            "description": "Azure service name (e.g., 'Virtual Machines', 'Azure App Service')",
                        },
                        "sku_name": {
                            "type": "string",
                            "description": "SKU name to price across regions (e.g., 'D4s v3', 'P1v3')",
                        },
                        "top_n": {
                            "type": "integer",
                            "description": "Number of top recommendations to return (default: 10)",
                            "default": 10,
                        },
                        "currency_code": {
                            "type": "string",
                            "description": "Currency code (default: USD)",
                            "default": "USD",
                        },
                        "discount_percentage": {
                            "type": "number",
                            "description": "Discount percentage to apply to prices (e.g., 10 for 10% discount)",
                        },
                    },
                    "required": ["service_name", "sku_name"],
                },
            ),
            Tool(
                name="get_customer_discount",
                description="Get customer discount information. Returns default 10% discount for all customers.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "customer_id": {
                            "type": "string",
                            "description": "Customer ID (optional, defaults to 'default' customer)",
                        }
                    },
                },
            ),
        ]

    # Import and register the tool handler
    from .handlers import register_tool_handlers

    register_tool_handlers(server, pricing_server)

    return server


async def main():
    """Main entry point for the server."""
    import argparse

    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Azure Pricing MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport type: stdio (for local MCP clients) or http (for remote access)",
    )
    parser.add_argument(
        "--host", default="127.0.0.1", help="Host to bind HTTP server (default: 127.0.0.1, use 0.0.0.0 for Docker)"
    )
    parser.add_argument("--port", type=int, default=8080,
                        help="Port for HTTP server (default: 8080)")

    # Only parse known args to avoid issues with MCP passing additional args
    args, _ = parser.parse_known_args()

    server = create_server()

    if args.transport == "http":
        # Use HTTP transport for remote access (Docker use case)
        from mcp.server.sse import SseServerTransport
        from starlette.applications import Starlette
        from starlette.requests import Request
        from starlette.responses import Response
        from starlette.routing import Mount, Route

        logger.info(f"Starting HTTP MCP server on {args.host}:{args.port}")

        # Create SSE transport
        sse = SseServerTransport("/messages/")

        async def handle_sse(request: Request):
            async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
                initialization_options = server.create_initialization_options(
                    notification_options=NotificationOptions(
                        tools_changed=True)
                )
                await server.run(streams[0], streams[1], initialization_options)
            return Response()

        app = Starlette(
            routes=[
                Route("/sse", endpoint=handle_sse),
                Mount("/messages/", app=sse.handle_post_message),
            ]
        )

        import uvicorn

        config = uvicorn.Config(app, host=args.host,
                                port=args.port, log_level="info")
        server_instance = uvicorn.Server(config)
        await server_instance.serve()
    else:
        # Use stdio transport for local MCP clients (VS Code, Claude Desktop)
        logger.info("Starting stdio MCP server")
        async with stdio_server() as (read_stream, write_stream):
            initialization_options = server.create_initialization_options(
                notification_options=NotificationOptions(tools_changed=True)
            )

            await server.run(read_stream, write_stream, initialization_options)
