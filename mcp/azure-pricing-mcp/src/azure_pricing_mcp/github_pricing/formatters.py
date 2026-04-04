"""Response formatters for GitHub Pricing tools."""

from __future__ import annotations

from typing import Any

# ── github_pricing ──────────────────────────────────────────────────────


def format_github_pricing_response(result: dict[str, Any]) -> str:
    """Format the ``github_pricing`` response for display."""
    sections = result.get("sections", {})
    if not sections:
        return _format_empty_pricing(result)

    lines: list[str] = [
        "### GitHub Pricing\n",
        f"**Currency:** {result.get('currency', 'USD')}",
        f"**Data version:** {result.get('data_version', 'N/A')}",
    ]
    if result.get("resolved_category"):
        lines.append(f"**Category:** {result['resolved_category']}")
    lines.append("")

    if "plans" in sections:
        _append_plans_section(lines, sections["plans"])
    if "copilot" in sections:
        _append_copilot_section(lines, sections["copilot"])
    if "actions" in sections:
        _append_actions_section(lines, sections["actions"])
    if "security" in sections:
        _append_security_section(lines, sections["security"])
    if "codespaces" in sections:
        _append_codespaces_section(lines, sections["codespaces"])
    if "storage" in sections:
        _append_storage_section(lines, sections["storage"])

    lines.append(
        f"\n*Prices are list prices in USD sourced from github.com/pricing. "
        f"Data last verified: {result.get('data_version', 'N/A')}.*"
    )
    return "\n".join(lines)


def _format_empty_pricing(result: dict[str, Any]) -> str:
    msg = "No GitHub pricing data found for the specified criteria.\n"
    if result.get("product_filter"):
        msg += f"\nProduct filter: '{result['product_filter']}'"
        if result.get("resolved_category") is None:
            msg += " (not recognized)"
            msg += "\n\nAvailable categories:\n"
            for cat in result.get("available_categories", []):
                msg += f"  - {cat}\n"
    return msg


# ── Plans ───────────────────────────────────────────────────────────────


def _append_plans_section(lines: list[str], plans: list[dict[str, Any]]) -> None:
    lines.append("#### GitHub Plans\n")
    lines.append("| Plan | Monthly / user | Target |")
    lines.append("|------|---------------|--------|")
    for p in plans:
        price = f"${p['price_monthly']:.2f}" if p["price_monthly"] > 0 else "Free"
        lines.append(f"| {p['name']} | {price} | {p['target']} |")
    lines.append("")


# ── Copilot ─────────────────────────────────────────────────────────────


def _append_copilot_section(lines: list[str], plans: list[dict[str, Any]]) -> None:
    lines.append("#### GitHub Copilot\n")
    lines.append(
        "> **Note:** These are **GitHub Copilot** prices (the AI coding assistant "
        "from GitHub). For **Microsoft 365 Copilot** pricing, use the "
        "`azure_price_search` tool with service name 'Microsoft 365'.\n"
    )
    lines.append("| Plan | Monthly | Annual | Target |")
    lines.append("|------|---------|--------|--------|")
    for p in plans:
        monthly = f"${p['price_monthly']:.2f}" if p["price_monthly"] > 0 else "Free"
        annual = f"${p['price_annual']:.2f}" if p["price_annual"] > 0 else "Free"
        lines.append(f"| {p['name']} | {monthly} | {annual} | {p['target']} |")
    lines.append("")


# ── Actions ─────────────────────────────────────────────────────────────


def _append_actions_section(lines: list[str], data: dict[str, Any]) -> None:
    lines.append("#### GitHub Actions Runners\n")
    lines.append("| Runner | $/min | OS | Cores |")
    lines.append("|--------|-------|----|-------|")
    for r in data.get("runners", []):
        lines.append(f"| {r['runner']} | ${r['per_minute']:.3f} | {r['os']} | {r['cores']} |")
    lines.append("")

    free = data.get("free_minutes", {})
    if free:
        lines.append("**Free tier included minutes (Linux):**\n")
        lines.append("| Plan | Minutes | Storage |")
        lines.append("|------|---------|---------|")
        for plan_name, info in free.items():
            lines.append(f"| {plan_name} | {info['minutes']:,} | {info['storage_gb']} GB |")
        lines.append("")

    mults = data.get("multipliers", {})
    if mults:
        lines.append(
            f"*Minute multipliers: Linux ×{mults.get('Linux', 1)}, "
            f"Windows ×{mults.get('Windows', 2)}, macOS ×{mults.get('macOS', 10)}*\n"
        )


# ── Security ────────────────────────────────────────────────────────────


def _append_security_section(lines: list[str], products: list[dict[str, Any]]) -> None:
    lines.append("#### GitHub Advanced Security\n")
    for p in products:
        lines.append(f"**{p['name']}** — ${p['price_monthly_per_committer']:.2f}/committer/month\n")
        lines.append(f"Target: {p['target']}\n")
        lines.append("Includes:")
        for item in p.get("includes", []):
            lines.append(f"  - {item}")
        lines.append("")


# ── Codespaces ──────────────────────────────────────────────────────────


def _append_codespaces_section(lines: list[str], data: dict[str, Any]) -> None:
    lines.append("#### GitHub Codespaces\n")
    compute = data.get("compute", {})
    storage = data.get("storage", {})
    lines.append(f"- **Compute:** ${compute.get('price_per_core_hour', 0)}/core-hour")
    lines.append(f"- **Storage:** ${storage.get('price_per_gb_month', 0)}/GB/month")
    lines.append("")


# ── Storage / Add-ons ───────────────────────────────────────────────────


def _append_storage_section(lines: list[str], items: list[dict[str, Any]]) -> None:
    lines.append("#### Storage & Packages\n")
    lines.append("| Product | Price | Unit |")
    lines.append("|---------|-------|------|")
    for item in items:
        lines.append(f"| {item['name']} | ${item['price']:.2f} | {item['unit']} |")
    lines.append("")


# ── github_cost_estimate ────────────────────────────────────────────────


def format_github_cost_estimate_response(result: dict[str, Any]) -> str:
    """Format the ``github_cost_estimate`` response for display."""
    lines: list[str] = [
        "### GitHub Cost Estimate\n",
        f"**Plan:** {result.get('plan', 'N/A')}",
        f"**Users:** {result.get('users', 1)}",
        f"**Currency:** {result.get('currency', 'USD')}",
    ]
    if result.get("copilot_plan"):
        lines.append(f"**Copilot plan:** {result['copilot_plan']} *(GitHub Copilot — not Microsoft 365 Copilot)*")
    lines.append("")

    breakdown = result.get("breakdown", [])
    if breakdown:
        lines.append("#### Cost Breakdown\n")
        lines.append("| Item | Qty | Unit | Unit Price | Monthly |")
        lines.append("|------|-----|------|------------|---------|")
        for b in breakdown:
            lines.append(
                f"| {b['item']} | {b['quantity']:,} | {b['unit']} "
                f"| ${b['unit_price']:.2f} | ${b['monthly_cost']:,.2f} |"
            )
        lines.append("")

    lines.append(f"**Monthly total:** ${result.get('monthly_total', 0):,.2f}")
    lines.append(f"**Annual estimate:** ${result.get('annual_estimate', 0):,.2f}")

    note = result.get("note")
    if note:
        lines.append(f"\n*{note}*")

    return "\n".join(lines)
