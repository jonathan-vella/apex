"""Response-format helpers for Azure Pricing MCP v5.0.

The ``response_format`` parameter (compact|table|full) controls how much
prose, decoration, and embedded JSON each tool emits. The default is
``compact`` to minimise token consumption in agent flows; clients that
parse the verbose v4 string shape can pass ``full`` for back-compat.
"""

from __future__ import annotations

from typing import Any, Final, Literal

ResponseFormat = Literal["compact", "table", "full"]

VALID_RESPONSE_FORMATS: Final[tuple[ResponseFormat, ...]] = ("compact", "table", "full")
DEFAULT_RESPONSE_FORMAT: Final[ResponseFormat] = "compact"

# JSON Schema fragment injected into every tool that supports
# ``response_format``. Centralised so phase-4 tool-annotation work and the
# phase-6 documentation can reference one source of truth.
RESPONSE_FORMAT_SCHEMA: Final[dict[str, Any]] = {
    "type": "string",
    "enum": list(VALID_RESPONSE_FORMATS),
    "default": DEFAULT_RESPONSE_FORMAT,
    "description": (
        "Output verbosity tier. 'compact' (default) returns a token-efficient "
        "markdown summary; 'table' returns the markdown table only; 'full' "
        "returns the verbose v4-compatible string (with embedded JSON + "
        "discount tips). Use 'full' only when you need byte-for-byte v4 "
        "back-compat."
    ),
}


def coerce_response_format(value: Any, *, default: ResponseFormat = DEFAULT_RESPONSE_FORMAT) -> ResponseFormat:
    """Validate a free-form ``response_format`` argument.

    Unknown / missing values fall back to ``default`` (compact) rather than
    raising — agent-side typos should not crash the tool call.
    """
    if isinstance(value, str) and value in VALID_RESPONSE_FORMATS:
        return value  # type: ignore[return-value]
    return default
