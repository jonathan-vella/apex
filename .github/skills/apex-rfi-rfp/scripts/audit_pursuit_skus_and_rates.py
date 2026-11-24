"""Pursuit pricing bundle validator, Retail Prices API evaluator, and SKU retirement auditor.

Enforces APEX pricing and SKU retirement guardrails (RD-02, RD-07) across pursuit
cost bundles, supplemental Retail API meter checks (Reservations, Compute Savings
Plans, progressive tiered meters), and candidate SKU lists without silent $0
fallbacks or unverified regional GA claims.
"""

from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, TypeGuard

try:
    from ._safe_io import (
        ContainmentError,
        ensure_within_root,
        sha256_bytes,
        sha256_file,
    )
except ImportError:
    _script_dir = str(Path(__file__).resolve().parent)
    if _script_dir not in sys.path:
        sys.path.insert(0, _script_dir)
    from _safe_io import (  # type: ignore[no-redef]
        ContainmentError,
        ensure_within_root,
        sha256_bytes,
        sha256_file,
    )

RETAIL_PRICES_ENDPOINT = "https://prices.azure.com/api/retail/prices"
RETAIL_API_VERSION = "2023-01-01-preview"
UNVERIFIED_REGIONAL_GA_STATUS = "UNVERIFIED_REQUIRES_QUOTA_OR_DOCS_CHECK"
DEFAULT_DEPRECATIONS_FILE = Path(__file__).resolve().parents[4] / ".github" / "data" / "azure-deprecations.json"

_SHA256_HEX_RE = re.compile(r"^[0-9a-fA-F]{64}$")
_EVIDENCE_SHA_KEYS: tuple[str, ...] = (
    "raw_evidence_sha256",
    "raw_response_sha256",
    "response_sha256",
    "evidence_sha256",
    "sha256",
    "page_sha256",
    "row_sha256",
)
_NON_EVIDENCE_SHA_KEYS: frozenset[str] = frozenset(
    {
        "request_sha256",
        "request_line_sha256",
        "request_binding_sha256",
        "query_hash",
    }
)
_UNIT_PACK_RE = re.compile(r"^(?P<num>\d+(?:,\d{3})*)(?P<mult>[KMBkmb])?(?:\b|/|\s|$)")
_PLACEHOLDER_TOKEN_RE = re.compile(
    r"\b(?:unresolved|placeholder|tbd|todo|missing\s+meter|fallback\s+zero|estimate\s+pending)\b",
    re.IGNORECASE,
)
_FREE_TIER_JUSTIFICATION_RE = re.compile(
    r"(?:free[\s-]*tier|free[\s-]*allowance|free[\s-]*grant|included[\s-]*free|always[\s-]*free|first\s+[\d,]+\s+.*free)",
    re.IGNORECASE,
)

CURATED_PURSUIT_RETIREMENTS: tuple[dict[str, Any], ...] = (
    {
        "id": "vm-fsv2-series",
        "service": "Virtual Machines",
        "service_pattern": r"(?:virtual\s*machines|^vm$|compute|^$)",
        "sku_pattern": r"^(?:(?:standard_)?f\d+s_v2|fsv2)$",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2028-11-15",
        "replacement": "Standard_D*ls_v5 / Standard_F*ds_v5 (Dlsv5/Fdsv5)",
        "notes": "Fsv2 series is scheduled for retirement; use Dlsv5 or Fdsv5 compute equivalents.",
    },
    {
        "id": "vm-bv1-series",
        "service": "Virtual Machines",
        "service_pattern": r"(?:virtual\s*machines|^vm$|compute|^$)",
        "sku_pattern": r"^(?:(?:standard_)?b(?:1ls|1s|1ms|2s|2ms|4ms|8ms|12ms|16ms|20ms)|bv1)$",
        "retirement_status": "PURSUIT_TRAP_ADVISORY",
        "sunset_date": None,
        "replacement": "Standard_B*s_v2 / Standard_B*as_v2 (Bsv2/Basv2)",
        "notes": "Legacy B-series v1 burstable VMs lack modern networking/disk baselines; prefer Bsv2 or Basv2.",
    },
    {
        "id": "apim-classic-v1-tiers",
        "service": "API Management",
        "service_pattern": r"(?:api\s*management|\bapim\b|microsoft\.apimanagement)",
        "sku_pattern": r"^(?:developer|basic|standard|premium|isolated)(?:[_\s-]*v1)?$",
        "retirement_status": "PURSUIT_TRAP_ADVISORY",
        "sunset_date": None,
        "replacement": "Developer v2 / Basic v2 / Standard v2 / Premium v2",
        "notes": (
            "Classic API Management v1 tiers have long provisioning times and legacy networking; evaluate v2 tiers "
            "where feature parity (for example multi-region or self-hosted gateway) permits."
        ),
    },
    {
        "id": "functions-linux-consumption",
        "service": "Functions",
        "service_pattern": r"(?:functions|function\s*app|microsoft\.web/sites)",
        "sku_pattern": r"^(?:y1|dynamic|consumption|linux[\s_-]*consumption)$",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2028-09-30",
        "replacement": "Flex Consumption (FC1)",
        "notes": "Azure Functions Linux Consumption plan retires 2028-09-30; use Flex Consumption (FC1).",
    },
    {
        "id": "vpn-gateway-non-az",
        "service": "VPN Gateway",
        "service_pattern": r"(?:vpn\s*gateway|virtual\s*network\s*gateway|^$)",
        "sku_pattern": r"^(?:vpngw[1-5]|basic(?:\s+vpn\s+gateway)?)$",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2026-09-30",
        "replacement": "VpnGw1AZ..VpnGw5AZ",
        "notes": "Non-AZ VpnGw1..VpnGw5 SKUs are retired/migrated; specify zone-redundant VpnGw1AZ..VpnGw5AZ.",
    },
    {
        "id": "public-ip-basic",
        "service": "Public IP Addresses",
        "service_pattern": r"(?:public\s*ip|publicipaddresses)",
        "sku_pattern": r"^(?:basic|basic[\s_-]*public[\s_-]*ip|publicip[\s_-]*basic)$",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2025-09-30",
        "replacement": "Standard Public IP",
        "notes": "Basic SKU Public IP retired 2025-09-30; use Standard SKU Public IP.",
    },
    {
        "id": "public-ip-basic-standalone",
        "service": "Public IP Addresses",
        "service_pattern": r".*",
        "sku_pattern": r"^(?:basic[\s_-]*public[\s_-]*ip|publicip[\s_-]*basic)$",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2025-09-30",
        "replacement": "Standard Public IP",
        "notes": "Basic SKU Public IP retired 2025-09-30; use Standard SKU Public IP.",
    },
    {
        "id": "app-insights-classic",
        "service": "Application Insights",
        "service_pattern": r"(?:application\s*insights|app\s*insights|azure\s*monitor)",
        "sku_pattern": r"^(?:classic|classic[\s_-]*application[\s_-]*insights)$",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2024-02-29",
        "replacement": "Workspace-based Application Insights",
        "notes": "Classic Application Insights retired 2024-02-29; use Workspace-based Application Insights.",
    },
    {
        "id": "dedicated-hsm",
        "service": "Azure Dedicated HSM",
        "service_pattern": r"(?:dedicated\s*hsm|hardwaresecuritymodules)",
        "sku_pattern": r".+",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2025-08-01",
        "replacement": "Azure Cloud HSM / Azure Key Vault Managed HSM",
        "notes": "Azure Dedicated HSM (SafeNet Luna A790) is retired for new deployments; use Cloud HSM or Managed HSM.",
    },
    {
        "id": "dedicated-hsm-sku",
        "service": "Azure Dedicated HSM",
        "service_pattern": r".*",
        "sku_pattern": r"(?:safenet\s*luna|dedicated[\s_-]*hsm)",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2025-08-01",
        "replacement": "Azure Cloud HSM / Azure Key Vault Managed HSM",
        "notes": "Azure Dedicated HSM is retired for new deployments; use Azure Cloud HSM or Managed HSM.",
    },
    {
        "id": "synapse-dedicated-sql-pool",
        "service": "Azure Synapse Analytics",
        "service_pattern": r"(?:synapse|sql\s*data\s*warehouse|^$)",
        "sku_pattern": r"^(?:dw\d+c|dedicated[\s_-]*sql[\s_-]*pool.*)$",
        "retirement_status": "PURSUIT_TRAP_ADVISORY",
        "sunset_date": None,
        "replacement": "Microsoft Fabric Data Warehouse",
        "notes": "Synapse Dedicated SQL Pool is superseded for greenfield analytics by Microsoft Fabric Data Warehouse.",
    },
    {
        "id": "redis-cache-legacy-tiers",
        "service": "Azure Cache for Redis",
        "service_pattern": r"(?:azure\s*cache\s*for\s*redis|^redis\s*cache$|^redis$)",
        "sku_pattern": r"^(?:basic|standard|premium|c[0-6]|p[1-5])(?:\s+.*)?$",
        "retirement_status": "RETIRED_OR_DEPRECATED",
        "sunset_date": "2028-09-30",
        "replacement": "Azure Managed Redis",
        "notes": "Azure Cache for Redis Basic/Standard/Premium tiers are retiring; migrate to Azure Managed Redis.",
    },
)


class MeterResolutionError(ValueError):
    """Raised when meter selection fails closed (missing, ambiguous, or invalid tier bands)."""

    def __init__(self, message: str, *, status: str = "UNRESOLVED") -> None:
        super().__init__(message)
        self.status = status


class BundleValidationError(ValueError):
    """Raised when a pricing bundle fails schema, meter, rate, or SHA-256 provenance checks."""


def _is_valid_sha256(value: Any) -> bool:
    """Return True if `value` is a 64-character hexadecimal SHA-256 digest."""
    return isinstance(value, str) and bool(_SHA256_HEX_RE.match(value.strip()))


def _is_finite_number(value: Any) -> TypeGuard[int | float]:
    """Return True if `value` is a finite int or float (excluding booleans)."""
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(float(value))


def _to_decimal(value: Any, label: str) -> Decimal:
    """Convert a finite numeric value to `Decimal` without binary float drift."""
    if not _is_finite_number(value):
        raise MeterResolutionError(f"UNRESOLVED: Non-finite numeric value for {label}: {value!r}")
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise MeterResolutionError(f"UNRESOLVED: Invalid decimal value for {label}: {value!r}") from exc


def normalize_unit_quantity(unit_of_measure: str, raw_qty: float) -> float:
    """Normalize raw usage count into billable Retail API meter units.

    Examples:
        - `normalize_unit_quantity("1 Hour", 730)` -> `730.0` (`1.0` per hour)
        - `normalize_unit_quantity("10K", 50000)` -> `5.0` (`/ 10000`)
        - `normalize_unit_quantity("10,000", 25000)` -> `2.5` (`/ 10000`)
        - `normalize_unit_quantity("1M", 2500000)` -> `2.5` (`/ 1000000`)
        - `normalize_unit_quantity("1,000,000", 500000)` -> `0.5` (`/ 1000000`)
        - `normalize_unit_quantity("1 GB/Month", 100)` -> `100.0` (`1.0` per GB/Month)
    """
    if not _is_finite_number(raw_qty) or raw_qty < 0:
        raise MeterResolutionError(f"UNRESOLVED: Quantity must be finite and non-negative, got {raw_qty!r}")
    if not isinstance(unit_of_measure, str) or not unit_of_measure.strip():
        raise MeterResolutionError("UNRESOLVED: unitOfMeasure must be a non-empty string")

    cleaned = unit_of_measure.strip()
    match = _UNIT_PACK_RE.match(cleaned)
    if match is None:
        raise MeterResolutionError(f"UNRESOLVED: Unrecognized unitOfMeasure format {unit_of_measure!r}")

    base_num = Decimal(match.group("num").replace(",", ""))
    if base_num <= 0:
        raise MeterResolutionError(f"UNRESOLVED: Invalid zero pack size in unitOfMeasure {unit_of_measure!r}")

    mult_char = (match.group("mult") or "").upper()
    multiplier_map: dict[str, Decimal] = {
        "": Decimal("1"),
        "K": Decimal("1000"),
        "M": Decimal("1000000"),
        "B": Decimal("1000000000"),
    }
    pack_size = base_num * multiplier_map[mult_char]
    qty_dec = _to_decimal(raw_qty, "raw_qty")
    return float(qty_dec / pack_size)


def compute_tiered_cost(
    tiers: Sequence[Mapping[str, Any] | tuple[float, float]] | Mapping[str, Any],
    quantity: float,
) -> float:
    """Compute progressive multi-band cost across `tierMinimumUnits` bands.

    Fails closed (`MeterResolutionError`) on empty tier lists, missing `tierMinimumUnits`
    on multi-row meters, duplicate tier boundaries, missing `0` base band, or negative rates.
    """
    if not _is_finite_number(quantity) or quantity < 0:
        raise MeterResolutionError(f"UNRESOLVED: Tiered quantity must be finite and non-negative, got {quantity!r}")

    raw_tiers: Sequence[Any]
    if isinstance(tiers, Mapping):
        extracted = tiers.get("tiers") or tiers.get("tier_bands") or tiers.get("rows")
        if not isinstance(extracted, Sequence):
            raise MeterResolutionError("UNRESOLVED: Mapping passed to compute_tiered_cost has no 'tiers' sequence")
        raw_tiers = extracted
    else:
        raw_tiers = tiers

    if len(raw_tiers) == 0:
        raise MeterResolutionError("UNRESOLVED: Cannot compute tiered cost from an empty tier list")

    parsed_bands: list[tuple[Decimal, Decimal]] = []
    seen_boundaries: set[Decimal] = set()

    for idx, band in enumerate(raw_tiers):
        if isinstance(band, tuple) and len(band) == 2:
            raw_min, raw_rate = band
        elif isinstance(band, Mapping):
            raw_min = band.get("tierMinimumUnits", band.get("tier_minimum_units"))
            if raw_min is None and len(raw_tiers) == 1:
                raw_min = 0.0
            raw_rate = band.get("retailPrice", band.get("retail_price", band.get("unitPrice")))
        else:
            raise MeterResolutionError(f"UNRESOLVED: Unsupported tier entry at index {idx}: {band!r}")

        if raw_min is None:
            raise MeterResolutionError(f"UNRESOLVED: Multi-band meter is missing tierMinimumUnits at band index {idx}")
        if raw_rate is None:
            raise MeterResolutionError(f"UNRESOLVED: Missing retailPrice at band index {idx}")

        min_dec = _to_decimal(raw_min, f"tiers[{idx}].tierMinimumUnits")
        rate_dec = _to_decimal(raw_rate, f"tiers[{idx}].retailPrice")

        if min_dec < 0:
            raise MeterResolutionError(f"UNRESOLVED: Negative tierMinimumUnits ({min_dec}) at index {idx}")
        if rate_dec < 0:
            raise MeterResolutionError(f"UNRESOLVED: Negative retailPrice ({rate_dec}) at index {idx}")
        if min_dec in seen_boundaries:
            raise MeterResolutionError(f"UNRESOLVED: Ambiguous duplicate tierMinimumUnits={min_dec} across meter rows")
        seen_boundaries.add(min_dec)
        parsed_bands.append((min_dec, rate_dec))

    parsed_bands.sort(key=lambda pair: pair[0])
    if parsed_bands[0][0] != Decimal("0"):
        raise MeterResolutionError(
            f"UNRESOLVED: Tiered meter is missing base tierMinimumUnits=0 band (lowest={parsed_bands[0][0]})"
        )

    qty_dec = _to_decimal(quantity, "quantity")
    if qty_dec == Decimal("0"):
        return 0.0

    total = Decimal("0")
    for idx, (lower, rate) in enumerate(parsed_bands):
        if qty_dec <= lower:
            break
        upper = parsed_bands[idx + 1][0] if idx + 1 < len(parsed_bands) else None
        band_units = (min(qty_dec, upper) - lower) if upper is not None else (qty_dec - lower)
        if band_units > 0:
            total += band_units * rate

    return float(total)


def _logical_meter_identity(row: Mapping[str, Any]) -> tuple[str, ...]:
    """Build identity key shared by tier bands of a single Retail API meter."""
    return (
        str(row.get("serviceName") or "").strip(),
        str(row.get("productName") or "").strip(),
        str(row.get("skuName") or "").strip(),
        str(row.get("armSkuName") or "").strip(),
        str(row.get("meterName") or "").strip(),
        str(row.get("unitOfMeasure") or "").strip(),
        str(row.get("armRegionName") or "").strip(),
        str(row.get("type") or "").strip(),
        str(row.get("currencyCode") or "USD").strip(),
        str(row.get("reservationTerm") or "").strip(),
    )


def select_unambiguous_meter(
    items: Sequence[Mapping[str, Any]],
    *,
    region: str | None = None,
    service_name: str | None = None,
    arm_sku_name: str | None = None,
    sku_name: str | None = None,
    product_name: str | None = None,
    meter_name: str | None = None,
    price_type: str | None = "Consumption",
    reservation_term: str | None = None,
    currency_code: str = "USD",
    allow_devtest: bool = False,
    allow_spot: bool = False,
    allow_global_region: bool = False,
    require_primary_meter_region: bool = True,
) -> dict[str, Any]:
    """Select an unambiguous single or multi-band meter from Retail API items.

    Raises `MeterResolutionError` (`status="UNRESOLVED"`) if 0 meters match OR if
    multiple distinct non-tiered meters match ambiguously. Never defaults to `$0.00`.
    """
    allowed_regions: set[str] | None = None
    if region is not None:
        allowed_regions = {region.strip().lower()}
        if allow_global_region:
            allowed_regions.update({"global", "", "zone 1"})

    spot_explicit = any("spot" in (val or "").lower() for val in (sku_name, meter_name, arm_sku_name))

    filtered: list[dict[str, Any]] = []
    for raw_item in items:
        if not isinstance(raw_item, Mapping):
            continue
        item_type = str(raw_item.get("type") or "").strip()
        if not allow_devtest and item_type.lower() == "devtestconsumption":
            continue
        if price_type is not None and item_type.lower() != price_type.strip().lower():
            continue

        item_currency = str(raw_item.get("currencyCode") or "USD").strip().upper()
        if currency_code and item_currency != currency_code.strip().upper():
            continue

        if require_primary_meter_region and raw_item.get("isPrimaryMeterRegion", True) is not True:
            continue

        item_region = str(raw_item.get("armRegionName") or "").strip().lower()
        if allowed_regions is not None and item_region not in allowed_regions:
            continue

        item_meter_name = str(raw_item.get("meterName") or "").strip()
        item_sku_name = str(raw_item.get("skuName") or "").strip()
        if (
            not allow_spot
            and not spot_explicit
            and (" spot" in f" {item_meter_name.lower()}" or " spot" in f" {item_sku_name.lower()}")
        ):
            continue

        if service_name is not None and str(raw_item.get("serviceName") or "").strip() != service_name.strip():
            continue
        if arm_sku_name is not None and str(raw_item.get("armSkuName") or "").strip() != arm_sku_name.strip():
            continue
        if sku_name is not None and item_sku_name != sku_name.strip():
            continue
        if product_name is not None and str(raw_item.get("productName") or "").strip() != product_name.strip():
            continue
        if meter_name is not None and item_meter_name != meter_name.strip():
            continue
        if (
            reservation_term is not None
            and str(raw_item.get("reservationTerm") or "").strip() != reservation_term.strip()
        ):
            continue

        filtered.append(dict(raw_item))

    if not filtered:
        raise MeterResolutionError(
            "UNRESOLVED: 0 retail meters matched filters "
            f"(region={region!r}, service={service_name!r}, armSkuName={arm_sku_name!r}, "
            f"meterName={meter_name!r}, priceType={price_type!r}, reservationTerm={reservation_term!r})"
        )

    grouped: dict[tuple[str, ...], list[dict[str, Any]]] = {}
    for row in filtered:
        key = _logical_meter_identity(row)
        grouped.setdefault(key, []).append(row)

    if len(grouped) > 1:
        summaries = [f"{k[1] or k[0]} / {k[2] or k[3]} / {k[4]} ({k[6] or 'global'})" for k in list(grouped.keys())[:5]]
        raise MeterResolutionError(
            f"UNRESOLVED: Ambiguous meter selection matched {len(grouped)} distinct meters: {'; '.join(summaries)}"
        )

    only_rows = next(iter(grouped.values()))

    for idx, row in enumerate(only_rows):
        rate_val = row.get("retailPrice")
        if not _is_finite_number(rate_val) or float(rate_val) < 0:
            raise MeterResolutionError(
                f"UNRESOLVED: Matched meter row #{idx} has missing or invalid retailPrice: {rate_val!r}"
            )

    if len(only_rows) > 1:
        boundaries: list[Decimal] = []
        for idx, row in enumerate(only_rows):
            raw_min = row.get("tierMinimumUnits")
            if raw_min is None:
                raise MeterResolutionError(
                    "UNRESOLVED: Multiple meter rows matched without tierMinimumUnits; refusing to guess band bounds"
                )
            min_dec = _to_decimal(raw_min, f"rows[{idx}].tierMinimumUnits")
            if min_dec in boundaries:
                raise MeterResolutionError(
                    f"UNRESOLVED: Ambiguous non-tiered or duplicate rows share tierMinimumUnits={min_dec}"
                )
            boundaries.append(min_dec)
        only_rows.sort(key=lambda r: Decimal(str(r["tierMinimumUnits"])))
        if Decimal(str(only_rows[0]["tierMinimumUnits"])) != Decimal("0"):
            raise MeterResolutionError("UNRESOLVED: Tiered meter rows do not include a tierMinimumUnits=0 base band")
    else:
        raw_single_min = only_rows[0].get("tierMinimumUnits")
        if raw_single_min is not None and _to_decimal(raw_single_min, "tierMinimumUnits") != Decimal("0"):
            raise MeterResolutionError(
                f"UNRESOLVED: Single matched row starts at non-zero tierMinimumUnits={raw_single_min}"
            )

    first = only_rows[0]
    tiers = [
        {
            "tierMinimumUnits": float(row.get("tierMinimumUnits") or 0.0),
            "retailPrice": float(row["retailPrice"]),
            "unitPrice": float(row.get("unitPrice", row["retailPrice"])),
            "meterId": str(row.get("meterId") or ""),
        }
        for row in only_rows
    ]

    savings_plans: list[dict[str, Any]] = []
    raw_sp = first.get("savingsPlan")
    if isinstance(raw_sp, Sequence) and not isinstance(raw_sp, (str, bytes)):
        for sp_entry in raw_sp:
            if isinstance(sp_entry, Mapping) and _is_finite_number(sp_entry.get("retailPrice")):
                savings_plans.append(
                    {
                        "term": str(sp_entry.get("term") or "").strip(),
                        "retailPrice": float(sp_entry["retailPrice"]),
                        "unitPrice": float(sp_entry.get("unitPrice", sp_entry["retailPrice"])),
                    }
                )
        savings_plans.sort(key=lambda item: str(item["term"]))

    resolved: dict[str, Any] = {
        "status": "RESOLVED",
        "meterId": str(first.get("meterId") or ""),
        "serviceName": str(first.get("serviceName") or ""),
        "productName": str(first.get("productName") or ""),
        "skuName": str(first.get("skuName") or ""),
        "armSkuName": str(first.get("armSkuName") or ""),
        "meterName": str(first.get("meterName") or ""),
        "armRegionName": str(first.get("armRegionName") or ""),
        "unitOfMeasure": str(first.get("unitOfMeasure") or ""),
        "type": str(first.get("type") or ""),
        "currencyCode": str(first.get("currencyCode") or "USD"),
        "retailPrice": float(first["retailPrice"]),
        "unitPrice": float(first.get("unitPrice", first["retailPrice"])),
        "is_tiered": len(tiers) > 1,
        "tiers": tiers,
        "savingsPlan": savings_plans,
        "rows": only_rows,
    }
    if first.get("reservationTerm"):
        resolved["reservationTerm"] = str(first["reservationTerm"])
    return resolved


def _validate_retail_page_url(url: str) -> None:
    """Ensure pagination URLs never leave `https://prices.azure.com`."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.netloc.lower() != "prices.azure.com":
        raise ContainmentError(f"Refusing untrusted Retail API URL outside prices.azure.com: {url!r}")


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def fetch_retail_prices(
    odata_filter: str,
    *,
    currency_code: str = "USD",
    api_version: str = RETAIL_API_VERSION,
    max_pages: int = 20,
    timeout_seconds: float = 30.0,
    max_retries: int = 3,
    backoff_base_seconds: float = 1.0,
    evidence_dir: Path | None = None,
    relative_to_dir: Path | None = None,
    root: Path | None = None,
    opener: Callable[..., Any] | None = None,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    """Fetch paginated Azure Retail Prices API results, persisting verbatim raw bytes before parsing."""
    if not odata_filter or not odata_filter.strip():
        raise ValueError("odata_filter must be a non-empty OData filter string")

    resolved_evidence_dir: Path | None = None
    if evidence_dir is not None:
        if root is not None:
            resolved_evidence_dir = ensure_within_root(evidence_dir, root)
        else:
            if evidence_dir.exists() and evidence_dir.is_symlink():
                raise ContainmentError(f"Refusing symlink evidence directory: {evidence_dir}")
            resolved_evidence_dir = evidence_dir.resolve()
        resolved_evidence_dir.mkdir(parents=True, exist_ok=True)

    resolved_rel_base = relative_to_dir.resolve() if relative_to_dir is not None else None

    query = urllib.parse.urlencode(
        {
            "api-version": api_version,
            "currencyCode": currency_code,
            "$filter": odata_filter.strip(),
        }
    )
    next_url: str | None = f"{RETAIL_PRICES_ENDPOINT}?{query}"
    http_open = opener if opener is not None else urllib.request.urlopen

    pages: list[dict[str, Any]] = []
    all_items: list[dict[str, Any]] = []

    while next_url is not None:
        if len(pages) >= max_pages:
            raise MeterResolutionError(
                f"UNRESOLVED: Retail API pagination exceeded max_pages={max_pages} for filter {odata_filter!r}"
            )
        _validate_retail_page_url(next_url)
        req = urllib.request.Request(
            next_url,
            headers={"Accept": "application/json", "User-Agent": "apex-rfi-rfp-pricing-auditor/1.0"},
            method="GET",
        )

        raw_bytes: bytes | None = None
        last_exc: Exception | None = None
        for attempt in range(max_retries + 1):
            try:
                with http_open(req, timeout=timeout_seconds) as resp:
                    raw_bytes = resp.read()
                break
            except urllib.error.HTTPError as exc:
                last_exc = exc
                if exc.code in (429, 500, 502, 503, 504) and attempt < max_retries:
                    retry_after = exc.headers.get("Retry-After") if exc.headers else None
                    delay = backoff_base_seconds * (2**attempt)
                    if retry_after and retry_after.isdigit():
                        delay = max(delay, min(float(retry_after), 30.0))
                    sleep_fn(delay)
                    continue
                raise MeterResolutionError(f"UNRESOLVED: Retail API HTTP {exc.code} failure for {next_url}") from exc
            except urllib.error.URLError as exc:
                last_exc = exc
                if attempt < max_retries:
                    sleep_fn(backoff_base_seconds * (2**attempt))
                    continue
                raise MeterResolutionError(f"UNRESOLVED: Retail API network error: {exc}") from exc

        if raw_bytes is None:
            raise MeterResolutionError(f"UNRESOLVED: Retail API request failed: {last_exc}")

        retrieved_at = _utc_now_iso()
        page_sha = sha256_bytes(raw_bytes)

        # Persist exact native response bytes with a locator BEFORE parsing JSON
        evidence_locator: str | None = None
        if resolved_evidence_dir is not None:
            raw_target = resolved_evidence_dir / f"{page_sha}.raw.json"
            if root is not None:
                raw_target = ensure_within_root(raw_target, root)
            elif raw_target.exists() and raw_target.is_symlink():
                raise ContainmentError(f"Refusing symlink raw evidence file: {raw_target}")
            if raw_target.exists():
                if sha256_file(raw_target) != page_sha:
                    raise ContainmentError(f"Raw evidence hash collision at {raw_target}")
            else:
                tmp_raw = raw_target.parent / f".{raw_target.name}.{os.getpid()}.tmp"
                try:
                    tmp_raw.write_bytes(raw_bytes)
                    os.replace(tmp_raw, raw_target)
                finally:
                    if tmp_raw.exists():
                        tmp_raw.unlink(missing_ok=True)
            if resolved_rel_base is not None and raw_target.is_relative_to(resolved_rel_base):
                evidence_locator = raw_target.relative_to(resolved_rel_base).as_posix()
            else:
                evidence_locator = raw_target.as_posix()

        try:
            decoded_utf8 = raw_bytes.decode("utf-8")
            payload = json.loads(decoded_utf8)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise MeterResolutionError(f"UNRESOLVED: Invalid JSON in Retail API response: {exc}") from exc

        if not isinstance(payload, dict) or not isinstance(payload.get("Items"), list):
            raise MeterResolutionError("UNRESOLVED: Retail API payload missing 'Items' list")

        page_items = [item for item in payload["Items"] if isinstance(item, dict)]
        all_items.extend(page_items)
        page_record: dict[str, Any] = {
            "page_index": len(pages),
            "url": next_url,
            "retrieved_at": retrieved_at,
            "item_count": len(page_items),
            "response_sha256": page_sha,
        }
        if evidence_locator is not None:
            page_record["evidence_path"] = evidence_locator
        else:
            page_record["raw_response"] = decoded_utf8
        pages.append(page_record)

        raw_next = payload.get("NextPageLink")
        next_url = str(raw_next).strip() if isinstance(raw_next, str) and raw_next.strip() else None

    combined_digest = sha256_bytes(
        json.dumps([p["response_sha256"] for p in pages], separators=(",", ":")).encode("utf-8")
    )
    return {
        "schema_version": "pursuit-retail-fetch-ledger-v1",
        "filter": odata_filter.strip(),
        "currency_code": currency_code,
        "retrieved_at": pages[0]["retrieved_at"] if pages else _utc_now_iso(),
        "page_count": len(pages),
        "total_items": len(all_items),
        "raw_evidence_sha256": pages[0]["response_sha256"] if len(pages) == 1 else combined_digest,
        "pages": pages,
        "Items": all_items,
    }


def _extract_items_from_payload(payload: Any) -> tuple[list[dict[str, Any]], list[str]]:
    """Extract Retail API item dictionaries and any embedded page SHA-256 digests."""
    page_digests: list[str] = []
    if isinstance(payload, list):
        return [dict(x) for x in payload if isinstance(x, Mapping)], page_digests
    if not isinstance(payload, Mapping):
        raise MeterResolutionError("UNRESOLVED: Retail JSON payload must be an object or array")

    if isinstance(payload.get("Items"), list):
        if isinstance(payload.get("pages"), list):
            for page in payload["pages"]:
                if isinstance(page, Mapping) and _is_valid_sha256(page.get("response_sha256")):
                    page_digests.append(str(page["response_sha256"]).lower())
        return [dict(x) for x in payload["Items"] if isinstance(x, Mapping)], page_digests

    if isinstance(payload.get("pages"), list):
        extracted: list[dict[str, Any]] = []
        for page in payload["pages"]:
            if not isinstance(page, Mapping):
                continue
            if _is_valid_sha256(page.get("response_sha256")):
                page_digests.append(str(page["response_sha256"]).lower())
            raw_resp = page.get("raw_response")
            if isinstance(raw_resp, str):
                parsed_page = json.loads(raw_resp)
                if isinstance(parsed_page, Mapping) and isinstance(parsed_page.get("Items"), list):
                    extracted.extend(dict(x) for x in parsed_page["Items"] if isinstance(x, Mapping))
        return extracted, page_digests

    if isinstance(payload.get("results"), Mapping) and isinstance(payload["results"].get("prices"), list):
        return [dict(x) for x in payload["results"]["prices"] if isinstance(x, Mapping)], page_digests

    raise MeterResolutionError("UNRESOLVED: Retail JSON payload has no recognizable 'Items', 'pages', or 'prices'")


def evaluate_retail_meters(
    items_or_payload: Any,
    *,
    raw_evidence_sha256: str | None = None,
    evidence_pages: Sequence[Mapping[str, Any]] | None = None,
    retrieved_at: str | None = None,
    region: str | None = None,
    service_name: str | None = None,
    arm_sku_name: str | None = None,
    sku_name: str | None = None,
    product_name: str | None = None,
    meter_name: str | None = None,
    quantity: float | None = None,
    currency_code: str = "USD",
    allow_devtest: bool = False,
    allow_spot: bool = False,
    allow_global_region: bool = False,
    require_primary_meter_region: bool = True,
) -> dict[str, Any]:
    """Evaluate Consumption PAYG, Compute Savings Plans, Reservations, and tiered costs.

    Fails closed (`MeterResolutionError`, `status="UNRESOLVED"`) when zero valid meters
    match or when Consumption / Reservation candidates are ambiguous.
    """
    items, page_digests = _extract_items_from_payload(items_or_payload)
    effective_sha = raw_evidence_sha256
    if effective_sha is None and page_digests:
        effective_sha = (
            page_digests[0]
            if len(page_digests) == 1
            else sha256_bytes(json.dumps(page_digests, separators=(",", ":")).encode("utf-8"))
        )
    if effective_sha is None:
        effective_sha = sha256_bytes(json.dumps(items, sort_keys=True, separators=(",", ":")).encode("utf-8"))

    resolved_pages: list[dict[str, Any]] = []
    if evidence_pages is not None:
        resolved_pages = [dict(p) for p in evidence_pages if isinstance(p, Mapping)]
    elif isinstance(items_or_payload, Mapping) and isinstance(items_or_payload.get("pages"), list):
        resolved_pages = [dict(p) for p in items_or_payload["pages"] if isinstance(p, Mapping)]

    effective_retrieved_at = retrieved_at
    if effective_retrieved_at is None and isinstance(items_or_payload, Mapping):
        raw_ts = items_or_payload.get("retrieved_at") or items_or_payload.get("queried_at")
        if isinstance(raw_ts, str) and raw_ts.strip():
            effective_retrieved_at = raw_ts.strip()
    if effective_retrieved_at is None and resolved_pages:
        first_ts = resolved_pages[0].get("retrieved_at") or resolved_pages[0].get("queried_at")
        if isinstance(first_ts, str) and first_ts.strip():
            effective_retrieved_at = first_ts.strip()

    evidence_paths = [
        str(p["evidence_path"]).strip()
        for p in resolved_pages
        if isinstance(p.get("evidence_path"), str) and str(p["evidence_path"]).strip()
    ]
    line_evidence_ref: dict[str, Any] = {"raw_evidence_sha256": effective_sha}
    if effective_retrieved_at is not None:
        line_evidence_ref["retrieved_at"] = effective_retrieved_at
    if evidence_paths:
        line_evidence_ref["evidence_paths"] = evidence_paths
        if len(evidence_paths) == 1:
            line_evidence_ref["evidence_path"] = evidence_paths[0]

    common_kwargs: dict[str, Any] = {
        "region": region,
        "service_name": service_name,
        "arm_sku_name": arm_sku_name,
        "sku_name": sku_name,
        "product_name": product_name,
        "meter_name": meter_name,
        "currency_code": currency_code,
        "allow_devtest": allow_devtest,
        "allow_spot": allow_spot,
        "allow_global_region": allow_global_region,
        "require_primary_meter_region": require_primary_meter_region,
    }

    has_consumption_candidates = any(str(row.get("type") or "").strip().lower() == "consumption" for row in items)
    has_reservation_candidates = any(str(row.get("type") or "").strip().lower() == "reservation" for row in items)

    consumption_summary: dict[str, Any] | None = None
    if has_consumption_candidates:
        try:
            resolved_payg = select_unambiguous_meter(items, price_type="Consumption", **common_kwargs)
            consumption_summary = dict(resolved_payg)
            consumption_summary.pop("rows", None)
            if quantity is not None:
                norm_qty = normalize_unit_quantity(resolved_payg["unitOfMeasure"], quantity)
                consumption_summary["raw_quantity"] = quantity
                consumption_summary["normalized_quantity"] = norm_qty
                consumption_summary["computed_cost"] = compute_tiered_cost(resolved_payg["tiers"], norm_qty)
        except MeterResolutionError as exc:
            if not has_reservation_candidates or "Ambiguous" in str(exc) or "tierMinimumUnits" in str(exc):
                raise

    reservations_summary: dict[str, dict[str, Any]] = {}
    if has_reservation_candidates:
        for term in ("1 Year", "3 Years"):
            term_candidates = [
                row
                for row in items
                if str(row.get("type") or "").strip().lower() == "reservation"
                and str(row.get("reservationTerm") or "").strip() == term
            ]
            if not term_candidates:
                continue
            resolved_ri = select_unambiguous_meter(
                items,
                price_type="Reservation",
                reservation_term=term,
                **common_kwargs,
            )
            months = 12 if term == "1 Year" else 36
            hours = 8760 if term == "1 Year" else 26280
            term_total = Decimal(str(resolved_ri["retailPrice"]))
            reservations_summary[term] = {
                "meterId": resolved_ri["meterId"],
                "armSkuName": resolved_ri["armSkuName"],
                "skuName": resolved_ri["skuName"],
                "productName": resolved_ri["productName"],
                "meterName": resolved_ri["meterName"],
                "armRegionName": resolved_ri["armRegionName"],
                "reservationTerm": term,
                "unitOfMeasure": resolved_ri["unitOfMeasure"],
                "termRetailPrice": float(term_total),
                "effectiveMonthlyPrice": float(term_total / Decimal(months)),
                "effectiveHourlyPrice": float(term_total / Decimal(hours)),
                "currencyCode": resolved_ri["currencyCode"],
            }

    if consumption_summary is None and not reservations_summary:
        raise MeterResolutionError("UNRESOLVED: 0 valid Consumption or Reservation meters matched selection criteria")

    savings_plans = consumption_summary.get("savingsPlan", []) if consumption_summary is not None else []
    lines: list[dict[str, Any]] = []
    if consumption_summary is not None:
        line_entry: dict[str, Any] = {
            "meterId": consumption_summary["meterId"],
            "serviceName": consumption_summary["serviceName"],
            "productName": consumption_summary["productName"],
            "armSkuName": consumption_summary["armSkuName"],
            "meterName": consumption_summary["meterName"],
            "armRegionName": consumption_summary["armRegionName"],
            "unitOfMeasure": consumption_summary["unitOfMeasure"],
            "priceType": "Consumption",
            "retailPrice": consumption_summary["retailPrice"],
            "tiers": consumption_summary["tiers"],
            "savingsPlan": savings_plans,
            "raw_evidence_sha256": effective_sha,
            "evidence_ref": dict(line_evidence_ref),
        }
        if consumption_summary["retailPrice"] == 0.0 and consumption_summary["is_tiered"]:
            line_entry["free_tier_justified"] = True
            line_entry["zero_rate_justification"] = "Native tiered meter includes a $0 initial tierMinimumUnits=0 band"
        if "computed_cost" in consumption_summary:
            line_entry["computed_cost"] = consumption_summary["computed_cost"]
            line_entry["normalized_quantity"] = consumption_summary["normalized_quantity"]
        lines.append(line_entry)

    for term, ri_entry in reservations_summary.items():
        lines.append(
            {
                "meterId": ri_entry["meterId"],
                "productName": ri_entry["productName"],
                "armSkuName": ri_entry["armSkuName"],
                "meterName": ri_entry["meterName"],
                "armRegionName": ri_entry["armRegionName"],
                "unitOfMeasure": ri_entry["unitOfMeasure"],
                "priceType": "Reservation",
                "reservationTerm": term,
                "retailPrice": ri_entry["termRetailPrice"],
                "effectiveMonthlyPrice": ri_entry["effectiveMonthlyPrice"],
                "raw_evidence_sha256": effective_sha,
                "evidence_ref": dict(line_evidence_ref),
            }
        )

    evaluation_doc: dict[str, Any] = {
        "schema_version": "pursuit-rate-evaluation-v1",
        "status": "RESOLVED",
        "raw_evidence_sha256": effective_sha,
        "consumption": consumption_summary,
        "savings_plans": savings_plans,
        "reservations": reservations_summary,
        "lines": lines,
    }
    if effective_retrieved_at is not None:
        evaluation_doc["retrieved_at"] = effective_retrieved_at
    if resolved_pages:
        evaluation_doc["evidence"] = resolved_pages
        evaluation_doc["pages"] = resolved_pages
    return evaluation_doc


_PAGE_EVIDENCE_SHA_KEYS: tuple[str, ...] = (
    "raw_evidence_sha256",
    "raw_response_sha256",
    "response_sha256",
    "evidence_sha256",
    "sha256",
    "page_sha256",
)
_CANONICAL_METER_FIELDS: tuple[str, ...] = (
    "meterId",
    "meterName",
    "serviceName",
    "productName",
    "skuName",
    "armSkuName",
    "armRegionName",
    "currencyCode",
    "type",
    "unitOfMeasure",
    "tierMinimumUnits",
    "effectiveStartDate",
    "retailPrice",
)
REPO_ROOT_DIR = Path(__file__).resolve().parents[4]


@dataclass(slots=True)
class _VerifiedEvidenceCatalog:
    """Verified raw Retail API response bytes and decoded meter rows for bundle validation."""

    by_digest: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    by_path: dict[Path, list[dict[str, Any]]] = field(default_factory=dict)
    all_rows: list[dict[str, Any]] = field(default_factory=list)
    verified_digests: set[str] = field(default_factory=set)
    declared_digests: set[str] = field(default_factory=set)
    errors: list[str] = field(default_factory=list)

    def register(self, digest: str, rows: list[dict[str, Any]], *, path: Path | None = None) -> None:
        norm_sha = digest.strip().lower()
        self.verified_digests.add(norm_sha)
        existing = self.by_digest.setdefault(norm_sha, [])
        if not existing:
            existing.extend(rows)
            self.all_rows.extend(rows)
        if path is not None:
            resolved = path.resolve()
            if resolved not in self.by_path:
                self.by_path[resolved] = list(rows)


def _decode_raw_retail_items(raw_bytes: bytes) -> list[dict[str, Any]]:
    """Decode meter rows from verbatim Retail API or Azure MCP pricing response bytes."""
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"Evidence response is not valid UTF-8: {exc}") from exc
    if text.encode("utf-8") != raw_bytes:
        raise ValueError("Evidence UTF-8 round-trip byte mismatch")

    value: Any = json.loads(text)
    if isinstance(value, list):
        return [dict(x) for x in value if isinstance(x, Mapping)]

    for _ in range(6):
        if not isinstance(value, Mapping):
            raise ValueError("Unsupported pricing response structure")
        if value.get("isError") or value.get("error"):
            raise ValueError("Pricing response envelope reports an error")
        if isinstance(value.get("Items"), list):
            return [dict(x) for x in value["Items"] if isinstance(x, Mapping)]
        if isinstance(value.get("prices"), list):
            return [dict(x) for x in value["prices"] if isinstance(x, Mapping)]
        if "results" in value:
            value = value["results"]
            continue
        if "result" in value:
            value = value["result"]
            continue
        content = value.get("content")
        if isinstance(content, list):
            text_parts = [p for p in content if isinstance(p, Mapping) and p.get("type") == "text"]
            if len(text_parts) != 1 or len(content) != 1 or not isinstance(text_parts[0].get("text"), str):
                raise ValueError("Ambiguous MCP content wrapper in pricing evidence")
            value = json.loads(text_parts[0]["text"])
            continue
        break
    raise ValueError("Pricing evidence JSON contains no 'Items' or 'prices' meter array")


def _canonical_meter_row_sha256(row: Mapping[str, Any]) -> str | None:
    """Compute canonical normalized-meter SHA-256 matching `tools/scripts/_lib/pricing-evidence.mjs`."""
    normalized: dict[str, Any] = dict(row)
    normalized["armRegionName"] = (
        row.get("armRegionName") if row.get("armRegionName") is not None else row.get("region")
    )
    normalized["type"] = row.get("type") if row.get("type") is not None else row.get("priceType")
    uom = str(row.get("unitOfMeasure") or "")
    if normalized.get("tierMinimumUnits") is None and re.match(r"^(1\s*/?\s*)?hours?$", uom, re.IGNORECASE):
        normalized["tierMinimumUnits"] = None

    base: dict[str, Any] = {}
    for field_name in _CANONICAL_METER_FIELDS:
        val = normalized.get(field_name)
        if field_name in ("retailPrice", "tierMinimumUnits"):
            if (
                field_name == "tierMinimumUnits"
                and val is None
                and re.match(r"^(1\s*/?\s*)?hours?$", uom, re.IGNORECASE)
            ):
                base[field_name] = None
                continue
            if not _is_finite_number(val) or float(val) < 0:
                return None
            # Match JavaScript JSON.stringify number formatting for integral floats such as 0.0 -> 0
            fval = float(val)
            base[field_name] = int(fval) if fval.is_integer() else val
        else:
            if not isinstance(val, str) or (not val and field_name not in ("armRegionName", "armSkuName")):
                return None
            base[field_name] = val

    if base["type"] == "Reservation":
        res_term = row.get("reservationTerm")
        if isinstance(res_term, str) and res_term.strip():
            base["reservationTerm"] = res_term.strip()

    stable_str = json.dumps(base, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256_bytes(stable_str.encode("utf-8"))


def _resolve_optional_evidence_file(raw_path: str, bundle_dir: Path, root: Path | None) -> Path | None:
    """Resolve a referenced evidence/ledger JSON path safely without following symlinks or escaping `root`."""
    cleaned = raw_path.strip()
    if not cleaned:
        return None
    rel_or_abs = Path(cleaned)
    if rel_or_abs.is_absolute():
        candidates = [rel_or_abs]
    else:
        candidates = [bundle_dir / rel_or_abs, Path.cwd() / rel_or_abs, REPO_ROOT_DIR / rel_or_abs]

    for candidate in candidates:
        try:
            if root is not None:
                resolved = ensure_within_root(candidate, root)
            else:
                if candidate.is_symlink():
                    raise ContainmentError(f"Refusing symlink evidence file: {candidate}")
                resolved = candidate.resolve()
        except ContainmentError:
            if candidate.is_symlink():
                raise
            continue
        if resolved.is_file():
            return resolved
    return None


def _declared_page_digests_on_mapping(node: Mapping[str, Any]) -> set[str]:
    found: set[str] = set()
    for sha_key in _PAGE_EVIDENCE_SHA_KEYS:
        val = node.get(sha_key)
        if _is_valid_sha256(val):
            found.add(str(val).strip().lower())
        elif isinstance(val, list) and val and all(_is_valid_sha256(x) for x in val):
            found.update(str(x).strip().lower() for x in val)
    return found


def _ingest_evidence_file(
    ev_file: Path,
    *,
    ctx: str,
    declared_digests: set[str],
    root: Path | None,
    catalog: _VerifiedEvidenceCatalog,
    _seen_files: set[Path],
) -> tuple[list[dict[str, Any]], set[str]]:
    """Read, SHA-256 verify, and decode meter rows from an evidence file on disk."""
    resolved_ev = ev_file.resolve()
    raw_bytes = resolved_ev.read_bytes()
    actual_file_sha = sha256_bytes(raw_bytes)

    try:
        parsed = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        catalog.errors.append(f"{ctx}: invalid UTF-8/JSON in evidence file {ev_file}: {exc}")
        return [], set()

    # Case 1: Canonical MCP wrapper (`pricing-response-evidence-v1`) referencing a `.raw` file
    if isinstance(parsed, Mapping) and parsed.get("schema_version") == "pricing-response-evidence-v1":
        if str(parsed.get("status") or "").upper() != "COMPLETE":
            catalog.errors.append(f"{ctx}: pricing-response-evidence-v1 status is not COMPLETE in {ev_file}")
            return [], set()
        raw_rel = parsed.get("raw_path")
        expected_resp_sha = str(parsed.get("response_sha256") or "").strip().lower()
        if not isinstance(raw_rel, str) or not raw_rel.strip() or not _is_valid_sha256(expected_resp_sha):
            catalog.errors.append(f"{ctx}: pricing-response-evidence-v1 missing raw_path or response_sha256")
            return [], set()
        resolved_raw = _resolve_optional_evidence_file(raw_rel, resolved_ev.parent, root)
        if resolved_raw is None:
            catalog.errors.append(f"{ctx}: raw MCP response file not found: {raw_rel!r}")
            return [], set()
        mcp_raw_bytes = resolved_raw.read_bytes()
        actual_raw_sha = sha256_bytes(mcp_raw_bytes)
        if actual_raw_sha != expected_resp_sha:
            catalog.errors.append(
                f"{ctx}: raw MCP evidence SHA-256 mismatch for {raw_rel!r} "
                f"(expected {expected_resp_sha}, actual {actual_raw_sha})"
            )
            return [], set()
        if declared_digests and not (declared_digests & {actual_raw_sha, actual_file_sha}):
            catalog.errors.append(
                f"{ctx}: declared digest {sorted(declared_digests)} does not match verified evidence ({actual_raw_sha})"
            )
            return [], set()
        try:
            rows = _decode_raw_retail_items(mcp_raw_bytes)
        except ValueError as exc:
            catalog.errors.append(f"{ctx}: invalid raw MCP response in {raw_rel!r}: {exc}")
            return [], set()
        catalog.register(actual_raw_sha, rows, path=resolved_ev)
        catalog.register(actual_file_sha, rows, path=resolved_raw)
        return rows, {actual_raw_sha, actual_file_sha}

    # Case 2: Multi-page evidence ledger (`retail-price-evidence-v1`, `pursuit-retail-fetch-ledger-v1`, etc.)
    if isinstance(parsed, Mapping) and isinstance(parsed.get("pages"), list):
        if resolved_ev in _seen_files:
            return catalog.by_path.get(resolved_ev, []), {actual_file_sha}
        _seen_files.add(resolved_ev)
        page_rows, page_shas = _ingest_pages_array(
            parsed["pages"],
            ctx=f"{ctx}({ev_file.name})",
            base_dir=resolved_ev.parent,
            root=root,
            catalog=catalog,
            _seen_files=_seen_files,
        )
        if not page_shas:
            return [], set()
        combined_sha = (
            page_shas[0]
            if len(page_shas) == 1
            else sha256_bytes(json.dumps(page_shas, separators=(",", ":")).encode("utf-8"))
        )
        wrapper_raw_sha = parsed.get("raw_evidence_sha256")
        if wrapper_raw_sha is not None and (
            not _is_valid_sha256(wrapper_raw_sha) or str(wrapper_raw_sha).strip().lower() != combined_sha
        ):
            catalog.errors.append(
                f"{ctx}: ledger raw_evidence_sha256={wrapper_raw_sha!r} mismatches verified page digest {combined_sha}"
            )
            return [], set()
        valid_shas = set(page_shas) | {combined_sha, actual_file_sha}
        if declared_digests and not (declared_digests & valid_shas):
            catalog.errors.append(
                f"{ctx}: declared digest {sorted(declared_digests)} does not match verified ledger digests"
            )
            return [], set()
        catalog.register(combined_sha, page_rows, path=resolved_ev)
        catalog.register(actual_file_sha, page_rows, path=resolved_ev)
        return page_rows, valid_shas

    # Case 3: Direct verbatim Retail API / MCP response JSON
    if declared_digests and actual_file_sha not in declared_digests:
        catalog.errors.append(
            f"{ctx}: raw evidence SHA-256 mismatch for {ev_file.name!r} "
            f"(expected {sorted(declared_digests)}, actual {actual_file_sha})"
        )
        return [], set()
    try:
        rows = _decode_raw_retail_items(raw_bytes)
    except ValueError as exc:
        catalog.errors.append(f"{ctx}: unable to decode Retail API meter rows from {ev_file.name!r}: {exc}")
        return [], set()

    catalog.register(actual_file_sha, rows, path=resolved_ev)
    return rows, {actual_file_sha}


def _ingest_pages_array(
    pages: Sequence[Any],
    *,
    ctx: str,
    base_dir: Path,
    root: Path | None,
    catalog: _VerifiedEvidenceCatalog,
    _seen_files: set[Path],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Verify every page in a `pages[]` array from persisted `evidence_path` or inline `raw_response` bytes."""
    if not pages:
        catalog.errors.append(f"{ctx}: pages[] array is empty")
        return [], []

    collected_rows: list[dict[str, Any]] = []
    ordered_page_shas: list[str] = []

    for p_idx, page in enumerate(pages):
        p_ctx = f"{ctx}.pages[{p_idx}]"
        if not isinstance(page, Mapping):
            catalog.errors.append(f"{p_ctx}: page entry must be an object")
            continue
        p_declared = _declared_page_digests_on_mapping(page)
        catalog.declared_digests.update(p_declared)

        raw_path_str = _first_non_empty_str(page.get("evidence_path"), page.get("raw_path"))
        if raw_path_str:
            resolved_p = _resolve_optional_evidence_file(raw_path_str, base_dir, root)
            if resolved_p is None:
                catalog.errors.append(f"{p_ctx}: referenced page evidence file not found: {raw_path_str!r}")
                continue
            p_rows, p_shas = _ingest_evidence_file(
                resolved_p,
                ctx=p_ctx,
                declared_digests=p_declared,
                root=root,
                catalog=catalog,
                _seen_files=_seen_files,
            )
            if p_shas:
                collected_rows.extend(p_rows)
                primary_sha = next(iter(p_declared & p_shas), next(iter(p_shas)))
                ordered_page_shas.append(primary_sha)
            continue

        raw_resp = page.get("raw_response")
        raw_b64 = page.get("raw_response_base64")
        if isinstance(raw_resp, str) or isinstance(raw_b64, str):
            try:
                if isinstance(raw_b64, str):
                    page_bytes = base64.b64decode(raw_b64, validate=True)
                    if isinstance(raw_resp, str) and page_bytes.decode("utf-8") != raw_resp:
                        catalog.errors.append(f"{p_ctx}: raw_response and raw_response_base64 mismatch")
                        continue
                else:
                    assert isinstance(raw_resp, str)
                    page_bytes = raw_resp.encode("utf-8")
            except (ValueError, UnicodeDecodeError) as exc:
                catalog.errors.append(f"{p_ctx}: invalid inline raw response encoding: {exc}")
                continue

            actual_sha = sha256_bytes(page_bytes)
            if not p_declared:
                catalog.errors.append(f"{p_ctx}: inline raw_response is missing response_sha256")
                continue
            if actual_sha not in p_declared:
                catalog.errors.append(
                    f"{p_ctx}: inline raw_response SHA-256 mismatch (expected {sorted(p_declared)}, actual {actual_sha})"
                )
                continue
            try:
                p_rows = _decode_raw_retail_items(page_bytes)
            except ValueError as exc:
                catalog.errors.append(f"{p_ctx}: invalid Retail API JSON in inline raw_response: {exc}")
                continue
            catalog.register(actual_sha, p_rows)
            collected_rows.extend(p_rows)
            ordered_page_shas.append(actual_sha)
            continue

        catalog.errors.append(
            f"{p_ctx}: missing persisted 'evidence_path' or verbatim 'raw_response' bytes to verify response_sha256"
        )

    return collected_rows, ordered_page_shas


def _ingest_evidence_node(
    node: Any,
    *,
    ctx: str,
    base_dir: Path,
    root: Path | None,
    catalog: _VerifiedEvidenceCatalog,
    _seen_files: set[Path],
    _depth: int = 0,
) -> None:
    """Recursively verify evidence references and populate `catalog` with hashed meter rows."""
    if _depth > 5 or node is None:
        return
    if _is_valid_sha256(node):
        catalog.declared_digests.add(str(node).strip().lower())
        return
    if isinstance(node, list):
        for idx, elem in enumerate(node):
            _ingest_evidence_node(
                elem,
                ctx=f"{ctx}[{idx}]",
                base_dir=base_dir,
                root=root,
                catalog=catalog,
                _seen_files=_seen_files,
                _depth=_depth + 1,
            )
        return
    if not isinstance(node, Mapping):
        return

    node_digests = _declared_page_digests_on_mapping(node)
    catalog.declared_digests.update(node_digests)

    # Collect explicit file locators on this evidence node
    path_refs: list[str] = []
    for path_key in ("evidence_path", "raw_path"):
        val = node.get(path_key)
        if isinstance(val, str) and val.strip():
            path_refs.append(val.strip())
    ev_paths_list = node.get("evidence_paths")
    if isinstance(ev_paths_list, list):
        for item in ev_paths_list:
            if isinstance(item, str) and item.strip() and item.strip() not in path_refs:
                path_refs.append(item.strip())

    if path_refs:
        multi_rows: list[dict[str, Any]] = []
        multi_shas: list[str] = []
        for ref_str in path_refs:
            resolved = _resolve_optional_evidence_file(ref_str, base_dir, root)
            if resolved is None:
                catalog.errors.append(f"{ctx}: referenced evidence file not found: {ref_str!r}")
                continue
            per_file_expected = node_digests if len(path_refs) == 1 else set()
            f_rows, f_shas = _ingest_evidence_file(
                resolved,
                ctx=ctx,
                declared_digests=per_file_expected,
                root=root,
                catalog=catalog,
                _seen_files=_seen_files,
            )
            if f_shas:
                multi_rows.extend(f_rows)
                multi_shas.append(next(iter(f_shas)))
        if len(path_refs) > 1 and len(multi_shas) == len(path_refs):
            combined = sha256_bytes(json.dumps(multi_shas, separators=(",", ":")).encode("utf-8"))
            if node_digests and not (node_digests & (set(multi_shas) | {combined})):
                catalog.errors.append(
                    f"{ctx}: declared digest {sorted(node_digests)} does not match multi-page evidence {combined}"
                )
            else:
                catalog.register(combined, multi_rows)
        return

    if isinstance(node.get("raw_response"), str) or isinstance(node.get("raw_response_base64"), str):
        _ingest_pages_array([node], ctx=ctx, base_dir=base_dir, root=root, catalog=catalog, _seen_files=_seen_files)
        return

    if isinstance(node.get("pages"), list):
        p_rows, p_shas = _ingest_pages_array(
            node["pages"],
            ctx=ctx,
            base_dir=base_dir,
            root=root,
            catalog=catalog,
            _seen_files=_seen_files,
        )
        if p_shas:
            combined = (
                p_shas[0]
                if len(p_shas) == 1
                else sha256_bytes(json.dumps(p_shas, separators=(",", ":")).encode("utf-8"))
            )
            if node_digests and not (node_digests & (set(p_shas) | {combined})):
                catalog.errors.append(
                    f"{ctx}: declared digest {sorted(node_digests)} mismatches verified pages digest {combined}"
                )
            else:
                catalog.register(combined, p_rows)
        return

    for child_key in ("entries", "items", "evidence_ref", "pricing_evidence", "evidence", "retail_api_evidence"):
        if child_key in node:
            _ingest_evidence_node(
                node[child_key],
                ctx=f"{ctx}.{child_key}",
                base_dir=base_dir,
                root=root,
                catalog=catalog,
                _seen_files=_seen_files,
                _depth=_depth + 1,
            )


def _build_verified_bundle_catalog(
    bundle: Mapping[str, Any],
    *,
    bundle_dir: Path,
    root: Path | None,
) -> _VerifiedEvidenceCatalog:
    """Verify all bundle-level and line-level evidence files/bytes and index their meter rows."""
    catalog = _VerifiedEvidenceCatalog()
    seen_files: set[Path] = set()

    catalog.declared_digests.update(_declared_page_digests_on_mapping(bundle))

    if isinstance(bundle.get("pages"), list):
        p_rows, p_shas = _ingest_pages_array(
            bundle["pages"],
            ctx="bundle",
            base_dir=bundle_dir,
            root=root,
            catalog=catalog,
            _seen_files=seen_files,
        )
        if p_shas:
            combined = (
                p_shas[0]
                if len(p_shas) == 1
                else sha256_bytes(json.dumps(p_shas, separators=(",", ":")).encode("utf-8"))
            )
            top_raw = bundle.get("raw_evidence_sha256")
            if top_raw is not None and (not _is_valid_sha256(top_raw) or str(top_raw).strip().lower() != combined):
                catalog.errors.append(
                    f"bundle: top-level raw_evidence_sha256={top_raw!r} mismatches verified pages digest {combined}"
                )
            else:
                catalog.register(combined, p_rows)

    for container_key in ("evidence", "pricing_evidence", "retail_api_evidence"):
        if container_key in bundle and bundle[container_key] is not None:
            # Avoid double-ingesting when `evidence` and `pages` are identical lists on pursuit-rate-evaluation-v1
            if container_key == "evidence" and bundle.get("pages") == bundle.get("evidence"):
                continue
            _ingest_evidence_node(
                bundle[container_key],
                ctx=f"bundle.{container_key}",
                base_dir=bundle_dir,
                root=root,
                catalog=catalog,
                _seen_files=seen_files,
            )

    # Also ingest any line-level / component-level evidence references
    for candidate_key in ("resources", "services", "lines", "items", "meters"):
        raw_lines = bundle.get(candidate_key)
        if not isinstance(raw_lines, list):
            continue
        for idx, line in enumerate(raw_lines):
            if not isinstance(line, Mapping):
                continue
            for ev_key in ("evidence_ref", "pricing_evidence", "evidence"):
                if ev_key in line:
                    _ingest_evidence_node(
                        line[ev_key],
                        ctx=f"line[{idx}].{ev_key}",
                        base_dir=bundle_dir,
                        root=root,
                        catalog=catalog,
                        _seen_files=seen_files,
                    )
            comps = None
            cb = line.get("calculation_basis")
            if isinstance(cb, Mapping) and isinstance(cb.get("components"), list):
                comps = cb["components"]
            elif isinstance(line.get("components"), list):
                comps = line["components"]
            if isinstance(comps, list):
                for c_idx, comp in enumerate(comps):
                    if isinstance(comp, Mapping):
                        for ev_key in ("evidence_ref", "pricing_evidence", "evidence"):
                            if ev_key in comp:
                                _ingest_evidence_node(
                                    comp[ev_key],
                                    ctx=f"line[{idx}].components[{c_idx}].{ev_key}",
                                    base_dir=bundle_dir,
                                    root=root,
                                    catalog=catalog,
                                    _seen_files=seen_files,
                                )

    for unverified_sha in sorted(catalog.declared_digests - catalog.verified_digests):
        catalog.errors.append(
            f"Unverified evidence digest {unverified_sha}: no captured raw response file or verbatim response bytes "
            "were found to recompute SHA-256 and verify meter selection"
        )

    return catalog


def _has_free_tier_justification(target: Mapping[str, Any], parent: Mapping[str, Any] | None = None) -> bool:
    """Verify whether a `$0` rate has explicit free-tier justification and zero placeholder markers."""
    sources = [target] if parent is None else [target, parent]

    combined_text_parts: list[str] = []
    for obj in sources:
        for text_key in ("notes", "reason", "zero_rate_justification", "free_tier_reason", "status"):
            val = obj.get(text_key)
            if isinstance(val, str) and val.strip():
                combined_text_parts.append(val)
    combined_text = " ".join(combined_text_parts)
    if _PLACEHOLDER_TOKEN_RE.search(combined_text):
        return False

    for obj in sources:
        if obj.get("free_tier_justified") is True or obj.get("is_free_tier") is True:
            return True
        justification = obj.get("zero_rate_justification") or obj.get("free_tier_reason")
        if isinstance(justification, str) and justification.strip():
            return True
        free_grant = obj.get("free_grant_units")
        if _is_finite_number(free_grant) and float(free_grant) > 0:
            return True

    return bool(_FREE_TIER_JUSTIFICATION_RE.search(combined_text))


def _as_mapping(value: Any) -> Mapping[str, Any]:
    """Return `value` when it is a `Mapping`, otherwise an empty dict."""
    return value if isinstance(value, Mapping) else {}


def _resolve_selected_meter(unit: Mapping[str, Any], parent: Mapping[str, Any] | None = None) -> Mapping[str, Any]:
    """Extract nested `selected_meter` metadata from `unit`, its `calculation_basis`, or `parent`."""
    raw_sm = _as_mapping(unit.get("selected_meter"))
    if raw_sm:
        return raw_sm
    unit_cb_sm = _as_mapping(_as_mapping(unit.get("calculation_basis")).get("selected_meter"))
    if unit_cb_sm:
        return unit_cb_sm
    if parent is not None:
        parent_sm = _as_mapping(parent.get("selected_meter"))
        if parent_sm:
            return parent_sm
        parent_cb_sm = _as_mapping(_as_mapping(parent.get("calculation_basis")).get("selected_meter"))
        if parent_cb_sm:
            return parent_cb_sm
    return {}


def _first_non_empty_str(*values: Any) -> str:
    """Return the first stripped non-empty string among `values`, or `""`."""
    for val in values:
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _rates_equal(a: Any, b: Any) -> bool:
    if not _is_finite_number(a) or not _is_finite_number(b):
        return False
    return abs(Decimal(str(a)) - Decimal(str(b))) <= Decimal("1e-9")


def _extract_unit_evidence_bindings(
    unit: Mapping[str, Any],
    selected_meter: Mapping[str, Any],
    calc_basis: Mapping[str, Any],
    parent: Mapping[str, Any] | None,
    *,
    bundle_dir: Path | None,
    root: Path | None,
) -> tuple[set[str], list[Path], list[str], list[str]]:
    """Collect `(page_digests, resolved_files, row_sha256s, binding_errors)` for a priced unit."""
    page_digests: set[str] = set()
    resolved_files: list[Path] = []
    row_shas: list[str] = []
    binding_errors: list[str] = []

    def _scan_ev_obj(obj: Any, *, depth: int = 0) -> None:
        if depth > 3 or not isinstance(obj, Mapping):
            return
        for sha_k in _PAGE_EVIDENCE_SHA_KEYS:
            val = obj.get(sha_k)
            if _is_valid_sha256(val):
                page_digests.add(str(val).strip().lower())
            elif isinstance(val, list) and val and all(_is_valid_sha256(x) for x in val):
                page_digests.update(str(x).strip().lower() for x in val)

        raw_row_sha = obj.get("row_sha256")
        if _is_valid_sha256(raw_row_sha):
            row_shas.append(str(raw_row_sha).strip().lower())
        elif isinstance(raw_row_sha, list):
            for item in raw_row_sha:
                if _is_valid_sha256(item):
                    row_shas.append(str(item).strip().lower())
                else:
                    binding_errors.append(f"invalid non-64-hex row_sha256 entry {item!r}")

        if bundle_dir is not None:
            path_vals: list[str] = []
            for p_k in ("evidence_path", "raw_path"):
                pv = obj.get(p_k)
                if isinstance(pv, str) and pv.strip():
                    path_vals.append(pv.strip())
            ev_list = obj.get("evidence_paths")
            if isinstance(ev_list, list):
                for pv in ev_list:
                    if isinstance(pv, str) and pv.strip() and pv.strip() not in path_vals:
                        path_vals.append(pv.strip())
            for pv in path_vals:
                res_f = _resolve_optional_evidence_file(pv, bundle_dir, root)
                if res_f is not None and res_f.resolve() not in resolved_files:
                    resolved_files.append(res_f.resolve())

        for sub_k in ("evidence_ref", "pricing_evidence", "evidence", "pages"):
            if sub_k in obj:
                sub_v = obj[sub_k]
                if isinstance(sub_v, list):
                    for elem in sub_v:
                        if _is_valid_sha256(elem):
                            page_digests.add(str(elem).strip().lower())
                        else:
                            _scan_ev_obj(elem, depth=depth + 1)
                else:
                    _scan_ev_obj(sub_v, depth=depth + 1)

    for src in (unit, selected_meter, calc_basis, parent):
        if isinstance(src, Mapping):
            _scan_ev_obj(src)

    return page_digests, resolved_files, row_shas, binding_errors


def _verify_unit_meter_against_catalog(
    *,
    label: str,
    unit: Mapping[str, Any],
    selected_meter: Mapping[str, Any],
    calc_basis: Mapping[str, Any],
    parent: Mapping[str, Any] | None,
    meter_id: str,
    arm_sku: str,
    meter_name: str,
    arm_region: str,
    declared_rate: float | None,
    tier_list: Any,
    allow_devtest: bool,
    bundle_dir: Path | None,
    root: Path | None,
    catalog: _VerifiedEvidenceCatalog,
) -> list[str]:
    """Verify that a priced unit's evidence digest, meter identity, and rate match verified raw response rows."""
    errs: list[str] = []
    line_digests, line_files, row_shas, bind_errs = _extract_unit_evidence_bindings(
        unit,
        selected_meter,
        calc_basis,
        parent,
        bundle_dir=bundle_dir,
        root=root,
    )
    for b_err in bind_errs:
        errs.append(f"{label}: {b_err}")

    unverified_line_shas = sorted(line_digests - catalog.verified_digests)
    if unverified_line_shas:
        errs.append(f"{label}: evidence digest(s) {unverified_line_shas} lack verified raw response bytes")
        return errs

    candidate_rows: list[dict[str, Any]] = []
    if line_files:
        for fpath in line_files:
            candidate_rows.extend(catalog.by_path.get(fpath, []))
    elif line_digests:
        for d in sorted(line_digests):
            candidate_rows.extend(catalog.by_digest.get(d, []))
    else:
        if not catalog.verified_digests or not catalog.all_rows:
            errs.append(
                f"{label}: missing verified raw-response pricing evidence "
                "(hash strings without captured response bytes do not satisfy validation)"
            )
            return errs
        candidate_rows = list(catalog.all_rows)

    if not candidate_rows:
        errs.append(f"{label}: referenced pricing evidence contains zero decoded meter rows")
        return errs

    if row_shas:
        by_row_sha: dict[str, list[dict[str, Any]]] = {}
        for r in candidate_rows:
            r_digest = _canonical_meter_row_sha256(r)
            if r_digest is not None:
                by_row_sha.setdefault(r_digest, []).append(r)
        missing_r_shas = [rs for rs in row_shas if rs not in by_row_sha]
        if missing_r_shas:
            errs.append(f"{label}: row_sha256 {missing_r_shas} not found in referenced raw pricing evidence")
            return errs
        narrowed: list[dict[str, Any]] = []
        for rs in row_shas:
            narrowed.extend(by_row_sha[rs])
        candidate_rows = narrowed

    explicit_arm_sku = _first_non_empty_str(
        selected_meter.get("armSkuName"),
        selected_meter.get("arm_sku_name"),
        unit.get("armSkuName"),
        unit.get("arm_sku_name"),
        calc_basis.get("armSkuName"),
    )
    declared_price_type = _first_non_empty_str(
        selected_meter.get("priceType"),
        selected_meter.get("price_type"),
        selected_meter.get("type"),
        unit.get("priceType"),
        unit.get("price_type"),
        unit.get("type"),
        calc_basis.get("priceType"),
        calc_basis.get("price_type"),
        calc_basis.get("type"),
    )
    unit_commitment = _as_mapping(unit.get("commitment")) or _as_mapping(parent.get("commitment") if parent else None)
    declared_res_term = _first_non_empty_str(
        selected_meter.get("reservationTerm"),
        selected_meter.get("reservation_term"),
        unit.get("reservationTerm"),
        unit.get("reservation_term"),
        unit_commitment.get("reservationTerm"),
        unit_commitment.get("term") if declared_price_type.lower() == "reservation" else None,
    )
    is_savings_plan_rate = declared_price_type.lower() in {
        "savingsplan",
        "computesavingsplan",
        "savings_plan",
        "compute_savings_plan",
    }
    declared_sp_term = _first_non_empty_str(
        unit.get("savingsPlanTerm"),
        unit.get("savings_plan_term"),
        unit_commitment.get("term") if is_savings_plan_rate else None,
    )

    matched_rows: list[dict[str, Any]] = []
    for row in candidate_rows:
        row_type = str(row.get("type") or row.get("priceType") or "").strip()
        if not allow_devtest and row_type.lower() == "devtestconsumption":
            continue
        if meter_id and str(row.get("meterId") or "").strip() != meter_id:
            continue
        row_arm_sku = str(row.get("armSkuName") or "").strip()
        row_sku_name = str(row.get("skuName") or "").strip()
        if explicit_arm_sku:
            if row_arm_sku.lower() != explicit_arm_sku.lower():
                continue
        elif arm_sku and arm_sku.lower() not in {row_arm_sku.lower(), row_sku_name.lower()}:
            continue
        if meter_name and str(row.get("meterName") or "").strip().lower() != meter_name.lower():
            continue
        if arm_region:
            row_region = str(row.get("armRegionName") or row.get("region") or "").strip().lower()
            if row_region != arm_region.lower():
                continue
        if is_savings_plan_rate:
            if row_type.lower() != "consumption":
                continue
        elif declared_price_type and row_type.lower() != declared_price_type.lower():
            continue
        if (
            declared_price_type.lower() == "reservation"
            and declared_res_term
            and str(row.get("reservationTerm") or "").strip().lower() != declared_res_term.lower()
        ):
            continue
        matched_rows.append(row)

    if not matched_rows:
        errs.append(
            f"{label}: selected meter (meterId={meter_id or 'n/a'!r}, sku={arm_sku or 'n/a'!r}, "
            f"meterName={meter_name or 'n/a'!r}, region={arm_region or 'n/a'!r}, "
            f"priceType={declared_price_type or 'n/a'!r}) not found in verified raw pricing evidence"
        )
        return errs

    # Verify scalar rate against matched evidenced meter rows
    if declared_rate is not None:
        if is_savings_plan_rate:
            sp_matched = False
            for row in matched_rows:
                sp_list = row.get("savingsPlan")
                if not isinstance(sp_list, list):
                    continue
                for sp_item in sp_list:
                    if not isinstance(sp_item, Mapping):
                        continue
                    if declared_sp_term and str(sp_item.get("term") or "").strip().lower() != declared_sp_term.lower():
                        continue
                    if _rates_equal(sp_item.get("retailPrice"), declared_rate):
                        sp_matched = True
                        break
                if sp_matched:
                    break
            if not sp_matched:
                errs.append(
                    f"{label}: declared Savings Plan rate {declared_rate} does not match any evidenced "
                    "savingsPlan retailPrice on the matched Consumption meter"
                )
        else:
            if not any(_rates_equal(r.get("retailPrice"), declared_rate) for r in matched_rows):
                evidenced_rates = [r.get("retailPrice") for r in matched_rows[:5]]
                errs.append(
                    f"{label}: declared rate {declared_rate} does not match evidenced Retail API "
                    f"retailPrice {evidenced_rates} for the selected meter"
                )

    # Also verify selected_meter.retailPrice if unit and selected_meter both carry rates
    sm_rate = selected_meter.get("retailPrice", selected_meter.get("retail_price"))
    if (
        sm_rate is not None
        and _is_finite_number(sm_rate)
        and not is_savings_plan_rate
        and not any(_rates_equal(r.get("retailPrice"), float(sm_rate)) for r in matched_rows)
    ):
        evidenced_rates = [r.get("retailPrice") for r in matched_rows[:5]]
        errs.append(
            f"{label}: selected_meter retailPrice {sm_rate} does not match evidenced Retail API "
            f"retailPrice {evidenced_rates}"
        )

    # Verify progressive tier bands against evidenced rows when tiers are declared
    if isinstance(tier_list, list) and len(tier_list) > 0:
        for t_idx, band in enumerate(tier_list):
            if not isinstance(band, Mapping):
                continue
            b_min = band.get("tierMinimumUnits", band.get("tier_minimum_units", 0.0 if len(tier_list) == 1 else None))
            b_rate = band.get("retailPrice", band.get("retail_price", band.get("unitPrice")))
            if not _is_finite_number(b_min) or not _is_finite_number(b_rate):
                continue
            band_ok = any(
                _rates_equal(r.get("tierMinimumUnits") if r.get("tierMinimumUnits") is not None else 0.0, b_min)
                and _rates_equal(r.get("retailPrice"), b_rate)
                for r in matched_rows
            )
            if not band_ok:
                errs.append(
                    f"{label}: tier band #{t_idx} (tierMinimumUnits={b_min}, retailPrice={b_rate}) "
                    "does not match verified Retail API evidence rows"
                )

    return errs


def _validate_single_priced_unit(
    unit: Mapping[str, Any],
    label: str,
    catalog: _VerifiedEvidenceCatalog,
    parent: Mapping[str, Any] | None = None,
    *,
    allow_devtest: bool = False,
    bundle_dir: Path | None = None,
    root: Path | None = None,
) -> list[str]:
    """Validate meter identity, region, priceType, rate/free-tier rules, and verified evidence binding on one unit."""
    errors: list[str] = []
    calc_basis = _as_mapping(unit.get("calculation_basis"))
    selected_meter = _resolve_selected_meter(unit, parent)

    line_status = _first_non_empty_str(
        unit.get("status"),
        selected_meter.get("status"),
        parent.get("status") if parent else None,
    ).upper()
    if line_status in {"UNRESOLVED", "FAILED", "PLACEHOLDER", "TBD", "PENDING", "PARTIAL"}:
        errors.append(f"{label}: invalid line status {line_status!r}")

    for source_obj in (unit, selected_meter):
        for text_field in ("sku", "skuName", "sku_name", "armSkuName", "arm_sku_name", "meterName", "meter_name"):
            raw_val = source_obj.get(text_field)
            if isinstance(raw_val, str) and _PLACEHOLDER_TOKEN_RE.search(raw_val):
                errors.append(f"{label}: placeholder/unresolved marker found in {text_field}={raw_val!r}")

    if not allow_devtest:
        price_type_candidates: list[Any] = [
            unit.get("priceType"),
            unit.get("price_type"),
            unit.get("type"),
            selected_meter.get("priceType"),
            selected_meter.get("price_type"),
            selected_meter.get("type"),
            calc_basis.get("priceType"),
            calc_basis.get("price_type"),
            calc_basis.get("type"),
        ]
        unit_commitment = unit.get("commitment")
        if isinstance(unit_commitment, Mapping):
            price_type_candidates.extend([unit_commitment.get("priceType"), unit_commitment.get("price_type")])
        selected_meters_list = unit.get("selected_meters")
        if isinstance(selected_meters_list, list):
            for sm_entry in selected_meters_list:
                if isinstance(sm_entry, Mapping):
                    price_type_candidates.extend(
                        [sm_entry.get("priceType"), sm_entry.get("price_type"), sm_entry.get("type")]
                    )
        if parent is not None:
            price_type_candidates.extend([parent.get("priceType"), parent.get("price_type"), parent.get("type")])
            parent_commitment = parent.get("commitment")
            if isinstance(parent_commitment, Mapping):
                price_type_candidates.extend([parent_commitment.get("priceType"), parent_commitment.get("price_type")])
        if any(isinstance(pt, str) and pt.strip().lower() == "devtestconsumption" for pt in price_type_candidates):
            errors.append(f"{label}: DevTestConsumption meter is forbidden unless allow_devtest=True")

    meter_id = _first_non_empty_str(
        unit.get("meterId"),
        unit.get("meter_id"),
        selected_meter.get("meterId"),
        selected_meter.get("meter_id"),
        calc_basis.get("meterId"),
        calc_basis.get("meter_id"),
    )
    arm_sku = _first_non_empty_str(
        unit.get("armSkuName"),
        unit.get("arm_sku_name"),
        selected_meter.get("armSkuName"),
        selected_meter.get("arm_sku_name"),
        unit.get("skuName"),
        unit.get("sku_name"),
        selected_meter.get("skuName"),
        selected_meter.get("sku_name"),
        unit.get("sku"),
        calc_basis.get("armSkuName"),
        calc_basis.get("sku"),
        parent.get("armSkuName") if parent else None,
        parent.get("skuName") if parent else None,
        parent.get("sku") if parent else None,
    )
    meter_name = _first_non_empty_str(
        unit.get("meterName"),
        unit.get("meter_name"),
        selected_meter.get("meterName"),
        selected_meter.get("meter_name"),
        calc_basis.get("meterName"),
        calc_basis.get("meter_name"),
        parent.get("meterName") if parent else None,
        parent.get("meter_name") if parent else None,
    )

    if not meter_id and not (arm_sku and meter_name):
        errors.append(f"{label}: requires non-empty 'meterId' or both 'armSkuName' and 'meterName'")

    arm_region = _first_non_empty_str(
        unit.get("armRegionName"),
        unit.get("arm_region_name"),
        unit.get("billing_region"),
        unit.get("region"),
        selected_meter.get("armRegionName"),
        selected_meter.get("arm_region_name"),
        selected_meter.get("billing_region"),
        selected_meter.get("region"),
        calc_basis.get("armRegionName"),
        calc_basis.get("billing_region"),
        calc_basis.get("region"),
        parent.get("armRegionName") if parent else None,
        parent.get("arm_region_name") if parent else None,
        parent.get("billing_region") if parent else None,
        parent.get("region") if parent else None,
    )
    if not arm_region or _PLACEHOLDER_TOKEN_RE.search(arm_region) or arm_region.lower() in {"unknown", "unspecified"}:
        errors.append(f"{label}: requires non-empty valid 'armRegionName' (or 'billing_region'/'region')")

    tier_list: Any = None
    for tier_source in (unit, selected_meter, calc_basis):
        if "tier_bands" in tier_source and tier_source.get("tier_bands") is not None:
            tier_list = tier_source.get("tier_bands")
            break
        if "tiers" in tier_source and tier_source.get("tiers") is not None:
            tier_list = tier_source.get("tiers")
            break

    rate_present = False
    numeric_declared_rate: float | None = None
    for rate_source in (unit, selected_meter, calc_basis):
        for rate_key in ("retailPrice", "retail_price", "unitPrice", "unit_price", "rate"):
            if rate_key in rate_source and rate_source.get(rate_key) is not None:
                rate_present = True
                raw_rate = rate_source[rate_key]
                if isinstance(raw_rate, str) or not _is_finite_number(raw_rate):
                    errors.append(f"{label}: non-numeric or placeholder rate {rate_key}={raw_rate!r}")
                elif float(raw_rate) < 0:
                    errors.append(f"{label}: negative rate {rate_key}={raw_rate}")
                else:
                    numeric_declared_rate = float(raw_rate)
                    if numeric_declared_rate == 0.0:
                        has_paid_higher_tier = isinstance(tier_list, list) and any(
                            isinstance(t, Mapping)
                            and _is_finite_number(t_rate := t.get("retailPrice", t.get("retail_price")))
                            and float(t_rate) > 0
                            for t in tier_list
                        )
                        justified = _has_free_tier_justification(unit, parent) or _has_free_tier_justification(
                            selected_meter, unit
                        )
                        if not has_paid_higher_tier and not justified:
                            errors.append(
                                f"{label}: $0 rate lacks explicit free-tier justification "
                                "(unresolved/placeholder rates may not masquerade as 0)"
                            )
                break
        if rate_present:
            break

    if not rate_present:
        if isinstance(tier_list, list) and len(tier_list) > 0:
            try:
                compute_tiered_cost(tier_list, 0.0)
            except MeterResolutionError as exc:
                errors.append(f"{label}: invalid tier bands ({exc})")
            all_zero = all(
                isinstance(t, Mapping)
                and _is_finite_number(t_rate := t.get("retailPrice", t.get("retail_price")))
                and float(t_rate) == 0.0
                for t in tier_list
            )
            justified = _has_free_tier_justification(unit, parent) or _has_free_tier_justification(selected_meter, unit)
            if all_zero and not justified:
                errors.append(f"{label}: all-zero tier bands lack explicit free-tier justification")
        else:
            errors.append(f"{label}: missing unit rate ('retailPrice'/'unitPrice'/'rate') or 'tier_bands'/'tiers'")

    for cost_key in ("monthly_cost", "computed_cost"):
        if cost_key in unit and unit[cost_key] is not None:
            c_val = unit[cost_key]
            if not _is_finite_number(c_val) or float(c_val) < 0:
                errors.append(f"{label}: invalid {cost_key}={c_val!r}")
            elif float(c_val) == 0.0 and not _has_free_tier_justification(unit, parent):
                errors.append(f"{label}: {cost_key}=0.0 lacks explicit free-tier justification")

    errors.extend(
        _verify_unit_meter_against_catalog(
            label=label,
            unit=unit,
            selected_meter=selected_meter,
            calc_basis=calc_basis,
            parent=parent,
            meter_id=meter_id,
            arm_sku=arm_sku,
            meter_name=meter_name,
            arm_region=arm_region,
            declared_rate=numeric_declared_rate,
            tier_list=tier_list,
            allow_devtest=allow_devtest,
            bundle_dir=bundle_dir,
            root=root,
            catalog=catalog,
        )
    )

    return errors


def _audit_bundle_line_skus(
    line: Mapping[str, Any],
    components: Sequence[Any] | None,
    deprecations: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Audit distinct `(service, sku)` pairs declared on a priced bundle line and its components."""
    line_sm = _as_mapping(line.get("selected_meter"))
    calc_basis = _as_mapping(line.get("calculation_basis"))
    cb_sm = _as_mapping(calc_basis.get("selected_meter"))

    line_service = _first_non_empty_str(
        line.get("service_name"),
        line.get("serviceName"),
        line.get("service"),
        line_sm.get("serviceName"),
        line_sm.get("service_name"),
        line_sm.get("service"),
        calc_basis.get("service_name"),
        calc_basis.get("serviceName"),
        calc_basis.get("service"),
        cb_sm.get("serviceName"),
        cb_sm.get("service_name"),
        line.get("productName"),
        line.get("product_name"),
        line_sm.get("productName"),
    )
    line_region_str = _first_non_empty_str(
        line.get("armRegionName"),
        line.get("arm_region_name"),
        line.get("billing_region"),
        line.get("region"),
        line_sm.get("armRegionName"),
        line_sm.get("billing_region"),
        line_sm.get("region"),
    )
    line_region = line_region_str or None

    source_tuples: list[tuple[Mapping[str, Any], str, str | None]] = [
        (line, line_service, line_region),
        (line_sm, line_service, line_region),
        (calc_basis, line_service, line_region),
        (cb_sm, line_service, line_region),
    ]
    if components is not None:
        for comp in components:
            if not isinstance(comp, Mapping):
                continue
            comp_sm = _as_mapping(comp.get("selected_meter"))
            comp_service = _first_non_empty_str(
                comp.get("service_name"),
                comp.get("serviceName"),
                comp.get("service"),
                comp_sm.get("serviceName"),
                comp_sm.get("service_name"),
                line_service,
                comp.get("productName"),
                comp.get("product_name"),
            )
            comp_region = (
                _first_non_empty_str(
                    comp.get("armRegionName"),
                    comp.get("arm_region_name"),
                    comp.get("billing_region"),
                    comp.get("region"),
                    comp_sm.get("armRegionName"),
                    comp_sm.get("billing_region"),
                )
                or line_region
            )
            source_tuples.append((comp, comp_service, comp_region))
            source_tuples.append((comp_sm, comp_service, comp_region))

    seen_pairs: set[tuple[str, str]] = set()
    audits: list[dict[str, Any]] = []
    for src_map, svc, reg in source_tuples:
        if not src_map:
            continue
        for sku_key in ("armSkuName", "arm_sku_name", "skuName", "sku_name", "sku"):
            raw_sku = src_map.get(sku_key)
            if not isinstance(raw_sku, str) or not raw_sku.strip():
                continue
            sku_str = raw_sku.strip()
            pair_key = (_normalize_token(svc), _normalize_token(sku_str))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)
            audits.append(
                audit_single_sku(
                    sku_str,
                    service=svc,
                    region=reg,
                    deprecations=deprecations,
                )
            )
    return audits


def _run_canonical_cost_estimate_validator(
    resolved_bundle: Path,
    resolved_request: Path,
    bundle: Mapping[str, Any],
) -> list[str]:
    """Delegate canonical request/evidence validation to `tools/scripts/cost-estimate.mjs` when requested."""
    node_bin = shutil.which("node")
    script_path = REPO_ROOT_DIR / "tools" / "scripts" / "cost-estimate.mjs"
    if node_bin is None or not script_path.is_file():
        return ["Canonical validator unavailable: 'node' or 'tools/scripts/cost-estimate.mjs' not found"]

    is_quote = (
        str(bundle.get("schema_version") or "").strip() == "retail-rate-quote-v1"
        or str(bundle.get("purpose") or "").strip() == "rate-quote"
    )
    subcmd = "validate-quote" if is_quote else "validate"
    proc = subprocess.run(
        [node_bin, str(script_path), subcmd, "--input", str(resolved_bundle), "--request", str(resolved_request)],
        cwd=str(REPO_ROOT_DIR),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if proc.returncode == 0:
        return []
    for raw_out in (proc.stdout, proc.stderr):
        if not raw_out.strip():
            continue
        try:
            parsed = json.loads(raw_out)
            if isinstance(parsed, Mapping) and isinstance(parsed.get("errors"), list):
                return [f"cost-estimate.mjs: {e}" for e in parsed["errors"]]
        except json.JSONDecodeError:
            pass
    msg = (proc.stderr or proc.stdout).strip() or f"exit code {proc.returncode}"
    return [f"cost-estimate.mjs {subcmd} failed: {msg}"]


def validate_pricing_bundle(
    bundle_path: Path,
    *,
    root: Path | None = None,
    request_path: Path | None = None,
    deprecations_file: Path | None = DEFAULT_DEPRECATIONS_FILE,
    allow_devtest: bool = False,
    report_only: bool = False,
) -> dict[str, Any]:
    """Validate a pursuit pricing bundle (`cost-estimate-v2`, `retail-rate-quote-v1`, or rate ledger)."""
    if root is not None:
        resolved_path = ensure_within_root(bundle_path, root)
    else:
        if bundle_path.is_symlink():
            raise ContainmentError(f"Refusing to validate symlink bundle: {bundle_path}")
        resolved_path = bundle_path.resolve()

    resolved_request: Path | None = None
    if request_path is not None:
        if root is not None:
            resolved_request = ensure_within_root(request_path, root)
        else:
            if request_path.is_symlink():
                raise ContainmentError(f"Refusing to validate symlink request file: {request_path}")
            resolved_request = request_path.resolve()

    deprecations: list[dict[str, Any]] = []
    if deprecations_file is not None:
        deprecations = _load_deprecations_catalog(deprecations_file)

    if not resolved_path.is_file():
        return {
            "ok": False,
            "bundle_path": str(bundle_path),
            "checked_lines": 0,
            "errors": [f"Bundle file not found: {bundle_path}"],
        }

    try:
        bundle = json.loads(resolved_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return {
            "ok": False,
            "bundle_path": str(bundle_path),
            "checked_lines": 0,
            "errors": [f"Invalid JSON in {bundle_path}: {exc}"],
        }

    if not isinstance(bundle, Mapping):
        return {
            "ok": False,
            "bundle_path": str(bundle_path),
            "checked_lines": 0,
            "errors": ["Pricing bundle root must be a JSON object"],
        }

    errors: list[str] = []
    warnings: list[str] = []
    sku_audit_results: list[dict[str, Any]] = []

    if resolved_request is not None:
        if not resolved_request.is_file():
            errors.append(f"Request file not found: {request_path}")
        else:
            errors.extend(_run_canonical_cost_estimate_validator(resolved_path, resolved_request, bundle))

    status = bundle.get("status")
    if status is not None and str(status).strip().upper() not in {"COMPLETE", "RESOLVED"}:
        errors.append(f"Bundle top-level status is {status!r}; expected 'COMPLETE' or 'RESOLVED'")

    unresolved = bundle.get("unresolved_items")
    if isinstance(unresolved, list) and len(unresolved) > 0:
        errors.append(f"Bundle contains {len(unresolved)} unresolved_items entry(ies)")

    bundle_dir = resolved_path.parent
    evidence_catalog = _build_verified_bundle_catalog(bundle, bundle_dir=bundle_dir, root=root)
    errors.extend(evidence_catalog.errors)

    raw_lines: list[Any] | None = None
    for candidate_key in ("resources", "services", "lines", "items", "meters"):
        if isinstance(bundle.get(candidate_key), list):
            raw_lines = bundle[candidate_key]
            break

    if raw_lines is None or len(raw_lines) == 0:
        errors.append(
            "Bundle contains zero priced lines (expected non-empty 'resources', 'services', 'lines', 'items', or 'meters')"
        )
        return {
            "ok": False,
            "bundle_path": str(bundle_path),
            "checked_lines": 0,
            "errors": errors,
        }

    checked_units = 0
    for idx, line in enumerate(raw_lines):
        if not isinstance(line, Mapping):
            errors.append(f"line[{idx}]: must be a JSON object")
            continue
        line_sm = _resolve_selected_meter(line)
        line_name = _first_non_empty_str(
            line.get("name"),
            line.get("meterName"),
            line_sm.get("meterName"),
            line.get("armSkuName"),
            line_sm.get("armSkuName"),
            line.get("sku"),
            f"line[{idx}]",
        )

        calc_basis = line.get("calculation_basis")
        components: list[Any] | None = None
        if (
            isinstance(calc_basis, Mapping)
            and isinstance(calc_basis.get("components"), list)
            and calc_basis["components"]
        ):
            components = calc_basis["components"]
        elif isinstance(line.get("components"), list) and line["components"]:
            components = line["components"]

        if components is not None:
            if "monthly_cost" in line and line["monthly_cost"] is not None:
                m_cost = line["monthly_cost"]
                if not _is_finite_number(m_cost) or float(m_cost) < 0:
                    errors.append(f"{line_name}: invalid monthly_cost={m_cost!r}")
                elif float(m_cost) == 0.0 and not _has_free_tier_justification(line):
                    errors.append(f"{line_name}: monthly_cost=0.0 lacks explicit free-tier justification")
            for c_idx, comp in enumerate(components):
                if not isinstance(comp, Mapping):
                    errors.append(f"{line_name}.components[{c_idx}]: must be an object")
                    continue
                checked_units += 1
                errors.extend(
                    _validate_single_priced_unit(
                        comp,
                        f"{line_name}.components[{c_idx}]",
                        evidence_catalog,
                        parent=line,
                        allow_devtest=allow_devtest,
                        bundle_dir=bundle_dir,
                        root=root,
                    )
                )
        else:
            checked_units += 1
            errors.extend(
                _validate_single_priced_unit(
                    line,
                    line_name,
                    evidence_catalog,
                    allow_devtest=allow_devtest,
                    bundle_dir=bundle_dir,
                    root=root,
                )
            )

        for sku_res in _audit_bundle_line_skus(line, components, deprecations):
            sku_audit_results.append({"line": line_name, **sku_res})
            is_retired_or_sunset = sku_res["retirement_status"] == "RETIRED_OR_DEPRECATED" or bool(
                sku_res.get("sunset_date")
            )
            if is_retired_or_sunset:
                sunset_part = f" (sunset: {sku_res['sunset_date']})" if sku_res.get("sunset_date") else ""
                replacement_part = f"; replacement: {sku_res['replacement']}" if sku_res.get("replacement") else ""
                msg = (
                    f"{line_name}: retired/sunset SKU {sku_res['sku']!r} "
                    f"for service {sku_res['service'] or 'unspecified'!r}{sunset_part}{replacement_part}"
                )
                if report_only:
                    warnings.append(msg)
                else:
                    errors.append(msg)
            elif sku_res["retirement_status"] == "PURSUIT_TRAP_ADVISORY":
                replacement_part = f"; consider {sku_res['replacement']}" if sku_res.get("replacement") else ""
                warnings.append(
                    f"{line_name}: advisory pursuit-trap SKU {sku_res['sku']!r} "
                    f"for service {sku_res['service'] or 'unspecified'!r}{replacement_part}"
                )

    return {
        "ok": len(errors) == 0,
        "bundle_path": str(bundle_path),
        "checked_lines": checked_units,
        "sku_audit": sku_audit_results,
        "warnings": warnings,
        "errors": errors,
    }


def _load_deprecations_catalog(deprecations_file: Path) -> list[dict[str, Any]]:
    """Load repository `azure-deprecations.json` entries."""
    if deprecations_file.is_symlink():
        raise ContainmentError(f"Refusing symlink deprecations file: {deprecations_file}")
    if not deprecations_file.is_file():
        raise FileNotFoundError(f"Deprecations catalog not found: {deprecations_file}")
    payload = json.loads(deprecations_file.read_text(encoding="utf-8"))
    if not isinstance(payload, Mapping) or not isinstance(payload.get("deprecations"), list):
        raise ValueError(f"Malformed deprecations JSON in {deprecations_file}")
    return [dict(item) for item in payload["deprecations"] if isinstance(item, Mapping)]


def _parse_sku_candidates(sku_input_path: Path, *, root: Path | None = None) -> list[dict[str, Any]]:
    """Load candidate SKUs from JSON (`sku-manifest.json`, array, or object) or CSV."""
    if root is not None:
        resolved = ensure_within_root(sku_input_path, root)
    else:
        if sku_input_path.is_symlink():
            raise ContainmentError(f"Refusing symlink SKU input file: {sku_input_path}")
        resolved = sku_input_path.resolve()

    if not resolved.is_file():
        raise FileNotFoundError(f"Candidate SKU file not found: {sku_input_path}")

    raw_text = resolved.read_text(encoding="utf-8-sig")
    suffix = resolved.suffix.lower()

    if suffix == ".csv":
        reader = csv.DictReader(io.StringIO(raw_text))
        candidates: list[dict[str, Any]] = []
        for row in reader:
            norm = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
            sku_val = norm.get("sku") or norm.get("armskuname") or norm.get("arm_sku_name") or norm.get("size") or ""
            svc_val = norm.get("service") or norm.get("service_name") or norm.get("servicename") or ""
            reg_val = norm.get("region") or norm.get("armregionname") or norm.get("arm_region_name") or None
            ver_ga = norm.get("verified_regional_ga", "").lower() in {"true", "1", "yes"}
            ver_src = norm.get("verified_source") or None
            if sku_val or svc_val:
                candidates.append(
                    {
                        "service": svc_val,
                        "sku": sku_val,
                        "region": reg_val,
                        "verified_regional_ga": ver_ga if ver_src else False,
                        "verified_source": ver_src,
                    }
                )
        return candidates

    parsed = json.loads(raw_text)
    raw_list: list[Any]
    if isinstance(parsed, list):
        raw_list = parsed
    elif isinstance(parsed, Mapping):
        if isinstance(parsed.get("services"), list):
            expanded: list[dict[str, Any]] = []
            for svc in parsed["services"]:
                if not isinstance(svc, Mapping):
                    continue
                svc_name = str(svc.get("service") or svc.get("resource_type") or svc.get("name") or "").strip()
                sku_val = str(svc.get("size") or svc.get("sku") or svc.get("tier") or "").strip()
                regions = svc.get("regions")
                if isinstance(regions, list) and regions:
                    for reg in regions:
                        expanded.append({"service": svc_name, "sku": sku_val, "region": str(reg).strip()})
                else:
                    expanded.append({"service": svc_name, "sku": sku_val, "region": svc.get("region")})
            return expanded
        for key in ("skus", "candidates", "resources", "items"):
            if isinstance(parsed.get(key), list):
                raw_list = parsed[key]
                break
        else:
            raise ValueError(f"Unrecognized JSON SKU container in {sku_input_path}")
    else:
        raise ValueError(f"Unsupported JSON root in {sku_input_path}")

    normalized_items: list[dict[str, Any]] = []
    for entry in raw_list:
        if isinstance(entry, str):
            normalized_items.append({"service": "", "sku": entry.strip(), "region": None})
        elif isinstance(entry, Mapping):
            svc_val = str(entry.get("service") or entry.get("service_name") or entry.get("serviceName") or "").strip()
            sku_val = str(
                entry.get("sku") or entry.get("armSkuName") or entry.get("arm_sku_name") or entry.get("size") or ""
            ).strip()
            reg_raw = entry.get("region") or entry.get("armRegionName") or entry.get("arm_region_name")
            reg_val = str(reg_raw).strip() if isinstance(reg_raw, str) and reg_raw.strip() else None
            ver_src_raw = entry.get("verified_source")
            ver_src = str(ver_src_raw).strip() if isinstance(ver_src_raw, str) and ver_src_raw.strip() else None
            ver_ga = bool(entry.get("verified_regional_ga") is True and ver_src)
            ver_unavail = bool(entry.get("verified_regional_ga") is False and ver_src)
            normalized_items.append(
                {
                    "service": svc_val,
                    "sku": sku_val,
                    "region": reg_val,
                    "verified_regional_ga": ver_ga,
                    "verified_regional_unavailable": ver_unavail,
                    "verified_source": ver_src,
                }
            )
    return normalized_items


def _normalize_token(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def audit_single_sku(
    sku: str,
    *,
    service: str = "",
    region: str | None = None,
    deprecations: Sequence[Mapping[str, Any]] = (),
    verified_regional_ga: bool = False,
    verified_regional_unavailable: bool = False,
    verified_source: str | None = None,
) -> dict[str, Any]:
    """Audit one candidate SKU against `azure-deprecations.json` and `CURATED_PURSUIT_RETIREMENTS`."""
    norm_svc = _normalize_token(service)
    norm_sku = _normalize_token(sku)

    dep_match: Mapping[str, Any] | None = None
    for dep in deprecations:
        dep_svc = _normalize_token(str(dep.get("service") or ""))
        dep_sku = _normalize_token(str(dep.get("sku") or ""))
        svc_ok = not norm_svc or norm_svc in dep_svc or dep_svc in norm_svc
        sku_ok = norm_sku == dep_sku or (
            dep_sku.endswith("(legacy)") and norm_sku == dep_sku.removesuffix("(legacy)").strip()
        )
        if svc_ok and sku_ok:
            dep_match = dep
            break

    curated_match: Mapping[str, Any] | None = None
    for rule in CURATED_PURSUIT_RETIREMENTS:
        if "azure managed redis" in norm_svc and rule["id"] == "redis-cache-legacy-tiers":
            continue
        svc_re = re.compile(str(rule["service_pattern"]), re.IGNORECASE)
        sku_re = re.compile(str(rule["sku_pattern"]), re.IGNORECASE)
        if svc_re.search(norm_svc) and sku_re.search(norm_sku):
            curated_match = rule
            break

    flagged = dep_match is not None or curated_match is not None
    retirement_status = "NO_KNOWN_RETIREMENT_IN_LOCAL_CATALOG"
    replacement: str | None = None
    sunset_date: str | None = None
    notes: str | None = None
    matched_source: str | None = None

    if dep_match is not None and curated_match is not None:
        matched_source = "both"
        retirement_status = "RETIRED_OR_DEPRECATED"
        replacement = str(dep_match.get("replacement") or curated_match.get("replacement") or "")
        sunset_date = dep_match.get("sunsetDate") or curated_match.get("sunset_date")
        notes = str(curated_match.get("notes") or dep_match.get("notes") or "")
    elif dep_match is not None:
        matched_source = "azure-deprecations.json"
        retirement_status = "RETIRED_OR_DEPRECATED"
        replacement = str(dep_match.get("replacement") or "") or None
        sunset_date = dep_match.get("sunsetDate")
        notes = str(dep_match.get("notes") or "") or None
    elif curated_match is not None:
        matched_source = "CURATED_PURSUIT_RETIREMENTS"
        retirement_status = str(curated_match["retirement_status"])
        replacement = str(curated_match.get("replacement") or "") or None
        sunset_date = curated_match.get("sunset_date")
        notes = str(curated_match.get("notes") or "") or None

    if verified_regional_unavailable and verified_source:
        regional_ga_status = "VERIFIED_UNAVAILABLE"
    elif verified_regional_ga and verified_source:
        regional_ga_status = "VERIFIED_AVAILABLE"
    else:
        regional_ga_status = UNVERIFIED_REGIONAL_GA_STATUS

    return {
        "service": service or (str(curated_match["service"]) if curated_match else ""),
        "sku": sku,
        "region": region,
        "flagged": flagged,
        "retirement_status": retirement_status,
        "regional_ga_status": regional_ga_status,
        "replacement": replacement,
        "sunset_date": sunset_date,
        "matched_source": matched_source,
        "verified_source": verified_source if (verified_regional_ga or verified_regional_unavailable) else None,
        "notes": notes,
    }


def audit_candidate_skus(
    candidates_or_path: Path | Sequence[Mapping[str, Any] | str],
    *,
    deprecations_file: Path = DEFAULT_DEPRECATIONS_FILE,
    verified_availability_file: Path | None = None,
    default_region: str | None = None,
    root: Path | None = None,
) -> dict[str, Any]:
    """Audit candidate SKUs against `azure-deprecations.json` and `CURATED_PURSUIT_RETIREMENTS`."""
    deprecations = _load_deprecations_catalog(deprecations_file)

    verified_lookup: dict[tuple[str, str, str], tuple[bool, str]] = {}
    if verified_availability_file is not None:
        ver_path = (
            ensure_within_root(verified_availability_file, root)
            if root is not None
            else verified_availability_file.resolve()
        )
        ver_data = json.loads(ver_path.read_text(encoding="utf-8"))
        entries = ver_data.get("entries", ver_data) if isinstance(ver_data, Mapping) else ver_data
        if isinstance(entries, list):
            for item in entries:
                if not isinstance(item, Mapping):
                    continue
                src = str(item.get("verified_source") or item.get("source") or "").strip()
                if not src or not isinstance(item.get("available"), bool):
                    continue
                k = (
                    _normalize_token(str(item.get("service") or "")),
                    _normalize_token(str(item.get("sku") or "")),
                    _normalize_token(str(item.get("region") or "")),
                )
                verified_lookup[k] = (bool(item["available"]), src)

    if isinstance(candidates_or_path, Path):
        parsed_candidates = _parse_sku_candidates(candidates_or_path, root=root)
    else:
        parsed_candidates = []
        for item in candidates_or_path:
            if isinstance(item, str):
                parsed_candidates.append({"service": "", "sku": item, "region": default_region})
            elif isinstance(item, Mapping):
                parsed_candidates.append(
                    {
                        "service": str(item.get("service") or item.get("service_name") or ""),
                        "sku": str(item.get("sku") or item.get("armSkuName") or item.get("size") or ""),
                        "region": item.get("region") or default_region,
                        "verified_regional_ga": bool(
                            item.get("verified_regional_ga") is True and item.get("verified_source")
                        ),
                        "verified_regional_unavailable": bool(
                            item.get("verified_regional_ga") is False and item.get("verified_source")
                        ),
                        "verified_source": item.get("verified_source"),
                    }
                )

    results: list[dict[str, Any]] = []
    for cand in parsed_candidates:
        svc = str(cand.get("service") or "")
        sku = str(cand.get("sku") or "")
        reg = cand.get("region") if cand.get("region") is not None else default_region
        ver_ga = bool(cand.get("verified_regional_ga", False))
        ver_unavail = bool(cand.get("verified_regional_unavailable", False))
        ver_src = cand.get("verified_source")

        lookup_key = (_normalize_token(svc), _normalize_token(sku), _normalize_token(str(reg or "")))
        if lookup_key in verified_lookup:
            avail_bool, src_str = verified_lookup[lookup_key]
            ver_ga = avail_bool
            ver_unavail = not avail_bool
            ver_src = src_str

        results.append(
            audit_single_sku(
                sku,
                service=svc,
                region=reg,
                deprecations=deprecations,
                verified_regional_ga=ver_ga,
                verified_regional_unavailable=ver_unavail,
                verified_source=ver_src,
            )
        )

    retired_count = sum(1 for r in results if r["retirement_status"] == "RETIRED_OR_DEPRECATED")
    advisory_count = sum(1 for r in results if r["retirement_status"] == "PURSUIT_TRAP_ADVISORY")
    flagged_count = sum(1 for r in results if r["flagged"])
    unverified_ga_count = sum(1 for r in results if r["regional_ga_status"] == UNVERIFIED_REGIONAL_GA_STATUS)

    return {
        "schema_version": "pursuit-sku-audit-v1",
        "deprecations_file": str(deprecations_file),
        "total_audited": len(results),
        "flagged_count": flagged_count,
        "retired_count": retired_count,
        "advisory_count": advisory_count,
        "unverified_regional_ga_count": unverified_ga_count,
        "results": results,
    }


def build_arg_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser for `audit_pursuit_skus_and_rates.py`."""
    parser = argparse.ArgumentParser(
        prog="audit_pursuit_skus_and_rates.py",
        description=(
            "Validate pursuit pricing bundles, evaluate supplemental Retail API meter responses "
            "(Reservations, Compute Savings Plans, tiered meters), and audit candidate SKUs for "
            "retirements and regional GA verification (for example in swedencentral or germanywestcentral)."
        ),
    )
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument(
        "--validate-bundle",
        type=Path,
        default=None,
        help="Validate an existing pricing bundle JSON (cost-estimate-v2, retail-rate-quote-v1, or ledger).",
    )
    mode_group.add_argument(
        "--evaluate-retail-json",
        type=Path,
        default=None,
        help="Evaluate a recorded Retail Prices API JSON file and fail closed on missing/ambiguous meters.",
    )
    mode_group.add_argument(
        "--fetch-filter",
        type=str,
        default=None,
        help=(
            "Live OData $filter query for https://prices.azure.com/api/retail/prices "
            "(for example, \"armRegionName eq 'swedencentral' and armSkuName eq 'Standard_D4s_v5'\")."
        ),
    )
    mode_group.add_argument(
        "--audit-skus",
        type=Path,
        default=None,
        help="Audit candidate SKUs from JSON or CSV against azure-deprecations.json and pursuit retirement traps.",
    )

    parser.add_argument("--root", type=Path, default=None, help="Optional containment root directory.")
    parser.add_argument("--out", type=Path, default=None, help="Optional JSON output path for evaluation/ledger/audit.")
    parser.add_argument(
        "--evidence-dir",
        type=Path,
        default=None,
        help="Directory to persist verbatim Retail API response pages during --fetch-filter.",
    )
    parser.add_argument(
        "--request",
        type=Path,
        default=None,
        help="Optional original pricing request JSON for canonical cost-estimate.mjs bundle validation.",
    )
    parser.add_argument("--region", type=str, default=None, help="Target ARM region (for example, swedencentral).")
    parser.add_argument("--service-name", type=str, default=None, help="Exact Retail API serviceName filter.")
    parser.add_argument("--arm-sku-name", type=str, default=None, help="Exact Retail API armSkuName filter.")
    parser.add_argument("--sku-name", type=str, default=None, help="Exact Retail API skuName filter.")
    parser.add_argument("--product-name", type=str, default=None, help="Exact Retail API productName filter.")
    parser.add_argument("--meter-name", type=str, default=None, help="Exact Retail API meterName filter.")
    parser.add_argument("--quantity", type=float, default=None, help="Raw usage quantity for progressive tier math.")
    parser.add_argument("--currency", type=str, default="USD", help="Billing currency code (default: USD).")
    parser.add_argument(
        "--allow-devtest",
        action="store_true",
        help="Include DevTestConsumption meters (excluded by default).",
    )
    parser.add_argument(
        "--allow-spot",
        action="store_true",
        help="Include Spot compute meters (excluded by default unless requested).",
    )
    parser.add_argument(
        "--allow-global-region",
        action="store_true",
        help="Allow Global, empty-region, or Zone 1 billing meters alongside --region.",
    )
    parser.add_argument(
        "--allow-non-primary-meter",
        action="store_true",
        help="Allow rows where isPrimaryMeterRegion is false.",
    )
    parser.add_argument(
        "--deprecations-file",
        type=Path,
        default=DEFAULT_DEPRECATIONS_FILE,
        help="Path to azure-deprecations.json (defaults to .github/data/azure-deprecations.json).",
    )
    parser.add_argument(
        "--verified-availability",
        type=Path,
        default=None,
        help="Optional JSON file documenting verified regional SKU availability.",
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Exit 0 on --audit-skus or --validate-bundle SKU retirement checks when retired SKUs are flagged.",
    )
    return parser


def _write_or_print_json(data: Mapping[str, Any], out_path: Path | None, *, root: Path | None = None) -> None:
    rendered = json.dumps(data, indent=2) + "\n"
    if out_path is not None:
        target = ensure_within_root(out_path, root) if root is not None else out_path
        if target.is_symlink():
            raise ContainmentError(f"Refusing to write to symlink output path: {out_path}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point returning 0 on pass, 1 on validation/resolution/retirement failure, 2 on ContainmentError."""
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    try:
        if args.validate_bundle is not None:
            report = validate_pricing_bundle(
                args.validate_bundle,
                root=args.root,
                request_path=args.request,
                deprecations_file=args.deprecations_file,
                allow_devtest=args.allow_devtest,
                report_only=args.report_only,
            )
            _write_or_print_json(report, args.out, root=args.root)
            return 0 if report["ok"] else 1

        if args.evaluate_retail_json is not None:
            json_path = (
                ensure_within_root(args.evaluate_retail_json, args.root)
                if args.root is not None
                else args.evaluate_retail_json
            )
            if json_path.is_symlink():
                raise ContainmentError(f"Refusing symlink input: {args.evaluate_retail_json}")
            raw_sha = sha256_file(json_path)
            payload = json.loads(json_path.read_text(encoding="utf-8"))
            mtime_iso = datetime.fromtimestamp(json_path.stat().st_mtime, UTC).isoformat().replace("+00:00", "Z")
            if args.out is not None and json_path.resolve().is_relative_to(args.out.resolve().parent):
                ev_locator = json_path.resolve().relative_to(args.out.resolve().parent).as_posix()
            else:
                ev_locator = json_path.resolve().as_posix()
            default_pages = (
                None
                if (isinstance(payload, Mapping) and isinstance(payload.get("pages"), list))
                else [
                    {
                        "page_index": 0,
                        "evidence_path": ev_locator,
                        "retrieved_at": mtime_iso,
                        "response_sha256": raw_sha,
                    }
                ]
            )
            try:
                eval_result = evaluate_retail_meters(
                    payload,
                    raw_evidence_sha256=raw_sha,
                    evidence_pages=default_pages,
                    retrieved_at=mtime_iso,
                    region=args.region,
                    service_name=args.service_name,
                    arm_sku_name=args.arm_sku_name,
                    sku_name=args.sku_name,
                    product_name=args.product_name,
                    meter_name=args.meter_name,
                    quantity=args.quantity,
                    currency_code=args.currency,
                    allow_devtest=args.allow_devtest,
                    allow_spot=args.allow_spot,
                    allow_global_region=args.allow_global_region,
                    require_primary_meter_region=not args.allow_non_primary_meter,
                )
            except MeterResolutionError as exc:
                unresolved_payload = {
                    "schema_version": "pursuit-rate-evaluation-v1",
                    "status": exc.status,
                    "raw_evidence_sha256": raw_sha,
                    "retrieved_at": mtime_iso,
                    "evidence": default_pages or [],
                    "error": str(exc),
                }
                _write_or_print_json(unresolved_payload, args.out, root=args.root)
                return 1
            _write_or_print_json(eval_result, args.out, root=args.root)
            return 0

        if args.fetch_filter is not None:
            effective_ev_dir = args.evidence_dir
            if effective_ev_dir is None:
                if args.out is not None:
                    effective_ev_dir = args.out.parent / "pricing-evidence"
                elif args.root is not None:
                    effective_ev_dir = args.root / "_meta" / "pricing-evidence"
                else:
                    effective_ev_dir = Path.cwd() / "pricing-evidence"
            rel_base = args.out.parent if args.out is not None else (args.root if args.root is not None else Path.cwd())
            fetched: dict[str, Any] | None = None
            try:
                fetched = fetch_retail_prices(
                    args.fetch_filter,
                    currency_code=args.currency,
                    evidence_dir=effective_ev_dir,
                    relative_to_dir=rel_base,
                    root=args.root,
                )
                eval_result = evaluate_retail_meters(
                    fetched,
                    raw_evidence_sha256=fetched["raw_evidence_sha256"],
                    evidence_pages=fetched["pages"],
                    retrieved_at=fetched["retrieved_at"],
                    region=args.region,
                    service_name=args.service_name,
                    arm_sku_name=args.arm_sku_name,
                    sku_name=args.sku_name,
                    product_name=args.product_name,
                    meter_name=args.meter_name,
                    quantity=args.quantity,
                    currency_code=args.currency,
                    allow_devtest=args.allow_devtest,
                    allow_spot=args.allow_spot,
                    allow_global_region=args.allow_global_region,
                    require_primary_meter_region=not args.allow_non_primary_meter,
                )
                ledger_output = {
                    **eval_result,
                    "filter": fetched["filter"],
                    "retrieved_at": fetched["retrieved_at"],
                    "page_count": fetched["page_count"],
                    "total_items": fetched["total_items"],
                    "pages": fetched["pages"],
                    "evidence": fetched["pages"],
                }
            except MeterResolutionError as exc:
                unresolved_payload = {
                    "schema_version": "pursuit-rate-evaluation-v1",
                    "status": exc.status,
                    "filter": args.fetch_filter,
                    "error": str(exc),
                }
                if fetched is not None:
                    unresolved_payload["raw_evidence_sha256"] = fetched["raw_evidence_sha256"]
                    unresolved_payload["retrieved_at"] = fetched["retrieved_at"]
                    unresolved_payload["pages"] = fetched["pages"]
                _write_or_print_json(unresolved_payload, args.out, root=args.root)
                return 1
            _write_or_print_json(ledger_output, args.out, root=args.root)
            return 0

        if args.audit_skus is not None:
            audit_report = audit_candidate_skus(
                args.audit_skus,
                deprecations_file=args.deprecations_file,
                verified_availability_file=args.verified_availability,
                default_region=args.region,
                root=args.root,
            )
            _write_or_print_json(audit_report, args.out, root=args.root)
            has_failures = audit_report["flagged_count"] > 0 or any(
                r["regional_ga_status"] == "VERIFIED_UNAVAILABLE" for r in audit_report["results"]
            )
            return 0 if (args.report_only or not has_failures) else 1

        return 1
    except ContainmentError as exc:
        print(f"CONTAINMENT_ERROR: {exc}", file=sys.stderr)
        return 2
    except (FileNotFoundError, ValueError, json.JSONDecodeError, OSError) as exc:
        print(f"AUDIT_ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
