"""Generate as-built monthly cost distribution chart for nordic-fresh-foods."""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


def generate_cost_distribution_chart(categories: dict, total_monthly: float, output_path: str) -> None:
    palette = ["#0078D4", "#50E6FF", "#1490DF", "#773ADC", "#FFB900", "#107C10", "#D13438"]
    labels = list(categories.keys())
    values = list(categories.values())
    colors = palette[: len(labels)]
    pcts = [v / sum(values) * 100 for v in values]

    fig, ax = plt.subplots(figsize=(8, 6))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    wedges, _ = ax.pie(
        values,
        colors=colors,
        wedgeprops={"linewidth": 2, "edgecolor": "#F8F9FA"},
        startangle=140,
        pctdistance=0.82,
    )

    hole = plt.Circle((0, 0), 0.60, fc="#F8F9FA")
    ax.add_patch(hole)

    ax.text(0, 0.07, f"${total_monthly:,.2f}", ha="center", va="center", fontsize=16, fontweight="bold", color="#1A1A2E")
    ax.text(0, -0.17, "/ month", ha="center", va="center", fontsize=10, color="#666")

    legend_labels = [f"{lbl}  ${val:,.2f}  ({pct:.1f}%)" for lbl, val, pct in zip(labels, values, pcts)]
    patches = [mpatches.Patch(color=c, label=l) for c, l in zip(colors, legend_labels)]
    ax.legend(handles=patches, loc="lower center", bbox_to_anchor=(0.5, -0.18), ncol=2, fontsize=9, framealpha=0.0)

    ax.set_title("As-Built Monthly Cost Distribution", fontsize=13, fontweight="bold", color="#1A1A2E", pad=10)
    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()


if __name__ == "__main__":
    categories = {
        "💻 Compute": 146.00,
        "💾 Data Services": 16.57,
        "🌐 Networking": 1.50,
        "🔐 Security": 5.30,
        "📊 Monitoring": 194.40,
        "Other": 0.0,
    }
    generate_cost_distribution_chart(
        categories,
        total_monthly=sum(categories.values()),
        output_path="agent-output/nordic-fresh-foods/07-ab-cost-distribution.png",
    )
