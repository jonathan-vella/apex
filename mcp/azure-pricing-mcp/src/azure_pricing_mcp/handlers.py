"""Tool handlers for Azure Pricing MCP Server."""

import json
import logging
from collections.abc import Callable, Coroutine
from typing import Any

from mcp.types import TextContent

from .config import DEFAULT_CUSTOMER_DISCOUNT
from .error_codes import ErrorCode, error_response
from .formatters import (
    _get_discount_tip,
    format_bulk_estimate_response,
    format_cache_stats_response,
    format_compact,
    format_cost_estimate_response,
    format_customer_discount_response,
    format_discover_skus_response,
    format_price_compare_response,
    format_price_search_response,
    format_region_recommend_response,
    format_ri_pricing_response,
    format_simulate_eviction_response,
    format_sku_discovery_response,
    format_spot_eviction_rates_response,
    format_spot_price_history_response,
)
from .services import BulkEstimateService, PricingService, SKUService, SpotService
from .validation import validate_arguments

logger = logging.getLogger(__name__)


class ToolHandlers:
    """Handlers for MCP tool calls."""

    def __init__(
        self,
        pricing_service: PricingService,
        sku_service: SKUService,
        spot_service: SpotService | None = None,
        bulk_service: BulkEstimateService | None = None,
    ) -> None:
        self._pricing_service = pricing_service
        self._sku_service = sku_service
        self._spot_service = spot_service
        self._bulk_service = bulk_service

    async def _safe_handle(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        handler: Callable[[dict[str, Any]], Coroutine[Any, Any, list[TextContent]]],
    ) -> list[TextContent]:
        """Execute *handler* inside a validation + error boundary.

        1. Runs input validation via ``validate_arguments``.
        2. Delegates to the concrete handler.
        3. Catches unexpected exceptions so that a structured error is always
           returned instead of crashing the MCP server.
        """
        validation_error = validate_arguments(tool_name, arguments)
        if validation_error:
            return [TextContent(type="text", text=json.dumps(validation_error))]

        try:
            return await handler(arguments)
        except Exception:
            logger.exception("Unhandled error in handler for tool '%s'", tool_name)
            err = error_response(
                ErrorCode.INTERNAL_ERROR,
                f"An unexpected error occurred while executing '{tool_name}'",
            )
            return [TextContent(type="text", text=json.dumps(err))]

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
        return await self._safe_handle("azure_price_search", arguments, self._do_price_search)

    async def _do_price_search(self, arguments: dict[str, Any]) -> list[TextContent]:
        output_format = arguments.pop("output_format", "verbose")
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.search_prices(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        if output_format == "compact":
            return [TextContent(type="text", text=format_compact(result))]

        response_text = format_price_search_response(result)

        discount_tip = _get_discount_tip(result)
        if discount_tip:
            response_text += f"\n\n{discount_tip}"

        return [TextContent(type="text", text=response_text)]

    async def handle_price_compare(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_price_compare tool calls."""
        return await self._safe_handle("azure_price_compare", arguments, self._do_price_compare)

    async def _do_price_compare(self, arguments: dict[str, Any]) -> list[TextContent]:
        output_format = arguments.pop("output_format", "verbose")
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.compare_prices(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        if output_format == "compact":
            return [TextContent(type="text", text=format_compact(result))]

        response_text = format_price_compare_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_region_recommend(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_region_recommend tool calls."""
        return await self._safe_handle("azure_region_recommend", arguments, self._do_region_recommend)

    async def _do_region_recommend(self, arguments: dict[str, Any]) -> list[TextContent]:
        output_format = arguments.pop("output_format", "verbose")
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.recommend_regions(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        if output_format == "compact":
            return [TextContent(type="text", text=format_compact(result))]

        response_text = format_region_recommend_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_cost_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_cost_estimate tool calls."""
        return await self._safe_handle("azure_cost_estimate", arguments, self._do_cost_estimate)

    async def _do_cost_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        output_format = arguments.pop("output_format", "verbose")
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.estimate_costs(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        if output_format == "compact":
            return [TextContent(type="text", text=format_compact(result))]

        response_text = format_cost_estimate_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_discover_skus(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_discover_skus tool calls."""
        return await self._safe_handle("azure_discover_skus", arguments, self._do_discover_skus)

    async def _do_discover_skus(self, arguments: dict[str, Any]) -> list[TextContent]:
        result = await self._sku_service.discover_skus(**arguments)
        response_text = format_discover_skus_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_sku_discovery(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_sku_discovery tool calls."""
        return await self._safe_handle("azure_sku_discovery", arguments, self._do_sku_discovery)

    async def _do_sku_discovery(self, arguments: dict[str, Any]) -> list[TextContent]:
        result = await self._sku_service.discover_service_skus(**arguments)
        response_text = format_sku_discovery_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_customer_discount(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle get_customer_discount tool calls."""
        return await self._safe_handle("get_customer_discount", arguments, self._do_customer_discount)

    async def _do_customer_discount(self, arguments: dict[str, Any]) -> list[TextContent]:
        result = await self._pricing_service.get_customer_discount(**arguments)
        response_text = format_customer_discount_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_ri_pricing(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_ri_pricing tool calls."""
        return await self._safe_handle("azure_ri_pricing", arguments, self._do_ri_pricing)

    async def _do_ri_pricing(self, arguments: dict[str, Any]) -> list[TextContent]:
        result = await self._pricing_service.get_ri_pricing(**arguments)
        response_text = format_ri_pricing_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_bulk_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_bulk_estimate tool calls."""
        return await self._safe_handle("azure_bulk_estimate", arguments, self._do_bulk_estimate)

    async def _do_bulk_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        output_format = arguments.pop("output_format", "verbose")
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        if self._bulk_service is None:
            err = error_response(ErrorCode.SERVICE_NOT_INITIALIZED, "BulkEstimateService not initialized")
            return [TextContent(type="text", text=json.dumps(err))]

        result = await self._bulk_service.bulk_estimate(**arguments)

        if output_format == "compact":
            return [TextContent(type="text", text=format_compact(result))]

        response_text = format_bulk_estimate_response(result)
        return [TextContent(type="text", text=response_text)]

    def _get_spot_service(self) -> SpotService:
        """Get or create the SpotService (lazy initialization)."""
        if self._spot_service is None:
            self._spot_service = SpotService()
        return self._spot_service

    async def handle_spot_eviction_rates(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle spot_eviction_rates tool calls."""
        return await self._safe_handle("spot_eviction_rates", arguments, self._do_spot_eviction_rates)

    async def _do_spot_eviction_rates(self, arguments: dict[str, Any]) -> list[TextContent]:
        spot_service = self._get_spot_service()
        result = await spot_service.get_eviction_rates(
            skus=arguments["skus"],
            locations=arguments["locations"],
        )
        response_text = format_spot_eviction_rates_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_spot_price_history(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle spot_price_history tool calls."""
        return await self._safe_handle("spot_price_history", arguments, self._do_spot_price_history)

    async def _do_spot_price_history(self, arguments: dict[str, Any]) -> list[TextContent]:
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
        return await self._safe_handle("simulate_eviction", arguments, self._do_simulate_eviction)

    async def _do_simulate_eviction(self, arguments: dict[str, Any]) -> list[TextContent]:
        spot_service = self._get_spot_service()
        result = await spot_service.simulate_eviction(
            vm_resource_id=arguments["vm_resource_id"],
        )
        response_text = format_simulate_eviction_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_cache_stats(
        self, arguments: dict[str, Any], stats: dict[str, int]
    ) -> list[TextContent]:
        """Handle azure_cache_stats tool calls.

        ``stats`` is passed in by the server router because the cache
        lives on the HTTP client, not on the handler layer.
        """
        response_text = format_cache_stats_response(stats)
        return [TextContent(type="text", text=response_text)]
