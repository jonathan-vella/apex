"""Tests for the azure_cache_stats tool, handler, and formatter."""

import pytest
from conftest import FakeClient

from azure_pricing_mcp.formatters import format_cache_stats_response
from azure_pricing_mcp.handlers import ToolHandlers
from azure_pricing_mcp.services.pricing import PricingService
from azure_pricing_mcp.services.retirement import RetirementService
from azure_pricing_mcp.tools import get_tool_definitions


class TestCacheStatsToolDefinition:
    def test_tool_exists(self):
        tools = get_tool_definitions()
        names = [t.name for t in tools]
        assert "azure_cache_stats" in names

    def test_no_required_fields(self):
        tools = get_tool_definitions()
        tool = next(t for t in tools if t.name == "azure_cache_stats")
        assert "required" not in tool.inputSchema or tool.inputSchema.get("required") == []


class TestCacheStatsFormatter:
    def test_zero_stats(self):
        text = format_cache_stats_response({"hits": 0, "misses": 0, "size": 0})
        assert "0.0%" in text
        assert "0 entries" in text

    def test_with_hits(self):
        text = format_cache_stats_response({"hits": 80, "misses": 20, "size": 50})
        assert "80.0%" in text
        assert "50 entries" in text

    def test_empty_dict(self):
        text = format_cache_stats_response({})
        assert "0.0%" in text


class TestCacheStatsHandler:
    @pytest.mark.asyncio
    async def test_returns_formatted_text(self):
        client = FakeClient()
        retirement = RetirementService(client)
        pricing = PricingService(client, retirement)
        handlers = ToolHandlers(pricing, None)

        stats = {"hits": 10, "misses": 5, "size": 8}
        result = await handlers.handle_cache_stats({}, stats)
        assert len(result) == 1
        assert "10" in result[0].text
        assert "5" in result[0].text
