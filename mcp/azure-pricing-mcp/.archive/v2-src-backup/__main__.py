"""
Entry point for running the Azure Pricing MCP Server as a module.
Usage: python -m azure_pricing_mcp
"""

import asyncio

from .server import main

if __name__ == "__main__":
    asyncio.run(main())
