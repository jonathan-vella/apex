"""MCP tool response envelope (v5.2).

The MCP spec lets a tool return *both* unstructured text content AND a
structured-content dict (validated against the tool's ``outputSchema``).
The low-level Python SDK accepts a ``tuple[list[ContentBlock], dict]`` from
the ``@server.call_tool()`` handler to convey both.

Wrapping every handler signature in a tuple would force a 26-site test
rewrite (each test currently does ``result = await handler(...); result[0].text``).
Instead we expose a thin subclass of ``list`` that carries an optional
``.structured`` payload as an attribute. Existing list-shape callers
(including all current tests) work unchanged; the dispatcher in
:mod:`azure_pricing_mcp.server` reads ``.structured`` and emits the
SDK-required tuple shape only when present.

This is a presentation-layer concern — service code never constructs
``MCPToolResponse`` directly.
"""

from __future__ import annotations

from typing import Any

from mcp.types import TextContent


class MCPToolResponse(list[TextContent]):
    """A list of TextContent that can also carry a ``structured`` payload.

    Attributes:
        structured: Optional dict matching the tool's ``outputSchema``.
            When set, the dispatcher emits both unstructured text and
            structured content per the MCP spec.
    """

    __slots__ = ("structured",)

    def __init__(
        self,
        content: list[TextContent],
        structured: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(content)
        self.structured: dict[str, Any] | None = structured


def strip_private_keys(payload: dict[str, Any]) -> dict[str, Any]:
    """Drop dict keys that start with ``_`` (private impl details).

    The pricing service stashes ``_discount_metadata`` on result dicts to
    drive the v4 discount-tip footer. That key is presentation-layer state
    and should not bleed into the structured-content envelope returned to
    MCP clients.
    """
    return {k: v for k, v in payload.items() if not k.startswith("_")}
