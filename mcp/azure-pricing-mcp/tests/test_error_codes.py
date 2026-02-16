"""Tests for error_codes module."""

from azure_pricing_mcp.error_codes import ErrorCode, error_response


class TestErrorCode:
    def test_enum_values_are_strings(self):
        for code in ErrorCode:
            assert isinstance(code.value, str)

    def test_common_codes_exist(self):
        expected = {
            "MISSING_REQUIRED_FIELD",
            "INVALID_FIELD_VALUE",
            "INTERNAL_ERROR",
            "UNKNOWN_TOOL",
            "SERVICE_NOT_INITIALIZED",
        }
        actual = {c.name for c in ErrorCode}
        assert expected.issubset(actual)


class TestErrorResponse:
    def test_basic_structure(self):
        result = error_response(ErrorCode.INTERNAL_ERROR, "something broke")
        assert result["error"] is True
        assert result["code"] == "INTERNAL_ERROR"
        assert result["message"] == "something broke"
        assert "details" not in result

    def test_with_details(self):
        result = error_response(
            ErrorCode.MISSING_REQUIRED_FIELD,
            "Missing field",
            details={"field": "region"},
        )
        assert result["details"] == {"field": "region"}

    def test_empty_details_omitted(self):
        result = error_response(ErrorCode.API_ERROR, "fail", details=None)
        assert "details" not in result

    def test_non_empty_details_included(self):
        result = error_response(ErrorCode.API_ERROR, "fail", details={"retry": True})
        assert result["details"]["retry"] is True
