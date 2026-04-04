"""Response formatters for Databricks DBU pricing tools."""

from typing import Any


def format_databricks_dbu_pricing_response(result: dict[str, Any]) -> str:
    """Format the Databricks DBU pricing response for display."""
    workloads = result.get("workloads", {})
    if not workloads:
        return _format_empty_pricing(result)

    region = result.get("region", "N/A")
    tier_filter = result.get("tier_filter")
    currency = result.get("currency", "USD")
    total = result.get("total_items", 0)

    lines = [
        f"### Azure Databricks DBU Pricing - {region}\n",
        f"**Currency:** {currency}",
        f"**Total SKUs:** {total}",
    ]
    if tier_filter:
        lines.append(f"**Tier filter:** {tier_filter}")
    if result.get("workload_filter"):
        lines.append(f"**Workload filter:** {result['workload_filter']} -> {result.get('resolved_workload')}")
    lines.append("")

    lines.append("| Workload | Tier | DBU Rate/hr | Unit |")
    lines.append("|----------|------|-------------|------|")

    for workload_label in sorted(workloads.keys()):
        entries = workloads[workload_label]
        for entry in sorted(entries, key=lambda e: (e["tier"], e["workload"])):
            lines.append(f"| {workload_label} | {entry['tier']} | ${entry['dbu_rate']:.4f} | {entry['unit']} |")

    lines.append("")
    lines.append(
        "*DBU rates cover Databricks compute charges only. VM, storage, and networking are billed separately.*"
    )

    return "\n".join(lines)


def _format_empty_pricing(result: dict[str, Any]) -> str:
    """Format response when no pricing data is found."""
    msg = "No Databricks DBU pricing found for the specified criteria.\n"
    if result.get("workload_filter"):
        msg += f"\nWorkload filter: '{result['workload_filter']}'"
        if result.get("resolved_workload") is None:
            msg += " (not recognized)"
            msg += "\n\nAvailable workload types:\n"
            for wt in result.get("available_workload_types", []):
                msg += f"  - {wt}\n"
    return msg


def format_databricks_cost_estimate_response(result: dict[str, Any]) -> str:
    """Format the Databricks cost estimate response for display."""
    if "error" in result:
        return _format_estimate_error(result)

    lines = [
        "### Databricks Cost Estimate\n",
        f"**Workload:** {result['workload_type']}",
        f"**Tier:** {result['tier']}",
        f"**Region:** {result['region']}",
        f"**Currency:** {result['currency']}\n",
        "#### Configuration",
        f"- DBU rate: ${result['dbu_rate_per_hour']:.4f}/hr",
        f"- DBUs per worker: {result['dbu_count_per_worker']}",
        f"- Workers: {result['num_workers']}",
        f"- Hours/day: {result['hours_per_day']}",
        f"- Days/month: {result['days_per_month']}",
        f"- Total hours/month: {result['total_hours']}",
        f"- Total DBU-hours/month: {result['total_dbu_hours']}\n",
        "#### Cost Breakdown",
        f"- **Monthly DBU cost:** ${result['monthly_dbu_cost']:,.2f}",
    ]

    if result.get("discount_percentage", 0) > 0:
        lines.append(f"- Discount: {result['discount_percentage']}% (-${result['discount_amount']:,.2f})")
        lines.append(f"- **Discounted monthly cost:** ${result['discounted_monthly_cost']:,.2f}")

    lines.append(f"- **Annual estimate:** ${result['annual_estimate']:,.2f}")

    if result.get("photon_pricing"):
        _append_photon_section(lines, result["photon_pricing"])

    lines.append(f"\n*{result.get('note', '')}*")

    return "\n".join(lines)


def _format_estimate_error(result: dict[str, Any]) -> str:
    """Format a cost estimate error response."""
    msg = f"### Error: {result.get('message', 'Unknown error')}\n"
    if result.get("available_types"):
        msg += "\nAvailable workload types:\n"
        for wt in result["available_types"]:
            msg += f"  - {wt}\n"
    if result.get("help"):
        msg += f"\n{result['help']}"
    return msg


def _append_photon_section(lines: list[str], photon: dict[str, Any]) -> None:
    """Append Photon pricing section to output lines."""
    lines.append("\n#### Photon Pricing")
    lines.append(f"- Photon DBU rate: ${photon['dbu_rate']:.4f}/hr (+${photon['rate_difference']:.4f})")
    lines.append(f"- Photon monthly cost: ${photon['monthly_cost']:,.2f}")


def format_databricks_compare_workloads_response(result: dict[str, Any]) -> str:
    """Format the Databricks workload comparison response for display."""
    comparisons = result.get("comparison", [])
    if not comparisons:
        return "No comparison data available."

    tier = result.get("tier", "Premium")
    currency = result.get("currency", "USD")

    lines = [
        f"### Databricks DBU Comparison ({tier} Tier)\n",
        f"**Compared by:** {result.get('compared_by', 'workload_type')}",
        f"**Currency:** {currency}",
        f"**Total comparisons:** {result.get('total_comparisons', 0)}\n",
    ]

    valid_rows = [c for c in comparisons if "error" not in c]
    has_monthly = any(c.get("monthly_cost") is not None for c in valid_rows)
    has_photon = any(c.get("photon_dbu_rate") is not None for c in valid_rows)

    _append_comparison_table(lines, comparisons, has_photon, has_monthly)

    lines.append(f"\n*{result.get('note', '')}*")

    return "\n".join(lines)


def _append_comparison_table(
    lines: list[str],
    comparisons: list[dict[str, Any]],
    has_photon: bool,
    has_monthly: bool,
) -> None:
    """Build and append the comparison markdown table."""
    header = "| Workload | Region | DBU Rate/hr |"
    separator = "|----------|--------|-------------|"
    if has_photon:
        header += " Photon Rate |"
        separator += "-------------|"
    if has_monthly:
        header += " Monthly Cost |"
        separator += "--------------|"
    header += " Savings |"
    separator += "---------|"

    lines.append(header)
    lines.append(separator)

    for comp in comparisons:
        if "error" in comp:
            lines.append(f"| {comp['workload_type']} | {comp.get('region', 'N/A')} | Error: {comp['error']} |")
            continue

        row = _format_comparison_row(comp, has_photon, has_monthly)
        lines.append(row)


def _format_comparison_row(comp: dict[str, Any], has_photon: bool, has_monthly: bool) -> str:
    """Format a single comparison table row."""
    rate = comp.get("dbu_rate")
    rate_str = f"${rate:.4f}" if rate is not None else "N/A"
    row = f"| {comp['workload_type']} | {comp['region']} | {rate_str} |"

    if has_photon:
        photon = comp.get("photon_dbu_rate")
        row += f" ${photon:.4f} |" if photon else " N/A |"

    if has_monthly:
        monthly = comp.get("monthly_cost")
        row += f" ${monthly:,.2f} |" if monthly is not None else " N/A |"

    savings = comp.get("savings_vs_most_expensive")
    row += f" {f'{savings:.1f}%' if savings is not None else 'N/A'} |"

    return row
