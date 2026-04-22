#!/usr/bin/env python3
"""Debug the handle_call_tool function to see why it returns None."""

import asyncio
import sys

sys.path.append(".")

import logging

from mcp.types import TextContent

from azure_pricing_mcp.server import AzurePricingServer

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)


async def debug_handle_call_tool(name: str, arguments: dict):
    """Debug version of handle_call_tool with extensive logging."""

    print("=== DEBUG handle_call_tool ===")
    print(f"name: {name}")
    print(f"arguments: {arguments}")
    print()

    try:
        async with AzurePricingServer() as pricing_server:
            print("Step 1: Entered pricing_server context")

            if name == "azure_price_search":
                print("Step 2: Matched azure_price_search")

                result = await pricing_server.search_azure_prices(**arguments)
                print(f"Step 3: Got result, type: {type(result)}")

                # Format the response
                if result["items"]:
                    print("Step 4a: result['items'] is truthy")
                    # ... rest of truthy path
                    return [TextContent(type="text", text="Truthy path")]

                else:
                    print("Step 4b: result['items'] is falsy, taking else path")
                    response_text = "No pricing results found for the specified criteria."

                    # Add SKU validation info if present
                    if "sku_validation" in result:
                        print("Step 5: Adding SKU validation")
                        validation = result["sku_validation"]
                        response_text += f"\\n\\n⚠️ {validation['message']}\\n"

                        if validation["suggestions"]:
                            print("Step 6: Adding suggestions")
                            response_text += "\\n🔍 Did you mean one of these SKUs?\\n"
                            for suggestion in validation["suggestions"][:5]:
                                sku_name = suggestion.get("sku_name", "Unknown")
                                price = suggestion.get("price", "Unknown")
                                unit = suggestion.get("unit", "Unknown")
                                region = suggestion.get("region", "")

                                response_text += f"   • {sku_name}: ${price} per {unit}"
                                if region:
                                    response_text += f" (in {region})"
                                response_text += "\\n"

                    print("Step 7: About to return response")
                    return [TextContent(type="text", text=response_text)]

            elif name == "azure_price_compare":
                print("Step 2: Matched azure_price_compare")
                return [TextContent(type="text", text="Compare not implemented in debug")]

            elif name == "azure_cost_estimate":
                print("Step 2: Matched azure_cost_estimate")
                return [TextContent(type="text", text="Estimate not implemented in debug")]

            elif name == "azure_discover_skus":
                print("Step 2: Matched azure_discover_skus")
                return [TextContent(type="text", text="Discover not implemented in debug")]

            elif name == "azure_sku_discovery":
                print("Step 2: Matched azure_sku_discovery")
                return [TextContent(type="text", text="SKU discovery not implemented in debug")]

            elif name == "get_customer_discount":
                print("Step 2: Matched get_customer_discount")
                return [TextContent(type="text", text="Discount not implemented in debug")]

            else:
                print(f"Step 2: Unknown tool: {name}")
                return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        print(f"Exception occurred: {e}")
        import traceback

        traceback.print_exc()
        return [TextContent(type="text", text=f"Error: {str(e)}")]

    print("CRITICAL: Reached end of function without returning!")
    return None  # This should never happen


if __name__ == "__main__":

    async def test():
        result = await debug_handle_call_tool(
            "azure_price_search",
            {"service_name": "Virtual Machines", "sku_name": "Standard_F16", "price_type": "Consumption", "limit": 10},
        )
        print(f"Final result: {result}")
        print(f"Result type: {type(result)}")

    asyncio.run(test())
