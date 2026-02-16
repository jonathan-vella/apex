"""Tests for service name mappings in config."""

from azure_pricing_mcp.config import SERVICE_NAME_MAPPINGS


class TestServiceNameMappings:
    def test_minimum_mapping_count(self):
        assert len(SERVICE_NAME_MAPPINGS) >= 60, f"Expected 60+ mappings, got {len(SERVICE_NAME_MAPPINGS)}"

    def test_common_aliases_exist(self):
        expected = [
            "vm", "aks", "sql", "cosmos", "redis",
            "app service", "functions", "storage",
            "nat gateway", "bastion", "firewall",
            "acr", "apim", "service bus", "sentinel",
        ]
        for alias in expected:
            assert alias in SERVICE_NAME_MAPPINGS, f"Missing mapping for '{alias}'"

    def test_values_are_non_empty(self):
        for key, value in SERVICE_NAME_MAPPINGS.items():
            assert value, f"Empty mapping value for '{key}'"

    def test_keys_are_lowercase(self):
        for key in SERVICE_NAME_MAPPINGS:
            assert key == key.lower(), f"Key '{key}' should be lowercase"
