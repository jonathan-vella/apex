"""Handler methods for GitHub Pricing tools."""

from __future__ import annotations

from typing import Any

from mcp.types import TextContent

from ..services.github_pricing import GitHubPricingService
from .formatters import (
    format_github_cost_estimate_response,
    format_github_pricing_response,
)


class GitHubPricingHandlers:
    """Mixin providing handler methods for GitHub pricing tools.

    Designed to be composed into the main ``ToolHandlers`` class via
    the mixin inheritance chain.  Requires ``_github_pricing_service``
    attribute on the host instance.
    """

    _github_pricing_service: GitHubPricingService | None

    def _get_github_pricing_service(self) -> GitHubPricingService:
        """Get or lazily create the GitHubPricingService."""
        if self._github_pricing_service is None:
            self._github_pricing_service = GitHubPricingService()
        return self._github_pricing_service

    async def handle_github_pricing(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle ``github_pricing`` tool calls."""
        service = self._get_github_pricing_service()
        result = await service.get_pricing(
            product=arguments.get("product"),
            copilot_plan=arguments.get("copilot_plan"),
        )
        text = format_github_pricing_response(result)
        return [TextContent(type="text", text=text)]

    async def handle_github_cost_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle ``github_cost_estimate`` tool calls."""
        service = self._get_github_pricing_service()
        result = await service.estimate_cost(
            users=arguments.get("users", 1),
            plan=arguments.get("plan"),
            copilot_plan=arguments.get("copilot_plan"),
            actions_minutes=arguments.get("actions_minutes", 0),
            actions_runner=arguments.get("actions_runner"),
            codespaces_hours=arguments.get("codespaces_hours", 0.0),
            codespaces_cores=arguments.get("codespaces_cores", 4),
            codespaces_storage_gb=arguments.get("codespaces_storage_gb", 0.0),
            lfs_packs=arguments.get("lfs_packs", 0),
            ghas_committers=arguments.get("ghas_committers", 0),
        )
        text = format_github_cost_estimate_response(result)
        return [TextContent(type="text", text=text)]
