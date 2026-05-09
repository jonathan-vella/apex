"""Pytest configuration and fixtures for Azure Pricing MCP tests.

Provides:
- ``admin_available`` marker: skip tests if admin extras not installed
"""

import pytest


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "admin_required: skip test if admin extras (azure-identity, etc.) not available")


# Detect admin availability at collection time
def _admin_available():
    """Check if admin extras (azure-identity, azure-mgmt-*) are available."""
    try:
        import azure.core.credentials  # noqa: F401
        import azure.identity  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.fixture(scope="session")
def admin_available():
    """Fixture providing admin availability status."""
    return _admin_available()


# Auto-skip admin-required tests if dependencies missing
def pytest_collection_modifyitems(config, items):
    """Skip admin_required tests if admin extras not available."""
    if not _admin_available():
        skip_admin = pytest.mark.skip(reason="admin extras not installed")
        for item in items:
            if "admin_required" in item.keywords:
                item.add_marker(skip_admin)
