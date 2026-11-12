"""Tests for tools/scripts/render-assessment-charts.py and assessment-bundle-v3 lifecycle."""

from __future__ import annotations

import importlib.util
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "render_assessment_charts",
    ROOT / "tools/scripts/render-assessment-charts.py",
)
assert SPEC and SPEC.loader
charts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(charts)


def sample_waf_scores(project: str = "factory-preview") -> dict:
    return {
        "schema_version": "assessment-waf-scores-v1",
        "project": project,
        "as_of": "2026-11-11T09:00:00.000Z",
        "pillars": [
            {
                "pillar": "Security",
                "status": "scored",
                "score": 6.5,
                "confidence": "Medium",
                "passed_checks": 5,
                "risk_checks": 2,
                "intentional_tradeoff_checks": 1,
                "unknown_checks": 3,
            },
            {
                "pillar": "Reliability",
                "status": "scored",
                "score": 4.0,
                "confidence": "Medium",
                "passed_checks": 2,
                "risk_checks": 1,
                "intentional_tradeoff_checks": 2,
                "unknown_checks": 4,
            },
            {
                "pillar": "Performance Efficiency",
                "status": "not_assessed",
                "score": None,
                "confidence": "Low",
                "passed_checks": 1,
                "risk_checks": 0,
                "intentional_tradeoff_checks": 0,
                "unknown_checks": 5,
            },
            {
                "pillar": "Cost Optimization",
                "status": "scored",
                "score": 5.0,
                "confidence": "Medium",
                "passed_checks": 2,
                "risk_checks": 2,
                "intentional_tradeoff_checks": 0,
                "unknown_checks": 2,
            },
            {
                "pillar": "Operational Excellence",
                "status": "scored",
                "score": 6.0,
                "confidence": "Low",
                "passed_checks": 3,
                "risk_checks": 2,
                "intentional_tradeoff_checks": 0,
                "unknown_checks": 4,
            },
        ],
    }


def sample_cost_report() -> dict:
    sub1 = "/subscriptions/706f47e8-f430-4395-8dfc-fafba699c850"
    sub2 = "/subscriptions/582da6a2-2ecc-4cba-8495-7b3564a46284"
    periods = [
        {
            "id": "preceding_month",
            "kind": "closed_month",
            "from": "2026-09-01T00:00:00.000Z",
            "to": "2026-09-30T23:59:59.999Z",
        },
        {
            "id": "previous_month",
            "kind": "closed_month",
            "from": "2026-10-01T00:00:00.000Z",
            "to": "2026-10-31T23:59:59.999Z",
        },
        {
            "id": "month_to_date",
            "kind": "month_to_date",
            "from": "2026-11-01T00:00:00.000Z",
            "to": "2026-11-11T09:00:00.000Z",
        },
        {
            "id": "current_month_forecast",
            "kind": "forecast",
            "from": "2026-11-01T00:00:00.000Z",
            "to": "2026-11-30T23:59:59.999Z",
        },
    ]
    return {
        "schema_version": "1.0",
        "as_of": "2026-11-11T09:00:00.000Z",
        "generated_at": "2026-11-11T09:00:00.000Z",
        "status": "partial",
        "scopes": [sub1, sub2],
        "periods": periods,
        "evidence": [
            {
                "id": "scope1-preceding_month",
                "source_kind": "actual",
                "status": "complete",
                "request": {"id": "scope1-preceding_month", "scope": sub1, "operation": "query", "period": periods[0]},
                "provenance": None,
                "series": [{"currency": "USD", "cost_status": "Actual", "amount": "95.00", "groups": []}],
                "page_count": 1,
                "next_request_path": None,
                "gaps": [],
            },
            {
                "id": "scope1-previous_month",
                "source_kind": "actual",
                "status": "complete",
                "request": {"id": "scope1-previous_month", "scope": sub1, "operation": "query", "period": periods[1]},
                "provenance": None,
                "series": [
                    {
                        "currency": "USD",
                        "cost_status": "Actual",
                        "amount": "110.15",
                        "groups": [{"dimensions": {"ServiceName": "Azure Firewall"}, "amount": "106.87"}],
                    }
                ],
                "page_count": 1,
                "next_request_path": None,
                "gaps": [],
            },
            {
                "id": "scope1-month_to_date",
                "source_kind": "actual",
                "status": "complete",
                "request": {"id": "scope1-month_to_date", "scope": sub1, "operation": "query", "period": periods[2]},
                "provenance": None,
                "series": [{"currency": "USD", "cost_status": "Actual", "amount": "307.61", "groups": []}],
                "page_count": 1,
                "next_request_path": None,
                "gaps": [],
            },
            {
                "id": "scope1-current_month_forecast",
                "source_kind": "actual",
                "status": "complete",
                "request": {
                    "id": "scope1-current_month_forecast",
                    "scope": sub1,
                    "operation": "forecast",
                    "period": periods[3],
                },
                "provenance": None,
                "series": [
                    {"currency": "USD", "cost_status": "Actual", "amount": "273.44", "groups": []},
                    {"currency": "USD", "cost_status": "Forecast", "amount": "277.78", "groups": []},
                ],
                "page_count": 1,
                "next_request_path": None,
                "gaps": [],
            },
            {
                "id": "scope2-preceding_month",
                "source_kind": "actual",
                "status": "not_assessed",
                "request": {"id": "scope2-preceding_month", "scope": sub2, "operation": "query", "period": periods[0]},
                "provenance": None,
                "series": [],
                "page_count": 0,
                "next_request_path": None,
                "gaps": ["Throttled"],
            },
            {
                "id": "scope2-previous_month",
                "source_kind": "actual",
                "status": "complete",
                "request": {"id": "scope2-previous_month", "scope": sub2, "operation": "query", "period": periods[1]},
                "provenance": None,
                "series": [
                    {
                        "currency": "USD",
                        "cost_status": "Actual",
                        "amount": "770.85",
                        "groups": [
                            {"dimensions": {"ServiceName": "Azure Bastion"}, "amount": "276.63"},
                            {"dimensions": {"ServiceName": "Virtual Machines"}, "amount": "145.16"},
                        ],
                    }
                ],
                "page_count": 1,
                "next_request_path": None,
                "gaps": [],
            },
        ],
        "estimates": [],
        "opportunities": [],
        "exclusions": [],
        "allocation_notes": ["Scoped test fixture"],
        "gaps": [],
    }


def test_render_assessment_charts_produces_valid_png_and_svg_siblings_and_enforces_min_checks(tmp_path: Path) -> None:
    project = tmp_path / "agent-output/factory-preview"
    (project / "_meta").mkdir(parents=True)
    (project / "contracts").mkdir(parents=True)
    (project / "_meta/waf-scores.json").write_text(json.dumps(sample_waf_scores()), encoding="utf-8")
    (project / "contracts/03-cost-management.json").write_text(json.dumps(sample_cost_report()), encoding="utf-8")

    result = charts.render_all_assessment_charts(project)
    assert len(result["outputs"]) == 6
    for rel in result["outputs"]:
        target = project / rel
        assert target.is_file() and target.stat().st_size > 1000
        if target.suffix == ".png":
            assert target.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
        else:
            ET.fromstring(target.read_text(encoding="utf-8"))

    # Scoring a pillar with <2 observed checks fails closed.
    bad = sample_waf_scores()
    bad["pillars"][2]["status"] = "scored"
    bad["pillars"][2]["score"] = 9.0
    with pytest.raises(ValueError, match=">= 2 observed checks"):
        charts.validate_waf_scores(bad)


def test_iac_unassessed_cost_mode_still_emits_valid_placeholder_charts(tmp_path: Path) -> None:
    project = tmp_path / "agent-output/iac-preview"
    (project / "_meta").mkdir(parents=True)
    (project / "contracts").mkdir(parents=True)
    (project / "_meta/waf-scores.json").write_text(json.dumps(sample_waf_scores("iac-preview")), encoding="utf-8")
    (project / "contracts/03-cost-management.json").write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "as_of": "2026-11-11T09:00:00.000Z",
                "generated_at": "2026-11-11T09:00:00.000Z",
                "status": "not_assessed",
                "scopes": [],
                "periods": [
                    {
                        "id": "previous_month",
                        "kind": "closed_month",
                        "from": "2026-10-01T00:00:00.000Z",
                        "to": "2026-10-31T23:59:59.999Z",
                    }
                ],
                "evidence": [],
                "estimates": [],
                "opportunities": [],
                "exclusions": [],
                "allocation_notes": ["IaC only"],
                "gaps": ["Usage unknown"],
            }
        ),
        encoding="utf-8",
    )
    out = charts.render_all_assessment_charts(project)
    assert len(out["outputs"]) == 6


def test_multicurrency_credits_unavailable_estimates_and_cross_currency_forecasts_render_accurately(
    tmp_path: Path,
) -> None:
    # Case 1: Azure scopes exist + unavailable estimate records -> no IndexError, clean banner.
    p1 = tmp_path / "agent-output/azure-unassessed-with-est"
    (p1 / "_meta").mkdir(parents=True)
    (p1 / "contracts").mkdir(parents=True)
    (p1 / "_meta/waf-scores.json").write_text(json.dumps(sample_waf_scores("azure-unassessed")), encoding="utf-8")
    unassessed_cost = sample_cost_report()
    for ev in unassessed_cost["evidence"]:
        ev["status"] = "not_assessed"
        ev["series"] = []
    unassessed_cost["estimates"] = [
        {"id": "est-gap", "source_kind": "estimate", "status": "not_assessed", "currency": "USD", "monthly_total": None}
    ]
    (p1 / "contracts/03-cost-management.json").write_text(json.dumps(unassessed_cost), encoding="utf-8")
    assert len(charts.render_all_assessment_charts(p1)["outputs"]) == 6

    # Case 2: Multi-currency IaC estimates (USD + EUR) keep separate currency labels.
    p2 = tmp_path / "agent-output/iac-multicurrency"
    (p2 / "_meta").mkdir(parents=True)
    (p2 / "contracts").mkdir(parents=True)
    (p2 / "_meta/waf-scores.json").write_text(json.dumps(sample_waf_scores("iac-multicurrency")), encoding="utf-8")
    iac_mc = {
        **unassessed_cost,
        "scopes": [],
        "evidence": [],
        "estimates": [
            {
                "id": "app-usd",
                "source_kind": "estimate",
                "status": "complete",
                "currency": "USD",
                "monthly_total": "120.50",
            },
            {
                "id": "db-eur",
                "source_kind": "estimate",
                "status": "complete",
                "currency": "EUR",
                "monthly_total": "95.00",
            },
        ],
    }
    (p2 / "contracts/03-cost-management.json").write_text(json.dumps(iac_mc), encoding="utf-8")
    charts.render_all_assessment_charts(p2)
    trends_svg_iac = (p2 / "assets/03-cost-trends.svg").read_text(encoding="utf-8")
    assert "USD 120.50" in trends_svg_iac and "EUR 95.00" in trends_svg_iac

    # Case 3: Live USD + EUR scopes, negative credit month, signed driver net (100 + -80 = 20), and trailing EUR 0 series.
    p3 = tmp_path / "agent-output/live-multicurrency-credits"
    (p3 / "_meta").mkdir(parents=True)
    (p3 / "contracts").mkdir(parents=True)
    (p3 / "_meta/waf-scores.json").write_text(json.dumps(sample_waf_scores("live-multicurrency")), encoding="utf-8")
    mc_live = sample_cost_report()
    mc_live["evidence"][0]["series"][0]["amount"] = "-45.00"  # Net credit month
    mc_live["evidence"][5]["series"] = [
        {
            "currency": "USD",
            "cost_status": "Actual",
            "amount": "20.00",
            "groups": [
                {"dimensions": {"ServiceName": "Azure Bastion"}, "amount": "100.00"},
                {"dimensions": {"ServiceName": "Azure Bastion"}, "amount": "-80.00"},
            ],
        },
        {
            "currency": "EUR",
            "cost_status": "Actual",
            "amount": "0",
            "groups": [],
        },
    ]
    (p3 / "contracts/03-cost-management.json").write_text(json.dumps(mc_live), encoding="utf-8")
    charts.render_all_assessment_charts(p3)
    drivers_svg = (p3 / "assets/03-cost-drivers.svg").read_text(encoding="utf-8")
    assert "USD 20.00" in drivers_svg
    assert "USD 100.00" not in drivers_svg


def test_no_rows_badge_signed_subdollar_labels_display_names_and_diagram_validator(tmp_path: Path) -> None:
    p = tmp_path / "agent-output/no-rows-and-subdollar"
    (p / "_meta").mkdir(parents=True)
    (p / "contracts").mkdir(parents=True)
    (p / "assets").mkdir(parents=True)
    (p / "_meta/waf-scores.json").write_text(json.dumps(sample_waf_scores("no-rows")), encoding="utf-8")
    (p / "_meta/live-inventory.json").write_text(
        json.dumps(
            {
                "collected_at": "2026-11-11T09:00:00.000Z",
                "inventories": [
                    {
                        "subscription_id": "706f47e8-f430-4395-8dfc-fafba699c850",
                        "subscription_name": "gh-shared",
                        "count": 2,
                    },
                    {
                        "subscription_id": "582da6a2-2ecc-4cba-8495-7b3564a46284",
                        "subscription_name": "gh-workload02",
                        "count": 3,
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    doc = sample_cost_report()
    # Scope 1 preceding_month: 0-row inferred-currency slice on FIRST scope (Scope 2 has $95.00 -> legend must stay!)
    doc["evidence"][0]["series"] = [{"currency": "USD", "cost_status": "Actual", "amount": "0", "groups": []}]
    doc["evidence"][0]["gaps"] = ["Empty historical period; currency USD inferred from sibling period previous_month."]
    doc["evidence"][1]["series"][0]["amount"] = "0.004"
    doc["evidence"][2]["series"][0]["amount"] = "-0.004"
    # Scope 2 preceding_month: actual $95.00 so preceding_month (Actual) legend entry must still be emitted!
    doc["evidence"][4]["status"] = "complete"
    doc["evidence"][4]["series"] = [{"currency": "USD", "cost_status": "Actual", "amount": "95.00", "groups": []}]
    doc["evidence"][4]["gaps"] = []
    # Scope 2 previous_month: sub-dollar positive (0.46)
    doc["evidence"][5]["series"][0]["amount"] = "0.46"
    (p / "contracts/03-cost-management.json").write_text(json.dumps(doc), encoding="utf-8")

    charts.render_all_assessment_charts(p)
    trends_svg = (p / "assets/03-cost-trends.svg").read_text(encoding="utf-8")
    drivers_svg = (p / "assets/03-cost-drivers.svg").read_text(encoding="utf-8")
    assert "gh-shared (706f47e8)" in trends_svg
    assert "gh-workload02 (582da6a2)" in trends_svg
    assert "gh-workload02 (582da6a2)" in drivers_svg
    assert "preceding_month (Actual)" in trends_svg
    assert "&lt;0.01" in trends_svg
    assert "-&lt;0.01" in trends_svg
    assert "0.46" in trends_svg
    assert "NO" in trends_svg and "ROWS" in trends_svg

    # Validate stock diagram checker on valid pair (with W3C DOCTYPE svg header!), GUID leak, bool count, and >2 fan-out.
    diag_spec = importlib.util.spec_from_file_location(
        "validate_assessment_diagram",
        ROOT / "tools/scripts/validate-assessment-diagram.py",
    )
    assert diag_spec and diag_spec.loader
    diag_mod = importlib.util.module_from_spec(diag_spec)
    diag_spec.loader.exec_module(diag_mod)

    # Copy one valid PNG/SVG pair as 03-des-diagram.{png,svg} + .py (with W3C DOCTYPE + local #ic-vnet <use> ref)
    (p / "assets/03-des-diagram.py").write_text("# generator\n", encoding="utf-8")
    (p / "assets/03-des-diagram.png").write_bytes((p / "assets/02-waf-posture.png").read_bytes())
    (p / "assets/03-des-diagram.svg").write_text(
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">'
        '<defs><symbol id="ic-vnet"/></defs><use href="#ic-vnet"/><text>gh-shared (706f47e8)</text></svg>',
        encoding="utf-8",
    )
    (p / "assets/03-des-coverage.json").write_text(json.dumps({"total_resources": 5}), encoding="utf-8")
    ok = diag_mod.validate_assessment_diagrams(p)
    assert ok["valid"] is True
    assert ok["reconciled_resources"] == 5

    # External <use href="icons.svg#vnet"/> reference is rejected.
    (p / "assets/03-des-diagram.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="icons.svg#vnet"/><text>gh-shared</text></svg>',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="external <use> reference"):
        diag_mod.validate_assessment_diagrams(p)
    (p / "assets/03-des-diagram.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg"><defs><symbol id="ic-vnet"/></defs><use href="#ic-vnet"/></svg>',
        encoding="utf-8",
    )

    # Boolean total_resources is rejected.
    (p / "assets/03-des-coverage.json").write_text(json.dumps({"total_resources": True}), encoding="utf-8")
    with pytest.raises(ValueError, match="must be an integer"):
        diag_mod.validate_assessment_diagrams(p)
    (p / "assets/03-des-coverage.json").write_text(json.dumps({"total_resources": 5}), encoding="utf-8")

    # Full 36-char GUID in SVG text is rejected.
    (p / "assets/03-des-diagram.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg"><text>706f47e8-f430-4395-8dfc-fafba699c850</text></svg>',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="full 36-char GUID"):
        diag_mod.validate_assessment_diagrams(p)

    # Restore clean SVG and verify >2 diagram fan-out is rejected by default.
    (p / "assets/03-des-diagram.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg"><text>gh-shared</text></svg>',
        encoding="utf-8",
    )
    for idx in (1, 2):
        (p / f"assets/03-des-extra-{idx}.png").write_bytes((p / "assets/03-des-diagram.png").read_bytes())
        (p / f"assets/03-des-extra-{idx}.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg"><text>extra</text></svg>',
            encoding="utf-8",
        )
    with pytest.raises(ValueError, match="exceeding bounded limit of 2"):
        diag_mod.validate_assessment_diagrams(p)
