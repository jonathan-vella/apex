"""Generate design vs as-built cost comparison chart for nordic-fresh-foods."""

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np


def generate_cost_comparison_chart(categories: list[str], design_costs: list[float], actual_costs: list[float], output_path: str) -> None:
    x = np.arange(len(categories))
    width = 0.38

    fig, ax = plt.subplots(figsize=(11, 5))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    bars_design = ax.bar(x - width / 2, design_costs, width, label="Design Estimate", color="#5B9BD5", alpha=0.85, edgecolor="white", linewidth=1.2)
    bars_actual = ax.bar(x + width / 2, actual_costs, width, label="As-Built Actual", color="#0078D4", alpha=0.95, edgecolor="white", linewidth=1.2)

    max_val = max(max(design_costs), max(actual_costs))
    for bar in list(bars_design) + list(bars_actual):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max_val * 0.012, f"${bar.get_height():,.0f}", ha="center", va="bottom", fontsize=8, fontweight="bold", color="#333")

    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontsize=10, color="#333")
    ax.set_ylabel("Monthly Cost (USD)", fontsize=10, color="#555")
    ax.set_title("Design Estimate vs As-Built Actual Cost", fontsize=13, fontweight="bold", color="#1A1A2E", pad=14)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"${v:,.0f}"))
    ax.tick_params(axis="y", labelsize=9, colors="#666")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#DDD")
    ax.grid(axis="y", color="#E0E0E0", linewidth=0.8, alpha=0.7)
    ax.set_ylim(0, max_val * 1.35)
    ax.legend(fontsize=10, framealpha=0.9, edgecolor="#CCC")

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()


if __name__ == "__main__":
    categories = ["Compute", "Data", "Network", "Security", "Monitoring", "Total"]
    design_costs = [159.14, 21.88, 15.60, 0.0, 7.35, 203.97]
    actual_costs = [146.00, 16.57, 1.50, 5.30, 194.40, 363.77]
    generate_cost_comparison_chart(
        categories,
        design_costs,
        actual_costs,
        output_path="agent-output/nordic-fresh-foods/07-ab-cost-comparison.png",
    )
