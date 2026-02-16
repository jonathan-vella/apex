"""Tests for input validation module."""

from azure_pricing_mcp.validation import validate_arguments


class TestValidateArguments:
    def test_no_error_on_valid_price_search(self):
        result = validate_arguments("azure_price_search", {"service_name": "Virtual Machines"})
        assert result is None

    def test_missing_required_field(self):
        result = validate_arguments("azure_cost_estimate", {"service_name": "VM"})
        assert result is not None
        assert result["code"] == "MISSING_REQUIRED_FIELD"
        assert "sku_name" in result["details"]["missing_fields"]
        assert "region" in result["details"]["missing_fields"]

    def test_all_required_fields_present(self):
        result = validate_arguments(
            "azure_cost_estimate",
            {"service_name": "Virtual Machines", "sku_name": "D2s_v3", "region": "eastus"},
        )
        assert result is None

    def test_empty_string_field_rejected(self):
        result = validate_arguments(
            "azure_cost_estimate",
            {"service_name": "", "sku_name": "D2s_v3", "region": "eastus"},
        )
        assert result is not None
        assert result["code"] == "INVALID_FIELD_VALUE"
        assert result["details"]["field"] == "service_name"

    def test_whitespace_only_string_rejected(self):
        result = validate_arguments(
            "azure_cost_estimate",
            {"service_name": "  ", "sku_name": "D2s_v3", "region": "eastus"},
        )
        assert result is not None
        assert result["code"] == "INVALID_FIELD_VALUE"

    def test_negative_limit_rejected(self):
        result = validate_arguments("azure_price_search", {"limit": -5})
        assert result is not None
        assert result["code"] == "INVALID_FIELD_VALUE"
        assert result["details"]["field"] == "limit"

    def test_zero_limit_accepted(self):
        result = validate_arguments("azure_price_search", {"limit": 0})
        assert result is None

    def test_negative_discount_rejected(self):
        result = validate_arguments("azure_price_search", {"discount_percentage": -1})
        assert result is not None
        assert result["code"] == "INVALID_FIELD_VALUE"

    def test_empty_bulk_resources_rejected(self):
        result = validate_arguments("azure_bulk_estimate", {"resources": []})
        assert result is not None
        assert result["code"] == "EMPTY_RESOURCE_LIST"

    def test_non_empty_bulk_resources_accepted(self):
        result = validate_arguments(
            "azure_bulk_estimate",
            {"resources": [{"service_name": "VM", "sku_name": "D2", "region": "eastus"}]},
        )
        assert result is None

    def test_unknown_tool_passes(self):
        """Unknown tools should not fail validation (no required fields defined)."""
        result = validate_arguments("unknown_tool", {"anything": "goes"})
        assert result is None

    def test_spot_tools_require_fields(self):
        result = validate_arguments("spot_eviction_rates", {})
        assert result is not None
        assert "skus" in result["details"]["missing_fields"]

    def test_simulate_eviction_requires_resource_id(self):
        result = validate_arguments("simulate_eviction", {})
        assert result is not None
        assert "vm_resource_id" in result["details"]["missing_fields"]
