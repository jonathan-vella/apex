"""Cost distribution donut chart for nordic-foods Step 2."""
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


def generate_cost_distribution_chart(categories: dict, total_monthly: float,
                                     output_path: str) -> None:
    PALETTE = [
        "#0078D4",  # Compute - Azure blue
        "#50E6FF",  # Data - Azure cyan
        "#1490DF",  # Networking - medium blue
        "#FFB900",  # Observability - gold
        "#107C10",  # Bandwidth - green
    ]
    labels = list(categories.keys())
    values = list(categories.values())
    colors = PALETTE[: len(labels)]
    pcts = [v / sum(values) * 100 for v in values]

    fig, ax = plt.subplots(figsize=(8, 6))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    wedges, _ = ax.pie(values, colors=colors,
                       wedgeprops={"linewidth": 2, "edgecolor": "#F8F9FA"},
                       startangle=140, pctdistance=0.82)

    hole = plt.Circle((0, 0), 0.60, fc="#F8F9FA")
    ax.add_patch(hole)

    ax.text(0, 0.07, f"${total_monthly:,.0f}", ha="center", va="center",
            fontsize=17, fontweight="bold", color="#1A1A2E")
    ax.text(0, -0.17, "/ month", ha="center", va="center", fontsize=10, color="#666")

    legend_labels = [f"{lbl}  ${val:,.2f}  ({pct:.0f}%)"
                     for lbl, val, pct in zip(labels, values, pcts)]
    patches = [mpatches.Patch(color=c, label=l) for c, l in zip(colors, legend_labels)]
    ax.legend(handles=patches, loc="lower center", bbox_to_anchor=(0.5, -0.15),
              ncol=2, fontsize=9, framealpha=0.0, columnspacing=1.2)

    ax.set_title("nordic-foods — Monthly Cost Distribution (Secure-Plus)",
                 fontsize=13, fontweight="bold", color="#1A1A2E", pad=10)

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


if __name__ == "__main__":
    categories = {
        "💻 Compute":       246.74,
        "💾 Data Services": 152.81,
        "🌐 Networking":     23.10,
        "📊 Observability":  12.00,
        "📤 Bandwidth":       0.00,
    }
    generate_cost_distribution_chart(
        categories, total_monthly=sum(categories.values()),
        output_path="agent-output/nordic-foods/03-des-cost-distribution.png",
    )
