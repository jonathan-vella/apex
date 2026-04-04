"""Tests for GitHub Pricing tools."""

import pytest

from azure_pricing_mcp.config import (
    GITHUB_ACTIONS_RUNNERS,
    GITHUB_ADDONS,
    GITHUB_COPILOT_PLANS,
    GITHUB_PLANS,
    GITHUB_PRICING_DATA_VERSION,
    GITHUB_SECURITY_PRODUCTS,
)
from azure_pricing_mcp.github_pricing.formatters import (
    format_github_cost_estimate_response,
    format_github_pricing_response,
)
from azure_pricing_mcp.services.github_pricing import GitHubPricingService, _resolve_product

# ── Config sanity checks ────────────────────────────────────────────────


class TestGitHubPricingConfig:
    """Verify static pricing tables are well-formed."""

    def test_plans_non_empty(self):
        assert len(GITHUB_PLANS) >= 3

    def test_copilot_plans_non_empty(self):
        assert len(GITHUB_COPILOT_PLANS) >= 4

    def test_actions_runners_non_empty(self):
        assert len(GITHUB_ACTIONS_RUNNERS) >= 10

    def test_security_products_non_empty(self):
        assert len(GITHUB_SECURITY_PRODUCTS) >= 1

    def test_addons_non_empty(self):
        assert len(GITHUB_ADDONS) >= 4

    def test_all_plans_have_required_keys(self):
        for name, data in GITHUB_PLANS.items():
            assert "price_monthly" in data, f"Plan '{name}' missing price_monthly"
            assert "target" in data, f"Plan '{name}' missing target"
            assert "includes" in data, f"Plan '{name}' missing includes"

    def test_all_copilot_plans_have_required_keys(self):
        for name, data in GITHUB_COPILOT_PLANS.items():
            assert "price_monthly" in data, f"Copilot plan '{name}' missing price_monthly"
            assert "price_annual" in data, f"Copilot plan '{name}' missing price_annual"
            assert "target" in data, f"Copilot plan '{name}' missing target"

    def test_all_runners_have_required_keys(self):
        for label, data in GITHUB_ACTIONS_RUNNERS.items():
            assert "per_minute" in data, f"Runner '{label}' missing per_minute"
            assert "os" in data, f"Runner '{label}' missing os"
            assert "cores" in data, f"Runner '{label}' missing cores"
            assert data["per_minute"] > 0, f"Runner '{label}' has non-positive rate"

    def test_data_version_format(self):
        parts = GITHUB_PRICING_DATA_VERSION.split("-")
        assert len(parts) == 3, "Data version should be YYYY-MM-DD"


# ── Product resolution ──────────────────────────────────────────────────


class TestResolveProduct:
    """Test the alias-based product resolution logic."""

    def test_none_returns_none(self):
        assert _resolve_product(None) is None

    def test_empty_string_returns_none(self):
        assert _resolve_product("") is None
        assert _resolve_product("   ") is None

    @pytest.mark.parametrize(
        "input_val,expected",
        [
            ("copilot", "copilot"),
            ("Copilot", "copilot"),
            ("github copilot", "copilot"),
            ("actions", "actions"),
            ("ci/cd", "actions"),
            ("runners", "actions"),
            ("plans", "plans"),
            ("plan", "plans"),
            ("subscription", "plans"),
            ("security", "security"),
            ("ghas", "security"),
            ("codespaces", "codespaces"),
            ("lfs", "storage"),
            ("packages", "storage"),
        ],
    )
    def test_known_aliases(self, input_val, expected):
        assert _resolve_product(input_val) == expected

    def test_unknown_returns_none(self):
        assert _resolve_product("xyzzyplugh") is None


# ── GitHubPricingService.get_pricing ────────────────────────────────────


class TestGetPricing:
    """Test the pricing lookup service."""

    @pytest.fixture
    def service(self):
        return GitHubPricingService()

    @pytest.mark.asyncio
    async def test_full_catalog(self, service):
        result = await service.get_pricing()
        sections = result["sections"]
        assert "plans" in sections
        assert "copilot" in sections
        assert "actions" in sections
        assert "security" in sections
        assert "codespaces" in sections
        assert "storage" in sections
        assert result["data_version"] == GITHUB_PRICING_DATA_VERSION

    @pytest.mark.asyncio
    async def test_filter_copilot(self, service):
        result = await service.get_pricing(product="copilot")
        assert "copilot" in result["sections"]
        assert "plans" not in result["sections"]
        assert result["resolved_category"] == "copilot"

    @pytest.mark.asyncio
    async def test_filter_actions(self, service):
        result = await service.get_pricing(product="ci/cd")
        assert "actions" in result["sections"]
        assert result["resolved_category"] == "actions"

    @pytest.mark.asyncio
    async def test_copilot_plan_filter(self, service):
        result = await service.get_pricing(product="copilot", copilot_plan="Business")
        plans = result["sections"]["copilot"]
        assert len(plans) == 1
        assert plans[0]["name"] == "Business"

    @pytest.mark.asyncio
    async def test_plans_section_structure(self, service):
        result = await service.get_pricing(product="plans")
        plans = result["sections"]["plans"]
        assert len(plans) == len(GITHUB_PLANS)
        for plan in plans:
            assert "name" in plan
            assert "price_monthly" in plan
            assert "includes" in plan

    @pytest.mark.asyncio
    async def test_actions_section_structure(self, service):
        result = await service.get_pricing(product="actions")
        actions = result["sections"]["actions"]
        assert "runners" in actions
        assert "free_minutes" in actions
        assert "multipliers" in actions
        assert len(actions["runners"]) == len(GITHUB_ACTIONS_RUNNERS)


# ── GitHubPricingService.estimate_cost ──────────────────────────────────


class TestEstimateCost:
    """Test the cost estimation service."""

    @pytest.fixture
    def service(self):
        return GitHubPricingService()

    @pytest.mark.asyncio
    async def test_copilot_only_no_plan(self, service):
        """Copilot-only query should NOT include plan cost."""
        result = await service.estimate_cost(users=20, copilot_plan="Business")
        assert result["plan"] is None
        assert result["monthly_total"] == 380.0  # 20 × $19 Copilot only
        breakdown_items = [b["item"] for b in result["breakdown"]]
        assert not any("plan" in item.lower() for item in breakdown_items)

    @pytest.mark.asyncio
    async def test_basic_team_plan(self, service):
        result = await service.estimate_cost(users=10, plan="Team")
        assert result["plan"] == "Team"
        assert result["users"] == 10
        assert result["monthly_total"] == 40.0  # 10 × $4
        assert result["annual_estimate"] == 480.0

    @pytest.mark.asyncio
    async def test_with_copilot_business(self, service):
        """When plan IS explicitly provided alongside copilot, both are included."""
        result = await service.estimate_cost(users=5, plan="Team", copilot_plan="Business")
        # Plan: 5 × $4 = $20, Copilot: 5 × $19 = $95 → total $115
        assert result["monthly_total"] == 115.0

    @pytest.mark.asyncio
    async def test_actions_free_tier_deduction(self, service):
        # Team plan gets 3000 free minutes; consume 5000 → 2000 billable
        result = await service.estimate_cost(users=1, plan="Team", actions_minutes=5000)
        breakdown = {b["item"]: b for b in result["breakdown"]}
        actions_item = breakdown.get("Actions minutes (Linux 2-core)")
        assert actions_item is not None
        assert actions_item["quantity"] == 2000  # 5000 - 3000
        assert actions_item["monthly_cost"] == 2000 * 0.008

    @pytest.mark.asyncio
    async def test_actions_within_free_tier(self, service):
        # Consume only 1000 of 3000 free minutes for Team → 0 billable
        result = await service.estimate_cost(users=1, plan="Team", actions_minutes=1000)
        breakdown = {b["item"]: b for b in result["breakdown"]}
        actions_item = breakdown.get("Actions minutes (Linux 2-core)")
        assert actions_item is not None
        assert actions_item["quantity"] == 0
        assert actions_item["monthly_cost"] == 0.0

    @pytest.mark.asyncio
    async def test_codespaces_cost(self, service):
        result = await service.estimate_cost(
            users=1.0,
            plan="Free",
            codespaces_hours=100,
            codespaces_cores=4,
        )
        breakdown = {b["item"]: b for b in result["breakdown"]}
        cs = breakdown.get("Codespaces Compute")
        assert cs is not None
        assert cs["quantity"] == 400  # 100 hours × 4 cores
        assert cs["monthly_cost"] == 400 * 0.18

    @pytest.mark.asyncio
    async def test_lfs_packs(self, service):
        result = await service.estimate_cost(users=1, plan="Free", lfs_packs=3)
        breakdown = {b["item"]: b for b in result["breakdown"]}
        lfs = breakdown.get("Git LFS Data Packs")
        assert lfs is not None
        assert lfs["monthly_cost"] == 15.0  # 3 × $5

    @pytest.mark.asyncio
    async def test_ghas_committers(self, service):
        result = await service.estimate_cost(users=1, plan="Enterprise", ghas_committers=10)
        breakdown = {b["item"]: b for b in result["breakdown"]}
        ghas = breakdown.get("GitHub Advanced Security (GHAS)")
        assert ghas is not None
        assert ghas["monthly_cost"] == 490.0  # 10 × $49

    @pytest.mark.asyncio
    async def test_empty_estimate(self, service):
        result = await service.estimate_cost(users=0)
        assert result["monthly_total"] == 0.0

    @pytest.mark.asyncio
    async def test_case_insensitive_plan(self, service):
        result = await service.estimate_cost(users=1, plan="enterprise")
        assert result["plan"] == "Enterprise"
        assert result["monthly_total"] == 21.0


# ── Formatters ──────────────────────────────────────────────────────────


class TestFormatters:
    """Test response formatters produce valid Markdown."""

    @pytest.fixture
    def service(self):
        return GitHubPricingService()

    @pytest.mark.asyncio
    async def test_format_pricing_full(self, service):
        result = await service.get_pricing()
        text = format_github_pricing_response(result)
        assert "### GitHub Pricing" in text
        assert "GitHub Plans" in text
        assert "GitHub Copilot" in text
        assert "GitHub Actions Runners" in text
        assert "Codespaces" in text

    @pytest.mark.asyncio
    async def test_format_pricing_copilot_only(self, service):
        result = await service.get_pricing(product="copilot")
        text = format_github_pricing_response(result)
        assert "Copilot" in text
        assert "GitHub Plans" not in text  # plans section excluded

    @pytest.mark.asyncio
    async def test_format_cost_estimate(self, service):
        result = await service.estimate_cost(users=10, plan="Team", copilot_plan="Business")
        text = format_github_cost_estimate_response(result)
        assert "### GitHub Cost Estimate" in text
        assert "Monthly total" in text
        assert "Annual estimate" in text
        assert "$" in text

    @pytest.mark.asyncio
    async def test_format_empty_pricing(self, service):
        result = {
            "sections": {},
            "product_filter": "unknown_xyz",
            "resolved_category": None,
            "available_categories": ["actions", "copilot", "plans"],
            "data_version": GITHUB_PRICING_DATA_VERSION,
            "currency": "USD",
        }
        text = format_github_pricing_response(result)
        assert "not recognized" in text
        assert "Available categories" in text


# ── Handler integration ─────────────────────────────────────────────────


class TestHandlerIntegration:
    """Test handlers produce TextContent responses."""

    @pytest.mark.asyncio
    async def test_github_pricing_handler(self):
        from azure_pricing_mcp.github_pricing.handlers import GitHubPricingHandlers

        class _Stub(GitHubPricingHandlers):
            _github_pricing_service = None

        handler = _Stub()
        result = await handler.handle_github_pricing({"product": "copilot"})
        assert len(result) == 1
        assert result[0].type == "text"
        assert "Copilot" in result[0].text

    @pytest.mark.asyncio
    async def test_github_cost_estimate_handler(self):
        from azure_pricing_mcp.github_pricing.handlers import GitHubPricingHandlers

        class _Stub(GitHubPricingHandlers):
            _github_pricing_service = None

        handler = _Stub()
        result = await handler.handle_github_cost_estimate({"users": 5, "plan": "Team"})
        assert len(result) == 1
        assert "GitHub Cost Estimate" in result[0].text
