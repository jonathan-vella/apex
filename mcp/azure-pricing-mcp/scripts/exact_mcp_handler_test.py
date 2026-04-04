#!/usr/bin/env python3
"""Test the exact MCP handler code path to reproduce the NoneType error."""

import asyncio
import json
import sys

sys.path.append(".")


from azure_pricing_mcp.server import AzurePricingServer


async def test_exact_handler():
    """Test the exact handler code path that would execute."""

    # These are the exact arguments that would be passed
    name = "azure_price_search"
    arguments = {
        "service_name": "Virtual Machines",
        "sku_name": "Standard_F16",
        "price_type": "Consumption",
        "limit": 10,
    }

    print(f"Testing tool: {name}")
    print(f"Arguments: {json.dumps(arguments, indent=2)}")
    print()

    try:
        async with AzurePricingServer:
            if name == "azure_price_search":
                result = await AzurePricingServer.search_azure_prices(**arguments)

                print("Step 1: Got result from search_azure_prices")
                print(f"Result type: {type(result)}")
                print(f"Result keys: {result.keys() if isinstance(result, dict) else 'Not a dict'}")
                print()

                # Format the response - this is the exact code from the handler
                if result["items"]:
                    print("Step 2a: result['items'] is truthy")
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
                        print("Step 2b: result['count'] > 0")
                        response_text = f"Found {result['count']} Azure pricing results:\\n\\n"

                        # Add discount information if applied
                        if "discount_applied" in result:
                            print("Step 2c: Adding discount info")
                            response_text += f"💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\\n\\n"

                        # Add SKU validation info if present
                        if "sku_validation" in result:
                            print("Step 2d: Adding SKU validation info")
                            validation = result["sku_validation"]
                            response_text += f"⚠️ SKU Validation: {validation['message']}\\n"

                            print(f"  validation type: {type(validation)}")
                            print(
                                f"  validation keys: {validation.keys() if isinstance(validation, dict) else 'Not a dict'}"
                            )

                            if validation["suggestions"]:
                                print("Step 2e: Adding suggestions")
                                response_text += "🔍 Suggested SKUs:\\n"

                                suggestions = validation["suggestions"]
                                print(f"  suggestions type: {type(suggestions)}")
                                print(
                                    f"  suggestions length: {len(suggestions) if suggestions is not None else 'None'}"
                                )

                                if suggestions is not None:
                                    for i, suggestion in enumerate(suggestions[:3]):
                                        print(f"  Processing suggestion {i}: {suggestion}")
                                        print(f"    suggestion type: {type(suggestion)}")

                                        if suggestion is not None:
                                            sku_name = (
                                                suggestion.get("sku_name", "Unknown")
                                                if hasattr(suggestion, "get")
                                                else "No get method"
                                            )
                                            price = (
                                                suggestion.get("price", "Unknown")
                                                if hasattr(suggestion, "get")
                                                else "No get method"
                                            )
                                            unit = (
                                                suggestion.get("unit", "Unknown")
                                                if hasattr(suggestion, "get")
                                                else "No get method"
                                            )

                                            response_text += f"   • {sku_name}: ${price} per {unit}\\n"
                                        else:
                                            print(f"    suggestion {i} is None!")
                                response_text += "\\n"

                        # Add clarification info if present
                        if "clarification" in result:
                            print("Step 2f: Adding clarification info")
                            clarification = result["clarification"]
                            response_text += f"ℹ️ {clarification['message']}\\n"
                            if clarification["suggestions"]:
                                response_text += "Top matches:\\n"
                                for suggestion in clarification["suggestions"]:
                                    response_text += f"   • {suggestion}\\n"
                                response_text += "\\n"

                        response_text += json.dumps(formatted_items, indent=2)
                        print("Step 2g: Final response created successfully")

                    else:
                        print("Step 2h: result['count'] is 0")

                else:
                    print("Step 3a: result['items'] is falsy")
                    response_text = "No pricing results found for the specified criteria."

                    # Add SKU validation info if present
                    if "sku_validation" in result:
                        print("Step 3b: Adding SKU validation for no results")
                        validation = result["sku_validation"]
                        response_text += f"\\n\\n⚠️ {validation['message']}\\n"

                        print(f"  validation type: {type(validation)}")
                        print(f"  validation: {validation}")

                        if validation["suggestions"]:
                            print("Step 3c: Adding suggestions for no results")
                            response_text += "\\n🔍 Did you mean one of these SKUs?\\n"

                            suggestions = validation["suggestions"]
                            print(f"  suggestions type: {type(suggestions)}")
                            print(f"  suggestions: {suggestions}")

                            if suggestions is not None:
                                try:
                                    for suggestion in suggestions[:5]:
                                        print(f"  Processing suggestion: {suggestion}")
                                        print(f"    suggestion type: {type(suggestion)}")

                                        if suggestion is not None and hasattr(suggestion, "get"):
                                            sku_name = suggestion.get("sku_name", "Unknown")
                                            price = suggestion.get("price", "Unknown")
                                            unit = suggestion.get("unit", "Unknown")
                                            region = suggestion.get("region", "")

                                            response_text += f"   • {sku_name}: ${price} per {unit}"
                                            if region:
                                                response_text += f" (in {region})"
                                            response_text += "\\n"
                                        else:
                                            print(f"    suggestion is None or has no get method: {suggestion}")
                                except Exception as e:
                                    print(f"ERROR iterating suggestions: {e}")
                                    import traceback

                                    traceback.print_exc()
                                    raise

                    print("Step 3d: Response for no results created successfully")

                print("SUCCESS: Handler completed without error")

    except Exception as e:
        print(f"ERROR in handler: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_exact_handler())
