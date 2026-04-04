#!/usr/bin/env python3
"""Simulate the exact MCP tool call that happens when asking about Standard_F16 VM cost."""

import asyncio
import json
import sys

sys.path.append(".")


from azure_pricing_mcp.server import AzurePricingServer

pricing_server = AzurePricingServer()


async def simulate_tool_call():
    """Simulate the exact tool call that would be made."""

    # This simulates what happens when someone asks "How much does a Standard_F16 VM cost?"
    # The MCP client would likely call azure_price_search with these parameters

    tool_name = "azure_price_search"
    arguments = {
        "service_name": "Virtual Machines",
        "sku_name": "Standard_F16",
        "price_type": "Consumption",
        "limit": 10,
    }

    print(f"Simulating MCP tool call: {tool_name}")
    print(f"Arguments: {json.dumps(arguments, indent=2)}")
    print()

    try:
        # This is the exact code path that runs in handle_call_tool
        async with pricing_server:
            if tool_name == "azure_price_search":
                result = await pricing_server.search_azure_prices(**arguments)

                print("Raw search result:")
                print(json.dumps(result, indent=2))
                print()

                # Format the response (this is where the error might occur)
                if result["items"]:
                    formatted_items = []
                    for item in result["items"]:
                        formatted_items.append(
                            {
                                "service": item.get("serviceName"),
                                "product": item.get("productName"),
                                "sku": item.get("skuName"),
                                "region": item.get("armRegionName"),
                                "location": item.get("location"),
                                "price": item.get("retailPrice"),
                                "unit": item.get("unitOfMeasure"),
                                "type": item.get("type"),
                                "savings_plans": item.get("savingsPlan", []),
                            }
                        )

                    if result["count"] > 0:
                        response_text = f"Found {result['count']} Azure pricing results:\n\n"

                        # Add discount information if applied
                        if "discount_applied" in result:
                            response_text += f"💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n\n"

                        # Add SKU validation info if present
                        if "sku_validation" in result:
                            validation = result["sku_validation"]
                            response_text += f"⚠️ SKU Validation: {validation['message']}\n"
                            if validation["suggestions"]:
                                response_text += "🔍 Suggested SKUs:\n"
                                for suggestion in validation["suggestions"][:3]:
                                    response_text += f"   • {suggestion['sku_name']}: ${suggestion['price']} per {suggestion['unit']}\n"
                                response_text += "\n"

                        # Add clarification info if present
                        if "clarification" in result:
                            clarification = result["clarification"]
                            response_text += f"ℹ️ {clarification['message']}\n"
                            if clarification["suggestions"]:
                                response_text += "Top matches:\n"
                                for suggestion in clarification["suggestions"]:
                                    response_text += f"   • {suggestion}\n"
                                response_text += "\n"

                        response_text += json.dumps(formatted_items, indent=2)

                        print("FINAL RESPONSE:")
                        print(response_text)
                    else:
                        response_text = "No pricing results found for the specified criteria."

                        # Add SKU validation info if present
                        if "sku_validation" in result:
                            validation = result["sku_validation"]
                            response_text += f"\n\n⚠️ {validation['message']}\n"
                            if validation["suggestions"]:
                                response_text += "\n🔍 Did you mean one of these SKUs?\n"
                                for suggestion in validation["suggestions"][:5]:
                                    response_text += f"   • {suggestion['sku_name']}: ${suggestion['price']} per {suggestion['unit']}"
                                    if suggestion["region"]:
                                        response_text += f" (in {suggestion['region']})"
                                    response_text += "\n"

                        print("FINAL RESPONSE:")
                        print(response_text)
                else:
                    print("ERROR: result['items'] is not truthy")
                    print(f"result['items'] = {result.get('items')}")
                    print(f"type(result['items']) = {type(result.get('items'))}")

    except Exception as e:
        print("ERROR:", str(e))
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(simulate_tool_call())
