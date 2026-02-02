"""VM retirement status service for Azure Pricing MCP Server."""

import asyncio
import logging
import re
from datetime import datetime
from typing import Any

from ..client import AzurePricingClient
from ..config import (
    PREVIOUS_GEN_URL,
    RETIRED_SIZES_URL,
    RETIREMENT_CACHE_TTL,
    VM_SERIES_REPLACEMENTS,
)
from ..models import RetirementStatus, VMSeriesRetirementInfo

logger = logging.getLogger(__name__)

# Fallback retirement data when GitHub fetch fails
# Based on Microsoft docs as of January 2026
FALLBACK_RETIREMENT_DATA: dict[str, VMSeriesRetirementInfo] = {
    # Storage optimized - retiring
    "Lsv2": VMSeriesRetirementInfo(
        series_name="Lsv2-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="November 15, 2028",
        replacement="Lsv3, Lasv3, Lsv4, or Lasv4 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    "Ls": VMSeriesRetirementInfo(
        series_name="Ls-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="May 1, 2028",
        replacement="Lsv3, Lasv3, Lsv4, or Lasv4 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    # General purpose - retiring
    "Dv2": VMSeriesRetirementInfo(
        series_name="Dv2-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="May 1, 2028",
        replacement="Dv5, Dasv5, or Ddsv5 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    "Dsv2": VMSeriesRetirementInfo(
        series_name="Dsv2-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="May 1, 2028",
        replacement="Ddsv5 or Ddsv6 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    "Av2": VMSeriesRetirementInfo(
        series_name="Av2-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="November 15, 2028",
        replacement="Dasv5 or Dadsv5 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    "Bv1": VMSeriesRetirementInfo(
        series_name="B-series (v1)",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="November 15, 2028",
        replacement="Bsv2, Basv2, or Bpsv2 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    # Compute optimized - retiring
    "Fsv2": VMSeriesRetirementInfo(
        series_name="Fsv2-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="November 15, 2028",
        replacement="Fasv6 or Falsv6 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    "Fs": VMSeriesRetirementInfo(
        series_name="Fs-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="November 15, 2028",
        replacement="Fasv6 or Falsv6 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    # Memory optimized - retiring
    "G": VMSeriesRetirementInfo(
        series_name="G-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="November 15, 2028",
        replacement="Ev5 or Edsv5 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    "Gs": VMSeriesRetirementInfo(
        series_name="Gs-series",
        status=RetirementStatus.RETIREMENT_ANNOUNCED,
        retirement_date="November 15, 2028",
        replacement="Edsv5 or Edsv6 series",
        migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
    ),
    # Previous generation - not retiring but newer available
    "Edsv4": VMSeriesRetirementInfo(
        series_name="Edsv4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Edsv5 or Edsv6 series",
    ),
    "Esv4": VMSeriesRetirementInfo(
        series_name="Esv4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Esv5 or Esv6 series",
    ),
    "Ev4": VMSeriesRetirementInfo(
        series_name="Ev4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Ev5 or Ev6 series",
    ),
    "Ddsv4": VMSeriesRetirementInfo(
        series_name="Ddsv4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Ddsv5 or Ddsv6 series",
    ),
    "Dsv4": VMSeriesRetirementInfo(
        series_name="Dsv4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Dsv5 or Dsv6 series",
    ),
    "Dv4": VMSeriesRetirementInfo(
        series_name="Dv4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Dv5 or Dv6 series",
    ),
    "Easv4": VMSeriesRetirementInfo(
        series_name="Easv4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Easv5 or Easv6 series",
    ),
    "Eav4": VMSeriesRetirementInfo(
        series_name="Eav4-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Eav5 or Eav6 series",
    ),
    "Esv3": VMSeriesRetirementInfo(
        series_name="Esv3-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Esv5 or Esv6 series",
    ),
    "Ev3": VMSeriesRetirementInfo(
        series_name="Ev3-series",
        status=RetirementStatus.PREVIOUS_GEN,
        replacement="Ev5 or Ev6 series",
    ),
}


class RetirementService:
    """Service for managing VM retirement status information."""

    def __init__(self, client: AzurePricingClient) -> None:
        self._client = client
        self._cache: dict[str, VMSeriesRetirementInfo] | None = None
        self._cache_time: datetime | None = None

    async def get_retirement_data(self) -> dict[str, VMSeriesRetirementInfo]:
        """Get retirement data, using cache if valid or fetching fresh data."""
        now = datetime.now()

        # Check if cache is valid
        if self._cache is not None and self._cache_time is not None and (now - self._cache_time) < RETIREMENT_CACHE_TTL:
            return self._cache

        # Fetch fresh data
        self._cache = await self._fetch_retirement_data()
        self._cache_time = now
        return self._cache

    async def _fetch_retirement_data(self) -> dict[str, VMSeriesRetirementInfo]:
        """Fetch VM retirement status data from Microsoft docs on GitHub."""
        if not self._client.session:
            logger.warning("HTTP session not initialized, using fallback retirement data")
            return FALLBACK_RETIREMENT_DATA.copy()

        retirement_data: dict[str, VMSeriesRetirementInfo] = {}

        try:
            # Fetch both markdown files in parallel
            results = await asyncio.gather(
                self._client.fetch_text(RETIRED_SIZES_URL),
                self._client.fetch_text(PREVIOUS_GEN_URL),
                return_exceptions=True,
            )
            retired_result, previous_gen_result = results

            # Handle exceptions from gather
            retired_md: str = ""
            previous_gen_md: str = ""

            if isinstance(retired_result, Exception):
                logger.warning(f"Failed to fetch retired sizes: {retired_result}")
            elif isinstance(retired_result, str):
                retired_md = retired_result

            if isinstance(previous_gen_result, Exception):
                logger.warning(f"Failed to fetch previous-gen sizes: {previous_gen_result}")
            elif isinstance(previous_gen_result, str):
                previous_gen_md = previous_gen_result

            # Parse retired sizes markdown (takes precedence)
            if retired_md:
                retirement_data.update(self._parse_retired_sizes_md(retired_md))

            # Parse previous-gen sizes markdown (only add if not already in retirement_data)
            if previous_gen_md:
                previous_gen_data = self._parse_previous_gen_md(previous_gen_md)
                for key, value in previous_gen_data.items():
                    if key not in retirement_data:
                        retirement_data[key] = value

            if retirement_data:
                logger.info(f"Fetched retirement data for {len(retirement_data)} VM series")
                return retirement_data
            else:
                logger.warning("No retirement data parsed, using fallback")
                return FALLBACK_RETIREMENT_DATA.copy()

        except Exception as e:
            logger.warning(f"Failed to fetch retirement data: {e}, using fallback")
            return FALLBACK_RETIREMENT_DATA.copy()

    def _parse_retired_sizes_md(self, md_content: str) -> dict[str, VMSeriesRetirementInfo]:
        """Parse the retired-sizes-list.md markdown content."""
        result: dict[str, VMSeriesRetirementInfo] = {}

        for line in md_content.split("\n"):
            line = line.strip()
            if not line.startswith("|") or "---" in line:
                continue

            parts = [p.strip() for p in line.split("|")]
            parts = [p for p in parts if p]

            if len(parts) < 4:
                continue

            series_name = parts[0].strip()
            status_text = parts[1].strip().lower()

            if series_name.lower() in ["series name", "series", ""]:
                continue

            retirement_date = parts[3].strip() if len(parts) > 3 else ""

            status_clean = status_text.replace("*", "").strip()
            if "retired" in status_clean and "announced" not in status_clean:
                status = RetirementStatus.RETIRED
            elif "announced" in status_clean:
                status = RetirementStatus.RETIREMENT_ANNOUNCED
            else:
                continue

            series_key = self._extract_series_key(series_name)
            if not series_key:
                continue

            replacement = VM_SERIES_REPLACEMENTS.get(series_key)

            result[series_key] = VMSeriesRetirementInfo(
                series_name=series_name if "-series" in series_name else f"{series_name}-series",
                status=status,
                retirement_date=retirement_date if retirement_date and retirement_date != "-" else None,
                replacement=replacement,
                migration_guide_url="https://learn.microsoft.com/en-us/azure/virtual-machines/migration/sizes/d-ds-dv2-dsv2-ls-series-migration-guide",
            )

        return result

    def _parse_previous_gen_md(self, md_content: str) -> dict[str, VMSeriesRetirementInfo]:
        """Parse the previous-gen-sizes-list.md markdown content."""
        result: dict[str, VMSeriesRetirementInfo] = {}

        for line in md_content.split("\n"):
            line = line.strip()
            if not line.startswith("|") or "---" in line:
                continue

            parts = [p.strip() for p in line.split("|")]
            parts = [p for p in parts if p]

            if len(parts) < 2:
                continue

            series_name = parts[0].strip()
            status_text = parts[1].strip().lower()

            if series_name.lower() in ["series name", "series", "", "replacement series"]:
                continue

            link_match = re.search(r"\[([^\]]+)\]", status_text)
            status_check = link_match.group(1).lower() if link_match else status_text

            if "retirement announced" in status_check:
                continue

            if "next-gen available" not in status_check and "capacity limited" not in status_check:
                continue

            series_keys = self._extract_all_series_keys(series_name)

            for series_key in series_keys:
                if series_key in result:
                    continue

                replacement = VM_SERIES_REPLACEMENTS.get(series_key)

                result[series_key] = VMSeriesRetirementInfo(
                    series_name=f"{series_key}-series",
                    status=RetirementStatus.PREVIOUS_GEN,
                    replacement=replacement,
                )

        return result

    def _extract_all_series_keys(self, series_name: str) -> list[str]:
        """Extract all series keys from a series name that may contain multiple series."""
        results = []

        name = series_name.replace("-series", "").replace("-Series", "").strip()

        if " and " in name:
            parts = name.split(" and ")
        elif "/" in name:
            parts = name.split("/")
        else:
            parts = [name]

        for part in parts:
            key = self._extract_series_key(part.strip())
            if key:
                results.append(key)

        return results

    def _extract_series_key(self, series_name: str) -> str | None:
        """Extract the series key from a series name."""
        name = series_name.replace("-series", "").replace("-Series", "").strip()

        if " and " in name:
            name = name.split(" and ")[0].strip()

        if "/" in name:
            name = name.split("/")[0].strip()

        if name.startswith("Standard_"):
            name = name[9:]

        name = re.sub(r"\s*\([^)]*\)", "", name).strip()

        return name if name else None

    def get_series_from_sku(self, sku_name: str) -> str | None:
        """Extract the VM series identifier from a SKU name."""
        if not sku_name:
            return None

        normalized = sku_name.strip()
        for prefix in ["Standard_", "Basic_", "standard_", "basic_"]:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix) :]
                break

        normalized = normalized.replace("_", " ")

        match = re.match(r"^([A-Za-z]+)\d*([a-z]*)\s*v?(\d+)?", normalized, re.IGNORECASE)

        if match:
            prefix = match.group(1)
            suffix = match.group(2) or ""
            version = match.group(3)

            series_key = f"{prefix}{suffix}"
            if version:
                series_key += f"v{version}"

            return series_key

        return None

    async def check_skus_retirement_status(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Check retirement status for SKUs in the results."""
        if not items:
            return []

        retirement_data = await self.get_retirement_data()

        seen_series: set[str] = set()
        warnings: list[dict[str, Any]] = []

        for item in items:
            sku_name = item.get("skuName") or item.get("armSkuName") or ""
            if not sku_name:
                continue

            series_key = self.get_series_from_sku(sku_name)
            if not series_key or series_key in seen_series:
                continue

            seen_series.add(series_key)

            retirement_info = self._match_series_to_retirement(series_key, retirement_data)

            if retirement_info and retirement_info.status != RetirementStatus.CURRENT:
                warning: dict[str, Any] = {
                    "series_name": retirement_info.series_name,
                    "status": retirement_info.status.value,
                    "sku_example": sku_name,
                }
                if retirement_info.retirement_date:
                    warning["retirement_date"] = retirement_info.retirement_date
                if retirement_info.replacement:
                    warning["replacement"] = retirement_info.replacement
                if retirement_info.migration_guide_url:
                    warning["migration_guide_url"] = retirement_info.migration_guide_url

                warnings.append(warning)

        return warnings

    def _match_series_to_retirement(
        self, series_key: str, retirement_data: dict[str, VMSeriesRetirementInfo]
    ) -> VMSeriesRetirementInfo | None:
        """Match a series key to retirement data with smart matching."""
        if series_key in retirement_data:
            return retirement_data[series_key]

        match = re.match(r"^([A-Za-z]+)(v\d+)?$", series_key, re.IGNORECASE)
        if not match:
            return None

        version = match.group(2)

        if version:
            if series_key.lower() in [k.lower() for k in retirement_data]:
                for k, v in retirement_data.items():
                    if k.lower() == series_key.lower():
                        return v
            return None

        return None
