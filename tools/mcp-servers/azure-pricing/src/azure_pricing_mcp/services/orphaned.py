"""Orphaned resources MCP service wrapper.

Thin async service layer that delegates to OrphanedResourceScanner,
following the same pattern as SpotService.
"""

import logging
from typing import Any

from ..auth import AzureCredentialManager, get_credential_manager
from .orphaned_resources import OrphanedResourceScanner

logger = logging.getLogger(__name__)


class OrphanedResourcesService:
    """MCP-facing async service for orphaned resource detection."""

    def __init__(
        self,
        credential_manager: AzureCredentialManager | None = None,
    ) -> None:
        """Initialize the orphaned resources service.

        Args:
            credential_manager: Optional credential manager. If not provided,
                              uses the singleton instance.
        """
        self._credential_manager = credential_manager or get_credential_manager()
        self._scanner = OrphanedResourceScanner(self._credential_manager)

    async def find_orphaned_resources(
        self,
        days: int = 60,
        all_subscriptions: bool = True,
    ) -> dict[str, Any]:
        """Find orphaned resources across Azure subscriptions.

        Args:
            days: Number of days to look back for cost data.
            all_subscriptions: If True, scan all accessible subscriptions.

        Returns:
            Dict with orphaned resources grouped by subscription, or error dict.
        """
        logger.info(f"Scanning for orphaned resources (lookback: {days} days, all subs: {all_subscriptions})")

        result = await self._scanner.scan(days=days, all_subscriptions=all_subscriptions)

        if "error" not in result:
            logger.info(
                f"Found {result.get('total_orphaned', 0)} orphaned resources "
                f"across {len(result.get('subscriptions', []))} subscription(s)"
            )

        return result
