"""PTU Sizing + Cost Planner service for Azure OpenAI provisioned throughput.

Estimates required Provisioned Throughput Units (PTUs) for a given model and
workload shape, applies official rounding rules, and optionally fetches live
pricing from the Azure Retail Prices API.
"""

import logging
import math
from typing import Any

from .ptu_models import (
    DATA_SOURCE_URL,
    DATA_VERSION,
    DEPLOYMENT_TYPES,
    MAX_PTUS_PER_DEPLOYMENT,
    get_model_canonical_name,
    get_model_info,
    get_supported_models,
)

logger = logging.getLogger(__name__)


class PTUService:
    """Service for PTU sizing estimation and optional cost lookup."""

    def __init__(self, client: Any | None = None) -> None:
        """Initialize PTU service.

        Args:
            client: Optional AzurePricingClient for cost lookups.
                    Not required for pure sizing calculations.
        """
        self._client = client

    # ------------------------------------------------------------------
    # Pure computation methods (no I/O)
    # ------------------------------------------------------------------

    @staticmethod
    def compute_eq_tpm(
        rpm: int,
        input_tokens: int,
        output_tokens: int,
        output_multiplier: int,
        cached_tokens: int = 0,
    ) -> dict[str, Any]:
        """Normalize tokens into input-equivalent TPM.

        Docs rule: output tokens count as ``output_multiplier`` input tokens.
        Cached tokens are deducted 100% from utilization.

        Args:
            rpm: Requests per minute at peak.
            input_tokens: Average input tokens per request.
            output_tokens: Average output tokens per request.
            output_multiplier: How many input tokens one output token equals.
            cached_tokens: Average cached tokens per request (deducted from input).

        Returns:
            Dict with effective_input_tokens, eq_tokens_per_request, eq_tpm.
        """
        effective_input = max(0, input_tokens - cached_tokens)
        eq_per_request = effective_input + (output_tokens * output_multiplier)
        eq_tpm = rpm * eq_per_request
        return {
            "effective_input_tokens": effective_input,
            "eq_tokens_per_request": eq_per_request,
            "eq_tpm": eq_tpm,
        }

    @staticmethod
    def compute_raw_ptu(eq_tpm: int, input_tpm_per_ptu: int) -> float:
        """Convert input-equivalent TPM to raw (unrounded) PTU count.

        Args:
            eq_tpm: Input-equivalent tokens per minute.
            input_tpm_per_ptu: Capacity of one PTU in input TPM.

        Returns:
            Raw PTU count (float).
        """
        if input_tpm_per_ptu <= 0:
            return 0.0
        return eq_tpm / input_tpm_per_ptu

    @staticmethod
    def round_to_valid_ptu(raw_ptu: float, min_ptus: int, increment: int) -> int:
        """Round raw PTU to the smallest valid deployment size.

        Valid sizes: min_ptus, min_ptus + increment, min_ptus + 2*increment, ...
        The result is the smallest value >= raw_ptu that satisfies:
          result >= min_ptus  AND  (result - min_ptus) % increment == 0

        Args:
            raw_ptu: Unrounded PTU count.
            min_ptus: Minimum deployment size.
            increment: Scale increment.

        Returns:
            Rounded PTU count.
        """
        if raw_ptu <= min_ptus:
            return min_ptus
        # How many increments above min?
        above_min = raw_ptu - min_ptus
        increments_needed = math.ceil(above_min / increment)
        return min_ptus + (increments_needed * increment)

    @staticmethod
    def validate_limits(
        rounded_ptu: int,
        max_ptus: int = MAX_PTUS_PER_DEPLOYMENT,
    ) -> list[str]:
        """Check PTU result against hard limits and produce warnings.

        Args:
            rounded_ptu: Rounded PTU count.
            max_ptus: Maximum PTUs per deployment.

        Returns:
            List of warning strings (empty if no issues).
        """
        warnings: list[str] = []
        if rounded_ptu > max_ptus:
            warnings.append(
                f"Estimated PTUs ({rounded_ptu:,}) exceed the max per deployment "
                f"({max_ptus:,}). You may need multiple deployments or to reduce "
                f"your workload."
            )
        warnings.append(
            "PTU sizing is an estimate. The most accurate approach is to benchmark "
            "a deployment with a representative workload. Quota does not guarantee "
            "capacity availability."
        )
        return warnings

    # ------------------------------------------------------------------
    # Cost lookup (requires AzurePricingClient)
    # ------------------------------------------------------------------

    async def _fetch_ptu_pricing(
        self,
        region: str = "eastus",
        currency_code: str = "USD",
        deployment_type: str = "GlobalProvisioned",
    ) -> dict[str, Any] | None:
        """Fetch PTU hourly pricing from Azure Retail Prices API.

        Searches for Foundry Models provisioned throughput meters.

        Args:
            region: Azure region for pricing.
            currency_code: Currency code.
            deployment_type: GlobalProvisioned, DataZoneProvisioned, or RegionalProvisioned.

        Returns:
            Dict with price_per_ptu_hour and meter info, or None on failure.
        """
        if not self._client:
            return None

        # Map deployment type to SKU pattern
        sku_patterns = {
            "GlobalProvisioned": "Provisioned Managed Global",
            "DataZoneProvisioned": "Provisioned Managed Data Zone",
            "RegionalProvisioned": "Provisioned Managed Regional",
        }
        sku_pattern = sku_patterns.get(deployment_type, "Provisioned")

        try:
            # Service is "Foundry Models", product is "Azure OpenAI"
            filters = [
                "serviceName eq 'Foundry Models'",
                "productName eq 'Azure OpenAI'",
                f"armRegionName eq '{region}'",
                f"contains(skuName, '{sku_pattern}')",
                "priceType eq 'Consumption'",
            ]
            result = await self._client.fetch_prices(
                filter_conditions=filters,
                currency_code=currency_code,
                limit=20,
            )
            items = result.get("Items", [])

            if not items:
                # Try without specific SKU pattern
                filters_broad = [
                    "serviceName eq 'Foundry Models'",
                    "productName eq 'Azure OpenAI'",
                    f"armRegionName eq '{region}'",
                    "contains(skuName, 'Provisioned')",
                    "priceType eq 'Consumption'",
                ]
                result = await self._client.fetch_prices(
                    filter_conditions=filters_broad,
                    currency_code=currency_code,
                    limit=20,
                )
                items = result.get("Items", [])

            if not items:
                # Try any region for this deployment type
                filters_any_region = [
                    "serviceName eq 'Foundry Models'",
                    "productName eq 'Azure OpenAI'",
                    f"contains(skuName, '{sku_pattern}')",
                    "priceType eq 'Consumption'",
                ]
                result = await self._client.fetch_prices(
                    filter_conditions=filters_any_region,
                    currency_code=currency_code,
                    limit=20,
                )
                items = result.get("Items", [])

            if items:
                # Pick the first provisioned throughput unit meter
                item = items[0]
                return {
                    "price_per_ptu_hour": item.get("retailPrice", item.get("unitPrice", 0)),
                    "meter_name": item.get("meterName", ""),
                    "sku_name": item.get("skuName", ""),
                    "region": item.get("armRegionName", region),
                    "currency": currency_code,
                }
        except Exception as e:
            logger.warning(f"Failed to fetch PTU pricing: {e}")
        return None

    # ------------------------------------------------------------------
    # Main orchestrator
    # ------------------------------------------------------------------

    async def estimate_ptu_sizing(
        self,
        model: str,
        deployment_type: str,
        rpm: int,
        avg_input_tokens: int,
        avg_output_tokens: int,
        cached_tokens_per_request: int = 0,
        include_cost: bool = False,
        region: str = "eastus",
        currency_code: str = "USD",
    ) -> dict[str, Any]:
        """Estimate PTU sizing for a given workload.

        Args:
            model: Model identifier (e.g., 'gpt-4.1', 'gpt-5').
            deployment_type: One of GlobalProvisioned, DataZoneProvisioned,
                           RegionalProvisioned.
            rpm: Requests per minute at peak.
            avg_input_tokens: Average input tokens per request.
            avg_output_tokens: Average output tokens per request.
            cached_tokens_per_request: Average cached tokens per request.
            include_cost: Whether to fetch live pricing.
            region: Azure region (used for cost lookup).
            currency_code: Currency for pricing.

        Returns:
            Comprehensive result dict with sizing, calculation details,
            warnings, and optionally cost.
        """
        # Validate model
        model_info = get_model_info(model)
        canonical_name = get_model_canonical_name(model)
        if not model_info or not canonical_name:
            return {
                "error": f"Unknown model: '{model}'",
                "supported_models": get_supported_models(),
                "data_source": DATA_SOURCE_URL,
            }

        # Validate deployment type
        if deployment_type not in DEPLOYMENT_TYPES:
            return {
                "error": f"Unknown deployment type: '{deployment_type}'",
                "supported_types": list(DEPLOYMENT_TYPES.keys()),
            }

        deploy_meta = DEPLOYMENT_TYPES[deployment_type]
        min_key = deploy_meta["min_key"]
        inc_key = deploy_meta["increment_key"]
        min_ptus = model_info[min_key]
        increment = model_info[inc_key]

        # Check if deployment type is available for this model
        if min_ptus is None or increment is None:
            return {
                "error": (f"Model '{canonical_name}' does not support " f"{deploy_meta['label']} deployments."),
                "suggestion": "Try GlobalProvisioned or DataZoneProvisioned instead.",
            }

        # Validate numeric inputs
        if rpm < 0 or avg_input_tokens < 0 or avg_output_tokens < 0:
            return {"error": "RPM, input tokens, and output tokens must be non-negative."}
        if cached_tokens_per_request < 0:
            return {"error": "Cached tokens must be non-negative."}
        if cached_tokens_per_request > avg_input_tokens:
            return {"error": "Cached tokens cannot exceed input tokens per request."}

        # Step 1: Compute input-equivalent TPM
        eq_result = self.compute_eq_tpm(
            rpm=rpm,
            input_tokens=avg_input_tokens,
            output_tokens=avg_output_tokens,
            output_multiplier=model_info["output_multiplier"],
            cached_tokens=cached_tokens_per_request,
        )

        # Step 2: Compute raw PTUs
        raw_ptu = self.compute_raw_ptu(
            eq_tpm=eq_result["eq_tpm"],
            input_tpm_per_ptu=model_info["input_tpm_per_ptu"],
        )

        # Step 3: Round to valid deployment size
        rounded_ptu = self.round_to_valid_ptu(raw_ptu, min_ptus, increment)

        # Step 4: Validate limits
        warnings = self.validate_limits(rounded_ptu)

        # Build result
        result: dict[str, Any] = {
            "model": canonical_name,
            "deployment_type": deployment_type,
            "deployment_label": deploy_meta["label"],
            "deployment_description": deploy_meta["description"],
            "workload": {
                "rpm": rpm,
                "avg_input_tokens": avg_input_tokens,
                "avg_output_tokens": avg_output_tokens,
                "cached_tokens_per_request": cached_tokens_per_request,
            },
            "calculation": {
                "output_multiplier": model_info["output_multiplier"],
                "effective_input_tokens": eq_result["effective_input_tokens"],
                "eq_tokens_per_request": eq_result["eq_tokens_per_request"],
                "eq_tpm": eq_result["eq_tpm"],
                "input_tpm_per_ptu": model_info["input_tpm_per_ptu"],
                "raw_ptu": round(raw_ptu, 2),
            },
            "result": {
                "recommended_ptus": rounded_ptu,
                "raw_ptus": round(raw_ptu, 2),
                "minimum_ptus": min_ptus,
                "scale_increment": increment,
                "max_ptus_per_deployment": MAX_PTUS_PER_DEPLOYMENT,
            },
            "warnings": warnings,
            "data_version": DATA_VERSION,
            "data_source": DATA_SOURCE_URL,
        }

        # Optional: cost estimate
        if include_cost:
            pricing = await self._fetch_ptu_pricing(
                region=region,
                currency_code=currency_code,
                deployment_type=deployment_type,
            )
            if pricing and pricing["price_per_ptu_hour"] > 0:
                hourly = pricing["price_per_ptu_hour"] * rounded_ptu
                result["cost"] = {
                    "price_per_ptu_hour": pricing["price_per_ptu_hour"],
                    "deployed_ptus": rounded_ptu,
                    "hourly_cost": round(hourly, 2),
                    "monthly_cost_730h": round(hourly * 730, 2),
                    "currency": pricing["currency"],
                    "meter_name": pricing["meter_name"],
                    "region": pricing["region"],
                    "reservation_guidance": (
                        "Azure Reservations can provide significant discounts for "
                        "long-term PTU usage. See: "
                        "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/"
                        "how-to/provisioned-throughput-onboarding"
                        "#azure-reservations-for-foundry-provisioned-throughput"
                    ),
                }
            else:
                result["cost"] = {
                    "note": (
                        "Could not retrieve PTU pricing for the specified region. "
                        "Check Azure Pricing Calculator for current rates."
                    ),
                    "pricing_url": "https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/",
                }

        return result
