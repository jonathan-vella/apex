<!-- ref:waf-cost-charts-v1 -->

# WAF Pillar & Cost Visualization Charts

Generate professional, styled data-visualization charts for Azure Well-Architected
Framework assessments and cost estimates. All charts output to PNG via matplotlib.

---

## Chart 1 – WAF Pillar Scores (Horizontal Bar)

Used in: `02-architecture-assessment.md` → saved as `02-waf-scores.png`

```python
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

def generate_waf_chart(scores: dict, output_path: str = "02-waf-scores.png") -> None:
    """
    Render a horizontal bar chart of WAF pillar scores (0–10).

    scores: dict mapping pillar label → numeric score, e.g.
        {
            "🔒 Security":               8.5,
            "🔄 Reliability":            7.0,
            "⚡ Performance Efficiency": 7.5,
            "💰 Cost Optimization":      6.0,
            "🔧 Operational Excellence": 8.0,
        }
    """
    # WAF pillar brand colours (Microsoft WAF palette)
    PILLAR_COLORS = {
        "🔒 Security":               "#C00000",   # deep red
        "🔄 Reliability":            "#107C10",   # Microsoft green
        "⚡ Performance Efficiency": "#FF8C00",   # orange
        "💰 Cost Optimization":      "#FFB900",   # gold
        "🔧 Operational Excellence": "#8764B8",   # purple
    }

    pillars = list(scores.keys())
    values  = [scores[p] for p in pillars]
    colors  = [PILLAR_COLORS.get(p, "#0078D4") for p in pillars]

    fig, ax = plt.subplots(figsize=(10, 4))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    bars = ax.barh(pillars, values, color=colors, height=0.55,
                   edgecolor="white", linewidth=1.2)

    # Score labels inside / at end of each bar
    for bar, val in zip(bars, values):
        label_x = val - 0.3 if val >= 1.5 else val + 0.15
        color    = "white" if val >= 1.5 else "#333"
        ax.text(label_x, bar.get_y() + bar.get_height() / 2,
                f"{val:.1f}", va="center", ha="right" if val >= 1.5 else "left",
                fontsize=11, fontweight="bold", color=color)

    # Threshold reference lines
    ax.axvline(x=6, color="#DC3545", linewidth=1, linestyle="--", alpha=0.6, label="Minimum (6)")
    ax.axvline(x=8, color="#28A745", linewidth=1, linestyle="--", alpha=0.5, label="Target (8)")

    ax.set_xlim(0, 10)
    ax.set_xlabel("Score (out of 10)", fontsize=10, color="#555")
    ax.set_title("Azure Well-Architected Framework — Pillar Scores",
                 fontsize=13, fontweight="bold", color="#1A1A2E", pad=14)
    ax.tick_params(axis="y", labelsize=10, colors="#333")
    ax.tick_params(axis="x", labelsize=9,  colors="#666")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#DDD")
    ax.xaxis.set_major_locator(plt.MultipleLocator(1))
    ax.grid(axis="x", color="#E0E0E0", linewidth=0.8, alpha=0.7)

    legend = ax.legend(fontsize=9, loc="lower right",
                       framealpha=0.9, edgecolor="#CCC")

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


# ── Example usage ──────────────────────────────────────────────────────────────
scores = {
    "🔒 Security":               8.5,
    "🔄 Reliability":            7.0,
    "⚡ Performance Efficiency": 7.5,
    "💰 Cost Optimization":      6.0,
    "🔧 Operational Excellence": 8.0,
}
generate_waf_chart(scores, "agent-output/{project}/02-waf-scores.png")
```

---

## Chart 2 – Cost Distribution (Pie / Donut)

Used in: `03-des-cost-estimate.md` and `07-ab-cost-estimate.md`
Saved as: `03-des-cost-distribution.png` or `07-ab-cost-distribution.png`

```python
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

def generate_cost_distribution_chart(
    categories: dict,
    total_monthly: float,
    output_path: str = "03-des-cost-distribution.png",
) -> None:
    """
    Render a donut chart of cost breakdown by category.

    categories: dict mapping label → monthly cost (USD), e.g.
        {
            "💻 Compute":       535,
            "💾 Data Services": 466,
            "🌐 Networking":    376,
        }
    total_monthly: pre-calculated total (shown in centre of donut)
    """
    PALETTE = [
        "#0078D4",   # Azure blue    – Compute
        "#50E6FF",   # Azure cyan    – Data
        "#1490DF",   # Medium blue   – Networking
        "#773ADC",   # Purple        – Security / Mgmt
        "#FFB900",   # Gold          – Monitoring
        "#107C10",   # Green         – Storage
        "#D13438",   # Red           – Other / Licensing
    ]

    labels  = list(categories.keys())
    values  = list(categories.values())
    colors  = PALETTE[: len(labels)]
    pcts    = [v / sum(values) * 100 for v in values]

    fig, ax = plt.subplots(figsize=(8, 6))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    wedge_props = {"linewidth": 2, "edgecolor": "#F8F9FA"}
    wedges, _ = ax.pie(
        values,
        colors=colors,
        wedgeprops=wedge_props,
        startangle=140,
        pctdistance=0.82,
    )

    # Donut hole
    hole = plt.Circle((0, 0), 0.60, fc="#F8F9FA")
    ax.add_patch(hole)

    # Centre label
    ax.text(0, 0.07, f"${total_monthly:,.0f}", ha="center", va="center",
            fontsize=17, fontweight="bold", color="#1A1A2E")
    ax.text(0, -0.17, "/ month", ha="center", va="center",
            fontsize=10, color="#666")

    # Legend with values and percentages
    legend_labels = [
        f"{lbl}  ${val:,.0f}  ({pct:.0f}%)"
        for lbl, val, pct in zip(labels, values, pcts)
    ]
    patches = [mpatches.Patch(color=c, label=l) for c, l in zip(colors, legend_labels)]
    ax.legend(handles=patches, loc="lower center", bbox_to_anchor=(0.5, -0.15),
              ncol=2, fontsize=9, framealpha=0.0, columnspacing=1.2)

    ax.set_title("Monthly Cost Distribution", fontsize=13, fontweight="bold",
                 color="#1A1A2E", pad=10)

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


# ── Example usage ──────────────────────────────────────────────────────────────
categories = {
    "💻 Compute":       535,
    "💾 Data Services": 466,
    "🌐 Networking":    376,
}
generate_cost_distribution_chart(
    categories,
    total_monthly=sum(categories.values()),
    output_path="agent-output/{project}/03-des-cost-distribution.png",
)
```

---

## Chart 3 – Monthly Cost Projection (Bar + Trend Line)

Used in: `03-des-cost-estimate.md` and `07-ab-cost-estimate.md`
Saved as: `03-des-cost-projection.png` or `07-ab-cost-projection.png`

```python
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

def generate_cost_projection_chart(
    months: list[str],
    costs: list[float],
    output_path: str = "03-des-cost-projection.png",
    budget_cap: float | None = None,
    growth_assumption: str | None = None,
) -> None:
    """
    Render a bar + trend-line chart for 6-month cost projections.

    months: list of month labels, e.g. ["Jan", "Feb", ..., "Jun"]
    costs:  list of monthly costs in USD (same length as months)
    budget_cap: optional horizontal budget line in USD
    growth_assumption: optional subtitle explaining growth basis,
        e.g. "Based on 5% monthly user growth" or "Linear extrapolation"
    """
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    x = np.arange(len(months))
    bar_color = "#0078D4"

    bars = ax.bar(x, costs, color=bar_color, alpha=0.85,
                  edgecolor="white", linewidth=1.5, width=0.55)

    # Value labels above bars
    for bar, cost in zip(bars, costs):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(costs) * 0.015,
                f"${cost:,.0f}", ha="center", va="bottom",
                fontsize=9, fontweight="bold", color="#333")

    # Trend line (linear fit)
    z   = np.polyfit(x, costs, 1)
    p   = np.poly1d(z)
    x_smooth = np.linspace(0, len(months) - 1, 200)
    ax.plot(x_smooth, p(x_smooth), color="#FF8C00", linewidth=2,
            linestyle="--", alpha=0.8, label="Trend")

    # Optional budget cap line
    if budget_cap is not None:
        ax.axhline(budget_cap, color="#DC3545", linewidth=1.5,
                   linestyle=":", alpha=0.8, label=f"Budget cap  ${budget_cap:,.0f}")

    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=10, color="#333")
    ax.set_ylabel("Monthly Cost (USD)", fontsize=10, color="#555")

    # Title with optional growth assumption subtitle
    title = "6-Month Cost Projection"
    ax.set_title(title, fontsize=13, fontweight="bold",
                 color="#1A1A2E", pad=14 if not growth_assumption else 22)
    if growth_assumption:
        ax.text(0.5, 1.02, growth_assumption, transform=ax.transAxes,
                ha="center", fontsize=9, color="#888", style="italic")

    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"${v:,.0f}"))
    ax.tick_params(axis="y", labelsize=9, colors="#666")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#DDD")
    ax.grid(axis="y", color="#E0E0E0", linewidth=0.8, alpha=0.7)
    ax.set_ylim(0, max(costs) * 1.25)

    ax.legend(fontsize=9, framealpha=0.9, edgecolor="#CCC")

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


# ── Example usage ──────────────────────────────────────────────────────────────
months = ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"]
costs  = [1050, 1250, 1380, 1490, 1560, 1600]
generate_cost_projection_chart(
    months, costs,
    output_path="agent-output/{project}/03-des-cost-projection.png",
    budget_cap=1800,
)
```

---

## Chart 4 – Design vs As-Built Cost Comparison (Grouped Bar)

Used in: `07-ab-cost-estimate.md` → saved as `07-ab-cost-comparison.png`

```python
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

def generate_cost_comparison_chart(
    categories: list[str],
    design_costs: list[float],
    actual_costs: list[float],
    output_path: str = "07-ab-cost-comparison.png",
) -> None:
    """
    Render a grouped bar chart comparing design estimate vs as-built actual cost.

    categories:   list of cost category labels (e.g. ["Compute", "Data", ...])
    design_costs: design estimate per category (USD)
    actual_costs: actual as-built cost per category (USD)
    """
    x     = np.arange(len(categories))
    width = 0.38

    fig, ax = plt.subplots(figsize=(11, 5))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    bars_design = ax.bar(x - width / 2, design_costs, width, label="Design Estimate",
                         color="#5B9BD5", alpha=0.85, edgecolor="white", linewidth=1.2)
    bars_actual = ax.bar(x + width / 2, actual_costs, width, label="As-Built Actual",
                         color="#0078D4", alpha=0.95, edgecolor="white", linewidth=1.2)

    # Value labels above bars
    max_val = max(max(design_costs), max(actual_costs))
    for bar in list(bars_design) + list(bars_actual):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max_val * 0.012,
                f"${bar.get_height():,.0f}", ha="center", va="bottom",
                fontsize=8, fontweight="bold", color="#333")

    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontsize=10, color="#333")
    ax.set_ylabel("Monthly Cost (USD)", fontsize=10, color="#555")
    ax.set_title("Design Estimate vs As-Built Actual Cost", fontsize=13,
                 fontweight="bold", color="#1A1A2E", pad=14)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"${v:,.0f}"))
    ax.tick_params(axis="y", labelsize=9, colors="#666")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#DDD")
    ax.grid(axis="y", color="#E0E0E0", linewidth=0.8, alpha=0.7)
    ax.set_ylim(0, max_val * 1.25)
    ax.legend(fontsize=10, framealpha=0.9, edgecolor="#CCC")

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


# ── Example usage ──────────────────────────────────────────────────────────────
categories    = ["Compute", "Data", "Network", "Security", "Monitor", "Total"]
design_costs  = [500, 450, 350, 80, 60, 1440]
actual_costs  = [535, 466, 376, 92, 71, 1540]
generate_cost_comparison_chart(
    categories, design_costs, actual_costs,
    output_path="agent-output/{project}/07-ab-cost-comparison.png",
)
```

---

## Chart 5 – Compliance Gaps by Severity (Horizontal Bar)

Used in: `07-ab-compliance-matrix.md` → saved as `07-ab-compliance-gaps.png`

```python
import matplotlib.pyplot as plt

def generate_compliance_gaps_chart(
    gaps: dict,
    output_path: str = "07-ab-compliance-gaps.png",
) -> None:
    """
    Render a horizontal bar chart of compliance gaps grouped by severity.

    gaps: dict mapping severity label → count, e.g.
        {"🔴 Critical": 2, "🟠 High": 5, "🟡 Medium": 8, "🟢 Low": 3}
    """
    SEVERITY_COLORS = {
        "🔴 Critical": "#C00000",
        "🟠 High":     "#D83B01",
        "🟡 Medium":   "#FFB900",
        "🟢 Low":      "#107C10",
    }

    labels = list(gaps.keys())
    values = list(gaps.values())
    colors = [SEVERITY_COLORS.get(lbl, "#5B9BD5") for lbl in labels]

    fig, ax = plt.subplots(figsize=(8, 3.5))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    bars = ax.barh(labels, values, color=colors, height=0.5,
                   edgecolor="white", linewidth=1.2)

    for bar, val in zip(bars, values):
        ax.text(bar.get_width() + 0.15, bar.get_y() + bar.get_height() / 2,
                str(val), va="center", fontsize=11, fontweight="bold", color="#333")

    ax.set_xlim(0, max(values) * 1.3)
    ax.set_xlabel("Number of Gaps", fontsize=10, color="#555")
    ax.set_title("Compliance Gaps by Severity", fontsize=13,
                 fontweight="bold", color="#1A1A2E", pad=14)
    ax.tick_params(axis="y", labelsize=10, colors="#333")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#DDD")
    ax.grid(axis="x", color="#E0E0E0", linewidth=0.8, alpha=0.7)

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


# ── Example usage ──────────────────────────────────────────────────────────────
gaps = {"🔴 Critical": 2, "🟠 High": 5, "🟡 Medium": 8, "🟢 Low": 3}
generate_compliance_gaps_chart(
    gaps,
    output_path="agent-output/{project}/07-ab-compliance-gaps.png",
)
```

---

## Execution Pattern

For each chart, create a standalone `.py` file and execute it:

```bash
# From the agent-output/{project}/ directory
python 02-waf-scores.py              # → 02-waf-scores.png
python 03-des-cost-distribution.py   # → 03-des-cost-distribution.png
python 03-des-cost-projection.py     # → 03-des-cost-projection.png
python 07-ab-cost-comparison.py      # → 07-ab-cost-comparison.png
python 07-ab-cost-distribution.py    # → 07-ab-cost-distribution.png
python 07-ab-cost-projection.py      # → 07-ab-cost-projection.png
python 07-ab-compliance-gaps.py      # → 07-ab-compliance-gaps.png
```

Or inline all Step-3 charts into `03-des-charts.py` and all Step-7 charts into `07-ab-charts.py`.

---

## Naming Convention

| Chart                   | Python file                   | PNG output                     | Used in     |
| ----------------------- | ----------------------------- | ------------------------------ | ----------- |
| WAF Pillar Scores       | `02-waf-scores.py`            | `02-waf-scores.png`            | Step 2 only |
| Cost Distribution (des) | `03-des-cost-distribution.py` | `03-des-cost-distribution.png` | Step 3      |
| Cost Projection (des)   | `03-des-cost-projection.py`   | `03-des-cost-projection.png`   | Step 3      |
| Cost Distribution (ab)  | `07-ab-cost-distribution.py`  | `07-ab-cost-distribution.png`  | Step 7      |
| Cost Projection (ab)    | `07-ab-cost-projection.py`    | `07-ab-cost-projection.png`    | Step 7      |
| Design vs As-Built      | `07-ab-cost-comparison.py`    | `07-ab-cost-comparison.png`    | Step 7      |
| Compliance Gaps         | `07-ab-compliance-gaps.py`    | `07-ab-compliance-gaps.png`    | Step 7      |

---

## Design Tokens (keep consistent across all charts)

| Token          | Value                            | Usage                    |
| -------------- | -------------------------------- | ------------------------ |
| Background     | `#F8F9FA`                        | Figure + axes background |
| Title colour   | `#1A1A2E`                        | Chart title text         |
| Azure blue     | `#0078D4`                        | Primary bars / accent    |
| Minimum line   | `#DC3545`                        | Red dashed reference     |
| Target line    | `#28A745`                        | Green dashed reference   |
| Trend line     | `#FF8C00`                        | Orange dashed trend      |
| Grid / border  | `#E0E0E0`                        | Light grey grid          |
| DPI            | 150                              | Crisp PNG output         |
| Font (default) | matplotlib default (DejaVu Sans) | —                        |
