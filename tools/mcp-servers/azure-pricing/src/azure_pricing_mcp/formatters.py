"""Response formatters for Azure Pricing MCP Server.

v5.0 — every public ``format_*_response`` for the 11 in-scope tools accepts a
``response_format`` keyword argument (``compact`` | ``table`` | ``full``,
default ``compact``). Compact mode emits a token-efficient markdown summary;
``full`` reproduces the verbose v4 string for back-compat.
"""

import json
from typing import Any

from azure_pricing_mcp.config import DEFAULT_CUSTOMER_DISCOUNT
from azure_pricing_mcp.databricks.formatters import (
    format_databricks_compare_workloads_response as format_databricks_compare_workloads_response,
)
from azure_pricing_mcp.databricks.formatters import (
    format_databricks_cost_estimate_response as format_databricks_cost_estimate_response,
)
from azure_pricing_mcp.databricks.formatters import (
    format_databricks_dbu_pricing_response as format_databricks_dbu_pricing_response,
)
from azure_pricing_mcp.response_format import (
    DEFAULT_RESPONSE_FORMAT,
    ResponseFormat,
    coerce_response_format,
)

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


def format_price_search_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the price search response.

    ``compact`` / ``table`` modes emit a markdown table only (largest token win
    in v5.0 — drops the v4 ``json.dumps(items, indent=2)`` dump). ``full``
    preserves the verbose v4 string for back-compat.
    """
    fmt = coerce_response_format(response_format)
    items = result.get("items", [])

    if fmt in ("compact", "table"):
        return _format_price_search_compact(result, items, table_only=fmt == "table")

    # fmt == "full" — original verbose path retained verbatim for v4 back-compat
    return _format_price_search_full(result, items)


def _format_price_search_compact(result: dict[str, Any], items: list[dict[str, Any]], *, table_only: bool) -> str:
    """Token-efficient markdown table. No JSON dump, no decorative footers."""
    if not items or result.get("count", 0) == 0:
        if table_only:
            return "| service | sku | region | price | unit |\n|---|---|---|---|---|\n"
        # Compact "no results" path stays terse.
        msg = "No pricing results found."
        if "sku_validation" in result:
            v = result["sku_validation"]
            sugg = v.get("suggestions") or []
            if sugg:
                msg += " Did you mean: " + ", ".join(s.get("sku_name", "?") for s in sugg[:3]) + "?"
        return msg

    lines: list[str] = []
    discount = result.get("discount_applied")
    if not table_only:
        lines.append(f"Found {result['count']} prices.")
        if discount:
            lines.append(f"Discount: {discount['percentage']}%.")
        lines.append("")

    lines.append("| service | sku | region | price | unit | type | savings_plan_1y | savings_plan_3y |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for item in items:
        plans = {p.get("term", ""): p.get("retailPrice") for p in item.get("savingsPlan", []) or []}
        sp1 = plans.get("1 Year")
        sp3 = plans.get("3 Years")
        lines.append(
            f"| {item.get('serviceName', '')} "
            f"| {item.get('skuName', '')} "
            f"| {item.get('armRegionName') or item.get('location', '')} "
            f"| {item.get('retailPrice', 0)} "
            f"| {item.get('unitOfMeasure', '')} "
            f"| {item.get('type', '')} "
            f"| {sp1 if sp1 is not None else '—'} "
            f"| {sp3 if sp3 is not None else '—'} |"
        )
    return "\n".join(lines)


def _format_price_search_full(result: dict[str, Any], items: list[dict[str, Any]]) -> str:
    """Original v4 verbose path — preserved byte-for-byte for back-compat."""
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
            if "retirement_warnings" in result and result["retirement_warnings"]:
                response_text += _format_retirement_warnings(result["retirement_warnings"])
            if "discount_applied" in result:
                response_text += f"💰 **Customer Discount Applied: {result['discount_applied']['percentage']}%**\n"
                response_text += f"   {result['discount_applied']['note']}\n\n"
            if "sku_validation" in result:
                response_text += _format_sku_validation(result["sku_validation"])
            if "clarification" in result:
                response_text += _format_clarification(result["clarification"])
            if "discount_applied" in result:
                response_text += _format_savings_summary(formatted_items)
            response_text += "**Detailed Pricing:**\n"
            response_text += json.dumps(formatted_items, indent=2)
            return response_text
        return "No valid pricing results found."

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


def format_price_compare_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the price comparison response for display."""
    fmt = coerce_response_format(response_format)
    if fmt in ("compact", "table"):
        comparisons = result.get("comparisons", [])
        if not comparisons:
            return "No comparison results." if fmt == "compact" else ""
        rows = comparisons if isinstance(comparisons, list) else list(comparisons.values())
        if not rows or not isinstance(rows[0], dict):
            return f"Comparison ({result.get('service_name', '?')}): {comparisons}"
        cols = list(rows[0].keys())
        lines = []
        if fmt == "compact":
            lines.append(f"Comparison: {result.get('service_name', '?')}")
            disc = result.get("discount_applied")
            if disc:
                lines.append(f"Discount: {disc['percentage']}%.")
            lines.append("")
        lines.append("| " + " | ".join(cols) + " |")
        lines.append("|" + "|".join(["---"] * len(cols)) + "|")
        for row in rows:
            lines.append("| " + " | ".join(str(row.get(c, "")) for c in cols) + " |")
        return "\n".join(lines)

    response_text = f"Price comparison for {result['service_name']}:\n\n"
    if "discount_applied" in result:
        response_text += f"💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n\n"
    response_text += json.dumps(result["comparisons"], indent=2)
    return response_text


def format_region_recommend_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the region recommendation response for display."""
    fmt = coerce_response_format(response_format)
    if "error" in result:
        return f"Error: {result['error']}"

    recommendations = result.get("recommendations", [])
    if not recommendations:
        return (
            "No region recommendations found."
            if fmt == "compact"
            else "No region recommendations found for the specified criteria."
        )

    if fmt in ("compact", "table"):
        lines = []
        if fmt == "compact":
            summary = result.get("summary") or {}
            lines.append(
                f"Region recs: {result.get('service_name', '?')} {result.get('sku_name', '?')} "
                f"({result.get('total_regions_found', 0)} regions, {result.get('currency', 'USD')})."
            )
            if summary:
                lines.append(
                    f"Cheapest: {summary.get('cheapest_location', '?')} "
                    f"(${summary.get('cheapest_price', 0):.6f}); max savings {summary.get('max_savings_percentage', 0):.1f}%."
                )
            disc = result.get("discount_applied")
            if disc:
                lines.append(f"Discount: {disc['percentage']}%.")
            lines.append("")

        lines.append("| rank | region | location | price | unit | spot | savings_vs_max |")
        lines.append("|---|---|---|---|---|---|---|")
        for i, rec in enumerate(recommendations, 1):
            spot = rec.get("spot_price")
            lines.append(
                f"| {i} "
                f"| {rec.get('region', 'N/A')} "
                f"| {rec.get('location', 'N/A')} "
                f"| {rec.get('retail_price', 0):.6f} "
                f"| {rec.get('unit_of_measure', '')} "
                f"| {f'{spot:.6f}' if spot else '—'} "
                f"| {rec.get('savings_vs_most_expensive', 0):.1f}% |"
            )
        return "\n".join(lines)

    # full — verbose v4 path
    response_text = f"""🌍 Region Recommendations for {result["service_name"]} - {result["sku_name"]}

Currency: {result["currency"]}
Total regions found: {result["total_regions_found"]}
Showing top: {result["showing_top"]}
"""
    if "discount_applied" in result:
        response_text += f"\n💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n"

    if "summary" in result:
        summary = result["summary"]
        response_text += f"""
📊 Summary:
   🥇 Cheapest: {summary["cheapest_location"]} ({summary["cheapest_region"]}) - ${summary["cheapest_price"]:.6f}
   🥉 Most Expensive: {summary["most_expensive_location"]} ({summary["most_expensive_region"]}) - ${summary["most_expensive_price"]:.6f}
   💰 Max Savings: {summary["max_savings_percentage"]:.1f}% by choosing the cheapest region
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


def format_cost_estimate_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the cost estimate response for display."""
    fmt = coerce_response_format(response_format)
    if "error" in result:
        return f"Error: {result['error']}"

    if fmt in ("compact", "table"):
        od = result.get("on_demand_pricing", {}) or {}
        lines = []
        if fmt == "compact":
            lines.append(
                f"Cost: {result.get('service_name', '?')} {result.get('sku_name', '?')} "
                f"in {result.get('region', '?')} ({result.get('currency', 'USD')})."
            )
            disc = result.get("discount_applied")
            if disc:
                lines.append(f"Discount: {disc['percentage']}%.")
            lines.append("")
        lines.append("| metric | value |")
        lines.append("|---|---|")
        lines.append(f"| hourly_rate | {od.get('hourly_rate', 0)} |")
        lines.append(f"| monthly_cost | {od.get('monthly_cost', 0)} |")
        lines.append(f"| yearly_cost | {od.get('yearly_cost', 0)} |")
        for plan in result.get("savings_plans", []) or []:
            lines.append(
                f"| sp_{plan.get('term', '').replace(' ', '_').lower()}_monthly "
                f"| {plan.get('monthly_cost', 0)} ({plan.get('savings_percent', 0)}% off) |"
            )
        return "\n".join(lines)

    estimate_text = f"""
Cost Estimate for {result["service_name"]} - {result["sku_name"]}
Region: {result["region"]}
Product: {result["product_name"]}
Unit: {result["unit_of_measure"]}
Currency: {result["currency"]}
"""

    if "discount_applied" in result:
        estimate_text += f"\n💰 {result['discount_applied']['percentage']}% discount applied - {result['discount_applied']['note']}\n"

    estimate_text += f"""
Usage Assumptions:
- Hours per month: {result["usage_assumptions"]["hours_per_month"]}
- Hours per day: {result["usage_assumptions"]["hours_per_day"]}

On-Demand Pricing:
- Hourly Rate: ${result["on_demand_pricing"]["hourly_rate"]}
- Daily Cost: ${result["on_demand_pricing"]["daily_cost"]}
- Monthly Cost: ${result["on_demand_pricing"]["monthly_cost"]}
- Yearly Cost: ${result["on_demand_pricing"]["yearly_cost"]}
"""

    if "discount_applied" in result and "original_hourly_rate" in result["on_demand_pricing"]:
        estimate_text += f"""
Original Pricing (before discount):
- Hourly Rate: ${result["on_demand_pricing"]["original_hourly_rate"]}
- Daily Cost: ${result["on_demand_pricing"]["original_daily_cost"]}
- Monthly Cost: ${result["on_demand_pricing"]["original_monthly_cost"]}
- Yearly Cost: ${result["on_demand_pricing"]["original_yearly_cost"]}
"""

    if result["savings_plans"]:
        estimate_text += "\nSavings Plans Available:\n"
        for plan in result["savings_plans"]:
            estimate_text += f"""
{plan["term"]} Term:
- Hourly Rate: ${plan["hourly_rate"]}
- Monthly Cost: ${plan["monthly_cost"]}
- Yearly Cost: ${plan["yearly_cost"]}
- Savings: {plan["savings_percent"]}% (${plan["annual_savings"]} annually)
"""
            if "original_hourly_rate" in plan:
                estimate_text += f"""- Original Hourly Rate: ${plan["original_hourly_rate"]}
- Original Monthly Cost: ${plan["original_monthly_cost"]}
- Original Yearly Cost: ${plan["original_yearly_cost"]}
"""

    return estimate_text


def format_discover_skus_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the discover SKUs response for display.

    v5.0 — ``azure_discover_skus`` is a deprecation alias of ``azure_sku_discovery``.
    Compact mode prepends a ``[deprecated]`` line so callers see the migration hint.
    """
    fmt = coerce_response_format(response_format)
    skus = result.get("skus", [])
    if not skus:
        return "No SKUs found for the specified service."

    if fmt in ("compact", "table"):
        lines = []
        if fmt == "compact":
            lines.append(
                f"[deprecated v5.0; use azure_sku_discovery] {result['total_skus']} SKUs for {result['service_name']}."
            )
            lines.append("")
        # Render whatever shape ``skus`` has — list of dicts is the common case.
        if isinstance(skus, list) and skus and isinstance(skus[0], dict):
            cols = ["skuName", "productName", "minPrice", "regions"]
            present = [c for c in cols if any(c in s for s in skus[:5])]
            if not present:
                present = list(skus[0].keys())[:5]
            lines.append("| " + " | ".join(present) + " |")
            lines.append("|" + "|".join(["---"] * len(present)) + "|")
            for sku in skus:
                lines.append(
                    "| "
                    + " | ".join(
                        ",".join(map(str, sku[c])) if isinstance(sku.get(c), list) else str(sku.get(c, ""))
                        for c in present
                    )
                    + " |"
                )
            return "\n".join(lines)
        return "\n".join(lines) + "\n" + json.dumps(skus, indent=None, separators=(",", ":"))

    return f"Found {result['total_skus']} SKUs for {result['service_name']}:\n\n" + json.dumps(skus, indent=2)


def format_sku_discovery_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the SKU discovery response for display."""
    fmt = coerce_response_format(response_format)
    if not result.get("service_found"):
        # Suggestion path stays similar in all formats — it's already terse.
        return _format_sku_discovery_no_match(result)

    service_name = result["service_found"]
    skus: dict[str, dict[str, Any]] = result["skus"]
    total_skus = result["total_skus"]

    if fmt in ("compact", "table"):
        lines = []
        if fmt == "compact":
            lines.append(f"SKUs ({total_skus}) for {service_name} (search='{result['original_search']}').")
            lines.append("")
        lines.append("| product | sku | min_price | unit | regions |")
        lines.append("|---|---|---|---|---|")
        for sku_name, sku_data in sorted(skus.items()):
            lines.append(
                f"| {sku_data.get('product_name', '')} "
                f"| {sku_name} "
                f"| {sku_data.get('min_price', 0)} "
                f"| {sku_data.get('sample_unit', '')} "
                f"| {len(sku_data.get('regions', []))} |"
            )
        return "\n".join(lines)

    # full — v4 verbose path
    original_search = result["original_search"]
    match_type = result.get("match_type", "exact")
    response_text = f"SKU Discovery for '{original_search}'"
    if match_type == "exact_mapping":
        response_text += f" (mapped to: {service_name})"
    response_text += f"\n\nFound {total_skus} SKUs for {service_name}:\n\n"

    products: dict[str, list[tuple]] = {}
    for sku_name, sku_data in skus.items():
        product = sku_data["product_name"]
        products.setdefault(product, []).append((sku_name, sku_data))

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


def _format_sku_discovery_no_match(result: dict[str, Any]) -> str:
    """Helper: format the 'no match' branch of the SKU-discovery response."""
    suggestions = result.get("suggestions", [])
    original_search = result["original_search"]
    if suggestions:
        response_text = f"No exact match found for '{original_search}'\n\n"
        response_text += "🔍 Did you mean one of these services?\n\n"
        for i, suggestion in enumerate(suggestions[:5], 1):
            service_name = suggestion["service_name"]
            match_reason = suggestion["match_reason"]
            sample_items = suggestion["sample_items"]
            response_text += f"{i}. {service_name}\n   Reason: {match_reason}\n"
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
        response_text = (
            f"No matches found for '{original_search}'\n\n"
            "💡 Try using terms like:\n"
            "• 'app service' or 'web app' for Azure App Service\n"
            "• 'vm' or 'virtual machine' for Virtual Machines\n"
            "• 'storage' or 'blob' for Storage services\n"
            "• 'sql' or 'database' for SQL Database\n"
            "• 'kubernetes' or 'aks' for Azure Kubernetes Service"
        )
    return response_text


def format_customer_discount_response(result: dict[str, Any]) -> str:
    """Format the customer discount response for display."""
    return f"""Customer Discount Information

Customer ID: {result["customer_id"]}
Discount Type: {result["discount_type"]}
Discount Percentage: {result["discount_percentage"]}%
Description: {result["description"]}
Applicable Services: {result["applicable_services"]}

{result["note"]}
"""


def format_ri_pricing_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the RI pricing response for display."""
    fmt = coerce_response_format(response_format)
    if fmt in ("compact", "table"):
        lines = []
        comparison = result.get("comparison") or []
        if comparison:
            if fmt == "compact":
                lines.append("RI savings:")
            lines.append("| sku | region | term | savings | ri_hourly | od_hourly | break_even_mo | annual_savings |")
            lines.append("|---|---|---|---|---|---|---|---|")
            for c in comparison:
                lines.append(
                    f"| {c.get('sku', '')} | {c.get('region', '')} | {c.get('term', '')} "
                    f"| {c.get('savings_percentage', 0)}% "
                    f"| {c.get('ri_hourly', 0)} | {c.get('od_hourly', 0)} "
                    f"| {c.get('break_even_months', '—')} "
                    f"| ${c.get('annual_savings', 0):,} |"
                )
        ri_items = result.get("ri_items") or []
        if ri_items and fmt == "full":
            pass  # full path handled below
        if ri_items:
            if fmt == "compact":
                lines.append("")
                lines.append(f"Raw RI ({result.get('count', 0)} items, top {min(10, len(ri_items))}):")
            lines.append("| sku | region | price | unit | term |")
            lines.append("|---|---|---|---|---|")
            for it in ri_items[:10]:
                lines.append(
                    f"| {it.get('skuName', '')} | {it.get('armRegionName', '')} "
                    f"| {it.get('retailPrice', 0)} | {it.get('unitOfMeasure', '')} "
                    f"| {it.get('reservationTerm', '')} |"
                )
        if not lines:
            return "No Reserved Instance pricing found."
        return "\n".join(lines)

    response_lines: list[str] = []
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
**VM Resource ID:** `{result.get("vm_resource_id", "N/A")}`

{result.get("note", "")}

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


# =============================================================================
# Orphaned Resources Formatter
# =============================================================================


def format_orphaned_resources_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format the orphaned resources scan response for display.

    ``compact`` collapses the per-type detail tables into a single summary table
    plus a count column; ``full`` keeps the v4 per-type detail blocks.
    """
    fmt = coerce_response_format(response_format)
    if "error" in result:
        return _format_spot_error(result)

    subscriptions = result.get("subscriptions", [])
    total_orphaned = result.get("total_orphaned", 0)
    total_cost = result.get("total_estimated_cost", 0.0)
    lookback = result.get("lookback_days", 60)
    currency = result.get("currency", "USD")

    if total_orphaned == 0:
        if fmt == "compact":
            return f"No orphaned resources across {len(subscriptions)} subscription(s)."
        return (
            "### ✅ No Orphaned Resources Found\n\n"
            f"Scanned {len(subscriptions)} subscription(s) — "
            "no orphaned disks, public IPs, App Service Plans, SQL Elastic Pools, "
            "Application Gateways, NAT Gateways, Load Balancers, Private DNS Zones, "
            "Private Endpoints, Virtual Network Gateways, "
            "or DDoS Protection Plans detected."
        )

    all_orphaned: list[dict[str, Any]] = []
    for sub in subscriptions:
        all_orphaned.extend(sub.get("orphaned_resources", []))

    by_type: dict[str, list[dict[str, Any]]] = {}
    for resource in all_orphaned:
        res_type = resource.get("orphan_type", "Unknown")
        by_type.setdefault(res_type, []).append(resource)

    if fmt in ("compact", "table"):
        lines = []
        if fmt == "compact":
            lines.append(
                f"Orphaned: {total_orphaned} across {len(subscriptions)} sub(s); "
                f"~${total_cost:,.2f} {currency} ({lookback}d)."
            )
            lines.append("")
        lines.append("| type | count | cost |")
        lines.append("|---|---|---|")
        for rtype in sorted(by_type.keys()):
            type_cost = sum(r.get("estimated_cost_usd") or 0.0 for r in by_type[rtype])
            lines.append(f"| {rtype} | {len(by_type[rtype])} | ${type_cost:,.2f} |")
        return "\n".join(lines)

    response_lines = [
        "### 🔍 Orphaned Resource Report\n",
        f"**Total orphaned resources:** {total_orphaned}",
        f"**Estimated wasted cost ({lookback} days):** ${total_cost:,.2f} {currency}",
        f"**Subscriptions scanned:** {len(subscriptions)}\n",
    ]

    response_lines.append("#### Summary by Type\n")
    response_lines.append("| Resource Type | Count | Est. Cost |")
    response_lines.append("|---------------|-------|-----------|")
    for rtype in sorted(by_type.keys()):
        resources = by_type[rtype]
        type_cost = sum(r.get("estimated_cost_usd") or 0.0 for r in resources)
        response_lines.append(f"| {rtype} | {len(resources)} | ${type_cost:,.2f} |")
    response_lines.append("")

    for rtype in sorted(by_type.keys()):
        resources = by_type[rtype]
        response_lines.append(f"#### {rtype} ({len(resources)})\n")
        response_lines.append("| Name | Resource Group | Location | Cost |")
        response_lines.append("|------|----------------|----------|------|")
        for r in sorted(resources, key=lambda x: -(x.get("estimated_cost_usd") or 0.0)):
            name = r.get("name", "N/A")
            rg = r.get("resourceGroup", "N/A")
            loc = r.get("location", "N/A")
            cost = r.get("estimated_cost_usd")
            cost_str = f"${cost:,.2f}" if cost is not None else "N/A"
            response_lines.append(f"| {name} | {rg} | {loc} | {cost_str} |")
        response_lines.append("")

    response_lines.append(result.get("note", ""))
    return "\n".join(response_lines)


# =============================================================================
# PTU Sizing + Cost Planner
# =============================================================================


def format_ptu_sizing_response(result: dict[str, Any]) -> str:
    """Format PTU sizing estimation result as Markdown.

    Args:
        result: Result dict from PTUService.estimate_ptu_sizing().

    Returns:
        Formatted Markdown string.
    """
    if "error" in result:
        lines = [f"❌ **PTU Sizing Error**: {result['error']}"]
        if "supported_models" in result:
            models = ", ".join(f"`{m}`" for m in result["supported_models"])
            lines.append(f"\n**Supported models**: {models}")
        if "supported_types" in result:
            types = ", ".join(f"`{t}`" for t in result["supported_types"])
            lines.append(f"\n**Supported deployment types**: {types}")
        if "suggestion" in result:
            lines.append(f"\n💡 {result['suggestion']}")
        if "data_source" in result:
            lines.append(f"\n📖 [Official PTU documentation]({result['data_source']})")
        return "\n".join(lines)

    # ── Header ──────────────────────────────────────────────────────────
    lines = ["# ⚡ PTU Sizing Estimate\n"]

    # ── Model & Deployment ──────────────────────────────────────────────
    lines.append("## Model & Deployment")
    lines.append(f"- **Model**: `{result['model']}`")
    lines.append(f"- **Deployment type**: {result['deployment_label']}")
    lines.append(f"- **Processing**: {result['deployment_description']}")
    lines.append("")

    # ── Workload Shape ──────────────────────────────────────────────────
    wl = result["workload"]
    lines.append("## Workload Shape (peak)")
    lines.append(f"- **Requests/min (RPM)**: {wl['rpm']:,}")
    lines.append(f"- **Avg input tokens/request**: {wl['avg_input_tokens']:,}")
    lines.append(f"- **Avg output tokens/request**: {wl['avg_output_tokens']:,}")
    if wl["cached_tokens_per_request"] > 0:
        lines.append(f"- **Cached tokens/request**: {wl['cached_tokens_per_request']:,}")
    lines.append("")

    # ── Calculation Breakdown ───────────────────────────────────────────
    calc = result["calculation"]
    lines.append("## Calculation Breakdown")
    lines.append(f"- **Output multiplier**: 1 output token = **{calc['output_multiplier']}** input tokens")
    if result["workload"]["cached_tokens_per_request"] > 0:
        lines.append(f"- **Effective input tokens** (after cache deduction): {calc['effective_input_tokens']:,}")
    lines.append(f"- **Equivalent tokens/request**: {calc['eq_tokens_per_request']:,}")
    lines.append(f"- **Equivalent TPM**: {calc['eq_tpm']:,}")
    lines.append(f"- **Input TPM per PTU**: {calc['input_tpm_per_ptu']:,}")
    lines.append(f"- **Raw PTU estimate**: {calc['raw_ptu']}")
    lines.append("")

    # ── Result ──────────────────────────────────────────────────────────
    res = result["result"]
    lines.append("## ✅ Recommended PTUs")
    lines.append(f"### **{res['recommended_ptus']:,} PTUs**")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| Raw (unrounded) | {res['raw_ptus']} |")
    lines.append(f"| Rounded (deployed) | **{res['recommended_ptus']:,}** |")
    lines.append(f"| Minimum deployment | {res['minimum_ptus']:,} |")
    lines.append(f"| Scale increment | {res['scale_increment']:,} |")
    lines.append(f"| Max per deployment | {res['max_ptus_per_deployment']:,} |")
    lines.append("")

    # ── Cost Estimate ───────────────────────────────────────────────────
    if "cost" in result:
        cost = result["cost"]
        lines.append("## 💰 Cost Estimate")
        if "hourly_cost" in cost:
            lines.append("| Metric | Value |")
            lines.append("|--------|-------|")
            lines.append(f"| $/PTU/hour | {cost['currency']} {cost['price_per_ptu_hour']:.4f} |")
            lines.append(
                f"| Hourly cost ({cost['deployed_ptus']:,} PTUs) | {cost['currency']} {cost['hourly_cost']:,.2f} |"
            )
            lines.append(f"| Monthly cost (730h) | {cost['currency']} {cost['monthly_cost_730h']:,.2f} |")
            lines.append(f"| Meter | {cost['meter_name']} |")
            lines.append(f"| Region | {cost['region']} |")
            lines.append("")
            lines.append(f"💡 {cost['reservation_guidance']}")
        else:
            lines.append(f"⚠️ {cost.get('note', 'Pricing data unavailable.')}")
            if "pricing_url" in cost:
                lines.append(f"\n🔗 [Azure OpenAI Pricing]({cost['pricing_url']})")
        lines.append("")

    # ── Warnings ────────────────────────────────────────────────────────
    if result.get("warnings"):
        lines.append("## ⚠️ Important Notes")
        for w in result["warnings"]:
            lines.append(f"- {w}")
        lines.append("")

    # ── Footer ──────────────────────────────────────────────────────────
    lines.append(
        f"---\n📖 Data version: {result.get('data_version', 'N/A')} | [Source]({result.get('data_source', '')})"
    )

    return "\n".join(lines)


# =============================================================================
# Bulk Cost Estimation
# =============================================================================


def format_bulk_estimate_response(
    result: dict[str, Any], response_format: ResponseFormat | str = DEFAULT_RESPONSE_FORMAT
) -> str:
    """Format bulk cost estimate result."""
    fmt = coerce_response_format(response_format)
    if "error" in result:
        return f"❌ **Error**: {result.get('message', result['error'])}"

    line_items = result.get("line_items", [])
    totals = result.get("totals", {}) or {}
    errors = result.get("errors", []) or []

    if fmt in ("compact", "table"):
        lines = []
        if fmt == "compact":
            lines.append(
                f"Bulk: {result.get('successful', 0)}/{result.get('resource_count', 0)} priced "
                f"({result.get('failed', 0)} failed). Monthly ${totals.get('monthly', 0):,.2f}, "
                f"yearly ${totals.get('yearly', 0):,.2f} {result.get('currency', 'USD')}."
            )
            lines.append("")
        if line_items:
            lines.append("| service | sku | region | qty | monthly | yearly |")
            lines.append("|---|---|---|---|---|---|")
            for item in line_items:
                lines.append(
                    f"| {item.get('service_name', '')} | {item.get('sku_name', '')} "
                    f"| {item.get('region', '')} | {item.get('quantity', 1)} "
                    f"| {item.get('monthly_cost', 0):,.2f} "
                    f"| {item.get('yearly_cost', 0):,.2f} |"
                )
        if errors and fmt == "compact":
            lines.append("")
            lines.append("Failed:")
            for err in errors:
                inp = err.get("input", {})
                lines.append(
                    f"- {inp.get('service_name', '?')}/{inp.get('sku_name', '?')} "
                    f"in {inp.get('region', '?')}: {err.get('error', '?')}"
                )
        return "\n".join(lines)

    lines = [
        "# 📦 Bulk Cost Estimate",
        "",
        f"**Resources**: {result.get('resource_count', 0)} submitted, "
        f"{result.get('unique_specs', 0)} unique, "
        f"{result.get('successful', 0)} estimated, "
        f"{result.get('failed', 0)} failed",
        f"**Currency**: {result.get('currency', 'USD')}",
        "",
    ]

    if line_items:
        lines.append("## Line Items")
        lines.append("")
        lines.append("| Service | SKU | Region | Qty | Monthly | Yearly |")
        lines.append("|---------|-----|--------|----:|--------:|-------:|")
        for item in line_items:
            lines.append(
                f"| {item.get('service_name', 'N/A')} "
                f"| {item.get('sku_name', 'N/A')} "
                f"| {item.get('region', 'N/A')} "
                f"| {item.get('quantity', 1)} "
                f"| ${item.get('monthly_cost', 0):,.2f} "
                f"| ${item.get('yearly_cost', 0):,.2f} |"
            )
        lines.append("")

    lines.append("## Totals")
    lines.append("")
    lines.append(f"- **Monthly**: ${totals.get('monthly', 0):,.2f}")
    lines.append(f"- **Yearly**: ${totals.get('yearly', 0):,.2f}")

    if errors:
        lines.append("")
        lines.append("## ⚠️ Failed Items")
        for err in errors:
            inp = err.get("input", {})
            lines.append(
                f"- {inp.get('service_name', 'Unknown')}/{inp.get('sku_name', 'Unknown')} "
                f"in {inp.get('region', 'Unknown')}: {err.get('error', 'Unknown error')}"
            )

    return "\n".join(lines)
