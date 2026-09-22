"""diagram_io — single source of truth for diagram output formats.

All Python diagram generators in this repo (matplotlib charts, `diagrams`
library architectures, graphviz process flows) save outputs in BOTH PNG
and SVG via the helpers below. PNG remains the default raster preview;
SVG is the scalable, accessible, diff-reviewable sibling.

Why centralize? Every agent-generated `.py` (`02-waf-scores.py`,
`03-des-cost-distribution.py`, `04-*-diagram.py`, `07-ab-*.py`) used to
re-author its own `plt.savefig(...)` / `Diagram(..., outformat=...)`
boilerplate. Drift was inevitable. With `diagram_io`, the output-format
contract toggles in one place and every call site inherits SVG for free.

This module uses only the Python standard library. matplotlib,
`diagrams`, and graphviz are only touched by call sites that already
import them — `diagram_io` itself stays import-light.
"""

from __future__ import annotations

import base64
from collections.abc import Iterable
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

FORMATS: tuple[str, ...] = ("png", "svg")
"""Default output formats every diagram emits.

PNG → backward-compatible raster preview (GitHub markdown, docs site fallback).
SVG → scalable vector, text-selectable, screen-reader friendly, diff-friendly.
"""

DEFAULT_DPI = 150  # matches design tokens in references/python-charts.md


def _strip_known_suffix(base_path: str | Path) -> Path:
    """Return `base_path` with any known FORMATS suffix removed.

    `diagram_io` accepts call sites that pass either `"foo"` or `"foo.png"`
    so the contract is forgiving when refactoring legacy scripts.
    """
    p = Path(base_path)
    if p.suffix.lower().lstrip(".") in FORMATS:
        return p.with_suffix("")
    return p


def embed_svg_images(svg_path: str | Path) -> Path:
    """Embed local raster icons in a generated SVG; reject unresolved references before writing."""
    output = Path(svg_path)
    tree = ElementTree.parse(output)
    changed = False
    for image in tree.iter("{http://www.w3.org/2000/svg}image"):
        for attribute in ("href", "{http://www.w3.org/1999/xlink}href"):
            reference = image.get(attribute)
            if reference is None:
                continue
            if reference.startswith("data:image/"):
                continue
            parsed = urlsplit(reference)
            if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or not parsed.path:
                raise ValueError(f"Unsupported SVG image reference: {reference}")
            source = Path(unquote(parsed.path))
            if not source.is_absolute():
                source = output.parent / source
            content = source.read_bytes()
            if content.startswith(b"\x89PNG\r\n\x1a\n"):
                mime = "image/png"
            elif content.startswith(b"\xff\xd8\xff"):
                mime = "image/jpeg"
            elif content.startswith((b"GIF87a", b"GIF89a")):
                mime = "image/gif"
            elif content.startswith(b"RIFF") and content[8:12] == b"WEBP":
                mime = "image/webp"
            else:
                raise ValueError(f"Unsupported raster icon: {source}")
            image.set(attribute, f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}")
            changed = True
    if changed:
        ElementTree.register_namespace("", "http://www.w3.org/2000/svg")
        ElementTree.register_namespace("xlink", "http://www.w3.org/1999/xlink")
        tree.write(output, encoding="utf-8", xml_declaration=True)
    return output


def save_figure(
    fig: Any,
    base_path: str | Path,
    *,
    formats: Iterable[str] = FORMATS,
    dpi: int = DEFAULT_DPI,
    **savefig_kwargs: Any,
) -> list[Path]:
    """Save a matplotlib `Figure` as `<base>.png` + `<base>.svg` siblings.

    `base_path` may include or omit a known extension — it is normalised.
    Extra `savefig_kwargs` (e.g. `bbox_inches="tight"`,
    `facecolor=fig.get_facecolor()`) are forwarded to every format.

    Returns the list of written file paths, in `formats` order.
    """
    base = _strip_known_suffix(base_path)
    if base.parent != Path():
        base.parent.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for ext in formats:
        out = base.with_suffix(f".{ext}")
        # `dpi` is meaningful for raster output; matplotlib accepts it for
        # SVG too without effect, so pass it uniformly for simplicity.
        fig.savefig(out, dpi=dpi, **savefig_kwargs)
        saved.append(out)
    return saved


def diagram_kwargs(
    filename: str | Path,
    *,
    formats: Iterable[str] = FORMATS,
    show: bool = False,
    **overrides: Any,
) -> dict[str, Any]:
    """Return standard kwargs for the `diagrams` library `Diagram(...)` ctor.

    Usage::

        from diagrams import Diagram
        from diagram_io import diagram_kwargs, embed_svg_images

        with Diagram(**diagram_kwargs("04-architecture-diagram", direction="LR")):
            ...
        embed_svg_images("04-architecture-diagram.svg")

    The `diagrams` library accepts `outformat` as a list to emit multiple
    formats from a single render. Explicit `overrides` (e.g. `direction`,
    `graph_attr`, `node_attr`) win over the defaults.
    Finalize the SVG after the context exits to embed container-local icons.
    """
    base = str(_strip_known_suffix(filename))
    defaults: dict[str, Any] = {
        "filename": base,
        "outformat": list(formats),
        "show": show,
    }
    defaults.update(overrides)
    return defaults


def render_graphviz(
    dot: Any,
    base_path: str | Path,
    *,
    formats: Iterable[str] = FORMATS,
    cleanup: bool = True,
) -> list[Path]:
    """Render a graphviz `Digraph`/`Graph` once per format in `formats`.

    Graphviz only renders one format per `render()` call, so we set
    `.format` and call `.render()` per format. Returns the written paths.
    """
    base = _strip_known_suffix(base_path)
    if base.parent != Path():
        base.parent.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    # graphviz uses `.filename` as the output basename — normalise it so
    # the caller does not need to strip extensions themselves.
    dot.filename = str(base)
    for ext in formats:
        dot.format = ext
        dot.render(cleanup=cleanup)
        if ext == "svg":
            embed_svg_images(base.with_suffix(".svg"))
        saved.append(base.with_suffix(f".{ext}"))
    return saved


__all__ = [
    "FORMATS",
    "DEFAULT_DPI",
    "save_figure",
    "diagram_kwargs",
    "render_graphviz",
    "embed_svg_images",
]
