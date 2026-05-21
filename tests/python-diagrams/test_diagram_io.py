"""Unit tests for `diagram_io` — the shared PNG+SVG output helper."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
HELPER_PATH = REPO_ROOT / ".github" / "skills" / "python-diagrams" / "scripts" / "diagram_io.py"


@pytest.fixture(scope="module")
def diagram_io():
    """Load `diagram_io.py` directly so tests don't require sys.path tweaks."""
    spec = importlib.util.spec_from_file_location("diagram_io", HELPER_PATH)
    assert spec is not None and spec.loader is not None, f"Cannot load {HELPER_PATH}"
    module = importlib.util.module_from_spec(spec)
    sys.modules["diagram_io"] = module
    spec.loader.exec_module(module)
    return module


# ─── FORMATS contract ───────────────────────────────────────────────────────


def test_formats_includes_png_and_svg(diagram_io):
    assert "png" in diagram_io.FORMATS
    assert "svg" in diagram_io.FORMATS


def test_formats_is_immutable_tuple(diagram_io):
    # tuple, not list — guards against accidental mutation from a call site.
    assert isinstance(diagram_io.FORMATS, tuple)


# ─── diagram_kwargs ─────────────────────────────────────────────────────────


def test_diagram_kwargs_default_shape(diagram_io):
    kw = diagram_io.diagram_kwargs("04-architecture-diagram")
    assert kw["filename"] == "04-architecture-diagram"
    assert kw["outformat"] == ["png", "svg"]
    assert kw["show"] is False


def test_diagram_kwargs_strips_known_extension(diagram_io):
    # Forgiving contract: legacy call sites passed `foo.png` — strip it.
    kw = diagram_io.diagram_kwargs("04-architecture-diagram.png")
    assert kw["filename"] == "04-architecture-diagram"


def test_diagram_kwargs_overrides_win(diagram_io):
    kw = diagram_io.diagram_kwargs(
        "04-x", direction="LR", graph_attr={"dpi": "150"}, show=True
    )
    assert kw["direction"] == "LR"
    assert kw["graph_attr"] == {"dpi": "150"}
    assert kw["show"] is True


def test_diagram_kwargs_custom_formats(diagram_io):
    kw = diagram_io.diagram_kwargs("x", formats=("png",))
    assert kw["outformat"] == ["png"]


# ─── save_figure (matplotlib) ───────────────────────────────────────────────


def test_save_figure_writes_png_and_svg_siblings(diagram_io, tmp_path):
    matplotlib = pytest.importorskip("matplotlib")
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(4, 3))
    ax.bar(["a", "b", "c"], [1, 2, 3])

    base = tmp_path / "02-waf-scores"
    written = diagram_io.save_figure(fig, base, bbox_inches="tight")
    plt.close(fig)

    assert (tmp_path / "02-waf-scores.png").exists(), "PNG sibling missing"
    assert (tmp_path / "02-waf-scores.svg").exists(), "SVG sibling missing"
    assert [p.suffix for p in written] == [".png", ".svg"]
    # SVG sanity check — should be readable text starting with <?xml or <svg.
    svg_text = (tmp_path / "02-waf-scores.svg").read_text(encoding="utf-8")
    assert svg_text.lstrip().startswith(("<?xml", "<svg")), "SVG should be text-based"


def test_save_figure_accepts_explicit_png_path(diagram_io, tmp_path):
    matplotlib = pytest.importorskip("matplotlib")
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, _ = plt.subplots()
    # Pass `<base>.png` — helper should still produce both siblings.
    diagram_io.save_figure(fig, tmp_path / "chart.png")
    plt.close(fig)

    assert (tmp_path / "chart.png").exists()
    assert (tmp_path / "chart.svg").exists()


def test_save_figure_creates_parent_directory(diagram_io, tmp_path):
    matplotlib = pytest.importorskip("matplotlib")
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, _ = plt.subplots()
    nested = tmp_path / "agent-output" / "demo" / "07-ab-cost-distribution"
    diagram_io.save_figure(fig, nested)
    plt.close(fig)

    assert nested.with_suffix(".png").exists()
    assert nested.with_suffix(".svg").exists()


# ─── render_graphviz ────────────────────────────────────────────────────────


def test_render_graphviz_writes_both_formats(diagram_io, tmp_path):
    graphviz = pytest.importorskip("graphviz")

    dot = graphviz.Digraph("test")
    dot.node("a", "A")
    dot.node("b", "B")
    dot.edge("a", "b")

    base = tmp_path / "process-flow"
    written = diagram_io.render_graphviz(dot, base)

    assert (tmp_path / "process-flow.png").exists()
    assert (tmp_path / "process-flow.svg").exists()
    assert {p.suffix for p in written} == {".png", ".svg"}
