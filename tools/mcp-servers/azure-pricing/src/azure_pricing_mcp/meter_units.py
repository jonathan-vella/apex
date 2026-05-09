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
    usage: dict[str, float] | None = None,
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

    v5.4 — when ``usage`` is provided with one of the workload keys
    (``transactions_per_month``, ``gb_stored``, ``gb_transferred``,
    ``seconds_runtime``), meters whose dimension matches a *supplied* usage
    key are promoted to the top of the dimension ranking. This prevents
    selecting a per-GB/month storage meter when the caller actually supplied
    transaction counts. Additionally, tie-breaks switch from descending price
    (which v5.3 used to surface the "actual" SKU rate over $0.0001 add-ons)
    to *ascending* price within the matching dimension, because the cheapest
    matching meter is usually the typical baseline rate (e.g. Key Vault
    operations at $0.03/10K vs renewals at $0.15/10K).

    Returns ``None`` if the input list is empty.
    """
    if not items:
        return None

    requested_lower = requested_sku.lower().strip() if requested_sku else None

    # v5.4 — Map of MeterDimension → usage key. Used to score whether a
    # meter's dimension matches a supplied usage param.
    dimension_to_usage = {
        MeterDimension.TRANSACTIONS: "transactions_per_month",
        MeterDimension.GB_MONTH: "gb_stored",
        MeterDimension.GB: "gb_transferred",
        MeterDimension.SECOND: "seconds_runtime",
    }
    usage = usage or {}
    usage_priorities: set[MeterDimension] = {
        dim for dim, key in dimension_to_usage.items() if usage.get(key) is not None
    }

    def rank(item: dict[str, Any]) -> tuple[int, int, int, float]:
        unit = parse_unit_of_measure(item.get("unitOfMeasure"))

        # v5.4 — prefer a dimension that has a matching usage param
        # (e.g., when usage.transactions_per_month is set, TRANSACTIONS
        # meters out-rank GB_MONTH meters even though GB_MONTH normally
        # ranks higher).
        usage_match_rank = 0 if unit.dimension in usage_priorities else 1

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

        # Tie-breaker: when usage was supplied, prefer the LOWER-priced
        # meter in the matching dimension (typical baseline rate; e.g.
        # Key Vault Operations $0.03/10K rather than Renewals $0.15/10K).
        # Otherwise, fall back to v5.3 behaviour (higher price first to
        # surface the "actual" SKU rate over $0.0001 add-ons).
        rate = float(item.get("retailPrice", 0) or 0)
        price_tiebreak = rate if usage and unit.dimension in usage_priorities else -rate

        return (sku_match_rank, usage_match_rank, dimension_rank, price_tiebreak)

    return min(items, key=rank)


def project_monthly_cost(
    item: dict[str, Any],
    *,
    hours_per_month: float = HOURS_PER_MONTH,
    days_per_month: float = DAYS_PER_MONTH,
    usage: dict[str, float] | None = None,
) -> tuple[float, MeterUnit, str | None]:
    """Project a meter to a monthly cost.

    Returns ``(monthly_cost, parsed_unit, warning)`` where ``warning`` is None
    when the projection is reliable.

    v5.4 — accepts an optional ``usage`` dict that lets callers supply
    workload estimates so non-time-based meters can be projected too:

    * ``transactions_per_month`` → applied to ``TRANSACTIONS`` meters
      (e.g. Key Vault Standard ops, Storage Tables write ops).
    * ``gb_stored`` → applied to ``GB_MONTH`` storage-retention meters.
    * ``gb_transferred`` → applied to ``GB`` egress meters.
    * ``seconds_runtime`` → applied to ``SECOND`` meters
      (e.g. ACR build tasks).

    Without a relevant usage entry, the projection still returns ``$0.0``
    with an informational warning so the caller knows to supply usage data.
    """
    unit = parse_unit_of_measure(item.get("unitOfMeasure"))
    rate = float(item.get("retailPrice", 0) or 0)
    usage = usage or {}

    if unit.dimension == MeterDimension.HOUR:
        return rate * hours_per_month / unit.quantity, unit, None
    if unit.dimension == MeterDimension.DAY:
        return rate * days_per_month / unit.quantity, unit, None
    if unit.dimension == MeterDimension.MONTH:
        return rate / unit.quantity, unit, None

    if unit.dimension == MeterDimension.SECOND:
        runtime = usage.get("seconds_runtime")
        if runtime is not None:
            return rate * float(runtime) / unit.quantity, unit, None
        return (
            0.0,
            unit,
            (
                "Per-second meter cannot be projected without a runtime estimate; "
                "supply usage.seconds_runtime to enable projection."
            ),
        )

    if unit.dimension == MeterDimension.GB_MONTH:
        gb_stored = usage.get("gb_stored")
        if gb_stored is not None:
            return rate * float(gb_stored) / unit.quantity, unit, None
        return (
            0.0,
            unit,
            (f"Per-GB/month storage meter (${rate}/{unit.raw}) — supply usage.gb_stored to enable projection."),
        )

    if unit.dimension == MeterDimension.GB:
        gb_transferred = usage.get("gb_transferred")
        if gb_transferred is not None:
            return rate * float(gb_transferred) / unit.quantity, unit, None
        return (
            0.0,
            unit,
            (f"Per-GB transfer meter (${rate}/{unit.raw}) — supply usage.gb_transferred to enable projection."),
        )

    if unit.dimension == MeterDimension.TRANSACTIONS:
        txns = usage.get("transactions_per_month")
        if txns is not None:
            return rate * float(txns) / unit.quantity, unit, None
        return (
            0.0,
            unit,
            (f"Per-transaction meter (${rate}/{unit.raw}) — supply usage.transactions_per_month to enable projection."),
        )

    return 0.0, unit, f"Unrecognised unitOfMeasure '{unit.raw}'; refusing to project."


def project_all_relevant_meters(
    items: list[dict[str, Any]],
    *,
    usage: dict[str, float],
    hours_per_month: float = HOURS_PER_MONTH,
    days_per_month: float = DAYS_PER_MONTH,
) -> tuple[float, list[dict[str, Any]]]:
    """Sum projections across every meter that has a matching usage param.

    Used by ``estimate_costs`` when the caller supplies a ``usage`` dict so
    multi-meter SKUs (e.g. Storage Account: Tables write ops + Blob storage
    + retrieval ops) get every billable dimension projected and summed,
    rather than collapsing to the single primary meter.

    Returns ``(total_monthly, sub_lines)`` where each sub-line documents
    one meter's contribution.
    """
    if not items or not usage:
        return 0.0, []

    sub_lines: list[dict[str, Any]] = []
    total = 0.0

    # Map of usage key → MeterDimension so we know which usage params
    # gate which meter dimensions.
    relevant_dimensions = {
        MeterDimension.TRANSACTIONS: "transactions_per_month",
        MeterDimension.GB_MONTH: "gb_stored",
        MeterDimension.GB: "gb_transferred",
        MeterDimension.SECOND: "seconds_runtime",
    }

    seen_keys: set[tuple[str, str, str]] = set()  # (sku, product, unit) — dedupe duplicate meters

    for item in items:
        unit = parse_unit_of_measure(item.get("unitOfMeasure"))
        usage_key = relevant_dimensions.get(unit.dimension)
        if usage_key is None:
            continue
        if usage.get(usage_key) is None:
            continue
        # Dedupe: the API often returns the same meter twice in different
        # productName / regional variants. Pick the first occurrence.
        dedupe = (
            (item.get("skuName") or "").strip(),
            (item.get("productName") or "").strip(),
            (item.get("unitOfMeasure") or "").strip(),
        )
        if dedupe in seen_keys:
            continue
        seen_keys.add(dedupe)

        cost, _, _ = project_monthly_cost(
            item, hours_per_month=hours_per_month, days_per_month=days_per_month, usage=usage
        )
        if cost <= 0:
            continue
        total += cost
        sub_lines.append(
            {
                "product_name": item.get("productName"),
                "sku_name": item.get("skuName"),
                "retail_price": item.get("retailPrice"),
                "unit_of_measure": item.get("unitOfMeasure"),
                "monthly_cost": round(cost, 4),
            }
        )

    return total, sub_lines
