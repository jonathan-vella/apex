"""Tests for tool definitions."""

from azure_pricing_mcp.tools import get_tool_definitions


class TestToolDefinitions:
    def test_tool_count(self):
        tools = get_tool_definitions()
        assert len(tools) == 13  # 12 original + azure_cache_stats

    def test_bulk_estimate_exists(self):
        tools = get_tool_definitions()
        names = [t.name for t in tools]
        assert "azure_bulk_estimate" in names

    def test_cost_estimate_has_quantity(self):
        tools = get_tool_definitions()
        cost_tool = next(t for t in tools if t.name == "azure_cost_estimate")
        props = cost_tool.inputSchema["properties"]
        assert "quantity" in props

    def test_output_format_on_main_tools(self):
        tools = get_tool_definitions()
        expected = {"azure_price_search", "azure_price_compare", "azure_cost_estimate", "azure_region_recommend", "azure_bulk_estimate"}
        for tool in tools:
            if tool.name in expected:
                assert "output_format" in tool.inputSchema["properties"], f"Missing output_format on {tool.name}"

    def test_all_tools_have_name_and_description(self):
        tools = get_tool_definitions()
        for tool in tools:
            assert tool.name, "Tool missing name"
            assert tool.description, f"Tool {tool.name} missing description"
