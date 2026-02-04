"""Unit tests for tier keyword search functionality."""

import pytest

from azure_pricing_mcp.services.pricing import is_tier_keyword, TIER_KEYWORDS


class TestTierKeywordDetection:
    """Tests for the is_tier_keyword function."""

    def test_basic_lowercase(self):
        """Basic in lowercase should return 'Basic'."""
        assert is_tier_keyword("basic") == "Basic"

    def test_basic_titlecase(self):
        """Basic in title case should return 'Basic'."""
        assert is_tier_keyword("Basic") == "Basic"

    def test_basic_uppercase(self):
        """BASIC in uppercase should return 'Basic' (lowercased for lookup)."""
        assert is_tier_keyword("BASIC") == "Basic"

    def test_standard(self):
        """Standard should be recognized as a tier keyword."""
        assert is_tier_keyword("standard") == "Standard"
        assert is_tier_keyword("Standard") == "Standard"

    def test_premium(self):
        """Premium should be recognized as a tier keyword."""
        assert is_tier_keyword("premium") == "Premium"
        assert is_tier_keyword("Premium") == "Premium"

    def test_free(self):
        """Free should be recognized as a tier keyword."""
        assert is_tier_keyword("free") == "Free"
        assert is_tier_keyword("Free") == "Free"

    def test_consumption(self):
        """Consumption should be recognized as a tier keyword."""
        assert is_tier_keyword("consumption") == "Consumption"

    def test_general_purpose(self):
        """General Purpose should be recognized as a tier keyword."""
        assert is_tier_keyword("general purpose") == "General Purpose"

    def test_business_critical(self):
        """Business Critical should be recognized as a tier keyword."""
        assert is_tier_keyword("business critical") == "Business Critical"

    def test_hyperscale(self):
        """Hyperscale should be recognized as a tier keyword."""
        assert is_tier_keyword("hyperscale") == "Hyperscale"

    def test_serverless(self):
        """Serverless should be recognized as a tier keyword."""
        assert is_tier_keyword("serverless") == "Serverless"

    def test_specific_sku_not_tier(self):
        """Specific SKU names should NOT be recognized as tier keywords."""
        assert is_tier_keyword("B1") is None
        assert is_tier_keyword("D4s_v5") is None
        assert is_tier_keyword("P1v3") is None
        assert is_tier_keyword("S0") is None
        assert is_tier_keyword("Standard_D2s_v3") is None

    def test_empty_string(self):
        """Empty string should return None."""
        assert is_tier_keyword("") is None

    def test_none_input(self):
        """None input should return None."""
        assert is_tier_keyword(None) is None

    def test_whitespace_handling(self):
        """Whitespace around tier keywords should be handled."""
        assert is_tier_keyword("  basic  ") == "Basic"
        assert is_tier_keyword("\tstandard\n") == "Standard"


class TestTierKeywordsDict:
    """Tests for the TIER_KEYWORDS dictionary."""

    def test_all_keys_lowercase(self):
        """All keys in TIER_KEYWORDS should be lowercase."""
        for key in TIER_KEYWORDS:
            assert key == key.lower(), f"Key '{key}' should be lowercase"

    def test_expected_keywords_present(self):
        """All expected tier keywords should be present."""
        expected = [
            "basic",
            "standard",
            "premium",
            "free",
            "consumption",
            "general purpose",
            "business critical",
            "hyperscale",
            "serverless",
        ]
        for keyword in expected:
            assert keyword in TIER_KEYWORDS, f"Expected keyword '{keyword}' not in TIER_KEYWORDS"

    def test_values_are_properly_cased(self):
        """Values should be properly cased for Azure API."""
        assert TIER_KEYWORDS["basic"] == "Basic"
        assert TIER_KEYWORDS["standard"] == "Standard"
        assert TIER_KEYWORDS["premium"] == "Premium"
        assert TIER_KEYWORDS["general purpose"] == "General Purpose"
        assert TIER_KEYWORDS["business critical"] == "Business Critical"
