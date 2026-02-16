"""Standardized error codes and response helpers for Azure Pricing MCP Server.

Provides a single ErrorCode enum and an error_response() factory so that
every tool returns errors in a consistent, machine-readable structure:

    {"error": True, "code": "<ERROR_CODE>", "message": "...", ...}
"""

from enum import Enum
from typing import Any


class ErrorCode(str, Enum):
    """Machine-readable error codes returned by tool handlers."""

    # Input validation
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
    INVALID_FIELD_VALUE = "INVALID_FIELD_VALUE"
    EMPTY_RESOURCE_LIST = "EMPTY_RESOURCE_LIST"

    # Service / runtime
    SERVICE_NOT_INITIALIZED = "SERVICE_NOT_INITIALIZED"
    SESSION_NOT_ACTIVE = "SESSION_NOT_ACTIVE"
    AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"

    # Pricing API
    NO_PRICES_FOUND = "NO_PRICES_FOUND"
    API_ERROR = "API_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    TIMEOUT = "TIMEOUT"

    # Bulk-specific
    BULK_PARTIAL_FAILURE = "BULK_PARTIAL_FAILURE"
    BULK_ITEM_FAILED = "BULK_ITEM_FAILED"

    # Catch-all
    INTERNAL_ERROR = "INTERNAL_ERROR"
    UNKNOWN_TOOL = "UNKNOWN_TOOL"


def error_response(
    code: ErrorCode,
    message: str,
    *,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a standardized error dict.

    Args:
        code: Machine-readable error code from ErrorCode enum.
        message: Human-readable description of the error.
        details: Optional extra context (field names, indices, etc.).

    Returns:
        A dict with ``error=True``, ``code``, ``message``, and optional ``details``.
    """
    result: dict[str, Any] = {
        "error": True,
        "code": code.value,
        "message": message,
    }
    if details:
        result["details"] = details
    return result
