#!/usr/bin/env python3
"""Debug the SKU suggestions iteration to find the NoneType error."""

import asyncio
import json
import sys

sys.path.append(".")

from azure_pricing_mcp.server import AzurePricingServer


async def debug_suggestions():
    """Debug the SKU validation suggestions."""

    arguments = {
        "service_name": "Virtual Machines",
        "sku_name": "Standard_F16",
        "price_type": "Consumption",
        "limit": 10,
    }

    async with AzurePricingServer() as pricing_server:
        result = await pricing_server.search_azure_prices(**arguments)

        print("Result keys:", result.keys())
        print()

        if "sku_validation" in result:
            validation = result["sku_validation"]
            print("SKU Validation:")
            print(json.dumps(validation, indent=2))
            print()

            print("Checking suggestions:")
            suggestions = validation.get("suggestions")
            print(f"suggestions = {suggestions}")
            print(f"type(suggestions) = {type(suggestions)}")
            print(f"len(suggestions) = {len(suggestions) if suggestions is not None else 'None'}")
            print()

            if suggestions:
                print("Iterating through suggestions:")
                try:
                    for i, suggestion in enumerate(suggestions[:5]):
                        print(f"  suggestion {i}: {suggestion}")
                        print(f"    type: {type(suggestion)}")

                        if suggestion:
                            print(f"    sku_name: {suggestion.get('sku_name', 'MISSING')}")
                            print(f"    price: {suggestion.get('price', 'MISSING')}")
                            print(f"    unit: {suggestion.get('unit', 'MISSING')}")
                            print(f"    region: {suggestion.get('region', 'MISSING')}")
                        else:
                            print("    suggestion is None/falsy!")
                        print()
                except Exception as e:
                    print(f"ERROR iterating suggestions: {e}")
                    import traceback

                    traceback.print_exc()
            else:
                print("No suggestions to iterate")


if __name__ == "__main__":
    asyncio.run(debug_suggestions())
