"""Unit tests for `diagram_io` — the shared PNG+SVG output helper."""

from __future__ import annotations

import base64
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from xml.etree import ElementTree

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
HELPER_PATH = REPO_ROOT / ".github" / "skills" / "apex-python-diagrams" / "scripts" / "diagram_io.py"


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


def test_svg_embeds_absolute_and_relative_icons_and_is_idempotent(diagram_io, tmp_path):
    icon = tmp_path / "icon space.png"
    content = b"\x89PNG\r\n\x1a\nfixture"
    icon.write_bytes(content)
    svg = tmp_path / "diagram.svg"
    svg.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">'
        f'<image xlink:href="{icon}" width="10" height="10"/>'
        '<image href="icon%20space.png"/><text>Keep label</text></svg>'
    )
    diagram_io.embed_svg_images(svg)
    first = svg.read_bytes()
    root = ElementTree.fromstring(first)
    assert root.get("viewBox") == "0 0 100 100"
    images = list(root.iter("{http://www.w3.org/2000/svg}image"))
    for image in images:
        reference = image.get("href") or image.get("{http://www.w3.org/1999/xlink}href")
        assert reference.startswith("data:image/png;base64,")
        assert base64.b64decode(reference.split(",", 1)[1], validate=True) == content
    icon.unlink()
    diagram_io.embed_svg_images(svg)
    assert svg.read_bytes() == first


@pytest.mark.parametrize(
    "reference", ["missing.png", "https://example.test/icon.png", "file:///tmp/icon.png", "secret.txt"]
)
def test_svg_bad_image_reference_leaves_original_unchanged(diagram_io, tmp_path, reference):
    (tmp_path / "secret.txt").write_text("not an image")
    svg = tmp_path / "bad.svg"
    original = f'<svg xmlns="http://www.w3.org/2000/svg"><image href="{reference}"/></svg>'
    svg.write_text(original)
    with pytest.raises((ValueError, FileNotFoundError)):
        diagram_io.embed_svg_images(svg)
    assert svg.read_text() == original


def test_real_diagrams_svg_contains_portable_icon(diagram_io, tmp_path):
    from diagrams import Diagram
    from diagrams.azure.compute import AppServices

    base = tmp_path / "real-icons"
    with Diagram("Portable", **diagram_io.diagram_kwargs(base)):
        AppServices("Web")
    diagram_io.embed_svg_images(base.with_suffix(".svg"))
    images = list(ElementTree.parse(base.with_suffix(".svg")).iter("{http://www.w3.org/2000/svg}image"))
    assert images
    assert all(
        image.get("{http://www.w3.org/1999/xlink}href", "").startswith("data:image/png;base64,") for image in images
    )
    assert base.with_suffix(".png").stat().st_size > 0


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
    kw = diagram_io.diagram_kwargs("04-x", direction="LR", graph_attr={"dpi": "150"}, show=True)
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


def test_render_graphviz_embeds_real_raster_icon(diagram_io, tmp_path):
    import graphviz
    from PIL import Image

    icon = tmp_path / "icon.png"
    Image.new("RGB", (20, 20), "red").save(icon)
    dot = graphviz.Digraph("portable")
    dot.node("service", "Service", image=str(icon), shape="none")
    base = tmp_path / "portable"
    diagram_io.render_graphviz(dot, base)
    icon.unlink()
    images = list(ElementTree.parse(base.with_suffix(".svg")).iter("{http://www.w3.org/2000/svg}image"))
    assert images
    assert all(
        image.get("{http://www.w3.org/1999/xlink}href", "").startswith("data:image/png;base64,") for image in images
    )


@pytest.mark.parametrize("formats", [("png",), ("svg",), ("pdf",), ("png", "svg")])
def test_explicit_output_formats(diagram_io: ModuleType, tmp_path: Path, formats: tuple[str, ...]) -> None:
    import graphviz
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    figure, axes = plt.subplots()
    axes.plot([0, 1], [1, 0])
    graph = graphviz.Digraph("formats")
    graph.edge("source", "target")
    try:
        for name, render in (
            ("chart", lambda base: diagram_io.save_figure(figure, base, formats=formats)),
            ("graph", lambda base: diagram_io.render_graphviz(graph, base, formats=formats)),
        ):
            base = tmp_path / name
            written = render(base)
            assert written == [base.with_suffix(f".{extension}") for extension in formats]
            assert {path.suffix for path in tmp_path.glob(f"{name}.*")} == {f".{extension}" for extension in formats}
            assert all(path.stat().st_size > 0 for path in written)
    finally:
        plt.close(figure)
    assert diagram_io.diagram_kwargs("architecture", formats=formats)["outformat"] == list(formats)
