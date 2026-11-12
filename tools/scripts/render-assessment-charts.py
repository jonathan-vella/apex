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


def format_trend_amount(val: float) -> str:
    if val == 0:
        return "0"
    abs_val = abs(val)
    if abs_val < 0.01:
        return f"{'-' if val < 0 else ''}<0.01"
    if abs_val < 10.0:
        return f"{val:,.2f}"
    return f"{val:,.0f}"


def is_empty_no_rows_slice(entry: dict[str, Any] | None, series: dict[str, Any] | None) -> bool:
    if not entry or not series:
        return False
    return bool(
        entry.get("status") == "complete"
        and entry.get("request", {}).get("operation") == "query"
        and not series.get("groups")
        and any("empty historical period" in str(gap).lower() for gap in entry.get("gaps", []))
    )


def load_scope_names(project_dir: Path) -> dict[str, str]:
    names: dict[str, str] = {}
    for rel, list_key in (
        ("_meta/live-inventory.json", "inventories"),
        ("_meta/01-discovered-evidence.json", "subscriptions"),
    ):
        candidate = project_dir / rel
        if not candidate.is_file() or candidate.is_symlink():
            continue
        try:
            doc = json.loads(candidate.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        for item in doc.get(list_key) or []:
            if not isinstance(item, dict):
                continue
            sub_id = str(item.get("subscription_id") or "").strip().lower()
            sub_name = str(item.get("subscription_name") or "").strip()
            if sub_id and sub_name:
                names.setdefault(sub_id, sub_name)
    brief = project_dir / "_meta/user-brief.json"
    if brief.is_file() and not brief.is_symlink():
        try:
            bdoc = json.loads(brief.read_text(encoding="utf-8"))
            subs = (bdoc.get("read_authorization") or {}).get("subscriptions")
            if isinstance(subs, list):
                for entry in subs:
                    if isinstance(entry, dict):
                        sid = str(entry.get("id") or entry.get("subscription_id") or "").strip().lower()
                        sname = str(entry.get("name") or entry.get("display_name") or "").strip()
                        if sid and sname:
                            names.setdefault(sid, sname)
        except json.JSONDecodeError:
            pass
    return names


def short_scope_label(scope: str, index: int, scope_names: dict[str, str] | None = None) -> str:
    lower = scope.lower()
    if "/resourcegroups/" in lower:
        rg = scope.split("/")[-1]
        sub_short = scope.split("/")[2][:8]
        return f"{rg} ({sub_short})"
    parts = scope.strip("/").split("/")
    if len(parts) >= 2:
        sub_id = parts[1].lower()
        sub_short = parts[1][:8]
        display = (scope_names or {}).get(sub_id)
        if display:
            return f"{display} ({sub_short})"
        return f"Sub {index + 1} ({sub_short})"
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


def render_cost_trends(
    cost_doc: dict[str, Any],
    out_base: Path,
    *,
    scope_names: dict[str, str] | None = None,
) -> None:
    scopes: list[str] = list(cost_doc.get("scopes", []))
    evidence: list[dict[str, Any]] = list(cost_doc.get("evidence", []))
    estimates: list[dict[str, Any]] = list(cost_doc.get("estimates", []))

    live_currencies = sorted(
        {
            s["currency"]
            for item in evidence
            if item.get("status") == "complete"
            for s in item.get("series", [])
            if s.get("currency")
        }
    )
    valid_ests = [
        e
        for e in estimates
        if e.get("status") == "complete" and e.get("monthly_total") is not None and e.get("currency")
    ]

    if not scopes or not live_currencies:
        if valid_ests:
            est_currencies = sorted({str(e["currency"]) for e in valid_ests})
            fig, axes_grid = plt.subplots(
                1,
                len(est_currencies),
                figsize=(max(8.5, 6.2 * len(est_currencies)), 4.6),
                squeeze=False,
            )
            fig.patch.set_facecolor(BG)
            for idx, cur in enumerate(est_currencies):
                ax = axes_grid[0, idx]
                ax.set_facecolor("#FFFFFF")
                ax.spines[["top", "right"]].set_visible(False)
                ax.spines[["left", "bottom"]].set_color("#CBD5E1")
                subset = [e for e in valid_ests if e["currency"] == cur]
                names = [str(e["id"]) for e in subset]
                vals = [float(e["monthly_total"]) for e in subset]
                max_e = max([1.0, *vals])
                min_e = min([0.0, *vals])
                span_e = max(1.0, max_e - min_e)
                bars = ax.bar(names, vals, width=0.45, color=BLUE)
                if min_e < 0:
                    ax.axhline(0, color="#64748B", linewidth=0.9)
                for bar, val in zip(bars, vals, strict=True):
                    y_txt = val + span_e * 0.02 if val >= 0 else val - span_e * 0.02
                    ax.text(
                        bar.get_x() + bar.get_width() / 2,
                        y_txt,
                        f"{cur} {val:,.2f}",
                        ha="center",
                        va="bottom" if val >= 0 else "top",
                        fontsize=9.5,
                        fontweight="bold",
                        color=NAVY,
                    )
                ax.set_ylim(min_e - span_e * 0.20 if min_e < 0 else 0, max_e + span_e * 0.22)
                ax.set_ylabel(f"Estimated Monthly Retail Cost ({cur})", fontsize=10, color=SLATE)
                ax.set_title(f"IaC Retail Estimates ({cur})", fontsize=11.5, fontweight="bold", color=NAVY)
                ax.grid(axis="y", color="#E2E8F0", linewidth=0.8)
            fig.suptitle(
                "Labelled IaC Retail Cost Estimates (not live Azure billing)",
                fontsize=13,
                fontweight="bold",
                color=NAVY,
                y=0.99,
            )
            plt.tight_layout(rect=(0, 0, 1, 0.94))
        else:
            fig, ax = plt.subplots(figsize=(12.5, 4.8))
            fig.patch.set_facecolor(BG)
            ax.set_facecolor("#FFFFFF")
            ax.spines[["top", "right"]].set_visible(False)
            ax.spines[["left", "bottom"]].set_color("#CBD5E1")
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

    periods = cost_doc.get("periods", [])
    hist_periods = [p for p in periods if p.get("kind") != "forecast"]
    forecast_period = next((p for p in periods if p.get("kind") == "forecast"), None)
    x = np.arange(len(scopes))
    slot_count = len(hist_periods) + (1 if forecast_period else 0)
    width = min(0.20, 0.76 / max(1, slot_count))
    palette = ["#64748B", BLUE, TEAL]

    fig, axes_grid = plt.subplots(
        len(live_currencies),
        1,
        figsize=(12.5, 4.8 * len(live_currencies)),
        squeeze=False,
    )
    fig.patch.set_facecolor(BG)

    for c_idx, cur in enumerate(live_currencies):
        ax = axes_grid[c_idx, 0]
        ax.set_facecolor("#FFFFFF")
        ax.spines[["top", "right"]].set_visible(False)
        ax.spines[["left", "bottom"]].set_color("#CBD5E1")

        max_val = 1.0
        min_val = 0.0
        for scope in scopes:
            for period in hist_periods:
                ev = next(
                    (
                        e
                        for e in evidence
                        if e["request"]["scope"].lower() == scope.lower()
                        and e["request"]["period"]["id"] == period["id"]
                    ),
                    None,
                )
                series = next(
                    (
                        s
                        for s in (ev or {}).get("series", [])
                        if s.get("currency") == cur and s.get("cost_status") == "Actual"
                    ),
                    None,
                )
                if ev and ev.get("status") == "complete" and series is not None:
                    val = float(series["amount"])
                    max_val = max(max_val, val)
                    min_val = min(min_val, val)
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
                cur_f = [s for s in (fev or {}).get("series", []) if s.get("currency") == cur]
                if fev and fev.get("status") == "complete" and any(s.get("cost_status") == "Forecast" for s in cur_f):
                    act = sum(float(s["amount"]) for s in cur_f if s.get("cost_status") == "Actual")
                    proj = sum(float(s["amount"]) for s in cur_f if s.get("cost_status") == "Forecast")
                    max_val = max(max_val, act + proj, act)
                    min_val = min(min_val, act + proj, act)

        span = max(1.0, max_val - min_val)
        na_height = span * 0.12
        if min_val < 0:
            ax.axhline(0, color="#64748B", linewidth=0.9)

        has_no_rows_badge = False
        labeled_na = False
        for p_idx, period in enumerate(hist_periods):
            offset = (p_idx - (slot_count - 1) / 2) * (width + 0.02)
            color = palette[p_idx % len(palette)]
            labeled_period = False
            for s_idx, scope in enumerate(scopes):
                ev = next(
                    (
                        e
                        for e in evidence
                        if e["request"]["scope"].lower() == scope.lower()
                        and e["request"]["period"]["id"] == period["id"]
                    ),
                    None,
                )
                series = next(
                    (
                        s
                        for s in (ev or {}).get("series", [])
                        if s.get("currency") == cur and s.get("cost_status") == "Actual"
                    ),
                    None,
                )
                xpos = x[s_idx] + offset
                if ev and ev.get("status") == "complete" and series is not None:
                    if is_empty_no_rows_slice(ev, series):
                        has_no_rows_badge = True
                        ax.text(
                            xpos,
                            na_height * 0.65,
                            "NO\nROWS",
                            ha="center",
                            va="center",
                            fontsize=6.8,
                            fontweight="bold",
                            color=NAVY,
                            bbox={
                                "boxstyle": "round,pad=0.22",
                                "facecolor": "#FFFBEB",
                                "edgecolor": AMBER,
                                "linewidth": 1.0,
                            },
                        )
                    else:
                        val = float(series["amount"])
                        ax.bar(
                            xpos,
                            val,
                            width=width,
                            color=color,
                            label=f"{period['id']} (Actual)" if not labeled_period else None,
                        )
                        labeled_period = True
                        y_txt = val + span * 0.015 if val >= 0 else val - span * 0.02
                        ax.text(
                            xpos,
                            y_txt,
                            format_trend_amount(val),
                            ha="center",
                            va="bottom" if val >= 0 else "top",
                            fontsize=8,
                            color=NAVY,
                        )
                else:
                    ax.bar(
                        xpos,
                        na_height,
                        width=width,
                        color="#F1F5F9",
                        edgecolor="#94A3B8",
                        hatch="//",
                        label="Not assessed / throttled" if not labeled_na else None,
                    )
                    labeled_na = True
                    ax.text(
                        xpos,
                        na_height / 2,
                        "N/A",
                        ha="center",
                        va="center",
                        fontsize=7.5,
                        fontweight="bold",
                        color=SLATE,
                    )

        if forecast_period:
            offset = ((slot_count - 1) - (slot_count - 1) / 2) * (width + 0.02)
            labeled_forecast = False
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
                cur_f = [s for s in (fev or {}).get("series", []) if s.get("currency") == cur]
                has_cur_forecast = bool(
                    fev and fev.get("status") == "complete" and any(s.get("cost_status") == "Forecast" for s in cur_f)
                )
                xpos = x[s_idx] + offset
                if has_cur_forecast:
                    act = sum(float(s["amount"]) for s in cur_f if s.get("cost_status") == "Actual")
                    proj = sum(float(s["amount"]) for s in cur_f if s.get("cost_status") == "Forecast")
                    ax.bar(
                        xpos,
                        act,
                        width=width,
                        color="#93C5FD",
                        label="Forecast API: Actual-to-date" if not labeled_forecast else None,
                    )
                    ax.bar(
                        xpos,
                        proj,
                        bottom=act,
                        width=width,
                        color=AMBER,
                        label="Forecast API: Projected remainder" if not labeled_forecast else None,
                    )
                    labeled_forecast = True
                    tot_f = act + proj
                    y_txt = tot_f + span * 0.015 if tot_f >= 0 else tot_f - span * 0.02
                    ax.text(
                        xpos,
                        y_txt,
                        format_trend_amount(tot_f),
                        ha="center",
                        va="bottom" if tot_f >= 0 else "top",
                        fontsize=8,
                        color=NAVY,
                    )
                else:
                    ax.bar(xpos, na_height, width=width, color="#F1F5F9", edgecolor="#94A3B8", hatch="//")
                    ax.text(
                        xpos,
                        na_height / 2,
                        "N/A",
                        ha="center",
                        va="center",
                        fontsize=7.5,
                        fontweight="bold",
                        color=SLATE,
                    )

        ax.set_xticks(
            x,
            labels=[short_scope_label(s, idx, scope_names) for idx, s in enumerate(scopes)],
            fontsize=9.5,
            fontweight="bold",
        )
        ax.set_ylim(min_val - span * 0.20 if min_val < 0 else 0, max_val + span * 0.22)
        ax.set_ylabel(f"Pre-Tax Amount ({cur})", fontsize=10, color=SLATE)
        ax.set_title(
            f"Scoped Actual Spend vs. Forecast API Breakdown ({cur})\n"
            "MTD Query and Forecast API series are plotted separately and never summed together",
            fontsize=11.5,
            fontweight="bold",
            color=NAVY,
            pad=10,
        )
        ax.grid(axis="y", color="#E2E8F0", linewidth=0.8)
        handles, labels = ax.get_legend_handles_labels()
        if not any("Not assessed" in lbl for lbl in labels):
            handles.append(
                mpatches.Patch(facecolor="#F1F5F9", edgecolor="#94A3B8", hatch="//", label="N/A (not assessed)")
            )
        if has_no_rows_badge:
            handles.append(
                mpatches.Patch(
                    facecolor="#FFFBEB",
                    edgecolor=AMBER,
                    label="NO ROWS (empty period; currency inferred)",
                )
            )
        ax.legend(handles=handles, loc="upper right", fontsize=8.5, frameon=True)

    plt.tight_layout()
    save_figure(fig, out_base, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def render_cost_drivers(
    cost_doc: dict[str, Any],
    out_base: Path,
    *,
    scope_names: dict[str, str] | None = None,
) -> None:
    scopes: list[str] = list(cost_doc.get("scopes", []))
    evidence: list[dict[str, Any]] = list(cost_doc.get("evidence", []))
    scope_index = {s.lower(): short_scope_label(s, idx, scope_names) for idx, s in enumerate(scopes)}

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

    # Aggregate signed amounts (including credits/refunds) per (currency, scope•service) before ranking.
    driver_totals: dict[tuple[str, str], float] = {}
    for item in evidence:
        if item.get("status") != "complete" or item["request"]["operation"] != "query":
            continue
        if target_period and item["request"]["period"]["id"] != target_period:
            continue
        s_label = scope_index.get(item["request"]["scope"].lower(), "Scope")
        for series in item.get("series", []):
            if series.get("cost_status") != "Actual" or not series.get("currency"):
                continue
            cur = str(series["currency"])
            for grp in series.get("groups", []):
                svc = grp.get("dimensions", {}).get("ServiceName") or "Unattributed service"
                amt = float(grp["amount"])
                key = (cur, f"{s_label} • {svc}")
                driver_totals[key] = driver_totals.get(key, 0.0) + amt

    driver_currencies = sorted({cur for (cur, _), net in driver_totals.items() if net > 0})
    if not driver_currencies:
        fig, ax = plt.subplots(figsize=(11.5, 4.6))
        fig.patch.set_facecolor(BG)
        ax.set_facecolor("#FFFFFF")
        ax.spines[["top", "right"]].set_visible(False)
        ax.spines[["left", "bottom"]].set_color("#CBD5E1")
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
        plt.tight_layout()
        save_figure(fig, out_base, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        return

    fig, axes_grid = plt.subplots(
        len(driver_currencies),
        1,
        figsize=(11.5, 4.6 * len(driver_currencies)),
        squeeze=False,
    )
    fig.patch.set_facecolor(BG)
    period_note = f" ({target_period})" if target_period else ""

    for idx, cur in enumerate(driver_currencies):
        ax = axes_grid[idx, 0]
        ax.set_facecolor("#FFFFFF")
        ax.spines[["top", "right"]].set_visible(False)
        ax.spines[["left", "bottom"]].set_color("#CBD5E1")
        ranked = sorted(
            [(label, net) for (c, label), net in driver_totals.items() if c == cur and net > 0],
            key=lambda pair: pair[1],
            reverse=True,
        )[:10]
        ranked.reverse()
        labels = [item[0] for item in ranked]
        values = [item[1] for item in ranked]
        bars = ax.barh(labels, values, height=0.58, color=BLUE, edgecolor="white")
        max_v = max(values)
        for bar, val in zip(bars, values, strict=True):
            ax.text(
                val + max_v * 0.015,
                bar.get_y() + bar.get_height() / 2,
                f"{cur} {val:,.2f}",
                va="center",
                ha="left",
                fontsize=9,
                fontweight="bold",
                color=NAVY,
            )
        ax.set_xlim(0, max_v * 1.24)
        ax.set_xlabel(f"Closed-Month Net Actual Spend ({cur})", fontsize=9.5, color=SLATE)
        ax.set_title(
            f"Top Scoped Service Cost Drivers — {cur}{period_note}",
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
    scope_names = load_scope_names(resolved)

    render_waf_posture(waf_doc, assets_dir / "02-waf-posture")
    render_cost_trends(cost_doc, assets_dir / "03-cost-trends", scope_names=scope_names)
    render_cost_drivers(cost_doc, assets_dir / "03-cost-drivers", scope_names=scope_names)

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
