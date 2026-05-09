"""Phase 0b token-budget baseline harness for Azure Pricing MCP v5.0 modernization.

Captures pre-modernization byte size + token estimate for each high-volume tool
formatter so that Phase 2 token-reduction work has empirical thresholds to
validate against (compact <= 20% of baseline; full <= 80% of baseline).

This harness exercises the formatters DIRECTLY with synthetic-but-realistic
fixtures so it does NOT require a live Azure Retail Prices API call. The
fixtures mirror the dict shapes that the service layer produces in production
(verified by reading services/pricing.py, services/sku.py, services/bulk.py,
services/orphaned_resources.py, databricks/handlers.py, github_pricing/handlers.py).

Run with the existing .venv (python 3.13 today, 3.14 post devcontainer rebuild):
    .venv/bin/python tests/fixtures/baseline_harness.py

Output: tests/fixtures/baseline-bytes.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC = REPO_ROOT / "src"
sys.path.insert(0, str(SRC))

from azure_pricing_mcp.databricks.formatters import (  # noqa: E402
    format_databricks_dbu_pricing_response,
)
from azure_pricing_mcp.formatters import (  # noqa: E402
    format_bulk_estimate_response,
    format_cost_estimate_response,
    format_discover_skus_response,
    format_orphaned_resources_response,
    format_price_compare_response,
    format_price_search_response,
    format_region_recommend_response,
    format_ri_pricing_response,
    format_sku_discovery_response,
)
from azure_pricing_mcp.github_pricing.formatters import (  # noqa: E402
    format_github_pricing_response,
)


def _est_tokens(text: str) -> int:
    """Char/4 heuristic per Phase 0b plan ('use tiktoken or character/4')."""
    return (len(text) + 3) // 4


# ─── Canonical workload: 10 resources × 3 regions, USD, no discount ──────────
REGIONS = ["eastus", "westeurope", "southeastasia"]
RESOURCE_SPECS = [
    ("Virtual Machines", "Standard_D2s_v5", 1),
    ("Virtual Machines", "Standard_D4s_v5", 2),
    ("Virtual Machines", "Standard_E8s_v5", 1),
    ("Storage", "Standard LRS Hot", 1),
    ("Storage", "Standard ZRS Hot", 1),
    ("Azure App Service", "P1v3 App Service Plan", 2),
    ("Azure SQL Database", "S2 General Purpose", 1),
    ("Azure Kubernetes Service", "Standard_D4s_v5", 3),
    ("Azure Cache for Redis", "C1 Standard", 1),
    ("Application Gateway", "WAF_v2", 1),
]


def _bulk_estimate_fixture() -> dict:
    """Fixture mirroring services/bulk.py output shape."""
    line_items = []
    monthly_total = 0.0
    for region in REGIONS:
        for service, sku, qty in RESOURCE_SPECS:
            monthly = round(72.50 * qty * (1.0 + 0.1 * REGIONS.index(region)), 2)
            yearly = round(monthly * 12, 2)
            monthly_total += monthly
            line_items.append(
                {
                    "service_name": service,
                    "sku_name": sku,
                    "region": region,
                    "quantity": qty,
                    "unit_of_measure": "1 Hour",
                    "hourly_rate": round(monthly / 730, 6),
                    "monthly_cost": monthly,
                    "yearly_cost": yearly,
                }
            )
    return {
        "resource_count": len(line_items),
        "unique_specs": len(line_items),
        "successful": len(line_items),
        "failed": 0,
        "currency": "USD",
        "line_items": line_items,
        "totals": {"monthly": round(monthly_total, 2), "yearly": round(monthly_total * 12, 2)},
        "errors": [],
    }


def _price_search_fixture() -> dict:
    """Fixture for azure_price_search response (services/pricing.py)."""
    items = []
    for i, region in enumerate(REGIONS):
        for service, sku, _ in RESOURCE_SPECS[:5]:
            items.append(
                {
                    "serviceName": service,
                    "productName": f"{service} {sku.split('_')[-1] if '_' in sku else 'Compute'}",
                    "skuName": sku,
                    "armRegionName": region,
                    "location": region,
                    "retailPrice": round(0.108 * (1.0 + 0.1 * i), 6),
                    "originalPrice": round(0.135 * (1.0 + 0.1 * i), 6),
                    "unitOfMeasure": "1 Hour",
                    "type": "Consumption",
                    "savingsPlan": [
                        {"term": "1 Year", "retailPrice": round(0.085 * (1.0 + 0.1 * i), 6)},
                        {"term": "3 Years", "retailPrice": round(0.058 * (1.0 + 0.1 * i), 6)},
                    ],
                }
            )
    return {
        "items": items,
        "count": len(items),
        "currency": "USD",
        "discount_applied": {"percentage": 20, "note": "Customer negotiated discount applied to retail prices."},
        "_discount_metadata": {"discount_specified": True, "used_default_discount": False, "discount_percentage": 20.0},
    }


def _region_recommend_fixture() -> dict:
    """Fixture for azure_region_recommend (services/pricing.py)."""
    recs = []
    base_price = 0.108
    for i, region in enumerate(REGIONS):
        recs.append(
            {
                "region": region,
                "location": region.replace("us", " US").replace("europe", " Europe").title(),
                "retail_price": round(base_price * (1.0 + 0.1 * i), 6),
                "original_price": round(base_price * 1.25 * (1.0 + 0.1 * i), 6),
                "spot_price": round(base_price * 0.18 * (1.0 + 0.1 * i), 6),
                "savings_vs_most_expensive": round(20 - 10 * i, 1),
                "unit_of_measure": "1 Hour",
            }
        )
    return {
        "service_name": "Virtual Machines",
        "sku_name": "Standard_D4s_v5",
        "currency": "USD",
        "total_regions_found": len(recs),
        "showing_top": len(recs),
        "summary": {
            "cheapest_location": recs[0]["location"],
            "cheapest_region": recs[0]["region"],
            "cheapest_price": recs[0]["retail_price"],
            "most_expensive_location": recs[-1]["location"],
            "most_expensive_region": recs[-1]["region"],
            "most_expensive_price": recs[-1]["retail_price"],
            "max_savings_percentage": 20.0,
        },
        "recommendations": recs,
        "discount_applied": {"percentage": 15, "note": "Customer discount."},
    }


def _cost_estimate_fixture() -> dict:
    return {
        "service_name": "Virtual Machines",
        "sku_name": "Standard_D4s_v5",
        "region": "eastus",
        "product_name": "Virtual Machines D Series v5",
        "unit_of_measure": "1 Hour",
        "currency": "USD",
        "usage_assumptions": {"hours_per_month": 730, "hours_per_day": 24},
        "on_demand_pricing": {
            "hourly_rate": 0.192,
            "daily_cost": 4.608,
            "monthly_cost": 140.16,
            "yearly_cost": 1681.92,
            "original_hourly_rate": 0.240,
            "original_daily_cost": 5.76,
            "original_monthly_cost": 175.20,
            "original_yearly_cost": 2102.40,
        },
        "savings_plans": [
            {
                "term": "1 Year",
                "hourly_rate": 0.150,
                "monthly_cost": 109.50,
                "yearly_cost": 1314.00,
                "savings_percent": 22,
                "annual_savings": 367.92,
                "original_hourly_rate": 0.187,
                "original_monthly_cost": 136.51,
                "original_yearly_cost": 1638.12,
            },
            {
                "term": "3 Years",
                "hourly_rate": 0.106,
                "monthly_cost": 77.38,
                "yearly_cost": 928.56,
                "savings_percent": 45,
                "annual_savings": 753.36,
                "original_hourly_rate": 0.132,
                "original_monthly_cost": 96.36,
                "original_yearly_cost": 1156.32,
            },
        ],
        "discount_applied": {"percentage": 20, "note": "Customer negotiated discount."},
    }


def _price_compare_fixture() -> dict:
    return {
        "service_name": "Virtual Machines",
        "currency": "USD",
        "comparisons": [
            {
                "sku": s,
                "region": r,
                "retail_price": round(0.10 * (i + 1), 4),
                "savings_plan_1y": round(0.075 * (i + 1), 4),
            }
            for i, (s, r) in enumerate(
                [("Standard_D2s_v5", "eastus"), ("Standard_D4s_v5", "eastus"), ("Standard_E4s_v5", "westeurope")]
            )
        ],
        "discount_applied": {"percentage": 20, "note": "Customer discount."},
    }


def _ri_pricing_fixture() -> dict:
    items = []
    for region in REGIONS:
        for sku in ["Standard_D4s_v5", "Standard_E8s_v5", "Standard_D8s_v5"]:
            for term in ["1 Year", "3 Years"]:
                items.append(
                    {
                        "skuName": sku,
                        "armRegionName": region,
                        "retailPrice": 0.092 if term == "1 Year" else 0.058,
                        "unitOfMeasure": "1 Hour",
                        "reservationTerm": term,
                    }
                )
    return {
        "ri_items": items,
        "count": len(items),
        "currency": "USD",
        "comparison": [
            {
                "sku": "Standard_D4s_v5",
                "region": "eastus",
                "term": "1 Year",
                "savings_percentage": 32.5,
                "ri_hourly": 0.092,
                "od_hourly": 0.136,
                "break_even_months": 8,
                "annual_savings": 385,
            },
            {
                "sku": "Standard_D4s_v5",
                "region": "eastus",
                "term": "3 Years",
                "savings_percentage": 57.4,
                "ri_hourly": 0.058,
                "od_hourly": 0.136,
                "break_even_months": 11,
                "annual_savings": 683,
            },
        ],
    }


def _discover_skus_fixture() -> dict:
    return {
        "service_name": "Virtual Machines",
        "total_skus": 24,
        "skus": [
            {
                "skuName": f"Standard_{family}{size}s_v5",
                "productName": f"Virtual Machines {family}-Series",
                "minPrice": round(0.05 + 0.025 * size, 4),
                "regions": REGIONS,
            }
            for family in ["D", "E", "F"]
            for size in [2, 4, 8, 16]
        ],
    }


def _sku_discovery_fixture() -> dict:
    skus = {}
    for family in ["D", "E", "F"]:
        for size in [2, 4, 8, 16]:
            sku_name = f"Standard_{family}{size}s_v5"
            skus[sku_name] = {
                "product_name": f"Virtual Machines {family}-Series v5",
                "min_price": round(0.05 + 0.025 * size, 4),
                "sample_unit": "1 Hour",
                "regions": REGIONS,
            }
    return {
        "service_found": "Virtual Machines",
        "original_search": "vm",
        "match_type": "exact_mapping",
        "total_skus": len(skus),
        "skus": skus,
    }


def _orphaned_resources_fixture() -> dict:
    resources = []
    for sub_idx in range(2):
        for rtype, count in [
            ("Unattached Disk", 4),
            ("Unattached Public IP", 3),
            ("Empty App Service Plan", 2),
            ("Idle SQL Elastic Pool", 1),
            ("Unattached NAT Gateway", 1),
        ]:
            for j in range(count):
                resources.append(
                    {
                        "name": f"orphan-{rtype.lower().replace(' ', '-')}-{sub_idx}-{j}",
                        "resourceGroup": f"rg-prod-{sub_idx}",
                        "location": REGIONS[j % len(REGIONS)],
                        "orphan_type": rtype,
                        "estimated_cost_usd": round(15.0 + 8.5 * j + 22.0 * (rtype.startswith("Empty")), 2),
                    }
                )
    return {
        "subscriptions": [
            {
                "subscription_id": f"sub-{i}",
                "orphaned_resources": [r for r in resources if r["name"].endswith(f"-{i}-0") or "-1" in r["name"][-3:]],
            }
            for i in range(2)
        ],
        "total_orphaned": len(resources),
        "total_estimated_cost": sum(r["estimated_cost_usd"] for r in resources),
        "lookback_days": 60,
        "currency": "USD",
        "note": "Costs are estimates based on listed retail prices over the lookback window.",
    }


def _databricks_dbu_fixture() -> dict:
    """Mirror of services/databricks.py output (key 'workloads' is a dict label→entries)."""
    workload_labels = [
        "All-Purpose Compute",
        "Jobs Compute",
        "Jobs Light Compute",
        "DLT Core",
        "DLT Pro",
        "DLT Advanced",
    ]
    workloads: dict[str, list[dict[str, object]]] = {}
    for label in workload_labels:
        entries: list[dict[str, object]] = []
        for tier in ("standard", "premium"):
            entries.append(
                {
                    "tier": tier,
                    "workload": label.lower().replace(" ", "-"),
                    "dbu_rate": round(0.40 + 0.20 * (tier == "premium") + 0.05 * len(label) % 0.45, 4),
                    "unit": "1 DBU",
                }
            )
        workloads[label] = entries
    return {
        "region": "eastus",
        "currency": "USD",
        "total_items": sum(len(v) for v in workloads.values()),
        "tier_filter": None,
        "workloads": workloads,
    }


def _github_pricing_fixture() -> dict:
    """Mirror of services/github_pricing.py 'sections' dict shape."""
    return {
        "currency": "USD",
        "data_version": "2026-04-01",
        "resolved_category": "all",
        "sections": {
            "plans": [
                {"name": "Free", "price_monthly": 0.00, "target": "Individuals & open source"},
                {"name": "Team", "price_monthly": 4.00, "target": "Small teams"},
                {"name": "Enterprise", "price_monthly": 21.00, "target": "Enterprises"},
            ],
            "copilot": [
                {"name": "Copilot Free", "price_monthly": 0.0, "price_annual": 0.0, "target": "Individuals"},
                {"name": "Copilot Pro", "price_monthly": 10.0, "price_annual": 100.0, "target": "Power users"},
                {"name": "Copilot Business", "price_monthly": 19.0, "price_annual": 228.0, "target": "Teams"},
                {"name": "Copilot Enterprise", "price_monthly": 39.0, "price_annual": 468.0, "target": "Enterprises"},
            ],
            "actions": {
                "runners": [
                    {"runner": "Linux 2-core", "per_minute": 0.008, "os": "Linux", "cores": 2},
                    {"runner": "Windows 2-core", "per_minute": 0.016, "os": "Windows", "cores": 2},
                    {"runner": "macOS 3-core", "per_minute": 0.080, "os": "macOS", "cores": 3},
                ],
                "free_minutes": {
                    "Free": {"minutes": 2000, "storage_gb": 0.5},
                    "Team": {"minutes": 3000, "storage_gb": 2.0},
                    "Enterprise": {"minutes": 50000, "storage_gb": 50.0},
                },
                "multipliers": {"Linux": 1, "Windows": 2, "macOS": 10},
            },
            "storage": [
                {"name": "Packages", "price": 0.25, "unit": "GB / month"},
                {"name": "Bandwidth", "price": 0.50, "unit": "GB"},
            ],
        },
    }


# Optional formatters that may not exist in v4 source — wrap in try/except.
FORMATTER_MAP = [
    ("azure_bulk_estimate", format_bulk_estimate_response, _bulk_estimate_fixture),
    ("azure_price_search", format_price_search_response, _price_search_fixture),
    ("azure_region_recommend", format_region_recommend_response, _region_recommend_fixture),
    ("azure_cost_estimate", format_cost_estimate_response, _cost_estimate_fixture),
    ("azure_price_compare", format_price_compare_response, _price_compare_fixture),
    ("azure_sku_discovery", format_sku_discovery_response, _sku_discovery_fixture),
    ("azure_discover_skus", format_discover_skus_response, _discover_skus_fixture),
    ("azure_ri_pricing", format_ri_pricing_response, _ri_pricing_fixture),
    ("find_orphaned_resources", format_orphaned_resources_response, _orphaned_resources_fixture),
    ("databricks_dbu_pricing", format_databricks_dbu_pricing_response, _databricks_dbu_fixture),
    ("github_pricing", format_github_pricing_response, _github_pricing_fixture),
]


def main() -> int:
    """Run the harness and write baseline-bytes.json."""
    results = {}
    for tool_name, formatter, fixture_fn in FORMATTER_MAP:
        try:
            fixture = fixture_fn()
            text = formatter(fixture)
            byte_size = len(text.encode("utf-8"))
            char_count = len(text)
            est_tokens = _est_tokens(text)
            results[tool_name] = {
                "byte_size": byte_size,
                "char_count": char_count,
                "estimated_tokens": est_tokens,
                "compact_target_bytes": byte_size // 5,  # ≤ 20% of baseline
                "full_target_bytes": int(byte_size * 0.8),  # ≤ 80% of baseline
            }
            print(f"  {tool_name:30s} bytes={byte_size:>6d}  chars={char_count:>6d}  est_tokens={est_tokens:>5d}")
        except Exception as exc:  # pragma: no cover — defensive
            results[tool_name] = {"error": f"{type(exc).__name__}: {exc}"}
            print(f"  {tool_name:30s} ERROR: {exc}", file=sys.stderr)

    out = {
        "schema_version": 1,
        "captured_for": "azure-pricing-mcp v4.0.0 -> v5.0.0 baseline",
        "harness_version": "phase-0b",
        "token_estimate_method": "chars/4 heuristic",
        "fixture_workload": "10 resources x 3 regions, USD, with discount metadata",
        "thresholds": {
            "compact_max_pct_of_baseline": 0.20,
            "full_max_pct_of_baseline": 0.80,
        },
        "tools": results,
    }
    out_path = Path(__file__).parent / "baseline-bytes.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"\nWrote {out_path} ({sum(t.get('byte_size', 0) for t in results.values())} total bytes across all tools)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
