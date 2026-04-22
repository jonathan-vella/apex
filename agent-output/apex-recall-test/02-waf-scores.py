import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


def generate_waf_chart(scores: dict, output_path: str = "02-waf-scores.png") -> None:
    PILLAR_COLORS = {
        "🔒 Security":               "#C00000",
        "🔄 Reliability":            "#107C10",
        "⚡ Performance Efficiency": "#FF8C00",
        "💰 Cost Optimization":      "#FFB900",
        "🔧 Operational Excellence": "#8764B8",
    }

    pillars = list(scores.keys())
    values = [scores[p] for p in pillars]
    colors = [PILLAR_COLORS.get(p, "#0078D4") for p in pillars]

    fig, ax = plt.subplots(figsize=(10, 4))
    fig.patch.set_facecolor("#F8F9FA")
    ax.set_facecolor("#F8F9FA")

    bars = ax.barh(pillars, values, color=colors, height=0.55,
                   edgecolor="white", linewidth=1.2)

    for bar, val in zip(bars, values):
        label_x = val - 0.3 if val >= 1.5 else val + 0.15
        color = "white" if val >= 1.5 else "#333"
        ax.text(label_x, bar.get_y() + bar.get_height() / 2,
                f"{val:.1f}", va="center", ha="right" if val >= 1.5 else "left",
                fontsize=11, fontweight="bold", color=color)

    ax.axvline(x=6, color="#DC3545", linewidth=1, linestyle="--", alpha=0.6, label="Minimum (6)")
    ax.axvline(x=8, color="#28A745", linewidth=1, linestyle="--", alpha=0.5, label="Target (8)")

    ax.set_xlim(0, 10)
    ax.set_xlabel("Score (out of 10)", fontsize=10, color="#555")
    ax.set_title("Azure Well-Architected Framework — Pillar Scores",
                 fontsize=13, fontweight="bold", color="#1A1A2E", pad=14)
    ax.tick_params(axis="y", labelsize=10, colors="#333")
    ax.tick_params(axis="x", labelsize=9, colors="#666")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#DDD")
    ax.xaxis.set_major_locator(plt.MultipleLocator(1))
    ax.grid(axis="x", color="#E0E0E0", linewidth=0.8, alpha=0.7)
    ax.legend(fontsize=9, loc="lower right", framealpha=0.9, edgecolor="#CCC")

    plt.tight_layout(pad=1.4)
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Generated: {output_path}")


scores = {
    "🔒 Security":               8.0,
    "🔄 Reliability":            7.0,
    "⚡ Performance Efficiency": 9.0,
    "💰 Cost Optimization":      7.0,
    "🔧 Operational Excellence": 7.0,
}
generate_waf_chart(scores, "agent-output/malta-catering/02-waf-scores.png")
