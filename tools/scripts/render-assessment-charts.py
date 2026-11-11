#!/usr/bin/env python3
"""Deterministic matplotlib chart generator for standalone WAF assessments (PNG + SVG via save_figure)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = ROOT / ".github/skills/apex-python-diagrams/scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from diagram_io import save_figure  # noqa: E402

PILLAR_ORDER = (
    "Security",
    "Reliability",
    "Performance Efficiency",
    "Cost Optimization",
    "Operational Excellence",
)
NAVY = "#0B1F3A"
BLUE = "#0078D4"
TEAL = "#008272"
GREEN = "#107C10"
AMBER = "#D18B00"
RED = "#C50F1F"
SLATE = "#5B6B7B"
MUTED = "#CBD5E1"
BG = "#F8FAFC"


def validate_waf_scores(doc: dict[str, Any]) -> None:
    if not isinstance(doc, dict) or doc.get("schema_version") != "assessment-waf-scores-v1":
        raise ValueError("Invalid schema_version in _meta/waf-scores.json (expected assessment-waf-scores-v1)")
    pillars = doc.get("pillars")
    if not isinstance(pillars, list) or len(pillars) != 5:
        raise ValueError("_meta/waf-scores.json must contain all 5 WAF pillars")
    seen = set()
    for entry in pillars:
        name = entry.get("pillar")
        if name not in PILLAR_ORDER or name in seen:
            raise ValueError(f"Duplicate or invalid WAF pillar: {name}")
        seen.add(name)
        observed = (
            int(entry.get("passed_checks", 0))
            + int(entry.get("risk_checks", 0))
            + int(entry.get("intentional_tradeoff_checks", 0))
        )
        if entry.get("status") == "scored":
            score = entry.get("score")
            if observed < 2 or not isinstance(score, (int, float)) or not (0 <= float(score) <= 10):
                raise ValueError(f"Scored pillar '{name}' requires >= 2 observed checks and score in [0, 10]")
        elif entry.get("status") == "not_assessed":
            if entry.get("score") is not None:
                raise ValueError(f"not_assessed pillar '{name}' must have score: null")
        else:
            raise ValueError(f"Invalid pillar status on '{name}'")


def short_scope_label(scope: str, index: int) -> str:
    lower = scope.lower()
    if "/resourcegroups/" in lower:
        rg = scope.split("/")[-1]
        sub_short = scope.split("/")[2][:8]
        return f"{rg} ({sub_short})"
    parts = scope.strip("/").split("/")
    if len(parts) >= 2:
        return f"Sub {index + 1} ({parts[1][:8]})"
    return f"Scope {index + 1}"


def render_waf_posture(waf_doc: dict[str, Any], out_base: Path) -> None:
    validate_waf_scores(waf_doc)
    by_name = {item["pillar"]: item for item in waf_doc["pillars"]}
    ordered = [by_name[name] for name in reversed(PILLAR_ORDER)]
    labels = [item["pillar"] for item in ordered]

    fig, (ax_score, ax_cov) = plt.subplots(1, 2, figsize=(13.5, 4.8), gridspec_kw={"width_ratios": [1.15, 1.0]})
    fig.patch.set_facecolor(BG)
    for ax in (ax_score, ax_cov):
        ax.set_facecolor("#FFFFFF")
        ax.spines[["top", "right"]].set_visible(False)
        ax.spines[["left", "bottom"]].set_color("#CBD5E1")

    y_pos = np.arange(len(ordered))
    scores = [float(item["score"]) if item["status"] == "scored" else 0.0 for item in ordered]
    bar_colors = [
        GREEN
        if item["status"] == "scored" and float(item["score"]) >= 7.5
        else AMBER
        if item["status"] == "scored" and float(item["score"]) >= 5.0
        else RED
        if item["status"] == "scored"
        else MUTED
        for item in ordered
    ]

    bars = ax_score.barh(y_pos, scores, height=0.56, color=bar_colors, edgecolor="white", linewidth=1.2)
    for idx, (bar, item) in enumerate(zip(bars, ordered, strict=True)):
        if item["status"] == "not_assessed":
            ax_score.barh(idx, 10.0, height=0.56, color="#F1F5F9", edgecolor="#94A3B8", hatch="//", linewidth=0.9)
            ax_score.text(
                5.0,
                idx,
                f"Not assessed (<2 observed checks) • {item['confidence']} confidence",
                va="center",
                ha="center",
                fontsize=9.5,
                fontweight="bold",
                color=SLATE,
            )
        else:
            val = float(item["score"])
            tx = min(9.85, val + 0.2)
            ax_score.text(
                tx,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.1f}/10 ({item['confidence']})",
                va="center",
                ha="left",
                fontsize=9.5,
                fontweight="bold",
                color=NAVY,
            )

    ax_score.axvline(x=6, color=RED, linewidth=0.9, linestyle="--", alpha=0.55)
    ax_score.axvline(x=8, color=GREEN, linewidth=0.9, linestyle="--", alpha=0.55)
    ax_score.set_yticks(y_pos, labels=labels, fontsize=10.5, fontweight="bold", color=NAVY)
    ax_score.set_xlim(0, 11.8)
    ax_score.set_xlabel("Bounded Score on Observed Controls (0–10; unknowns excluded)", fontsize=9.5, color=SLATE)
    ax_score.set_title("Bounded WAF Pillar Scores", fontsize=12, fontweight="bold", color=NAVY, pad=10)
    ax_score.grid(axis="x", color="#E2E8F0", linewidth=0.8)

    # Right panel: 100% stacked evidence coverage breakdown
    passed_pct, tradeoff_pct, risk_pct, unknown_pct = [], [], [], []
    totals = []
    for item in ordered:
        p = int(item["passed_checks"])
        t_cnt = int(item["intentional_tradeoff_checks"])
        r = int(item["risk_checks"])
        u = int(item["unknown_checks"])
        tot = max(1, p + t_cnt + r + u)
        totals.append(p + t_cnt + r + u)
        passed_pct.append(p * 100.0 / tot)
        tradeoff_pct.append(t_cnt * 100.0 / tot)
        risk_pct.append(r * 100.0 / tot)
        unknown_pct.append(u * 100.0 / tot)

    left1 = np.array(passed_pct)
    left2 = left1 + np.array(tradeoff_pct)
    left3 = left2 + np.array(risk_pct)

    ax_cov.barh(y_pos, passed_pct, height=0.56, color=GREEN, label="Observed passing")
    ax_cov.barh(y_pos, tradeoff_pct, left=left1, height=0.56, color=BLUE, label="Intentional lab trade-off")
    ax_cov.barh(y_pos, risk_pct, left=left2, height=0.56, color=AMBER, label="Observed gap / risk")
    ax_cov.barh(
        y_pos,
        unknown_pct,
        left=left3,
        height=0.56,
        color="#E2E8F0",
        edgecolor="#94A3B8",
        hatch="..",
        label="Unverified",
    )
    for idx, tot in enumerate(totals):
        obs = ordered[idx]["passed_checks"] + ordered[idx]["intentional_tradeoff_checks"] + ordered[idx]["risk_checks"]
        pct = int(round(obs * 100.0 / max(1, tot)))
        ax_cov.text(101.5, idx, f"{pct}% obs ({obs}/{tot})", va="center", ha="left", fontsize=9, color=SLATE)

    ax_cov.set_yticks(y_pos, labels=[""] * len(ordered))
    ax_cov.set_xlim(0, 122)
    ax_cov.set_xlabel("Control Evidence Mix (%)", fontsize=9.5, color=SLATE, labelpad=6)
    ax_cov.set_title("Evidence Coverage & Gap Breakdown", fontsize=12, fontweight="bold", color=NAVY, pad=10)
    ax_cov.legend(loc="upper center", bbox_to_anchor=(0.45, -0.22), ncol=2, fontsize=8.5, frameon=True)

    fig.suptitle(
        f"{waf_doc['project']} — Well-Architected Posture & Evidence Coverage (as of {waf_doc['as_of'][:10]})",
        fontsize=13.5,
        fontweight="bold",
        color=NAVY,
        y=0.99,
    )
    plt.tight_layout(rect=(0, 0.12, 1, 0.94))
    save_figure(fig, out_base, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def render_cost_trends(cost_doc: dict[str, Any], out_base: Path) -> None:
    scopes: list[str] = list(cost_doc.get("scopes", []))
    evidence: list[dict[str, Any]] = list(cost_doc.get("evidence", []))
    estimates: list[dict[str, Any]] = list(cost_doc.get("estimates", []))

    fig, ax = plt.subplots(figsize=(12.5, 4.8))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor("#FFFFFF")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#CBD5E1")

    currencies = sorted(
        {
            s["currency"]
            for item in evidence
            for s in item.get("series", [])
            if item.get("status") == "complete" and s.get("currency")
        }
        | {est["currency"] for est in estimates if est.get("status") == "complete" and est.get("currency")}
    )

    if not scopes or (not currencies and not estimates):
        # IaC-only or unassessed billing banner
        if estimates and any(e.get("monthly_total") is not None for e in estimates):
            valid_ests = [e for e in estimates if e.get("monthly_total") is not None]
            names = [e["id"] for e in valid_ests]
            vals = [float(e["monthly_total"]) for e in valid_ests]
            cur = valid_ests[0]["currency"]
            bars = ax.bar(names, vals, width=0.45, color=BLUE)
            for bar, val in zip(bars, vals, strict=True):
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    val,
                    f"{cur} {val:,.2f}",
                    ha="center",
                    va="bottom",
                    fontsize=9.5,
                    fontweight="bold",
                    color=NAVY,
                )
            ax.set_ylabel(f"Estimated Monthly Retail Cost ({cur})", fontsize=10, color=SLATE)
            ax.set_title(
                "Labelled IaC Retail Cost Estimates (not live Azure billing)",
                fontsize=12.5,
                fontweight="bold",
                color=NAVY,
            )
        else:
            ax.set_xticks([])
            ax.set_yticks([])
            ax.text(
                0.5,
                0.5,
                "Live Azure Cost Management data not assessed or unavailable for this scope.\n"
                "Unknown spend is never plotted as zero.",
                ha="center",
                va="center",
                fontsize=11.5,
                fontweight="bold",
                color=SLATE,
                transform=ax.transAxes,
            )
            ax.set_title("Subscription Spend & Forecast Trends", fontsize=12.5, fontweight="bold", color=NAVY)
        plt.tight_layout()
        save_figure(fig, out_base, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        return

    primary_currency = currencies[0]
    periods = cost_doc.get("periods", [])
    hist_periods = [p for p in periods if p.get("kind") != "forecast"]
    forecast_period = next((p for p in periods if p.get("kind") == "forecast"), None)

    x = np.arange(len(scopes))
    slot_count = len(hist_periods) + (1 if forecast_period else 0)
    width = min(0.20, 0.76 / max(1, slot_count))
    palette = ["#64748B", BLUE, TEAL]

    max_val = 1.0
    for scope in scopes:
        for period in hist_periods:
            ev = next(
                (
                    e
                    for e in evidence
                    if e["request"]["scope"].lower() == scope.lower() and e["request"]["period"]["id"] == period["id"]
                ),
                None,
            )
            series = next(
                (
                    s
                    for s in (ev or {}).get("series", [])
                    if s.get("currency") == primary_currency and s.get("cost_status") == "Actual"
                ),
                None,
            )
            if ev and ev.get("status") == "complete" and series:
                max_val = max(max_val, float(series["amount"]))
        if forecast_period:
            fev = next(
                (
                    e
                    for e in evidence
                    if e["request"]["scope"].lower() == scope.lower()
                    and e["request"]["period"]["id"] == forecast_period["id"]
                ),
                None,
            )
            if fev and fev.get("status") == "complete":
                act = sum(
                    float(s["amount"])
                    for s in fev.get("series", [])
                    if s.get("currency") == primary_currency and s.get("cost_status") == "Actual"
                )
                proj = sum(
                    float(s["amount"])
                    for s in fev.get("series", [])
                    if s.get("currency") == primary_currency and s.get("cost_status") == "Forecast"
                )
                max_val = max(max_val, act + proj)

    na_height = max_val * 0.12
    for p_idx, period in enumerate(hist_periods):
        offset = (p_idx - (slot_count - 1) / 2) * (width + 0.02)
        color = palette[p_idx % len(palette)]
        for s_idx, scope in enumerate(scopes):
            ev = next(
                (
                    e
                    for e in evidence
                    if e["request"]["scope"].lower() == scope.lower() and e["request"]["period"]["id"] == period["id"]
                ),
                None,
            )
            series = next(
                (
                    s
                    for s in (ev or {}).get("series", [])
                    if s.get("currency") == primary_currency and s.get("cost_status") == "Actual"
                ),
                None,
            )
            xpos = x[s_idx] + offset
            if ev and ev.get("status") == "complete" and series is not None:
                val = float(series["amount"])
                ax.bar(
                    xpos,
                    val,
                    width=width,
                    color=color,
                    label=f"{period['id']} (Actual)" if s_idx == 0 else None,
                )
                ax.text(xpos, val + max_val * 0.015, f"{val:,.0f}", ha="center", va="bottom", fontsize=8, color=NAVY)
            else:
                ax.bar(
                    xpos,
                    na_height,
                    width=width,
                    color="#F1F5F9",
                    edgecolor="#94A3B8",
                    hatch="//",
                    label="Not assessed / throttled" if s_idx == 0 and p_idx == 0 else None,
                )
                ax.text(
                    xpos, na_height / 2, "N/A", ha="center", va="center", fontsize=7.5, fontweight="bold", color=SLATE
                )

    if forecast_period:
        offset = ((slot_count - 1) - (slot_count - 1) / 2) * (width + 0.02)
        for s_idx, scope in enumerate(scopes):
            fev = next(
                (
                    e
                    for e in evidence
                    if e["request"]["scope"].lower() == scope.lower()
                    and e["request"]["period"]["id"] == forecast_period["id"]
                ),
                None,
            )
            xpos = x[s_idx] + offset
            if fev and fev.get("status") == "complete":
                act = sum(
                    float(s["amount"])
                    for s in fev.get("series", [])
                    if s.get("currency") == primary_currency and s.get("cost_status") == "Actual"
                )
                proj = sum(
                    float(s["amount"])
                    for s in fev.get("series", [])
                    if s.get("currency") == primary_currency and s.get("cost_status") == "Forecast"
                )
                ax.bar(
                    xpos,
                    act,
                    width=width,
                    color="#93C5FD",
                    label="Forecast API: Actual-to-date" if s_idx == 0 else None,
                )
                ax.bar(
                    xpos,
                    proj,
                    bottom=act,
                    width=width,
                    color=AMBER,
                    label="Forecast API: Projected remainder" if s_idx == 0 else None,
                )
                ax.text(
                    xpos,
                    act + proj + max_val * 0.015,
                    f"{act + proj:,.0f}",
                    ha="center",
                    va="bottom",
                    fontsize=8,
                    color=NAVY,
                )
            else:
                ax.bar(xpos, na_height, width=width, color="#F1F5F9", edgecolor="#94A3B8", hatch="//")
                ax.text(
                    xpos, na_height / 2, "N/A", ha="center", va="center", fontsize=7.5, fontweight="bold", color=SLATE
                )

    ax.set_xticks(
        x, labels=[short_scope_label(s, idx) for idx, s in enumerate(scopes)], fontsize=9.5, fontweight="bold"
    )
    ax.set_ylim(0, max_val * 1.22)
    ax.set_ylabel(f"Pre-Tax Amount ({primary_currency})", fontsize=10, color=SLATE)
    currency_note = (
        f" ({primary_currency}; additional currencies omitted)" if len(currencies) > 1 else f" ({primary_currency})"
    )
    ax.set_title(
        f"Scoped Actual Spend vs. Forecast API Breakdown{currency_note}\n"
        "MTD Query and Forecast API series are plotted separately and never summed together",
        fontsize=11.5,
        fontweight="bold",
        color=NAVY,
        pad=10,
    )
    ax.grid(axis="y", color="#E2E8F0", linewidth=0.8)
    handles, labels = ax.get_legend_handles_labels()
    if not any("Not assessed" in lbl for lbl in labels):
        handles.append(mpatches.Patch(facecolor="#F1F5F9", edgecolor="#94A3B8", hatch="//", label="N/A (not assessed)"))
    ax.legend(handles=handles, loc="upper right", fontsize=8.5, frameon=True)
    plt.tight_layout()
    save_figure(fig, out_base, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def render_cost_drivers(cost_doc: dict[str, Any], out_base: Path) -> None:
    scopes: list[str] = list(cost_doc.get("scopes", []))
    evidence: list[dict[str, Any]] = list(cost_doc.get("evidence", []))
    scope_index = {s.lower(): short_scope_label(s, idx) for idx, s in enumerate(scopes)}

    # Rank service cost drivers from the most recent closed_month with grouped rows (fallback to any complete query).
    closed_periods = sorted(
        [p for p in cost_doc.get("periods", []) if p.get("kind") == "closed_month"],
        key=lambda p: str(p.get("to", "")),
        reverse=True,
    )
    target_period = None
    for candidate in closed_periods:
        has_groups = any(
            item.get("status") == "complete"
            and item["request"]["operation"] == "query"
            and item["request"]["period"]["id"] == candidate["id"]
            and any(s.get("groups") for s in item.get("series", []))
            for item in evidence
        )
        if has_groups:
            target_period = candidate["id"]
            break
    if target_period is None and closed_periods:
        target_period = closed_periods[0]["id"]
    driver_totals: dict[tuple[str, str], float] = {}
    currency = "USD"
    for item in evidence:
        if item.get("status") != "complete" or item["request"]["operation"] != "query":
            continue
        if target_period and item["request"]["period"]["id"] != target_period:
            continue
        s_label = scope_index.get(item["request"]["scope"].lower(), "Scope")
        for series in item.get("series", []):
            if series.get("cost_status") != "Actual":
                continue
            currency = series["currency"]
            for grp in series.get("groups", []):
                svc = grp.get("dimensions", {}).get("ServiceName") or "Unattributed service"
                amt = float(grp["amount"])
                if amt > 0:
                    driver_totals[(f"{s_label} • {svc}", currency)] = (
                        driver_totals.get((f"{s_label} • {svc}", currency), 0.0) + amt
                    )

    fig, ax = plt.subplots(figsize=(11.5, 4.6))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor("#FFFFFF")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#CBD5E1")

    ranked = sorted(
        [(label, amt) for (label, cur), amt in driver_totals.items() if cur == currency],
        key=lambda pair: pair[1],
        reverse=True,
    )[:10]

    if not ranked:
        ax.set_xticks([])
        ax.set_yticks([])
        ax.text(
            0.5,
            0.5,
            "No closed-month service-attributed actual cost drivers available.\n"
            "Inspect contracts/03-cost-management.json for ungrouped or estimated items.",
            ha="center",
            va="center",
            fontsize=11,
            fontweight="bold",
            color=SLATE,
            transform=ax.transAxes,
        )
        ax.set_title("Top Service Cost Drivers", fontsize=12.5, fontweight="bold", color=NAVY)
    else:
        ranked.reverse()
        labels = [item[0] for item in ranked]
        values = [item[1] for item in ranked]
        bars = ax.barh(labels, values, height=0.58, color=BLUE, edgecolor="white")
        max_v = max(values)
        for bar, val in zip(bars, values, strict=True):
            ax.text(
                val + max_v * 0.015,
                bar.get_y() + bar.get_height() / 2,
                f"{currency} {val:,.2f}",
                va="center",
                ha="left",
                fontsize=9,
                fontweight="bold",
                color=NAVY,
            )
        ax.set_xlim(0, max_v * 1.24)
        ax.set_xlabel(f"Closed-Month Actual Spend ({currency})", fontsize=9.5, color=SLATE)
        period_note = f" ({target_period})" if target_period else ""
        ax.set_title(
            f"Top Scoped Service Cost Drivers{period_note}",
            fontsize=12.5,
            fontweight="bold",
            color=NAVY,
            pad=10,
        )
        ax.grid(axis="x", color="#E2E8F0", linewidth=0.8)

    plt.tight_layout()
    save_figure(fig, out_base, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def render_all_assessment_charts(project_dir: Path) -> dict[str, list[str]]:
    resolved = project_dir.resolve(strict=True)
    waf_path = resolved / "_meta/waf-scores.json"
    cost_path = resolved / "contracts/03-cost-management.json"
    assets_dir = resolved / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    waf_doc = json.loads(waf_path.read_text(encoding="utf-8"))
    cost_doc = json.loads(cost_path.read_text(encoding="utf-8"))

    render_waf_posture(waf_doc, assets_dir / "02-waf-posture")
    render_cost_trends(cost_doc, assets_dir / "03-cost-trends")
    render_cost_drivers(cost_doc, assets_dir / "03-cost-drivers")

    expected = [
        "assets/02-waf-posture.png",
        "assets/02-waf-posture.svg",
        "assets/03-cost-trends.png",
        "assets/03-cost-trends.svg",
        "assets/03-cost-drivers.png",
        "assets/03-cost-drivers.svg",
    ]
    for rel in expected:
        target = resolved / rel
        if not target.is_file() or target.stat().st_size == 0:
            raise RuntimeError(f"Expected chart output missing or empty: {rel}")
    return {"outputs": expected}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True, help="Path to agent-output/<project>")
    args = parser.parse_args(argv)
    try:
        result = render_all_assessment_charts(args.project_dir)
        print(json.dumps({"valid": True, **result}))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"valid": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
