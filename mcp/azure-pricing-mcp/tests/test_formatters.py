"""Tests for response formatters."""

import json

from azure_pricing_mcp.formatters import format_bulk_estimate_response, format_compact, format_cost_estimate_response


class TestFormatCompact:
    def test_strips_metadata(self):
        result = {
            "items": [1, 2],
            "_discount_metadata": {"foo": True},
            "sku_validation": {"bar": True},
        }
        output = json.loads(format_compact(result))
        assert "items" in output
        assert "_discount_metadata" not in output
        assert "sku_validation" not in output

    def test_valid_json(self):
        result = {"count": 5, "items": []}
        output = format_compact(result)
        parsed = json.loads(output)
        assert parsed["count"] == 5


class TestFormatBulkEstimate:
    def test_basic_table(self):
        result = {
            "currency": "USD",
            "resource_count": 2,
            "successful": 2,
            "failed": 0,
            "line_items": [
                {
                    "index": 0,
                    "service_name": "Virtual Machines",
                    "sku_name": "D2s v3",
                    "region": "eastus",
                    "product_name": "VM",
                    "unit_of_measure": "1 Hour",
                    "pricing_model": "per-hour",
                    "quantity": 1,
                    "monthly_cost": 70.08,
                    "yearly_cost": 840.96,
                },
            ],
            "errors": [],
            "totals": {"monthly": 70.08, "yearly": 840.96},
        }
        output = format_bulk_estimate_response(result)
        assert "Bulk Cost Estimate" in output
        assert "$70.08" in output
        assert "D2s v3" in output

    def test_errors_section(self):
        result = {
            "currency": "USD",
            "resource_count": 1,
            "successful": 0,
            "failed": 1,
            "line_items": [],
            "errors": [{"index": 0, "error": "Not found", "input": {}}],
            "totals": {"monthly": 0, "yearly": 0},
        }
        output = format_bulk_estimate_response(result)
        assert "Errors" in output
        assert "Not found" in output


class TestFormatCostEstimate:
    def test_includes_pricing_model(self):
        result = {
            "service_name": "Storage",
            "sku_name": "Hot LRS",
            "region": "eastus",
            "product_name": "Blob Storage",
            "unit_of_measure": "1 GB/Month",
            "pricing_model": "per-GB",
            "quantity": 100,
            "currency": "USD",
            "on_demand_pricing": {
                "unit_rate": 0.018,
                "daily_cost": 0.06,
                "monthly_cost": 1.80,
                "yearly_cost": 21.60,
            },
            "usage_assumptions": {"hours_per_month": 730, "hours_per_day": 23.98},
            "savings_plans": [],
        }
        output = format_cost_estimate_response(result)
        assert "per-GB" in output
        assert "Quantity: 100" in output
