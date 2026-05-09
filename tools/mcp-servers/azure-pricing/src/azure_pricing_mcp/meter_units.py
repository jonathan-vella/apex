"""Meter unit normalization + cost projection (v5.3).

Why this exists
---------------
The Azure Retail Prices API returns multiple meters per SKU, each with its own
``unitOfMeasure`` string. v5.0–v5.2 of the bulk-estimate logic naively picked
the first hit and multiplied ``retailPrice × 730`` (assuming hourly billing),
which produced absurdly wrong numbers when the first meter was a per-GB or
per-Day rate.

This module normalizes the ``unitOfMeasure`` string into a structured
``MeterUnit`` and computes a correct ``monthly_cost`` from the meter +
caller-supplied usage assumptions.

Examples of unit strings seen in the wild
-----------------------------------------
* ``"1 Hour"`` → hourly compute
* ``"1/Day"`` → daily flat fee (e.g. ACR Premium $1.6666/day → $50.65/mo)
* ``"1 GB/Month"`` → storage-overage meter (do NOT multiply by 730)
* ``"100 Hours"`` → 100-hour bundle
* ``"10K"`` → per 10,000 transactions
* ``"1M"`` → per 1,000,000 operations
* ``"1 Second"`` → ACR build-task seconds
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

HOURS_PER_MONTH = 730.0
DAYS_PER_MONTH = 30.4375  # 365.25 / 12


class MeterDimension(StrEnum):
    """The billing dimension a meter measures.

    Values are deliberately the same strings the Azure Retail Prices API
    embeds in ``unitOfMeasure`` so callers can switch on this directly.
    """

    HOUR = "hour"
    DAY = "day"
    MONTH = "month"
    SECOND = "second"
    GB_MONTH = "gb_month"  # Storage / data retention rate
    GB = "gb"  # Egress / one-shot data transfer
    TRANSACTIONS = "transactions"  # 10K / 100K / 1M ops
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class MeterUnit:
    """Parsed ``unitOfMeasure`` string."""

    raw: str
    quantity: float
    dimension: MeterDimension

    @property
    def is_time_based(self) -> bool:
        return self.dimension in {MeterDimension.HOUR, MeterDimension.DAY, MeterDimension.MONTH, MeterDimension.SECOND}


_TRANSACTION_PATTERN = re.compile(r"^\s*(\d+)\s*([KMB])\s*$", re.IGNORECASE)


def parse_unit_of_measure(raw: str | None) -> MeterUnit:
    """Parse the Azure ``unitOfMeasure`` string into a structured ``MeterUnit``.

    Returns ``MeterUnit(raw, 1.0, MeterDimension.UNKNOWN)`` for unrecognised
    strings — callers should treat that as "do not project; flag for human
    review".
    """
    if not raw:
        return MeterUnit(raw=raw or "", quantity=1.0, dimension=MeterDimension.UNKNOWN)

    s = raw.strip()
    lowered = s.lower()

    # GB-month (storage retention)
    if "gb/month" in lowered or "gb / month" in lowered:
        m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*", s)
        qty = float(m.group(1)) if m else 1.0
        return MeterUnit(raw=raw, quantity=qty, dimension=MeterDimension.GB_MONTH)

    # Per-GB egress / one-shot
    if lowered.endswith(" gb") or lowered.endswith("/gb"):
        m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*GB\s*$", s, re.IGNORECASE)
        qty = float(m.group(1)) if m else 1.0
        return MeterUnit(raw=raw, quantity=qty, dimension=MeterDimension.GB)

    # Time-based meters
    if "hour" in lowered:
        m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*hour", s, re.IGNORECASE)
        qty = float(m.group(1)) if m else 1.0
        return MeterUnit(raw=raw, quantity=qty, dimension=MeterDimension.HOUR)

    if "day" in lowered:
        # Forms: "1/Day", "1 Day", "Per Day"
        m = re.match(r"^\s*(\d+(?:\.\d+)?)", s)
        qty = float(m.group(1)) if m else 1.0
        return MeterUnit(raw=raw, quantity=qty, dimension=MeterDimension.DAY)

    if "month" in lowered:
        m = re.match(r"^\s*(\d+(?:\.\d+)?)", s)
        qty = float(m.group(1)) if m else 1.0
        return MeterUnit(raw=raw, quantity=qty, dimension=MeterDimension.MONTH)

    if "second" in lowered:
        m = re.match(r"^\s*(\d+(?:\.\d+)?)", s)
        qty = float(m.group(1)) if m else 1.0
        return MeterUnit(raw=raw, quantity=qty, dimension=MeterDimension.SECOND)

    # Transaction bundles: "10K", "100K", "1M", "1B"
    tm = _TRANSACTION_PATTERN.match(s)
    if tm:
        n = float(tm.group(1))
        suffix = tm.group(2).upper()
        multiplier = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}[suffix]
        return MeterUnit(raw=raw, quantity=n * multiplier, dimension=MeterDimension.TRANSACTIONS)

    return MeterUnit(raw=raw, quantity=1.0, dimension=MeterDimension.UNKNOWN)


# ─── Meter selection ────────────────────────────────────────────────────


def is_compute_meter(unit: MeterUnit) -> bool:
    """Heuristic: meter looks like a compute/runtime billing dimension."""
    return unit.dimension in {MeterDimension.HOUR, MeterDimension.DAY, MeterDimension.MONTH}


def select_primary_meter(
    items: list[dict[str, Any]],
    *,
    requested_sku: str | None = None,
) -> dict[str, Any] | None:
    """Pick the most likely primary billing meter from a search-results list.

    The default Azure Retail Prices ordering is unstable and frequently puts
    storage-overage meters (``1 GB/Month``) first. This heuristic prefers
    time-based meters (Hour > Day > Month) over GB-Month over Second over
    transactions over unknown.

    When ``requested_sku`` is provided, items whose ``skuName`` matches it
    *exactly* (case-insensitive) are preferred over items whose ``skuName``
    only contains the requested substring. This prevents picking a more
    expensive variant when the user passed a generic SKU name like
    ``"Standard"`` and the API also returned ``"Standard B1"`` etc.

    Returns ``None`` if the input list is empty.
    """
    if not items:
        return None

    requested_lower = requested_sku.lower().strip() if requested_sku else None

    def rank(item: dict[str, Any]) -> tuple[int, int, float]:
        unit = parse_unit_of_measure(item.get("unitOfMeasure"))
        if unit.dimension == MeterDimension.HOUR:
            dimension_rank = 0
        elif unit.dimension == MeterDimension.DAY:
            dimension_rank = 1
        elif unit.dimension == MeterDimension.MONTH:
            dimension_rank = 2
        elif unit.dimension == MeterDimension.GB_MONTH:
            dimension_rank = 4
        elif unit.dimension == MeterDimension.GB:
            dimension_rank = 5
        elif unit.dimension == MeterDimension.TRANSACTIONS:
            dimension_rank = 6
        elif unit.dimension == MeterDimension.SECOND:
            dimension_rank = 3
        else:
            dimension_rank = 9

        # SKU-name match precedes dimension. This prevents picking an
        # expensive Managed HSM `1 Hour` meter over a cheaper Key Vault
        # `1 Rotation` meter when the user asked for Key Vault Standard.
        # 0 = exact skuName match against ``requested_sku``;
        # 1 = different skuName containing the requested string.
        sku_match_rank = 1
        if requested_lower:
            item_sku = (item.get("skuName") or "").lower().strip()
            if item_sku == requested_lower:
                sku_match_rank = 0

        # Tie-breaker: higher non-zero price first within the same
        # (sku-match, dimension) bucket — this surfaces the actual SKU rate
        # over add-on overage meters at $0.0001.
        price = -float(item.get("retailPrice", 0) or 0)
        return (sku_match_rank, dimension_rank, price)

    return min(items, key=rank)


def project_monthly_cost(
    item: dict[str, Any],
    *,
    hours_per_month: float = HOURS_PER_MONTH,
    days_per_month: float = DAYS_PER_MONTH,
) -> tuple[float, MeterUnit, str | None]:
    """Project a meter to a monthly cost.

    Returns ``(monthly_cost, parsed_unit, warning)`` where ``warning`` is None
    when the projection is reliable. For ``GB_MONTH`` / ``GB`` / ``TRANSACTIONS``
    / ``UNKNOWN`` meters we emit ``$0.0`` and a human-readable warning so the
    caller (cost-estimate-subagent) can flag the line item rather than fabricate
    a number.
    """
    unit = parse_unit_of_measure(item.get("unitOfMeasure"))
    rate = float(item.get("retailPrice", 0) or 0)

    if unit.dimension == MeterDimension.HOUR:
        return rate * hours_per_month / unit.quantity, unit, None
    if unit.dimension == MeterDimension.DAY:
        return rate * days_per_month / unit.quantity, unit, None
    if unit.dimension == MeterDimension.MONTH:
        return rate / unit.quantity, unit, None

    if unit.dimension == MeterDimension.SECOND:
        # 1 second of compute → 730h * 3600s/h. Most SECOND meters in this
        # API are build-task / runtime adders ($0.0001/sec), not the primary
        # compute meter — refuse to project blindly.
        return (
            0.0,
            unit,
            (
                "Per-second meter cannot be projected without a runtime estimate; "
                "supply a usage estimate via azure_cost_estimate or document at $0."
            ),
        )

    if unit.dimension == MeterDimension.GB_MONTH:
        return (
            0.0,
            unit,
            (
                f"Per-GB/month storage meter (${rate}/{unit.raw}) — supply a storage "
                "volume estimate; not projected as compute."
            ),
        )
    if unit.dimension == MeterDimension.GB:
        return (
            0.0,
            unit,
            (
                f"Per-GB transfer meter (${rate}/{unit.raw}) — supply a transfer "
                "volume estimate; not projected as compute."
            ),
        )
    if unit.dimension == MeterDimension.TRANSACTIONS:
        return (
            0.0,
            unit,
            (f"Per-transaction meter (${rate}/{unit.raw}) — supply an ops/month estimate; not projected as compute."),
        )

    return 0.0, unit, f"Unrecognised unitOfMeasure '{unit.raw}'; refusing to project."
