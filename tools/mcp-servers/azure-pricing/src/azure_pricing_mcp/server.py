"""
Azure Pricing MCP Server

A Model Context Protocol server that provides tools for querying Azure retail pricing.

Version 3.0.0 Breaking Changes:
- Entry point changed from `main` to `run` (synchronous wrapper)
- `create_server()` now returns tuple (Server, AzurePricingServer) for testing
- Session lifecycle is managed at the server level, not per-tool-call
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal, overload

from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from .client import AzurePricingClient
from .handlers import ToolHandlers
from .services import DatabricksService, PricingService, RetirementService, SKUService
from .tools import get_tool_definitions

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AzurePricingServer:
    """Azure Pricing MCP Server - coordinates all services.

    This class manages the lifecycle of the HTTP client and all services.
    Use as an async context manager to ensure proper resource cleanup.

    Example:
        async with AzurePricingServer() as pricing_server:
            result = await pricing_server.tool_handlers.handle_price_search(...)
    """

    def __init__(self) -> None:
        self._client = AzurePricingClient()
        self._retirement_service = RetirementService(self._client)
        self._pricing_service = PricingService(self._client, self._retirement_service)
        self._sku_service = SKUService(self._pricing_service)
        # Lazy-initialized services (created on first use)
        self._databricks_service: DatabricksService | None = None
        self._tool_handlers: ToolHandlers | None = None
        self._session_active = False

    @property
    def databricks_service(self) -> DatabricksService:
        if self._databricks_service is None:
            self._databricks_service = DatabricksService(self._client)
        return self._databricks_service

    async def __aenter__(self) -> AzurePricingServer:
        """Async context manager entry - initializes the HTTP session."""
        if not self._session_active:
            await self._client.__aenter__()
            self._session_active = True
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit - closes the HTTP session."""
        if self._session_active:
            await self._client.__aexit__(exc_type, exc_val, exc_tb)
            self._session_active = False

    async def initialize(self) -> None:
        """Initialize the server's HTTP session.

        Call this method to start the session without using context manager.
        Remember to call shutdown() when done.
        """
        if not self._session_active:
            await self._client.__aenter__()
            self._session_active = True

    async def shutdown(self) -> None:
        """Shutdown the server's HTTP session.

        Call this method to close the session when not using context manager.
        """
        if self._session_active:
            await self._client.__aexit__(None, None, None)
            self._session_active = False

    @property
    def is_active(self) -> bool:
        """Check if the HTTP session is active."""
        return self._session_active

    @property
    def tool_handlers(self) -> ToolHandlers:
        """Get the tool handlers instance (lazy-initialized)."""
        if self._tool_handlers is None:
            self._tool_handlers = ToolHandlers(
                self._pricing_service,
                self._sku_service,
                databricks_service=self.databricks_service,
            )
        return self._tool_handlers


def _register_tool_handlers(server: Server, pricing_server: AzurePricingServer) -> None:
    """Register all tool handlers on the MCP server.

    v5.1 — replaces the v5.0 ``if name == "x" / elif`` ladder with a dispatch
    dict. This achieves the FastMCP-migration goal stated in the plan
    (Phase 4.15: "eliminates the manual ladder") without rewriting every tool
    as a typed function — the existing rich inputSchemas in
    :mod:`azure_pricing_mcp.tools` would otherwise need to be re-derived from
    function signatures, forcing a full test-suite rewrite (E3 from the plan).

    The aiohttp session is already lifespan-owned (Phase 4.15 sub-goal): see
    :meth:`AzurePricingServer.__aenter__` / ``__aexit__`` and the
    ``async with pricing_server:`` block in :func:`main`. Switching to FastMCP's
    explicit ``lifespan`` parameter buys nothing functional today.
    """
    # Build a static dispatch table on each call (cheap dict literal vs the
    # v5.0 linear-scan if/elif chain, and adding a new tool no longer requires
    # editing the routing branch). Late binding via ``pricing_server.tool_handlers``
    # ensures each lookup picks up the lazily-initialized handler instance.

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict[str, Any]) -> Any:
        """Route a tool call to its handler — O(1) dispatch."""
        if not pricing_server.is_active:
            return [TextContent(type="text", text="Error: Server session not initialized")]

        # Late binding so each lookup uses the latest tool_handlers instance
        # (lazy-initialized on first use).
        handlers = pricing_server.tool_handlers

        # Core (always available) handlers
        dispatch: dict[str, Any] = {
            "azure_price_search": handlers.handle_price_search,
            "azure_price_compare": handlers.handle_price_compare,
            "azure_cost_estimate": handlers.handle_cost_estimate,
            "azure_discover_skus": handlers.handle_discover_skus,
            "azure_sku_discovery": handlers.handle_sku_discovery,
            "azure_region_recommend": handlers.handle_region_recommend,
            "azure_ri_pricing": handlers.handle_ri_pricing,
            "azure_bulk_estimate": handlers.handle_bulk_estimate,
            "azure_ptu_sizing": handlers.handle_ptu_sizing,
            "get_customer_discount": handlers.handle_customer_discount,
            "databricks_dbu_pricing": handlers.handle_databricks_dbu_pricing,
            "databricks_cost_estimate": handlers.handle_databricks_cost_estimate,
            "databricks_compare_workloads": handlers.handle_databricks_compare_workloads,
            "github_pricing": handlers.handle_github_pricing,
            "github_cost_estimate": handlers.handle_github_cost_estimate,
            # Admin tier — handler comes from the AdminHandlers mixin when
            # ``[admin]`` extras are installed, or the fallback otherwise.
            "spot_eviction_rates": handlers.handle_spot_eviction_rates,
            "spot_price_history": handlers.handle_spot_price_history,
            "simulate_eviction": handlers.handle_simulate_eviction,
            "find_orphaned_resources": handlers.handle_find_orphaned_resources,
        }

        handler = dispatch.get(name)
        if handler is None:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
        result = await handler(arguments)

        # v5.2 — when a handler emits a ``MCPToolResponse`` carrying a
        # ``.structured`` payload, convert to the SDK's tuple form so
        # ``CallToolResult.structuredContent`` is populated and the
        # outputSchema validator runs against it. Plain ``list`` returns
        # (legacy text-only handlers) pass through unchanged.
        structured = getattr(result, "structured", None)
        if structured is not None:
            return list(result), structured
        return result


@overload
def create_server(return_pricing_server: Literal[True] = ...) -> tuple[Server, AzurePricingServer]: ...


@overload
def create_server(return_pricing_server: Literal[False]) -> Server: ...


def create_server(return_pricing_server: bool = True) -> Server | tuple[Server, AzurePricingServer]:
    """Create and configure the MCP server instance.

    Args:
        return_pricing_server: If True (default), returns tuple (Server, AzurePricingServer).
                              If False, returns only the Server (for simpler usage).

    Returns:
        Server or tuple[Server, AzurePricingServer] depending on return_pricing_server flag.

    Note:
        When using the pricing_server directly, you must manage its lifecycle:
        - Call `await pricing_server.initialize()` before handling tool calls
        - Call `await pricing_server.shutdown()` when done
        - Or use `async with pricing_server:` context manager

    Breaking Change (v3.0.0):
        Default return is now a tuple. Use `create_server(return_pricing_server=False)`
        for the previous behavior of returning only the Server.
    """
    server = Server("azure-pricing")
    pricing_server = AzurePricingServer()

    @server.list_tools()
    async def handle_list_tools() -> list[Tool]:
        """List available tools."""
        return get_tool_definitions()

    _register_tool_handlers(server, pricing_server)

    if return_pricing_server:
        return server, pricing_server
    return server


async def main() -> None:
    """Main entry point for the server.

    Manages the server lifecycle: creates the ``AzurePricingServer`` (whose
    ``aiohttp.ClientSession`` is opened ONCE under ``async with``), then runs
    the stdio transport for local MCP clients (VS Code, Claude Desktop).

    v5.0: The HTTP transport (and its Docker delivery vehicle) was removed —
    every consumer of this server uses stdio. To re-add a remote transport
    later, plumb a Streamable HTTP path through ``mcp.server.streamable_http``.
    """
    server, pricing_server = create_server()

    # Initialize the pricing server session ONCE and keep it alive for all
    # tool calls — avoids per-call session creation.
    async with pricing_server:
        logger.info("Starting stdio MCP server")
        async with stdio_server() as (read_stream, write_stream):
            initialization_options = server.create_initialization_options(
                notification_options=NotificationOptions(tools_changed=True)
            )
            await server.run(read_stream, write_stream, initialization_options)


def run() -> None:
    """Synchronous entry point for the console script."""
    asyncio.run(main())


if __name__ == "__main__":
    run()
