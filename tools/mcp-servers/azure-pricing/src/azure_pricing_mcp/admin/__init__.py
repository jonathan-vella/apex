"""Admin-tier tools for Azure Pricing MCP — gated by ``[admin]`` extras.

This subpackage hosts tools that require an Azure subscription + the
``azure-identity`` SDK (and credentials provisioned via ``az login`` or
``DefaultAzureCredential`` env vars):

- ``spot_eviction_rates`` / ``spot_price_history`` / ``simulate_eviction``
- ``find_orphaned_resources``

Importing this subpackage probes for the required SDK at module load. If the
probe fails, the import raises ``ImportError`` and the parent server skips
admin-tool registration with a logged hint.

Multi-import probe scope (Phase 4.17): only the modules actually used by the
admin services. The plan listed ``azure.mgmt.resourcegraph`` /
``azure.mgmt.compute`` / ``azure.mgmt.costmanagement`` but the v5 implementation
talks to those services via raw aiohttp REST calls; only ``azure.identity`` is
materially required at runtime.
"""

from __future__ import annotations

import azure.core.credentials  # noqa: F401  (TYPE-CHECK target in ..auth)

# Multi-import probe — runs at import time. Any failure here raises ImportError
# and the parent ``server.create_server`` falls back gracefully.
import azure.identity  # noqa: F401  (auth — used by ..auth)

from .handlers import AdminHandlers
from .tools import get_admin_tool_definitions

__all__ = ["AdminHandlers", "get_admin_tool_definitions"]
