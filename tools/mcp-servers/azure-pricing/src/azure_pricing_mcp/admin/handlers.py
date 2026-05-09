"""Admin-tier handler methods (gated by ``[admin]`` extras).

Implemented as a mixin so the parent ``ToolHandlers`` class can compose it
in without restructuring its constructor.
"""

from __future__ import annotations

from typing import Any

from mcp.types import TextContent

from ..formatters import (
    format_orphaned_resources_response,
    format_simulate_eviction_response,
    format_spot_eviction_rates_response,
    format_spot_price_history_response,
)
from ..mcp_response import MCPToolResponse, strip_private_keys
from ..response_format import coerce_response_format
from ..services.orphaned import OrphanedResourcesService
from ..services.spot import SpotService


class AdminHandlers:
    """Mixin providing handler methods for admin-tier tools.

    Composed into the main ``ToolHandlers`` only when ``admin`` package import
    succeeds. Lazily instantiates the underlying services.
    """

    _spot_service: SpotService | None
    _orphaned_service: OrphanedResourcesService | None

    def _get_spot_service(self) -> SpotService:
        if self._spot_service is None:
            self._spot_service = SpotService()
        return self._spot_service

    def _get_orphaned_service(self) -> OrphanedResourcesService:
        if self._orphaned_service is None:
            self._orphaned_service = OrphanedResourcesService()
        return self._orphaned_service

    async def handle_spot_eviction_rates(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle ``spot_eviction_rates`` tool calls."""
        spot_service = self._get_spot_service()
        result = await spot_service.get_eviction_rates(
            skus=arguments["skus"],
            locations=arguments["locations"],
        )
        text = format_spot_eviction_rates_response(result)
        return [TextContent(type="text", text=text)]

    async def handle_spot_price_history(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle ``spot_price_history`` tool calls."""
        spot_service = self._get_spot_service()
        result = await spot_service.get_price_history(
            sku=arguments["sku"],
            location=arguments["location"],
            os_type=arguments.get("os_type", "linux"),
        )
        text = format_spot_price_history_response(result)
        return [TextContent(type="text", text=text)]

    async def handle_simulate_eviction(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle ``simulate_eviction`` tool calls."""
        spot_service = self._get_spot_service()
        result = await spot_service.simulate_eviction(
            vm_resource_id=arguments["vm_resource_id"],
        )
        text = format_simulate_eviction_response(result)
        return [TextContent(type="text", text=text)]

    async def handle_find_orphaned_resources(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle ``find_orphaned_resources`` tool calls."""
        fmt = coerce_response_format(arguments.pop("response_format", "compact"))
        orphaned_service = self._get_orphaned_service()
        result = await orphaned_service.find_orphaned_resources(
            days=arguments.get("days", 60),
            all_subscriptions=arguments.get("all_subscriptions", True),
        )
        text = format_orphaned_resources_response(result, fmt)
        return MCPToolResponse(
            [TextContent(type="text", text=text)],
            structured=strip_private_keys(result),
        )
