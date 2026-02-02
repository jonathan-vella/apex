"""Azure Pricing MCP Server

A Model Context Protocol server for querying Azure retail pricing information.
"""

from .server import AzurePricingServer, create_server, main

__version__ = "2.1.0"
__all__ = ["main", "create_server", "AzurePricingServer"]
