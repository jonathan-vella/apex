"""Admin-tier tools for Azure Pricing MCP — gated by ``[admin]`` extras.

This subpackage hosts tools that require an Azure subscription + the
``azure-identity`` SDK (and credentials provisioned via ``az login`` or
``DefaultAzureCredential`` env vars):

- ``spot_eviction_rates`` / ``spot_price_history`` / ``simulate_eviction``
- ``find_orphaned_resources``

The package itself is importable without the optional dependencies — admin
handler methods and tool definitions remain accessible (services lazy-import
``azure.identity`` at runtime via ``..auth``). Use ``is_admin_available()`` to
detect whether the SDK is installed before registering admin tools.

This design lets unit tests using mocks compose ``AdminHandlers`` without
needing the real Azure SDK installed (closes Copilot review #2 on PR #356).
"""

from __future__ import annotations

from .handlers import AdminHandlers
from .tools import get_admin_tool_definitions


def is_admin_available() -> bool:
    """Return True iff the ``[admin]`` extras (azure-identity + azure-core) are
    importable. Probed lazily on first call.

    Multi-import probe scope (Phase 4.17): only the modules actually used by
    the admin services. The plan listed ``azure.mgmt.resourcegraph`` /
    ``azure.mgmt.compute`` / ``azure.mgmt.costmanagement`` but the v5
    implementation talks to those services via raw aiohttp REST calls; only
    ``azure.identity`` and ``azure.core.credentials`` are materially required
    at runtime.
    """
    try:
        import azure.core.credentials  # noqa: F401
        import azure.identity  # noqa: F401

        return True
    except ImportError:
        return False


__all__ = ["AdminHandlers", "get_admin_tool_definitions", "is_admin_available"]
