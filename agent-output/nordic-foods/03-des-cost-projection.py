"""6-month cost projection chart for nordic-foods Step 2.

Projection assumes:
- Months 1-2: ramp-up (~85% of steady state) as autoscale tunes and traffic grows
- Months 3-4: steady state at design estimate
- Months 5-6: peak season approaching (storage growth + diagnostic verbosity drift
  push monthly cost ~5-8% above steady state)
"""
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np


def generate_cost_projection_chart(months, costs, output_path,
                                   budget_cap=None, growth_assumption=None):
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    x = np.arange(len(months))
    bars = ax.bar(x, costs, color="#0078D4", alpha=0.85,
                  edgecolor="white", linewidth=1.5, width=0.55)

    for bar, cost in zip(bars, costs):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + max(costs) * 0.015,
                f"${cost:,.0f}", ha="center", va="bottom",
                fontsize=9, fontweight="bold", color="#333")

    z = np.polyfit(x, costs, 1)
    p = np.poly1d(z)
    x_smooth = np.linspace(0, len(months) - 1, 200)
    ax.plot(x_smooth, p(x_smooth), color="#FF8C00", linewidth=2,
            linestyle="--", alpha=0.8, label="Trend")

    if budget_cap is not None:
        ax.axhline(budget_cap, color="#DC3545", linewidth=1.5,
                   linestyle=":", alpha=0.8,
                   label=f"Budget cap  ${budget_cap:,.0f} (≈ €500)")

    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=10, color="#333")
    ax.set_ylabel("Monthly Cost (USD)", fontsize=10, color="#555")

    ax.set_title("nordic-foods — 6-Month Cost Projection (Secure-Plus)",
                 fontsize=13, fontweight="bold",
                 color="#1A1A2E", pad=22 if growth_assumption else 14)
    if growth_assumption:
        ax.text(0.5, 1.02, growth_assumption, transform=ax.transAxes,
                ha="center", fontsize=9, color="#888", style="italic")

    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"${v:,.0f}"))
    ax.tick_params(axis="y", labelsize=9, colors="#666")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#DDD")
    ax.grid(axis="y", color="#E0E0E0", linewidth=0.8, alpha=0.7)
    ax.set_ylim(0, max(max(costs), budget_cap or 0) * 1.25)
    ax.legend(fontsize=9, framealpha=0.9, edgecolor="#CCC")

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


if __name__ == "__main__":
    months = ["M1 (ramp)", "M2 (ramp)", "M3 (steady)",
              "M4 (steady)", "M5 (pre-peak)", "M6 (peak)"]
    costs = [369, 391, 435, 435, 458, 470]
    generate_cost_projection_chart(
        months, costs,
        output_path="agent-output/nordic-foods/03-des-cost-projection.png",
        budget_cap=540,  # €500 × $1.08/€
        growth_assumption=("Ramp Months 1-2 at ~85% of steady state, "
                           "+5-8% in pre-peak / peak (storage growth + diagnostic drift)"),
    )
