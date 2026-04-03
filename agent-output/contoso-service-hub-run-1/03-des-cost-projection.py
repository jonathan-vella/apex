import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]
costs = [7682.67, 7860.00, 8125.00, 8460.00, 8910.00, 9480.00]
budget_cap = 10000.00

x = np.arange(len(months))
fig, ax = plt.subplots(figsize=(10, 5))
fig.patch.set_facecolor("#F8F9FA")
ax.set_facecolor("#F8F9FA")

bars = ax.bar(x, costs, color="#0078D4", alpha=0.85, edgecolor="white", linewidth=1.5, width=0.55)
for bar, cost in zip(bars, costs):
    ax.text(
        bar.get_x() + bar.get_width() / 2,
        bar.get_height() + max(costs) * 0.015,
        f"${cost:,.0f}",
        ha="center",
        va="bottom",
        fontsize=9,
        fontweight="bold",
        color="#333333",
    )

trend = np.poly1d(np.polyfit(x, costs, 1))
x_smooth = np.linspace(0, len(months) - 1, 200)
ax.plot(x_smooth, trend(x_smooth), color="#FF8C00", linewidth=2, linestyle="--", alpha=0.8, label="Trend")
ax.axhline(budget_cap, color="#DC3545", linewidth=1.5, linestyle=":", alpha=0.8, label=f"Budget cap ${budget_cap:,.0f}")

ax.set_xticks(x)
ax.set_xticklabels(months, fontsize=10, color="#333333")
ax.set_ylabel("Monthly Cost (USD)", fontsize=10, color="#555555")
ax.set_title("6-Month Cost Projection", fontsize=13, fontweight="bold", color="#1A1A2E", pad=22)
ax.text(0.5, 1.02, "Based on estimated user growth and cache scaling assumptions",
        transform=ax.transAxes, ha="center", fontsize=9, color="#888888", style="italic")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda value, _: f"${value:,.0f}"))
ax.tick_params(axis="y", labelsize=9, colors="#666666")
ax.spines[["top", "right"]].set_visible(False)
ax.spines[["left", "bottom"]].set_color("#DDDDDD")
ax.grid(axis="y", color="#E0E0E0", linewidth=0.8, alpha=0.7)
ax.set_ylim(0, max(costs) * 1.25)
ax.legend(fontsize=9, framealpha=0.9, edgecolor="#CCCCCC")

plt.tight_layout(pad=1.4)
plt.savefig("/workspaces/azure-agentic-infraops/agent-output/contoso-service-hub-run-1/03-des-cost-projection.png", dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
