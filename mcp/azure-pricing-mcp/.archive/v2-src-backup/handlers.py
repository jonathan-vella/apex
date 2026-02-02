"""Tool handlers for Azure Pricing MCP Server."""

import json
import logging
from typing import Any

from mcp.types import TextContent

# Use the same logger namespace as server.py to ensure consistent stderr output
logger = logging.getLogger("azure_pricing_mcp")


def register_tool_handlers(server: Any, pricing_server: Any) -> None:
    """Register all tool call handlers with the server.

    Args:
        server: The MCP server instance
        pricing_server: The AzurePricingServer instance
    """

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle tool calls."""

        try:
            async with pricing_server:
                if name == "azure_price_search":
                    return await _handle_price_search(pricing_server, arguments)

                elif name == "azure_price_compare":
                    return await _handle_price_compare(pricing_server, arguments)

                elif name == "azure_cost_estimate":
                    return await _handle_cost_estimate(pricing_server, arguments)

                elif name == "azure_discover_skus":
                    return await _handle_discover_skus(pricing_server, arguments)

                elif name == "azure_sku_discovery":
                    return await _handle_sku_discovery(pricing_server, arguments)

                elif name == "azure_region_recommend":
                    return await _handle_region_recommend(pricing_server, arguments)

                elif name == "get_customer_discount":
                    return await _handle_customer_discount(pricing_server, arguments)

                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]

        except Exception as e:
            logger.error(f"Error handling tool call {name}: {e}")
            return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _handle_price_search(pricing_server, arguments: dict) -> list[TextContent]:
    """Handle azure_price_search tool calls."""
    result = await pricing_server.search_azure_prices(**arguments)

    # Format the response
    if result["items"]:
        formatted_items = []
        for item in result["items"]:
            formatted_item = {
                "service": item.get("serviceName"),
                "product": item.get("productName"),
                "sku": item.get("skuName"),
                "region": item.get("armRegionName"),
                "location": item.get("location"),
                "discounted_price": item.get("retailPrice"),
                "unit": item.get("unitOfMeasure"),
                "type": item.get("type"),
                "savings_plans": item.get("savingsPlan", []),
            }

            # Add original price and savings if discount was applied
            if "originalPrice" in item:
                original_price = item["originalPrice"]
                discounted_price = item["retailPrice"]
                savings_amount = original_price - discounted_price

                formatted_item["original_price"] = original_price
                formatted_item["savings_amount"] = round(savings_amount, 6)
                formatted_item["savings_percentage"] = (
                    round((savings_amount / original_price * 100),
                          2) if original_price > 0 else 0
                )

            formatted_items.append(formatted_item)

        if result["count"] > 0:
            response_text = f"Found {result['count']} Azure pricing results:\n\n"

            # Add discount information if applied
            if "discount_applied" in result:
                response_text += f"💰 **Customer Discount Applied: {result['discount_applied']['percentage']}%**\n"
                response_text += f"   {result['discount_applied']['note']}\n\n"

            # Add SKU validation info if present
            if "sku_validation" in result:
                validation = result["sku_validation"]
                response_text += f"⚠️ SKU Validation: {validation['message']}\n"
                if validation["suggestions"]:
                    response_text += "🔍 Suggested SKUs:\n"
                    for suggestion in validation["suggestions"][:3]:
                        response_text += (
                            f"   • {suggestion['sku_name']}: ${suggestion['price']} per {suggestion['unit']}\n"
                        )
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

            # Add summary of savings if discount was applied
            if "discount_applied" in result:
                total_original_cost = sum(
                    item.get("original_price", 0) for item in formatted_items)
                total_discounted_cost = sum(
                    item.get("discounted_price", 0) for item in formatted_items)
                total_savings = total_original_cost - total_discounted_cost

                if total_savings > 0:
                    response_text += "💰 **Total Savings Summary:**\n"
                    response_text += f"   Original Total: ${total_original_cost:.6f}\n"
                    response_text += f"   Discounted Total: ${total_discounted_cost:.6f}\n"
                    response_text += f"   **You Save: ${total_savings:.6f}**\n\n"

            response_text += "**Detailed Pricing:**\n"
            response_text += json.dumps(formatted_items, indent=2)

            return [TextContent(type="text", text=response_text)]
        else:
            response_text = "No valid pricing results found."
            return [TextContent(type="text", text=response_text)]
    else:
        response_text = "No pricing results found for the specified criteria."

        # Show discount info even when no results
        if "discount_applied" in result:
            response_text += f"\n\n💰 Note: Your {result['discount_applied']['percentage']}% customer discount would have been applied to any results."

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

        return [TextContent(type="text", text=response_text)]


async def _handle_price_compare(pricing_server, arguments: dict) -> list[TextContent]:
    """Handle azure_price_compare tool calls."""
    result = await pricing_server.compare_prices(**arguments)

    response_text = f"Price comparison for {result['service_name']}:\n\n"

    # Add discount information if applied
    if "discount_applied" in result:
        response_text += f"💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n\n"

    response_text += json.dumps(result["comparisons"], indent=2)

    return [TextContent(type="text", text=response_text)]


async def _handle_region_recommend(pricing_server, arguments: dict) -> list[TextContent]:
    """Handle azure_region_recommend tool calls."""
    result = await pricing_server.recommend_regions(**arguments)

    # Check for errors
    if "error" in result:
        return [TextContent(type="text", text=f"Error: {result['error']}")]

    recommendations = result.get("recommendations", [])
    if not recommendations:
        return [TextContent(type="text", text="No region recommendations found for the specified criteria.")]

    # Build response text
    response_text = f"""🌍 Region Recommendations for {result['service_name']} - {result['sku_name']}

Currency: {result['currency']}
Total regions found: {result['total_regions_found']}
Showing top: {result['showing_top']}
"""

    # Add discount information if applied
    if "discount_applied" in result:
        response_text += f"\n💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n"

    # Add summary
    if "summary" in result:
        summary = result["summary"]
        response_text += f"""
📊 Summary:
   🥇 Cheapest: {summary['cheapest_location']} ({summary['cheapest_region']}) - ${summary['cheapest_price']:.6f}
   🥉 Most Expensive: {summary['most_expensive_location']} ({summary['most_expensive_region']}) - ${summary['most_expensive_price']:.6f}
   💰 Max Savings: {summary['max_savings_percentage']:.1f}% by choosing the cheapest region
"""

    # Build recommendations table
    response_text += "\n📋 Ranked Recommendations (On-Demand Pricing):\n\n"
    response_text += "| Rank | Region | Location | On-Demand Price | Spot Price | Savings vs Max |\n"
    response_text += "|------|--------|----------|-----------------|------------|----------------|\n"

    for i, rec in enumerate(recommendations, 1):
        region = rec.get("region", "N/A")
        location = rec.get("location", "N/A")
        price = rec.get("retail_price", 0)
        savings = rec.get("savings_vs_most_expensive", 0)
        unit = rec.get("unit_of_measure", "")
        spot_price = rec.get("spot_price")

        # Add medal emoji for top 3
        rank_display = {1: "🥇 1", 2: "🥈 2", 3: "🥉 3"}.get(i, str(i))

        # Format spot price column
        spot_display = f"${spot_price:.6f}" if spot_price else "N/A"

        response_text += (
            f"| {rank_display} | {region} | {location} | ${price:.6f}/{unit} | {spot_display} | {savings:.1f}% |\n"
        )

    # Add Spot pricing note if any recommendations have spot pricing
    spot_available = [rec for rec in recommendations if rec.get("spot_price")]
    if spot_available:
        response_text += "\n💡 **Spot Pricing Available:**\n"
        for rec in spot_available[:5]:  # Show top 5 with spot pricing
            location = rec.get("location", "N/A")
            spot_price = rec.get("spot_price", 0)
            on_demand = rec.get("retail_price", 0)
            spot_savings = ((on_demand - spot_price) /
                            on_demand * 100) if on_demand > 0 else 0
            response_text += (
                f"   • {location}: Spot @ ${spot_price:.4f}/hr ({spot_savings:.0f}% cheaper than On-Demand)\n"
            )
        response_text += "   ⚠️ Note: Spot VMs can be evicted when Azure needs capacity\n"

    # Add original prices if discount was applied
    if "discount_applied" in result and recommendations and "original_price" in recommendations[0]:
        response_text += "\n💵 Original prices (before discount):\n"
        # Show top 3 original prices
        for i, rec in enumerate(recommendations[:3], 1):
            location = rec.get("location", "N/A")
            original = rec.get("original_price", 0)
            response_text += f"   {i}. {location}: ${original:.6f}\n"

    return [TextContent(type="text", text=response_text)]


async def _handle_cost_estimate(pricing_server, arguments: dict) -> list[TextContent]:
    """Handle azure_cost_estimate tool calls."""
    result = await pricing_server.estimate_costs(**arguments)

    if "error" in result:
        return [TextContent(type="text", text=f"Error: {result['error']}")]

    # Format cost estimate
    estimate_text = f"""
Cost Estimate for {result['service_name']} - {result['sku_name']}
Region: {result['region']}
Product: {result['product_name']}
Unit: {result['unit_of_measure']}
Currency: {result['currency']}
"""

    # Add discount information if applied
    if "discount_applied" in result:
        estimate_text += f"\n💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n"

    estimate_text += f"""
Usage Assumptions:
- Hours per month: {result['usage_assumptions']['hours_per_month']}
- Hours per day: {result['usage_assumptions']['hours_per_day']}

On-Demand Pricing:
- Hourly Rate: ${result['on_demand_pricing']['hourly_rate']}
- Daily Cost: ${result['on_demand_pricing']['daily_cost']}
- Monthly Cost: ${result['on_demand_pricing']['monthly_cost']}
- Yearly Cost: ${result['on_demand_pricing']['yearly_cost']}
"""

    # Add original pricing if discount was applied
    if "discount_applied" in result and "original_hourly_rate" in result["on_demand_pricing"]:
        estimate_text += f"""
Original Pricing (before discount):
- Hourly Rate: ${result['on_demand_pricing']['original_hourly_rate']}
- Daily Cost: ${result['on_demand_pricing']['original_daily_cost']}
- Monthly Cost: ${result['on_demand_pricing']['original_monthly_cost']}
- Yearly Cost: ${result['on_demand_pricing']['original_yearly_cost']}
"""

    if result["savings_plans"]:
        estimate_text += "\nSavings Plans Available:\n"
        for plan in result["savings_plans"]:
            estimate_text += f"""
{plan['term']} Term:
- Hourly Rate: ${plan['hourly_rate']}
- Monthly Cost: ${plan['monthly_cost']}
- Yearly Cost: ${plan['yearly_cost']}
- Savings: {plan['savings_percent']}% (${plan['annual_savings']} annually)
"""
            # Add original pricing for savings plans if discount was applied
            if "original_hourly_rate" in plan:
                estimate_text += f"""- Original Hourly Rate: ${plan['original_hourly_rate']}
- Original Monthly Cost: ${plan['original_monthly_cost']}
- Original Yearly Cost: ${plan['original_yearly_cost']}
"""

    return [TextContent(type="text", text=estimate_text)]


async def _handle_discover_skus(pricing_server, arguments: dict) -> list[TextContent]:
    """Handle azure_discover_skus tool calls."""
    result = await pricing_server.discover_skus(**arguments)

    # Format the response
    skus = result.get("skus", [])
    if skus:
        return [
            TextContent(
                type="text",
                text=f"Found {result['total_skus']} SKUs for {result['service_name']}:\n\n"
                + json.dumps(skus, indent=2),
            )
        ]
    else:
        return [TextContent(type="text", text="No SKUs found for the specified service.")]


async def _handle_sku_discovery(pricing_server, arguments: dict) -> list[TextContent]:
    """Handle azure_sku_discovery tool calls."""
    result = await pricing_server.discover_service_skus(**arguments)

    if result["service_found"]:
        # Format successful SKU discovery
        service_name = result["service_found"]
        original_search = result["original_search"]
        skus = result["skus"]
        total_skus = result["total_skus"]
        match_type = result.get("match_type", "exact")

        response_text = f"SKU Discovery for '{original_search}'"

        if match_type == "exact_mapping":
            response_text += f" (mapped to: {service_name})"

        response_text += f"\n\nFound {total_skus} SKUs for {service_name}:\n\n"

        # Group SKUs by product
        products: dict[str, list[tuple]] = {}
        for sku_name, sku_data in skus.items():
            product = sku_data["product_name"]
            if product not in products:
                products[product] = []
            products[product].append((sku_name, sku_data))

        for product, product_skus in products.items():
            response_text += f"📦 {product}:\n"
            # Limit to 10 per product
            for sku_name, sku_data in sorted(product_skus)[:10]:
                min_price = sku_data.get("min_price", 0)
                unit = sku_data.get("sample_unit", "Unknown")
                region_count = len(sku_data.get("regions", []))

                response_text += f"   • {sku_name}\n"
                response_text += f"     Price: ${min_price} per {unit}"
                if region_count > 1:
                    response_text += f" (available in {region_count} regions)"
                response_text += "\n"
            response_text += "\n"

        return [TextContent(type="text", text=response_text)]
    else:
        # Format suggestions when no exact match
        suggestions = result.get("suggestions", [])
        original_search = result["original_search"]

        if suggestions:
            response_text = f"No exact match found for '{original_search}'\n\n"
            response_text += "🔍 Did you mean one of these services?\n\n"

            for i, suggestion in enumerate(suggestions[:5], 1):
                service_name = suggestion["service_name"]
                match_reason = suggestion["match_reason"]
                sample_items = suggestion["sample_items"]

                response_text += f"{i}. {service_name}\n"
                response_text += f"   Reason: {match_reason}\n"

                if sample_items:
                    response_text += "   Sample SKUs:\n"
                    for item in sample_items[:3]:
                        sku = item.get("skuName", "Unknown")
                        price = item.get("retailPrice", 0)
                        unit = item.get("unitOfMeasure", "Unknown")
                        response_text += f"     • {sku}: ${price} per {unit}\n"
                response_text += "\n"

            response_text += "💡 Try using one of the exact service names above."
        else:
            response_text = f"No matches found for '{original_search}'\n\n"
            response_text += "💡 Try using terms like:\n"
            response_text += "• 'app service' or 'web app' for Azure App Service\n"
            response_text += "• 'vm' or 'virtual machine' for Virtual Machines\n"
            response_text += "• 'storage' or 'blob' for Storage services\n"
            response_text += "• 'sql' or 'database' for SQL Database\n"
            response_text += "• 'kubernetes' or 'aks' for Azure Kubernetes Service"

        return [TextContent(type="text", text=response_text)]


async def _handle_customer_discount(pricing_server, arguments: dict) -> list[TextContent]:
    """Handle get_customer_discount tool calls."""
    result = await pricing_server.get_customer_discount(**arguments)

    response_text = f"""Customer Discount Information

Customer ID: {result['customer_id']}
Discount Type: {result['discount_type']}
Discount Percentage: {result['discount_percentage']}%
Description: {result['description']}
Applicable Services: {result['applicable_services']}

{result['note']}
"""

    return [TextContent(type="text", text=response_text)]
