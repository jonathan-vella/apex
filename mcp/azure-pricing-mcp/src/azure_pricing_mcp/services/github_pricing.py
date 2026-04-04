"""GitHub Pricing service for Azure Pricing MCP Server.

Provides tools for querying GitHub product pricing (Plans, Copilot,
Actions runners, Advanced Security, Codespaces, and add-ons).

GitHub pricing is NOT available via the Azure Retail Prices API, so this
service uses a static pricing table maintained in ``config.py`` and verified
against https://github.com/pricing.  The ``data_version`` field in every
response indicates when the table was last checked.
"""

from __future__ import annotations

import logging
from typing import Any

from ..config import (
    GITHUB_ACTIONS_FREE_MINUTES,
    GITHUB_ACTIONS_RUNNERS,
    GITHUB_ADDONS,
    GITHUB_COPILOT_PLANS,
    GITHUB_PLANS,
    GITHUB_PRICING_DATA_VERSION,
    GITHUB_PRODUCT_ALIASES,
    GITHUB_SECURITY_PRODUCTS,
)

logger = logging.getLogger(__name__)


def _resolve_product(query: str | None) -> str | None:
    """Resolve user input to a canonical product category.

    Returns one of: ``plans``, ``copilot``, ``actions``, ``security``,
    ``codespaces``, ``storage``, or ``None`` (meaning *all*).
    """
    if not query:
        return None
    normalised = query.strip().lower()
    if not normalised:
        return None
    # Direct match
    if normalised in GITHUB_PRODUCT_ALIASES:
        return GITHUB_PRODUCT_ALIASES[normalised]
    # Partial / substring match
    for alias, category in GITHUB_PRODUCT_ALIASES.items():
        if normalised in alias or alias in normalised:
            return category
    return None


class GitHubPricingService:
    """Service for GitHub product pricing lookups.

    All data is static (no HTTP calls) — instantiation is cheap and
    requires no external client.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_pricing(
        self,
        product: str | None = None,
        copilot_plan: str | None = None,
    ) -> dict[str, Any]:
        """Return GitHub pricing for the requested product(s).

        Args:
            product: Natural-language product name or alias.  If ``None`` or
                     empty, returns the full catalog.
            copilot_plan: Optional Copilot-specific plan filter (e.g. ``Pro``,
                         ``Business``).

        Returns:
            Dict with pricing sections keyed by category.
        """
        resolved = _resolve_product(product)

        sections: dict[str, Any] = {}

        if resolved is None or resolved == "plans":
            sections["plans"] = self._get_plans()
        if resolved is None or resolved == "copilot":
            sections["copilot"] = self._get_copilot(copilot_plan)
        if resolved is None or resolved == "actions":
            sections["actions"] = self._get_actions()
        if resolved is None or resolved == "security":
            sections["security"] = self._get_security()
        if resolved is None or resolved == "codespaces":
            sections["codespaces"] = self._get_codespaces()
        if resolved is None or resolved == "storage":
            sections["storage"] = self._get_storage()

        return {
            "product_filter": product,
            "resolved_category": resolved,
            "data_version": GITHUB_PRICING_DATA_VERSION,
            "currency": "USD",
            "sections": sections,
            "available_categories": sorted(set(GITHUB_PRODUCT_ALIASES.values())),
        }

    async def estimate_cost(
        self,
        users: int = 1,
        plan: str | None = None,
        copilot_plan: str | None = None,
        actions_minutes: int = 0,
        actions_runner: str | None = None,
        codespaces_hours: float = 0.0,
        codespaces_cores: int = 4,
        codespaces_storage_gb: float = 0.0,
        lfs_packs: int = 0,
        ghas_committers: int = 0,
    ) -> dict[str, Any]:
        """Estimate monthly GitHub cost based on usage.

        Args:
            users: Number of user seats.
            plan: GitHub plan name (Free, Team, Enterprise). If None, plan cost
                  is excluded from the estimate.
            copilot_plan: Copilot plan name (Free, Pro, Pro+, Business, Enterprise).
            actions_minutes: Total Actions minutes consumed (Linux-equivalent).
            actions_runner: Runner label for per-minute pricing lookup.
            codespaces_hours: Total core-hours of Codespaces compute.
            codespaces_cores: Number of cores per Codespace (for compute cost).
            codespaces_storage_gb: Persistent Codespaces storage in GB.
            lfs_packs: Number of 50 GB Git LFS data packs.
            ghas_committers: Number of active committers for GitHub Advanced Security.

        Returns:
            Detailed cost breakdown dict.
        """
        breakdown: list[dict[str, Any]] = []
        total = 0.0

        # 1. GitHub Plan cost (only if explicitly requested)
        plan_key = self._match_plan(plan) if plan else None
        plan_data = GITHUB_PLANS.get(plan_key) if plan_key else None
        if plan_data and plan_data["price_monthly"] > 0:
            plan_cost = plan_data["price_monthly"] * users
            breakdown.append(
                {
                    "item": f"GitHub {plan_key} plan",
                    "quantity": users,
                    "unit": "users",
                    "unit_price": plan_data["price_monthly"],
                    "monthly_cost": round(plan_cost, 2),
                }
            )
            total += plan_cost

        # 2. Copilot cost
        if copilot_plan:
            copilot_key = self._match_copilot_plan(copilot_plan)
            copilot_data = GITHUB_COPILOT_PLANS.get(copilot_key)
            if copilot_data:
                copilot_cost = copilot_data["price_monthly"] * users
                breakdown.append(
                    {
                        "item": f"GitHub Copilot {copilot_key}",
                        "quantity": users,
                        "unit": "users",
                        "unit_price": copilot_data["price_monthly"],
                        "monthly_cost": round(copilot_cost, 2),
                    }
                )
                total += copilot_cost

        # 3. Actions minutes (beyond free tier)
        if actions_minutes > 0:
            free_mins = GITHUB_ACTIONS_FREE_MINUTES.get(plan_key or "Free", {}).get("minutes", 0)
            billable_mins = max(0, actions_minutes - free_mins)
            runner_key = actions_runner or "Linux 2-core"
            runner = GITHUB_ACTIONS_RUNNERS.get(runner_key)
            rate = runner["per_minute"] if runner else 0.008
            actions_cost = billable_mins * rate
            breakdown.append(
                {
                    "item": f"Actions minutes ({runner_key})",
                    "quantity": billable_mins,
                    "unit": f"billable minutes (after {free_mins} free)",
                    "unit_price": rate,
                    "monthly_cost": round(actions_cost, 2),
                }
            )
            total += actions_cost

        # 4. Codespaces compute
        if codespaces_hours > 0:
            cs_rate = GITHUB_ADDONS["Codespaces Compute"]["price"]
            core_hours = codespaces_hours * codespaces_cores
            cs_cost = core_hours * cs_rate
            breakdown.append(
                {
                    "item": "Codespaces Compute",
                    "quantity": core_hours,
                    "unit": "core-hours",
                    "unit_price": cs_rate,
                    "monthly_cost": round(cs_cost, 2),
                }
            )
            total += cs_cost

        # 5. Codespaces storage
        if codespaces_storage_gb > 0:
            cs_stor_rate = GITHUB_ADDONS["Codespaces Storage"]["price"]
            cs_stor_cost = codespaces_storage_gb * cs_stor_rate
            breakdown.append(
                {
                    "item": "Codespaces Storage",
                    "quantity": codespaces_storage_gb,
                    "unit": "GB",
                    "unit_price": cs_stor_rate,
                    "monthly_cost": round(cs_stor_cost, 2),
                }
            )
            total += cs_stor_cost

        # 6. Git LFS
        if lfs_packs > 0:
            lfs_rate = GITHUB_ADDONS["Git LFS Data"]["price"]
            lfs_cost = lfs_packs * lfs_rate
            breakdown.append(
                {
                    "item": "Git LFS Data Packs",
                    "quantity": lfs_packs,
                    "unit": "50 GB packs",
                    "unit_price": lfs_rate,
                    "monthly_cost": round(lfs_cost, 2),
                }
            )
            total += lfs_cost

        # 7. GHAS
        if ghas_committers > 0:
            ghas_data = GITHUB_SECURITY_PRODUCTS["GitHub Advanced Security (GHAS)"]
            ghas_rate = ghas_data["price_monthly_per_committer"]
            ghas_cost = ghas_committers * ghas_rate
            breakdown.append(
                {
                    "item": "GitHub Advanced Security (GHAS)",
                    "quantity": ghas_committers,
                    "unit": "active committers",
                    "unit_price": ghas_rate,
                    "monthly_cost": round(ghas_cost, 2),
                }
            )
            total += ghas_cost

        return {
            "plan": plan_key,
            "copilot_plan": copilot_plan,
            "users": users,
            "currency": "USD",
            "data_version": GITHUB_PRICING_DATA_VERSION,
            "breakdown": breakdown,
            "monthly_total": round(total, 2),
            "annual_estimate": round(total * 12, 2),
            "note": (
                "Prices are list prices in USD from github.com/pricing. "
                "Volume discounts may apply for Enterprise agreements. "
                f"Data verified: {GITHUB_PRICING_DATA_VERSION}."
            ),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _match_plan(name: str) -> str:
        """Case-insensitive match to a GitHub plan key."""
        normalised = name.strip().lower()
        for key in GITHUB_PLANS:
            if key.lower() == normalised:
                return key
        # Fuzzy fallback
        for key in GITHUB_PLANS:
            if normalised in key.lower() or key.lower() in normalised:
                return key
        return "Team"  # sensible default

    @staticmethod
    def _match_copilot_plan(name: str) -> str:
        """Case-insensitive match to a Copilot plan key."""
        normalised = name.strip().lower().replace("+", "+")
        for key in GITHUB_COPILOT_PLANS:
            if key.lower() == normalised:
                return key
        for key in GITHUB_COPILOT_PLANS:
            if normalised in key.lower() or key.lower() in normalised:
                return key
        return "Pro"  # sensible default

    # ------------------------------------------------------------------
    # Section builders
    # ------------------------------------------------------------------

    @staticmethod
    def _get_plans() -> list[dict[str, Any]]:
        return [
            {
                "name": name,
                "price_monthly": data["price_monthly"],
                "price_annual_per_month": data["price_annual_per_month"],
                "target": data["target"],
                "includes": data["includes"],
            }
            for name, data in GITHUB_PLANS.items()
        ]

    @staticmethod
    def _get_copilot(plan_filter: str | None = None) -> list[dict[str, Any]]:
        result = []
        for name, data in GITHUB_COPILOT_PLANS.items():
            if plan_filter:
                if name.lower() != plan_filter.strip().lower():
                    continue
            result.append(
                {
                    "name": name,
                    "price_monthly": data["price_monthly"],
                    "price_annual": data["price_annual"],
                    "target": data["target"],
                    "includes": data["includes"],
                }
            )
        return result

    @staticmethod
    def _get_actions() -> dict[str, Any]:
        runners = []
        for label, data in GITHUB_ACTIONS_RUNNERS.items():
            runners.append(
                {
                    "runner": label,
                    "per_minute": data["per_minute"],
                    "os": data["os"],
                    "cores": data["cores"],
                }
            )
        return {
            "runners": runners,
            "free_minutes": dict(GITHUB_ACTIONS_FREE_MINUTES.items()),
            "multipliers": {
                "Linux": 1,
                "Windows": 2,
                "macOS": 10,
            },
        }

    @staticmethod
    def _get_security() -> list[dict[str, Any]]:
        return [
            {
                "name": name,
                "price_monthly_per_committer": data["price_monthly_per_committer"],
                "target": data["target"],
                "includes": data["includes"],
            }
            for name, data in GITHUB_SECURITY_PRODUCTS.items()
        ]

    @staticmethod
    def _get_codespaces() -> dict[str, Any]:
        return {
            "compute": {
                "price_per_core_hour": GITHUB_ADDONS["Codespaces Compute"]["price"],
                "description": GITHUB_ADDONS["Codespaces Compute"]["description"],
            },
            "storage": {
                "price_per_gb_month": GITHUB_ADDONS["Codespaces Storage"]["price"],
                "description": GITHUB_ADDONS["Codespaces Storage"]["description"],
            },
        }

    @staticmethod
    def _get_storage() -> list[dict[str, Any]]:
        storage_keys = [
            "Git LFS Data",
            "Git LFS Bandwidth",
            "GitHub Packages",
            "GitHub Packages Data Transfer",
        ]
        return [
            {
                "name": key,
                "unit": GITHUB_ADDONS[key]["unit"],
                "price": GITHUB_ADDONS[key]["price"],
                "description": GITHUB_ADDONS[key]["description"],
            }
            for key in storage_keys
            if key in GITHUB_ADDONS
        ]
