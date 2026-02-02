"""
Azure Pricing MCP Server

A Model Context Protocol server that provides tools for querying Azure retail pricing.

Version 3.0.0 Breaking Changes:
- Entry point changed from `main` to `run` (synchronous wrapper)
- `create_server()` now returns tuple (Server, AzurePricingServer) for testing
- Session lifecycle is managed at the server level, not per-tool-call
"""

import asyncio
import logging
from typing import Any, Literal, overload

from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from .client import AzurePricingClient
from .handlers import ToolHandlers
from .services import PricingService, RetirementService, SKUService
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
        self._tool_handlers = ToolHandlers(self._pricing_service, self._sku_service)
        self._session_active = False

    async def __aenter__(self) -> "AzurePricingServer":
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
        """Get the tool handlers instance."""
        return self._tool_handlers


def _register_tool_handlers(server: Server, pricing_server: AzurePricingServer) -> None:
    """Register all tool handlers on the MCP server.

    This is an internal function that sets up the tool routing.
    The pricing_server session must be managed externally.
    """

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict[str, Any]) -> Any:
        """Handle tool calls - session must already be initialized."""
        if not pricing_server.is_active:
            return [TextContent(type="text", text="Error: Server session not initialized")]

        handlers = pricing_server.tool_handlers

        if name == "azure_price_search":
            return await handlers.handle_price_search(arguments)
        elif name == "azure_price_compare":
            return await handlers.handle_price_compare(arguments)
        elif name == "azure_cost_estimate":
            return await handlers.handle_cost_estimate(arguments)
        elif name == "azure_discover_skus":
            return await handlers.handle_discover_skus(arguments)
        elif name == "azure_sku_discovery":
            return await handlers.handle_sku_discovery(arguments)
        elif name == "azure_region_recommend":
            return await handlers.handle_region_recommend(arguments)
        elif name == "azure_ri_pricing":
            return await handlers.handle_ri_pricing(arguments)
        elif name == "get_customer_discount":
            return await handlers.handle_customer_discount(arguments)
        elif name == "spot_eviction_rates":
            return await handlers.handle_spot_eviction_rates(arguments)
        elif name == "spot_price_history":
            return await handlers.handle_spot_price_history(arguments)
        elif name == "simulate_eviction":
            return await handlers.handle_simulate_eviction(arguments)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]


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

    This function manages the complete server lifecycle including:
    - Parsing command-line arguments
    - Initializing the pricing server session (kept alive for all tool calls)
    - Running the appropriate transport (stdio or HTTP)
    - Properly shutting down resources on exit
    """
    import argparse

    parser = argparse.ArgumentParser(description="Azure Pricing MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport type: stdio (for local MCP clients) or http (for remote access)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind HTTP server (default: 127.0.0.1, use 0.0.0.0 for Docker)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port for HTTP server (default: 8080)",
    )

    args, _ = parser.parse_known_args()

    server, pricing_server = create_server()

    # Initialize the pricing server session ONCE and keep it alive
    # This avoids creating a new HTTP session for every tool call
    async with pricing_server:
        if args.transport == "http":
            # Use HTTP transport for remote access (Docker use case)
            from mcp.server.sse import SseServerTransport
            from starlette.applications import Starlette
            from starlette.requests import Request
            from starlette.responses import Response
            from starlette.routing import Mount, Route

            logger.info(f"Starting HTTP MCP server on {args.host}:{args.port}")

            sse = SseServerTransport("/messages/")

            async def handle_sse(request: Request) -> Response:
                async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
                    initialization_options = server.create_initialization_options(
                        notification_options=NotificationOptions(tools_changed=True)
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

            config = uvicorn.Config(app, host=args.host, port=args.port, log_level="info")
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


def run() -> None:
    """Synchronous entry point for the console script."""
    asyncio.run(main())


if __name__ == "__main__":
    run()
