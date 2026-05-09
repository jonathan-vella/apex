"""Tool handlers for Azure Pricing MCP Server."""

import logging
from typing import Any

from mcp.types import TextContent

from .config import DEFAULT_CUSTOMER_DISCOUNT
from .databricks.handlers import DatabricksHandlers
from .formatters import (
    _get_discount_tip,
    format_bulk_estimate_response,
    format_cost_estimate_response,
    format_customer_discount_response,
    format_discover_skus_response,
    format_orphaned_resources_response,
    format_price_compare_response,
    format_price_search_response,
    format_ptu_sizing_response,
    format_region_recommend_response,
    format_ri_pricing_response,
    format_simulate_eviction_response,
    format_sku_discovery_response,
    format_spot_eviction_rates_response,
    format_spot_price_history_response,
)
from .github_pricing.handlers import GitHubPricingHandlers
from .response_format import DEFAULT_RESPONSE_FORMAT, ResponseFormat, coerce_response_format
from .services import BulkEstimateService, DatabricksService, PricingService, PTUService, SKUService, SpotService
from .services.orphaned import OrphanedResourcesService

logger = logging.getLogger(__name__)


def _pop_response_format(arguments: dict[str, Any]) -> ResponseFormat:
    """Pop ``response_format`` out of arguments and validate it.

    Removed from the dict so service-layer kwargs aren't polluted with a
    presentation-layer concern.
    """
    raw = arguments.pop("response_format", DEFAULT_RESPONSE_FORMAT)
    return coerce_response_format(raw)


class ToolHandlers(DatabricksHandlers, GitHubPricingHandlers):
    """Handlers for MCP tool calls."""

    def __init__(
        self,
        pricing_service: PricingService,
        sku_service: SKUService,
        spot_service: SpotService | None = None,
        orphaned_service: OrphanedResourcesService | None = None,
        databricks_service: DatabricksService | None = None,
        bulk_service: BulkEstimateService | None = None,
    ) -> None:
        self._pricing_service = pricing_service
        self._sku_service = sku_service
        self._spot_service = spot_service
        self._orphaned_service = orphaned_service
        self._databricks_service = databricks_service
        self._bulk_service = bulk_service
        self._ptu_service: PTUService | None = None
        self._github_pricing_service = None

    def _resolve_discount(self, arguments: dict[str, Any]) -> tuple[float, bool, bool]:
        """Resolve discount settings from arguments.

        Handles the `show_with_discount` convenience flag and explicit `discount_percentage`.

        Args:
            arguments: Tool arguments dict (modified in place)

        Returns:
            Tuple of (discount_percentage, discount_specified, used_default_discount)
        """
        # Pop show_with_discount if present (it's not passed to the service)
        show_with_discount = arguments.pop("show_with_discount", False)

        # Check if user explicitly specified discount_percentage
        discount_specified = "discount_percentage" in arguments

        if discount_specified:
            # User explicitly provided discount_percentage - use it as-is
            discount_pct = arguments["discount_percentage"]
            return (discount_pct, True, False)

        # No explicit discount_percentage provided
        if show_with_discount:
            # User wants default discount applied
            arguments["discount_percentage"] = DEFAULT_CUSTOMER_DISCOUNT
            return (DEFAULT_CUSTOMER_DISCOUNT, False, True)
        else:
            # No discount requested - use 0%
            arguments["discount_percentage"] = 0.0
            return (0.0, False, False)

    def _attach_discount_metadata(
        self,
        result: dict[str, Any],
        discount_pct: float,
        discount_specified: bool,
        used_default: bool,
    ) -> None:
        """Attach discount metadata to the result dict.

        Args:
            result: The result dict to modify
            discount_pct: The discount percentage used
            discount_specified: Whether user explicitly specified the discount
            used_default: Whether the default discount was used
        """
        result["_discount_metadata"] = {
            "discount_specified": discount_specified,
            "used_default_discount": used_default,
            "discount_percentage": discount_pct,
        }

    async def handle_price_search(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_price_search tool calls."""
        fmt = _pop_response_format(arguments)
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.search_prices(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_price_search_response(result, fmt)

        # In compact mode the discount tip is suppressed (high token cost on every call).
        if fmt == "full":
            discount_tip = _get_discount_tip(result)
            if discount_tip:
                response_text += f"\n\n{discount_tip}"

        return [TextContent(type="text", text=response_text)]

    async def handle_price_compare(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_price_compare tool calls."""
        fmt = _pop_response_format(arguments)
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.compare_prices(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_price_compare_response(result, fmt)
        return [TextContent(type="text", text=response_text)]

    async def handle_region_recommend(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_region_recommend tool calls."""
        fmt = _pop_response_format(arguments)
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.recommend_regions(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_region_recommend_response(result, fmt)
        return [TextContent(type="text", text=response_text)]

    async def handle_cost_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_cost_estimate tool calls."""
        fmt = _pop_response_format(arguments)
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.estimate_costs(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_cost_estimate_response(result, fmt)
        return [TextContent(type="text", text=response_text)]

    async def handle_bulk_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_bulk_estimate tool calls."""
        fmt = _pop_response_format(arguments)
        if self._bulk_service is None:
            self._bulk_service = BulkEstimateService(self._pricing_service)
        result = await self._bulk_service.bulk_estimate(**arguments)
        response_text = format_bulk_estimate_response(result, fmt)
        return [TextContent(type="text", text=response_text)]

    async def handle_discover_skus(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_discover_skus tool calls (deprecated alias — see Phase 4.12).

        v5.0: forwards to ``azure_sku_discovery`` so callers see the canonical
        fuzzy-match implementation. The legacy ``discover_skus`` SKUService
        method still exists for tests; this handler shims the v4 ``service_name``
        argument to the v5 ``service_hint`` parameter.
        """
        fmt = _pop_response_format(arguments)
        # Translate legacy arg name; preserve all others verbatim.
        if "service_hint" not in arguments and "service_name" in arguments:
            arguments["service_hint"] = arguments.pop("service_name")
        # ``price_type`` is v4-specific and unused by the canonical impl.
        arguments.pop("price_type", None)
        result = await self._sku_service.discover_service_skus(**arguments)
        # The deprecation hint header is rendered by format_discover_skus_response;
        # we route through it so the alias contract (compact-mode hint) is
        # preserved even though we use the canonical implementation.
        if not result.get("service_found"):
            response_text = format_discover_skus_response(result, fmt)
        else:
            # Reshape the canonical response to the v4 list-of-dicts shape that
            # format_discover_skus_response expects.
            shaped = {
                "service_name": result.get("service_found", arguments.get("service_hint", "")),
                "total_skus": result.get("total_skus", 0),
                "skus": [
                    {
                        "skuName": sku_name,
                        "productName": data.get("product_name"),
                        "minPrice": data.get("min_price"),
                        "regions": list(data.get("regions", [])),
                    }
                    for sku_name, data in (result.get("skus") or {}).items()
                ],
            }
            response_text = format_discover_skus_response(shaped, fmt)
        return [TextContent(type="text", text=response_text)]

    async def handle_sku_discovery(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_sku_discovery tool calls."""
        fmt = _pop_response_format(arguments)
        result = await self._sku_service.discover_service_skus(**arguments)
        response_text = format_sku_discovery_response(result, fmt)
        return [TextContent(type="text", text=response_text)]

    async def handle_customer_discount(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle get_customer_discount tool calls."""
        result = await self._pricing_service.get_customer_discount(**arguments)
        response_text = format_customer_discount_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_ri_pricing(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_ri_pricing tool calls."""
        fmt = _pop_response_format(arguments)
        result = await self._pricing_service.get_ri_pricing(**arguments)
        response_text = format_ri_pricing_response(result, fmt)
        return [TextContent(type="text", text=response_text)]

    def _get_spot_service(self) -> SpotService:
        """Get or create the SpotService (lazy initialization)."""
        if self._spot_service is None:
            self._spot_service = SpotService()
        return self._spot_service

    def _get_orphaned_service(self) -> OrphanedResourcesService:
        """Get or create the OrphanedResourcesService (lazy initialization)."""
        if self._orphaned_service is None:
            self._orphaned_service = OrphanedResourcesService()
        return self._orphaned_service

    def _get_ptu_service(self) -> PTUService:
        """Get or create the PTUService (lazy initialization)."""
        if self._ptu_service is None:
            # Pass the pricing client for cost lookups (public API, no auth needed)
            client = getattr(self._pricing_service, "_client", None)
            self._ptu_service = PTUService(client=client)
        return self._ptu_service

    async def handle_spot_eviction_rates(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle spot_eviction_rates tool calls."""
        spot_service = self._get_spot_service()
        result = await spot_service.get_eviction_rates(
            skus=arguments["skus"],
            locations=arguments["locations"],
        )
        response_text = format_spot_eviction_rates_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_spot_price_history(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle spot_price_history tool calls."""
        spot_service = self._get_spot_service()
        result = await spot_service.get_price_history(
            sku=arguments["sku"],
            location=arguments["location"],
            os_type=arguments.get("os_type", "linux"),
        )
        response_text = format_spot_price_history_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_simulate_eviction(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle simulate_eviction tool calls."""
        spot_service = self._get_spot_service()
        result = await spot_service.simulate_eviction(
            vm_resource_id=arguments["vm_resource_id"],
        )
        response_text = format_simulate_eviction_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_find_orphaned_resources(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle find_orphaned_resources tool calls."""
        fmt = _pop_response_format(arguments)
        orphaned_service = self._get_orphaned_service()
        result = await orphaned_service.find_orphaned_resources(
            days=arguments.get("days", 60),
            all_subscriptions=arguments.get("all_subscriptions", True),
        )
        response_text = format_orphaned_resources_response(result, fmt)
        return [TextContent(type="text", text=response_text)]

    async def handle_ptu_sizing(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_ptu_sizing tool calls."""
        ptu_service = self._get_ptu_service()
        result = await ptu_service.estimate_ptu_sizing(
            model=arguments["model"],
            deployment_type=arguments["deployment_type"],
            rpm=arguments["rpm"],
            avg_input_tokens=arguments["avg_input_tokens"],
            avg_output_tokens=arguments["avg_output_tokens"],
            cached_tokens_per_request=arguments.get("cached_tokens_per_request", 0),
            include_cost=arguments.get("include_cost", False),
            region=arguments.get("region", "eastus"),
            currency_code=arguments.get("currency_code", "USD"),
        )
        response_text = format_ptu_sizing_response(result)
        return [TextContent(type="text", text=response_text)]


# Note: The historical ``register_tool_handlers`` helper that lived here was
# removed in v5.0. Tool routing is now owned by ``server.py`` (FastMCP-style
# decorators on the lifespan-managed ``AzurePricingServer``). Importers that
# referenced this name should migrate to ``server.create_server()``.
