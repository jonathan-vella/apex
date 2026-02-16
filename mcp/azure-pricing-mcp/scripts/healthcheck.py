#!/usr/bin/env python3
"""
Health check script for Azure Pricing MCP Server Docker container
Verifies the server can start and respond to basic queries
"""

import asyncio
import json
import sys

from azure_pricing_mcp.server import AzurePricingServer


async def health_check():
    """Perform health check on the MCP server."""
    try:
        print("✓ Module imported successfully")

        async with AzurePricingServer() as server:
            print("✓ Server initialized successfully")

            try:
                result = await server._pricing_service.search_prices(
                    service_name="Virtual Machines", region="eastus", limit=1
                )
                if result and result.get("items"):
                    print("✓ Azure API connectivity verified")
                else:
                    print("⚠ API returned no results (might be API issue, not server)")
            except Exception as e:
                print(f"⚠ API connectivity test failed: {e}")

        print("✅ Health check passed")
        return 0

    except Exception as e:
        print(f"❌ Health check failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(health_check())
    sys.exit(exit_code)
