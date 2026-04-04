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
from .services import BulkEstimateService, DatabricksService, PricingService, PTUService, SKUService, SpotService
from .services.orphaned import OrphanedResourcesService

logger = logging.getLogger(__name__)


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
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.search_prices(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_price_search_response(result)

        # Add discount tip if appropriate
        discount_tip = _get_discount_tip(result)
        if discount_tip:
            response_text += f"\n\n{discount_tip}"

        return [TextContent(type="text", text=response_text)]

    async def handle_price_compare(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_price_compare tool calls."""
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.compare_prices(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_price_compare_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_region_recommend(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_region_recommend tool calls."""
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.recommend_regions(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_region_recommend_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_cost_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_cost_estimate tool calls."""
        discount_pct, discount_specified, used_default = self._resolve_discount(arguments)

        result = await self._pricing_service.estimate_costs(**arguments)
        self._attach_discount_metadata(result, discount_pct, discount_specified, used_default)

        response_text = format_cost_estimate_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_bulk_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_bulk_estimate tool calls."""
        if self._bulk_service is None:
            self._bulk_service = BulkEstimateService(self._pricing_service)
        result = await self._bulk_service.bulk_estimate(**arguments)
        response_text = format_bulk_estimate_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_discover_skus(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_discover_skus tool calls."""
        result = await self._sku_service.discover_skus(**arguments)
        response_text = format_discover_skus_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_sku_discovery(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_sku_discovery tool calls."""
        result = await self._sku_service.discover_service_skus(**arguments)
        response_text = format_sku_discovery_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_customer_discount(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle get_customer_discount tool calls."""
        result = await self._pricing_service.get_customer_discount(**arguments)
        response_text = format_customer_discount_response(result)
        return [TextContent(type="text", text=response_text)]

    async def handle_ri_pricing(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle azure_ri_pricing tool calls."""
        result = await self._pricing_service.get_ri_pricing(**arguments)
        response_text = format_ri_pricing_response(result)
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
        orphaned_service = self._get_orphaned_service()
        result = await orphaned_service.find_orphaned_resources(
            days=arguments.get("days", 60),
            all_subscriptions=arguments.get("all_subscriptions", True),
        )
        response_text = format_orphaned_resources_response(result)
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


def register_tool_handlers(server: Any, tool_handlers: ToolHandlers) -> None:
    """Register all tool call handlers with the server.

    Args:
        server: The MCP server instance
        tool_handlers: The ToolHandlers instance
    """

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle tool calls."""
        try:
            if name == "azure_price_search":
                return await tool_handlers.handle_price_search(arguments)

            elif name == "azure_price_compare":
                return await tool_handlers.handle_price_compare(arguments)

            elif name == "azure_cost_estimate":
                return await tool_handlers.handle_cost_estimate(arguments)

            elif name == "azure_discover_skus":
                return await tool_handlers.handle_discover_skus(arguments)

            elif name == "azure_sku_discovery":
                return await tool_handlers.handle_sku_discovery(arguments)

            elif name == "azure_region_recommend":
                return await tool_handlers.handle_region_recommend(arguments)

            elif name == "azure_ri_pricing":
                return await tool_handlers.handle_ri_pricing(arguments)

            elif name == "get_customer_discount":
                return await tool_handlers.handle_customer_discount(arguments)

            # Spot VM tools (require Azure authentication)
            elif name == "spot_eviction_rates":
                return await tool_handlers.handle_spot_eviction_rates(arguments)

            elif name == "spot_price_history":
                return await tool_handlers.handle_spot_price_history(arguments)

            elif name == "simulate_eviction":
                return await tool_handlers.handle_simulate_eviction(arguments)

            # Orphaned resources tool (requires Azure authentication)
            elif name == "find_orphaned_resources":
                return await tool_handlers.handle_find_orphaned_resources(arguments)

            # Databricks DBU pricing tools
            elif name == "databricks_dbu_pricing":
                return await tool_handlers.handle_databricks_dbu_pricing(arguments)

            elif name == "databricks_cost_estimate":
                return await tool_handlers.handle_databricks_cost_estimate(arguments)

            elif name == "databricks_compare_workloads":
                return await tool_handlers.handle_databricks_compare_workloads(arguments)

            # PTU Sizing + Cost Planner
            elif name == "azure_ptu_sizing":
                return await tool_handlers.handle_ptu_sizing(arguments)

            # GitHub pricing tools
            elif name == "github_pricing":
                return await tool_handlers.handle_github_pricing(arguments)

            elif name == "github_cost_estimate":
                return await tool_handlers.handle_github_cost_estimate(arguments)

            else:
                return [TextContent(type="text", text=f"Unknown tool: {name}")]

        except Exception as e:
            logger.error(f"Error handling tool call {name}: {e}")
            return [TextContent(type="text", text=f"Error: {str(e)}")]
