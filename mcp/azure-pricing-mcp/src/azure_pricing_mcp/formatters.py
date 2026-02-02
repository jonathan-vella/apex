"""Response formatters for Azure Pricing MCP Server."""

import json
from typing import Any

from azure_pricing_mcp.config import DEFAULT_CUSTOMER_DISCOUNT

# Discount tip messages
DISCOUNT_TIP_DEFAULT_USED = (
    f"💡 Tip: A {DEFAULT_CUSTOMER_DISCOUNT:.0f}% discount applied by default. "
    "Use 'discount_percentage' parameter to customize or set to 0 for list prices."
)
DISCOUNT_TIP_NO_DISCOUNT = (
    "💡 Want to see potential savings? Use the 'discount_percentage' parameter "
    "to apply your organization's negotiated discount rate."
)


def _get_discount_tip(result: dict[str, Any]) -> str:
    """Get appropriate discount tip based on metadata.

    Args:
        result: The result dictionary that may contain _discount_metadata

    Returns:
        A tip string, or empty string if no tip is appropriate
    """
    metadata = result.get("_discount_metadata", {})

    # If user explicitly specified a discount, no tip needed
    if metadata.get("discount_specified", False):
        return ""

    # If default discount was used, show the default-used tip
    if metadata.get("used_default_discount", False):
        return DISCOUNT_TIP_DEFAULT_USED

    # No discount was applied and user didn't specify one - suggest the feature
    return DISCOUNT_TIP_NO_DISCOUNT


def format_price_search_response(result: dict[str, Any]) -> str:
    """Format the price search response for display."""
    items = result.get("items", [])

    if items:
        formatted_items = []
        for item in items:
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

            if "originalPrice" in item:
                original_price = item["originalPrice"]
                discounted_price = item["retailPrice"]
                savings_amount = original_price - discounted_price

                formatted_item["original_price"] = original_price
                formatted_item["savings_amount"] = round(savings_amount, 6)
                formatted_item["savings_percentage"] = (
                    round((savings_amount / original_price * 100), 2) if original_price > 0 else 0
                )

            formatted_items.append(formatted_item)

        if result["count"] > 0:
            response_text = f"Found {result['count']} Azure pricing results:\n\n"

            # Add retirement warnings FIRST
            if "retirement_warnings" in result and result["retirement_warnings"]:
                response_text += _format_retirement_warnings(result["retirement_warnings"])

            # Add discount information
            if "discount_applied" in result:
                response_text += f"💰 **Customer Discount Applied: {result['discount_applied']['percentage']}%**\n"
                response_text += f"   {result['discount_applied']['note']}\n\n"

            # Add SKU validation info
            if "sku_validation" in result:
                response_text += _format_sku_validation(result["sku_validation"])

            # Add clarification info
            if "clarification" in result:
                response_text += _format_clarification(result["clarification"])

            # Add summary of savings
            if "discount_applied" in result:
                response_text += _format_savings_summary(formatted_items)

            response_text += "**Detailed Pricing:**\n"
            response_text += json.dumps(formatted_items, indent=2)

            return response_text
        else:
            return "No valid pricing results found."
    else:
        response_text = "No pricing results found for the specified criteria."

        if "discount_applied" in result:
            response_text += f"\n\n💰 Note: Your {result['discount_applied']['percentage']}% customer discount would have been applied to any results."

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

        return response_text


def _format_retirement_warnings(warnings: list[dict[str, Any]]) -> str:
    """Format retirement warnings for display."""
    response_text = ""
    for warning in warnings:
        status = warning.get("status", "")
        if status == "retirement_announced":
            response_text += f"⚠️ **RETIREMENT WARNING: {warning['series_name']}**\n"
            response_text += "   Status: Retirement Announced\n"
            if warning.get("retirement_date"):
                response_text += f"   Retirement Date: {warning['retirement_date']}\n"
            if warning.get("replacement"):
                response_text += f"   Recommendation: Migrate to {warning['replacement']}\n"
            if warning.get("migration_guide_url"):
                response_text += f"   Migration Guide: {warning['migration_guide_url']}\n"
            response_text += "\n"
        elif status == "retired":
            response_text += f"🚫 **RETIRED: {warning['series_name']}**\n"
            response_text += "   Status: No longer available\n"
            if warning.get("replacement"):
                response_text += f"   Recommendation: Use {warning['replacement']} instead\n"
            if warning.get("migration_guide_url"):
                response_text += f"   Migration Guide: {warning['migration_guide_url']}\n"
            response_text += "\n"
        elif status == "previous_gen":
            response_text += f"ℹ️ **PREVIOUS GENERATION: {warning['series_name']}**\n"
            response_text += "   Status: Newer versions available\n"
            if warning.get("replacement"):
                response_text += f"   Recommendation: Consider upgrading to {warning['replacement']}\n"
            response_text += "\n"
    return response_text


def _format_sku_validation(validation: dict[str, Any]) -> str:
    """Format SKU validation info for display."""
    response_text = f"⚠️ SKU Validation: {validation['message']}\n"
    if validation["suggestions"]:
        response_text += "🔍 Suggested SKUs:\n"
        for suggestion in validation["suggestions"][:3]:
            response_text += f"   • {suggestion['sku_name']}: ${suggestion['price']} per {suggestion['unit']}\n"
        response_text += "\n"
    return response_text


def _format_clarification(clarification: dict[str, Any]) -> str:
    """Format clarification info for display."""
    response_text = f"ℹ️ {clarification['message']}\n"
    if clarification["suggestions"]:
        response_text += "Top matches:\n"
        for suggestion in clarification["suggestions"]:
            response_text += f"   • {suggestion}\n"
        response_text += "\n"
    return response_text


def _format_savings_summary(formatted_items: list[dict[str, Any]]) -> str:
    """Format savings summary for display."""
    total_original_cost = sum(item.get("original_price", 0) for item in formatted_items)
    total_discounted_cost = sum(item.get("discounted_price", 0) for item in formatted_items)
    total_savings = total_original_cost - total_discounted_cost

    if total_savings > 0:
        response_text = "💰 **Total Savings Summary:**\n"
        response_text += f"   Original Total: ${total_original_cost:.6f}\n"
        response_text += f"   Discounted Total: ${total_discounted_cost:.6f}\n"
        response_text += f"   **You Save: ${total_savings:.6f}**\n\n"
        return response_text
    return ""


def format_price_compare_response(result: dict[str, Any]) -> str:
    """Format the price comparison response for display."""
    response_text = f"Price comparison for {result['service_name']}:\n\n"

    if "discount_applied" in result:
        response_text += f"💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n\n"

    response_text += json.dumps(result["comparisons"], indent=2)

    return response_text


def format_region_recommend_response(result: dict[str, Any]) -> str:
    """Format the region recommendation response for display."""
    if "error" in result:
        return f"Error: {result['error']}"

    recommendations = result.get("recommendations", [])
    if not recommendations:
        return "No region recommendations found for the specified criteria."

    response_text = f"""🌍 Region Recommendations for {result['service_name']} - {result['sku_name']}

Currency: {result['currency']}
Total regions found: {result['total_regions_found']}
Showing top: {result['showing_top']}
"""

    if "discount_applied" in result:
        response_text += f"\n💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n"

    if "summary" in result:
        summary = result["summary"]
        response_text += f"""
📊 Summary:
   🥇 Cheapest: {summary['cheapest_location']} ({summary['cheapest_region']}) - ${summary['cheapest_price']:.6f}
   🥉 Most Expensive: {summary['most_expensive_location']} ({summary['most_expensive_region']}) - ${summary['most_expensive_price']:.6f}
   💰 Max Savings: {summary['max_savings_percentage']:.1f}% by choosing the cheapest region
"""

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

        rank_display = {1: "🥇 1", 2: "🥈 2", 3: "🥉 3"}.get(i, str(i))
        spot_display = f"${spot_price:.6f}" if spot_price else "N/A"

        response_text += (
            f"| {rank_display} | {region} | {location} | ${price:.6f}/{unit} | {spot_display} | {savings:.1f}% |\n"
        )

    # Spot pricing note
    spot_available = [rec for rec in recommendations if rec.get("spot_price")]
    if spot_available:
        response_text += "\n💡 **Spot Pricing Available:**\n"
        for rec in spot_available[:5]:
            location = rec.get("location", "N/A")
            spot_price = rec.get("spot_price", 0)
            on_demand = rec.get("retail_price", 0)
            spot_savings = ((on_demand - spot_price) / on_demand * 100) if on_demand > 0 else 0
            response_text += (
                f"   • {location}: Spot @ ${spot_price:.4f}/hr ({spot_savings:.0f}% cheaper than On-Demand)\n"
            )
        response_text += "   ⚠️ Note: Spot VMs can be evicted when Azure needs capacity\n"

    if "discount_applied" in result and recommendations and "original_price" in recommendations[0]:
        response_text += "\n💵 Original prices (before discount):\n"
        for i, rec in enumerate(recommendations[:3], 1):
            location = rec.get("location", "N/A")
            original = rec.get("original_price", 0)
            response_text += f"   {i}. {location}: ${original:.6f}\n"

    return response_text


def format_cost_estimate_response(result: dict[str, Any]) -> str:
    """Format the cost estimate response for display."""
    if "error" in result:
        return f"Error: {result['error']}"

    estimate_text = f"""
Cost Estimate for {result['service_name']} - {result['sku_name']}
Region: {result['region']}
Product: {result['product_name']}
Unit: {result['unit_of_measure']}
Currency: {result['currency']}
"""

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
            if "original_hourly_rate" in plan:
                estimate_text += f"""- Original Hourly Rate: ${plan['original_hourly_rate']}
- Original Monthly Cost: ${plan['original_monthly_cost']}
- Original Yearly Cost: ${plan['original_yearly_cost']}
"""

    return estimate_text


def format_discover_skus_response(result: dict[str, Any]) -> str:
    """Format the discover SKUs response for display."""
    skus = result.get("skus", [])
    if skus:
        return f"Found {result['total_skus']} SKUs for {result['service_name']}:\n\n" + json.dumps(skus, indent=2)
    else:
        return "No SKUs found for the specified service."


def format_sku_discovery_response(result: dict[str, Any]) -> str:
    """Format the SKU discovery response for display."""
    if result["service_found"]:
        service_name = result["service_found"]
        original_search = result["original_search"]
        skus = result["skus"]
        total_skus = result["total_skus"]
        match_type = result.get("match_type", "exact")

        response_text = f"SKU Discovery for '{original_search}'"

        if match_type == "exact_mapping":
            response_text += f" (mapped to: {service_name})"

        response_text += f"\n\nFound {total_skus} SKUs for {service_name}:\n\n"

        products: dict[str, list[tuple]] = {}
        for sku_name, sku_data in skus.items():
            product = sku_data["product_name"]
            if product not in products:
                products[product] = []
            products[product].append((sku_name, sku_data))

        for product, product_skus in products.items():
            response_text += f"📦 {product}:\n"
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

        return response_text
    else:
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

        return response_text


def format_customer_discount_response(result: dict[str, Any]) -> str:
    """Format the customer discount response for display."""
    return f"""Customer Discount Information

Customer ID: {result['customer_id']}
Discount Type: {result['discount_type']}
Discount Percentage: {result['discount_percentage']}%
Description: {result['description']}
Applicable Services: {result['applicable_services']}

{result['note']}
"""


def format_ri_pricing_response(result: dict[str, Any]) -> str:
    """Format the RI pricing response for display."""
    response_lines = []

    if result.get("comparison"):
        response_lines.append("### Reserved Instance Savings Analysis\n")
        for comp in result["comparison"]:
            response_lines.append(f"- **{comp['sku']}** ({comp['region']}) - {comp['term']}")
            response_lines.append(f"  - Savings: **{comp['savings_percentage']}%**")
            response_lines.append(f"  - RI Rate: {comp['ri_hourly']}/hr vs OD Rate: {comp['od_hourly']}/hr")
            if comp.get("break_even_months"):
                response_lines.append(f"  - Break-even: **{comp['break_even_months']} months**")
            response_lines.append(f"  - Est. Annual Savings: ${comp['annual_savings']:,}")
            response_lines.append("")

    if result.get("ri_items"):
        response_lines.append(f"### Raw RI Pricing ({result['count']} items)")
        for item in result["ri_items"][:10]:
            response_lines.append(
                f"- {item.get('skuName')} ({item.get('armRegionName')}): "
                f"{item.get('retailPrice')} {result['currency']} / {item.get('unitOfMeasure')} "
                f"({item.get('reservationTerm')})"
            )
        if len(result["ri_items"]) > 10:
            response_lines.append(f"... and {len(result['ri_items']) - 10} more.")
    else:
        response_lines.append("No Reserved Instance pricing found for the given criteria.")

    return "\n".join(response_lines)


# =============================================================================
# Spot VM Tool Formatters
# =============================================================================


def format_spot_eviction_rates_response(result: dict[str, Any]) -> str:
    """Format the Spot eviction rates response for display."""
    # Handle authentication errors
    if "error" in result:
        return _format_spot_error(result)

    eviction_rates = result.get("eviction_rates", [])
    if not eviction_rates:
        return (
            f"No eviction rate data found for the specified SKUs and locations.\n\n"
            f"SKUs queried: {', '.join(result.get('skus_queried', []))}\n"
            f"Locations queried: {', '.join(result.get('locations_queried', []))}"
        )

    response_lines = [
        "### 📊 Spot VM Eviction Rates\n",
        f"Found {result['count']} results\n",
    ]

    # Group by location
    by_location: dict[str, list[dict]] = {}
    for rate in eviction_rates:
        loc = rate.get("location", "unknown")
        if loc not in by_location:
            by_location[loc] = []
        by_location[loc].append(rate)

    # Format table
    response_lines.append("| Location | SKU | Eviction Rate |")
    response_lines.append("|----------|-----|---------------|")

    for location in sorted(by_location.keys()):
        for rate in sorted(by_location[location], key=lambda x: x.get("skuName", "")):
            sku = rate.get("skuName", "N/A")
            eviction = rate.get("evictionRate", "N/A")
            emoji = _get_eviction_rate_emoji(eviction)
            response_lines.append(f"| {location} | {sku} | {emoji} {eviction} |")

    response_lines.append("")
    response_lines.append(result.get("note", ""))

    return "\n".join(response_lines)


def format_spot_price_history_response(result: dict[str, Any]) -> str:
    """Format the Spot price history response for display."""
    # Handle authentication errors
    if "error" in result:
        return _format_spot_error(result)

    if "message" in result and not result.get("price_history"):
        return str(result["message"])

    response_lines = [
        f"### 💰 Spot Price History: {result.get('sku', 'N/A')}\n",
        f"**Location:** {result.get('location', 'N/A')}",
        f"**OS Type:** {result.get('os_type', 'N/A')}",
        f"**Latest Price:** ${result.get('latest_price_usd', 'N/A')}/hour" if result.get("latest_price_usd") else "",
        f"**History Points:** {result.get('history_points', 0)}\n",
    ]

    price_history = result.get("price_history", [])
    if price_history:
        response_lines.append("| Date | Price (USD) |")
        response_lines.append("|------|-------------|")

        # Show up to 20 most recent prices
        for price in price_history[:20]:
            date = price.get("timestamp", "N/A")
            if isinstance(date, str) and len(date) > 10:
                date = date[:10]  # Truncate to date only
            price_usd = price.get("priceUSD", "N/A")
            if isinstance(price_usd, (int, float)):
                price_usd = f"${price_usd:.4f}"
            response_lines.append(f"| {date} | {price_usd} |")

        if len(price_history) > 20:
            response_lines.append(f"\n... and {len(price_history) - 20} more data points.")

    response_lines.append("")
    response_lines.append(result.get("note", ""))

    return "\n".join(response_lines)


def format_simulate_eviction_response(result: dict[str, Any]) -> str:
    """Format the simulate eviction response for display."""
    # Handle authentication errors
    if "error" in result:
        return _format_spot_error(result)

    if result.get("status") == "success":
        return f"""### ✅ Eviction Simulation Triggered

**Status:** Success
**VM Resource ID:** `{result.get('vm_resource_id', 'N/A')}`

{result.get('note', '')}

⚠️ **What happens next:**
1. The VM will receive a Scheduled Event notification
2. After ~30 seconds, the VM will be evicted
3. Use this to test your application's handling of Spot evictions
"""

    return f"Unexpected response: {result}"


def _format_spot_error(result: dict[str, Any]) -> str:
    """Format a Spot tool error response."""
    error_type = result.get("error", "unknown_error")
    message = result.get("message", "An unknown error occurred.")

    response = f"### ❌ {error_type.replace('_', ' ').title()}\n\n{message}\n"

    if "help" in result:
        response += f"\n{result['help']}"

    if "details" in result:
        response += f"\n**Details:** {result['details']}"

    if "expected_format" in result:
        response += f"\n**Expected format:** `{result['expected_format']}`"

    return response


def _get_eviction_rate_emoji(rate: str) -> str:
    """Get an emoji indicator for eviction rate."""
    if not rate:
        return "❓"
    rate_lower = rate.lower()
    if "0-5" in rate_lower:
        return "🟢"  # Low risk
    elif "5-10" in rate_lower:
        return "🟡"  # Medium-low risk
    elif "10-15" in rate_lower:
        return "🟠"  # Medium risk
    elif "15-20" in rate_lower:
        return "🔴"  # High risk
    elif "20" in rate_lower:
        return "⛔"  # Very high risk
    return "❓"
