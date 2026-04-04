"""Tests for PTU Sizing + Cost Planner feature."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from azure_pricing_mcp.formatters import format_ptu_sizing_response
from azure_pricing_mcp.services.ptu import PTUService
from azure_pricing_mcp.services.ptu_models import (
    DEPLOYMENT_TYPES,
    PTU_MODEL_TABLE,
    get_model_canonical_name,
    get_model_info,
    get_supported_models,
)
from azure_pricing_mcp.tools import get_tool_definitions

# =========================================================================
# Tool definition tests
# =========================================================================


class TestToolDefinition:
    """Verify azure_ptu_sizing tool is registered correctly."""

    def test_tool_exists(self) -> None:
        tools = get_tool_definitions()
        names = [t.name for t in tools]
        assert "azure_ptu_sizing" in names

    def test_schema_has_required_properties(self) -> None:
        tools = get_tool_definitions()
        ptu_tool = next(t for t in tools if t.name == "azure_ptu_sizing")
        schema = ptu_tool.inputSchema
        assert schema["type"] == "object"
        props = schema["properties"]

        required_props = [
            "model",
            "deployment_type",
            "rpm",
            "avg_input_tokens",
            "avg_output_tokens",
        ]
        for prop in required_props:
            assert prop in props, f"Missing required property: {prop}"

        assert set(schema["required"]) == set(required_props)

    def test_schema_has_optional_properties(self) -> None:
        tools = get_tool_definitions()
        ptu_tool = next(t for t in tools if t.name == "azure_ptu_sizing")
        props = ptu_tool.inputSchema["properties"]

        optional_props = [
            "cached_tokens_per_request",
            "include_cost",
            "region",
            "currency_code",
        ]
        for prop in optional_props:
            assert prop in props, f"Missing optional property: {prop}"

    def test_deployment_type_enum(self) -> None:
        tools = get_tool_definitions()
        ptu_tool = next(t for t in tools if t.name == "azure_ptu_sizing")
        dt_prop = ptu_tool.inputSchema["properties"]["deployment_type"]
        assert "enum" in dt_prop
        assert set(dt_prop["enum"]) == {"GlobalProvisioned", "DataZoneProvisioned", "RegionalProvisioned"}


# =========================================================================
# PTU model table tests
# =========================================================================


class TestPTUModelTable:
    """Verify PTU model data integrity."""

    REQUIRED_KEYS = [
        "input_tpm_per_ptu",
        "output_multiplier",
        "global_min_ptus",
        "global_increment",
        "regional_min_ptus",
        "regional_increment",
    ]

    def test_all_models_have_required_keys(self) -> None:
        for model_id, info in PTU_MODEL_TABLE.items():
            for key in self.REQUIRED_KEYS:
                assert key in info, f"Model '{model_id}' missing key: {key}"

    def test_input_tpm_per_ptu_positive(self) -> None:
        for model_id, info in PTU_MODEL_TABLE.items():
            assert info["input_tpm_per_ptu"] > 0, f"Model '{model_id}' has non-positive input_tpm_per_ptu"

    def test_output_multiplier_positive(self) -> None:
        for model_id, info in PTU_MODEL_TABLE.items():
            assert info["output_multiplier"] > 0, f"Model '{model_id}' has non-positive output_multiplier"

    def test_global_min_and_increment_positive(self) -> None:
        for model_id, info in PTU_MODEL_TABLE.items():
            assert info["global_min_ptus"] > 0, f"Model '{model_id}' has non-positive global_min_ptus"
            assert info["global_increment"] > 0, f"Model '{model_id}' has non-positive global_increment"

    def test_regional_min_and_increment_consistent(self) -> None:
        """If regional is supported, both min and increment must be set; if not, both None."""
        for model_id, info in PTU_MODEL_TABLE.items():
            if info["regional_min_ptus"] is None:
                assert (
                    info["regional_increment"] is None
                ), f"Model '{model_id}': regional_min is None but increment is not"
            else:
                assert info["regional_min_ptus"] > 0
                assert info["regional_increment"] is not None
                assert info["regional_increment"] > 0

    def test_get_supported_models_returns_sorted(self) -> None:
        models = get_supported_models()
        assert models == sorted(models)
        assert len(models) == len(PTU_MODEL_TABLE)

    def test_get_model_info_exact_match(self) -> None:
        info = get_model_info("gpt-4.1")
        assert info is not None
        assert info["input_tpm_per_ptu"] == 3_000

    def test_get_model_info_case_insensitive(self) -> None:
        info = get_model_info("GPT-4.1")
        assert info is not None
        assert info["input_tpm_per_ptu"] == 3_000

    def test_get_model_info_unknown(self) -> None:
        assert get_model_info("nonexistent-model") is None

    def test_get_model_canonical_name(self) -> None:
        assert get_model_canonical_name("gpt-5") == "gpt-5"
        assert get_model_canonical_name("GPT-5") == "gpt-5"
        assert get_model_canonical_name("nonexistent") is None

    def test_deployment_types_valid(self) -> None:
        for _dt_key, dt_info in DEPLOYMENT_TYPES.items():
            assert "label" in dt_info
            assert "min_key" in dt_info
            assert "increment_key" in dt_info


# =========================================================================
# Computation unit tests
# =========================================================================


class TestComputeEqTPM:
    """Unit tests for token normalization."""

    def test_basic_no_caching(self) -> None:
        result = PTUService.compute_eq_tpm(
            rpm=100,
            input_tokens=500,
            output_tokens=200,
            output_multiplier=4,
            cached_tokens=0,
        )
        # eq_per_request = 500 + (200 * 4) = 1300
        # eq_tpm = 100 * 1300 = 130_000
        assert result["effective_input_tokens"] == 500
        assert result["eq_tokens_per_request"] == 1300
        assert result["eq_tpm"] == 130_000

    def test_with_caching(self) -> None:
        result = PTUService.compute_eq_tpm(
            rpm=100,
            input_tokens=500,
            output_tokens=200,
            output_multiplier=4,
            cached_tokens=200,
        )
        # effective_input = 500 - 200 = 300
        # eq_per_request = 300 + (200 * 4) = 1100
        # eq_tpm = 100 * 1100 = 110_000
        assert result["effective_input_tokens"] == 300
        assert result["eq_tokens_per_request"] == 1100
        assert result["eq_tpm"] == 110_000

    def test_high_output_multiplier(self) -> None:
        """gpt-5 uses 8x output multiplier."""
        result = PTUService.compute_eq_tpm(
            rpm=50,
            input_tokens=1000,
            output_tokens=500,
            output_multiplier=8,
            cached_tokens=0,
        )
        # eq_per_request = 1000 + (500 * 8) = 5000
        # eq_tpm = 50 * 5000 = 250_000
        assert result["eq_tokens_per_request"] == 5000
        assert result["eq_tpm"] == 250_000

    def test_zero_output_tokens(self) -> None:
        result = PTUService.compute_eq_tpm(
            rpm=100,
            input_tokens=500,
            output_tokens=0,
            output_multiplier=4,
            cached_tokens=0,
        )
        assert result["eq_tokens_per_request"] == 500
        assert result["eq_tpm"] == 50_000

    def test_zero_rpm(self) -> None:
        result = PTUService.compute_eq_tpm(
            rpm=0,
            input_tokens=500,
            output_tokens=200,
            output_multiplier=4,
            cached_tokens=0,
        )
        assert result["eq_tpm"] == 0

    def test_cached_exceeds_input_clamped_to_zero(self) -> None:
        """If cached_tokens > input_tokens, effective_input should be 0."""
        result = PTUService.compute_eq_tpm(
            rpm=100,
            input_tokens=100,
            output_tokens=200,
            output_multiplier=4,
            cached_tokens=500,
        )
        assert result["effective_input_tokens"] == 0
        # eq_per_request = 0 + (200 * 4) = 800
        assert result["eq_tokens_per_request"] == 800


class TestComputeRawPTU:
    """Unit tests for raw PTU calculation."""

    def test_basic(self) -> None:
        raw = PTUService.compute_raw_ptu(eq_tpm=130_000, input_tpm_per_ptu=2_500)
        assert raw == pytest.approx(52.0)

    def test_fractional(self) -> None:
        raw = PTUService.compute_raw_ptu(eq_tpm=100_000, input_tpm_per_ptu=3_000)
        assert raw == pytest.approx(33.333, rel=1e-2)

    def test_zero_tpm(self) -> None:
        raw = PTUService.compute_raw_ptu(eq_tpm=0, input_tpm_per_ptu=2_500)
        assert raw == 0.0

    def test_zero_capacity(self) -> None:
        raw = PTUService.compute_raw_ptu(eq_tpm=100_000, input_tpm_per_ptu=0)
        assert raw == 0.0


class TestRoundToValidPTU:
    """Unit tests for PTU rounding."""

    def test_below_minimum(self) -> None:
        assert PTUService.round_to_valid_ptu(raw_ptu=5.0, min_ptus=15, increment=5) == 15

    def test_exactly_at_minimum(self) -> None:
        assert PTUService.round_to_valid_ptu(raw_ptu=15.0, min_ptus=15, increment=5) == 15

    def test_just_above_minimum(self) -> None:
        assert PTUService.round_to_valid_ptu(raw_ptu=15.1, min_ptus=15, increment=5) == 20

    def test_exactly_on_increment(self) -> None:
        assert PTUService.round_to_valid_ptu(raw_ptu=25.0, min_ptus=15, increment=5) == 25

    def test_between_increments(self) -> None:
        assert PTUService.round_to_valid_ptu(raw_ptu=22.5, min_ptus=15, increment=5) == 25

    def test_large_value(self) -> None:
        assert PTUService.round_to_valid_ptu(raw_ptu=1001.0, min_ptus=100, increment=100) == 1100

    def test_regional_50_increment(self) -> None:
        """Regional gpt-4.1 uses min=50, increment=50."""
        assert PTUService.round_to_valid_ptu(raw_ptu=75.0, min_ptus=50, increment=50) == 100
        assert PTUService.round_to_valid_ptu(raw_ptu=100.0, min_ptus=50, increment=50) == 100
        assert PTUService.round_to_valid_ptu(raw_ptu=100.1, min_ptus=50, increment=50) == 150

    def test_zero_raw_ptu(self) -> None:
        """Zero RPM still gets minimum deployment."""
        assert PTUService.round_to_valid_ptu(raw_ptu=0.0, min_ptus=15, increment=5) == 15


class TestValidateLimits:
    """Unit tests for limit validation."""

    def test_within_limits(self) -> None:
        warnings = PTUService.validate_limits(rounded_ptu=100)
        # Should always have the benchmarking note
        assert any("estimate" in w.lower() for w in warnings)
        # Should not have exceeded warning
        assert not any("exceed" in w.lower() for w in warnings)

    def test_exceeds_max(self) -> None:
        warnings = PTUService.validate_limits(rounded_ptu=200_000)
        assert any("exceed" in w.lower() for w in warnings)

    def test_custom_max(self) -> None:
        warnings = PTUService.validate_limits(rounded_ptu=50, max_ptus=30)
        assert any("exceed" in w.lower() for w in warnings)


# =========================================================================
# Service integration tests
# =========================================================================


class TestEstimatePTUSizing:
    """End-to-end tests for the PTU sizing orchestrator."""

    @pytest.mark.asyncio
    async def test_known_model_basic(self) -> None:
        """Test sizing for gpt-4.1 with GlobalProvisioned."""
        service = PTUService()
        result = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
        )
        assert "error" not in result
        assert result["model"] == "gpt-4.1"
        assert result["deployment_type"] == "GlobalProvisioned"
        assert result["result"]["recommended_ptus"] >= result["result"]["minimum_ptus"]
        assert result["result"]["recommended_ptus"] >= result["result"]["raw_ptus"]

        # Verify rounding rule
        rec = result["result"]["recommended_ptus"]
        min_ptus = result["result"]["minimum_ptus"]
        inc = result["result"]["scale_increment"]
        assert (rec - min_ptus) % inc == 0

    @pytest.mark.asyncio
    async def test_known_model_with_caching(self) -> None:
        """Caching should reduce recommended PTUs."""
        service = PTUService()

        result_no_cache = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=1000,
            avg_output_tokens=200,
        )
        result_with_cache = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=1000,
            avg_output_tokens=200,
            cached_tokens_per_request=500,
        )
        assert result_with_cache["result"]["raw_ptus"] < result_no_cache["result"]["raw_ptus"]

    @pytest.mark.asyncio
    async def test_unknown_model_error(self) -> None:
        service = PTUService()
        result = await service.estimate_ptu_sizing(
            model="nonexistent-model",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
        )
        assert "error" in result
        assert "supported_models" in result

    @pytest.mark.asyncio
    async def test_unknown_deployment_type_error(self) -> None:
        service = PTUService()
        result = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="InvalidType",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
        )
        assert "error" in result
        assert "supported_types" in result

    @pytest.mark.asyncio
    async def test_regional_not_supported(self) -> None:
        """DeepSeek models don't support Regional deployments."""
        service = PTUService()
        result = await service.estimate_ptu_sizing(
            model="DeepSeek-R1",
            deployment_type="RegionalProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
        )
        assert "error" in result
        assert "does not support" in result["error"]

    @pytest.mark.asyncio
    async def test_negative_inputs_error(self) -> None:
        service = PTUService()
        result = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=-1,
            avg_input_tokens=500,
            avg_output_tokens=200,
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_cached_exceeds_input_error(self) -> None:
        service = PTUService()
        result = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
            cached_tokens_per_request=600,
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_include_cost_with_mock_client(self) -> None:
        """Test cost lookup with mocked pricing client."""
        mock_client = MagicMock()
        mock_client.fetch_prices = AsyncMock(
            return_value={
                "Items": [
                    {
                        "unitPrice": 0.06,
                        "meterName": "Provisioned Managed Throughput Unit",
                        "skuName": "Provisioned Managed",
                        "armRegionName": "eastus",
                    }
                ]
            }
        )

        service = PTUService(client=mock_client)
        result = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
            include_cost=True,
            region="eastus",
        )
        assert "error" not in result
        assert "cost" in result
        assert result["cost"]["price_per_ptu_hour"] == 0.06
        assert result["cost"]["hourly_cost"] > 0
        assert result["cost"]["monthly_cost_730h"] > 0

    @pytest.mark.asyncio
    async def test_include_cost_no_client(self) -> None:
        """Cost should gracefully handle missing client."""
        service = PTUService(client=None)
        result = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
            include_cost=True,
        )
        assert "error" not in result
        # Cost section should not be present if no client
        assert "cost" not in result or "note" in result.get("cost", {})

    @pytest.mark.asyncio
    async def test_gpt5_output_multiplier(self) -> None:
        """Verify gpt-5 uses 8x output multiplier."""
        service = PTUService()
        result = await service.estimate_ptu_sizing(
            model="gpt-5",
            deployment_type="GlobalProvisioned",
            rpm=50,
            avg_input_tokens=1000,
            avg_output_tokens=500,
        )
        assert result["calculation"]["output_multiplier"] == 8
        # eq_per_request = 1000 + (500 * 8) = 5000
        assert result["calculation"]["eq_tokens_per_request"] == 5000

    @pytest.mark.asyncio
    async def test_data_zone_uses_global_minimums(self) -> None:
        """DataZoneProvisioned should use same min/increment as Global."""
        service = PTUService()
        result_global = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="GlobalProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
        )
        result_dz = await service.estimate_ptu_sizing(
            model="gpt-4.1",
            deployment_type="DataZoneProvisioned",
            rpm=100,
            avg_input_tokens=500,
            avg_output_tokens=200,
        )
        assert result_global["result"]["recommended_ptus"] == result_dz["result"]["recommended_ptus"]
        assert result_global["result"]["minimum_ptus"] == result_dz["result"]["minimum_ptus"]
        assert result_global["result"]["scale_increment"] == result_dz["result"]["scale_increment"]


# =========================================================================
# Formatter tests
# =========================================================================


class TestPTUSizingFormatter:
    """Verify formatter output."""

    def _make_result(self) -> dict:
        """Create a sample successful result dict."""
        return {
            "model": "gpt-4.1",
            "deployment_type": "GlobalProvisioned",
            "deployment_label": "Global Provisioned",
            "deployment_description": "Traffic may be processed in any Azure geography.",
            "workload": {
                "rpm": 100,
                "avg_input_tokens": 500,
                "avg_output_tokens": 200,
                "cached_tokens_per_request": 0,
            },
            "calculation": {
                "output_multiplier": 4,
                "effective_input_tokens": 500,
                "eq_tokens_per_request": 1300,
                "eq_tpm": 130_000,
                "input_tpm_per_ptu": 3_000,
                "raw_ptu": 43.33,
            },
            "result": {
                "recommended_ptus": 45,
                "raw_ptus": 43.33,
                "minimum_ptus": 15,
                "scale_increment": 5,
                "max_ptus_per_deployment": 100_000,
            },
            "warnings": ["PTU sizing is an estimate."],
            "data_version": "2026-02-01",
            "data_source": "https://example.com",
        }

    def test_success_contains_key_sections(self) -> None:
        output = format_ptu_sizing_response(self._make_result())
        assert "PTU Sizing Estimate" in output
        assert "gpt-4.1" in output
        assert "Global Provisioned" in output
        assert "45" in output  # recommended PTUs
        assert "Calculation Breakdown" in output
        assert "Recommended PTUs" in output

    def test_error_output(self) -> None:
        output = format_ptu_sizing_response({"error": "Unknown model: 'foo'"})
        assert "Error" in output
        assert "foo" in output

    def test_error_with_supported_models(self) -> None:
        output = format_ptu_sizing_response(
            {
                "error": "Unknown model",
                "supported_models": ["gpt-4.1", "gpt-5"],
                "data_source": "https://example.com",
            }
        )
        assert "gpt-4.1" in output
        assert "gpt-5" in output

    def test_cost_section_present(self) -> None:
        result = self._make_result()
        result["cost"] = {
            "price_per_ptu_hour": 0.06,
            "deployed_ptus": 45,
            "hourly_cost": 2.70,
            "monthly_cost_730h": 1971.0,
            "currency": "USD",
            "meter_name": "Provisioned Managed",
            "region": "eastus",
            "reservation_guidance": "See Azure Reservations.",
        }
        output = format_ptu_sizing_response(result)
        assert "Cost Estimate" in output
        assert "0.06" in output
        assert "2.70" in output

    def test_cost_unavailable(self) -> None:
        result = self._make_result()
        result["cost"] = {
            "note": "Could not retrieve pricing.",
            "pricing_url": "https://example.com/pricing",
        }
        output = format_ptu_sizing_response(result)
        assert "Could not retrieve" in output

    def test_caching_shown_in_output(self) -> None:
        result = self._make_result()
        result["workload"]["cached_tokens_per_request"] = 200
        result["calculation"]["effective_input_tokens"] = 300
        output = format_ptu_sizing_response(result)
        assert "Cached tokens" in output
        assert "200" in output

    def test_warnings_displayed(self) -> None:
        result = self._make_result()
        result["warnings"] = ["This is a warning.", "Another warning."]
        output = format_ptu_sizing_response(result)
        assert "This is a warning" in output
        assert "Another warning" in output


# =========================================================================
# Handler tests
# =========================================================================


class TestHandler:
    """Test handler integration."""

    @pytest.mark.asyncio
    async def test_handle_ptu_sizing(self) -> None:
        from azure_pricing_mcp.handlers import ToolHandlers

        # Create minimal mock services
        mock_pricing = MagicMock()
        mock_pricing._client = None
        mock_sku = MagicMock()

        handlers = ToolHandlers(mock_pricing, mock_sku)

        result = await handlers.handle_ptu_sizing(
            {
                "model": "gpt-4.1",
                "deployment_type": "GlobalProvisioned",
                "rpm": 100,
                "avg_input_tokens": 500,
                "avg_output_tokens": 200,
            }
        )

        assert len(result) == 1
        assert result[0].type == "text"
        assert "PTU Sizing Estimate" in result[0].text
        assert "gpt-4.1" in result[0].text

    @pytest.mark.asyncio
    async def test_handle_ptu_sizing_error(self) -> None:
        from azure_pricing_mcp.handlers import ToolHandlers

        mock_pricing = MagicMock()
        mock_pricing._client = None
        mock_sku = MagicMock()

        handlers = ToolHandlers(mock_pricing, mock_sku)

        result = await handlers.handle_ptu_sizing(
            {
                "model": "nonexistent",
                "deployment_type": "GlobalProvisioned",
                "rpm": 100,
                "avg_input_tokens": 500,
                "avg_output_tokens": 200,
            }
        )

        assert len(result) == 1
        assert "Error" in result[0].text
