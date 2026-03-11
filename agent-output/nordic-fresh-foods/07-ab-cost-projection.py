"""Generate as-built monthly cost projection chart for nordic-fresh-foods."""

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np


def generate_cost_projection_chart(months: list[str], costs: list[float], output_path: str, budget_cap: float | None = None) -> None:
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    x = np.arange(len(months))
    bars = ax.bar(x, costs, color="#0078D4", alpha=0.85, edgecolor="white", linewidth=1.5, width=0.55)

    for bar, cost in zip(bars, costs):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(costs) * 0.015, f"${cost:,.0f}", ha="center", va="bottom", fontsize=9, fontweight="bold", color="#333")

    z = np.polyfit(x, costs, 1)
    p = np.poly1d(z)
    x_smooth = np.linspace(0, len(months) - 1, 200)
    ax.plot(x_smooth, p(x_smooth), color="#FF8C00", linewidth=2, linestyle="--", alpha=0.8, label="Trend")

    if budget_cap is not None:
        ax.axhline(budget_cap, color="#DC3545", linewidth=1.5, linestyle=":", alpha=0.8, label=f"Budget cap  ${budget_cap:,.0f}")

    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=10, color="#333")
    ax.set_ylabel("Monthly Cost (USD)", fontsize=10, color="#555")
    ax.set_title("As-Built 6-Month Cost Projection", fontsize=13, fontweight="bold", color="#1A1A2E", pad=14)
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


if __name__ == "__main__":
    months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]
    costs = [364, 364, 395, 410, 437, 410]
    generate_cost_projection_chart(
        months,
        costs,
        output_path="agent-output/nordic-fresh-foods/07-ab-cost-projection.png",
        budget_cap=800,
    )
