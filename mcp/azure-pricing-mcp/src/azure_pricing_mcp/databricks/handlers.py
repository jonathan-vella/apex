"""Handler methods for Databricks DBU pricing tools."""

from typing import Any

from mcp.types import TextContent

from ..services.databricks import DatabricksService
from .formatters import (
    format_databricks_compare_workloads_response,
    format_databricks_cost_estimate_response,
    format_databricks_dbu_pricing_response,
)


class DatabricksHandlers:
    """Mixin providing handler methods for Databricks DBU pricing tools.

    Designed to be composed into the main ToolHandlers class.
    Requires ``_databricks_service`` attribute on the host instance.
    """

    _databricks_service: DatabricksService | None

    def _get_databricks_service(self) -> DatabricksService:
        """Get the DatabricksService instance.

        Raises:
            RuntimeError: If DatabricksService was not provided at init time.
        """
        if self._databricks_service is None:
            raise RuntimeError("DatabricksService not initialized")
        return self._databricks_service

    async def handle_databricks_dbu_pricing(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle databricks_dbu_pricing tool calls."""
        service = self._get_databricks_service()
        result = await service.get_dbu_pricing(
            workload_type=arguments.get("workload_type"),
            tier=arguments.get("tier"),
            region=arguments.get("region", "eastus"),
            currency_code=arguments.get("currency_code", "USD"),
        )
        text = format_databricks_dbu_pricing_response(result)
        return [TextContent(type="text", text=text)]

    async def handle_databricks_cost_estimate(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle databricks_cost_estimate tool calls."""
        service = self._get_databricks_service()
        result = await service.estimate_dbu_cost(
            workload_type=arguments["workload_type"],
            dbu_count=arguments["dbu_count"],
            hours_per_day=arguments.get("hours_per_day", 8.0),
            days_per_month=arguments.get("days_per_month", 22),
            tier=arguments.get("tier", "Premium"),
            region=arguments.get("region", "eastus"),
            currency_code=arguments.get("currency_code", "USD"),
            num_workers=arguments.get("num_workers", 1),
            discount_percentage=arguments.get("discount_percentage", 0.0),
        )
        text = format_databricks_cost_estimate_response(result)
        return [TextContent(type="text", text=text)]

    async def handle_databricks_compare_workloads(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle databricks_compare_workloads tool calls."""
        service = self._get_databricks_service()
        result = await service.compare_workloads(
            workload_types=arguments.get("workload_types"),
            regions=arguments.get("regions"),
            tier=arguments.get("tier", "Premium"),
            currency_code=arguments.get("currency_code", "USD"),
            dbu_count=arguments.get("dbu_count"),
            hours_per_month=arguments.get("hours_per_month"),
        )
        text = format_databricks_compare_workloads_response(result)
        return [TextContent(type="text", text=text)]
