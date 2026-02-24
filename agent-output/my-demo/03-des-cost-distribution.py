import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np


def generate_cost_distribution_chart(
    categories: dict,
    total_monthly: float,
    output_path: str = "03-des-cost-distribution.png",
) -> None:
    """Render a donut chart of cost breakdown by category."""
    PALETTE = [
        "#0078D4",
        "#50E6FF",
        "#1490DF",
        "#773ADC",
        "#FFB900",
        "#107C10",
        "#D13438",
    ]

    labels = list(categories.keys())
    values = list(categories.values())
    colors = PALETTE[: len(labels)]
    pcts = [v / sum(values) * 100 for v in values]

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

    hole = plt.Circle((0, 0), 0.60, fc="#F8F9FA")
    ax.add_patch(hole)

    ax.text(
        0, 0.07, f"${total_monthly:,.2f}", ha="center", va="center",
        fontsize=17, fontweight="bold", color="#1A1A2E",
    )
    ax.text(0, -0.17, "/ month", ha="center", va="center", fontsize=10, color="#666")

    legend_labels = [
        f"{lbl}  ${val:,.2f}  ({pct:.0f}%)"
        for lbl, val, pct in zip(labels, values, pcts)
    ]
    patches = [mpatches.Patch(color=c, label=l) for c, l in zip(colors, legend_labels)]
    ax.legend(
        handles=patches, loc="lower center", bbox_to_anchor=(0.5, -0.15),
        ncol=2, fontsize=9, framealpha=0.0, columnspacing=1.2,
    )

    ax.set_title(
        "Monthly Cost Distribution", fontsize=13, fontweight="bold",
        color="#1A1A2E", pad=10,
    )

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


categories = {
    "🌐 Hosting (SWA Standard)": 9.00,
    "⚡ Compute (Functions Consumption)": 0.001,
    "📊 Monitoring (App Insights Free)": 0.001,
}
generate_cost_distribution_chart(
    categories,
    total_monthly=9.00,
    output_path="agent-output/my-demo/03-des-cost-distribution.png",
)
